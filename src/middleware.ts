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

    // Originヘッダーが存在する場合、自サイトと一致するか確認
    // null（同一オリジンのフォームやナビゲーション）は許可
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
