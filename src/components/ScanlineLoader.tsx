'use client';

import { useState, useEffect } from 'react';

interface Props {
  text?: string;
  subtext?: string;
}

export default function ScanlineLoader({ text = 'ANALYZING', subtext }: Props) {
  const [counter, setCounter] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCounter(prev => prev + Math.floor(Math.random() * 3) + 1);
    }, 80);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center gap-5 py-8">
      {/* スキャンリング */}
      <div className="relative w-24 h-24">
        {/* 外側リング */}
        <div
          className="absolute inset-0 rounded-full border border-cyan-500/30"
          style={{ animation: 'spin 4s linear infinite' }}
        >
          <div className="absolute top-0 left-1/2 w-2 h-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-400 shadow-[0_0_12px_4px_rgba(0,212,255,0.6)]" />
        </div>

        {/* 中間リング */}
        <div
          className="absolute inset-3 rounded-full border border-purple-500/20"
          style={{ animation: 'spin 2.5s linear infinite reverse' }}
        >
          <div className="absolute top-0 left-1/2 w-1.5 h-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-400 shadow-[0_0_8px_3px_rgba(168,85,247,0.6)]" />
        </div>

        {/* 最内リング */}
        <div
          className="absolute inset-6 rounded-full border border-cyan-500/10"
          style={{ animation: 'spin 1.5s linear infinite' }}
        >
          <div className="absolute bottom-0 left-1/2 w-1 h-1 -translate-x-1/2 translate-y-1/2 rounded-full bg-cyan-300 shadow-[0_0_6px_2px_rgba(0,212,255,0.5)]" />
        </div>

        {/* 中心パルス */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400/50 animate-pulse shadow-[0_0_20px_6px_rgba(0,212,255,0.3)]" />
        </div>

        {/* 十字線 */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-full h-[0.5px] bg-gradient-to-r from-transparent via-cyan-500/10 to-transparent" />
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-full w-[0.5px] bg-gradient-to-b from-transparent via-cyan-500/10 to-transparent" />
        </div>
      </div>

      {/* テキスト */}
      <div className="text-center">
        <div className="font-mono text-[11px] text-cyan-400/60 tracking-[0.3em] animate-pulse">
          {text}
        </div>
        {subtext && (
          <div className="font-mono text-[10px] text-cyan-500/30 tracking-wider mt-1">
            {subtext}
          </div>
        )}
        <div className="font-mono text-[10px] text-cyan-500/25 tracking-wider mt-1.5">
          PROC:{String(counter).padStart(4, '0')}
        </div>
      </div>
    </div>
  );
}
