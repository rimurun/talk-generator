'use client';

import { useState, useEffect } from 'react';
import { storage, FavoriteItem } from '@/lib/storage';
import { Star, Copy, Trash2, ExternalLink } from 'lucide-react';

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [filter, setFilter] = useState<'all' | 'topic' | 'script'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'title'>('newest');
  const [loading, setLoading] = useState(true);
  const [copyMessage, setCopyMessage] = useState('');

  useEffect(() => {
    loadFavorites();
  }, []);

  const loadFavorites = () => {
    setLoading(true);
    const savedFavorites = storage.getFavorites();
    setFavorites(savedFavorites);
    setLoading(false);
  };

  const removeFavorite = (id: string) => {
    storage.removeFavorite(id);
    loadFavorites();
  };

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopyMessage(`${type}をクリップボードにコピーしました`);
      setTimeout(() => setCopyMessage(''), 3000);
    });
  };

  const filteredAndSortedFavorites = favorites
    .filter(item => {
      // タイプフィルター
      if (filter !== 'all' && item.type !== filter) return false;
      
      // 検索フィルター
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return item.title.toLowerCase().includes(query) ||
               (item.category && item.category.toLowerCase().includes(query)) ||
               (item.notes && item.notes.toLowerCase().includes(query));
      }
      
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
        case 'oldest':
          return new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime();
        case 'title':
          return a.title.localeCompare(b.title, 'ja');
        default:
          return 0;
      }
    });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'ニュース': return 'bg-blue-500/20 text-blue-300';
      case 'エンタメ': return 'bg-pink-500/20 text-pink-300';
      case 'SNS': return 'bg-green-500/20 text-green-300';
      case 'TikTok': return 'bg-purple-500/20 text-purple-300';
      case '事件事故': return 'bg-red-500/20 text-red-300';
      default: return 'bg-gray-500/20 text-gray-300';
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-700 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="bg-gray-800 rounded-lg p-4 space-y-3">
                <div className="h-4 bg-gray-700 rounded w-3/4"></div>
                <div className="h-3 bg-gray-700 rounded w-1/2"></div>
                <div className="h-20 bg-gray-700 rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-2">
          <Star className="text-yellow-400" size={32} />
          お気に入り
        </h1>
        <p className="text-gray-300">保存したトピックと台本の一覧</p>
      </header>

      {copyMessage && (
        <div className="bg-green-500/20 border border-green-500 text-green-200 px-4 py-3 rounded-lg mb-6">
          {copyMessage}
        </div>
      )}

      {/* フィルター */}
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700 mb-8">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* タイプフィルター */}
          <div className="flex gap-2">
            {[
              { value: 'all', label: 'すべて' },
              { value: 'topic', label: 'トピック' },
              { value: 'script', label: '台本' }
            ].map(option => (
              <button
                key={option.value}
                onClick={() => setFilter(option.value as any)}
                className={`px-4 py-2 rounded-lg border transition-colors ${
                  filter === option.value
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {option.label} ({favorites.filter(f => option.value === 'all' || f.type === option.value).length})
              </button>
            ))}
          </div>

          {/* 検索 */}
          <div className="flex-1 lg:max-w-md">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="タイトル、カテゴリ、メモで検索..."
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* ソート */}
          <div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="newest">新しい順</option>
              <option value="oldest">古い順</option>
              <option value="title">タイトル順</option>
            </select>
          </div>
        </div>
      </div>

      {/* お気に入り一覧 */}
      {filteredAndSortedFavorites.length === 0 ? (
        <div className="text-center py-12">
          <Star className="mx-auto text-gray-500 mb-4" size={64} />
          <h3 className="text-xl text-gray-400 mb-2">
            {searchQuery ? '検索結果がありません' : 'まだお気に入りがありません'}
          </h3>
          <p className="text-gray-500">
            {searchQuery ? '別のキーワードで検索してみてください' : 'トピックや台本を★マークでお気に入りに追加できます'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAndSortedFavorites.map(item => (
            <div
              key={item.id}
              className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700 hover:border-gray-600 transition-colors"
            >
              {/* ヘッダー */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    item.type === 'topic' ? 'bg-blue-500/20 text-blue-300' : 'bg-green-500/20 text-green-300'
                  }`}>
                    {item.type === 'topic' ? 'トピック' : '台本'}
                  </span>
                  {item.category && (
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getCategoryColor(item.category)}`}>
                      {item.category}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => removeFavorite(item.id)}
                  className="text-gray-400 hover:text-red-400 transition-colors p-1"
                  title="お気に入りから削除"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              {/* タイトル */}
              <h3 className="text-white font-semibold mb-2 line-clamp-2">
                {item.title}
              </h3>

              {/* メモ */}
              {item.notes && (
                <p className="text-gray-300 text-sm mb-3 line-clamp-2">
                  {item.notes}
                </p>
              )}

              {/* フッター */}
              <div className="flex items-center justify-between pt-3 border-t border-gray-700">
                <span className="text-xs text-gray-400">
                  {formatDate(item.addedAt)}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => copyToClipboard(item.title, 'タイトル')}
                    className="text-gray-400 hover:text-white transition-colors p-1"
                    title="タイトルをコピー"
                  >
                    <Copy size={16} />
                  </button>
                  <button
                    onClick={() => window.open(`/?topic=${item.topicId}`, '_blank')}
                    className="text-gray-400 hover:text-white transition-colors p-1"
                    title="元のページを開く"
                  >
                    <ExternalLink size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 統計情報 */}
      <div className="mt-8 bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-4">お気に入り統計</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-400">
              {favorites.filter(f => f.type === 'topic').length}
            </div>
            <div className="text-sm text-gray-400">トピック</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-400">
              {favorites.filter(f => f.type === 'script').length}
            </div>
            <div className="text-sm text-gray-400">台本</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-400">
              {new Set(favorites.map(f => f.category)).size}
            </div>
            <div className="text-sm text-gray-400">カテゴリ</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-400">
              {favorites.length}
            </div>
            <div className="text-sm text-gray-400">合計</div>
          </div>
        </div>
      </div>
    </div>
  );
}