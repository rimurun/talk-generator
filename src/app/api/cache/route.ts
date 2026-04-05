import { NextRequest, NextResponse } from 'next/server';
import { memoryCache } from '@/lib/cache';
import { authenticateRequest } from '@/lib/auth';

export async function DELETE(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (auth.isGuest) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }

  try {
    // キャッシュクリア実行（インメモリ + DB 両方）
    memoryCache.clear();

    return NextResponse.json({
      success: true,
      message: 'キャッシュを正常にクリアしました',
      clearedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('キャッシュクリアエラー:', error);

    return NextResponse.json(
      { error: 'キャッシュクリア中にエラーが発生しました' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    // キャッシュ統計を取得（インメモリ + DB 統合）
    const stats = await memoryCache.getStatsWithDb();

    return NextResponse.json({
      cache: stats,
      updatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('キャッシュ統計取得エラー:', error);

    return NextResponse.json(
      { error: 'キャッシュ統計取得中にエラーが発生しました' },
      { status: 500 }
    );
  }
}

export async function POST() {
  return NextResponse.json(
    { error: 'このエンドポイントはGETまたはDELETEメソッドをサポートしています' },
    { status: 405 }
  );
}
