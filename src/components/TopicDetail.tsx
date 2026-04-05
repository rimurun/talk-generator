'use client';

import { useState, useEffect } from 'react';
import { Topic, Script, FilterOptions, GenerateScriptResponse } from '@/types';
import { storage } from '@/lib/storage';
import { Copy, Check } from 'lucide-react';
import { RefreshIcon } from './icons';
import TeleprompterView from './TeleprompterView';
import ExportPanel from './ExportPanel';
import TopicDetailHeader from './topic-detail/TopicDetailHeader';
import ScriptActions from './topic-detail/ScriptActions';
import ScriptContent from './topic-detail/ScriptContent';
import { EditableScriptContent } from './topic-detail/types';
import { getAuthHeaders } from '@/lib/api-helpers';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import ScanlineLoader from './ScanlineLoader';

interface TopicDetailProps {
  topic: Topic;
  filters: FilterOptions;
  onBack: () => void;
  /** テレプロンプター直起動フラグ（TopicList から渡される） */
  autoTeleprompter?: boolean;
}

export default function TopicDetail({ topic, filters, onBack, autoTeleprompter }: TopicDetailProps) {
  const [script, setScript] = useState<Script | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentDuration, setCurrentDuration] = useState<15 | 60 | 180>(filters.duration);
  // コピー成功フィードバック用（セクション名を格納）
  const [copySuccess, setCopySuccess] = useState<string | null>(null);

  // お気に入り・評価機能
  const [isFavorite, setIsFavorite] = useState(false);
  const [currentRating, setCurrentRating] = useState<number>(0);
  const [ratingComment, setRatingComment] = useState('');
  const [showRatingForm, setShowRatingForm] = useState(false);
  const [ngWords, setNgWords] = useState<string[]>([]);

  // クイック星評価（スタイル学習用）
  const [quickRating, setQuickRating] = useState<number>(0);
  const [quickRatingHover, setQuickRatingHover] = useState<number>(0);

  // テレプロンプター表示フラグ
  const [showTeleprompter, setShowTeleprompter] = useState(false);

  // エクスポートパネル表示フラグ
  const [showExportPanel, setShowExportPanel] = useState(false);

  // 台本チェーン（連鎖展開）
  const [scriptChain, setScriptChain] = useState<Array<{
    topicTitle: string;
    topicSummary: string;
    script: Script;
  }>>([]);
  const [chainLoading, setChainLoading] = useState(false);
  // 現在表示中のチェーン位置（-1 = 元のトピック, 0以降 = チェーン内）
  const [chainIndex, setChainIndex] = useState(-1);

  // 編集モード関連の状態
  const [isEditMode, setIsEditMode] = useState(false);
  // 編集中のコンテンツ（AIオリジナルとは別に管理）
  const [editedContent, setEditedContent] = useState<EditableScriptContent | null>(null);
  // ローカルストレージ保存キー（トピックIDとDurationで一意化）
  const editStorageKey = `talkgen_edit_${topic.id}_${currentDuration}`;

  useEffect(() => {
    loadScript();
    checkFavoriteStatus();
    checkNgWords();
  }, []);

  useEffect(() => {
    if (script) {
      checkRating();
      checkScriptNgWords();
      // スクリプト読み込み時に保存済み編集データを復元
      loadEditedContent();
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
    // クイック評価も復元
    const quickRatings = storage.getScriptRatings();
    if (quickRatings[script.id]) {
      setQuickRating(quickRatings[script.id].rating);
    }
  };

  // クイック星評価を保存
  const handleQuickRating = (star: number) => {
    if (!script) return;
    storage.rateScript(script.id, star as 1 | 2 | 3 | 4 | 5);
    setQuickRating(star);
  };

  // ローカルストレージから編集済みコンテンツを読み込む
  const loadEditedContent = () => {
    if (typeof window === 'undefined' || !script) return;
    const saved = localStorage.getItem(editStorageKey);
    if (saved) {
      try {
        setEditedContent(JSON.parse(saved));
      } catch {
        // パースエラーは無視
      }
    } else {
      // 保存データがない場合はAI生成コンテンツで初期化
      initEditedContentFromScript(script);
    }
  };

  // scriptからeditedContentを初期化するヘルパー
  const initEditedContentFromScript = (s: Script) => {
    setEditedContent({
      opening: s.content.opening || '',
      explanation: s.content.explanation || '',
      streamerComment: s.content.streamerComment || '',
      viewerQuestions: s.content.viewerQuestions || [],
      expansions: s.content.expansions || [],
      transition: s.content.transition || '',
      factualReport: s.content.factualReport || '',
      seriousContext: s.content.seriousContext || '',
      avoidanceNotes: s.content.avoidanceNotes || '',
    });
  };

  const loadScript = async () => {
    setLoading(true);
    setError(null);

    try {
      // スタイルプロファイルを取得してリクエストに含める
      const styleProfile = storage.getStyleProfile();

      const scriptAuthHeaders = await getAuthHeaders();
      const response = await fetch('/api/script', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...scriptAuthHeaders,
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
          styleProfile: styleProfile || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 403) {
          throw new Error(errorData.error || 'ゲストの利用回数上限に達しました。ログインしてご利用ください。');
        }
        throw new Error(errorData.error || 'サーバーエラーが発生しました');
      }

      const data: GenerateScriptResponse = await response.json();
      setScript(data.script);

      // レート制限カウンター更新
      if (!data.cached) {
        storage.updateRateLimit('script', data.cost || 0);
      }

      // 使用統計を記録（スタイル学習用）
      storage.trackGeneration(topic.category, data.cached || false);

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

      // TopicCard のテレプロンプターボタンから起動した場合、自動でテレプロンプターを開く
      if (autoTeleprompter) {
        setShowTeleprompter(true);
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '台本生成中にエラーが発生しました。もう一度お試しください。';
      setError(errorMessage);
      console.error('Script generation error:', err);
    } finally {
      setLoading(false);
    }
  };

  // === 台本チェーン操作 ===

  /** 展開トピックを選択して次の台本を連鎖生成 */
  const handleSelectExpansion = async (expansionText: string) => {
    if (!script || chainLoading) return;

    // 現在の台本が元トピックの場合、まずチェーンに元を保存
    if (chainIndex === -1 && scriptChain.length === 0) {
      setScriptChain([{
        topicTitle: topic.title,
        topicSummary: topic.summary,
        script,
      }]);
    }

    setChainLoading(true);
    try {
      const styleProfile = storage.getStyleProfile();
      const prevTitle = chainIndex >= 0 ? scriptChain[chainIndex].topicTitle : topic.title;
      const transition = script.content.transition || '';

      const authHeaders = await getAuthHeaders();
      const response = await fetch('/api/script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          topic: {
            id: `chain-${Date.now()}`,
            title: expansionText,
            category: topic.category,
            summary: `前のトピック「${prevTitle}」からの展開。${transition}`,
            sensitivityLevel: 1,
            riskLevel: 'low',
          },
          duration: currentDuration,
          tension: filters.tension,
          tone: filters.tone,
          styleProfile: styleProfile || undefined,
        }),
      });

      if (!response.ok) throw new Error('次の台本生成に失敗しました');
      const data: GenerateScriptResponse = await response.json();

      // チェーンに追加
      const newChain = [...scriptChain];
      // 現在位置より後ろのチェーンを切り捨て（分岐を作らない）
      const insertAt = chainIndex === -1 ? 0 : chainIndex + 1;
      newChain.splice(insertAt + 1);
      newChain.push({
        topicTitle: expansionText,
        topicSummary: `${prevTitle}からの展開`,
        script: data.script,
      });

      setScriptChain(newChain);
      setChainIndex(newChain.length - 1);
      setScript(data.script);
      setEditedContent(null);
      setIsEditMode(false);

      // スクロールトップ
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err instanceof Error ? err.message : '次の台本生成に失敗しました');
    } finally {
      setChainLoading(false);
    }
  };

  /** チェーン内ナビゲーション */
  const navigateChain = (index: number) => {
    if (index < 0) {
      // 元のトピックに戻る
      setChainIndex(-1);
      loadScript();
      return;
    }
    if (index >= scriptChain.length) return;
    setChainIndex(index);
    setScript(scriptChain[index].script);
    setEditedContent(null);
    setIsEditMode(false);
  };

  const handleDurationChange = async (newDuration: 15 | 60 | 180) => {
    setCurrentDuration(newDuration);
    setScript(null);
    setCurrentRating(0);
    setRatingComment('');
    setLoading(true);
    setError(null);
    // 尺変更時は編集モードを解除
    setIsEditMode(false);
    setEditedContent(null);

    try {
      // スタイルプロファイルを取得してリクエストに含める
      const styleProfile = storage.getStyleProfile();

      const scriptAuthHeaders = await getAuthHeaders();
      const response = await fetch('/api/script', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...scriptAuthHeaders,
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
          styleProfile: styleProfile || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 403) {
          throw new Error(errorData.error || 'ゲストの利用回数上限に達しました。ログインしてご利用ください。');
        }
        throw new Error(errorData.error || 'サーバーエラーが発生しました');
      }

      const data: GenerateScriptResponse = await response.json();
      setScript(data.script);

      // レート制限カウンター更新
      if (!data.cached) {
        storage.updateRateLimit('script', data.cost || 0);
      }

      // 使用統計を記録（スタイル学習用）
      storage.trackGeneration(topic.category, data.cached || false);

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

  // テキストをクリップボードにコピーし、2秒後にフィードバックをリセット
  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(type);
      setTimeout(() => setCopySuccess(null), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  // 現在表示中のコンテンツを取得（編集済みがあれば優先）
  const getDisplayContent = (): EditableScriptContent | null => {
    if (editedContent) return editedContent;
    if (!script) return null;
    return {
      opening: script.content.opening || '',
      explanation: script.content.explanation || '',
      streamerComment: script.content.streamerComment || '',
      viewerQuestions: script.content.viewerQuestions || [],
      expansions: script.content.expansions || [],
      transition: script.content.transition || '',
      factualReport: script.content.factualReport || '',
      seriousContext: script.content.seriousContext || '',
      avoidanceNotes: script.content.avoidanceNotes || '',
    };
  };

  // 全文コピー用テキストフォーマット（編集済みコンテンツ対応）
  const formatScriptForCopy = (): string => {
    const content = getDisplayContent();
    if (!content) return '';

    if (topic.category === '事件事故') {
      return `【${topic.title}】
カテゴリ: ${topic.category}

--- 台本 ---

事実報告:
${content.factualReport}

状況説明:
${content.seriousContext}

注意事項:
${content.avoidanceNotes}

出典: ${topic.sourceUrl}`;
    }

    return `【${topic.title}】
カテゴリ: ${topic.category}

--- 台本 ---

つかみ:
${content.opening}

説明:
${content.explanation}

コメント:
${content.streamerComment}

視聴者への質問:
${content.viewerQuestions.join('\n')}

話の広げ方:
${content.expansions.join('\n')}

繋ぎ:
${content.transition}

出典: ${topic.sourceUrl}`;
  };

  // 編集モード切り替え
  const handleToggleEditMode = () => {
    if (!isEditMode && script && !editedContent) {
      initEditedContentFromScript(script);
    }
    setIsEditMode(prev => !prev);
  };

  // 編集内容をローカルストレージに保存し、スタイル編集をトラッキング
  const handleSaveEdit = () => {
    if (!editedContent || typeof window === 'undefined' || !script) return;

    // 元のAI生成コンテンツと比較してスタイル編集を記録
    const originalContent = {
      opening: script.content.opening || '',
      explanation: script.content.explanation || '',
      streamerComment: script.content.streamerComment || '',
      transition: script.content.transition || '',
      factualReport: script.content.factualReport || '',
      seriousContext: script.content.seriousContext || '',
      avoidanceNotes: script.content.avoidanceNotes || '',
    };

    // セクションごとに差分を検出してトラッキング
    const sectionsToTrack: Array<{ key: keyof typeof originalContent; label: string }> = [
      { key: 'opening', label: 'opening' },
      { key: 'explanation', label: 'explanation' },
      { key: 'streamerComment', label: 'comment' },
      { key: 'transition', label: 'transition' },
      { key: 'factualReport', label: 'factualReport' },
      { key: 'seriousContext', label: 'seriousContext' },
      { key: 'avoidanceNotes', label: 'avoidanceNotes' },
    ];

    sectionsToTrack.forEach(({ key, label }) => {
      const orig = originalContent[key];
      const edited = editedContent[key as keyof typeof editedContent] as string;
      // 元と異なる場合のみ記録
      if (orig && edited && orig !== edited) {
        storage.trackStyleEdit(orig, edited, label);
      }
    });

    localStorage.setItem(editStorageKey, JSON.stringify(editedContent));
    setIsEditMode(false);
    // 保存完了フィードバック
    setCopySuccess('saved');
    setTimeout(() => setCopySuccess(null), 2000);
  };

  // AI生成バージョンにリセット
  const handleResetEdit = () => {
    if (!script) return;
    if (typeof window !== 'undefined') {
      localStorage.removeItem(editStorageKey);
    }
    initEditedContentFromScript(script);
    setIsEditMode(false);
  };

  // editedContentの特定フィールドを更新するヘルパー
  const updateEditedField = (field: keyof EditableScriptContent, value: string) => {
    setEditedContent(prev => prev ? { ...prev, [field]: value } : prev);
  };

  // viewerQuestionsの個別行を更新
  const updateViewerQuestion = (index: number, value: string) => {
    setEditedContent(prev => {
      if (!prev) return prev;
      const updated = [...prev.viewerQuestions];
      updated[index] = value;
      return { ...prev, viewerQuestions: updated };
    });
  };

  // expansionsの個別行を更新
  const updateExpansion = (index: number, value: string) => {
    setEditedContent(prev => {
      if (!prev) return prev;
      const updated = [...prev.expansions];
      updated[index] = value;
      return { ...prev, expansions: updated };
    });
  };

  const displayContent = getDisplayContent();

  // テレプロンプター表示中はオーバーレイを全画面描画
  if (showTeleprompter && script) {
    return (
      <TeleprompterView
        script={script}
        topic={topic}
        onExit={() => setShowTeleprompter(false)}
      />
    );
  }

  return (
    <>
      {/* アニメーション定義 */}
      <style>{`
        @keyframes teleprompterPulse {
          0%, 100% { box-shadow: 0 0 12px rgba(6,182,212,0.4), 0 0 24px rgba(6,182,212,0.2); }
          50% { box-shadow: 0 0 24px rgba(6,182,212,0.7), 0 0 48px rgba(6,182,212,0.3); }
        }
        @keyframes copySuccess {
          0% { transform: scale(0.8); opacity: 0; }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes exportSlideIn {
          from { opacity: 0; transform: translateX(10px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .teleprompter-btn {
          animation: teleprompterPulse 2.5s ease-in-out infinite;
        }
        .copy-success-icon {
          animation: copySuccess 0.3s ease-out forwards;
        }
      `}</style>

      <div className="max-w-4xl mx-auto neon-glow-cyan">
        {/* 台本チェーンステッパー */}
        {scriptChain.length > 0 && (
          <div className="mb-4 flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
            <button
              onClick={() => navigateChain(-1)}
              className={`flex-shrink-0 px-2.5 py-1.5 rounded-lg font-mono text-[11px] transition-all truncate max-w-[130px] ${
                chainIndex === -1
                  ? 'bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 neon-glow-cyan'
                  : 'bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-white hover:border-cyan-500/30'
              }`}
            >
              {topic.title.length > 12 ? topic.title.slice(0, 12) + '...' : topic.title}
            </button>
            {scriptChain.slice(1).map((item, i) => (
              <div key={i} className="flex items-center gap-1.5 flex-shrink-0">
                <ChevronRight size={12} className="text-cyan-500/30" />
                <button
                  onClick={() => navigateChain(i + 1)}
                  className={`px-2.5 py-1.5 rounded-lg font-mono text-[11px] transition-all truncate max-w-[130px] ${
                    chainIndex === i + 1
                      ? 'bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 neon-glow-cyan'
                      : 'bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-white hover:border-cyan-500/30'
                  }`}
                >
                  {item.topicTitle.length > 12 ? item.topicTitle.slice(0, 12) + '...' : item.topicTitle}
                </button>
              </div>
            ))}
            <span className="flex-shrink-0 font-mono text-[10px] text-cyan-500/30 tracking-wider ml-1">
              {chainIndex === -1 ? 1 : chainIndex + 1}/{scriptChain.length}
            </span>
          </div>
        )}

        {/* トピックヘッダー（戻るボタン・カード・NGワード） */}
        <TopicDetailHeader
          topic={topic}
          filters={filters}
          currentDuration={currentDuration}
          isFavorite={isFavorite}
          ngWords={ngWords}
          onBack={onBack}
          onToggleFavorite={toggleFavorite}
        />

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
        {loading && (
          <ScanlineLoader text="GENERATING" subtext="台本を生成しています" />
        )}

        {/* 台本表示 */}
        {script && !loading && displayContent && (
          <div className="space-y-6">
            {/* Sticky コピーボタンエリア */}
            <div className="sticky top-4 z-10 mb-6">
              <div
                className="rounded-xl p-4 shadow-xl"
                style={{
                  background: 'rgba(9,9,20,0.95)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                }}
              >
                <div className="flex items-center justify-center gap-3 flex-wrap">
                  {/* 全文コピーボタン（メイン） */}
                  <button
                    onClick={() => copyToClipboard(formatScriptForCopy(), 'full')}
                    aria-label="台本全体をクリップボードにコピー"
                    className="flex items-center space-x-3 text-white px-8 py-3.5 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-300/30 transition-all duration-200 text-base font-semibold"
                    style={{
                      background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
                      boxShadow: '0 4px 20px rgba(99,102,241,0.4)',
                      transform: 'translateY(0)',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px) scale(1.02)';
                      (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 28px rgba(99,102,241,0.5)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0) scale(1)';
                      (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 20px rgba(99,102,241,0.4)';
                    }}
                  >
                    {copySuccess === 'full' ? (
                      <Check size={22} className="copy-success-icon" />
                    ) : (
                      <Copy size={22} />
                    )}
                    <span>{copySuccess === 'full' ? 'コピーしました' : '全文コピー'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 台本カード本体 */}
            <div
              className="relative rounded-xl p-8 overflow-hidden"
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
                style={{ background: 'linear-gradient(90deg, #06b6d4, #3b82f6, #8b5cf6)' }}
              />

              {/* アクションバー（尺切替・テレプロンプター・編集・評価・エクスポート） */}
              <ScriptActions
                script={script}
                currentDuration={currentDuration}
                loading={loading}
                isEditMode={isEditMode}
                copySuccess={copySuccess}
                showRatingForm={showRatingForm}
                showExportPanel={showExportPanel}
                currentRating={currentRating}
                ratingComment={ratingComment}
                quickRating={quickRating}
                quickRatingHover={quickRatingHover}
                formattedScriptText={formatScriptForCopy()}
                onDurationChange={handleDurationChange}
                onTeleprompter={() => setShowTeleprompter(true)}
                onToggleEditMode={handleToggleEditMode}
                onSaveEdit={handleSaveEdit}
                onResetEdit={handleResetEdit}
                onCopyFull={() => copyToClipboard(formatScriptForCopy(), 'full')}
                onToggleRatingForm={() => setShowRatingForm(!showRatingForm)}
                onToggleExportPanel={() => setShowExportPanel(true)}
                onRatingSubmit={handleRatingSubmit}
                onRatingCancel={() => setShowRatingForm(false)}
                onSetCurrentRating={setCurrentRating}
                onSetRatingComment={setRatingComment}
                onQuickRating={handleQuickRating}
                onQuickRatingHover={setQuickRatingHover}
              />

              {/* 台本セクション群（カテゴリ別テンプレート） */}
              <ScriptContent
                category={topic.category}
                displayContent={displayContent}
                copySuccess={copySuccess}
                isEditMode={isEditMode}
                onCopy={copyToClipboard}
                onUpdateField={updateEditedField}
                onUpdateViewerQuestion={updateViewerQuestion}
                onUpdateExpansion={updateExpansion}
                onSelectExpansion={handleSelectExpansion}
                chainLoading={chainLoading}
              />
            </div>
          </div>
        )}

        {/* エクスポートパネル（台本が存在する場合のみレンダリング） */}
        {script && (
          <ExportPanel
            isOpen={showExportPanel}
            onClose={() => setShowExportPanel(false)}
            script={script}
            topic={topic}
          />
        )}
      </div>
    </>
  );
}
