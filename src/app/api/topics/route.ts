import { NextRequest, NextResponse } from 'next/server';
import { generateTopicsWithWebSearch } from '@/lib/openai-responses';
import { mockTopics } from '@/lib/mock-data';
import { GenerateTopicsRequest, Topic } from '@/types';
import { checkRateLimit } from '@/lib/server-rate-limit';
import { authenticateRequest } from '@/lib/auth';
import { checkAndIncrementGuestUsage } from '@/lib/guest-limit';
import { checkCostLimit, recordCost } from '@/lib/cost-control';

// Vercel Function timeout (Hobby=60s max)
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  // 認証チェック
  const auth = await authenticateRequest(request);

  // レート制限 + コスト上限を並列チェック（DB往復を削減）
  const [rateCheck, costCheck] = await Promise.all([
    checkRateLimit(auth.identifier, '/api/topics', auth.isGuest),
    checkCostLimit(),
  ]);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'リクエスト制限を超えました。しばらくお待ちください。' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil((rateCheck.resetAt - Date.now()) / 1000)),
          'X-RateLimit-Remaining': String(rateCheck.remaining),
        },
      }
    );
  }
  if (!costCheck.allowed) {
    return NextResponse.json(
      { error: costCheck.reason || 'API使用量が上限に達しました。' },
      { status: 429 }
    );
  }

  try {
    const body: GenerateTopicsRequest = await request.json();
    
    if (!body.filters) {
      return NextResponse.json(
        { error: 'フィルター条件が指定されていません' },
        { status: 400 }
      );
    }

    const { filters, previousTitles } = body;

    // ゲスト使用回数のアトミックチェック+消費（バリデーション後に実行）
    if (auth.isGuest) {
      const guestCheck = await checkAndIncrementGuestUsage(auth.ip);
      if (!guestCheck.allowed) {
        return NextResponse.json(
          { error: 'ゲストの利用回数上限に達しました。ログインしてご利用ください。', guestLimitReached: true, remaining: guestCheck.remaining },
          { status: 403 }
        );
      }
    }

    // ストリーミングモード: クライアントにトピックをSSE形式で1件ずつ配信
    if (body.stream === true) {
      // バリデーション（ストリーミング前に実施）
      if (!Array.isArray(filters.categories) ||
          ![15, 60, 180].includes(filters.duration) ||
          !['low', 'medium', 'high'].includes(filters.tension) ||
          typeof filters.tone !== 'string' || filters.tone.trim() === '') {
        return NextResponse.json({ error: 'フィルター条件が不正です' }, { status: 400 });
      }

      // カテゴリ未選択時は全カテゴリ展開（ニュース偏り防止）
      const defaultCategories = ['ニュース', 'エンタメ', 'SNS', 'TikTok', '海外おもしろ'];
      const resolvedCategories = filters.categories.length > 0
        ? filters.categories
        : (filters.includeIncidents ? [...defaultCategories, '事件事故'] : defaultCategories);
      const useParallelMode = resolvedCategories.length >= 2;

      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          try {
            if (useParallelMode) {
              // 1カテゴリ1グループで並列生成（singleCategoryInstructionが発動し偏り防止）
              const results = await Promise.all(
                resolvedCategories.map(cat =>
                  generateTopicsWithWebSearch(
                    { ...filters, categories: [cat] },
                    previousTitles
                  ).catch(err => {
                    console.error(`ストリーム並列: カテゴリ ${cat} エラー:`, err);
                    return { topics: [] as Topic[], cost: 0, cached: false };
                  })
                )
              );

              // 各カテゴリから均等にピックしてバランスを保つ
              const perCat = Math.ceil(15 / results.length);
              const balancedTopics = results.flatMap(r => r.topics.slice(0, perCat));

              // 重複除去してSSE送信
              const seen = new Set<string>();
              const uniqueTopics = balancedTopics.filter(t => {
                const key = t.title.toLowerCase().slice(0, 20);
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
              }).slice(0, 15);

              for (const topic of uniqueTopics) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(topic)}\n\n`));
              }
            } else {
              // 単一カテゴリ: 非ストリーミングで生成しSSE配信
              const result = await generateTopicsWithWebSearch(filters, previousTitles);
              for (const topic of result.topics) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(topic)}\n\n`));
              }
            }
            // 完了シグナル
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
          } catch (error) {
            console.error('ストリーミング生成エラー:', error);
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ error: '生成中にエラーが発生しました' })}\n\n`)
            );
            controller.close();
          }
        }
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    if (!Array.isArray(filters.categories)) {
      return NextResponse.json(
        { error: 'カテゴリは配列である必要があります' },
        { status: 400 }
      );
    }

    if (![15, 60, 180].includes(filters.duration)) {
      return NextResponse.json(
        { error: '尺は15、60、180のいずれかである必要があります' },
        { status: 400 }
      );
    }

    if (!['low', 'medium', 'high'].includes(filters.tension)) {
      return NextResponse.json(
        { error: 'テンションはlow、medium、highのいずれかである必要があります' },
        { status: 400 }
      );
    }

    if (typeof filters.tone !== 'string' || filters.tone.trim() === '') {
      return NextResponse.json(
        { error: '口調が指定されていません' },
        { status: 400 }
      );
    }

    let result;

    try {
      // 🚀 並列化: カテゴリが2つ以上なら分割して同時実行
      // カテゴリ未選択時は全カテゴリを展開して並列化（ニュース偏り防止）
      const allCategories = ['ニュース', 'エンタメ', 'SNS', 'TikTok', '海外おもしろ'];
      const categories = filters.categories.length > 0
        ? filters.categories
        : (filters.includeIncidents ? [...allCategories, '事件事故'] : allCategories);

      if (categories.length >= 2) {
        // 1カテゴリ1グループで並列実行（singleCategoryInstructionが発動し偏り防止）
        const results = await Promise.all(
          categories.map(cat =>
            generateTopicsWithWebSearch(
              { ...filters, categories: [cat] },
              previousTitles
            ).catch(err => {
              console.error(`カテゴリ ${cat} エラー:`, err);
              return { topics: [] as Topic[], cost: 0, cached: false };
            })
          )
        );

        // 各カテゴリから均等にピックしてバランスを保つ
        const perCat = Math.ceil(15 / results.length);
        const balancedTopics = results.flatMap(r => r.topics.slice(0, perCat));
        const totalCost = results.reduce((sum, r) => sum + r.cost, 0);
        const anyCached = results.some(r => r.cached);

        // 重複除去（タイトルベース）
        const seen = new Set<string>();
        const uniqueTopics = balancedTopics.filter(t => {
          const key = t.title.toLowerCase().slice(0, 20);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        result = {
          topics: uniqueTopics.slice(0, 15),
          cost: totalCost,
          cached: anyCached && results.every(r => r.cached)
        };
      } else {
        // 単一カテゴリはそのまま
        result = await generateTopicsWithWebSearch(filters, previousTitles);
      }
    } catch (webSearchError) {
      console.log('WebSearch API failed, using mock data:', String(webSearchError));

      let filteredTopics = [...mockTopics];

      if (filters.categories.length > 0) {
        filteredTopics = filteredTopics.filter(topic =>
          filters.categories.includes(topic.category)
        );
      }

      if (!filters.includeIncidents) {
        filteredTopics = filteredTopics.filter(topic =>
          topic.category !== '事件事故'
        );
      }

      if (filters.tension === 'low') {
        filteredTopics = filteredTopics.filter(topic =>
          topic.riskLevel !== 'high'
        );
      }

      result = {
        topics: filteredTopics.slice(0, 15),
        cost: 0,
        cached: false
      };
    }

    // コスト記録
    if (result.cost > 0) {
      recordCost(result.cost).catch(err => console.error('コスト記録エラー:', err));
    }

    return NextResponse.json({
      topics: result.topics,
      cost: result.cost,
      cached: result.cached,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('トピック生成エラー:', error);

    if (error instanceof Error && (error.message.includes('Perplexity API') || error.message.includes('OpenAI API'))) {
      return NextResponse.json(
        {
          error: 'AI生成サービスでエラーが発生しました。しばらく後に再試行してください。',
          details: error.message
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: 'トピック生成中にエラーが発生しました' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'このエンドポイントはPOSTメソッドのみサポートしています' },
    { status: 405 }
  );
}