'use client';

import { useEffect, useState } from 'react';
import { storage } from '@/lib/storage';
import { BarChart3, TrendingUp, Star, Zap, Calendar, RefreshCcw } from 'lucide-react';

// カテゴリの表示色マップ
const CATEGORY_COLORS: Record<string, string> = {
  'ニュース':    'from-blue-500 to-blue-600',
  'エンタメ':    'from-pink-500 to-pink-600',
  'SNS':         'from-green-500 to-green-600',
  'TikTok':      'from-purple-500 to-purple-600',
  '海外おもしろ': 'from-orange-500 to-orange-600',
  '事件事故':    'from-red-500 to-red-600',
};

// 曜日ラベル（日曜=0）
const DAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

// 過去7日間の日付配列を生成
function getLast7Days(): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split('T')[0];
  });
}

// 連続使用日数を計算
function calcStreakDays(daily: Record<string, { count: number }>): number {
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 30; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    if (daily[key] && daily[key].count > 0) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

export default function AnalyticsPage() {
  // ページロード時に必ずクライアントサイドで読み込む
  const [stats, setStats] = useState<ReturnType<typeof storage.getUsageStats> | null>(null);
  const [avgRating, setAvgRating] = useState<number>(0);
  const [styleProfile, setStyleProfile] = useState<string>('');
  const [styleEdits, setStyleEdits] = useState<ReturnType<typeof storage.getStyleEdits>>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    refresh();
  }, []);

  const refresh = () => {
    setStats(storage.getUsageStats());
    setAvgRating(storage.getAverageRating());
    setStyleProfile(storage.getStyleProfile());
    setStyleEdits(storage.getStyleEdits());
  };

  // SSR 安全対策
  if (!mounted || !stats) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4">
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-gray-700 rounded w-48"></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-700 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const last7Days = getLast7Days();
  const maxDailyCount = Math.max(
    ...last7Days.map(d => stats.daily[d]?.count || 0),
    1 // ゼロ除算防止
  );

  // キャッシュヒット率を計算
  const totalRequests = Object.values(stats.daily).reduce((a, b) => a + b.count, 0);
  const totalCached = Object.values(stats.daily).reduce((a, b) => a + b.cached, 0);
  const cacheRate = totalRequests > 0 ? Math.round((totalCached / totalRequests) * 100) : 0;

  // 連続使用日数
  const streakDays = calcStreakDays(stats.daily);

  // カテゴリ合計集計
  const categoryTotals: Record<string, number> = {};
  Object.values(stats.daily).forEach(day => {
    Object.entries(day.categories).forEach(([cat, cnt]) => {
      categoryTotals[cat] = (categoryTotals[cat] || 0) + cnt;
    });
  });
  const totalCategoryCount = Object.values(categoryTotals).reduce((a, b) => a + b, 0);
  const sortedCategories = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);

  // スタイルプロファイルのパターン行を分解（表示用）
  const profileLines = styleProfile
    ? styleProfile
        .replace('【ユーザースタイル】', '')
        .split('\n')
        .filter(Boolean)
    : [];

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-8">
      {/* ページヘッダー */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-r from-blue-500 to-purple-500 p-2 rounded-lg">
            <BarChart3 size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">利用分析</h1>
            <p className="text-sm text-gray-400">スタイル学習・使用状況ダッシュボード</p>
          </div>
        </div>
        <button
          onClick={refresh}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors px-3 py-2 rounded-lg hover:bg-gray-800 text-sm"
        >
          <RefreshCcw size={16} />
          更新
        </button>
      </div>

      {/* サマリーカード 4枚 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* 総生成数 */}
        <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-6 text-center">
          <div className="text-3xl font-bold text-white mb-1">{stats.totalGenerations}</div>
          <div className="text-xs text-gray-400 flex items-center justify-center gap-1">
            <Zap size={12} />
            総生成数
          </div>
        </div>

        {/* 平均評価 */}
        <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-6 text-center">
          <div className="text-3xl font-bold text-yellow-400 mb-1">
            {avgRating > 0 ? avgRating.toFixed(1) : '—'}
          </div>
          <div className="text-xs text-gray-400 flex items-center justify-center gap-1">
            <Star size={12} />
            平均評価
          </div>
        </div>

        {/* キャッシュヒット率 */}
        <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-6 text-center">
          <div className="text-3xl font-bold text-green-400 mb-1">{cacheRate}%</div>
          <div className="text-xs text-gray-400 flex items-center justify-center gap-1">
            <TrendingUp size={12} />
            キャッシュ率
          </div>
        </div>

        {/* 連続使用日数 */}
        <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-6 text-center">
          <div className="text-3xl font-bold text-purple-400 mb-1">{streakDays}</div>
          <div className="text-xs text-gray-400 flex items-center justify-center gap-1">
            <Calendar size={12} />
            連続使用日
          </div>
        </div>
      </div>

      {/* 生成回数（過去7日間）バーチャート */}
      <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-6">
        <h2 className="text-base font-semibold text-white mb-5">生成回数（過去7日間）</h2>
        <div className="space-y-3">
          {last7Days.map((date) => {
            const count = stats.daily[date]?.count || 0;
            const widthPct = Math.round((count / maxDailyCount) * 100);
            const dayLabel = DAY_LABELS[new Date(date + 'T00:00:00').getDay()];
            const isToday = date === new Date().toISOString().split('T')[0];

            return (
              <div key={date} className="flex items-center gap-3">
                {/* 曜日ラベル */}
                <div className={`w-6 text-center text-xs font-medium ${isToday ? 'text-blue-400' : 'text-gray-400'}`}>
                  {dayLabel}
                </div>

                {/* バー */}
                <div className="flex-1 bg-gray-700 rounded-full h-5 overflow-hidden">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r transition-all duration-500 ${
                      isToday ? 'from-blue-500 to-purple-500' : 'from-blue-700 to-blue-500'
                    }`}
                    style={{ width: `${Math.max(widthPct, count > 0 ? 2 : 0)}%` }}
                  />
                </div>

                {/* 件数 */}
                <div className={`w-8 text-right text-xs font-medium ${count > 0 ? 'text-white' : 'text-gray-600'}`}>
                  {count}
                </div>
              </div>
            );
          })}
        </div>
        {totalRequests === 0 && (
          <p className="text-center text-gray-500 text-sm mt-4">まだ生成履歴がありません</p>
        )}
      </div>

      {/* カテゴリ分布 */}
      <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-6">
        <h2 className="text-base font-semibold text-white mb-5">カテゴリ分布</h2>
        {sortedCategories.length > 0 ? (
          <div className="space-y-3">
            {sortedCategories.map(([category, count]) => {
              const pct = totalCategoryCount > 0 ? Math.round((count / totalCategoryCount) * 100) : 0;
              const gradient = CATEGORY_COLORS[category] || 'from-gray-500 to-gray-600';

              return (
                <div key={category} className="flex items-center gap-3">
                  {/* カテゴリ名 */}
                  <div className="w-24 text-sm text-gray-300 truncate">{category}</div>

                  {/* バー */}
                  <div className="flex-1 bg-gray-700 rounded-full h-4 overflow-hidden">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${gradient} transition-all duration-500`}
                      style={{ width: `${Math.max(pct, 2)}%` }}
                    />
                  </div>

                  {/* パーセント */}
                  <div className="w-10 text-right text-xs text-gray-400">{pct}%</div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-center text-gray-500 text-sm">カテゴリデータがありません</p>
        )}
      </div>

      {/* スタイルプロファイル */}
      <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-6">
        <h2 className="text-base font-semibold text-white mb-2">スタイルプロファイル</h2>
        <p className="text-xs text-gray-500 mb-4">
          編集履歴 {styleEdits.length} 件 — 3件以上で学習が始まります（現在
          {styleEdits.length >= 3 ? '学習中' : '待機中'}）
        </p>

        {profileLines.length > 0 ? (
          <div className="space-y-2 mb-4">
            {profileLines.map((line, i) => (
              <div key={i} className="flex items-start gap-2">
                <div className="mt-1 w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
                <span className="text-sm text-gray-300">{line}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-gray-900/40 border border-gray-600 rounded-lg p-4 text-center mb-4">
            <p className="text-gray-400 text-sm">
              台本を編集・保存すると、ここにスタイル傾向が表示されます
            </p>
          </div>
        )}

        {/* 直近の編集履歴 */}
        {styleEdits.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-gray-400 mb-3">直近の編集サンプル</h3>
            <div className="space-y-3">
              {styleEdits.slice(-5).reverse().map((edit, i) => (
                <div key={i} className="bg-gray-900/40 border border-gray-700 rounded-lg p-3 text-xs">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="px-2 py-0.5 bg-gray-700 rounded text-gray-300 font-mono">{edit.section}</span>
                    <span className="text-gray-500">{new Date(edit.timestamp).toLocaleDateString('ja-JP')}</span>
                  </div>
                  <div className="space-y-1">
                    <div className="text-red-400/80 line-through">
                      {edit.original.substring(0, 60)}{edit.original.length > 60 ? '…' : ''}
                    </div>
                    <div className="text-green-400/90">
                      {edit.edited.substring(0, 60)}{edit.edited.length > 60 ? '…' : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* フッター情報 */}
      <div className="text-center text-xs text-gray-600 pb-4">
        データはブラウザのローカルストレージに保存されています
      </div>
    </div>
  );
}
