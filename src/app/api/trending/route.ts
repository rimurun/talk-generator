import { NextResponse } from 'next/server';

export const maxDuration = 30;

// トレンドデータのキャッシュ（サーバーメモリ、10分間有効）
let trendingCache: { data: any; timestamp: number } | null = null;
const CACHE_TTL = 10 * 60 * 1000; // 10分

export async function GET() {
  // キャッシュチェック
  if (trendingCache && Date.now() - trendingCache.timestamp < CACHE_TTL) {
    return NextResponse.json(trendingCache.data);
  }

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
  }

  try {
    const now = new Date();
    const todayStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        tools: [{ type: 'web_search_preview' }],
        input: `${todayStr}の日本のトレンド・話題を以下のカテゴリ別に各3件ずつリストアップ:
ニュース、エンタメ、SNS、TikTok、海外おもしろ

各項目: タイトル(20字以内)と一行説明(30字以内)のみ。
形式: カテゴリ名の後に番号付きリスト。簡潔に。`
      })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();

    // レスポンスからテキストを抽出
    let text = '';
    if (Array.isArray(data.output)) {
      for (const item of data.output) {
        if (item.type === 'message' && item.content) {
          for (const c of item.content) {
            if (c.type === 'output_text') text = c.text;
          }
        }
      }
    }

    const result = { text, timestamp: todayStr, generatedAt: new Date().toISOString() };
    trendingCache = { data: result, timestamp: Date.now() };

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
