// Next.js Middleware: APIエンドポイントへの基本保護
// Edge Runtimeで動作するため、インメモリMapは使用不可
// レート制限は各APIルートハンドラ内で処理する

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // /api/ で始まるリクエストのみ処理
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // OBS Browser Source用エンドポイントはリファラーチェックを免除
  // Stripe WebhookはStripeサーバーからの直接呼び出しのため免除
  const isExemptEndpoint =
    pathname.startsWith('/api/obs') ||
    pathname.startsWith('/api/webhook');

  if (!isExemptEndpoint) {
    const origin = request.headers.get('origin');
    const host = request.headers.get('host');

    // Originヘッダーのチェック
    // - origin が未送信（null）: 同一オリジンGETリクエスト → 許可
    // - origin が文字列 "null": sandboxed iframe CSRF → 拒否
    // - origin が expectedOrigin と不一致: 外部オリジン → 拒否
    if (origin !== null) {
      const expectedOrigin = host
        ? `${request.nextUrl.protocol}//${host}`.replace(/\/$/, '')
        : null;

      if (!expectedOrigin || origin !== expectedOrigin) {
        return NextResponse.json(
          { error: '外部オリジンからのアクセスは許可されていません' },
          { status: 403 }
        );
      }
    }
  }

  // セキュリティヘッダーを付与してリクエストを通過
  const response = NextResponse.next();
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');

  return response;
}

export const config = {
  matcher: '/api/:path*',
};
