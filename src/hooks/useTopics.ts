import { useState, useCallback, useRef } from 'react';
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
  const [topics, setTopics] = useState<Topic[]>(() => {
    // ページ遷移・リロード時に前回の生成結果を復元
    return storage.getLastTopics();
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [lastRequestTime, setLastRequestTime] = useState(0);
  const [progressStep, setProgressStep] = useState<string | null>(null);
  const [lastFilters, setLastFilters] = useState<FilterOptions | null>(null);

  // stale closure回避用のref
  const loadingRef = useRef(false);
  const lastRequestTimeRef = useRef(0);

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

  // レート制限チェック（1日100回、JST 0時リセット）
  const checkRateLimit = (): boolean => {
    const rateLimit = storage.getTodayRateLimit();
    const dailyLimit = 100;

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

  // ストリーミングモードでトピックを1件ずつ受信・表示
  const generateTopicsStreaming = async (filters: FilterOptions) => {
    const previousTitles = storage.getPreviousTopicTitles();

    const response = await fetch('/api/topics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filters, previousTitles, stream: true }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'トピック生成に失敗しました' }));
      throw new Error(errorData.error || 'トピック生成に失敗しました');
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('ストリームの読み込みに失敗しました');

    const decoder = new TextDecoder();
    let buffer = '';
    const receivedTopics: Topic[] = [];

    setTopics([]); // ストリーミング前に一旦クリアして1件ずつ追加

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          if (payload === '[DONE]') break;

          try {
            const topic: Topic = JSON.parse(payload);
            // エラーペイロードではなく正常なトピックであることを確認
            if (topic.id && topic.title) {
              receivedTopics.push(topic);
              // Reactステートを更新してUIにトピックを追加
              setTopics(prev => [...prev, topic]);
              setProgressStep(`${receivedTopics.length}件取得中...`);
            }
          } catch {
            // JSONパース失敗は無視
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    // ストリーミング完了後にストレージへ保存
    if (receivedTopics.length > 0) {
      storage.setLastTopics(receivedTopics);
      storage.setLastFilters(filters);
      const newTitles = receivedTopics.map((t: Topic) => t.title);
      storage.savePreviousTopicTitles(newTitles);
      // レート制限カウンター更新（ストリーミングはコスト0でカウント）
      storage.updateRateLimit('topic', 0);
      storage.addHistory({
        type: 'topic',
        timestamp: new Date().toISOString(),
        filters,
        cost: 0,
        cached: false
      });
    }

    return receivedTopics;
  };

  // トピック生成（ストリーミングをデフォルトとして使用）
  const generateTopics = useCallback(async (filters: FilterOptions) => {
    // useRef経由で最新のloading/cooldown状態を確認
    if (loadingRef.current || Date.now() - lastRequestTimeRef.current < COOLDOWN_TIME) return;

    if (!checkRateLimit()) return;

    try {
      setLoading(true);
      loadingRef.current = true;
      setError(null);
      setLastFilters(filters);
      setLastRequestTime(Date.now());
      lastRequestTimeRef.current = Date.now();

      setProgressStep('ニュース検索中...');

      // ストリーミングで生成（1件ずつ表示）
      const streamResult = await generateTopicsStreaming(filters);

      // ストリーミング結果が空の場合はフォールバック
      if (streamResult.length === 0) {
        throw new Error('ストリーミング結果が0件');
      }

      setProgressStep('完了');
      updateUsage();

    } catch (error) {
      console.error('トピック生成エラー:', error);
      // ストリーミング失敗時は非ストリーミングにフォールバック
      try {
        setProgressStep('再試行中...');
        const previousTitles = storage.getPreviousTopicTitles();
        const response = await fetch('/api/topics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filters, previousTitles }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          let errorMessage = errorData.error || 'トピック生成に失敗しました';
          if (response.status === 429) {
            errorMessage = 'API制限に達しました。少し時間をおいてから再試行してください';
          } else if (response.status >= 500) {
            errorMessage = 'サーバーエラーが発生しました。しばらく後に再試行してください';
          }
          throw new Error(errorMessage);
        }

        const data = await response.json();

        if (!data.topics || data.topics.length === 0) {
          throw new Error('トピックが生成されませんでした。条件を変えて再試行してください');
        }

        setTopics(data.topics);
        storage.setLastTopics(data.topics);
        storage.setLastFilters(filters);
        if (data.topics.length > 0) {
          storage.savePreviousTopicTitles(data.topics.map((t: Topic) => t.title));
        }
        if (!data.cached) {
          storage.updateRateLimit('topic', data.cost || 0);
        }
        storage.addHistory({
          type: 'topic',
          timestamp: new Date().toISOString(),
          filters,
          cost: data.cost || 0,
          cached: data.cached || false
        });
        updateUsage();
      } catch (fallbackError) {
        setError(fallbackError instanceof Error ? fallbackError.message : 'トピック生成中にエラーが発生しました');
      }
    } finally {
      setLoading(false);
      loadingRef.current = false;
      setProgressStep(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // バッチ生成
  const batchGenerate = useCallback(async (
    categories: string[],
    count: number,
    diversityMode: boolean,
    filters: Omit<FilterOptions, 'categories'>
  ) => {
    if (loadingRef.current || Date.now() - lastRequestTimeRef.current < COOLDOWN_TIME) return;

    if (!checkRateLimit()) return;

    const fullFilters = { ...filters, categories };

    try {
      setLoading(true);
      loadingRef.current = true;
      setError(null);
      setLastFilters(fullFilters);
      setLastRequestTime(Date.now());
      lastRequestTimeRef.current = Date.now();

      // 進捗表示
      setProgressStep('ニュース一括検索中...');

      const progressTimer = setTimeout(() => setProgressStep(`${count}件のトピック分析中...`), 3000);
      const progressTimer2 = setTimeout(() => setProgressStep('AI一括処理中...'), 8000);

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
      setProgressStep('AI一括処理中...');

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
      setProgressStep('バッチ生成完了');

      setTopics(data.topics);
      storage.setLastTopics(data.topics);
      storage.setLastFilters(fullFilters);

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
      loadingRef.current = false;
      setProgressStep(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          timePeriod: lastFilters.timePeriod,
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