'use client';

import Link from 'next/link';
import { Radio } from 'lucide-react';

/** 未ログイン時のゲストモードバナー */
export default function GuestBanner() {
  return (
    <div className="mb-5 px-4 py-3 rounded-xl glass-card-light border border-cyan-500/20 flex items-center justify-between flex-wrap gap-2">
      <div className="flex items-center gap-3">
        {/* ゲストモードインジケーター（ピル形式） */}
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-xs text-cyan-300 font-medium">
          <Radio size={10} />
          ゲスト
        </span>
        <span className="text-sm text-[var(--color-text-secondary)]">
          ゲストモードで利用中
        </span>
        <span className="hidden sm:inline text-[var(--color-text-muted)] text-xs">|</span>
        <span className="hidden sm:inline text-xs text-[var(--color-text-muted)]">
          ログインすると無制限
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
