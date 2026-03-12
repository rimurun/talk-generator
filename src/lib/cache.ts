// キャッシュシステム - Supabase永続キャッシュ + インメモリフォールバック
import { getDbCacheService, isSupabaseConfigured } from './db';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
}

interface CacheStats {
  totalEntries: number;
  topicEntries: number;
  scriptEntries: number;
  batchEntries: number;
  hitRate: number;
  totalHits: number;
  totalMisses: number;
}

class MemoryCache {
  private cache = new Map<string, CacheEntry<any>>();
  private readonly TOPIC_CACHE_TTL = 30 * 60 * 1000; // 30分
  private readonly SCRIPT_CACHE_TTL = 3 * 60 * 60 * 1000; // 3時間
  private readonly BATCH_CACHE_TTL = 45 * 60 * 1000; // 45分

  // 統計情報
  private hits = 0;
  private misses = 0;

  /**
   * Supabase DB キャッシュが利用可能かどうか
   */
  private get useDb(): boolean {
    return isSupabaseConfigured();
  }

  // ===========================================================
  // トピック一覧キャッシュ
  // ===========================================================

  setTopics(key: string, topics: any): void {
    // インメモリに常に保存
    this.cache.set(`topics:${key}`, {
      data: topics,
      timestamp: Date.now(),
      accessCount: 0,
      lastAccessed: Date.now()
    });

    // Supabase にも非同期保存
    if (this.useDb) {
      getDbCacheService().setTopics(key, topics).catch(err =>
        console.error('DB cache setTopics error:', err)
      );
    }
  }

  getTopics(key: string): any | null {
    // インメモリ優先
    const entry = this.cache.get(`topics:${key}`);
    if (entry && Date.now() - entry.timestamp <= this.TOPIC_CACHE_TTL) {
      entry.accessCount++;
      entry.lastAccessed = Date.now();
      this.hits++;
      return entry.data;
    }

    if (entry) {
      this.cache.delete(`topics:${key}`);
    }

    this.misses++;
    return null;
  }

  /**
   * Supabase DB からトピックキャッシュを取得（非同期版）
   * インメモリにヒットしなかった場合にフォールバック
   */
  async getTopicsFromDb(key: string): Promise<any | null> {
    if (!this.useDb) return null;

    const data = await getDbCacheService().getTopics(key);
    if (data) {
      // インメモリにも復元
      this.cache.set(`topics:${key}`, {
        data,
        timestamp: Date.now(),
        accessCount: 1,
        lastAccessed: Date.now()
      });
      this.hits++;
      return data;
    }
    return null;
  }

  // ファジーマッチによるトピック取得
  getTopicsFuzzy(filters: any): { data: any; similarity: number; cacheKey: string } | null {
    const targetKey = this.createNormalizedTopicsKey(filters);

    // 完全一致を先にチェック
    const exactMatch = this.getTopics(targetKey);
    if (exactMatch) {
      return { data: exactMatch, similarity: 1.0, cacheKey: targetKey };
    }

    // 類似フィルタを探す
    let bestMatch: { data: any; similarity: number; cacheKey: string } | null = null;
    let bestSimilarity = 0;

    for (const [cacheKey, entry] of this.cache.entries()) {
      if (!cacheKey.startsWith('topics:')) continue;

      if (Date.now() - entry.timestamp > this.TOPIC_CACHE_TTL) {
        this.cache.delete(cacheKey);
        continue;
      }

      try {
        const cachedFilters = JSON.parse(cacheKey.replace('topics:', ''));
        const similarity = this.calculateFilterSimilarity(filters, cachedFilters);

        if (similarity > 0.7 && similarity > bestSimilarity) {
          bestSimilarity = similarity;
          bestMatch = {
            data: this.filterTopicsForSimilar(entry.data, filters, cachedFilters),
            similarity,
            cacheKey
          };

          entry.accessCount++;
          entry.lastAccessed = Date.now();
        }
      } catch (e) {
        // キー解析失敗は無視
      }
    }

    if (bestMatch) {
      this.hits++;
      return bestMatch;
    }

    this.misses++;
    return null;
  }

  // ===========================================================
  // 台本キャッシュ
  // ===========================================================

  setScript(key: string, script: any): void {
    this.cache.set(`script:${key}`, {
      data: script,
      timestamp: Date.now(),
      accessCount: 0,
      lastAccessed: Date.now()
    });

    if (this.useDb) {
      getDbCacheService().setScript(key, script).catch(err =>
        console.error('DB cache setScript error:', err)
      );
    }
  }

  getScript(key: string): any | null {
    const entry = this.cache.get(`script:${key}`);
    if (entry && Date.now() - entry.timestamp <= this.SCRIPT_CACHE_TTL) {
      entry.accessCount++;
      entry.lastAccessed = Date.now();
      this.hits++;
      return entry.data;
    }

    if (entry) {
      this.cache.delete(`script:${key}`);
    }

    this.misses++;
    return null;
  }

  async getScriptFromDb(key: string): Promise<any | null> {
    if (!this.useDb) return null;

    const data = await getDbCacheService().getScript(key);
    if (data) {
      this.cache.set(`script:${key}`, {
        data,
        timestamp: Date.now(),
        accessCount: 1,
        lastAccessed: Date.now()
      });
      this.hits++;
      return data;
    }
    return null;
  }

  // 台本のファジーマッチ取得
  getScriptFuzzy(topicId: string, duration: number, tension: string, tone: string): { data: any; baseKey: string } | null {
    const basePattern = `${topicId}-${duration}-`;

    for (const [cacheKey, entry] of this.cache.entries()) {
      if (!cacheKey.startsWith('script:')) continue;

      const scriptKey = cacheKey.replace('script:', '');
      if (!scriptKey.startsWith(basePattern)) continue;

      if (Date.now() - entry.timestamp > this.SCRIPT_CACHE_TTL) {
        this.cache.delete(cacheKey);
        continue;
      }

      const adaptedScript = this.adaptScriptForTensionTone(entry.data, tension, tone);

      entry.accessCount++;
      entry.lastAccessed = Date.now();
      this.hits++;

      return { data: adaptedScript, baseKey: cacheKey };
    }

    this.misses++;
    return null;
  }

  // ===========================================================
  // バッチ生成結果キャッシュ
  // ===========================================================

  setBatch(key: string, topics: any): void {
    this.cache.set(`batch:${key}`, {
      data: topics,
      timestamp: Date.now(),
      accessCount: 0,
      lastAccessed: Date.now()
    });

    if (this.useDb) {
      getDbCacheService().setBatch(key, topics).catch(err =>
        console.error('DB cache setBatch error:', err)
      );
    }
  }

  getBatch(key: string): any | null {
    const entry = this.cache.get(`batch:${key}`);
    if (entry && Date.now() - entry.timestamp <= this.BATCH_CACHE_TTL) {
      entry.accessCount++;
      entry.lastAccessed = Date.now();
      this.hits++;
      return entry.data;
    }

    if (entry) {
      this.cache.delete(`batch:${key}`);
    }

    this.misses++;
    return null;
  }

  async getBatchFromDb(key: string): Promise<any | null> {
    if (!this.useDb) return null;

    const data = await getDbCacheService().getBatch(key);
    if (data) {
      this.cache.set(`batch:${key}`, {
        data,
        timestamp: Date.now(),
        accessCount: 1,
        lastAccessed: Date.now()
      });
      this.hits++;
      return data;
    }
    return null;
  }

  // ===========================================================
  // キャッシュ管理
  // ===========================================================

  clear(): void {
    this.cache.clear();

    // Supabase キャッシュもクリア
    if (this.useDb) {
      getDbCacheService().clear().catch(err =>
        console.error('DB cache clear error:', err)
      );
    }
  }

  getStats(): CacheStats {
    const entries = Array.from(this.cache.keys());
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? (this.hits / total) * 100 : 0;

    return {
      totalEntries: entries.length,
      topicEntries: entries.filter(key => key.startsWith('topics:')).length,
      scriptEntries: entries.filter(key => key.startsWith('script:')).length,
      batchEntries: entries.filter(key => key.startsWith('batch:')).length,
      hitRate: Math.round(hitRate * 100) / 100,
      totalHits: this.hits,
      totalMisses: this.misses
    };
  }

  /**
   * 統合統計（インメモリ + DB）を非同期で取得
   */
  async getStatsWithDb(): Promise<CacheStats> {
    const memoryStats = this.getStats();

    if (!this.useDb) return memoryStats;

    try {
      const dbStats = await getDbCacheService().getStats();
      return {
        totalEntries: memoryStats.totalEntries + dbStats.totalEntries,
        topicEntries: memoryStats.topicEntries + dbStats.topicEntries,
        scriptEntries: memoryStats.scriptEntries + dbStats.scriptEntries,
        batchEntries: memoryStats.batchEntries + dbStats.batchEntries,
        hitRate: memoryStats.hitRate, // ヒット率はインメモリベース
        totalHits: memoryStats.totalHits + dbStats.totalHits,
        totalMisses: memoryStats.totalMisses + dbStats.totalMisses,
      };
    } catch {
      return memoryStats;
    }
  }

  // ===========================================================
  // ヘルパー関数
  // ===========================================================

  private createNormalizedTopicsKey(filters: any): string {
    const normalized = {
      categories: [...(filters.categories || [])].sort(),
      duration: filters.duration || 60,
      tension: filters.tension || 'medium',
      tone: filters.tone || '',
      includeIncidents: filters.includeIncidents || false
    };
    return JSON.stringify(normalized);
  }

  private calculateFilterSimilarity(filters1: any, filters2: any): number {
    let score = 0;
    let maxScore = 0;

    const cats1 = new Set(filters1.categories || []);
    const cats2 = new Set(filters2.categories || []);
    const catIntersection = new Set([...cats1].filter(x => cats2.has(x)));
    const catUnion = new Set([...cats1, ...cats2]);

    if (catUnion.size > 0) {
      score += (catIntersection.size / catUnion.size) * 0.4;
    } else if (cats1.size === 0 && cats2.size === 0) {
      score += 0.4;
    }
    maxScore += 0.4;

    if (filters1.tension === filters2.tension) {
      score += 0.2;
    }
    maxScore += 0.2;

    if (filters1.includeIncidents === filters2.includeIncidents) {
      score += 0.2;
    }
    maxScore += 0.2;

    if (filters1.duration === filters2.duration) {
      score += 0.1;
    }
    maxScore += 0.1;

    if (filters1.tone === filters2.tone) {
      score += 0.1;
    }
    maxScore += 0.1;

    return maxScore > 0 ? score / maxScore : 0;
  }

  private filterTopicsForSimilar(cachedTopics: any[], targetFilters: any, cachedFilters: any): any[] {
    let filtered = cachedTopics;

    if (targetFilters.categories && targetFilters.categories.length > 0) {
      const targetCats = new Set(targetFilters.categories);
      filtered = filtered.filter(topic => targetCats.has(topic.category));
    }

    if (targetFilters.includeIncidents !== cachedFilters.includeIncidents) {
      if (!targetFilters.includeIncidents) {
        filtered = filtered.filter(topic => topic.category !== '事件事故');
      }
    }

    return filtered;
  }

  private adaptScriptForTensionTone(baseScript: any, newTension: string, newTone: string): any {
    return {
      ...baseScript,
      tension: newTension,
      tone: newTone,
      content: {
        ...baseScript.content,
      }
    };
  }

  async prefetchTopicsForCategories(categories: string[]): Promise<void> {
    const commonFilters = [
      { categories: [], includeIncidents: false, tension: 'medium', duration: 60 },
      { categories: ['ニュース'], includeIncidents: false, tension: 'medium', duration: 60 },
      { categories: ['エンタメ'], includeIncidents: false, tension: 'medium', duration: 60 },
      { categories: ['SNS'], includeIncidents: false, tension: 'high', duration: 60 },
    ];

    const toPrefetch = commonFilters.filter(filters => {
      const key = this.createNormalizedTopicsKey(filters);
      return !this.getTopics(key);
    });

    console.log(`🚀 プリフェッチ対象: ${toPrefetch.length}件`);
  }

  cleanup(): void {
    const now = Date.now();
    const entries = Array.from(this.cache.entries());

    for (const [key, entry] of entries) {
      const isTopicEntry = key.startsWith('topics:');
      const isScriptEntry = key.startsWith('script:');
      const ttl = isTopicEntry ? this.TOPIC_CACHE_TTL :
                   isScriptEntry ? this.SCRIPT_CACHE_TTL :
                   this.TOPIC_CACHE_TTL;

      if (now - entry.timestamp > ttl) {
        this.cache.delete(key);
      }
    }

    // Supabase の期限切れキャッシュも削除
    if (this.useDb) {
      getDbCacheService().cleanup().catch(err =>
        console.error('DB cache cleanup error:', err)
      );
    }
  }
}

// シングルトンキャッシュインスタンス
export const memoryCache = new MemoryCache();

// キャッシュキー生成ヘルパー
export function createTopicsCacheKey(filters: any): string {
  const normalized = {
    categories: [...(filters.categories || [])].sort(),
    duration: filters.duration || 60,
    tension: filters.tension || 'medium',
    tone: filters.tone || '',
    includeIncidents: filters.includeIncidents || false
  };
  return JSON.stringify(normalized);
}

export function createScriptCacheKey(topicId: string, duration: number, tension: string, tone: string): string {
  return `${topicId}-${duration}-${tension}-${tone}`;
}

export function createBatchCacheKey(categories: string[], count: number, diversityMode: boolean): string {
  const normalized = {
    categories: [...categories].sort(),
    count,
    diversityMode: diversityMode || false
  };
  return JSON.stringify(normalized);
}

// 定期クリーンアップ（5分おき）
if (typeof window === 'undefined') {
  setInterval(() => {
    memoryCache.cleanup();
  }, 5 * 60 * 1000);
}
