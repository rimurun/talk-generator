import { NextRequest, NextResponse } from 'next/server';
import { generateTopicsWithWebSearch } from '@/lib/openai-responses';
import { BatchGenerationRequest, BatchGenerationResponse } from '@/types';
import { memoryCache, createBatchCacheKey } from '@/lib/cache';

export async function POST(request: NextRequest) {
  try {
    const body: BatchGenerationRequest = await request.json();
    
    if (!body.categories || !Array.isArray(body.categories) || body.categories.length === 0) {
      return NextResponse.json(
        { error: 'カテゴリを少なくとも1つ指定してください' },
        { status: 400 }
      );
    }

    if (!body.count || body.count < 1 || body.count > 20) {
      return NextResponse.json(
        { error: '生成件数は1-20件の範囲で指定してください' },
        { status: 400 }
      );
    }

    // バッチキャッシュチェック
    const batchCacheKey = createBatchCacheKey(body.categories, body.count, body.diversityMode || false);
    const cachedBatch = memoryCache.getBatch(batchCacheKey);
    
    if (cachedBatch) {
      console.log('🎯 バッチキャッシュヒット');
      return NextResponse.json({
        ...cachedBatch,
        cached: true,
        cacheHit: true
      });
    }

    const startTime = Date.now();
    const topicsPerCategory = Math.ceil(body.count / body.categories.length);

    // 🚀 全カテゴリを並列実行（Promise.all）
    const results = await Promise.all(
      body.categories.map(async (category) => {
        try {
          const filters = { ...body.filters, categories: [category] };
          const result = await generateTopicsWithWebSearch(filters);
          return {
            category,
            topics: result.topics.slice(0, Math.max(topicsPerCategory, 5)),
            cost: result.cost,
            cached: result.cached,
            error: null
          };
        } catch (error) {
          console.error(`カテゴリ ${category} の生成でエラー:`, error);
          return { category, topics: [], cost: 0, cached: false, error };
        }
      })
    );

    // 結果を集約
    let allTopics = results.flatMap(r => r.topics);
    const totalCost = results.reduce((sum, r) => sum + r.cost, 0);
    const cacheHits = results.filter(r => r.cached).length;
    const categoryCoverage: Record<string, number> = {};
    results.forEach(r => { categoryCoverage[r.category] = r.topics.length; });

    // 重複除去（多様性モード）
    if (body.diversityMode) {
      const uniqueTopics: typeof allTopics = [];
      const seenTitles = new Set<string>();
      const seenSummaries = new Set<string>();

      for (const topic of allTopics) {
        const titleWords = topic.title.toLowerCase().split(' ').slice(0, 3).join(' ');
        const summaryWords = topic.summary.toLowerCase().split(' ').slice(0, 5).join(' ');

        if (!seenTitles.has(titleWords) && !seenSummaries.has(summaryWords)) {
          uniqueTopics.push(topic);
          seenTitles.add(titleWords);
          seenSummaries.add(summaryWords);
        }
      }
      allTopics = uniqueTopics;
    }

    // 最終件数調整＆品質ソート
    const finalTopics = allTopics
      .sort((a, b) => calculateTopicScore(b) - calculateTopicScore(a))
      .slice(0, body.count);

    const generationTime = Date.now() - startTime;

    const response: BatchGenerationResponse = {
      topics: finalTopics,
      totalCost,
      generationTime,
      categoryCoverage,
      cacheStats: {
        cacheHits,
        totalRequests: body.categories.length,
        cacheHitRate: body.categories.length > 0 ? (cacheHits / body.categories.length) * 100 : 0
      }
    };

    memoryCache.setBatch(batchCacheKey, response);
    return NextResponse.json(response);

  } catch (error) {
    console.error('バッチ生成エラー:', error);
    return NextResponse.json(
      { error: 'バッチ生成中にエラーが発生しました' },
      { status: 500 }
    );
  }
}

function calculateTopicScore(topic: any): number {
  let score = 0;
  switch (topic.riskLevel) {
    case 'low': score += 3; break;
    case 'medium': score += 2; break;
    case 'high': score += 1; break;
  }
  switch (topic.sensitivityLevel) {
    case 1: score += 2; break;
    case 2: score += 3; break;
    case 3: score += 1; break;
  }
  const titleLength = topic.title.length;
  if (titleLength >= 20 && titleLength <= 30) score += 2;
  else if (titleLength >= 15 && titleLength <= 35) score += 1;
  if (topic.summary.length >= 50 && topic.summary.length <= 150) score += 1;
  return score;
}

export async function GET() {
  return NextResponse.json(
    { error: 'このエンドポイントはPOSTメソッドのみサポートしています' },
    { status: 405 }
  );
}