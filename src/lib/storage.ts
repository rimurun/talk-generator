// ストレージ管理ユーティリティ
// Supabase をプライマリ、LocalStorage をオフラインフォールバックとして使用
import { Topic, Script } from '@/types';
import { getSupabaseClient, isSupabaseConfigured } from './supabase';

// プロファイル情報
export interface UserProfile {
  channelName: string;
  specialties: string[];
  ngWords: string[];
  dailyLimit: number;
  preferredTone: string;
  createdAt: string;
  updatedAt: string;
}

// お気に入りアイテム
export interface FavoriteItem {
  id: string;
  type: 'topic' | 'script';
  topicId: string;
  scriptId?: string;
  title: string;
  category?: string;
  addedAt: string;
  notes?: string;
}

// 生成履歴
export interface GenerationHistory {
  id: string;
  type: 'topic' | 'script';
  timestamp: string;
  filters?: any;
  topicId?: string;
  scriptSettings?: {
    duration: number;
    tension: string;
    tone: string;
  };
  cost: number;
  cached: boolean;
}

// 台本評価
export interface ScriptRating {
  scriptId: string;
  topicId: string;
  rating: 1 | 2 | 3 | 4 | 5;
  comment?: string;
  ratedAt: string;
}

// レート制限カウンター
export interface RateLimit {
  date: string;
  topicRequests: number;
  scriptRequests: number;
  totalCost: number;
}

// Supabase行型（型推論フォールバック用）
interface UserRow {
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
  type: string;
  topic_id: string;
  script_id: string | null;
  title: string;
  category: string | null;
  added_at: string;
  notes: string | null;
}

interface HistoryRow {
  id: string;
  type: string;
  timestamp: string;
  filters: Record<string, unknown> | null;
  topic_id: string | null;
  script_settings: Record<string, unknown> | null;
  cost: number;
  cached: boolean;
}

interface RatingRow {
  script_id: string;
  topic_id: string;
  rating: number;
  comment: string | null;
  rated_at: string;
}

class StorageService {
  private isClient = typeof window !== 'undefined';

  // ユーザーIDごとにデータをスコープするためのフィールド（デフォルトはguest）
  private userId: string = 'guest';

  /**
   * ユーザーIDを設定する
   * ログイン・ログアウト時に AuthProvider から呼び出される
   */
  setUserId(userId: string | null): void {
    this.userId = userId || 'guest';
  }

  /**
   * ユーザースコープ付きのキーを生成する
   * 例: talkgen_abc123_profile
   */
  private scopedKey(key: string): string {
    return `talkgen_${this.userId}_${key}`;
  }

  /**
   * Supabase クライアントを取得（クライアントサイドのみ）
   */
  private getSupabase() {
    if (!this.isClient) return null;
    return getSupabaseClient();
  }

  /**
   * 現在のユーザーIDを取得（Supabase認証）
   */
  private async getCurrentUserId(): Promise<string | null> {
    const sb = this.getSupabase();
    if (!sb) return null;
    const { data } = await sb.auth.getUser();
    return data.user?.id ?? null;
  }

  // ===========================================================
  // プロファイル管理
  // ===========================================================

  async getProfileAsync(): Promise<UserProfile | null> {
    // Supabase優先
    const sb = this.getSupabase();
    const userId = await this.getCurrentUserId();
    if (sb && userId) {
      const { data } = await sb
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
      if (data) {
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
    }

    // LocalStorage フォールバック
    return this.getProfile();
  }

  getProfile(): UserProfile | null {
    if (!this.isClient) return null;
    const data = localStorage.getItem(this.scopedKey('profile'));
    return data ? JSON.parse(data) : null;
  }

  async setProfileAsync(profile: UserProfile): Promise<void> {
    // LocalStorage に常に保存（オフライン対応）
    this.setProfile(profile);

    // Supabase にも保存
    const sb = this.getSupabase();
    const userId = await this.getCurrentUserId();
    if (sb && userId) {
      await sb
        .from('users')
        .upsert({
          id: userId,
          email: '', // 認証時にセットされる
          channel_name: profile.channelName,
          specialties: profile.specialties,
          ng_words: profile.ngWords,
          daily_limit: profile.dailyLimit,
          preferred_tone: profile.preferredTone,
        }, { onConflict: 'id' });
    }
  }

  setProfile(profile: UserProfile): void {
    if (!this.isClient) return;
    const updatedProfile = {
      ...profile,
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem(this.scopedKey('profile'), JSON.stringify(updatedProfile));
  }

  // ===========================================================
  // お気に入り管理
  // ===========================================================

  async getFavoritesAsync(): Promise<FavoriteItem[]> {
    const sb = this.getSupabase();
    const userId = await this.getCurrentUserId();
    if (sb && userId) {
      const { data } = await sb
        .from('favorites')
        .select('*')
        .eq('user_id', userId)
        .order('added_at', { ascending: false })
        .limit(100);
      if (data) {
        return data.map(row => ({
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
    }
    return this.getFavorites();
  }

  getFavorites(): FavoriteItem[] {
    if (!this.isClient) return [];
    const data = localStorage.getItem(this.scopedKey('favorites'));
    return data ? JSON.parse(data) : [];
  }

  async addFavoriteAsync(item: Omit<FavoriteItem, 'id' | 'addedAt'>): Promise<void> {
    // LocalStorage に常に保存
    this.addFavorite(item);

    // Supabase にも保存
    const sb = this.getSupabase();
    const userId = await this.getCurrentUserId();
    if (sb && userId) {
      await sb.from('favorites').insert({
        user_id: userId,
        type: item.type,
        topic_id: item.topicId,
        script_id: item.scriptId ?? null,
        title: item.title,
        category: item.category ?? null,
        notes: item.notes ?? null,
      });
    }
  }

  addFavorite(item: Omit<FavoriteItem, 'id' | 'addedAt'>): void {
    if (!this.isClient) return;
    const favorites = this.getFavorites();
    const newItem: FavoriteItem = {
      ...item,
      id: `fav-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      addedAt: new Date().toISOString()
    };
    favorites.unshift(newItem);
    localStorage.setItem(this.scopedKey('favorites'), JSON.stringify(favorites.slice(0, 100)));
  }

  async removeFavoriteAsync(id: string): Promise<void> {
    // LocalStorage から削除
    this.removeFavorite(id);

    // Supabase からも削除
    const sb = this.getSupabase();
    const userId = await this.getCurrentUserId();
    if (sb && userId) {
      await sb.from('favorites').delete().eq('id', id).eq('user_id', userId);
    }
  }

  removeFavorite(id: string): void {
    if (!this.isClient) return;
    const favorites = this.getFavorites().filter(item => item.id !== id);
    localStorage.setItem(this.scopedKey('favorites'), JSON.stringify(favorites));
  }

  isFavorite(topicId: string, scriptId?: string): boolean {
    if (!this.isClient) return false;
    const favorites = this.getFavorites();
    return favorites.some(item =>
      item.topicId === topicId &&
      (scriptId ? item.scriptId === scriptId : !item.scriptId)
    );
  }

  // ===========================================================
  // 生成履歴管理
  // ===========================================================

  async getHistoryAsync(): Promise<GenerationHistory[]> {
    const sb = this.getSupabase();
    const userId = await this.getCurrentUserId();
    if (sb && userId) {
      const { data } = await sb
        .from('generation_history')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false })
        .limit(20);
      if (data) {
        return data.map(row => ({
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
    }
    return this.getHistory();
  }

  getHistory(): GenerationHistory[] {
    if (!this.isClient) return [];
    const data = localStorage.getItem(this.scopedKey('history'));
    return data ? JSON.parse(data) : [];
  }

  async addHistoryAsync(item: Omit<GenerationHistory, 'id'>): Promise<void> {
    // LocalStorage に常に保存
    this.addHistory(item);

    // Supabase にも保存
    const sb = this.getSupabase();
    const userId = await this.getCurrentUserId();
    if (sb && userId) {
      await sb.from('generation_history').insert({
        user_id: userId,
        type: item.type,
        timestamp: item.timestamp,
        filters: item.filters as Record<string, unknown> ?? null,
        topic_id: item.topicId ?? null,
        script_settings: item.scriptSettings as Record<string, unknown> ?? null,
        cost: item.cost,
        cached: item.cached,
      });
    }
  }

  addHistory(item: Omit<GenerationHistory, 'id'>): void {
    if (!this.isClient) return;
    const history = this.getHistory();
    const newItem: GenerationHistory = {
      ...item,
      id: `hist-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };
    history.unshift(newItem);
    localStorage.setItem(this.scopedKey('history'), JSON.stringify(history.slice(0, 20)));
  }

  async clearHistoryAsync(): Promise<void> {
    this.clearHistory();

    const sb = this.getSupabase();
    const userId = await this.getCurrentUserId();
    if (sb && userId) {
      await sb.from('generation_history').delete().eq('user_id', userId);
    }
  }

  clearHistory(): void {
    if (!this.isClient) return;
    localStorage.removeItem(this.scopedKey('history'));
  }

  // ===========================================================
  // 台本評価管理
  // ===========================================================

  async getRatingsAsync(): Promise<ScriptRating[]> {
    const sb = this.getSupabase();
    const userId = await this.getCurrentUserId();
    if (sb && userId) {
      const { data } = await sb
        .from('script_ratings')
        .select('*')
        .eq('user_id', userId);
      if (data) {
        return data.map(row => ({
          scriptId: row.script_id,
          topicId: row.topic_id,
          rating: row.rating as 1 | 2 | 3 | 4 | 5,
          comment: row.comment ?? undefined,
          ratedAt: row.rated_at,
        }));
      }
    }
    return this.getRatings();
  }

  getRatings(): ScriptRating[] {
    if (!this.isClient) return [];
    const data = localStorage.getItem(this.scopedKey('ratings'));
    return data ? JSON.parse(data) : [];
  }

  async addRatingAsync(rating: Omit<ScriptRating, 'ratedAt'>): Promise<void> {
    // LocalStorage に常に保存
    this.addRating(rating);

    // Supabase にも保存
    const sb = this.getSupabase();
    const userId = await this.getCurrentUserId();
    if (sb && userId) {
      await sb.from('script_ratings').upsert({
        user_id: userId,
        script_id: rating.scriptId,
        topic_id: rating.topicId,
        rating: rating.rating,
        comment: rating.comment ?? null,
        rated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,script_id' });
    }
  }

  addRating(rating: Omit<ScriptRating, 'ratedAt'>): void {
    if (!this.isClient) return;
    const ratings = this.getRatings();
    const existingIndex = ratings.findIndex(r => r.scriptId === rating.scriptId);
    const newRating: ScriptRating = {
      ...rating,
      ratedAt: new Date().toISOString()
    };
    if (existingIndex >= 0) {
      ratings[existingIndex] = newRating;
    } else {
      ratings.push(newRating);
    }
    localStorage.setItem(this.scopedKey('ratings'), JSON.stringify(ratings));
  }

  getRating(scriptId: string): ScriptRating | null {
    if (!this.isClient) return null;
    const ratings = this.getRatings();
    return ratings.find(r => r.scriptId === scriptId) || null;
  }

  // ===========================================================
  // レート制限管理（JST午前0時リセット）
  // ===========================================================

  getTodayRateLimit(): RateLimit {
    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });
    if (!this.isClient) {
      return { date: today, topicRequests: 0, scriptRequests: 0, totalCost: 0 };
    }
    const data = localStorage.getItem(this.scopedKey('ratelimit'));
    const rateLimit: RateLimit = data ? JSON.parse(data) : { date: today, topicRequests: 0, scriptRequests: 0, totalCost: 0 };
    if (rateLimit.date !== today) {
      return { date: today, topicRequests: 0, scriptRequests: 0, totalCost: 0 };
    }
    return rateLimit;
  }

  updateRateLimit(type: 'topic' | 'script', cost: number): void {
    if (!this.isClient) return;
    const rateLimit = this.getTodayRateLimit();
    if (type === 'topic') {
      rateLimit.topicRequests++;
    } else {
      rateLimit.scriptRequests++;
    }
    rateLimit.totalCost += cost;
    localStorage.setItem(this.scopedKey('ratelimit'), JSON.stringify(rateLimit));
  }

  // ===========================================================
  // NGワード管理
  // ===========================================================

  getNgWords(): string[] {
    const profile = this.getProfile();
    return profile?.ngWords || [];
  }

  addNgWord(word: string): void {
    const profile = this.getProfile() || this.createDefaultProfile();
    if (!profile.ngWords.includes(word)) {
      profile.ngWords.push(word);
      this.setProfile(profile);
    }
  }

  removeNgWord(word: string): void {
    const profile = this.getProfile();
    if (profile) {
      profile.ngWords = profile.ngWords.filter(w => w !== word);
      this.setProfile(profile);
    }
  }

  detectNgWords(text: string): string[] {
    const ngWords = this.getNgWords();
    const detected: string[] = [];
    ngWords.forEach(word => {
      if (text.includes(word)) {
        detected.push(word);
      }
    });
    return detected;
  }

  // ===========================================================
  // デフォルトプロファイル作成
  // ===========================================================

  private createDefaultProfile(): UserProfile {
    const defaultProfile: UserProfile = {
      channelName: '',
      specialties: [],
      ngWords: [],
      dailyLimit: 30,
      preferredTone: 'フレンドリー',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.setProfile(defaultProfile);
    return defaultProfile;
  }

  // ===========================================================
  // 過去のトピックタイトル管理（重複防止用）
  // ===========================================================

  getPreviousTopicTitles(): string[] {
    if (!this.isClient) return [];
    const data = localStorage.getItem(this.scopedKey('prev-titles'));
    return data ? JSON.parse(data) : [];
  }

  savePreviousTopicTitles(titles: string[]): void {
    if (!this.isClient) return;
    const all = [...titles, ...this.getPreviousTopicTitles()];
    const unique = [...new Set(all)].slice(0, 50);
    localStorage.setItem(this.scopedKey('prev-titles'), JSON.stringify(unique));
  }

  // ===========================================================
  // 生成済みトピック永続化（ページ遷移・リロード対策）
  // ===========================================================

  getLastTopics(): Topic[] {
    if (!this.isClient) return [];
    const data = localStorage.getItem(this.scopedKey('last-topics'));
    if (!data) return [];
    try {
      const parsed = JSON.parse(data);
      // 24時間以上前のデータは破棄
      if (parsed.savedAt && Date.now() - new Date(parsed.savedAt).getTime() > 24 * 60 * 60 * 1000) {
        localStorage.removeItem(this.scopedKey('last-topics'));
        return [];
      }
      return parsed.topics || [];
    } catch {
      return [];
    }
  }

  setLastTopics(topics: Topic[]): void {
    if (!this.isClient) return;
    localStorage.setItem(this.scopedKey('last-topics'), JSON.stringify({
      topics,
      savedAt: new Date().toISOString()
    }));
  }

  getLastFilters(): import('@/types').FilterOptions | null {
    if (!this.isClient) return null;
    const data = localStorage.getItem(this.scopedKey('last-filters'));
    if (!data) return null;
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  setLastFilters(filters: import('@/types').FilterOptions): void {
    if (!this.isClient) return;
    localStorage.setItem(this.scopedKey('last-filters'), JSON.stringify(filters));
  }

  // ===========================================================
  // 全データクリア
  // ===========================================================

  clearAllData(): void {
    if (!this.isClient) return;
    const keys = [
      this.scopedKey('profile'),
      this.scopedKey('favorites'),
      this.scopedKey('history'),
      this.scopedKey('ratings'),
      this.scopedKey('ratelimit'),
      this.scopedKey('prev-titles'),
      this.scopedKey('daily-usage'),
      this.scopedKey('last-topics'),
      this.scopedKey('last-filters'),
    ];
    keys.forEach(key => localStorage.removeItem(key));
  }

  // ===========================================================
  // データエクスポート / インポート
  // ===========================================================

  exportData(): string {
    if (!this.isClient) return '{}';
    const data = {
      profile: this.getProfile(),
      favorites: this.getFavorites(),
      history: this.getHistory(),
      ratings: this.getRatings(),
      exportedAt: new Date().toISOString()
    };
    return JSON.stringify(data, null, 2);
  }

  importData(jsonData: string): void {
    if (!this.isClient) return;
    try {
      const data = JSON.parse(jsonData);
      if (data.profile) {
        this.setProfile(data.profile);
      }
      if (data.favorites) {
        localStorage.setItem(this.scopedKey('favorites'), JSON.stringify(data.favorites));
      }
      if (data.history) {
        localStorage.setItem(this.scopedKey('history'), JSON.stringify(data.history));
      }
      if (data.ratings) {
        localStorage.setItem(this.scopedKey('ratings'), JSON.stringify(data.ratings));
      }
    } catch (error) {
      console.error('Data import failed:', error);
      throw new Error('インポートデータの形式が正しくありません');
    }
  }
}

export const storage = new StorageService();

/**
 * ユーザーIDをストレージに設定するユーティリティ関数
 * AuthProvider から呼び出されることを想定
 */
export function setStorageUser(userId: string | null): void {
  storage.setUserId(userId);
}
