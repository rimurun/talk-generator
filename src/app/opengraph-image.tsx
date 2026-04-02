import { ImageResponse } from 'next/og';

// Edge Runtimeで動作（外部フォント読み込みなし）
export const runtime = 'edge';
export const alt = 'トーク生成ツール - 配信用リアルタイム・トーク生成';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #0a0a1a 0%, #1e1b4b 50%, #0a0a1a 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Zap アイコン風の装飾 */}
        <div
          style={{
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            padding: '20px',
            borderRadius: '24px',
            marginBottom: '30px',
            display: 'flex',
          }}
        >
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
        </div>
        <div
          style={{
            fontSize: 64,
            fontWeight: 800,
            color: 'white',
            marginBottom: '16px',
            display: 'flex',
          }}
        >
          TalkGen
        </div>
        <div
          style={{
            fontSize: 28,
            color: '#94a3b8',
            display: 'flex',
          }}
        >
          配信用リアルタイム・トーク生成ツール
        </div>
      </div>
    ),
    { ...size }
  );
}
