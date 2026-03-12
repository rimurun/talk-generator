'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FilterOptions, CategoryDetailFilter } from '@/types';
import { categoryOptions, durationOptions, tensionOptions, tonePresets } from '@/lib/mock-data';
import { useTopics } from '@/hooks/useTopics';
import { storage } from '@/lib/storage';
import LoadingSpinner from '@/components/LoadingSpinner';
import { TopicListSkeleton } from '@/components/TopicCardSkeleton';
import CategoryDetailModal from '@/components/CategoryDetailModal';
import { Zap, Star, DollarSign, Clock, AlertTriangle, Settings, Sparkles, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';

// ゲスト利用回数管理のlocalStorageキー
const GUEST_USAGE_KEY = 'talkgen_guest_usage_count';
// ゲスト最大試用回数
const GUEST_MAX_USAGE = 3;

// 動的インポート（First Load JS削減）
const TopicList = dynamic(() => import('@/components/TopicList'), {
  loading: () => {
    const { TopicListSkeleton } = require('@/components/TopicCardSkeleton');
    return <TopicListSkeleton />;
  }
});

export default function Home() {
  // 認証状態の確認（リダイレクトはしない）
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  // ゲスト利用回数の状態
  const [guestUsageCount, setGuestUsageCount] = useState<number>(0);
  // ゲスト上限到達モーダルの表示フラグ
  const [showGuestLimitModal, setShowGuestLimitModal] = useState(false);
  // フィルターセクションの折りたたみ状態（モバイルではデフォルト折りたたみ）
  const [isFilterOpen, setIsFilterOpen] = useState<boolean>(true);

  // ゲスト利用回数をlocalStorageから読み込む
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const count = parseInt(localStorage.getItem(GUEST_USAGE_KEY) || '0', 10);
      setGuestUsageCount(count);

      // モバイル（768px未満）ではデフォルトで折りたたむ
      if (window.innerWidth < 768) {
        setIsFilterOpen(false);
      }
    }
  }, []);

  // カスタムhookで状態管理を簡素化
  const {
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
  } = useTopics();

  const [filters, setFilters] = useState<FilterOptions>({
    categories: [],
    includeIncidents: false,
    duration: 60,
    tension: 'medium',
    tone: 'フレンドリー'
  });

  const [batchMode, setBatchMode] = useState(false);
  const [batchCount, setBatchCount] = useState(15);
  const [batchDiversityMode, setBatchDiversityMode] = useState(true);
  const [profile, setProfile] = useState<import('@/lib/storage').UserProfile | null>(null);
  const [detailMode, setDetailMode] = useState(false); // 台本詳細表示中はフィルター非表示
  // カテゴリ詳細モーダル用：現在開いているカテゴリ名
  const [detailCategory, setDetailCategory] = useState<string | null>(null);

  // プロファイル・前回フィルター読み込み
  useEffect(() => {
    const savedProfile = storage.getProfile();
    if (savedProfile) {
      setProfile(savedProfile);
      setFilters(prev => ({
        ...prev,
        tone: savedProfile.preferredTone
      }));
    }

    // 前回のフィルター設定を復元
    const savedFilters = storage.getLastFilters();
    if (savedFilters) {
      setFilters(savedFilters);
    }
  }, []);

  const handleCategoryChange = (category: string) => {
    setFilters(prev => ({
      ...prev,
      categories: prev.categories.includes(category)
        ? prev.categories.filter(c => c !== category)
        : [...prev.categories, category]
    }));
  };

  // カテゴリ詳細フィルター適用ハンドラー
  const handleCategoryDetailApply = (category: string, detail: CategoryDetailFilter) => {
    setFilters(prev => ({
      ...prev,
      // 未選択なら選択済みに追加
      categories: prev.categories.includes(category)
        ? prev.categories
        : [...prev.categories, category],
      categoryDetails: {
        ...prev.categoryDetails,
        [category]: detail,
      },
    }));
    setDetailCategory(null);
  };

  const handleSelectAllCategories = () => {
    setFilters(prev => ({
      ...prev,
      categories: categoryOptions.map(cat => cat.value)
    }));
  };

  const handleDeselectAllCategories = () => {
    setFilters(prev => ({
      ...prev,
      categories: []
    }));
  };

  const handleGenerate = () => {
    // 未ログインの場合はゲスト利用回数をチェック
    if (!user) {
      if (guestUsageCount >= GUEST_MAX_USAGE) {
        setShowGuestLimitModal(true);
        return;
      }
      // ゲスト利用回数をインクリメント
      const newCount = guestUsageCount + 1;
      setGuestUsageCount(newCount);
      if (typeof window !== 'undefined') {
        localStorage.setItem(GUEST_USAGE_KEY, String(newCount));
      }
    }

    if (batchMode) {
      // バッチ生成
      const categoriesToUse = filters.categories.length > 0
        ? filters.categories
        : categoryOptions.map(cat => cat.value);

      batchGenerate(categoriesToUse, batchCount, batchDiversityMode, {
        includeIncidents: filters.includeIncidents,
        duration: filters.duration,
        tension: filters.tension,
        tone: filters.tone
      });
    } else {
      // 通常生成
      generateTopics(filters);
    }
  };

  // レート制限アラート（1日100回制限）
  const rateLimit = storage.getTodayRateLimit();
  const dailyLimit = 100;
  const totalRequests = rateLimit.topicRequests + rateLimit.scriptRequests;
  const remainingRequests = Math.max(0, dailyLimit - totalRequests);
  const isNearLimit = remainingRequests <= 10;

  // ゲストの残り試用回数
  const guestRemaining = Math.max(0, GUEST_MAX_USAGE - guestUsageCount);

  return (
    <div className="container mx-auto px-4 py-4 md:py-8 max-w-6xl">

      {/* ゲストモードバナー（未ログイン時のみ表示） */}
      {!authLoading && !user && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 flex items-center justify-between flex-wrap gap-2">
          <span className="text-sm text-blue-200">
            ゲストモード: 残り<span className="font-bold text-white mx-1">{guestRemaining}回</span>|
            ログインすると無制限に利用できます
          </span>
          <Link
            href="/login"
            className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg transition-colors font-medium"
          >
            ログイン
          </Link>
        </div>
      )}

      {/* 使用量・アラート表示 */}
      <div className="mb-6 space-y-3">
        {/* API使用量（ログイン時のみ） */}
        {user && usage && (
          <div className="bg-gray-800/30 backdrop-blur-sm rounded-lg px-4 py-2 border border-gray-700">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-4">
                <span className="text-gray-300">
                  今日の残り: <span className="font-semibold text-white">{remainingRequests}回</span>
                </span>
                <span className="text-gray-300">
                  コスト: <span className="font-semibold text-green-400">${usage.estimatedCostToday.toFixed(3)}</span>
                </span>
                <span className="text-gray-300">
                  キャッシュ: <span className="font-semibold text-blue-400">{(usage.cache.hitRate * 100).toFixed(0)}%</span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                {usage.alerts.message && (
                  <div className="flex items-center gap-1 text-yellow-400">
                    <AlertTriangle size={16} />
                    <span className="text-xs">{usage.alerts.message.slice(0, 30)}...</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* レート制限アラート */}
        {user && isNearLimit && (
          <div className="bg-yellow-500/20 border border-yellow-500 text-yellow-200 px-4 py-3 rounded-lg">
            <div className="flex items-center gap-2">
              <AlertTriangle size={20} />
              <span>
                本日の残り生成回数: {remainingRequests}回
                {remainingRequests === 0 && ' - 上限に達しました'}
              </span>
            </div>
          </div>
        )}
      </div>

      <header className="text-center mb-12">
        <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-4">
          トーク生成ツール
        </h1>
        <p className="text-xl text-gray-300 max-w-3xl mx-auto">
          配信者がボタン1つで最新ニュース・エンタメ・SNSトレンド・TikTok話題を取得し、
          配信でそのまま読めるトーク台本に自動変換
        </p>
        {profile?.channelName && (
          <p className="text-sm text-gray-400 mt-2">
            チャンネル: {profile.channelName}
          </p>
        )}
      </header>

      <div className={`bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 md:p-8 mb-8 border border-gray-700 transition-all duration-300 ${detailMode ? 'hidden' : ''}`}>
        <div className="flex items-center justify-between mb-4 md:mb-6">
          {/* モバイル：フィルター折りたたみトグル */}
          <button
            className="flex items-center gap-2 text-2xl font-semibold md:cursor-default focus:outline-none"
            onClick={() => setIsFilterOpen(prev => !prev)}
            aria-expanded={isFilterOpen}
            aria-label="フィルター設定を開閉する"
          >
            フィルター設定
            <span className="md:hidden text-gray-400">
              {isFilterOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </span>
          </button>

          {/* バッチモード切り替え */}
          <div className="flex items-center gap-4">
            <div className="relative group">
              <button
                onClick={() => setBatchMode(!batchMode)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                  batchMode
                    ? 'bg-purple-600 border-purple-500 text-white'
                    : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                }`}
              >
                <Sparkles size={18} />
                {batchMode ? 'バッチモード' : '通常モード'}
              </button>

              {/* ツールチップ */}
              <div className="invisible group-hover:visible absolute right-0 top-full mt-2 w-64 bg-gray-800 border border-gray-700 rounded-lg p-3 text-sm text-gray-300 z-10">
                <h4 className="font-semibold text-purple-400 mb-2">バッチモード</h4>
                <p className="text-xs leading-relaxed">
                  1日分のネタを一括準備！複数カテゴリから重複なしで最大20件を自動生成。
                  配信前の仕込み時間を大幅短縮できます。
                </p>
                {!batchMode && (
                  <div className="mt-2 text-xs text-yellow-400">
                    クリックして有効にする →
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* フィルターコンテンツ（モバイルでは折りたたみ可能） */}
        <div className={`${isFilterOpen ? 'block' : 'hidden'} md:block`}>
          {/* キーワード検索 */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-200 mb-2">
              キーワードで絞り込み
            </label>
            <input
              type="text"
              value={filters.keyword || ''}
              onChange={(e) => setFilters(prev => ({ ...prev, keyword: e.target.value }))}
              placeholder="例: AI、円安、大谷翔平、地震..."
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-400 mt-1">
              空欄なら自動で最新の話題を取得します
            </p>
          </div>

          {/* カテゴリ選択 */}
          <div className="mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3">
              <label className="block text-sm font-medium text-gray-200 mb-2 sm:mb-0">カテゴリ</label>
              <div className="flex gap-2">
                <button
                  onClick={handleSelectAllCategories}
                  className="text-xs bg-gray-600 hover:bg-gray-500 text-gray-200 px-3 py-1 rounded transition-colors"
                >
                  全選択
                </button>
                <button
                  onClick={handleDeselectAllCategories}
                  className="text-xs bg-gray-600 hover:bg-gray-500 text-gray-200 px-3 py-1 rounded transition-colors"
                >
                  全解除
                </button>
              </div>
            </div>
            {filters.categories.length === 0 && !batchMode && (
              <p className="text-sm text-gray-400 mb-3">
                全カテゴリ表示中 - 上のボタンでカテゴリを選択してフィルタリングできます
              </p>
            )}
            {batchMode && (
              <p className="text-sm text-blue-400 mb-3">
                バッチモード: 選択したカテゴリから重複なしで{batchCount}件生成します
              </p>
            )}
            {/* モバイルでは3列、md以上で3列、lgで6列 */}
            <div className="grid grid-cols-3 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {categoryOptions.map((category) => {
                // 詳細フィルターが設定済みかどうか
                const hasDetail = !!(filters.categoryDetails?.[category.value]);
                const isSelected = filters.categories.includes(category.value);

                return (
                  <button
                    key={category.value}
                    // クリックでカテゴリ詳細モーダルを開く
                    onClick={() => setDetailCategory(category.value)}
                    className={`relative py-3 px-4 min-h-[48px] rounded-lg border transition-all duration-200 touch-manipulation text-sm md:text-base font-medium ${
                      isSelected
                        ? 'bg-purple-600 border-purple-500 text-white'
                        : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600 active:bg-gray-500'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      {category.value === '事件事故' && <span className="text-xs">⚠️</span>}
                      {category.label}
                    </span>
                    {/* 詳細フィルター適用済みインジケーター */}
                    {hasDetail && (
                      <span className="absolute top-1 right-1 flex items-center justify-center">
                        <CheckCircle2 size={12} className="text-green-400" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {/* 詳細フィルター説明 */}
            <p className="text-xs text-gray-500 mt-2">
              カテゴリボタンをクリックすると期間・地域・サブカテゴリを詳細設定できます
            </p>
          </div>

          {/* バッチモード設定 */}
          {batchMode && (
            <div className="mb-6 bg-purple-900/20 border border-purple-700 rounded-lg p-4">
              <h3 className="text-lg font-medium text-purple-200 mb-3">バッチ生成設定</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-2">
                    生成件数: {batchCount}件
                  </label>
                  <input
                    type="range"
                    min="10"
                    max="20"
                    value={batchCount}
                    onChange={(e) => setBatchCount(parseInt(e.target.value))}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>10件</span>
                    <span>20件</span>
                  </div>
                </div>

                <div className="flex items-center">
                  <label className="flex items-center space-x-3 text-sm font-medium text-gray-200">
                    <input
                      type="checkbox"
                      checked={batchDiversityMode}
                      onChange={(e) => setBatchDiversityMode(e.target.checked)}
                      className="w-4 h-4 text-purple-600 bg-gray-700 border-gray-600 rounded focus:ring-purple-500 focus:ring-2"
                    />
                    <span>多様性モード（重複除去）</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* 事件事故トグル */}
          <div className="mb-6">
            <label className="flex items-center space-x-3 text-sm font-medium text-gray-200">
              <input
                type="checkbox"
                checked={filters.includeIncidents}
                onChange={(e) => setFilters(prev => ({ ...prev, includeIncidents: e.target.checked }))}
                className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
              />
              <span>事件事故を含める</span>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* 尺選択 */}
            <div>
              <label className="block text-sm font-medium mb-3 text-gray-200">尺</label>
              <select
                value={filters.duration}
                onChange={(e) => setFilters(prev => ({ ...prev, duration: Number(e.target.value) as 15 | 60 | 180 }))}
                className="w-full py-2 px-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {durationOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* テンション選択 */}
            <div>
              <label className="block text-sm font-medium mb-3 text-gray-200">テンション</label>
              <select
                value={filters.tension}
                onChange={(e) => setFilters(prev => ({ ...prev, tension: e.target.value as 'low' | 'medium' | 'high' }))}
                className="w-full py-2 px-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {tensionOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 口調選択 */}
            <div>
              <label className="block text-sm font-medium mb-3 text-gray-200">口調プリセット</label>
              <select
                value={filters.tone}
                onChange={(e) => setFilters(prev => ({ ...prev, tone: e.target.value }))}
                className="w-full py-2 px-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {tonePresets.map((preset) => (
                  <option key={preset} value={preset}>
                    {preset}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* 生成ボタン（折りたたみに関わらず常に表示） */}
        <div className="text-center">
          <button
            onClick={handleGenerate}
            disabled={loading || isOnCooldown || (!!user && remainingRequests === 0)}
            aria-label="トーク台本を生成"
            className={`font-semibold py-4 px-8 rounded-lg text-lg transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-blue-500/50 shadow-lg min-h-[56px] ${
              batchMode
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed text-white'
                : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white'
            }`}
          >
            {loading ? (
              <div className="flex flex-col items-center gap-2">
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>生成中...</span>
                </div>
                {progressStep && (
                  <div className="text-sm font-normal">
                    {progressStep}
                  </div>
                )}
              </div>
            ) : batchMode ? (
              <div className="flex items-center gap-2">
                <Sparkles size={20} />
                1日分まとめて生成 ({batchCount}件)
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Zap size={20} />
                トーク台本を生成
              </div>
            )}
          </button>

          {/* プログレスバー */}
          {loading && (
            <div className="mt-4 max-w-md mx-auto">
              <div className="bg-gray-700 rounded-full h-2 overflow-hidden">
                <div className="bg-gradient-to-r from-blue-500 to-purple-500 h-full animate-pulse"></div>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                {progressStep === '🔍 ニュース検索中...' && '30%'}
                {progressStep === '📝 トピック整理中...' && '60%'}
                {progressStep === '🤖 AI分析中...' && '80%'}
                {progressStep === '✅ 完了！' && '100%'}
                {progressStep === '🔍 ニュース一括検索中...' && '25%'}
                {progressStep?.includes('分析中') && '50%'}
                {progressStep === '🤖 AI一括処理中...' && '85%'}
                {progressStep === '✅ バッチ生成完了！' && '100%'}
                {' 完了'}
              </p>
            </div>
          )}

          {isOnCooldown && !loading && (
            <p className="text-sm text-gray-400 mt-2">
              連続実行防止のため少々お待ちください
            </p>
          )}

          {user && remainingRequests === 0 && (
            <p className="text-sm text-red-400 mt-2">
              本日の生成上限に達しました。明日お試しください。
            </p>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-500/20 border border-red-500 text-red-200 px-4 py-3 rounded-lg mb-6">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle size={20} />
              <span>{error}</span>
            </div>
            <button
              onClick={clearError}
              aria-label="エラーメッセージを閉じる"
              className="text-red-200 hover:text-white focus:outline-none focus:ring-2 focus:ring-red-400/50 rounded px-1"
            >
              ✕
            </button>
          </div>

          {/* 再試行と代替案 */}
          <div className="flex flex-wrap gap-2">
            {lastFilters && (
              <button
                onClick={retryGeneration}
                disabled={loading}
                className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-3 py-1 rounded text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-red-400/50"
              >
                同じ条件で再生成
              </button>
            )}

            <button
              onClick={() => {
                const history = storage.getHistory()
                  .filter(h => h.type === 'topic');

                if (history.length > 0 && lastFilters) {
                  // 前回のフィルターで再生成（キャッシュがあればヒットする）
                  generateTopics(lastFilters);
                  clearError();
                } else {
                  // フィルター未設定なら全カテゴリで生成
                  generateTopics(filters);
                  clearError();
                }
              }}
              disabled={loading}
              className="bg-gray-600 hover:bg-gray-700 disabled:opacity-50 text-white px-3 py-1 rounded text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400/50"
            >
              前回の条件で再生成
            </button>

            <button
              onClick={() => {
                clearError();
                generateTopics(filters);
              }}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-3 py-1 rounded text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400/50"
            >
              条件を変えて再生成
            </button>
          </div>
        </div>
      )}

      {loading && (
        <div className="animate-fade-in">
          <TopicListSkeleton />
        </div>
      )}

      {topics.length > 0 && !loading && (
        <TopicList
          topics={topics}
          filters={filters}
          onTopicSelect={() => setDetailMode(true)}
          onBackToList={() => setDetailMode(false)}
        />
      )}

      {/* バッチ生成成功時の統計表示 */}
      {batchMode && topics.length > 0 && !loading && (
        <div className="mt-6 bg-purple-900/20 border border-purple-700 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-purple-200 mb-4">バッチ生成完了</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-purple-400">{topics.length}</div>
              <div className="text-sm text-gray-400">生成件数</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-400">
                {new Set(topics.map(t => t.category)).size}
              </div>
              <div className="text-sm text-gray-400">カテゴリ</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-400">
                {topics.filter(t => t.riskLevel === 'low').length}
              </div>
              <div className="text-sm text-gray-400">低リスク</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-yellow-400">
                {Math.round(topics.reduce((sum, t) => sum + t.title.length, 0) / topics.length)}
              </div>
              <div className="text-sm text-gray-400">平均文字数</div>
            </div>
          </div>
        </div>
      )}

      {/* カテゴリ詳細フィルターモーダル */}
      <CategoryDetailModal
        category={detailCategory || ''}
        isOpen={!!detailCategory}
        onClose={() => setDetailCategory(null)}
        onApply={handleCategoryDetailApply}
        initialDetail={detailCategory ? filters.categoryDetails?.[detailCategory] : undefined}
      />

      {/* ゲスト上限到達モーダル */}
      {showGuestLimitModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setShowGuestLimitModal(false)}
        >
          <div
            className="bg-gray-900 border border-gray-700 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-bold text-white mb-3">無料トライアルが終了しました</h2>
            <p className="text-gray-300 mb-6 leading-relaxed">
              ゲストとして3回のトライアルをご利用いただきました。
              ログインすると無制限でご利用いただけます。
            </p>
            <div className="flex flex-col gap-3">
              <Link
                href="/login"
                className="block text-center bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200"
              >
                ログインして続ける
              </Link>
              <button
                onClick={() => setShowGuestLimitModal(false)}
                className="text-gray-400 hover:text-white text-sm transition-colors"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
