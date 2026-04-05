import { NextRequest, NextResponse } from 'next/server';
import { generateScriptWithCache } from '@/lib/openai-responses';
import { GenerateScriptRequest } from '@/types';
import { checkRateLimit } from '@/lib/server-rate-limit';
import { authenticateRequest } from '@/lib/auth';
import { checkAndIncrementGuestUsage } from '@/lib/guest-limit';
import { checkCostLimit, recordCost } from '@/lib/cost-control';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  // 認証チェック
  const auth = await authenticateRequest(request);

  // レート制限 + コスト上限を並列チェック
  const [rateCheck, costCheck] = await Promise.all([
    checkRateLimit(auth.identifier, '/api/script', auth.isGuest),
    checkCostLimit(),
  ]);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'リクエスト制限を超えました。しばらくお待ちください。' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rateCheck.resetAt - Date.now()) / 1000)), 'X-RateLimit-Remaining': String(rateCheck.remaining) } }
    );
  }
  if (!costCheck.allowed) {
    return NextResponse.json({ error: costCheck.reason || 'API使用量が上限に達しました。' }, { status: 429 });
  }

  let body: GenerateScriptRequest & { styleProfile?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'リクエストボディの解析に失敗しました' },
      { status: 400 }
    );
  }

  try {

    // バリデーション
    if (!body.topic && !body.topicId) {
      return NextResponse.json(
        { error: 'トピック情報またはトピックIDが指定されていません' },
        { status: 400 }
      );
    }

    if (![15, 60, 180].includes(body.duration)) {
      return NextResponse.json(
        { error: '尺は15、60、180のいずれかである必要があります' },
        { status: 400 }
      );
    }

    if (!['low', 'medium', 'high'].includes(body.tension)) {
      return NextResponse.json(
        { error: 'テンションはlow、medium、highのいずれかである必要があります' },
        { status: 400 }
      );
    }

    if (typeof body.tone !== 'string' || body.tone.trim() === '') {
      return NextResponse.json(
        { error: '口調が指定されていません' },
        { status: 400 }
      );
    }

    // ゲスト使用回数のアトミックチェック+消費
    if (auth.isGuest) {
      const guestCheck = await checkAndIncrementGuestUsage(auth.ip);
      if (!guestCheck.allowed) {
        return NextResponse.json(
          { error: 'ゲストの利用回数上限に達しました。ログインしてご利用ください。', guestLimitReached: true },
          { status: 403 }
        );
      }
    }

    // トピック情報の構築（topicId単体の場合はフォールバック）
    const topic = body.topic || {
      id: body.topicId || `fallback-${Date.now()}`,
      title: '',
      category: 'ニュース' as const,
      summary: '',
      sensitivityLevel: 1 as const,
      riskLevel: 'low' as const,
    };

    // 台本生成（キャッシュ・コスト対応）。スタイルプロファイルも渡す
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
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('台本生成エラー:', error);

    // トピックが見つからない場合の特別処理
    if (error instanceof Error && error.message === 'Topic not found') {
      return NextResponse.json(
        { error: '指定されたトピックが見つかりません' },
        { status: 404 }
      );
    }

    // OpenAI API エラーの場合（キー無効、レート制限等）
    const errMsg = error instanceof Error ? error.message : String(error);
    if (errMsg.includes('OpenAI') || errMsg.includes('API') || errMsg.includes('api')) {
      return NextResponse.json(
        {
          error: 'AI生成サービスでエラーが発生しました。しばらく後に再試行してください。',
          details: errMsg
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: `台本生成中にエラーが発生しました: ${errMsg}` },
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