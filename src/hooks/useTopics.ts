import { useState, useCallback } from 'react';
import { Topic, FilterOptions, UsageStats } from '@/types';
import { storage } from '@/lib/storage';
import { getRateLimit as getDailyLimit } from '@/lib/rate-limit';

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

  // レート制限チェック（1日30回、JST 0時リセット）
  const checkRateLimit = (): boolean => {
    const rateLimit = storage.getTodayRateLimit();
    const dailyLimit = 30;
    
    const totalRequests = rateLimit.topicRequests + rateLimit.scriptRequests;
    
    if (totalRequests >= dailyLimit) {
      // 次のリセットまでの時間を計算
      const now = new Date();
      const jstNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
      const tomorrow = new Date(jstNow);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      const ms = tomorrow.getTime() - jstNow.getTime();
      const h = Math.floor(ms / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      const timeStr = h > 0 ? `${h}時間${m}分` : `${m}分`;
      
      setError(`本日の生成上限（${dailyLimit}回）に達しました。リセットまで${timeStr}です（毎日0:00にリセット）`);
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

      // 進捗表示（実際のAPI待機に合わせた段階表示）
      setProgressStep('🔍 ニュース検索中...');

      // 前回のタイトルを取得（重複防止）
      const previousTitles = storage.getPreviousTopicTitles();

      // API呼び出しと進捗を並行実行
      const progressTimer = setTimeout(() => setProgressStep('📝 トピック整理中...'), 3000);
      const progressTimer2 = setTimeout(() => setProgressStep('🤖 AI分析中...'), 8000);

      const response = await fetch('/api/topics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ filters, previousTitles }),
      });

      clearTimeout(progressTimer);
      clearTimeout(progressTimer2);
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
      
      setTopics(data.topics);

      // 生成したタイトルを保存（次回重複防止）
      if (data.topics && data.topics.length > 0) {
        const newTitles = data.topics.map((t: Topic) => t.title);
        storage.savePreviousTopicTitles(newTitles);
      }

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

      // 進捗表示（実際のAPI待機に合わせた段階表示）
      setProgressStep('🔍 ニュース一括検索中...');

      const progressTimer = setTimeout(() => setProgressStep(`📝 ${count}件のトピック分析中...`), 3000);
      const progressTimer2 = setTimeout(() => setProgressStep('🤖 AI一括処理中...'), 8000);

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

      clearTimeout(progressTimer);
      clearTimeout(progressTimer2);
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