import { NextResponse } from 'next/server';
import { getApiUsageStats } from '@/lib/openai-responses';
import { memoryCache } from '@/lib/cache';

export async function GET() {
  try {
    // API使用統計を取得
    const usage = await getApiUsageStats();

    // キャッシュ統計を取得（インメモリ + DB 統合）
    const cacheStats = await memoryCache.getStatsWithDb();

    // 月間コスト推定（1日20回使用想定）
    const dailyCost = usage.estimatedCost * 20;
    const monthlyCost = dailyCost * 30;

    // 使いすぎアラート判定
    const usagePercentage = usage.tokensUsed / usage.tokensLimit;
    const isHighUsage = usagePercentage > 0.8;
    const isVeryHighUsage = usagePercentage > 0.9;

    return NextResponse.json({
      // トークン使用量
      tokensUsed: usage.tokensUsed,
      tokensLimit: usage.tokensLimit,
      tokensPercentage: Math.round(usagePercentage * 100),

      // リクエスト数
      requestsUsed: usage.requestsUsed,
      requestsLimit: usage.requestsLimit,
      requestsPercentage: Math.round((usage.requestsUsed / usage.requestsLimit) * 100),

      // コスト情報
      estimatedCostToday: usage.estimatedCost,
      estimatedCostMonthly: monthlyCost,

      // キャッシュ統計
      cache: {
        hitRate: usage.cacheHitRate,
        totalEntries: cacheStats.totalEntries,
        topicEntries: cacheStats.topicEntries,
        scriptEntries: cacheStats.scriptEntries,
      },

      // アラート
      alerts: {
        highUsage: isHighUsage,
        veryHighUsage: isVeryHighUsage,
        message: isVeryHighUsage ?
          '使用量が90%を超えました。APIの利用を控えることをお勧めします。' :
          isHighUsage ?
          '使用量が80%を超えました。残り使用量にご注意ください。' :
          null
      },

      // 更新日時
      updatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('使用量取得エラー:', error);

    return NextResponse.json(
      { error: '使用量情報の取得中にエラーが発生しました' },
      { status: 500 }
    );
  }
}

export async function POST() {
  return NextResponse.json(
    { error: 'このエンドポイントはGETメソッドのみサポートしています' },
    { status: 405 }
  );
}
