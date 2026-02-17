'use client';

import { useState, useEffect } from 'react';
import { storage, UserProfile } from '@/lib/storage';
import { tonePresets } from '@/lib/mock-data';

export default function SettingsPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [newNgWord, setNewNgWord] = useState('');
  const [newSpecialty, setNewSpecialty] = useState('');
  const [usage, setUsage] = useState<any>(null);
  const [cacheStats, setCacheStats] = useState<any>(null);
  const [ratingsStats, setRatingsStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // プロファイル読み込み
      const savedProfile = storage.getProfile();
      if (savedProfile) {
        setProfile(savedProfile);
      } else {
        // デフォルトプロファイル作成
        const defaultProfile: UserProfile = {
          channelName: '',
          specialties: [],
          ngWords: ['死ね', '殺す', 'クズ', 'ゴミ'],
          dailyLimit: 50,
          preferredTone: 'フレンドリー',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        setProfile(defaultProfile);
        storage.setProfile(defaultProfile);
      }

      // API使用量読み込み（履歴ベース計算に統一）
      const usageRes = await fetch('/api/usage');
      if (usageRes.ok) {
        const usageData = await usageRes.json();
        
        // 履歴データから実績ベースの月間コスト計算
        const history = storage.getHistory();
        const totalCost = history.reduce((sum, item) => sum + item.cost, 0);
        const avgDailyCost = totalCost / Math.max(1, Math.ceil(history.length / 10));
        const estimatedCostMonthly = avgDailyCost * 30;
        
        // 計算結果を統一
        setUsage({
          ...usageData,
          estimatedCostMonthly: estimatedCostMonthly,
          actualHistoryBased: true
        });
      }

      // キャッシュ統計読み込み
      const cacheRes = await fetch('/api/cache');
      if (cacheRes.ok) {
        const cacheData = await cacheRes.json();
        setCacheStats(cacheData);
      }

      // 台本評価統計計算
      const ratings = storage.getRatings();
      if (ratings.length > 0) {
        const avgRating = ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;
        const categoryStats = ratings.reduce((stats: any, r) => {
          // 実際の実装では、topicIdからカテゴリを取得する必要がある
          // ここではサンプル実装
          const category = 'ニュース'; // 実際はAPIまたはキャッシュから取得
          stats[category] = stats[category] || { total: 0, sum: 0, count: 0 };
          stats[category].sum += r.rating;
          stats[category].count += 1;
          stats[category].total = stats[category].sum / stats[category].count;
          return stats;
        }, {});
        
        const ratingDistribution = [1, 2, 3, 4, 5].map(rating => ({
          rating,
          count: ratings.filter(r => r.rating === rating).length
        }));

        setRatingsStats({
          totalRatings: ratings.length,
          averageRating: avgRating,
          categoryStats,
          ratingDistribution,
          highRatedCount: ratings.filter(r => r.rating >= 4).length
        });
      }

    } catch (error) {
      console.error('データ読み込みエラー:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveProfile = async () => {
    if (!profile) return;
    
    try {
      setSaving(true);
      storage.setProfile(profile);
      setMessage('設定を保存しました');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('プロファイル保存エラー:', error);
      setMessage('保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const addNgWord = () => {
    if (!profile || !newNgWord.trim()) return;
    
    const word = newNgWord.trim();
    if (!profile.ngWords.includes(word)) {
      setProfile({
        ...profile,
        ngWords: [...profile.ngWords, word]
      });
      setNewNgWord('');
    }
  };

  const removeNgWord = (word: string) => {
    if (!profile) return;
    
    setProfile({
      ...profile,
      ngWords: profile.ngWords.filter(w => w !== word)
    });
  };

  const addSpecialty = () => {
    if (!profile || !newSpecialty.trim()) return;
    
    const specialty = newSpecialty.trim();
    if (!profile.specialties.includes(specialty)) {
      setProfile({
        ...profile,
        specialties: [...profile.specialties, specialty]
      });
      setNewSpecialty('');
    }
  };

  const removeSpecialty = (specialty: string) => {
    if (!profile) return;
    
    setProfile({
      ...profile,
      specialties: profile.specialties.filter(s => s !== specialty)
    });
  };

  const clearCache = async () => {
    try {
      const response = await fetch('/api/cache', { method: 'DELETE' });
      if (response.ok) {
        setMessage('キャッシュをクリアしました');
        loadData(); // データ再読み込み
      } else {
        setMessage('キャッシュクリアに失敗しました');
      }
    } catch (error) {
      console.error('キャッシュクリアエラー:', error);
      setMessage('キャッシュクリアに失敗しました');
    }
  };

  const exportData = () => {
    const data = storage.exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `talk-generator-settings-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMessage('設定をエクスポートしました');
  };

  const importData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const jsonData = e.target?.result as string;
        storage.importData(jsonData);
        loadData();
        setMessage('設定をインポートしました');
      } catch (error) {
        console.error('インポートエラー:', error);
        setMessage('インポートに失敗しました');
      }
    };
    reader.readAsText(file);
    event.target.value = ''; // ファイル選択をリセット
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="animate-pulse space-y-8">
          <div className="h-8 bg-gray-700 rounded w-1/3"></div>
          <div className="space-y-4">
            <div className="h-4 bg-gray-700 rounded w-1/4"></div>
            <div className="h-10 bg-gray-700 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">設定</h1>
        <p className="text-gray-300">プロファイル、NGワード、API使用量などを管理</p>
      </header>

      {message && (
        <div className="bg-blue-500/20 border border-blue-500 text-blue-200 px-4 py-3 rounded-lg mb-6">
          {message}
        </div>
      )}

      <div className="space-y-8">
        {/* プロファイル設定 */}
        <section className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
          <h2 className="text-xl font-semibold text-white mb-4">配信者プロファイル</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-200 mb-2">
                チャンネル名
              </label>
              <input
                type="text"
                value={profile.channelName}
                onChange={(e) => setProfile({ ...profile, channelName: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="あなたのチャンネル名"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-200 mb-2">
                デフォルト口調
              </label>
              <select
                value={profile.preferredTone}
                onChange={(e) => setProfile({ ...profile, preferredTone: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {tonePresets.map(tone => (
                  <option key={tone} value={tone}>{tone}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 得意ジャンル */}
          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-200 mb-2">
              得意ジャンル
            </label>
            <div className="flex flex-wrap gap-2 mb-3">
              {profile.specialties.map(specialty => (
                <span
                  key={specialty}
                  className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm flex items-center gap-2"
                >
                  {specialty}
                  <button
                    onClick={() => removeSpecialty(specialty)}
                    className="hover:bg-blue-700 rounded-full w-4 h-4 flex items-center justify-center text-xs"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newSpecialty}
                onChange={(e) => setNewSpecialty(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addSpecialty()}
                className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="得意ジャンルを追加"
              />
              <button
                onClick={addSpecialty}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                追加
              </button>
            </div>
          </div>

          {/* 1日の上限設定 */}
          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-200 mb-2">
              1日の生成上限回数
            </label>
            <input
              type="number"
              min="1"
              max="200"
              value={profile.dailyLimit}
              onChange={(e) => setProfile({ ...profile, dailyLimit: parseInt(e.target.value) || 50 })}
              className="w-32 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-sm text-gray-400 mt-1">推奨: 20-50回</p>
          </div>

          <div className="mt-6">
            <button
              onClick={saveProfile}
              disabled={saving}
              className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-6 py-2 rounded-lg transition-colors"
            >
              {saving ? '保存中...' : 'プロファイル保存'}
            </button>
          </div>
        </section>

        {/* NGワード管理 */}
        <section className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
          <h2 className="text-xl font-semibold text-white mb-4">NGワード管理</h2>
          
          <div className="flex flex-wrap gap-2 mb-4">
            {profile.ngWords.map(word => (
              <span
                key={word}
                className="bg-red-600 text-white px-3 py-1 rounded-full text-sm flex items-center gap-2"
              >
                {word}
                <button
                  onClick={() => removeNgWord(word)}
                  className="hover:bg-red-700 rounded-full w-4 h-4 flex items-center justify-center text-xs"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          
          <div className="flex gap-2">
            <input
              type="text"
              value={newNgWord}
              onChange={(e) => setNewNgWord(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addNgWord()}
              className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="NGワードを追加"
            />
            <button
              onClick={addNgWord}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              追加
            </button>
          </div>
          
          <p className="text-sm text-gray-400 mt-2">
            台本生成時に自動的に除外・警告表示されます
          </p>
        </section>

        {/* API使用量 */}
        {usage && (
          <section className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
            <h2 className="text-xl font-semibold text-white mb-4">API使用量</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <div className="bg-gray-700/50 rounded-lg p-4">
                <div className="text-sm text-gray-300">トークン使用量</div>
                <div className="text-xl font-bold text-white">
                  {usage.tokensUsed.toLocaleString()}/{usage.tokensLimit.toLocaleString()}
                </div>
                <div className="text-xs text-gray-400">{usage.tokensPercentage}%</div>
              </div>
              
              <div className="bg-gray-700/50 rounded-lg p-4">
                <div className="text-sm text-gray-300">リクエスト数</div>
                <div className="text-xl font-bold text-white">
                  {usage.requestsUsed}/{usage.requestsLimit}
                </div>
                <div className="text-xs text-gray-400">{usage.requestsPercentage}%</div>
              </div>
              
              <div className="bg-gray-700/50 rounded-lg p-4">
                <div className="text-sm text-gray-300">今日のコスト</div>
                <div className="text-xl font-bold text-white">
                  ${usage.estimatedCostToday.toFixed(3)}
                </div>
              </div>
              
              <div className="bg-gray-700/50 rounded-lg p-4">
                <div className="text-sm text-gray-300">月間推定コスト</div>
                <div className="text-xl font-bold text-white">
                  ${usage.estimatedCostMonthly.toFixed(2)}
                </div>
              </div>
            </div>

            {usage.alerts.message && (
              <div className={`p-3 rounded-lg mb-4 ${
                usage.alerts.veryHighUsage ? 'bg-red-500/20 border border-red-500 text-red-200' :
                usage.alerts.highUsage ? 'bg-yellow-500/20 border border-yellow-500 text-yellow-200' :
                'bg-blue-500/20 border border-blue-500 text-blue-200'
              }`}>
                {usage.alerts.message}
              </div>
            )}
          </section>
        )}

        {/* 台本評価統計 */}
        {ratingsStats && (
          <section className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
            <h2 className="text-xl font-semibold text-white mb-4">台本評価システム統計</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="bg-gray-700/50 rounded-lg p-4">
                <div className="text-sm text-gray-300">評価件数</div>
                <div className="text-xl font-bold text-white">
                  {ratingsStats.totalRatings}件
                </div>
              </div>
              
              <div className="bg-gray-700/50 rounded-lg p-4">
                <div className="text-sm text-gray-300">平均スコア</div>
                <div className="text-xl font-bold text-yellow-400">
                  {ratingsStats.averageRating.toFixed(1)}/5.0
                </div>
              </div>
              
              <div className="bg-gray-700/50 rounded-lg p-4">
                <div className="text-sm text-gray-300">高評価台本</div>
                <div className="text-xl font-bold text-green-400">
                  {ratingsStats.highRatedCount}件
                </div>
                <div className="text-xs text-gray-400">4つ星以上</div>
              </div>
              
              <div className="bg-gray-700/50 rounded-lg p-4">
                <div className="text-sm text-gray-300">評価率</div>
                <div className="text-xl font-bold text-blue-400">
                  {((ratingsStats.totalRatings / (storage.getHistory().length || 1)) * 100).toFixed(0)}%
                </div>
                <div className="text-xs text-gray-400">生成台本中</div>
              </div>
            </div>

            {/* 評価分布 */}
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-gray-300 mb-3">評価分布</h3>
              <div className="space-y-2">
                {ratingsStats.ratingDistribution.map((item: any) => (
                  <div key={item.rating} className="flex items-center gap-3">
                    <div className="w-8 text-sm text-gray-300">{item.rating}★</div>
                    <div className="flex-1 bg-gray-700 rounded-full h-2 overflow-hidden">
                      <div 
                        className="bg-gradient-to-r from-yellow-400 to-orange-400 h-full transition-all duration-300"
                        style={{ 
                          width: `${(item.count / ratingsStats.totalRatings) * 100}%`
                        }}
                      ></div>
                    </div>
                    <div className="w-8 text-sm text-gray-400">{item.count}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* 高評価台本の傾向 */}
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-green-300 mb-2">💡 高評価台本の傾向</h3>
              <div className="text-sm text-gray-300 space-y-1">
                <div>• 平均スコア: <span className="text-green-400">{ratingsStats.averageRating.toFixed(1)}/5.0</span></div>
                <div>• 高評価率: <span className="text-green-400">{((ratingsStats.highRatedCount / ratingsStats.totalRatings) * 100).toFixed(0)}%</span></div>
                {Object.keys(ratingsStats.categoryStats).length > 0 && (
                  <div>• 最高評価カテゴリ: <span className="text-green-400">
                    {Object.entries(ratingsStats.categoryStats)
                      .sort(([,a]: any, [,b]: any) => b.total - a.total)[0][0]}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* キャッシュ統計 */}
        {cacheStats && (
          <section className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
            <h2 className="text-xl font-semibold text-white mb-4">キャッシュ統計</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="bg-gray-700/50 rounded-lg p-4">
                <div className="text-sm text-gray-300">キャッシュヒット率</div>
                <div className="text-xl font-bold text-white">
                  {(() => {
                    // 履歴データから実際のキャッシュヒット率を計算
                    const history = storage.getHistory();
                    const totalRequests = history.length;
                    const cachedRequests = history.filter(h => h.cached).length;
                    const hitRate = totalRequests > 0 ? (cachedRequests / totalRequests) * 100 : 0;
                    return hitRate.toFixed(1);
                  })()}%
                </div>
              </div>
              
              <div className="bg-gray-700/50 rounded-lg p-4">
                <div className="text-sm text-gray-300">トピックキャッシュ</div>
                <div className="text-xl font-bold text-white">
                  {(() => {
                    // メモリ内キャッシュ件数を正確に計算
                    const history = storage.getHistory();
                    const topicCacheCount = history.filter(h => h.type === 'topic' && h.cached).length;
                    return Math.max(topicCacheCount, cacheStats?.cache?.topicEntries || 0);
                  })()}件
                </div>
              </div>
              
              <div className="bg-gray-700/50 rounded-lg p-4">
                <div className="text-sm text-gray-300">台本キャッシュ</div>
                <div className="text-xl font-bold text-white">
                  {(() => {
                    // メモリ内キャッシュ件数を正確に計算
                    const history = storage.getHistory();
                    const scriptCacheCount = history.filter(h => h.type === 'script' && h.cached).length;
                    return Math.max(scriptCacheCount, cacheStats?.cache?.scriptEntries || 0);
                  })()}件
                </div>
              </div>
            </div>
            
            <button
              onClick={clearCache}
              className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              キャッシュクリア
            </button>
          </section>
        )}

        {/* データ管理 */}
        <section className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
          <h2 className="text-xl font-semibold text-white mb-4">データ管理</h2>
          
          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={exportData}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              設定をエクスポート
            </button>
            
            <label className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors cursor-pointer flex items-center justify-center">
              <span>設定をインポート</span>
              <input
                type="file"
                accept=".json"
                onChange={importData}
                className="hidden"
              />
            </label>
            
            <button
              onClick={() => {
                if (confirm('全ての設定データを削除しますか？この操作は取り消せません。')) {
                  storage.clearAllData();
                  loadData();
                  setMessage('全データをクリアしました');
                }
              }}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              全データクリア
            </button>
          </div>
          
          <p className="text-sm text-gray-400 mt-2">
            設定は自動的にブラウザに保存されます
          </p>
        </section>
      </div>
    </div>
  );
}