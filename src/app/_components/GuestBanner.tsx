'use client';

import Link from 'next/link';
import { Radio } from 'lucide-react';

interface GuestBannerProps {
  /** ゲストの残り試用回数 */
  guestRemaining: number;
}

/** 未ログイン時のゲストモードバナー */
export default function GuestBanner({ guestRemaining }: GuestBannerProps) {
  return (
    <div className="mb-5 px-4 py-3 rounded-xl glass-card-light border border-cyan-500/20 flex items-center justify-between flex-wrap gap-2">
      <div className="flex items-center gap-3">
        {/* ゲスト残り回数インジケーター（ピル形式） */}
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-xs text-cyan-300 font-medium">
          <Radio size={10} />
          ゲスト
        </span>
        <span className="text-sm text-[var(--color-text-secondary)]">
          残り
          <span className="font-bold text-white mx-1.5">{guestRemaining}回</span>
          利用可能
        </span>
        <span className="hidden sm:inline text-[var(--color-text-muted)] text-xs">|</span>
        <span className="hidden sm:inline text-xs text-[var(--color-text-muted)]">
          ログインで無制限
        </span>
      </div>
      <Link
        href="/login"
        className="text-sm bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white px-4 py-1.5 rounded-lg transition-all duration-200 font-medium"
      >
        ログイン
      </Link>
    </div>
  );
}
