import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/server-rate-limit';
import { fetchYahooNewsRss } from '@/lib/rss-feeds';
import { fetchGoogleTrends } from '@/lib/google-trends';
import { fetchWikipediaTrends } from '@/lib/wikipedia-trends';
import { fetchYoutubeTrends, formatViewCount } from '@/lib/youtube-trends';
import { fetchNewsApi } from '@/lib/newsapi';

// Vercel Function timeout
export const maxDuration = 60;

// サーバーメモリキャッシュ（5分間有効）
let trendingCache: { data: any; timestamp: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000;

export async function GET(request: NextRequest) {
  // レート制限
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';
  const rateCheck = checkRateLimit(ip, '/api/trending');
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

  // キャッシュヒット
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

    // ========================================
    // 全6データソースを並列取得（いずれか失敗しても他は続行）
    // ========================================
    const [aiResponse, rssResults, googleTrends, wikiTrends, youtubeTrends, newsApiResults] = await Promise.all([
      fetchAiTrending(OPENAI_API_KEY, todayStr).catch((err) => {
        console.error('OpenAI trending取得失敗:', err);
        return { text: '' };
      }),
      fetchYahooNewsRss().catch(() => []),
      fetchGoogleTrends().catch(() => []),
      fetchWikipediaTrends().catch(() => []),
      fetchYoutubeTrends().catch(() => []),
      fetchNewsApi().catch(() => ({ japan: [], world: [] })),
    ]);

    // ========================================
    // OpenAIテキストをベースに、他のソースを追記
    // カテゴリ分散: 各カテゴリに十分な件数を確保
    // ========================================
    let mergedText = aiResponse.text;

    // --- Yahoo News RSS（各カテゴリ8件まで） ---
    if (rssResults.length > 0) {
      const rssSection = rssResults.map(feed => {
        const itemLines = feed.items.slice(0, 8).map((item, i) =>
          `${i + 1}. ${item.title}${item.description ? ` - ${item.description.slice(0, 40)}` : ''}`
        );
        return `\n${feed.category}（Yahoo News）\n${itemLines.join('\n')}`;
      }).join('\n');
      mergedText += '\n\n--- Yahoo News 速報 ---' + rssSection;
    }

    // --- Google Trends ---
    if (googleTrends.length > 0) {
      const gtLines = googleTrends.slice(0, 15).map((item, i) =>
        `${i + 1}. ${item.title}${item.description ? ` - ${item.description.slice(0, 40)}` : ''}${item.trafficVolume ? ` (${item.trafficVolume}検索)` : ''}`
      );
      mergedText += `\n\nSNS（Google急上昇）\n${gtLines.join('\n')}`;
    }

    // --- Wikipedia（エンタメ10件 + ニュース5件に分散） ---
    if (wikiTrends.length > 0) {
      const wikiEntertainment = wikiTrends.slice(0, 10);
      const wikiNews = wikiTrends.slice(10, 15);

      const wikiEntLines = wikiEntertainment.map((item, i) =>
        `${i + 1}. ${item.title} - Wikipedia閲覧数${item.views.toLocaleString()}回`
      );
      mergedText += `\n\nエンタメ（Wikipedia注目）\n${wikiEntLines.join('\n')}`;

      if (wikiNews.length > 0) {
        const wikiNewsLines = wikiNews.map((item, i) =>
          `${i + 1}. ${item.title} - Wikipedia閲覧数${item.views.toLocaleString()}回`
        );
        mergedText += `\n\nニュース（Wikipedia話題）\n${wikiNewsLines.join('\n')}`;
      }
    }

    // --- YouTube（エンタメ10件 + SNS5件に分散） ---
    if (youtubeTrends.length > 0) {
      const ytEntertainment = youtubeTrends.slice(0, 10);
      const ytSns = youtubeTrends.slice(10, 15);

      const ytEntLines = ytEntertainment.map((item, i) =>
        `${i + 1}. ${item.title} - ${item.channelTitle}（${formatViewCount(item.viewCount)}再生）`
      );
      mergedText += `\n\nエンタメ（YouTube急上昇）\n${ytEntLines.join('\n')}`;

      if (ytSns.length > 0) {
        const ytSnsLines = ytSns.map((item, i) =>
          `${i + 1}. ${item.title} - ${item.channelTitle}（${formatViewCount(item.viewCount)}再生）`
        );
        mergedText += `\n\nSNS（YouTube話題）\n${ytSnsLines.join('\n')}`;
      }

      // TikTokカテゴリにもYouTubeショート系を補填（OpenAI失敗時の保険）
      if (!aiResponse.text.includes('TikTok')) {
        const ytTikTok = youtubeTrends.slice(5, 12);
        if (ytTikTok.length > 0) {
          const ytTikTokLines = ytTikTok.map((item, i) =>
            `${i + 1}. ${item.title} - ${item.channelTitle}（${formatViewCount(item.viewCount)}再生）`
          );
          mergedText += `\n\nTikTok（動画トレンド）\n${ytTikTokLines.join('\n')}`;
        }
      }
    }

    // --- NewsAPI ---
    if (newsApiResults.japan.length > 0) {
      const jpLines = newsApiResults.japan.slice(0, 8).map((item, i) =>
        `${i + 1}. ${item.title}${item.description ? ` - ${item.description.slice(0, 40)}` : ''}`
      );
      mergedText += `\n\nニュース（NewsAPI）\n${jpLines.join('\n')}`;
    }
    if (newsApiResults.world.length > 0) {
      const worldLines = newsApiResults.world.slice(0, 8).map((item, i) =>
        `${i + 1}. ${item.title}${item.description ? ` - ${item.description.slice(0, 40)}` : ''}`
      );
      mergedText += `\n\n海外おもしろ（国際ニュース）\n${worldLines.join('\n')}`;
    }

    // ========================================
    // レスポンス構築
    // ========================================
    const result = {
      text: mergedText,
      timestamp: todayStr,
      generatedAt: new Date().toISOString(),
      // データソース統計（デバッグ・表示用）
      sources: {
        openai: aiResponse.text.length > 0,
        yahooRss: rssResults.length,
        googleTrends: googleTrends.length,
        wikipedia: wikiTrends.length,
        youtube: youtubeTrends.length,
        newsApiJp: newsApiResults.japan.length,
        newsApiWorld: newsApiResults.world.length,
      },
    };

    trendingCache = { data: result, timestamp: Date.now() };
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// OpenAI web_search_preview でトレンド取得（各カテゴリ8件、15秒タイムアウト）
async function fetchAiTrending(apiKey: string, todayStr: string): Promise<{ text: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    signal: controller.signal,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      tools: [{
        type: 'web_search_preview',
        search_context_size: 'high',
        user_location: {
          type: 'approximate',
          country: 'JP',
          region: '東京都',
          timezone: 'Asia/Tokyo'
        }
      }],
      input: `${todayStr}現在の日本のリアルタイムトレンドをweb検索で取得し、カテゴリ別に各8件リストアップ。

必ず以下の厳密な形式で出力（他のテキストは不要）:

ニュース
1. 実際のニュースタイトル - 内容の具体的な説明（30字以内）
2. 実際のニュースタイトル - 内容の具体的な説明（30字以内）
3. 実際のニュースタイトル - 内容の具体的な説明（30字以内）
4. 実際のニュースタイトル - 内容の具体的な説明（30字以内）
5. 実際のニュースタイトル - 内容の具体的な説明（30字以内）
6. 実際のニュースタイトル - 内容の具体的な説明（30字以内）
7. 実際のニュースタイトル - 内容の具体的な説明（30字以内）
8. 実際のニュースタイトル - 内容の具体的な説明（30字以内）

エンタメ
1. 実際のエンタメタイトル - 内容の具体的な説明（30字以内）
2. 実際のエンタメタイトル - 内容の具体的な説明（30字以内）
3. 実際のエンタメタイトル - 内容の具体的な説明（30字以内）
4. 実際のエンタメタイトル - 内容の具体的な説明（30字以内）
5. 実際のエンタメタイトル - 内容の具体的な説明（30字以内）
6. 実際のエンタメタイトル - 内容の具体的な説明（30字以内）
7. 実際のエンタメタイトル - 内容の具体的な説明（30字以内）
8. 実際のエンタメタイトル - 内容の具体的な説明（30字以内）

SNS
1. 実際のSNS話題タイトル - 内容の具体的な説明（30字以内）
2. 実際のSNS話題タイトル - 内容の具体的な説明（30字以内）
3. 実際のSNS話題タイトル - 内容の具体的な説明（30字以内）
4. 実際のSNS話題タイトル - 内容の具体的な説明（30字以内）
5. 実際のSNS話題タイトル - 内容の具体的な説明（30字以内）
6. 実際のSNS話題タイトル - 内容の具体的な説明（30字以内）
7. 実際のSNS話題タイトル - 内容の具体的な説明（30字以内）
8. 実際のSNS話題タイトル - 内容の具体的な説明（30字以内）

TikTok
1. 実際のTikTok話題タイトル - 内容の具体的な説明（30字以内）
2. 実際のTikTok話題タイトル - 内容の具体的な説明（30字以内）
3. 実際のTikTok話題タイトル - 内容の具体的な説明（30字以内）
4. 実際のTikTok話題タイトル - 内容の具体的な説明（30字以内）
5. 実際のTikTok話題タイトル - 内容の具体的な説明（30字以内）
6. 実際のTikTok話題タイトル - 内容の具体的な説明（30字以内）
7. 実際のTikTok話題タイトル - 内容の具体的な説明（30字以内）
8. 実際のTikTok話題タイトル - 内容の具体的な説明（30字以内）

海外おもしろ
1. 実際の海外話題タイトル - 内容の具体的な説明（30字以内）
2. 実際の海外話題タイトル - 内容の具体的な説明（30字以内）
3. 実際の海外話題タイトル - 内容の具体的な説明（30字以内）
4. 実際の海外話題タイトル - 内容の具体的な説明（30字以内）
5. 実際の海外話題タイトル - 内容の具体的な説明（30字以内）
6. 実際の海外話題タイトル - 内容の具体的な説明（30字以内）
7. 実際の海外話題タイトル - 内容の具体的な説明（30字以内）
8. 実際の海外話題タイトル - 内容の具体的な説明（30字以内）

注意: タイトルは実際のトレンドのみ。「〜についての情報」のような汎用的な説明は禁止。`
    })
  });

  clearTimeout(timeout);

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json();
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

  return { text };
}
