// Supabase Database Service
// storage.ts (LocalStorage) と cache.ts (MemoryCache) の代替 DB レイヤー
// 同じ公開APIインターフェースを維持

import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServer, isSupabaseConfigured } from './supabase';
import type { UserProfile, FavoriteItem, GenerationHistory, ScriptRating } from './storage';

// DB 行型定義
interface UserRow {
  id: string;
  email: string;
  channel_name: string;
  specialties: string[];
  ng_words: string[];
  daily_limit: number;
  preferred_tone: string;
  created_at: string;
  updated_at: string;
}

interface FavoriteRow {
  id: string;
  user_id: string;
  type: string;
  topic_id: string;
  script_id: string | null;
  title: string;
  category: string | null;
  notes: string | null;
  added_at: string;
}

interface HistoryRow {
  id: string;
  user_id: string;
  type: string;
  timestamp: string;
  filters: Record<string, unknown> | null;
  topic_id: string | null;
  script_settings: Record<string, unknown> | null;
  cost: number;
  cached: boolean;
}

interface RatingRow {
  id: string;
  user_id: string;
  script_id: string;
  topic_id: string;
  rating: number;
  comment: string | null;
  rated_at: string;
}

interface CacheRow {
  id: string;
  cache_type: string;
  cache_key: string;
  data: Record<string, unknown>;
  created_at: string;
  expires_at: string;
  access_count: number;
}

// キャッシュ TTL 設定（ミリ秒）- 環境変数でオーバーライド可能
const CACHE_TTL = {
  topic: Number(process.env.CACHE_TTL_TOPIC_MS) || 15 * 60 * 1000,     // 15分
  script: Number(process.env.CACHE_TTL_SCRIPT_MS) || 3 * 60 * 60 * 1000, // 3時間
  batch: Number(process.env.CACHE_TTL_BATCH_MS) || 45 * 60 * 1000,     // 45分
};

// ===========================================================
// Database Service - ストレージ操作
// ===========================================================

export class DatabaseService {
  private client: SupabaseClient | null;

  constructor() {
    this.client = getSupabaseServer();
  }

  get isAvailable(): boolean {
    return this.client !== null;
  }

  // -----------------------------------------------------------
  // ユーザープロファイル
  // -----------------------------------------------------------

  async getProfile(userId: string): Promise<UserProfile | null> {
    if (!this.client) return null;

    const { data, error } = await this.client
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !data) return null;
    const row = data as UserRow;

    return {
      channelName: row.channel_name,
      specialties: row.specialties,
      ngWords: row.ng_words,
      dailyLimit: row.daily_limit,
      preferredTone: row.preferred_tone,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async setProfile(userId: string, profile: UserProfile): Promise<void> {
    if (!this.client) return;

    const { error } = await this.client
      .from('users')
      .upsert({
        id: userId,
        email: '',
        channel_name: profile.channelName,
        specialties: profile.specialties,
        ng_words: profile.ngWords,
        daily_limit: profile.dailyLimit,
        preferred_tone: profile.preferredTone,
      }, { onConflict: 'id' });

    if (error) {
      console.error('プロファイル保存エラー:', error);
    }
  }

  // -----------------------------------------------------------
  // お気に入り
  // -----------------------------------------------------------

  async getFavorites(userId: string): Promise<FavoriteItem[]> {
    if (!this.client) return [];

    const { data, error } = await this.client
      .from('favorites')
      .select('*')
      .eq('user_id', userId)
      .order('added_at', { ascending: false })
      .limit(100);

    if (error || !data) return [];

    return (data as FavoriteRow[]).map(row => ({
      id: row.id,
      type: row.type as 'topic' | 'script',
      topicId: row.topic_id,
      scriptId: row.script_id ?? undefined,
      title: row.title,
      category: row.category ?? undefined,
      addedAt: row.added_at,
      notes: row.notes ?? undefined,
    }));
  }

  async addFavorite(userId: string, item: Omit<FavoriteItem, 'id' | 'addedAt'>): Promise<void> {
    if (!this.client) return;

    const { error } = await this.client
      .from('favorites')
      .insert({
        user_id: userId,
        type: item.type,
        topic_id: item.topicId,
        script_id: item.scriptId ?? null,
        title: item.title,
        category: item.category ?? null,
        notes: item.notes ?? null,
      });

    if (error) {
      console.error('お気に入り追加エラー:', error);
    }
  }

  async removeFavorite(userId: string, favoriteId: string): Promise<void> {
    if (!this.client) return;

    const { error } = await this.client
      .from('favorites')
      .delete()
      .eq('id', favoriteId)
      .eq('user_id', userId);

    if (error) {
      console.error('お気に入り削除エラー:', error);
    }
  }

  async isFavorite(userId: string, topicId: string, scriptId?: string): Promise<boolean> {
    if (!this.client) return false;

    let query = this.client
      .from('favorites')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('topic_id', topicId);

    if (scriptId) {
      query = query.eq('script_id', scriptId);
    } else {
      query = query.is('script_id', null);
    }

    const { count } = await query;
    return (count ?? 0) > 0;
  }

  // -----------------------------------------------------------
  // 生成履歴
  // -----------------------------------------------------------

  async getHistory(userId: string): Promise<GenerationHistory[]> {
    if (!this.client) return [];

    const { data, error } = await this.client
      .from('generation_history')
      .select('*')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false })
      .limit(20);

    if (error || !data) return [];

    return (data as HistoryRow[]).map(row => ({
      id: row.id,
      type: row.type as 'topic' | 'script',
      timestamp: row.timestamp,
      filters: row.filters,
      topicId: row.topic_id ?? undefined,
      scriptSettings: row.script_settings as GenerationHistory['scriptSettings'],
      cost: row.cost,
      cached: row.cached,
    }));
  }

  async addHistory(userId: string, item: Omit<GenerationHistory, 'id'>): Promise<void> {
    if (!this.client) return;

    const { error } = await this.client
      .from('generation_history')
      .insert({
        user_id: userId,
        type: item.type,
        timestamp: item.timestamp,
        filters: (item.filters as Record<string, unknown>) ?? null,
        topic_id: item.topicId ?? null,
        script_settings: (item.scriptSettings as Record<string, unknown>) ?? null,
        cost: item.cost,
        cached: item.cached,
      });

    if (error) {
      console.error('履歴追加エラー:', error);
    }
  }

  async clearHistory(userId: string): Promise<void> {
    if (!this.client) return;

    const { error } = await this.client
      .from('generation_history')
      .delete()
      .eq('user_id', userId);

    if (error) {
      console.error('履歴クリアエラー:', error);
    }
  }

  // -----------------------------------------------------------
  // 台本評価
  // -----------------------------------------------------------

  async getRatings(userId: string): Promise<ScriptRating[]> {
    if (!this.client) return [];

    const { data, error } = await this.client
      .from('script_ratings')
      .select('*')
      .eq('user_id', userId);

    if (error || !data) return [];

    return (data as RatingRow[]).map(row => ({
      scriptId: row.script_id,
      topicId: row.topic_id,
      rating: row.rating as 1 | 2 | 3 | 4 | 5,
      comment: row.comment ?? undefined,
      ratedAt: row.rated_at,
    }));
  }

  async addRating(userId: string, rating: Omit<ScriptRating, 'ratedAt'>): Promise<void> {
    if (!this.client) return;

    const { error } = await this.client
      .from('script_ratings')
      .upsert({
        user_id: userId,
        script_id: rating.scriptId,
        topic_id: rating.topicId,
        rating: rating.rating,
        comment: rating.comment ?? null,
        rated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,script_id' });

    if (error) {
      console.error('評価追加エラー:', error);
    }
  }

  async getRating(userId: string, scriptId: string): Promise<ScriptRating | null> {
    if (!this.client) return null;

    const { data, error } = await this.client
      .from('script_ratings')
      .select('*')
      .eq('user_id', userId)
      .eq('script_id', scriptId)
      .single();

    if (error || !data) return null;
    const row = data as RatingRow;

    return {
      scriptId: row.script_id,
      topicId: row.topic_id,
      rating: row.rating as 1 | 2 | 3 | 4 | 5,
      comment: row.comment ?? undefined,
      ratedAt: row.rated_at,
    };
  }
}

// ===========================================================
// Database Cache Service - キャッシュ操作
// ===========================================================

export class DatabaseCacheService {
  private client: SupabaseClient | null;
  private hits = 0;
  private misses = 0;

  constructor() {
    this.client = getSupabaseServer();
  }

  get isAvailable(): boolean {
    return this.client !== null;
  }

  // -----------------------------------------------------------
  // トピックキャッシュ
  // -----------------------------------------------------------

  async setTopics(key: string, topics: unknown): Promise<void> {
    if (!this.client) return;

    const expiresAt = new Date(Date.now() + CACHE_TTL.topic).toISOString();

    const { error } = await this.client
      .from('generated_cache')
      .upsert({
        cache_type: 'topic',
        cache_key: key,
        data: { topics },
        expires_at: expiresAt,
        access_count: 0,
      }, { onConflict: 'cache_type,cache_key' });

    if (error) {
      console.error('トピックキャッシュ保存エラー:', error);
    }
  }

  async getTopics(key: string): Promise<unknown | null> {
    if (!this.client) return null;

    const { data, error } = await this.client
      .from('generated_cache')
      .select('*')
      .eq('cache_type', 'topic')
      .eq('cache_key', key)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error || !data) {
      this.misses++;
      return null;
    }

    const row = data as CacheRow;

    // アクセスカウント更新（非同期、エラー無視）
    this.client
      .from('generated_cache')
      .update({ access_count: row.access_count + 1 })
      .eq('id', row.id)
      .then();

    this.hits++;
    return row.data.topics;
  }

  // -----------------------------------------------------------
  // 台本キャッシュ
  // -----------------------------------------------------------

  async setScript(key: string, script: unknown): Promise<void> {
    if (!this.client) return;

    const expiresAt = new Date(Date.now() + CACHE_TTL.script).toISOString();

    const { error } = await this.client
      .from('generated_cache')
      .upsert({
        cache_type: 'script',
        cache_key: key,
        data: { script },
        expires_at: expiresAt,
        access_count: 0,
      }, { onConflict: 'cache_type,cache_key' });

    if (error) {
      console.error('台本キャッシュ保存エラー:', error);
    }
  }

  async getScript(key: string): Promise<unknown | null> {
    if (!this.client) return null;

    const { data, error } = await this.client
      .from('generated_cache')
      .select('*')
      .eq('cache_type', 'script')
      .eq('cache_key', key)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error || !data) {
      this.misses++;
      return null;
    }

    const row = data as CacheRow;

    this.client
      .from('generated_cache')
      .update({ access_count: row.access_count + 1 })
      .eq('id', row.id)
      .then();

    this.hits++;
    return row.data.script;
  }

  // -----------------------------------------------------------
  // バッチキャッシュ
  // -----------------------------------------------------------

  async setBatch(key: string, topics: unknown): Promise<void> {
    if (!this.client) return;

    const expiresAt = new Date(Date.now() + CACHE_TTL.batch).toISOString();

    const { error } = await this.client
      .from('generated_cache')
      .upsert({
        cache_type: 'batch',
        cache_key: key,
        data: { batch: topics },
        expires_at: expiresAt,
        access_count: 0,
      }, { onConflict: 'cache_type,cache_key' });

    if (error) {
      console.error('バッチキャッシュ保存エラー:', error);
    }
  }

  async getBatch(key: string): Promise<unknown | null> {
    if (!this.client) return null;

    const { data, error } = await this.client
      .from('generated_cache')
      .select('*')
      .eq('cache_type', 'batch')
      .eq('cache_key', key)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error || !data) {
      this.misses++;
      return null;
    }

    const row = data as CacheRow;

    this.client
      .from('generated_cache')
      .update({ access_count: row.access_count + 1 })
      .eq('id', row.id)
      .then();

    this.hits++;
    return row.data.batch;
  }

  // -----------------------------------------------------------
  // キャッシュ管理
  // -----------------------------------------------------------

  async clear(): Promise<void> {
    if (!this.client) return;

    const { error } = await this.client
      .from('generated_cache')
      .delete()
      .gte('id', '00000000-0000-0000-0000-000000000000');

    if (error) {
      console.error('キャッシュクリアエラー:', error);
    }
  }

  async cleanup(): Promise<void> {
    if (!this.client) return;

    const { error } = await this.client
      .from('generated_cache')
      .delete()
      .lt('expires_at', new Date().toISOString());

    if (error) {
      console.error('期限切れキャッシュ削除エラー:', error);
    }
  }

  async getStats(): Promise<{
    totalEntries: number;
    topicEntries: number;
    scriptEntries: number;
    batchEntries: number;
    hitRate: number;
    totalHits: number;
    totalMisses: number;
  }> {
    if (!this.client) {
      return {
        totalEntries: 0,
        topicEntries: 0,
        scriptEntries: 0,
        batchEntries: 0,
        hitRate: 0,
        totalHits: this.hits,
        totalMisses: this.misses,
      };
    }

    const now = new Date().toISOString();

    const [totalResult, topicResult, scriptResult, batchResult] = await Promise.all([
      this.client.from('generated_cache').select('id', { count: 'exact', head: true }).gt('expires_at', now),
      this.client.from('generated_cache').select('id', { count: 'exact', head: true }).eq('cache_type', 'topic').gt('expires_at', now),
      this.client.from('generated_cache').select('id', { count: 'exact', head: true }).eq('cache_type', 'script').gt('expires_at', now),
      this.client.from('generated_cache').select('id', { count: 'exact', head: true }).eq('cache_type', 'batch').gt('expires_at', now),
    ]);

    const total = this.hits + this.misses;
    const hitRate = total > 0 ? Math.round((this.hits / total) * 100 * 100) / 100 : 0;

    return {
      totalEntries: totalResult.count ?? 0,
      topicEntries: topicResult.count ?? 0,
      scriptEntries: scriptResult.count ?? 0,
      batchEntries: batchResult.count ?? 0,
      hitRate,
      totalHits: this.hits,
      totalMisses: this.misses,
    };
  }
}

// ===========================================================
// シングルトンインスタンス
// ===========================================================

let dbServiceInstance: DatabaseService | null = null;
let dbCacheServiceInstance: DatabaseCacheService | null = null;

export function getDbService(): DatabaseService {
  if (!dbServiceInstance) {
    dbServiceInstance = new DatabaseService();
  }
  return dbServiceInstance;
}

export function getDbCacheService(): DatabaseCacheService {
  if (!dbCacheServiceInstance) {
    dbCacheServiceInstance = new DatabaseCacheService();
  }
  return dbCacheServiceInstance;
}

export { isSupabaseConfigured };
