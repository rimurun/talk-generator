import { NextRequest, NextResponse } from 'next/server';
import { generateTopicsWithWebSearch } from '@/lib/openai-responses';
import { mockTopics } from '@/lib/mock-data';
import { GenerateTopicsRequest } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body: GenerateTopicsRequest = await request.json();
    
    // バリデーション
    if (!body.filters) {
      return NextResponse.json(
        { error: 'フィルター条件が指定されていません' },
        { status: 400 }
      );
    }

    const { filters } = body;

    // フィルター条件の検証
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

    // トピック生成（キャッシュ・コスト対応）
    let result;
    
    try {
      result = await generateTopicsWithWebSearch(filters);
    } catch (webSearchError) {
      // WebSearch APIが失敗した場合、mock dataにfallback
      console.log('WebSearch API failed, using mock data:', webSearchError);
      
      let filteredTopics = mockTopics;

      // Category filter
      if (filters.categories.length > 0) {
        filteredTopics = filteredTopics.filter(topic => 
          filters.categories.includes(topic.category)
        );
      }

      // Incident filter
      if (!filters.includeIncidents) {
        filteredTopics = filteredTopics.filter(topic => 
          topic.category !== '事件事故'
        );
      }

      // Risk level adjustment based on tension
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
    
    // OpenAI API エラーの場合、より詳細なメッセージ
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