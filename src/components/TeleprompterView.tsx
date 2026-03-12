'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Script, Topic } from '@/types';
import {
  Monitor,
  Play,
  Pause,
  FlipHorizontal,
  X,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';

interface TeleprompterViewProps {
  script: Script;
  topic: Topic;
  onExit: () => void;
}

// フォントサイズのステップ一覧
const FONT_SIZES = [
  'text-lg',
  'text-xl',
  'text-2xl',
  'text-3xl',
  'text-4xl',
  'text-5xl',
] as const;

// スクロール速度 → フレームあたりのピクセル数
function speedToPixels(speed: number): number {
  // speed 1 = 0.3px/frame, speed 10 = 3px/frame
  return 0.3 + (speed - 1) * (2.7 / 9);
}

// スクリプトのセクションデータ型
interface ScriptSection {
  label: string;
  content: string;
  type: 'header' | 'body' | 'questions' | 'list';
}

// スクリプトをセクション配列に変換する
function buildSections(script: Script, category: string): ScriptSection[] {
  const sections: ScriptSection[] = [];

  if (category === '事件事故') {
    if (script.content.factualReport) {
      sections.push({ label: '事実報告', content: '', type: 'header' });
      sections.push({ label: '', content: script.content.factualReport, type: 'body' });
    }
    if (script.content.seriousContext) {
      sections.push({ label: '状況説明', content: '', type: 'header' });
      sections.push({ label: '', content: script.content.seriousContext, type: 'body' });
    }
    if (script.content.avoidanceNotes) {
      sections.push({ label: '注意事項', content: '', type: 'header' });
      sections.push({ label: '', content: script.content.avoidanceNotes, type: 'body' });
    }
  } else {
    if (script.content.opening) {
      sections.push({ label: 'つかみ', content: '', type: 'header' });
      sections.push({ label: '', content: script.content.opening, type: 'body' });
    }
    if (script.content.explanation) {
      sections.push({ label: 'ざっくり説明', content: '', type: 'header' });
      sections.push({ label: '', content: script.content.explanation, type: 'body' });
    }
    if (script.content.streamerComment) {
      sections.push({ label: '配信者コメント', content: '', type: 'header' });
      sections.push({ label: '', content: script.content.streamerComment, type: 'body' });
    }
    if (script.content.viewerQuestions && script.content.viewerQuestions.length > 0) {
      sections.push({ label: '視聴者参加質問', content: '', type: 'header' });
      sections.push({
        label: '',
        content: script.content.viewerQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n'),
        type: 'questions',
      });
    }
    if (script.content.expansions && script.content.expansions.length > 0) {
      sections.push({ label: '広げ方', content: '', type: 'header' });
      sections.push({
        label: '',
        content: script.content.expansions.map((e, i) => `${i + 1}. ${e}`).join('\n'),
        type: 'list',
      });
    }
    if (script.content.transition) {
      sections.push({ label: '次の話題への繋ぎ', content: '', type: 'header' });
      sections.push({ label: '', content: script.content.transition, type: 'body' });
    }
  }

  return sections;
}

export default function TeleprompterView({ script, topic, onExit }: TeleprompterViewProps) {
  // --- 状態管理 ---
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(3);
  const [fontSizeIndex, setFontSizeIndex] = useState(2); // デフォルト: text-2xl
  const [isMirror, setIsMirror] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [progress, setProgress] = useState(0);

  // --- Refs ---
  const containerRef = useRef<HTMLDivElement>(null);
  const rafIdRef = useRef<number | null>(null);
  const isPlayingRef = useRef(false);
  const speedRef = useRef(speed);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ref を最新値に同期（requestAnimationFrame内で使うため）
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  // --- スクリプトセクションデータ ---
  const sections = buildSections(script, topic.category);

  // --- スクロール進捗の更新 ---
  const updateProgress = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    if (max <= 0) {
      setProgress(0);
      return;
    }
    setProgress(Math.round((el.scrollTop / max) * 100));
  }, []);

  // --- requestAnimationFrame によるオートスクロール ---
  const tick = useCallback(() => {
    if (!isPlayingRef.current) return;
    const el = containerRef.current;
    if (el) {
      const px = speedToPixels(speedRef.current);
      el.scrollTop += px;
      // 最下部に到達したら停止
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 1) {
        isPlayingRef.current = false;
        setIsPlaying(false);
        return;
      }
      updateProgress();
    }
    rafIdRef.current = requestAnimationFrame(tick);
  }, [updateProgress]);

  // 再生/停止の切替
  const togglePlay = useCallback(() => {
    setIsPlaying((prev) => {
      const next = !prev;
      isPlayingRef.current = next;
      if (next) {
        rafIdRef.current = requestAnimationFrame(tick);
      } else {
        if (rafIdRef.current !== null) {
          cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = null;
        }
      }
      return next;
    });
  }, [tick]);

  // 手動スクロール時にも進捗更新
  const handleScroll = useCallback(() => {
    updateProgress();
  }, [updateProgress]);

  // --- コントロールバーの自動非表示 ---
  const showControlsTemporarily = useCallback(() => {
    setShowControls(true);
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    // プレイ中は3秒後に自動非表示
    if (isPlayingRef.current) {
      controlsTimerRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  }, []);

  // タッチデバイス: タップでコントロール表示トグル
  const handleTap = useCallback(
    (e: React.MouseEvent) => {
      // コントロールバー上のクリックは無視
      const target = e.target as HTMLElement;
      if (target.closest('[data-controls]')) return;
      showControlsTemporarily();
    },
    [showControlsTemporarily]
  );

  // プレイ状態変化時にコントロール自動非表示タイマーを制御
  useEffect(() => {
    if (isPlaying) {
      controlsTimerRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    } else {
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
      setShowControls(true);
    }
    return () => {
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    };
  }, [isPlaying]);

  // --- キーボードショートカット ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // フォーム入力中は無効化
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          togglePlay();
          showControlsTemporarily();
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSpeed((s) => Math.min(10, s + 1));
          showControlsTemporarily();
          break;
        case 'ArrowDown':
          e.preventDefault();
          setSpeed((s) => Math.max(1, s - 1));
          showControlsTemporarily();
          break;
        case '+':
        case '=':
          e.preventDefault();
          setFontSizeIndex((i) => Math.min(FONT_SIZES.length - 1, i + 1));
          showControlsTemporarily();
          break;
        case '-':
          e.preventDefault();
          setFontSizeIndex((i) => Math.max(0, i - 1));
          showControlsTemporarily();
          break;
        case 'm':
        case 'M':
          e.preventDefault();
          setIsMirror((m) => !m);
          showControlsTemporarily();
          break;
        case 'Escape':
          e.preventDefault();
          onExit();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, onExit, showControlsTemporarily]);

  // アンマウント時にアニメーションフレームをキャンセル
  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    };
  }, []);

  // --- フォントサイズ操作 ---
  const decreaseFontSize = () => setFontSizeIndex((i) => Math.max(0, i - 1));
  const increaseFontSize = () => setFontSizeIndex((i) => Math.min(FONT_SIZES.length - 1, i + 1));

  // 速度スライダー: スピードを変えたときにrefも更新
  const handleSpeedChange = (value: number) => {
    setSpeed(value);
    speedRef.current = value;
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black flex flex-col"
      onClick={handleTap}
    >
      {/* ===== スクロールコンテナ ===== */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide px-8 py-16 md:px-24 lg:px-48"
        style={{ scrollBehavior: 'auto' }}
      >
        {/* ミラーモード: テキストコンテナにのみ適用 */}
        <div style={{ transform: isMirror ? 'scaleX(-1)' : undefined }}>
          {/* トピックタイトル */}
          <div className="mb-12 text-center">
            <p className="text-gray-500 text-sm uppercase tracking-widest mb-2">TELEPROMPTER</p>
            <h1 className="text-white/70 text-xl font-medium leading-relaxed">
              {topic.title.replace(/^\[(.+)\]$/, '$1')}
            </h1>
          </div>

          {/* スクリプトセクション */}
          <div className="space-y-8">
            {sections.map((section, index) => {
              if (section.type === 'header') {
                return (
                  <div key={index} className="pt-4">
                    {/* セクションヘッダー: シアン */}
                    <h2 className="text-cyan-400 font-bold text-lg tracking-widest uppercase">
                      ▍{section.label}
                    </h2>
                    <div className="mt-1 h-px bg-cyan-400/20" />
                  </div>
                );
              }

              if (section.type === 'questions') {
                // 視聴者質問: 黄色
                return (
                  <div key={index} className={`${FONT_SIZES[fontSizeIndex]} leading-relaxed`}>
                    {section.content.split('\n').map((line, lineIdx) => (
                      <p key={lineIdx} className="text-yellow-300/95 mb-3">
                        {line}
                      </p>
                    ))}
                  </div>
                );
              }

              if (section.type === 'list') {
                // リスト（広げ方など）: 薄いシアン
                return (
                  <div key={index} className={`${FONT_SIZES[fontSizeIndex]} leading-relaxed`}>
                    {section.content.split('\n').map((line, lineIdx) => (
                      <p key={lineIdx} className="text-cyan-200/90 mb-3">
                        {line}
                      </p>
                    ))}
                  </div>
                );
              }

              // 通常本文: 白
              return (
                <p
                  key={index}
                  className={`${FONT_SIZES[fontSizeIndex]} text-white/95 leading-relaxed`}
                >
                  {section.content}
                </p>
              );
            })}
          </div>

          {/* 末尾スペース（最後まで読みやすくするため） */}
          <div className="h-screen" />
        </div>
      </div>

      {/* ===== コントロールバー ===== */}
      <div
        data-controls
        className={`
          absolute bottom-0 left-0 right-0
          bg-black/80 backdrop-blur-md
          border-t border-gray-800
          px-4 py-3
          transition-opacity duration-300
          ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}
        `}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 上段: コントロール */}
        <div className="flex items-center gap-3 mb-2">
          {/* 再生/停止ボタン */}
          <button
            onClick={togglePlay}
            aria-label={isPlaying ? '一時停止' : '再生'}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-cyan-600 hover:bg-cyan-500 text-white transition-colors flex-shrink-0"
          >
            {isPlaying ? <Pause size={18} /> : <Play size={18} />}
          </button>

          {/* スピードラベル */}
          <span className="text-gray-400 text-xs whitespace-nowrap">速度</span>

          {/* スピードスライダー */}
          <input
            type="range"
            min={1}
            max={10}
            value={speed}
            onChange={(e) => handleSpeedChange(Number(e.target.value))}
            aria-label="スクロール速度"
            className="flex-1 max-w-36 h-1.5 rounded-full accent-cyan-400 cursor-pointer"
          />

          <span className="text-cyan-400 text-sm font-mono w-4">{speed}</span>

          {/* 速度上下ボタン */}
          <div className="flex flex-col gap-0.5">
            <button
              onClick={() => handleSpeedChange(Math.min(10, speed + 1))}
              aria-label="速度を上げる"
              className="text-gray-400 hover:text-white transition-colors"
            >
              <ChevronUp size={14} />
            </button>
            <button
              onClick={() => handleSpeedChange(Math.max(1, speed - 1))}
              aria-label="速度を下げる"
              className="text-gray-400 hover:text-white transition-colors"
            >
              <ChevronDown size={14} />
            </button>
          </div>

          {/* セパレータ */}
          <div className="w-px h-6 bg-gray-700 mx-1" />

          {/* フォントサイズ縮小 */}
          <button
            onClick={decreaseFontSize}
            disabled={fontSizeIndex === 0}
            aria-label="文字を小さく"
            className="text-gray-300 hover:text-white disabled:opacity-30 transition-colors px-2 py-1 rounded text-sm font-bold"
          >
            A-
          </button>

          {/* フォントサイズ拡大 */}
          <button
            onClick={increaseFontSize}
            disabled={fontSizeIndex === FONT_SIZES.length - 1}
            aria-label="文字を大きく"
            className="text-gray-300 hover:text-white disabled:opacity-30 transition-colors px-2 py-1 rounded text-lg font-bold"
          >
            A+
          </button>

          {/* セパレータ */}
          <div className="w-px h-6 bg-gray-700 mx-1" />

          {/* ミラーモード */}
          <button
            onClick={() => setIsMirror((m) => !m)}
            aria-label="ミラーモード切替"
            aria-pressed={isMirror}
            className={`p-2 rounded-lg transition-colors ${
              isMirror
                ? 'bg-cyan-600/40 text-cyan-300'
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            <FlipHorizontal size={18} />
          </button>

          {/* 閉じるボタン */}
          <button
            onClick={onExit}
            aria-label="テレプロンプターを閉じる"
            className="ml-auto p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* 下段: 進捗バー */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-1 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-cyan-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-gray-500 text-xs font-mono w-10 text-right">{progress}%</span>
        </div>

        {/* キーボードショートカットのヒント */}
        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5">
          {[
            { key: 'スペース', desc: '再生/停止' },
            { key: '↑↓', desc: '速度調整' },
            { key: '+ -', desc: '文字サイズ' },
            { key: 'M', desc: 'ミラー' },
            { key: 'Esc', desc: '終了' },
          ].map(({ key, desc }) => (
            <span key={key} className="text-gray-600 text-xs">
              <kbd className="font-mono bg-gray-800 px-1 rounded text-gray-500">{key}</kbd>
              {' '}{desc}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
