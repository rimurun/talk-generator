'use client';

import { useState, useEffect } from 'react';
import { Topic, Script, FilterOptions, GenerateScriptResponse } from '@/types';
import { durationOptions } from '@/lib/mock-data';
import { storage } from '@/lib/storage';
import { Zap, MessageSquare, Star, Heart } from 'lucide-react';
import { ArrowLeftIcon, CopyIcon, RefreshIcon, ExternalLinkIcon, ClockIcon } from './icons';
import dynamic from 'next/dynamic';

const LoadingSpinner = dynamic(() => import('./LoadingSpinner'), {
  loading: () => <div className="animate-pulse bg-gray-700 h-8 w-8 rounded-full mx-auto"></div>
});

// テキストをクリーンアップする関数（タイトル・要約共用）
function cleanDisplayText(text: string): string {
  return text
    // タイトルの角カッコ除去
    .replace(/^\[(.+)\]$/, '$1')
    // "- カテゴリ: xxx" or "- **カテゴリ**: xxx" 部分を除去
    .replace(/^-?\s*\*{0,2}カテゴリ\*{0,2}\s*[:：]\s*[^-\n]*[-–]?\s*/gi, '')
    // "- 要約:" or "- **要約**:" のプレフィックスを除去
    .replace(/^-?\s*\*{0,2}要約\*{0,2}\s*[:：]\s*/gi, '')
    // "- 配信適性:" 以降を除去
    .replace(/[-–]\s*\*{0,2}配信適性\*{0,2}\s*[:：].*/gi, '')
    // 括弧付きMarkdownリンク ([text](url)) を除去
    .replace(/\(\[([^\]]+)\]\([^)]+\)\)/g, '')
    // Markdownリンク [text](url) をプレーンテキストに
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Markdown bold
    .replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1')
    // 括弧内URL参照除去
    .replace(/\(https?:\/\/[^)]+\)/g, '')
    // 残った孤立した括弧ペア "()" を除去
    .replace(/\(\s*\)/g, '')
    // 生URLを除去
    .replace(/https?:\/\/\S+/g, '')
    .replace(/^[\s\-–]+|[\s\-–]+$/g, '')
    .trim();
}

interface TopicDetailProps {
  topic: Topic;
  filters: FilterOptions;
  onBack: () => void;
}

export default function TopicDetail({ topic, filters, onBack }: TopicDetailProps) {
  const [script, setScript] = useState<Script | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentDuration, setCurrentDuration] = useState<15 | 60 | 180>(filters.duration);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);
  
  // お気に入り・評価機能
  const [isFavorite, setIsFavorite] = useState(false);
  const [currentRating, setCurrentRating] = useState<number>(0);
  const [ratingComment, setRatingComment] = useState('');
  const [showRatingForm, setShowRatingForm] = useState(false);
  const [ngWords, setNgWords] = useState<string[]>([]);

  useEffect(() => {
    loadScript();
    checkFavoriteStatus();
    checkNgWords();
  }, []);

  useEffect(() => {
    if (script) {
      checkRating();
      checkScriptNgWords();
    }
  }, [script]);

  const checkFavoriteStatus = () => {
    setIsFavorite(storage.isFavorite(topic.id));
  };

  const checkNgWords = () => {
    const detected = storage.detectNgWords(topic.title + ' ' + topic.summary);
    setNgWords(detected);
  };

  const checkScriptNgWords = () => {
    if (!script) return;
    const scriptText = Object.values(script.content).join(' ');
    const detected = storage.detectNgWords(scriptText);
    if (detected.length > 0) {
      setNgWords(prev => {
        const combined = [...prev, ...detected];
        return Array.from(new Set(combined));
      });
    }
  };

  const checkRating = () => {
    if (!script) return;
    const rating = storage.getRating(script.id);
    if (rating) {
      setCurrentRating(rating.rating);
      setRatingComment(rating.comment || '');
    }
  };

  const loadScript = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/script', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topic: {
            id: topic.id,
            title: topic.title,
            category: topic.category,
            summary: topic.summary,
            sensitivityLevel: topic.sensitivityLevel,
            riskLevel: topic.riskLevel
          },
          duration: currentDuration,
          tension: filters.tension,
          tone: filters.tone,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'サーバーエラーが発生しました');
      }

      const data: GenerateScriptResponse = await response.json();
      setScript(data.script);

      // レート制限カウンター更新
      if (!data.cached) {
        storage.updateRateLimit('script', data.cost || 0);
      }

      // 履歴に追加
      storage.addHistory({
        type: 'script',
        timestamp: new Date().toISOString(),
        topicId: topic.id,
        scriptSettings: {
          duration: currentDuration,
          tension: filters.tension,
          tone: filters.tone
        },
        cost: data.cost || 0,
        cached: data.cached || false
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '台本生成中にエラーが発生しました。もう一度お試しください。';
      setError(errorMessage);
      console.error('Script generation error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDurationChange = async (newDuration: 15 | 60 | 180) => {
    setCurrentDuration(newDuration);
    setScript(null);
    setCurrentRating(0);
    setRatingComment('');
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/script', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topic: {
            id: topic.id,
            title: topic.title,
            category: topic.category,
            summary: topic.summary,
            sensitivityLevel: topic.sensitivityLevel,
            riskLevel: topic.riskLevel
          },
          duration: newDuration,
          tension: filters.tension,
          tone: filters.tone,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'サーバーエラーが発生しました');
      }

      const data: GenerateScriptResponse = await response.json();
      setScript(data.script);

      // レート制限カウンター更新
      if (!data.cached) {
        storage.updateRateLimit('script', data.cost || 0);
      }

      // 履歴に追加
      storage.addHistory({
        type: 'script',
        timestamp: new Date().toISOString(),
        topicId: topic.id,
        scriptSettings: {
          duration: newDuration,
          tension: filters.tension,
          tone: filters.tone
        },
        cost: data.cost || 0,
        cached: data.cached || false
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '台本再生成中にエラーが発生しました。';
      setError(errorMessage);
      console.error('Script regeneration error:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleFavorite = () => {
    if (isFavorite) {
      // お気に入りから削除
      const favorites = storage.getFavorites();
      const favoriteToRemove = favorites.find(f => 
        (f.topicId === topic.id && f.type === 'topic' && !f.scriptId) ||
        (f.topicId === topic.id && f.scriptId === script?.id)
      );
      if (favoriteToRemove) {
        storage.removeFavorite(favoriteToRemove.id);
      }
      setIsFavorite(false);
    } else {
      // お気に入りに追加
      storage.addFavorite({
        type: script ? 'script' : 'topic',
        topicId: topic.id,
        scriptId: script?.id,
        title: topic.title,
        category: topic.category,
        notes: script ? `${currentDuration}秒版` : undefined
      });
      setIsFavorite(true);
    }
  };

  const handleRatingSubmit = () => {
    if (!script || currentRating === 0) return;

    storage.addRating({
      scriptId: script.id,
      topicId: topic.id,
      rating: currentRating as 1 | 2 | 3 | 4 | 5,
      comment: ratingComment.trim() || undefined
    });

    setShowRatingForm(false);
  };

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(type);
      setTimeout(() => setCopySuccess(null), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  const formatScriptForCopy = (script: Script) => {
    if (topic.category === '事件事故') {
      return `【${topic.title}】

【事実報告】
${script.content.factualReport}

【状況説明】
${script.content.seriousContext}

【注意事項】
${script.content.avoidanceNotes}

出典: ${topic.sourceUrl}`;
    }

    return `【${topic.title}】

【つかみ】
${script.content.opening}

【ざっくり説明】
${script.content.explanation}

【配信者コメント】
${script.content.streamerComment}

【視聴者参加質問】
${script.content.viewerQuestions?.map((q, i) => `${i + 1}. ${q}`).join('\n')}

【広げ方】
${script.content.expansions?.map((e, i) => `${i + 1}. ${e}`).join('\n')}

【次の話題への繋ぎ】
${script.content.transition}

出典: ${topic.sourceUrl}`;
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* ヘッダー */}
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

      {/* トピック情報 */}
      <div className="bg-gray-800/60 backdrop-blur-sm border border-gray-700 rounded-xl p-6 mb-8">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
              topic.category === 'ニュース' ? 'bg-blue-500/20 text-blue-300' :
              topic.category === 'エンタメ' ? 'bg-pink-500/20 text-pink-300' :
              topic.category === 'SNS' ? 'bg-green-500/20 text-green-300' :
              topic.category === 'TikTok' ? 'bg-purple-500/20 text-purple-300' :
              'bg-red-500/20 text-red-300'
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
              onClick={toggleFavorite}
              aria-label={isFavorite ? 'お気に入りから削除' : 'お気に入りに追加'}
              className={`p-2 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${
                isFavorite 
                  ? 'text-yellow-400 bg-yellow-400/10 hover:bg-yellow-400/20' 
                  : 'text-gray-400 hover:text-yellow-400 hover:bg-yellow-400/10'
              }`}
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
              ⚠️ NGワード検出: {ngWords.join(', ')}
            </div>
          </div>
        )}
      </div>

      {/* エラー表示 */}
      {error && (
        <div className="bg-red-500/20 border border-red-500 text-red-200 px-4 py-3 rounded-lg mb-6 flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={loadScript}
            className="text-red-200 hover:text-white transition-colors duration-200"
          >
            <RefreshIcon size={18} />
          </button>
        </div>
      )}

      {/* ローディング */}
      {loading && <LoadingSpinner />}

      {/* 台本表示 */}
      {script && !loading && (
        <div className="space-y-6">
          {/* Sticky Copy Button */}
          <div className="sticky top-4 z-10 mb-6">
            <div className="bg-gray-900/95 backdrop-blur-sm border border-gray-600 rounded-xl p-4 shadow-xl">
              <div className="flex items-center justify-center">
                <button
                  onClick={() => copyToClipboard(formatScriptForCopy(script), 'full')}
                  aria-label="台本全体をクリップボードにコピー"
                  className="flex items-center space-x-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-4 rounded-lg focus:outline-none focus:ring-4 focus:ring-blue-300/50 transition-all duration-200 transform hover:scale-105 shadow-lg text-lg font-semibold"
                >
                  <CopyIcon size={24} />
                  <span>{copySuccess === 'full' ? '✅ コピー完了!' : '📋 台本全体をコピー'}</span>
                </button>
              </div>
            </div>
          </div>

          <div className="bg-gray-800/60 backdrop-blur-sm border border-gray-700 rounded-xl p-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-6">
                <h2 className="text-2xl font-semibold text-white">配信用台本</h2>
                
                {/* 尺切替ボタン */}
                <div className="flex items-center space-x-2">
                  {durationOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => handleDurationChange(option.value as 15 | 60 | 180)}
                      disabled={loading}
                      aria-label={`台本の尺を${option.label}に変更`}
                      aria-pressed={currentDuration === option.value}
                      className={`px-3 py-1 rounded-lg text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${
                        currentDuration === option.value
                          ? 'bg-blue-600 text-white border border-blue-500'
                          : 'bg-gray-700 text-gray-300 border border-gray-600 hover:bg-gray-600 focus:bg-gray-600'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                {/* 評価ボタン */}
                <button
                  onClick={() => setShowRatingForm(!showRatingForm)}
                  className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors duration-200"
                >
                  <Heart size={16} />
                  評価
                </button>
                
                {/* 簡易コピーボタン（補助的） */}
                <button
                  onClick={() => copyToClipboard(formatScriptForCopy(script), 'full')}
                  aria-label="台本全体をクリップボードにコピー"
                  className="flex items-center space-x-2 bg-gray-600 hover:bg-gray-700 focus:bg-gray-700 text-white px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-300/50 transition-colors duration-200 text-sm"
                >
                  <CopyIcon size={14} />
                  <span>{copySuccess === 'full' ? '完了!' : 'コピー'}</span>
                </button>
              </div>
            </div>

            {/* 評価フォーム */}
            {showRatingForm && (
              <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-4 mb-6">
                <h3 className="text-lg font-semibold text-purple-200 mb-3">台本を評価してください</h3>
                
                {/* 星評価 */}
                <div className="flex items-center gap-2 mb-4">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setCurrentRating(star)}
                      className={`w-8 h-8 rounded-full transition-colors ${
                        star <= currentRating 
                          ? 'text-yellow-400 hover:text-yellow-300' 
                          : 'text-gray-600 hover:text-gray-400'
                      }`}
                    >
                      <Star size={24} className={star <= currentRating ? 'fill-current' : ''} />
                    </button>
                  ))}
                  <span className="ml-2 text-sm text-gray-300">
                    {currentRating > 0 && `${currentRating}/5`}
                  </span>
                </div>

                {/* コメント */}
                <textarea
                  value={ratingComment}
                  onChange={(e) => setRatingComment(e.target.value)}
                  placeholder="コメント（任意）"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 mb-3"
                  rows={2}
                />

                {/* ボタン */}
                <div className="flex gap-2">
                  <button
                    onClick={handleRatingSubmit}
                    disabled={currentRating === 0}
                    className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm transition-colors"
                  >
                    評価を保存
                  </button>
                  <button
                    onClick={() => setShowRatingForm(false)}
                    className="bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded-lg text-sm transition-colors"
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            )}

            {/* 既存の評価表示 */}
            {currentRating > 0 && !showRatingForm && (
              <div className="bg-purple-900/10 border border-purple-500/20 rounded-lg p-3 mb-6">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-purple-300">あなたの評価:</span>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        size={16}
                        className={star <= currentRating ? 'text-yellow-400 fill-current' : 'text-gray-600'}
                      />
                    ))}
                  </div>
                  {ratingComment && (
                    <span className="text-gray-300">「{ratingComment}」</span>
                  )}
                </div>
              </div>
            )}

            {topic.category === '事件事故' ? (
              // 事件事故用テンプレート
              <div className="space-y-6">
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                  <h3 className="font-semibold text-red-300 mb-2">事実報告</h3>
                  <p className="text-gray-200 leading-relaxed">{script.content.factualReport}</p>
                </div>

                <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
                  <h3 className="font-semibold text-orange-300 mb-2">状況説明</h3>
                  <p className="text-gray-200 leading-relaxed">{script.content.seriousContext}</p>
                </div>

                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                  <h3 className="font-semibold text-yellow-300 mb-2">注意事項</h3>
                  <p className="text-gray-200 leading-relaxed">{script.content.avoidanceNotes}</p>
                </div>
              </div>
            ) : (
              // 通常トピック用テンプレート
              <div className="space-y-6">
                <ScriptSection
                  title="つかみ"
                  content={script.content.opening}
                  onCopy={() => copyToClipboard(script.content.opening || '', 'opening')}
                  copySuccess={copySuccess === 'opening'}
                />

                <ScriptSection
                  title="ざっくり説明"
                  content={script.content.explanation}
                  onCopy={() => copyToClipboard(script.content.explanation || '', 'explanation')}
                  copySuccess={copySuccess === 'explanation'}
                />

                <ScriptSection
                  title="配信者コメント"
                  content={script.content.streamerComment}
                  onCopy={() => copyToClipboard(script.content.streamerComment || '', 'comment')}
                  copySuccess={copySuccess === 'comment'}
                />

                {script.content.viewerQuestions && (
                  <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-purple-300">視聴者参加質問</h3>
                      <button
                        onClick={() => copyToClipboard(script.content.viewerQuestions?.join('\n') || '', 'questions')}
                        className="text-purple-300 hover:text-white transition-colors duration-200"
                      >
                        <CopyIcon size={16} />
                      </button>
                    </div>
                    <ul className="text-gray-200 leading-relaxed space-y-1">
                      {script.content.viewerQuestions.map((question, index) => (
                        <li key={index}>
                          {index + 1}. {question}
                        </li>
                      ))}
                    </ul>
                    {copySuccess === 'questions' && (
                      <span className="text-green-400 text-sm mt-2 block">コピー完了!</span>
                    )}
                  </div>
                )}

                {script.content.expansions && (
                  <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-green-300">広げ方（3方向）</h3>
                      <button
                        onClick={() => copyToClipboard(script.content.expansions?.join('\n') || '', 'expansions')}
                        className="text-green-300 hover:text-white transition-colors duration-200"
                      >
                        <CopyIcon size={16} />
                      </button>
                    </div>
                    <ul className="text-gray-200 leading-relaxed space-y-1">
                      {script.content.expansions.map((expansion, index) => (
                        <li key={index}>
                          {index + 1}. {expansion}
                        </li>
                      ))}
                    </ul>
                    {copySuccess === 'expansions' && (
                      <span className="text-green-400 text-sm mt-2 block">コピー完了!</span>
                    )}
                  </div>
                )}

                <ScriptSection
                  title="次の話題への繋ぎ"
                  content={script.content.transition}
                  onCopy={() => copyToClipboard(script.content.transition || '', 'transition')}
                  copySuccess={copySuccess === 'transition'}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface ScriptSectionProps {
  title: string;
  content: string | undefined;
  onCopy: () => void;
  copySuccess: boolean;
}

function ScriptSection({ title, content, onCopy, copySuccess }: ScriptSectionProps) {
  if (!content) return null;

  return (
    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-blue-300">{title}</h3>
        <button
          onClick={onCopy}
          className="text-blue-300 hover:text-white transition-colors duration-200"
        >
          <CopyIcon size={16} />
        </button>
      </div>
      <p className="text-gray-200 leading-relaxed">{content}</p>
      {copySuccess && (
        <span className="text-green-400 text-sm mt-2 block">コピー完了!</span>
      )}
    </div>
  );
}