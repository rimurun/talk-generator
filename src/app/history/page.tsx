'use client';

import { useState, useEffect } from 'react';
import { storage, GenerationHistory } from '@/lib/storage';
import { Clock, DollarSign, Zap, FileText, Trash2, Download } from 'lucide-react';

export default function HistoryPage() {
  const [history, setHistory] = useState<GenerationHistory[]>([]);
  const [filter, setFilter] = useState<'all' | 'topic' | 'script'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'cost' | 'type'>('date');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = () => {
    setLoading(true);
    const savedHistory = storage.getHistory();
    setHistory(savedHistory);
    setLoading(false);
  };

  const clearHistory = () => {
    if (confirm('生成履歴をすべて削除しますか？この操作は取り消せません。')) {
      storage.clearHistory();
      loadHistory();
    }
  };

  const exportHistory = () => {
    const data = JSON.stringify(history, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `talk-generator-history-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredAndSortedHistory = history
    .filter(item => filter === 'all' || item.type === filter)
    .sort((a, b) => {
      switch (sortBy) {
        case 'date':
          return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
        case 'cost':
          return b.cost - a.cost;
        case 'type':
          return a.type.localeCompare(b.type);
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

  const getTotalStats = () => {
    const totalRequests = history.length;
    const totalCost = history.reduce((sum, item) => sum + item.cost, 0);
    const cachedCount = history.filter(item => item.cached).length;
    const topicCount = history.filter(item => item.type === 'topic').length;
    const scriptCount = history.filter(item => item.type === 'script').length;
    
    return {
      totalRequests,
      totalCost,
      cacheRate: totalRequests > 0 ? (cachedCount / totalRequests) * 100 : 0,
      topicCount,
      scriptCount
    };
  };

  const stats = getTotalStats();

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-700 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-gray-800 rounded-lg p-4 h-24"></div>
            ))}
          </div>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-gray-800 rounded-lg p-4 h-20"></div>
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
          <Clock className="text-blue-400" size={32} />
          生成履歴
        </h1>
        <p className="text-gray-300">過去の生成リクエストとコスト統計</p>
      </header>

      {/* 統計カード */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 border border-gray-700">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="text-blue-400" size={20} />
            <span className="text-sm text-gray-300">総リクエスト数</span>
          </div>
          <div className="text-2xl font-bold text-white">{stats.totalRequests}</div>
        </div>

        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 border border-gray-700">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="text-green-400" size={20} />
            <span className="text-sm text-gray-300">総コスト</span>
          </div>
          <div className="text-2xl font-bold text-white">${stats.totalCost.toFixed(3)}</div>
        </div>

        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 border border-gray-700">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="text-yellow-400" size={20} />
            <span className="text-sm text-gray-300">キャッシュ率</span>
          </div>
          <div className="text-2xl font-bold text-white">{stats.cacheRate.toFixed(1)}%</div>
        </div>

        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 border border-gray-700">
          <div className="text-sm text-gray-300 mb-2">トピック生成</div>
          <div className="text-2xl font-bold text-blue-400">{stats.topicCount}</div>
        </div>

        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 border border-gray-700">
          <div className="text-sm text-gray-300 mb-2">台本生成</div>
          <div className="text-2xl font-bold text-green-400">{stats.scriptCount}</div>
        </div>
      </div>

      {/* フィルター・ソート */}
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700 mb-8">
        <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
          <div className="flex gap-4">
            {/* フィルター */}
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
                  {option.label}
                </button>
              ))}
            </div>

            {/* ソート */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="date">日時順</option>
              <option value="cost">コスト順</option>
              <option value="type">タイプ順</option>
            </select>
          </div>

          <div className="flex gap-2">
            <button
              onClick={exportHistory}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
            >
              <Download size={16} />
              エクスポート
            </button>
            <button
              onClick={clearHistory}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
            >
              <Trash2 size={16} />
              すべて削除
            </button>
          </div>
        </div>
      </div>

      {/* 履歴一覧 */}
      {filteredAndSortedHistory.length === 0 ? (
        <div className="text-center py-12">
          <Clock className="mx-auto text-gray-500 mb-4" size={64} />
          <h3 className="text-xl text-gray-400 mb-2">履歴がありません</h3>
          <p className="text-gray-500">トピックや台本を生成すると履歴が表示されます</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredAndSortedHistory.map(item => (
            <div
              key={item.id}
              className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700 hover:border-gray-600 transition-colors"
            >
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      item.type === 'topic' 
                        ? 'bg-blue-500/20 text-blue-300' 
                        : 'bg-green-500/20 text-green-300'
                    }`}>
                      {item.type === 'topic' ? 'トピック生成' : '台本生成'}
                    </span>
                    
                    {item.cached && (
                      <span className="px-2 py-1 rounded text-xs bg-yellow-500/20 text-yellow-300">
                        キャッシュヒット
                      </span>
                    )}
                    
                    <span className="text-sm text-gray-400">
                      {formatDate(item.timestamp)}
                    </span>
                  </div>

                  {/* リクエスト詳細 */}
                  <div className="text-sm text-gray-300 space-y-1">
                    {item.type === 'topic' && item.filters && (
                      <div>
                        フィルター: {item.filters.categories?.length > 0 
                          ? item.filters.categories.join(', ') 
                          : '全カテゴリ'}, 
                        テンション: {item.filters.tension}, 
                        口調: {item.filters.tone}
                      </div>
                    )}
                    
                    {item.type === 'script' && item.scriptSettings && (
                      <div>
                        設定: {item.scriptSettings.duration}秒, 
                        テンション: {item.scriptSettings.tension}, 
                        口調: {item.scriptSettings.tone}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-lg font-semibold text-white">
                      ${item.cost.toFixed(4)}
                    </div>
                    <div className="text-xs text-gray-400">
                      {item.cached ? '0円 (キャッシュ)' : 'API利用'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 月間コスト推定 */}
      {history.length > 0 && (
        <div className="mt-8 bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4">月間コスト推定</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-sm text-gray-300 mb-1">1日平均コスト</div>
              <div className="text-xl font-bold text-blue-400">
                ${(stats.totalCost / Math.max(1, Math.ceil(history.length / 10))).toFixed(3)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-300 mb-1">月間推定コスト</div>
              <div className="text-xl font-bold text-green-400">
                ${(stats.totalCost / Math.max(1, Math.ceil(history.length / 10)) * 30).toFixed(2)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-300 mb-1">キャッシュ節約額</div>
              <div className="text-xl font-bold text-yellow-400">
                ${((history.filter(h => h.cached).length * 0.005)).toFixed(3)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}