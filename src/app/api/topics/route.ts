import { NextRequest, NextResponse } from 'next/server';
import { generateTopicsWithWebSearch, generateTopicsStream } from '@/lib/openai-responses';
import { mockTopics } from '@/lib/mock-data';
import { GenerateTopicsRequest, Topic } from '@/types';
import { checkRateLimit } from '@/lib/server-rate-limit';

// Vercel Function timeout (Hobby=60s max)
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  // レート制限チェック
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';
  const rateCheck = checkRateLimit(ip, '/api/topics');
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

  try {
    const body: GenerateTopicsRequest = await request.json();
    
    if (!body.filters) {
      return NextResponse.json(
        { error: 'フィルター条件が指定されていません' },
        { status: 400 }
      );
    }

    const { filters, previousTitles } = body;

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
              // カテゴリ並列分割: 非ストリーミングで並列生成し、結果をSSEで1件ずつ送信
              const chunkSize = Math.ceil(resolvedCategories.length / Math.min(3, resolvedCategories.length));
              const groups: string[][] = [];
              for (let i = 0; i < resolvedCategories.length; i += chunkSize) {
                groups.push(resolvedCategories.slice(i, i + chunkSize));
              }

              const results = await Promise.all(
                groups.map(group =>
                  generateTopicsWithWebSearch(
                    { ...filters, categories: group },
                    previousTitles
                  ).catch(err => {
                    console.error(`ストリーム並列: カテゴリ ${group.join(',')} エラー:`, err);
                    return { topics: [] as Topic[], cost: 0, cached: false };
                  })
                )
              );

              // 重複除去してSSE送信
              const allTopics = results.flatMap(r => r.topics);
              const seen = new Set<string>();
              const uniqueTopics = allTopics.filter(t => {
                const key = t.title.toLowerCase().slice(0, 20);
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
              }).slice(0, 15);

              for (const topic of uniqueTopics) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(topic)}\n\n`));
              }
            } else {
              // 単一カテゴリ: 従来のストリーミング
              for await (const topic of generateTopicsStream(filters, previousTitles)) {
                const data = JSON.stringify(topic);
                controller.enqueue(encoder.encode(`data: ${data}\n\n`));
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
        // カテゴリを2-3グループに分割して並列実行（API呼び出し最小化）
        const chunkSize = Math.ceil(categories.length / Math.min(2, categories.length));
        const groups: string[][] = [];
        for (let i = 0; i < categories.length; i += chunkSize) {
          groups.push(categories.slice(i, i + chunkSize));
        }
        const results = await Promise.all(
          groups.map(group =>
            generateTopicsWithWebSearch(
              { ...filters, categories: group },
              previousTitles
            ).catch(err => {
              console.error(`カテゴリグループ ${group.join(',')} エラー:`, err);
              return { topics: [] as Topic[], cost: 0, cached: false };
            })
          )
        );

        // 結果を集約
        const allTopics = results.flatMap(r => r.topics);
        const totalCost = results.reduce((sum, r) => sum + r.cost, 0);
        const anyCached = results.some(r => r.cached);

        // 重複除去（タイトルベース）
        const seen = new Set<string>();
        const uniqueTopics = allTopics.filter(t => {
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

    return NextResponse.json({
      topics: result.topics,
      cost: result.cost,
      cached: result.cached,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('トピック生成エラー:', error);

    if (error instanceof Error && error.message.includes('OpenAI API')) {
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