'use client';

import dynamic from 'next/dynamic';
import { Topic, FilterOptions } from '@/types';
import { TopicListSkeleton } from '@/components/TopicCardSkeleton';
import { Sparkles, CheckCircle2 } from 'lucide-react';

// 動的インポート（First Load JS削減）
const TopicList = dynamic(() => import('@/components/TopicList'), {
  loading: () => <TopicListSkeleton />
});

interface TopicListSectionProps {
  topics: Topic[];
  loading: boolean;
  filters: FilterOptions;
  batchMode: boolean;
  /** 結果エリアへのref（生成完了後の自動スクロール用） */
  resultsRef: React.RefObject<HTMLDivElement | null>;
  onTopicSelect: () => void;
  onBackToList: () => void;
}

/** トピック一覧表示エリア（スケルトン・バッチ統計含む） */
export default function TopicListSection({
  topics,
  loading,
  filters,
  batchMode,
  resultsRef,
  onTopicSelect,
  onBackToList,
}: TopicListSectionProps) {
  return (
    <>
      {/* ローディング中のスケルトンUI */}
      {loading && (
        <div className="animate-fade-in">
          <TopicListSkeleton />
        </div>
      )}

      {/* トピック一覧（結果セクション） */}
      <div ref={resultsRef}>
        {topics.length > 0 && !loading && (
          <TopicList
            topics={topics}
            filters={filters}
            onTopicSelect={onTopicSelect}
            onBackToList={onBackToList}
          />
        )}
      </div>

      {/* バッチ生成完了後の統計ベントグリッド */}
      {batchMode && topics.length > 0 && !loading && (
        <div
          className="mt-6 rounded-2xl p-6 border border-purple-500/20 animate-slide-up"
          style={{ background: 'rgba(124,58,237,0.06)' }}
        >
          <h3 className="text-sm font-semibold text-purple-300 mb-5 flex items-center gap-2 uppercase tracking-wider">
            <CheckCircle2 size={14} className="text-emerald-400" />
            バッチ生成完了
          </h3>

          {/* 統計ベントグリッド */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* 生成件数 */}
            <div className="rounded-xl p-4 glass-card-light border border-purple-500/15 text-center">
              <div
                className="text-3xl font-black mb-1"
                style={{ background: 'var(--gradient-purple-blue)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}
              >
                {topics.length}
              </div>
              <div className="text-xs text-[var(--color-text-muted)]">生成件数</div>
            </div>

            {/* カテゴリ数 */}
            <div className="rounded-xl p-4 glass-card-light border border-cyan-500/15 text-center">
              <div
                className="text-3xl font-black mb-1"
                style={{ background: 'var(--gradient-cyan-blue)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}
              >
                {new Set(topics.map(t => t.category)).size}
              </div>
              <div className="text-xs text-[var(--color-text-muted)]">カテゴリ</div>
            </div>

            {/* 低リスク件数 */}
            <div className="rounded-xl p-4 glass-card-light border border-emerald-500/15 text-center">
              <div
                className="text-3xl font-black mb-1"
                style={{ background: 'var(--gradient-emerald-cyan)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}
              >
                {topics.filter(t => t.riskLevel === 'low').length}
              </div>
              <div className="text-xs text-[var(--color-text-muted)]">低リスク</div>
            </div>

            {/* 平均文字数 */}
            <div className="rounded-xl p-4 glass-card-light border border-amber-500/15 text-center">
              <div className="text-3xl font-black mb-1 text-amber-400">
                {Math.round(topics.reduce((sum, t) => sum + t.title.length, 0) / topics.length)}
              </div>
              <div className="text-xs text-[var(--color-text-muted)]">平均文字数</div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
