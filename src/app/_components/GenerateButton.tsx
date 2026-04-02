'use client';

import { Zap, Sparkles } from 'lucide-react';

interface GenerateButtonProps {
  loading: boolean;
  isOnCooldown: boolean;
  /** ログイン済みかつ本日の残り回数 */
  remainingRequests: number;
  /** ログイン済みユーザーかどうか */
  isLoggedIn: boolean;
  batchMode: boolean;
  batchCount: number;
  progressStep: string | null;
  getProgressPercent: () => number;
  onGenerate: () => void;
}

/** 生成ボタン・プログレスバー・クールダウン表示 */
export default function GenerateButton({
  loading,
  isOnCooldown,
  remainingRequests,
  isLoggedIn,
  batchMode,
  batchCount,
  progressStep,
  getProgressPercent,
  onGenerate,
}: GenerateButtonProps) {
  const isDisabled = loading || isOnCooldown || (isLoggedIn && remainingRequests === 0);

  return (
    <div className="flex flex-col items-center gap-4">
      <button
        onClick={onGenerate}
        disabled={isDisabled}
        aria-label="トーク台本を生成"
        className={`
          relative w-full max-w-sm font-bold py-4 px-8 rounded-2xl text-lg
          transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98]
          focus:outline-none focus:ring-4 focus:ring-cyan-500/30
          disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
          overflow-hidden text-white
        `}
        style={{
          background: batchMode
            ? 'linear-gradient(135deg, #7c3aed 0%, #db2777 100%)'
            : 'linear-gradient(135deg, #00d4ff 0%, #0066ff 60%, #7c3aed 100%)',
          boxShadow: loading
            ? 'none'
            : batchMode
              ? '0 0 32px rgba(124,58,237,0.4), 0 4px 16px rgba(0,0,0,0.4)'
              : '0 0 32px rgba(0,212,255,0.3), 0 4px 16px rgba(0,0,0,0.4)',
        }}
      >
        {/* ボタン内グレインオーバーレイ */}
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E\")",
            backgroundSize: '128px 128px',
          }}
        />

        <span className="relative flex flex-col items-center gap-1.5">
          {loading ? (
            <>
              <span className="flex items-center gap-2">
                <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                生成中...
              </span>
              {progressStep && (
                <span className="text-sm font-normal opacity-80">{progressStep}</span>
              )}
            </>
          ) : batchMode ? (
            <span className="flex items-center gap-2">
              <Sparkles size={20} />
              1日分まとめて生成 ({batchCount}件)
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Zap size={20} />
              トーク台本を生成
            </span>
          )}
        </span>
      </button>

      {/* プログレスバー */}
      {loading && (
        <div className="w-full max-w-sm">
          <div className="rounded-full h-1 overflow-hidden" style={{ background: 'var(--color-border)' }}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${getProgressPercent()}%`,
                background: 'linear-gradient(90deg, #00d4ff, #7c3aed)',
              }}
            />
          </div>
          <p className="text-xs text-[var(--color-text-muted)] text-center mt-1">
            {getProgressPercent()}% 完了
          </p>
        </div>
      )}

      {/* クールダウンメッセージ */}
      {isOnCooldown && !loading && (
        <p className="text-sm text-[var(--color-text-muted)]">
          連続実行防止のため少々お待ちください
        </p>
      )}

      {/* 本日の上限到達メッセージ */}
      {isLoggedIn && remainingRequests === 0 && (
        <p className="text-sm text-[var(--color-rose)]">
          本日の生成上限に達しました。明日お試しください。
        </p>
      )}
    </div>
  );
}
