'use client';

import { useState, useEffect } from 'react';

const CHARS = '01アイウエオ<>{}[]#$%&@カキクケコ';

function randomChar() {
  return CHARS[Math.floor(Math.random() * CHARS.length)];
}

function StreamColumn({ delay, side }: { delay: number; side: 'left' | 'right' }) {
  const [chars, setChars] = useState<string[]>([]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      const initial = Array.from({ length: 20 }, () => randomChar());
      setChars(initial);
      const interval = setInterval(() => {
        setChars(prev => {
          const next = [...prev];
          const idx = Math.floor(Math.random() * next.length);
          next[idx] = randomChar();
          return next;
        });
      }, 150);
      return () => clearInterval(interval);
    }, delay);
    return () => clearTimeout(timeout);
  }, [delay]);

  return (
    <div
      className={`fixed top-0 ${side === 'left' ? 'left-1' : 'right-1'} z-30 pointer-events-none font-mono text-[8px] leading-[12px] select-none hidden lg:block`}
      style={{
        color: 'rgba(0,212,255,0.08)',
        writingMode: 'vertical-rl',
        height: '100vh',
        overflow: 'hidden',
      }}
    >
      {chars.map((c, i) => (
        <span key={i} style={{ opacity: 0.3 + Math.random() * 0.7 }}>{c}</span>
      ))}
    </div>
  );
}

export default function DataStream() {
  return (
    <>
      <StreamColumn delay={0} side="left" />
      <StreamColumn delay={500} side="right" />
    </>
  );
}
