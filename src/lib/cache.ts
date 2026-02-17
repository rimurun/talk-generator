// インメモリキャッシュシステム - コスト削減最適化版
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
  private readonly TOPIC_CACHE_TTL = 30 * 60 * 1000; // 30分（15分→30分に延長）
  private readonly SCRIPT_CACHE_TTL = 3 * 60 * 60 * 1000; // 3時間（1時間→3時間に延長）
  private readonly BATCH_CACHE_TTL = 45 * 60 * 1000; // 45分（バッチ結果用）
  
  // 統計情報
  private hits = 0;
  private misses = 0;
  
  // トピック一覧をキャッシュ（改良版）
  setTopics(key: string, topics: any): void {
    this.cache.set(`topics:${key}`, {
      data: topics,
      timestamp: Date.now(),
      accessCount: 0,
      lastAccessed: Date.now()
    });
  }
  
  // トピック一覧を取得（改良版）
  getTopics(key: string): any | null {
    const entry = this.cache.get(`topics:${key}`);
    if (!entry) {
      this.misses++;
      return null;
    }
    
    if (Date.now() - entry.timestamp > this.TOPIC_CACHE_TTL) {
      this.cache.delete(`topics:${key}`);
      this.misses++;
      return null;
    }
    
    // アクセス統計更新
    entry.accessCount++;
    entry.lastAccessed = Date.now();
    this.hits++;
    
    return entry.data;
  }

  // ファジーマッチによるトピック取得（新機能）
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
      
      // TTL チェック
      if (Date.now() - entry.timestamp > this.TOPIC_CACHE_TTL) {
        this.cache.delete(cacheKey);
        continue;
      }

      try {
        const cachedFilters = JSON.parse(cacheKey.replace('topics:', ''));
        const similarity = this.calculateFilterSimilarity(filters, cachedFilters);
        
        // 70%以上の類似度があれば候補
        if (similarity > 0.7 && similarity > bestSimilarity) {
          bestSimilarity = similarity;
          bestMatch = { 
            data: this.filterTopicsForSimilar(entry.data, filters, cachedFilters), 
            similarity, 
            cacheKey 
          };
          
          // アクセス統計更新
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
  
  // 台本をキャッシュ（改良版）
  setScript(key: string, script: any): void {
    this.cache.set(`script:${key}`, {
      data: script,
      timestamp: Date.now(),
      accessCount: 0,
      lastAccessed: Date.now()
    });
  }
  
  // 台本を取得（改良版）
  getScript(key: string): any | null {
    const entry = this.cache.get(`script:${key}`);
    if (!entry) {
      this.misses++;
      return null;
    }
    
    if (Date.now() - entry.timestamp > this.SCRIPT_CACHE_TTL) {
      this.cache.delete(`script:${key}`);
      this.misses++;
      return null;
    }
    
    // アクセス統計更新
    entry.accessCount++;
    entry.lastAccessed = Date.now();
    this.hits++;
    
    return entry.data;
  }

  // 台本のファジーマッチ取得（新機能）
  getScriptFuzzy(topicId: string, duration: number, tension: string, tone: string): { data: any; baseKey: string } | null {
    // 基本キー（topicId + duration）でマッチを探す
    const basePattern = `${topicId}-${duration}-`;
    
    for (const [cacheKey, entry] of this.cache.entries()) {
      if (!cacheKey.startsWith('script:')) continue;
      
      const scriptKey = cacheKey.replace('script:', '');
      if (!scriptKey.startsWith(basePattern)) continue;
      
      // TTL チェック
      if (Date.now() - entry.timestamp > this.SCRIPT_CACHE_TTL) {
        this.cache.delete(cacheKey);
        continue;
      }

      // 基本データは同じなので再利用可能
      const adaptedScript = this.adaptScriptForTensionTone(entry.data, tension, tone);
      
      // アクセス統計更新
      entry.accessCount++;
      entry.lastAccessed = Date.now();
      this.hits++;
      
      return { data: adaptedScript, baseKey: cacheKey };
    }

    this.misses++;
    return null;
  }

  // バッチ生成結果をキャッシュ（新機能）
  setBatch(key: string, topics: any): void {
    this.cache.set(`batch:${key}`, {
      data: topics,
      timestamp: Date.now(),
      accessCount: 0,
      lastAccessed: Date.now()
    });
  }

  // バッチ生成結果を取得（新機能）
  getBatch(key: string): any | null {
    const entry = this.cache.get(`batch:${key}`);
    if (!entry) {
      this.misses++;
      return null;
    }
    
    if (Date.now() - entry.timestamp > this.BATCH_CACHE_TTL) {
      this.cache.delete(`batch:${key}`);
      this.misses++;
      return null;
    }
    
    // アクセス統計更新
    entry.accessCount++;
    entry.lastAccessed = Date.now();
    this.hits++;
    
    return entry.data;
  }
  
  // キャッシュクリア
  clear(): void {
    this.cache.clear();
  }
  
  // キャッシュ統計（改良版）
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

  // ヘルパー関数: 正規化されたトピックキーを作成
  private createNormalizedTopicsKey(filters: any): string {
    // フィルタを正規化（順序を統一）
    const normalized = {
      categories: [...(filters.categories || [])].sort(),
      duration: filters.duration || 60,
      tension: filters.tension || 'medium',
      tone: filters.tone || '',
      includeIncidents: filters.includeIncidents || false
    };
    return JSON.stringify(normalized);
  }

  // ヘルパー関数: フィルタ類似度を計算
  private calculateFilterSimilarity(filters1: any, filters2: any): number {
    let score = 0;
    let maxScore = 0;

    // カテゴリの類似度 (重要度: 40%)
    const cats1 = new Set(filters1.categories || []);
    const cats2 = new Set(filters2.categories || []);
    const catIntersection = new Set([...cats1].filter(x => cats2.has(x)));
    const catUnion = new Set([...cats1, ...cats2]);
    
    if (catUnion.size > 0) {
      score += (catIntersection.size / catUnion.size) * 0.4;
    } else if (cats1.size === 0 && cats2.size === 0) {
      score += 0.4; // 両方とも全カテゴリの場合
    }
    maxScore += 0.4;

    // テンション (重要度: 20%)
    if (filters1.tension === filters2.tension) {
      score += 0.2;
    }
    maxScore += 0.2;

    // 事件事故フラグ (重要度: 20%)
    if (filters1.includeIncidents === filters2.includeIncidents) {
      score += 0.2;
    }
    maxScore += 0.2;

    // 尺 (重要度: 10%)
    if (filters1.duration === filters2.duration) {
      score += 0.1;
    }
    maxScore += 0.1;

    // 口調 (重要度: 10%)
    if (filters1.tone === filters2.tone) {
      score += 0.1;
    }
    maxScore += 0.1;

    return maxScore > 0 ? score / maxScore : 0;
  }

  // ヘルパー関数: 類似フィルタ用にトピックをフィルタリング
  private filterTopicsForSimilar(cachedTopics: any[], targetFilters: any, cachedFilters: any): any[] {
    let filtered = cachedTopics;

    // カテゴリフィルタが異なる場合
    if (targetFilters.categories && targetFilters.categories.length > 0) {
      const targetCats = new Set(targetFilters.categories);
      filtered = filtered.filter(topic => targetCats.has(topic.category));
    }

    // 事件事故フィルタが異なる場合
    if (targetFilters.includeIncidents !== cachedFilters.includeIncidents) {
      if (!targetFilters.includeIncidents) {
        filtered = filtered.filter(topic => topic.category !== '事件事故');
      }
    }

    return filtered;
  }

  // ヘルパー関数: tension/toneの異なる台本を適応
  private adaptScriptForTensionTone(baseScript: any, newTension: string, newTone: string): any {
    // 基本構造はそのまま、tension/toneだけ更新
    return {
      ...baseScript,
      tension: newTension,
      tone: newTone,
      // contentの調整は実際のAI呼び出しなしで軽微な変更のみ
      content: {
        ...baseScript.content,
        // 実際の実装では、tensionに応じた文体調整など
      }
    };
  }

  // プリフェッチ機能（新機能）
  async prefetchTopicsForCategories(categories: string[]): Promise<void> {
    // 一般的なフィルタ組み合わせをプリフェッチ
    const commonFilters = [
      { categories: [], includeIncidents: false, tension: 'medium', duration: 60 },
      { categories: ['ニュース'], includeIncidents: false, tension: 'medium', duration: 60 },
      { categories: ['エンタメ'], includeIncidents: false, tension: 'medium', duration: 60 },
      { categories: ['SNS'], includeIncidents: false, tension: 'high', duration: 60 },
    ];

    // 既存のキャッシュを確認して、ない場合のみプリフェッチ対象とする
    const toPrefetch = commonFilters.filter(filters => {
      const key = this.createNormalizedTopicsKey(filters);
      return !this.getTopics(key);
    });

    // 実際のプリフェッチは外部から実行される想定
    // （ここではキューに追加するなどの処理）
    console.log(`🚀 プリフェッチ対象: ${toPrefetch.length}件`);
  }
  
  // 期限切れエントリのクリーンアップ
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
  }
}

// シングルトンキャッシュインスタンス
export const memoryCache = new MemoryCache();

// キャッシュキー生成ヘルパー（改良版）
export function createTopicsCacheKey(filters: any): string {
  // フィルタを正規化してから文字列化（順序統一でキャッシュヒット率向上）
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
  // バッチ処理用のキー生成
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