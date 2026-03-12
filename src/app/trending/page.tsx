'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { TrendingUp, RefreshCw, ExternalLink, Newspaper, Tv2, Smartphone, Music, Globe } from 'lucide-react';

// カテゴリ別アクセントカラー（CategoryDetailModalと統一）
const CATEGORY_STYLES: Record<string, { border: string; bg: string; text: string; icon: React.ComponentType<any> }> = {
  'ニュース':    { border: 'border-[#00d4ff]/40', bg: 'bg-[#00d4ff]/10',  text: 'text-[#00d4ff]',  icon: Newspaper },
  'エンタメ':   { border: 'border-[#ff00ff]/40', bg: 'bg-[#ff00ff]/10',  text: 'text-[#ff00ff]',  icon: Tv2 },
  'SNS':        { border: 'border-[#00ff88]/40', bg: 'bg-[#00ff88]/10',  text: 'text-[#00ff88]',  icon: Smartphone },
  'TikTok':     { border: 'border-[#aa00ff]/40', bg: 'bg-[#aa00ff]/10',  text: 'text-[#aa00ff]',  icon: Music },
  '海外おもしろ': { border: 'border-[#ff8800]/40', bg: 'bg-[#ff8800]/10', text: 'text-[#ff8800]',  icon: Globe },
};

// カテゴリ順序（表示順を固定）
const CATEGORY_ORDER = ['ニュース', 'エンタメ', 'SNS', 'TikTok', '海外おもしろ'];

interface TrendingItem {
  title: string;
  description: string;
}

interface TrendingCategory {
  name: string;
  items: TrendingItem[];
}

// テキストをカテゴリ別にパース
function parseTrendingText(text: string): TrendingCategory[] {
  const categories: TrendingCategory[] = [];
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  let currentCategory: TrendingCategory | null = null;

  for (const line of lines) {
    // カテゴリ名の検出（行がカテゴリ名で始まる or カテゴリ名そのもの）
    const catMatch = CATEGORY_ORDER.find(cat => line.startsWith(cat) || line === cat);
    if (catMatch) {
      if (currentCategory) categories.push(currentCategory);
      currentCategory = { name: catMatch, items: [] };
      continue;
    }

    if (!currentCategory) continue;

    // 番号付きリスト行を解析: 1. タイトル - 説明 または 1. タイトル: 説明
    const itemMatch = line.match(/^\d+[.)]\s*(.+)/);
    if (itemMatch) {
      const content = itemMatch[1];
      // タイトルと説明を分離（「 - 」「：」「: 」で分割）
      const sepMatch = content.match(/^(.+?)[:\-－：]\s*(.+)$/);
      if (sepMatch) {
        currentCategory.items.push({
          title: sepMatch[1].trim().slice(0, 25),
          description: sepMatch[2].trim().slice(0, 40),
        });
      } else {
        currentCategory.items.push({
          title: content.trim().slice(0, 25),
          description: '',
        });
      }
    }
  }

  if (currentCategory && currentCategory.items.length > 0) {
    categories.push(currentCategory);
  }

  return categories;
}

// スケルトンカード（ロード中表示）
function SkeletonCard() {
  return (
    <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-5 animate-pulse">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-5 h-5 bg-gray-700 rounded" />
        <div className="w-20 h-5 bg-gray-700 rounded" />
      </div>
      {[1, 2, 3].map(i => (
        <div key={i} className="mb-3">
          <div className="w-3/4 h-4 bg-gray-700 rounded mb-1" />
          <div className="w-full h-3 bg-gray-700/60 rounded" />
        </div>
      ))}
      <div className="mt-4 w-full h-8 bg-gray-700 rounded-lg" />
    </div>
  );
}

// 相対時間を計算（例: "3分前"）
function getRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'たった今';
  if (mins < 60) return `${mins}分前`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}時間前`;
  return `${Math.floor(hrs / 24)}日前`;
}

export default function TrendingPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<TrendingCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [timestamp, setTimestamp] = useState<string>('');
  const [relativeTime, setRelativeTime] = useState<string>('');

  // トレンドデータを取得
  const fetchTrending = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/trending');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const parsed = parseTrendingText(data.text || '');
      setCategories(parsed);
      setGeneratedAt(data.generatedAt || null);
      setTimestamp(data.timestamp || '');
    } catch (e: any) {
      setError(e.message || '取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, []);

  // マウント時とAuto-refresh（10分）
  useEffect(() => {
    fetchTrending();
    const timer = setInterval(fetchTrending, 10 * 60 * 1000);
    return () => clearInterval(timer);
  }, [fetchTrending]);

  // 相対時間を1分ごとに更新
  useEffect(() => {
    if (!generatedAt) return;
    const update = () => setRelativeTime(getRelativeTime(generatedAt));
    update();
    const timer = setInterval(update, 60000);
    return () => clearInterval(timer);
  }, [generatedAt]);

  // 台本生成ページへ遷移（URLパラメータでカテゴリをプリセット）
  const handleGenerateScript = (categoryName: string, itemTitle: string) => {
    const params = new URLSearchParams({
      category: categoryName,
      keyword: itemTitle,
    });
    router.push(`/?${params.toString()}`);
  };

  // カテゴリを表示順で並び替え
  const sortedCategories = CATEGORY_ORDER
    .map(name => categories.find(c => c.name === name))
    .filter((c): c is TrendingCategory => !!c);

  return (
    <div className="container mx-auto px-4 py-4 md:py-8 max-w-6xl">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-r from-orange-500 to-red-500 p-2 rounded-lg">
            <TrendingUp size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white">トレンド</h1>
            <p className="text-sm text-gray-400">
              {timestamp ? `${timestamp}の注目トピック` : '今日の注目トピック'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* 更新時刻表示 */}
          {relativeTime && (
            <span className="text-xs text-gray-500 hidden sm:block">
              更新: {relativeTime}
            </span>
          )}
          {/* 手動更新ボタン */}
          <button
            onClick={fetchTrending}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors text-sm disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">更新</span>
          </button>
        </div>
      </div>

      {/* エラー表示 */}
      {error && (
        <div className="bg-red-500/20 border border-red-500/50 text-red-300 px-4 py-3 rounded-lg mb-6 text-sm">
          取得エラー: {error}
          <button
            onClick={fetchTrending}
            className="ml-3 underline hover:no-underline"
          >
            再試行
          </button>
        </div>
      )}

      {/* カテゴリグリッド */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
        {loading
          ? CATEGORY_ORDER.map(name => <SkeletonCard key={name} />)
          : sortedCategories.map(category => {
              const style = CATEGORY_STYLES[category.name] ?? {
                border: 'border-gray-700',
                bg: 'bg-gray-800/60',
                text: 'text-gray-300',
                icon: TrendingUp,
              };
              const Icon = style.icon;

              return (
                <div
                  key={category.name}
                  className={`bg-gray-800/60 border ${style.border} rounded-xl p-5 flex flex-col`}
                >
                  {/* カテゴリヘッダー */}
                  <div className={`flex items-center gap-2 mb-4 pb-3 border-b ${style.border}`}>
                    <div className={`${style.bg} p-1.5 rounded-lg`}>
                      <Icon size={16} className={style.text} />
                    </div>
                    <span className={`font-semibold text-base ${style.text}`}>
                      {category.name}
                    </span>
                  </div>

                  {/* トレンド項目リスト */}
                  <div className="flex-1 space-y-3 mb-4">
                    {category.items.map((item, idx) => (
                      <div key={idx} className="group">
                        <div className="flex items-start gap-2">
                          {/* 番号バッジ */}
                          <span className={`flex-shrink-0 w-5 h-5 rounded-full ${style.bg} ${style.text} text-xs flex items-center justify-center font-bold mt-0.5`}>
                            {idx + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="text-white text-sm font-medium leading-snug truncate">
                              {item.title}
                            </p>
                            {item.description && (
                              <p className="text-gray-400 text-xs mt-0.5 leading-relaxed">
                                {item.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* データがない場合 */}
                    {category.items.length === 0 && (
                      <p className="text-gray-500 text-sm text-center py-4">
                        データを取得中...
                      </p>
                    )}
                  </div>

                  {/* 台本生成ボタン */}
                  <button
                    onClick={() => {
                      const firstItem = category.items[0];
                      handleGenerateScript(category.name, firstItem?.title ?? '');
                    }}
                    className={`flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-lg border ${style.border} ${style.bg} ${style.text} text-sm font-medium hover:opacity-80 transition-opacity`}
                  >
                    <ExternalLink size={14} />
                    この話題で台本を生成
                  </button>
                </div>
              );
            })}
      </div>

      {/* フッターメモ */}
      {!loading && sortedCategories.length === 0 && !error && (
        <div className="text-center py-16 text-gray-500">
          <TrendingUp size={48} className="mx-auto mb-4 opacity-30" />
          <p>トレンドデータを取得できませんでした。</p>
          <button
            onClick={fetchTrending}
            className="mt-4 text-blue-400 hover:text-blue-300 text-sm underline"
          >
            再取得する
          </button>
        </div>
      )}

      {!loading && sortedCategories.length > 0 && (
        <p className="text-center text-xs text-gray-600 mt-8">
          データはAIによるWeb検索で生成されます。内容は参考情報です。
        </p>
      )}
    </div>
  );
}
