'use client';

import { useState, useEffect, useRef } from 'react';

const GLITCH_CHARS = 'アイウエオカキクケコ01234789@#$%&<>{}[]';

interface Props {
  text: string;
  className?: string;
  speed?: number;
}

/**
 * テキストがランダム文字からデコードされるように表示されるSFエフェクト
 */
export default function GlitchText({ text, className = '', speed = 35 }: Props) {
  const [display, setDisplay] = useState('');
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (hasAnimated.current) {
      setDisplay(text);
      return;
    }
    hasAnimated.current = true;

    let iteration = 0;
    const chars = text.split('');
    const interval = setInterval(() => {
      setDisplay(
        chars.map((char, i) => {
          if (char === ' ' || char === '、' || char === '？') return char;
          if (i < iteration) return char;
          return GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)];
        }).join('')
      );
      iteration += 0.4;
      if (iteration >= chars.length) {
        clearInterval(interval);
        setDisplay(text);
      }
    }, speed);

    return () => clearInterval(interval);
  }, [text, speed]);

  return <span className={className}>{display}</span>;
}
