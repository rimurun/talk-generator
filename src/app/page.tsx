'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FilterOptions, CategoryDetailFilter } from '@/types';
import { categoryOptions } from '@/lib/mock-data';
import { useTopics } from '@/hooks/useTopics';
import { storage } from '@/lib/storage';
import { TopicListSkeleton } from '@/components/TopicCardSkeleton';
import CategoryDetailModal from '@/components/CategoryDetailModal';
import {
  DollarSign, AlertTriangle, Sparkles, Radio,
  Activity, Database, Settings
} from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import OnboardingOverlay from '@/components/OnboardingOverlay';
import GlitchText from '@/components/GlitchText';
import GuestBanner from './_components/GuestBanner';
import FilterPanel from './_components/FilterPanel';
import GenerateButton from './_components/GenerateButton';
import TopicListSection from './_components/TopicListSection';


function HomeContent() {
  // 認証状態の確認（リダイレクトはしない）
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // ゲスト上限到達モーダルの表示フラグ
  const [showGuestLimitModal, setShowGuestLimitModal] = useState(false);
  // フィルターセクションの折りたたみ状態（全画面でデフォルト折りたたみ）
  const [isFilterOpen, setIsFilterOpen] = useState<boolean>(false);

  // フィルターをモーダルで開くハンドラー（結果セクションからも使用）
  const scrollToFilterAndOpen = () => {
    setIsFilterOpen(true);
  };

  // 結果セクションへの参照（生成完了後に自動スクロール）
  const resultsRef = useRef<HTMLDivElement>(null);

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
    timePeriod: 'today',
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

  // トレンドページからのキーワード検索（後方互換）
  const trendingTriggered = useRef(false);
  const keywordParam = searchParams.get('keyword');
  const categoryParam = searchParams.get('category');
  useEffect(() => {
    if (trendingTriggered.current) return;
    if (!keywordParam) return;

    trendingTriggered.current = true;
    const trendingFilters: FilterOptions = {
      categories: categoryParam ? [categoryParam] : [],
      includeIncidents: categoryParam === '事件事故',
      timePeriod: 'today',
      duration: 60,
      tension: 'medium',
      tone: filters.tone || 'フレンドリー',
      keyword: keywordParam,
    };
    setFilters(trendingFilters);
    // フルページロードで遷移するためURLパラメータは自然に消化済み
    router.replace('/', { scroll: false });
    generateTopics(trendingFilters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keywordParam, categoryParam]);

  // 生成完了後に結果セクションへ自動スクロール
  useEffect(() => {
    if (!loading && topics.length > 0 && resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [loading, topics.length]);

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

  const handleGenerate = async () => {
    if (batchMode) {
      // バッチ生成
      const categoriesToUse = filters.categories.length > 0
        ? filters.categories
        : categoryOptions.map(cat => cat.value);

      await batchGenerate(categoriesToUse, batchCount, batchDiversityMode, {
        includeIncidents: filters.includeIncidents,
        timePeriod: filters.timePeriod,
        duration: filters.duration,
        tension: filters.tension,
        tone: filters.tone
      });
    } else {
      // 通常生成
      await generateTopics(filters);
    }
  };

  // レート制限アラート（1日100回制限）
  const rateLimit = storage.getTodayRateLimit();
  const dailyLimit = 100;
  const totalRequests = rateLimit.topicRequests + rateLimit.scriptRequests;
  const remainingRequests = Math.max(0, dailyLimit - totalRequests);
  const isNearLimit = remainingRequests <= 10;

  // プログレス割合の算出（数値として返す）
  const getProgressPercent = (): number => {
    if (!progressStep) return 0;
    if (progressStep.includes('ニュース検索中'))    return 30;
    if (progressStep.includes('件取得中'))          return 60;
    if (progressStep.includes('再試行中'))          return 50;
    if (progressStep.includes('完了'))              return 100;
    if (progressStep.includes('ニュース一括検索中')) return 25;
    if (progressStep.includes('分析中'))            return 50;
    if (progressStep.includes('AI一括処理中'))      return 85;
    if (progressStep.includes('バッチ生成完了'))    return 100;
    return 40;
  };

  return (
    /* グラデーションメッシュ背景 */
    <div className="gradient-mesh-bg min-h-screen">
      <div className="container mx-auto px-4 py-4 md:py-8 max-w-6xl">

        {/* ゲストモードバナー（未ログイン時のみ表示） */}
        {!authLoading && !user && (
          <GuestBanner />
        )}

        {/* ステータスピル（API使用量・アラート） */}
        {user && usage && (
          <div className="mb-5 flex flex-wrap items-center gap-2">
            {/* 残り回数ピル */}
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full glass-card-light border border-[var(--color-border-alt)] text-xs text-[var(--color-text-secondary)]">
              <Activity size={11} className="text-emerald-400" />
              残り
              <span className={`font-semibold ml-0.5 ${isNearLimit ? 'text-amber-400' : 'text-white'}`}>
                {remainingRequests}回
              </span>
            </span>

            {/* コストピル */}
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full glass-card-light border border-[var(--color-border-alt)] text-xs text-[var(--color-text-secondary)]">
              <DollarSign size={11} className="text-emerald-400" />
              <span className="font-semibold text-emerald-400">${usage.estimatedCostToday.toFixed(3)}</span>
            </span>

            {/* キャッシュヒット率ピル */}
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full glass-card-light border border-[var(--color-border-alt)] text-xs text-[var(--color-text-secondary)]">
              <Database size={11} className="text-cyan-400" />
              キャッシュ
              <span className="font-semibold text-cyan-400 ml-0.5">{(usage.cache.hitRate * 100).toFixed(0)}%</span>
            </span>

            {/* アラートピル */}
            {usage.alerts.message && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300">
                <AlertTriangle size={11} />
                {usage.alerts.message.slice(0, 28)}...
              </span>
            )}

            {/* レート制限アラート */}
            {isNearLimit && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/40 text-xs text-amber-300 font-medium">
                <AlertTriangle size={11} />
                {remainingRequests === 0 ? '本日の上限に達しました' : `残り${remainingRequests}回`}
              </span>
            )}
          </div>
        )}

        {/* ヒーローセクション */}
        <header className="relative text-center mb-10 md:mb-14 page-slide-enter">
          <div className="energy-orb absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          {/* ヒーロータイトル */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass-card-light border border-cyan-500/30 text-xs text-purple-300 mb-5 font-mono tracking-widest shadow-[0_0_10px_rgba(0,212,255,0.15)]">
            <Sparkles size={12} />
            AI配信サポートツール
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black mb-3 tracking-tight">
            <span className="gradient-text-hero neon-text-cyan">
              <GlitchText text="今日、何を話す？" />
            </span>
          </h1>

          {/* word-break: keep-all で日本語の単語中途切れを防止 */}
          <p
            className="text-base md:text-lg text-[var(--color-text-secondary)] max-w-2xl mx-auto leading-relaxed mb-4"
            style={{ wordBreak: 'keep-all', overflowWrap: 'break-word' }}
          >
            最新ニュース・エンタメ・SNSトレンドを自動収集し、
            <br className="hidden sm:block" />
            そのまま読める配信トーク台本を瞬時に生成
          </p>

          {/* 2ステップフロー説明 */}
          <div className="flex items-center justify-center gap-3 mt-4 text-xs text-[var(--color-text-muted)]">
            <span className="px-2 py-1 rounded-md bg-[var(--color-surface)] border border-[var(--color-border)]">1. トピック生成</span>
            <span>→</span>
            <span className="px-2 py-1 rounded-md bg-[var(--color-surface)] border border-[var(--color-border)]">2. 台本作成</span>
            <span>→</span>
            <span className="px-2 py-1 rounded-md bg-[var(--color-surface)] border border-[var(--color-border)]">3. 配信で使う</span>
          </div>

          {/* チャンネル名表示 */}
          {profile?.channelName && (
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] text-sm text-[var(--color-text-muted)]">
              <Radio size={12} />
              {profile.channelName}
            </div>
          )}
        </header>

        <div className="neon-divider my-8 mx-auto max-w-md" />

        {/* フィルター & 生成パネル（グラスモーフィズムカード） */}
        <div
          className={`glass-card-heavy rounded-2xl p-5 md:p-8 mb-8 transition-all duration-300 ${
            detailMode ? 'hidden' : ''
          }`}
          style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)' }}
        >
          {/* フィルター設定パネル */}
          <FilterPanel
            filters={filters}
            setFilters={setFilters}
            batchMode={batchMode}
            setBatchMode={setBatchMode}
            batchCount={batchCount}
            setBatchCount={setBatchCount}
            batchDiversityMode={batchDiversityMode}
            setBatchDiversityMode={setBatchDiversityMode}
            isFilterOpen={isFilterOpen}
            setIsFilterOpen={setIsFilterOpen}
            onCategoryToggle={handleCategoryChange}
            onOpenCategoryDetail={(category) => setDetailCategory(category)}
            onSelectAllCategories={handleSelectAllCategories}
            onDeselectAllCategories={handleDeselectAllCategories}
          />

          {/* 生成ボタン（折りたたみに関わらず常に表示） */}
          <GenerateButton
            loading={loading}
            isOnCooldown={isOnCooldown}
            remainingRequests={remainingRequests}
            isLoggedIn={!!user}
            batchMode={batchMode}
            batchCount={batchCount}
            progressStep={progressStep}
            getProgressPercent={getProgressPercent}
            onGenerate={handleGenerate}
          />
        </div>

        <div className="neon-divider my-6 mx-auto max-w-xs" />

        {/* エラー表示 */}
        {error && (
          <div
            className="rounded-xl px-4 py-4 mb-6 border border-red-500/30"
            style={{ background: 'rgba(239,68,68,0.08)' }}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2 text-red-300">
                <AlertTriangle size={18} />
                <span className="text-sm">{error}</span>
              </div>
              <button
                onClick={clearError}
                aria-label="エラーメッセージを閉じる"
                className="text-red-300/60 hover:text-red-200 transition-colors focus:outline-none focus:ring-2 focus:ring-red-400/40 rounded px-1 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            {/* 再試行ボタン群 */}
            <div className="flex flex-wrap gap-2">
              {lastFilters && (
                <button
                  onClick={retryGeneration}
                  disabled={loading}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-600/70 hover:bg-red-600 disabled:opacity-50 text-white transition-colors focus:outline-none"
                >
                  再試行
                </button>
              )}

              <button
                onClick={() => {
                  clearError();
                  generateTopics(filters);
                }}
                disabled={loading}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-cyan-600/70 hover:bg-cyan-600 disabled:opacity-50 text-white transition-colors focus:outline-none"
              >
                条件を変えて再生成
              </button>
            </div>
          </div>
        )}

        {/* 結果上部のクイックアクションバー（生成完了後のみ表示） */}
        {topics.length > 0 && !loading && !detailMode && (
          <>
            <div className="neon-divider mb-4 mx-auto max-w-xs" />
            <div className="flex items-center gap-3 mb-4">
              <button
                onClick={scrollToFilterAndOpen}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium glass-card-light border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-white hover:border-[var(--color-border-alt)] transition-all duration-200"
              >
                <Settings size={14} />
                フィルター変更
              </button>
              <button
                onClick={handleGenerate}
                disabled={isOnCooldown}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-cyan-600/70 hover:bg-cyan-600 disabled:opacity-50 text-white transition-colors"
              >
                <Sparkles size={14} />
                再生成
              </button>
            </div>
          </>
        )}

        {/* トピックが空・非ローディング・非エラー時の空状態表示 */}
        {topics.length === 0 && !loading && !error && (
          <div className="text-center py-16 text-[var(--color-text-muted)]">
            <Sparkles size={40} className="mx-auto mb-4 opacity-30" />
            <p className="text-lg mb-2">まだトピックがありません</p>
            <p className="text-sm">上のボタンから生成してみましょう</p>
          </div>
        )}

        {/* トピック一覧（スケルトン・結果・バッチ統計） */}
        <TopicListSection
          topics={topics}
          loading={loading}
          filters={filters}
          batchMode={batchMode}
          resultsRef={resultsRef}
          onTopicSelect={() => setDetailMode(true)}
          onBackToList={() => setDetailMode(false)}
        />

        {/* 初回ユーザー向けオンボーディング */}
        <OnboardingOverlay />

        {/* カテゴリ詳細フィルターモーダル */}
        <CategoryDetailModal
          category={detailCategory || ''}
          isOpen={!!detailCategory}
          onClose={() => setDetailCategory(null)}
          onApply={handleCategoryDetailApply}
          initialDetail={detailCategory ? filters.categoryDetails?.[detailCategory] : undefined}
        />

        {/* ゲスト上限到達モーダル（Portal: 親のtransform影響を回避） */}
        {showGuestLimitModal && createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
            onClick={() => setShowGuestLimitModal(false)}
          >
            <div
              className="glass-card-heavy rounded-2xl p-8 max-w-md w-full mx-4 animate-scale-in"
              style={{ boxShadow: '0 24px 80px rgba(0,0,0,0.7), 0 0 40px rgba(124,58,237,0.15)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/20 flex items-center justify-center mb-5 mx-auto">
                <Sparkles size={22} className="text-purple-400" />
              </div>

              <h2 className="text-xl font-bold text-white mb-2 text-center">
                無料トライアルが終了しました
              </h2>
              <p className="text-sm text-[var(--color-text-secondary)] mb-6 leading-relaxed text-center">
                ゲストとして3回のトライアルをご利用いただきました。
                ログインすると無制限でご利用いただけます。
              </p>

              <div className="flex flex-col gap-3">
                <Link
                  href="/login"
                  className="block text-center font-semibold py-3 px-6 rounded-xl text-white transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                  style={{
                    background: 'linear-gradient(135deg, #00d4ff 0%, #7c3aed 100%)',
                    boxShadow: '0 0 24px rgba(124,58,237,0.3)',
                  }}
                >
                  ログインして続ける
                </Link>
                <button
                  onClick={() => setShowGuestLimitModal(false)}
                  className="text-sm text-[var(--color-text-muted)] hover:text-white transition-colors py-2"
                >
                  閉じる
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
      </div>
    </div>
  );
}

// useSearchParamsにはSuspense境界が必要
export default function Home() {
  return (
    <Suspense fallback={<div className="gradient-mesh-bg min-h-screen" />}>
      <HomeContent />
    </Suspense>
  );
}
