'use client';

import { Topic, FilterOptions } from '@/types';
import { Zap, MessageSquare, Star } from 'lucide-react';
import { ArrowLeftIcon, ExternalLinkIcon, ClockIcon } from '@/components/icons';

interface TopicDetailHeaderProps {
  topic: Topic;
  filters: FilterOptions;
  currentDuration: 15 | 60 | 180;
  isFavorite: boolean;
  ngWords: string[];
  onBack: () => void;
  onToggleFavorite: () => void;
}

// テキストをクリーンアップする関数（タイトル・要約共用）
function cleanDisplayText(text: string): string {
  return text
    .replace(/^\[(.+)\]$/, '$1')
    .replace(/^-?\s*\*{0,2}カテゴリ\*{0,2}\s*[:：]\s*[^-\n]*[-–]?\s*/gi, '')
    .replace(/^-?\s*\*{0,2}要約\*{0,2}\s*[:：]\s*/gi, '')
    .replace(/[-–]\s*\*{0,2}配信適性\*{0,2}\s*[:：].*/gi, '')
    .replace(/\(\[([^\]]+)\]\([^)]+\)\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1')
    .replace(/\(https?:\/\/[^)]+\)/g, '')
    .replace(/\(\s*\)/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/^[\s\-–]+|[\s\-–]+$/g, '')
    .trim();
}

/** トピック情報カード（タイトル・カテゴリバッジ・NGワード警告・戻るボタン） */
export default function TopicDetailHeader({
  topic,
  filters,
  currentDuration,
  isFavorite,
  ngWords,
  onBack,
  onToggleFavorite,
}: TopicDetailHeaderProps) {
  return (
    <>
      {/* 戻るボタン */}
      <div className="flex items-center mb-8">
        <button
          onClick={onBack}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onBack();
            }
          }}
          aria-label="トピック一覧に戻る"
          className="flex items-center space-x-2 text-gray-400 hover:text-white focus:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 rounded px-2 py-1 transition-colors duration-200"
        >
          <ArrowLeftIcon size={20} />
          <span>トピック一覧に戻る</span>
        </button>
      </div>

      {/* トピック情報カード（グラデーションボーダー） */}
      <div
        className="relative rounded-xl p-6 mb-8 overflow-hidden"
        style={{
          background: 'rgba(17,24,39,0.8)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
        }}
      >
        {/* グラデーションボーダートップライン */}
        <div
          className="absolute top-0 left-0 right-0 h-0.5"
          style={{ background: 'linear-gradient(90deg, #3b82f6, #8b5cf6, #ec4899)' }}
        />

        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
              topic.category === 'ニュース' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' :
              topic.category === 'エンタメ' ? 'bg-pink-500/20 text-pink-300 border border-pink-500/30' :
              topic.category === 'SNS' ? 'bg-green-500/20 text-green-300 border border-green-500/30' :
              topic.category === 'TikTok' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' :
              'bg-red-500/20 text-red-300 border border-red-500/30'
            }`}>
              {topic.category}
            </span>
            <div className="flex items-center space-x-4 text-sm text-gray-400">
              <div className="flex items-center space-x-1">
                <ClockIcon size={16} />
                <span>{currentDuration === 15 ? '15秒' : currentDuration === 60 ? '1分' : '3分'}</span>
              </div>
              <div className="flex items-center space-x-1">
                <Zap size={16} />
                <span>テンション: {filters.tension === 'low' ? '低' : filters.tension === 'medium' ? '中' : '高'}</span>
              </div>
              <div className="flex items-center space-x-1">
                <MessageSquare size={16} />
                <span>{filters.tone}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* お気に入りボタン */}
            <button
              onClick={onToggleFavorite}
              aria-label={isFavorite ? 'お気に入りから削除' : 'お気に入りに追加'}
              className={`p-2 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-yellow-400/50 ${
                isFavorite
                  ? 'text-yellow-400 bg-yellow-400/10 hover:bg-yellow-400/20'
                  : 'text-gray-400 hover:text-yellow-400 hover:bg-yellow-400/10'
              }`}
              style={isFavorite ? { filter: 'drop-shadow(0 0 6px rgba(251,191,36,0.5))' } : {}}
            >
              <Star size={20} className={isFavorite ? 'fill-current' : ''} />
            </button>

            {/* 外部リンクボタン */}
            <button
              onClick={() => window.open(topic.sourceUrl, '_blank', 'noopener,noreferrer')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  window.open(topic.sourceUrl, '_blank', 'noopener,noreferrer');
                }
              }}
              aria-label="外部リンクで元記事を開く"
              className="p-2 rounded-lg text-gray-400 hover:text-white focus:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-colors duration-200"
            >
              <ExternalLinkIcon size={20} />
            </button>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-white mb-4">{cleanDisplayText(topic.title)}</h1>
        <p className="text-gray-300 leading-relaxed mb-4">{cleanDisplayText(topic.summary)}</p>

        {/* NGワード警告 */}
        {ngWords.length > 0 && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
            <div className="text-sm text-red-300">
              NGワード検出: {ngWords.join(', ')}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
