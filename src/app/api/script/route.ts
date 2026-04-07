import { NextRequest, NextResponse } from 'next/server';
import { generateScriptWithCache, generateScriptStreaming } from '@/lib/openai-responses';
import { GenerateScriptRequest } from '@/types';
import { checkRateLimit } from '@/lib/server-rate-limit';
import { authenticateRequest } from '@/lib/auth';
import { checkAndIncrementGuestUsage } from '@/lib/guest-limit';
import { checkCostLimit, recordCost } from '@/lib/cost-control';

export const maxDuration = 60;

/**
 * 共通のプリチェック（認証・レート制限・コスト・バリデーション・ゲスト制限）
 * エラー時は NextResponse を返し、成功時は null + パース済みボディ + トピック情報を返す
 */
async function runPreChecks(request: NextRequest): Promise<
  | { error: NextResponse }
  | {
      error: null;
      body: GenerateScriptRequest & { styleProfile?: string };
      topic: {
        id: string;
        title: string;
        category: 'ニュース' | 'エンタメ' | 'SNS' | 'TikTok' | '海外おもしろ' | '事件事故';
        summary: string;
        sensitivityLevel: 1 | 2 | 3;
        riskLevel: 'low' | 'medium' | 'high';
      };
    }
> {
  const auth = await authenticateRequest(request);

  const [rateCheck, costCheck] = await Promise.all([
    checkRateLimit(auth.identifier, '/api/script', auth.isGuest),
    checkCostLimit(),
  ]);
  if (!rateCheck.allowed) {
    return {
      error: NextResponse.json(
        { error: 'リクエスト制限を超えました。しばらくお待ちください。' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rateCheck.resetAt - Date.now()) / 1000)), 'X-RateLimit-Remaining': String(rateCheck.remaining) } }
      ),
    };
  }
  if (!costCheck.allowed) {
    return { error: NextResponse.json({ error: costCheck.reason || 'API使用量が上限に達しました。' }, { status: 429 }) };
  }

  let body: GenerateScriptRequest & { styleProfile?: string };
  try {
    body = await request.json();
  } catch {
    return { error: NextResponse.json({ error: 'リクエストボディの解析に失敗しました' }, { status: 400 }) };
  }

  if (!body.topic && !body.topicId) {
    return { error: NextResponse.json({ error: 'トピック情報またはトピックIDが指定されていません' }, { status: 400 }) };
  }
  if (![15, 60, 180].includes(body.duration)) {
    return { error: NextResponse.json({ error: '尺は15、60、180のいずれかである必要があります' }, { status: 400 }) };
  }
  if (!['low', 'medium', 'high'].includes(body.tension)) {
    return { error: NextResponse.json({ error: 'テンションはlow、medium、highのいずれかである必要があります' }, { status: 400 }) };
  }
  if (typeof body.tone !== 'string' || body.tone.trim() === '') {
    return { error: NextResponse.json({ error: '口調が指定されていません' }, { status: 400 }) };
  }

  if (auth.isGuest) {
    const guestCheck = await checkAndIncrementGuestUsage(auth.ip);
    if (!guestCheck.allowed) {
      return {
        error: NextResponse.json(
          { error: 'ゲストの利用回数上限に達しました。ログインしてご利用ください。', guestLimitReached: true },
          { status: 403 }
        ),
      };
    }
  }

  const topic = body.topic || {
    id: body.topicId || `fallback-${Date.now()}`,
    title: '',
    category: 'ニュース' as const,
    summary: '',
    sensitivityLevel: 1 as const,
    riskLevel: 'low' as const,
  };

  return { error: null, body, topic };
}

export async function POST(request: NextRequest) {
  const preCheck = await runPreChecks(request);
  if (preCheck.error) return preCheck.error;
  const { body, topic } = preCheck;

  const wantsStream = request.headers.get('accept')?.includes('text/event-stream');

  // ========================================
  // SSE ストリーミングモード
  // ========================================
  if (wantsStream) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: Record<string, unknown>) => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
          } catch {
            // ストリームが閉じられた場合は無視
          }
        };

        try {
          const result = await generateScriptStreaming(
            topic,
            body.duration,
            body.tension,
            body.tone,
            body.styleProfile || undefined,
            (token) => send({ type: 'token', text: token })
          );

          if (result.cost > 0) {
            recordCost(result.cost).catch(err => console.error('コスト記録エラー:', err));
          }

          send({
            type: 'done',
            script: result.script,
            cost: result.cost,
            cached: result.cached,
            timestamp: new Date().toISOString(),
          });
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : String(error);
          console.error('台本ストリーミングエラー:', errMsg);
          send({ type: 'error', message: errMsg });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  }

  // ========================================
  // 従来の非ストリーミングモード（後方互換）
  // ========================================
  try {
    const result = await generateScriptWithCache(
      topic,
      body.duration,
      body.tension,
      body.tone,
      body.styleProfile || undefined
    );

    if (result.cost > 0) {
      recordCost(result.cost).catch(err => console.error('コスト記録エラー:', err));
    }

    return NextResponse.json({
      script: result.script,
      cost: result.cost,
      cached: result.cached,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('台本生成エラー:', error);

    if (error instanceof Error && error.message === 'Topic not found') {
      return NextResponse.json({ error: '指定されたトピックが見つかりません' }, { status: 404 });
    }

    const errMsg = error instanceof Error ? error.message : String(error);
    if (errMsg.includes('OpenAI') || errMsg.includes('API') || errMsg.includes('api')) {
      return NextResponse.json(
        { error: 'AI生成サービスでエラーが発生しました。しばらく後に再試行してください。', details: errMsg },
        { status: 503 }
      );
    }

    return NextResponse.json({ error: `台本生成中にエラーが発生しました: ${errMsg}` }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'このエンドポイントはPOSTメソッドのみサポートしています' },
    { status: 405 }
  );
}