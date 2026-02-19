import { NextRequest, NextResponse } from 'next/server';
import { generateScriptWithCache } from '@/lib/openai-responses';
import { GenerateScriptRequest } from '@/types';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body: GenerateScriptRequest = await request.json();
    
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

    // 台本生成（キャッシュ・コスト対応）
    const result = await generateScriptWithCache(
      body.topic || { id: body.topicId!, title: '', category: 'ニュース', summary: '', sensitivityLevel: 1, riskLevel: 'low' },
      body.duration,
      body.tension,
      body.tone
    );

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

    // OpenAI API エラーの場合
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
      { error: '台本生成中にエラーが発生しました' },
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