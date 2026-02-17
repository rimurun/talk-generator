// ローカルストレージ管理ユーティリティ
import { Topic, Script } from '@/types';

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

class LocalStorage {
  private isClient = typeof window !== 'undefined';

  // プロファイル管理
  getProfile(): UserProfile | null {
    if (!this.isClient) return null;
    
    const data = localStorage.getItem('talk-generator-profile');
    return data ? JSON.parse(data) : null;
  }

  setProfile(profile: UserProfile): void {
    if (!this.isClient) return;
    
    const updatedProfile = {
      ...profile,
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem('talk-generator-profile', JSON.stringify(updatedProfile));
  }

  // お気に入り管理
  getFavorites(): FavoriteItem[] {
    if (!this.isClient) return [];
    
    const data = localStorage.getItem('talk-generator-favorites');
    return data ? JSON.parse(data) : [];
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
    localStorage.setItem('talk-generator-favorites', JSON.stringify(favorites.slice(0, 100))); // 最大100件
  }

  removeFavorite(id: string): void {
    if (!this.isClient) return;
    
    const favorites = this.getFavorites().filter(item => item.id !== id);
    localStorage.setItem('talk-generator-favorites', JSON.stringify(favorites));
  }

  isFavorite(topicId: string, scriptId?: string): boolean {
    if (!this.isClient) return false;
    
    const favorites = this.getFavorites();
    return favorites.some(item => 
      item.topicId === topicId && 
      (scriptId ? item.scriptId === scriptId : !item.scriptId)
    );
  }

  // 生成履歴管理
  getHistory(): GenerationHistory[] {
    if (!this.isClient) return [];
    
    const data = localStorage.getItem('talk-generator-history');
    return data ? JSON.parse(data) : [];
  }

  addHistory(item: Omit<GenerationHistory, 'id'>): void {
    if (!this.isClient) return;
    
    const history = this.getHistory();
    const newItem: GenerationHistory = {
      ...item,
      id: `hist-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };
    
    history.unshift(newItem);
    localStorage.setItem('talk-generator-history', JSON.stringify(history.slice(0, 20))); // 最大20件
  }

  clearHistory(): void {
    if (!this.isClient) return;
    localStorage.removeItem('talk-generator-history');
  }

  // 台本評価管理
  getRatings(): ScriptRating[] {
    if (!this.isClient) return [];
    
    const data = localStorage.getItem('talk-generator-ratings');
    return data ? JSON.parse(data) : [];
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
    
    localStorage.setItem('talk-generator-ratings', JSON.stringify(ratings));
  }

  getRating(scriptId: string): ScriptRating | null {
    if (!this.isClient) return null;
    
    const ratings = this.getRatings();
    return ratings.find(r => r.scriptId === scriptId) || null;
  }

  // レート制限管理
  getTodayRateLimit(): RateLimit {
    if (!this.isClient) {
      const today = new Date().toISOString().split('T')[0];
      return { date: today, topicRequests: 0, scriptRequests: 0, totalCost: 0 };
    }
    
    const today = new Date().toISOString().split('T')[0];
    const data = localStorage.getItem('talk-generator-ratelimit');
    const rateLimit: RateLimit = data ? JSON.parse(data) : { date: today, topicRequests: 0, scriptRequests: 0, totalCost: 0 };
    
    // 日付が変わっていたらリセット
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
    localStorage.setItem('talk-generator-ratelimit', JSON.stringify(rateLimit));
  }

  // NGワード管理
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

  // NGワード検出
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

  // デフォルトプロファイル作成
  private createDefaultProfile(): UserProfile {
    const defaultProfile: UserProfile = {
      channelName: '',
      specialties: [],
      ngWords: [],
      dailyLimit: 50,
      preferredTone: 'フレンドリー',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    this.setProfile(defaultProfile);
    return defaultProfile;
  }

  // 全データクリア
  clearAllData(): void {
    if (!this.isClient) return;
    
    const keys = [
      'talk-generator-profile',
      'talk-generator-favorites',
      'talk-generator-history',
      'talk-generator-ratings',
      'talk-generator-ratelimit'
    ];
    
    keys.forEach(key => localStorage.removeItem(key));
  }

  // データエクスポート
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

  // データインポート
  importData(jsonData: string): void {
    if (!this.isClient) return;
    
    try {
      const data = JSON.parse(jsonData);
      
      if (data.profile) {
        this.setProfile(data.profile);
      }
      
      if (data.favorites) {
        localStorage.setItem('talk-generator-favorites', JSON.stringify(data.favorites));
      }
      
      if (data.history) {
        localStorage.setItem('talk-generator-history', JSON.stringify(data.history));
      }
      
      if (data.ratings) {
        localStorage.setItem('talk-generator-ratings', JSON.stringify(data.ratings));
      }
      
    } catch (error) {
      console.error('Data import failed:', error);
      throw new Error('インポートデータの形式が正しくありません');
    }
  }
}

export const storage = new LocalStorage();