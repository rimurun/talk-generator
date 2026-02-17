import { useState, useCallback } from 'react';
import { Topic, FilterOptions, UsageStats } from '@/types';
import { storage } from '@/lib/storage';

interface UseTopicsReturn {
  topics: Topic[];
  loading: boolean;
  error: string | null;
  usage: UsageStats | null;
  generateTopics: (filters: FilterOptions) => Promise<void>;
  batchGenerate: (categories: string[], count: number, diversityMode: boolean, filters: Omit<FilterOptions, 'categories'>) => Promise<void>;
  clearError: () => void;
  isOnCooldown: boolean;
  retryGeneration: () => Promise<void>;
  progressStep: string | null;
  lastFilters: FilterOptions | null;
}

export function useTopics(): UseTopicsReturn {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [lastRequestTime, setLastRequestTime] = useState(0);
  const [progressStep, setProgressStep] = useState<string | null>(null);
  const [lastFilters, setLastFilters] = useState<FilterOptions | null>(null);

  const COOLDOWN_TIME = 2000; // 2秒のクールダウン

  const isOnCooldown = Date.now() - lastRequestTime < COOLDOWN_TIME;

  // 使用量を更新
  const updateUsage = async () => {
    try {
      const response = await fetch('/api/usage');
      if (response.ok) {
        const usageData = await response.json();
        setUsage(usageData);
      }
    } catch (error) {
      console.error('使用量取得エラー:', error);
    }
  };

  // レート制限チェック
  const checkRateLimit = (): boolean => {
    const rateLimit = storage.getTodayRateLimit();
    const profile = storage.getProfile();
    const dailyLimit = profile?.dailyLimit || 50;
    
    const totalRequests = rateLimit.topicRequests + rateLimit.scriptRequests;
    
    if (totalRequests >= dailyLimit) {
      setError(`本日の生成上限（${dailyLimit}回）に達しました。明日お試しください。`);
      return false;
    }
    
    return true;
  };

  // トピック生成
  const generateTopics = useCallback(async (filters: FilterOptions) => {
    if (loading || isOnCooldown) return;
    
    if (!checkRateLimit()) return;

    try {
      setLoading(true);
      setError(null);
      setLastFilters(filters);
      setLastRequestTime(Date.now());

      // 進捗表示
      setProgressStep('🔍 ニュース検索中...');
      
      await new Promise(resolve => setTimeout(resolve, 1000)); // UX改善のための短い待機
      setProgressStep('📝 トピック整理中...');

      const response = await fetch('/api/topics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ filters }),
      });

      setProgressStep('🤖 AI分析中...');

      if (!response.ok) {
        const errorData = await response.json();
        let errorMessage = errorData.error || 'トピック生成に失敗しました';
        
        // エラーメッセージを分かりやすく変換
        if (response.status === 429) {
          errorMessage = 'API制限に達しました。少し時間をおいてから再試行してください';
        } else if (response.status >= 500) {
          errorMessage = 'ネットワークエラー：サーバーに問題が発生している可能性があります';
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      setProgressStep('✅ 完了！');
      
      await new Promise(resolve => setTimeout(resolve, 500)); // 完了メッセージ表示
      
      setTopics(data.topics);

      // レート制限カウンター更新
      if (!data.cached) {
        storage.updateRateLimit('topic', data.cost || 0);
      }

      // 履歴に追加
      storage.addHistory({
        type: 'topic',
        timestamp: new Date().toISOString(),
        filters,
        cost: data.cost || 0,
        cached: data.cached || false
      });

      // 使用量更新
      updateUsage();

    } catch (error) {
      console.error('トピック生成エラー:', error);
      setError(error instanceof Error ? error.message : 'トピック生成中にエラーが発生しました');
    } finally {
      setLoading(false);
      setProgressStep(null);
    }
  }, [loading, isOnCooldown]);

  // バッチ生成
  const batchGenerate = useCallback(async (
    categories: string[], 
    count: number, 
    diversityMode: boolean, 
    filters: Omit<FilterOptions, 'categories'>
  ) => {
    if (loading || isOnCooldown) return;
    
    if (!checkRateLimit()) return;

    const fullFilters = { ...filters, categories };

    try {
      setLoading(true);
      setError(null);
      setLastFilters(fullFilters);
      setLastRequestTime(Date.now());

      // 進捗表示
      setProgressStep('🔍 ニュース一括検索中...');
      
      await new Promise(resolve => setTimeout(resolve, 1500));
      setProgressStep(`📝 ${count}件のトピック分析中...`);

      const response = await fetch('/api/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          categories,
          count,
          diversityMode,
          filters
        }),
      });

      setProgressStep('🤖 AI一括処理中...');

      if (!response.ok) {
        const errorData = await response.json();
        let errorMessage = errorData.error || 'バッチ生成に失敗しました';
        
        // エラーメッセージを分かりやすく変換
        if (response.status === 429) {
          errorMessage = 'API制限に達しました。少し時間をおいてから再試行してください';
        } else if (response.status >= 500) {
          errorMessage = 'ネットワークエラー：サーバーに問題が発生している可能性があります';
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      setProgressStep('✅ バッチ生成完了！');
      
      await new Promise(resolve => setTimeout(resolve, 800));
      
      setTopics(data.topics);

      // レート制限カウンター更新（バッチ生成は通常のAPIコールより多くカウント）
      storage.updateRateLimit('topic', data.totalCost || 0);

      // 履歴に追加
      storage.addHistory({
        type: 'topic',
        timestamp: new Date().toISOString(),
        filters: fullFilters,
        cost: data.totalCost || 0,
        cached: false
      });

      // 使用量更新
      updateUsage();

    } catch (error) {
      console.error('バッチ生成エラー:', error);
      setError(error instanceof Error ? error.message : 'バッチ生成中にエラーが発生しました');
    } finally {
      setLoading(false);
      setProgressStep(null);
    }
  }, [loading, isOnCooldown]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // 再試行機能
  const retryGeneration = useCallback(async () => {
    if (!lastFilters) return;
    
    if (lastFilters.categories && lastFilters.categories.length > 0) {
      // バッチモードかどうかを判定（複数カテゴリがある場合）
      if (lastFilters.categories.length > 3) {
        await batchGenerate(lastFilters.categories, 15, true, {
          includeIncidents: lastFilters.includeIncidents,
          duration: lastFilters.duration,
          tension: lastFilters.tension,
          tone: lastFilters.tone
        });
      } else {
        await generateTopics(lastFilters);
      }
    } else {
      await generateTopics(lastFilters);
    }
  }, [lastFilters, generateTopics, batchGenerate]);

  return {
    topics,
    loading,
    error,
    usage,
    generateTopics,
    batchGenerate,
    clearError,
    isOnCooldown,
    retryGeneration,
    progressStep,
    lastFilters
  };
}