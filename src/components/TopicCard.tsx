'use client';

import { useState, useEffect } from 'react';
import { Topic } from '@/types';
import { storage } from '@/lib/storage';
import { ExternalLinkIcon, StarIcon } from './icons';
import { Star, Copy, Monitor } from 'lucide-react';

interface TopicCardProps {
  topic: Topic;
  onClick: () => void;
  onTeleprompter?: () => void;
}

// 要約テキストをクリーンアップする関数
function cleanSummaryText(summary: string): string {
  return summary
    // "- カテゴリ: xxx" or "- **カテゴリ**: xxx" 部分を除去（行頭〜次の - まで）
    .replace(/^-?\s*\*{0,2}カテゴリ\*{0,2}\s*[:：]\s*[^-\n]*[-–]?\s*/gi, '')
    // "- 要約:" or "- **要約**:" のプレフィックスを除去
    .replace(/^-?\s*\*{0,2}要約\*{0,2}\s*[:：]\s*/gi, '')
    // "- 配信適性:" 以降の行を除去（カードには不要）
    .replace(/[-–]\s*\*{0,2}配信適性\*{0,2}\s*[:：].*/gi, '')
    // 括弧付きMarkdownリンク ([text](url)) を除去
    .replace(/\(\[([^\]]+)\]\([^)]+\)\)/g, '')
    // Markdownリンク [text](url) をプレーンテキストに変換
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Markdown bold **text** をプレーンテキストに
    .replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1')
    // 括弧内のURL参照 (url) を除去
    .replace(/\(https?:\/\/[^)]+\)/g, '')
    // 残った孤立した括弧ペア "()" を除去
    .replace(/\(\s*\)/g, '')
    // 連続するハイフン区切りを除去
    .replace(/\s*[-–]\s*(?=カテゴリ|要約|配信適性)/g, '')
    // 連続する改行を単一の改行に
    .replace(/\n\n+/g, '\n')
    // 先頭と末尾の空白・ハイフンを除去
    .replace(/^[\s\-–]+|[\s\-–]+$/g, '')
    .trim();
}

export default function TopicCard({ topic, onClick, onTeleprompter }: TopicCardProps) {
  const [isFavorite, setIsFavorite] = useState(false);
  const [copyMessage, setCopyMessage] = useState('');
  const [ngWords, setNgWords] = useState<string[]>([]);
  // このトピックの台本が履歴に存在するか
  const [hasScript, setHasScript] = useState(false);

  useEffect(() => {
    // お気に入り状態をチェック
    setIsFavorite(storage.isFavorite(topic.id));

    // NGワードチェック
    const detected = storage.detectNgWords(topic.title + ' ' + topic.summary);
    setNgWords(detected);

    // 台本生成済みかを履歴から確認
    const history = storage.getHistory();
    const scriptExists = history.some(
      (h) => h.type === 'script' && h.topicId === topic.id
    );
    setHasScript(scriptExists);
  }, [topic.id, topic.title, topic.summary]);

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'ニュース':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'エンタメ':
        return 'bg-pink-500/20 text-pink-300 border-pink-500/30';
      case 'SNS':
        return 'bg-green-500/20 text-green-300 border-green-500/30';
      case 'TikTok':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      case '事件事故':
        return 'bg-red-500/20 text-red-300 border-red-500/30';
      default:
        return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low':
        return 'bg-green-500/20 text-green-300 border-green-500/30';
      case 'medium':
        return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
      case 'high':
        return 'bg-red-500/20 text-red-300 border-red-500/30';
      default:
        return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
    }
  };

  const getRiskText = (risk: string) => {
    switch (risk) {
      case 'low':
        return '低';
      case 'medium':
        return '中';
      case 'high':
        return '高';
      default:
        return '不明';
    }
  };

  const renderSensitivityStars = (level: number) => {
    return Array.from({ length: 3 }, (_, i) => (
      <StarIcon
        key={i}
        size={20}
        className={`${
          i < level 
            ? 'text-yellow-400 fill-yellow-400 drop-shadow-sm' 
            : 'text-gray-600'
        }`}
      />
    ));
  };

  const toggleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (isFavorite) {
      // お気に入りから削除
      const favorites = storage.getFavorites();
      const favoriteToRemove = favorites.find(f => f.topicId === topic.id && !f.scriptId);
      if (favoriteToRemove) {
        storage.removeFavorite(favoriteToRemove.id);
      }
      setIsFavorite(false);
    } else {
      // お気に入りに追加
      storage.addFavorite({
        type: 'topic',
        topicId: topic.id,
        title: topic.title,
        category: topic.category
      });
      setIsFavorite(true);
    }
  };

  const copyTitle = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(topic.title).then(() => {
      setCopyMessage('タイトルをコピーしました');
      setTimeout(() => setCopyMessage(''), 2000);
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <div 
      onClick={onClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={`${topic.title} - ${topic.category} - 台本を表示`}
      className="bg-gray-800/60 backdrop-blur-sm border border-gray-700 rounded-xl p-6 cursor-pointer transition-all duration-300 hover:bg-gray-700/60 hover:border-gray-600 hover:transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-blue-500/50 focus:bg-gray-700/60 group relative"
    >
      {/* コピーメッセージ */}
      {copyMessage && (
        <div className="absolute top-2 right-2 bg-green-600 text-white text-xs px-2 py-1 rounded z-10">
          {copyMessage}
        </div>
      )}

      {/* ヘッダー */}
      <div className="flex items-start justify-between mb-4">
        <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getCategoryColor(topic.category)}`}>
          {topic.category}
        </span>
        
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          {/* テレプロンプターボタン（台本生成済みのときのみ表示） */}
          {hasScript && onTeleprompter && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTeleprompter();
              }}
              aria-label="テレプロンプターで表示"
              title="テレプロンプターで表示"
              className="p-1 rounded text-cyan-400 hover:text-cyan-300 hover:bg-cyan-400/10 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            >
              <Monitor size={16} />
            </button>
          )}

          {/* お気に入りボタン */}
          <button
            onClick={toggleFavorite}
            aria-label={isFavorite ? 'お気に入りから削除' : 'お気に入りに追加'}
            className={`p-1 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${
              isFavorite
                ? 'text-yellow-400 hover:text-yellow-300'
                : 'text-gray-400 hover:text-yellow-400'
            }`}
          >
            <Star size={18} className={isFavorite ? 'fill-current' : ''} />
          </button>

          {/* コピーボタン */}
          <button
            onClick={copyTitle}
            aria-label="タイトルをコピー"
            className="p-1 rounded text-gray-400 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          >
            <Copy size={16} />
          </button>

          {/* 外部リンクボタン */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              window.open(topic.sourceUrl, '_blank', 'noopener,noreferrer');
            }}
            aria-label="外部リンクで元記事を開く"
            className="p-1 rounded text-gray-400 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          >
            <ExternalLinkIcon size={16} />
          </button>
        </div>
      </div>

      {/* NGワード警告 */}
      {ngWords.length > 0 && (
        <div className="mb-3 bg-red-500/10 border border-red-500/30 rounded-lg p-2">
          <div className="flex items-center justify-between">
            <div className="text-xs text-red-300">
              ⚠️ NGワード検出: {ngWords.join(', ')}
            </div>
            <div className="text-xs text-red-400 bg-red-500/20 px-2 py-1 rounded">
              {ngWords.length}件
            </div>
          </div>
          <div className="text-xs text-gray-400 mt-1">
            配信前に内容確認をお勧めします
          </div>
        </div>
      )}

      {/* タイトル */}
      <h3 className="text-lg font-semibold text-white mb-3 line-clamp-2 leading-tight">
        {topic.title.replace(/^\[(.+)\]$/, '$1')}
      </h3>

      {/* 3行要約 */}
      <p className="text-gray-300 text-sm mb-4 line-clamp-3 leading-relaxed">
        {cleanSummaryText(topic.summary)}
      </p>

      {/* メトリクス */}
      <div className="space-y-3">
        {/* センシティブ度 */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">センシティブ度</span>
          <div className="flex items-center space-x-1">
            {renderSensitivityStars(topic.sensitivityLevel)}
          </div>
        </div>

        {/* 炎上リスク */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">炎上リスク</span>
          <span className={`px-2 py-1 rounded text-xs font-medium border ${getRiskColor(topic.riskLevel)}`}>
            {getRiskText(topic.riskLevel)}
          </span>
        </div>
      </div>

      {/* フッター */}
      <div className="mt-4 pt-3 border-t border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {topic.publishedAt ? (
              <span className="text-xs text-gray-400">
                {topic.publishedAt}
              </span>
            ) : (
              <span className="text-xs text-gray-500">
                {new Date(topic.createdAt).toLocaleDateString('ja-JP', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
            )}
            {isFavorite && (
              <span className="text-xs text-yellow-400">★</span>
            )}
          </div>
          <span className="text-xs text-blue-400 group-hover:text-blue-300 font-medium">
            台本を表示 →
          </span>
        </div>
      </div>
    </div>
  );
}