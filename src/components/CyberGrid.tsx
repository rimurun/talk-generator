'use client';

/**
 * Tron風のパースペクティブグリッド（画面下部）
 */
export default function CyberGrid() {
  return (
    <div
      className="fixed bottom-0 left-0 right-0 pointer-events-none z-0"
      style={{
        height: '35vh',
        background: `
          linear-gradient(rgba(0,212,255,0.04) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0,212,255,0.04) 1px, transparent 1px)
        `,
        backgroundSize: '50px 50px',
        transform: 'perspective(400px) rotateX(55deg)',
        transformOrigin: 'bottom center',
        maskImage: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 80%)',
        WebkitMaskImage: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 80%)',
      }}
      aria-hidden="true"
    />
  );
}
