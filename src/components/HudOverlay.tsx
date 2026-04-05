'use client';

import { useState, useEffect } from 'react';

export default function HudOverlay() {
  const [time, setTime] = useState('');
  const [uptime, setUptime] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const update = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('ja-JP', { hour12: false, timeZone: 'Asia/Tokyo' }));
      setUptime(Math.floor((Date.now() - start) / 1000));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatUptime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 pointer-events-none z-40 overflow-hidden">
      {/* 左上: システムステータス */}
      <div className="absolute top-3 left-3 md:top-4 md:left-4 font-mono text-[9px] md:text-[10px] text-cyan-500/30 leading-relaxed select-none">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/70 animate-pulse" />
          <span className="tracking-widest">SYS:ONLINE</span>
        </div>
        <div className="tracking-wider mt-0.5">TALKGEN_v2.0</div>
      </div>

      {/* 右上: 時刻 */}
      <div className="absolute top-3 right-3 md:top-4 md:right-4 font-mono text-[9px] md:text-[10px] text-cyan-500/30 text-right leading-relaxed select-none">
        <div className="tracking-widest">{time} JST</div>
        <div className="tracking-wider mt-0.5">SESSION:{formatUptime(uptime)}</div>
      </div>

      {/* 左下 */}
      <div className="absolute bottom-[4.5rem] md:bottom-4 left-3 md:left-4 font-mono text-[9px] text-cyan-500/20 leading-relaxed select-none hidden md:block">
        <div className="tracking-wider">PROTO:HTTPS/2</div>
        <div className="tracking-wider">EDGE:AP-NE-1</div>
      </div>

      {/* 右下 */}
      <div className="absolute bottom-[4.5rem] md:bottom-4 right-3 md:right-4 font-mono text-[9px] text-cyan-500/20 text-right leading-relaxed select-none hidden md:block">
        <div className="tracking-wider">AI:ACTIVE</div>
        <div className="tracking-wider">CACHE:READY</div>
      </div>

      {/* 四隅のブラケット */}
      <Corner pos="top-2 left-2" borders="border-t border-l" />
      <Corner pos="top-2 right-2" borders="border-t border-r" />
      <Corner pos="bottom-[4rem] md:bottom-2 left-2" borders="border-b border-l" />
      <Corner pos="bottom-[4rem] md:bottom-2 right-2" borders="border-b border-r" />

      {/* 上部のスキャンライン（超薄い） */}
      <div
        className="absolute inset-0"
        style={{
          background: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,212,255,0.008) 3px, rgba(0,212,255,0.008) 4px)',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}

function Corner({ pos, borders }: { pos: string; borders: string }) {
  return <div className={`absolute w-5 h-5 ${borders} border-cyan-500/15 ${pos}`} />;
}
