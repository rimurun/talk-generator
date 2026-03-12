import { NextRequest, NextResponse } from 'next/server';
import { memoryCache } from '@/lib/cache';

export async function DELETE() {
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
