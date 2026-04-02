'use client';

// ページ遷移アニメーションラッパーコンポーネント
// framer-motion不使用・CSSアニメーションのみで軽量に実装

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

interface PageTransitionProps {
  children: React.ReactNode;
}

export default function PageTransition({ children }: PageTransitionProps) {
  const pathname = usePathname();
  // アニメーションのトリガー用キー（パス変更ごとに更新）
  const [animKey, setAnimKey] = useState(pathname);
  const prevPathRef = useRef(pathname);

  useEffect(() => {
    // パスが変わったときのみアニメーションを再トリガー
    if (prevPathRef.current !== pathname) {
      prevPathRef.current = pathname;
      setAnimKey(pathname);
    }
  }, [pathname]);

  return (
    <div
      key={animKey}
      className="page-transition-enter"
    >
      {children}
    </div>
  );
}
