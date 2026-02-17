import { NextRequest, NextResponse } from 'next/server';
import { generateTopicsWithWebSearch } from '@/lib/openai-responses';
import { BatchGenerationRequest, BatchGenerationResponse } from '@/types';
import { memoryCache, createBatchCacheKey } from '@/lib/cache';

export async function POST(request: NextRequest) {
  try {
    const body: BatchGenerationRequest = await request.json();
    
    // バリデーション
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

    // バッチキャッシュチェック（新機能）
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
    let allTopics: any[] = [];
    let totalCost = 0;
    let cacheHits = 0;
    const categoryCoverage: Record<string, number> = {};

    // 各カテゴリから均等に取得するロジック
    const topicsPerCategory = Math.ceil(body.count / body.categories.length);
    
    for (const category of body.categories) {
      try {
        const filters = {
          ...body.filters,
          categories: [category]
        };

        const result = await generateTopicsWithWebSearch(filters);
        
        // キャッシュヒット数をカウント
        if (result.cached) {
          cacheHits++;
        }
        
        // カテゴリごとの取得件数を制限
        const topicsToAdd = result.topics.slice(0, topicsPerCategory);
        allTopics = allTopics.concat(topicsToAdd);
        totalCost += result.cost;
        categoryCoverage[category] = topicsToAdd.length;

        // レート制限対策で少し待機
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (error) {
        console.error(`カテゴリ ${category} の生成でエラー:`, error);
        categoryCoverage[category] = 0;
      }
    }

    // 重複除去（多様性モード）
    if (body.diversityMode) {
      const uniqueTopics = [];
      const seenTitles = new Set();
      const seenSummaries = new Set();

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

    // 最終的な件数調整
    const finalTopics = allTopics.slice(0, body.count);
    
    // 品質スコアによるソート（リスクレベル、感度レベル、カテゴリバランスを考慮）
    finalTopics.sort((a, b) => {
      const scoreA = calculateTopicScore(a);
      const scoreB = calculateTopicScore(b);
      return scoreB - scoreA;
    });

    const generationTime = Date.now() - startTime;

    const response: BatchGenerationResponse = {
      topics: finalTopics,
      totalCost,
      generationTime,
      categoryCoverage,
      // キャッシュ統計を追加
      cacheStats: {
        cacheHits,
        totalRequests: body.categories.length,
        cacheHitRate: body.categories.length > 0 ? (cacheHits / body.categories.length) * 100 : 0
      }
    };

    // バッチ結果をキャッシュに保存（新機能）
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

/**
 * トピックの品質スコアを計算
 */
function calculateTopicScore(topic: any): number {
  let score = 0;
  
  // リスクレベルによる調整（低リスクほど高得点）
  switch (topic.riskLevel) {
    case 'low': score += 3; break;
    case 'medium': score += 2; break;
    case 'high': score += 1; break;
  }
  
  // 感度レベルによる調整（適度な感度が理想）
  switch (topic.sensitivityLevel) {
    case 1: score += 2; break;
    case 2: score += 3; break;
    case 3: score += 1; break;
  }
  
  // タイトルの長さによる調整（20-30文字が理想）
  const titleLength = topic.title.length;
  if (titleLength >= 20 && titleLength <= 30) {
    score += 2;
  } else if (titleLength >= 15 && titleLength <= 35) {
    score += 1;
  }
  
  // 要約の長さによる調整
  const summaryLength = topic.summary.length;
  if (summaryLength >= 50 && summaryLength <= 150) {
    score += 1;
  }
  
  return score;
}

export async function GET() {
  return NextResponse.json(
    { error: 'このエンドポイントはPOSTメソッドのみサポートしています' },
    { status: 405 }
  );
}