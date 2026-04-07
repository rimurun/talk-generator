'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  TrendingUp,
  RefreshCw,
  Zap,
  Flame,
  ArrowUpRight,
} from 'lucide-react';
import {
  parseTrendingText,
  TRENDING_CATEGORY_ORDER,
  type TrendingCategory,
  type TrendingItem,
} from '@/lib/parse-trending';
import { getAuthHeaders } from '@/lib/api-helpers';

// ============================================================
// カテゴリ別スタイル定義（既存UIと統一）
// ============================================================
const CATEGORY_STYLES: Record<
  string,
  {
    border: string;
    bg: string;
    text: string;
    glow: string;
    gradFrom: string;
    gradTo: string;
    hexColor: string;
  }
> = {
  ニュース: {
    border: 'border-[#00d4ff]/40',
    bg: 'bg-[#00d4ff]/10',
    text: 'text-[#00d4ff]',
    glow: '0 0 24px rgba(0,212,255,0.35), 0 4px 16px rgba(0,0,0,0.6)',
    gradFrom: '#00d4ff',
    gradTo: '#0066ff',
    hexColor: '#00d4ff',
  },
  エンタメ: {
    border: 'border-[#ff00ff]/40',
    bg: 'bg-[#ff00ff]/10',
    text: 'text-[#ff00ff]',
    glow: '0 0 24px rgba(255,0,255,0.35), 0 4px 16px rgba(0,0,0,0.6)',
    gradFrom: '#ff00ff',
    gradTo: '#ff0066',
    hexColor: '#ff00ff',
  },
  SNS: {
    border: 'border-[#00ff88]/40',
    bg: 'bg-[#00ff88]/10',
    text: 'text-[#00ff88]',
    glow: '0 0 24px rgba(0,255,136,0.35), 0 4px 16px rgba(0,0,0,0.6)',
    gradFrom: '#00ff88',
    gradTo: '#00d4ff',
    hexColor: '#00ff88',
  },
  TikTok: {
    border: 'border-[#aa00ff]/40',
    bg: 'bg-[#aa00ff]/10',
    text: 'text-[#aa00ff]',
    glow: '0 0 24px rgba(170,0,255,0.35), 0 4px 16px rgba(0,0,0,0.6)',
    gradFrom: '#aa00ff',
    gradTo: '#ff0066',
    hexColor: '#aa00ff',
  },
  海外おもしろ: {
    border: 'border-[#ff8800]/40',
    bg: 'bg-[#ff8800]/10',
    text: 'text-[#ff8800]',
    glow: '0 0 24px rgba(255,136,0,0.35), 0 4px 16px rgba(0,0,0,0.6)',
    gradFrom: '#ff8800',
    gradTo: '#ffaa00',
    hexColor: '#ff8800',
  },
};

// カテゴリ順序
const CATEGORY_ORDER = TRENDING_CATEGORY_ORDER;

// localStorageキャッシュキー
const TRENDING_CACHE_KEY = 'talkgen_trending_cache';

// ============================================================
// キャッシュ読み書き
// ============================================================
function readTrendingCache(): {
  categories: TrendingCategory[];
  generatedAt: string;
  timestamp: string;
} | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(TRENDING_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeTrendingCache(
  categories: TrendingCategory[],
  generatedAt: string,
  timestamp: string,
) {
  try {
    localStorage.setItem(
      TRENDING_CACHE_KEY,
      JSON.stringify({ categories, generatedAt, timestamp }),
    );
  } catch {
    /* quota exceeded */
  }
}

// ============================================================
// 相対時間計算
// ============================================================
function getRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'たった今';
  if (mins < 60) return `${mins}分前`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}時間前`;
  return `${Math.floor(hrs / 24)}日前`;
}

// ============================================================
// ヒートバッジ（順位によって異なるラベルを表示）
// ============================================================
function HeatBadge({ position }: { position: number }) {
  if (position === 0) {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide"
        style={{
          background: 'rgba(255,60,0,0.18)',
          color: '#ff5533',
          border: '1px solid rgba(255,60,0,0.4)',
          boxShadow: '0 0 8px rgba(255,60,0,0.25)',
        }}
      >
        <Flame size={9} />
        HOT
      </span>
    );
  }
  if (position === 1) {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide"
        style={{
          background: 'rgba(255,140,0,0.15)',
          color: '#ff9500',
          border: '1px solid rgba(255,140,0,0.35)',
        }}
      >
        <ArrowUpRight size={9} />
        急上昇
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold"
      style={{
        background: 'rgba(255,255,255,0.08)',
        color: 'rgba(255,255,255,0.45)',
        border: '1px solid rgba(255,255,255,0.12)',
      }}
    >
      {position + 1}
    </span>
  );
}

// ============================================================
// スケルトンローダー
// ============================================================
function SkeletonSpotlight() {
  return (
    <div
      className="w-full rounded-2xl p-6 md:p-8 mb-6 animate-pulse"
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="w-14 h-5 rounded-full skeleton" />
        <div className="w-20 h-5 rounded-full skeleton" />
      </div>
      <div className="w-2/3 h-8 rounded-lg skeleton mb-2" />
      <div className="w-full h-4 rounded skeleton mb-1" />
      <div className="w-4/5 h-4 rounded skeleton mb-6" />
      <div className="w-40 h-10 rounded-xl skeleton" />
    </div>
  );
}

function SkeletonCategoryCard() {
  return (
    <div
      className="rounded-xl p-5 animate-pulse"
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <div className="flex items-center gap-2 mb-4">
        <div className="w-6 h-6 rounded-lg skeleton" />
        <div className="w-20 h-5 rounded skeleton" />
      </div>
      {[1, 2, 3].map(i => (
        <div key={i} className="mb-3">
          <div className="w-3/4 h-4 rounded skeleton mb-1" />
          <div className="w-full h-3 rounded skeleton opacity-60" />
        </div>
      ))}
    </div>
  );
}

// ============================================================
// スポットライトヒーロー（最上位トレンドを大きく表示）
// ============================================================
function SpotlightHero({
  item,
  categoryName,
  onGenerate,
}: {
  item: TrendingItem;
  categoryName: string;
  onGenerate: () => void;
}) {
  const style = CATEGORY_STYLES[categoryName];

  return (
    <div
      className="relative w-full rounded-2xl p-6 md:p-10 mb-6 overflow-hidden cursor-pointer group trending-spotlight"
      style={
        {
          background: `linear-gradient(135deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.5) 100%)`,
          '--spotlight-from': style?.gradFrom ?? '#00d4ff',
          '--spotlight-to': style?.gradTo ?? '#0066ff',
        } as React.CSSProperties
      }
      onClick={onGenerate}
    >
      {/* グラデーションボーダーアニメーション */}
      <div
        className="absolute inset-0 rounded-2xl trending-spotlight-border"
        style={
          {
            '--color-from': style?.gradFrom ?? '#00d4ff',
            '--color-to': style?.gradTo ?? '#0066ff',
          } as React.CSSProperties
        }
      />

      {/* 背景グロー */}
      <div
        className="absolute inset-0 rounded-2xl opacity-20"
        style={{
          background: `radial-gradient(ellipse at 30% 50%, ${style?.gradFrom ?? '#00d4ff'} 0%, transparent 70%)`,
        }}
      />

      {/* コンテンツ */}
      <div className="relative z-10">
        {/* HOT NOWバッジとカテゴリ */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-widest trending-hot-badge"
            style={{
              background: 'rgba(255,60,0,0.2)',
              color: '#ff5533',
              border: '1px solid rgba(255,60,0,0.5)',
            }}
          >
            <span className="trending-fire-pulse">&#x1F525;</span>
            HOT NOW
          </span>
          {style && (
            <span
              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
              style={{
                background: `${style.hexColor}18`,
                color: style.hexColor,
                border: `1px solid ${style.hexColor}50`,
              }}
            >
              {categoryName}
            </span>
          )}
        </div>

        {/* タイトル */}
        <h2 className="text-2xl md:text-3xl font-bold text-white leading-tight mb-2 group-hover:text-opacity-90 transition-opacity">
          {item.title}
        </h2>

        {/* 説明文 */}
        {item.description && (
          <p className="text-sm md:text-base text-white/60 leading-relaxed mb-5 max-w-2xl">
            {item.description}
          </p>
        )}

        {/* CTAボタン */}
        <button
          onClick={e => {
            e.stopPropagation();
            onGenerate();
          }}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 group/btn"
          style={{
            background: `linear-gradient(135deg, ${style?.gradFrom ?? '#00d4ff'}, ${style?.gradTo ?? '#0066ff'})`,
            color: '#000',
            boxShadow: style
              ? `0 0 20px ${style.hexColor}40`
              : undefined,
          }}
        >
          <Zap size={15} />
          この話題で台本を生成
          <ArrowUpRight
            size={14}
            className="group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform"
          />
        </button>
      </div>
    </div>
  );
}

// ============================================================
// カテゴリフィルタータブ
// ============================================================
function FilterTabs({
  categories,
  activeTab,
  onSelect,
}: {
  categories: TrendingCategory[];
  activeTab: string;
  onSelect: (name: string) => void;
}) {
  const tabs = ['全て', ...CATEGORY_ORDER.filter(name =>
    categories.some(c => c.name === name),
  )];

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 mb-6 trending-tabs-scroll">
      {tabs.map(tab => {
        const isActive = activeTab === tab;
        const style = CATEGORY_STYLES[tab];
        return (
          <button
            key={tab}
            onClick={() => onSelect(tab)}
            className="flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200"
            style={
              isActive
                ? {
                    background: style
                      ? `linear-gradient(135deg, ${style.gradFrom}30, ${style.gradTo}20)`
                      : 'rgba(255,255,255,0.12)',
                    color: style ? style.hexColor : '#fff',
                    border: `1px solid ${style ? style.hexColor + '60' : 'rgba(255,255,255,0.3)'}`,
                    boxShadow: style
                      ? `0 0 12px ${style.hexColor}30`
                      : undefined,
                  }
                : {
                    background: 'rgba(255,255,255,0.05)',
                    color: 'rgba(255,255,255,0.5)',
                    border: '1px solid rgba(255,255,255,0.1)',
                  }
            }
          >
            {tab}
          </button>
        );
      })}
    </div>
  );
}

// ============================================================
// カテゴリカード（個別アイテムをクリック可能に）
// ============================================================
function CategoryCard({
  category,
  onItemClick,
  animationIndex,
}: {
  category: TrendingCategory;
  onItemClick: (itemTitle: string) => void;
  animationIndex: number;
}) {
  const style = CATEGORY_STYLES[category.name] ?? {
    border: 'border-gray-700',
    bg: 'bg-gray-800/60',
    text: 'text-gray-300',
    glow: '0 4px 16px rgba(0,0,0,0.5)',
    gradFrom: '#808080',
    gradTo: '#606060',
    hexColor: '#808080',
  };

  return (
    <div
      className="glass-card rounded-xl p-5 md:p-6 flex flex-col trending-card-enter"
      style={
        {
          '--delay': `${animationIndex * 0.08}s`,
          borderColor: `${style.hexColor}30`,
          border: `1px solid ${style.hexColor}30`,
        } as React.CSSProperties
      }
    >
      {/* カテゴリヘッダー */}
      <div
        className="flex items-center gap-2 mb-4 pb-3"
        style={{ borderBottom: `1px solid ${style.hexColor}20` }}
      >
        <div
          className="p-1.5 rounded-lg"
          style={{ background: `${style.hexColor}18` }}
        >
          <TrendingUp size={14} style={{ color: style.hexColor }} />
        </div>
        <span className="font-semibold text-sm" style={{ color: style.hexColor }}>
          {category.name}
        </span>
      </div>

      {/* トレンド項目リスト */}
      <div className="flex-1 space-y-2 mb-4">
        {category.items.map((item, idx) => (
          <button
            key={idx}
            onClick={() => onItemClick(item.title)}
            className="w-full text-left group/item rounded-lg px-2 py-2 transition-all duration-150 trending-item-btn"
            style={
              {
                '--hover-bg': `${style.hexColor}0d`,
                '--hover-glow': `0 0 12px ${style.hexColor}20`,
              } as React.CSSProperties
            }
          >
            <div className="flex items-start gap-2">
              {/* ヒートバッジ */}
              <div className="flex-shrink-0 mt-0.5">
                <HeatBadge position={idx} />
              </div>

              <div className="min-w-0 flex-1">
                {/* タイトル */}
                <p
                  className="text-white text-sm font-medium leading-snug truncate group-hover/item:text-opacity-80 transition-colors"
                  style={{}}
                >
                  {item.title}
                </p>
                {/* 説明文 */}
                {item.description && (
                  <p className="text-white/40 text-xs mt-0.5 leading-relaxed line-clamp-2">
                    {item.description}
                  </p>
                )}
              </div>

              {/* ホバー時に表示する矢印アイコン */}
              <ArrowUpRight
                size={13}
                className="flex-shrink-0 mt-0.5 opacity-0 group-hover/item:opacity-60 transition-opacity"
                style={{ color: style.hexColor }}
              />
            </div>
          </button>
        ))}

        {category.items.length === 0 && (
          <p className="text-white/30 text-sm text-center py-4">
            データを取得中...
          </p>
        )}
      </div>

      {/* カテゴリレベルの台本生成ボタン（セカンダリ） */}
      <button
        onClick={() => {
          const firstItem = category.items[0];
          if (firstItem) onItemClick(firstItem.title);
        }}
        className="flex items-center justify-center gap-2 w-full py-2 px-4 rounded-lg text-xs font-medium transition-all duration-200 trending-secondary-btn"
        style={
          {
            background: `${style.hexColor}0d`,
            color: style.hexColor,
            border: `1px solid ${style.hexColor}30`,
            '--hover-bg': `${style.hexColor}1a`,
            '--hover-border': `${style.hexColor}50`,
          } as React.CSSProperties
        }
      >
        <Zap size={12} />
        この話題で台本を生成
      </button>
    </div>
  );
}

// ============================================================
// メインページコンポーネント
// ============================================================
export default function TrendingPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<TrendingCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [timestamp, setTimestamp] = useState<string>('');
  const [relativeTime, setRelativeTime] = useState<string>('');
  const [activeTab, setActiveTab] = useState<string>('全て');
  const [sources, setSources] = useState<Record<string, any> | null>(null);
  const [lastRefreshTime, setLastRefreshTime] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      return parseInt(localStorage.getItem('talkgen_trending_last_refresh') || '0', 10);
    }
    return 0;
  });
  const [refreshCooldownRemaining, setRefreshCooldownRemaining] = useState<string>('');

  // キャッシュデータが存在するかを追跡
  const hasCachedData = useRef(false);

  // トレンドデータ取得（stale-while-revalidate）
  const fetchTrending = useCallback(async () => {
    if (!hasCachedData.current) setLoading(true);
    setError(null);
    try {
      const trendAuthHeaders = await getAuthHeaders();
      const res = await fetch('/api/trending', { headers: trendAuthHeaders });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const parsed = parseTrendingText(data.text || '');
      setCategories(parsed);
      setGeneratedAt(data.generatedAt || null);
      setTimestamp(data.timestamp || '');
      setSources(data.sources || null);
      writeTrendingCache(parsed, data.generatedAt || '', data.timestamp || '');
    } catch (e: any) {
      if (!hasCachedData.current) {
        setError(e.message || '取得に失敗しました');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // マウント時: キャッシュ即時表示 → バックグラウンド最新取得 → 10分ポーリング
  useEffect(() => {
    const cached = readTrendingCache();
    if (cached && cached.categories.length > 0) {
      hasCachedData.current = true;
      setCategories(cached.categories);
      setGeneratedAt(cached.generatedAt);
      setTimestamp(cached.timestamp);
      setLoading(false);
    }
    fetchTrending();
    const timer = setInterval(fetchTrending, 10 * 60 * 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 更新ボタンのクールダウン残り時間を1秒ごとに更新
  useEffect(() => {
    const COOLDOWN_MS = 3600_000; // 1時間
    const interval = setInterval(() => {
      const elapsed = Date.now() - lastRefreshTime;
      if (elapsed < COOLDOWN_MS) {
        const remaining = COOLDOWN_MS - elapsed;
        const min = Math.floor(remaining / 60_000);
        const sec = Math.floor((remaining % 60_000) / 1000);
        setRefreshCooldownRemaining(`${min}分${sec}秒`);
      } else {
        setRefreshCooldownRemaining('');
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [lastRefreshTime]);

  // 相対時間を1分ごとに更新
  useEffect(() => {
    if (!generatedAt) return;
    const update = () => setRelativeTime(getRelativeTime(generatedAt));
    update();
    const timer = setInterval(update, 60000);
    return () => clearInterval(timer);
  }, [generatedAt]);

  // 手動更新ボタン用ハンドラ（クールダウンチェックあり）
  const handleManualRefresh = useCallback(async () => {
    const COOLDOWN_MS = 3600_000;
    if (Date.now() - lastRefreshTime < COOLDOWN_MS) {
      setError('トレンドの更新は1時間に1回までです。');
      return;
    }
    const now = Date.now();
    setLastRefreshTime(now);
    localStorage.setItem('talkgen_trending_last_refresh', String(now));
    await fetchTrending();
  }, [lastRefreshTime, fetchTrending]);

  // 台本生成ページへ遷移
  const handleGenerateScript = useCallback(
    (categoryName: string, itemTitle: string) => {
      const params = new URLSearchParams({
        category: categoryName,
        keyword: itemTitle,
      });
      router.push(`/?${params.toString()}`);
    },
    [router],
  );

  // カテゴリを表示順で並び替え
  const sortedCategories = CATEGORY_ORDER.map(name =>
    categories.find(c => c.name === name),
  ).filter((c): c is TrendingCategory => !!c);

  // フィルタリング後のカテゴリ
  const filteredCategories =
    activeTab === '全て'
      ? sortedCategories
      : sortedCategories.filter(c => c.name === activeTab);

  // スポットライト用データ（最初のカテゴリの1位アイテム）
  const spotlightCategory = sortedCategories[0];
  const spotlightItem = spotlightCategory?.items[0];

  return (
    <>
      {/* CSS-in-JS で独自アニメーションを定義 */}
      <style>{`
        /* スポットライトのグラデーションボーダーアニメーション */
        @keyframes borderSpin {
          0%   { opacity: 0.6; }
          50%  { opacity: 1; }
          100% { opacity: 0.6; }
        }
        @keyframes hotPulse {
          0%, 100% { transform: scale(1); }
          50%       { transform: scale(1.15); }
        }
        @keyframes livePulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.5; transform: scale(0.85); }
        }
        @keyframes cardEnter {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* スポットライトボーダー */
        .trending-spotlight {
          transition: box-shadow 0.3s ease;
        }
        .trending-spotlight:hover {
          box-shadow: 0 0 40px var(--spotlight-from, #00d4ff)30, 0 8px 32px rgba(0,0,0,0.7);
        }
        .trending-spotlight-border {
          padding: 1px;
          background: linear-gradient(
            135deg,
            var(--color-from, #00d4ff),
            var(--color-to, #0066ff),
            var(--color-from, #00d4ff)
          );
          background-size: 200% 200%;
          animation: borderSpin 3s ease-in-out infinite;
          -webkit-mask:
            linear-gradient(#fff 0 0) content-box,
            linear-gradient(#fff 0 0);
          -webkit-mask-composite: destination-out;
          mask-composite: exclude;
        }

        /* HOT NOWバッジのfire絵文字アニメーション */
        .trending-fire-pulse {
          display: inline-block;
          animation: hotPulse 1.2s ease-in-out infinite;
        }

        /* LIVEドットアニメーション */
        .trending-live-dot {
          animation: livePulse 1.5s ease-in-out infinite;
        }

        /* カード入場アニメーション（スタガー） */
        .trending-card-enter {
          opacity: 0;
          animation: cardEnter 0.45s ease-out var(--delay, 0s) forwards;
        }

        /* タブスクロールバーを非表示 */
        .trending-tabs-scroll {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .trending-tabs-scroll::-webkit-scrollbar {
          display: none;
        }

        /* アイテムボタンのホバー */
        .trending-item-btn:hover {
          background: var(--hover-bg);
          box-shadow: var(--hover-glow);
        }

        /* セカンダリボタンのホバー */
        .trending-secondary-btn:hover {
          background: var(--hover-bg) !important;
          border-color: var(--hover-border) !important;
        }
      `}</style>

      <div className="container mx-auto px-4 py-4 md:py-8 max-w-[1400px]">
        {/* ============================================================
            ヘッダー
            ============================================================ */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            {/* アイコン */}
            <div
              className="p-2 rounded-xl"
              style={{
                background: 'linear-gradient(135deg, #ff5500, #ff0066)',
                boxShadow: '0 0 16px rgba(255,85,0,0.4)',
              }}
            >
              <TrendingUp size={22} className="text-white" />
            </div>

            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <h1 className="text-2xl md:text-3xl font-bold text-white leading-none">
                  トレンド
                </h1>
                {/* リアルタイムバッジ */}
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-widest"
                  style={{
                    background: 'rgba(0,212,255,0.12)',
                    color: '#00d4ff',
                    border: '1px solid rgba(0,212,255,0.3)',
                  }}
                >
                  <span
                    className="trending-live-dot w-1.5 h-1.5 rounded-full inline-block"
                    style={{ background: '#00d4ff' }}
                  />
                  リアルタイム
                </span>
              </div>
              <p className="text-xs text-white/40">
                {timestamp ? `${timestamp}の注目トピック` : '今日の注目トピック'}
              </p>
            </div>
          </div>

          {/* 右側：更新時刻 + 更新ボタン */}
          <div className="flex items-center gap-3">
            {relativeTime && (
              <span className="text-xs text-white/30 hidden sm:block">
                更新: {relativeTime}
              </span>
            )}
            <button
              onClick={handleManualRefresh}
              disabled={!!refreshCooldownRemaining || loading}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all duration-200 disabled:opacity-50"
              style={{
                background: 'rgba(255,255,255,0.06)',
                color: 'rgba(255,255,255,0.6)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
              {refreshCooldownRemaining ? (
                <span className="text-xs">{refreshCooldownRemaining}</span>
              ) : (
                <span className="hidden sm:inline">更新</span>
              )}
            </button>
          </div>
        </div>

        {/* ============================================================
            エラー表示
            ============================================================ */}
        {error && (
          <div
            className="px-4 py-3 rounded-xl mb-6 text-sm"
            style={{
              background: 'rgba(255,50,50,0.12)',
              border: '1px solid rgba(255,50,50,0.35)',
              color: '#ff8080',
            }}
          >
            取得エラー: {error}
            <button
              onClick={fetchTrending}
              className="ml-3 underline hover:no-underline opacity-80 hover:opacity-100"
            >
              再試行
            </button>
          </div>
        )}

        {/* ============================================================
            ローディング中
            ============================================================ */}
        {loading ? (
          <>
            <SkeletonSpotlight />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4 md:gap-5">
              {CATEGORY_ORDER.map(name => (
                <SkeletonCategoryCard key={name} />
              ))}
            </div>
          </>
        ) : sortedCategories.length === 0 ? (
          /* データ0件の空状態 */
          <div className="text-center py-20 text-white/30">
            <TrendingUp size={48} className="mx-auto mb-4 opacity-20" />
            <p className="mb-4">トレンドデータを取得できませんでした。</p>
            <button
              onClick={fetchTrending}
              className="text-sm underline hover:no-underline opacity-60 hover:opacity-100 transition-opacity"
              style={{ color: '#00d4ff' }}
            >
              再取得する
            </button>
          </div>
        ) : (
          <>
            {/* ============================================================
                スポットライトヒーロー
                ============================================================ */}
            {spotlightItem && spotlightCategory && (
              <SpotlightHero
                item={spotlightItem}
                categoryName={spotlightCategory.name}
                onGenerate={() =>
                  handleGenerateScript(spotlightCategory.name, spotlightItem.title)
                }
              />
            )}

            {/* ============================================================
                カテゴリフィルタータブ
                ============================================================ */}
            <FilterTabs
              categories={sortedCategories}
              activeTab={activeTab}
              onSelect={setActiveTab}
            />

            {/* ============================================================
                カテゴリカードグリッド / 単一カテゴリ時はフル幅リスト
                ============================================================ */}
            {filteredCategories.length === 1 ? (
              /* 単一カテゴリ選択時: フル幅の詳細リスト表示 */
              <div className="trending-card-enter" style={{ '--delay': '0s' } as React.CSSProperties}>
                {(() => {
                  const category = filteredCategories[0];
                  const style = CATEGORY_STYLES[category.name];
                  return (
                    <div
                      className="rounded-xl p-5 md:p-6"
                      style={{
                        background: 'rgba(255,255,255,0.02)',
                        border: `1px solid ${style?.hexColor ?? '#888'}30`,
                      }}
                    >
                      <div className="flex items-center gap-2 mb-5 pb-3" style={{ borderBottom: `1px solid ${style?.hexColor ?? '#888'}20` }}>
                        <div className="p-1.5 rounded-lg" style={{ background: `${style?.hexColor ?? '#888'}18` }}>
                          <TrendingUp size={16} style={{ color: style?.hexColor ?? '#888' }} />
                        </div>
                        <span className="font-semibold text-base" style={{ color: style?.hexColor ?? '#888' }}>
                          {category.name}
                        </span>
                        <span className="text-xs text-white/30 ml-2">{category.items.length}件</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {category.items.map((item, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleGenerateScript(category.name, item.title)}
                            className="w-full text-left group/item rounded-xl px-4 py-3.5 transition-all duration-150 trending-item-btn flex items-start gap-3"
                            style={{
                              '--hover-bg': `${style?.hexColor ?? '#888'}0d`,
                              '--hover-glow': `0 0 12px ${style?.hexColor ?? '#888'}20`,
                              background: 'rgba(255,255,255,0.02)',
                              border: `1px solid rgba(255,255,255,0.06)`,
                            } as React.CSSProperties}
                          >
                            <div className="flex-shrink-0 mt-0.5">
                              <HeatBadge position={idx} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-white text-sm font-medium leading-snug group-hover/item:text-opacity-80">
                                {item.title}
                              </p>
                              {item.description && (
                                <p className="text-white/40 text-xs mt-1 leading-relaxed">
                                  {item.description}
                                </p>
                              )}
                            </div>
                            <div className="flex-shrink-0 mt-1 opacity-0 group-hover/item:opacity-100 transition-all duration-200">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium"
                                style={{ background: `${style?.hexColor ?? '#888'}15`, color: style?.hexColor ?? '#888', border: `1px solid ${style?.hexColor ?? '#888'}30` }}>
                                <Zap size={10} />
                                台本生成
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : (
              /* 複数カテゴリ: グリッド表示 */
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4 md:gap-5">
                {filteredCategories.map((category, idx) => (
                  <CategoryCard
                    key={category.name}
                    category={category}
                    animationIndex={idx}
                    onItemClick={itemTitle =>
                      handleGenerateScript(category.name, itemTitle)
                    }
                  />
                ))}
              </div>
            )}

            {/* データソース情報 + フッター注記 */}
            <div className="mt-8 pt-6" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              {sources && (
                <div className="flex flex-wrap items-center justify-center gap-3 mb-3">
                  {[
                    { label: 'Perplexity Sonar', active: true },
                    { label: 'GNews', active: (sources as any).gnewsJp > 0 || (sources as any).gnewsEntertainment > 0 },
                    { label: 'X API', active: (sources as any).xTrends > 0 },
                    { label: 'Yahoo News', active: sources.yahooRss > 0 },
                    { label: 'Google Trends', active: sources.googleTrends > 0 },
                    { label: 'Wikipedia', active: sources.wikipedia > 0 },
                    { label: 'YouTube', active: sources.youtube > 0 },
                    { label: 'NewsAPI', active: sources.newsApiJp > 0 || sources.newsApiWorld > 0 },
                  ].map(s => (
                    <span
                      key={s.label}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-medium transition-all duration-300 ${s.active ? 'neon-pulse-border' : ''}`}
                      style={{
                        background: s.active ? 'rgba(0,212,255,0.1)' : 'rgba(255,255,255,0.03)',
                        color: s.active ? '#00d4ff' : 'rgba(255,255,255,0.2)',
                        border: `1px solid ${s.active ? 'rgba(0,212,255,0.4)' : 'rgba(255,255,255,0.06)'}`,
                        boxShadow: s.active ? '0 0 8px rgba(0,212,255,0.3), inset 0 0 8px rgba(0,212,255,0.05)' : 'none',
                        textShadow: s.active ? '0 0 6px rgba(0,212,255,0.5)' : 'none',
                      }}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${s.active ? 'animate-pulse' : ''}`}
                        style={{ background: s.active ? '#00d4ff' : 'rgba(255,255,255,0.15)', boxShadow: s.active ? '0 0 4px #00d4ff' : 'none' }}
                      />
                      {s.label}
                    </span>
                  ))}
                </div>
              )}
              <p className="text-center text-xs text-white/20">
                8つのデータソースから集約。内容は参考情報です。
              </p>
            </div>
          </>
        )}
      </div>
    </>
  );
}
