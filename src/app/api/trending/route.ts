import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/server-rate-limit';
import { authenticateRequest } from '@/lib/auth';
import { fetchYahooNewsRss } from '@/lib/rss-feeds';
import { fetchGoogleTrends } from '@/lib/google-trends';
import { fetchWikipediaTrends } from '@/lib/wikipedia-trends';
import { fetchYoutubeTrends, formatViewCount } from '@/lib/youtube-trends';
import { fetchNewsApi } from '@/lib/newsapi';
import { fetchGNews } from '@/lib/gnews';
import { fetchXTrends } from '@/lib/x-trends';

// Vercel Function timeout
export const maxDuration = 60;

// サーバーメモリキャッシュ（5分間有効）
let trendingCache: { data: any; timestamp: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000;

export async function GET(request: NextRequest) {
  // 認証 + レート制限
  const auth = await authenticateRequest(request);
  const rateCheck = await checkRateLimit(auth.identifier, '/api/trending', auth.isGuest);
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

  try {
    const now = new Date();
    const todayStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;

    // ========================================
    // 全8データソースを並列取得（いずれか失敗しても他は続行）
    // ========================================
    const [rssResults, googleTrends, wikiTrends, youtubeTrends, newsApiResults, gnewsResults, xTrends] = await Promise.all([
      fetchYahooNewsRss().catch(() => []),
      fetchGoogleTrends().catch(() => []),
      fetchWikipediaTrends().catch(() => []),
      fetchYoutubeTrends().catch(() => []),
      fetchNewsApi().catch(() => ({ japan: [], world: [] })),
      fetchGNews().catch(() => ({ japan: [], entertainment: [] })),
      fetchXTrends().catch(() => []),
    ]);

    // ========================================
    // 各ソースをテキストとしてマージ
    // ========================================
    let mergedText = `${todayStr}の日本のリアルタイムトレンド`;

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

      // TikTokカテゴリにYouTubeショート系を補填
      if (!mergedText.includes('TikTok')) {
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

    // --- GNews（ニュース + エンタメ） ---
    if (gnewsResults.japan.length > 0) {
      const gnewsJpLines = gnewsResults.japan.slice(0, 8).map((item, i) =>
        `${i + 1}. ${item.title}${item.description ? ` - ${item.description.slice(0, 40)}` : ''}`
      );
      mergedText += `\n\nニュース（GNews）\n${gnewsJpLines.join('\n')}`;
    }
    if (gnewsResults.entertainment.length > 0) {
      const gnewsEntLines = gnewsResults.entertainment.slice(0, 8).map((item, i) =>
        `${i + 1}. ${item.title}${item.description ? ` - ${item.description.slice(0, 40)}` : ''}`
      );
      mergedText += `\n\nエンタメ（GNews）\n${gnewsEntLines.join('\n')}`;
    }

    // --- X (Twitter) トレンド ---
    if (xTrends.length > 0) {
      const xLines = xTrends.slice(0, 10).map((item, i) =>
        `${i + 1}. ${item.name}${item.tweetCount ? ` (${item.tweetCount.toLocaleString()}ポスト)` : ''}`
      );
      mergedText += `\n\nSNS（X/Twitterトレンド）\n${xLines.join('\n')}`;
    }

    // ========================================
    // レスポンス構築
    // ========================================
    const result = {
      text: mergedText,
      timestamp: todayStr,
      generatedAt: new Date().toISOString(),
      sources: {
        yahooRss: rssResults.length,
        googleTrends: googleTrends.length,
        wikipedia: wikiTrends.length,
        youtube: youtubeTrends.length,
        newsApiJp: newsApiResults.japan.length,
        newsApiWorld: newsApiResults.world.length,
        gnewsJp: gnewsResults.japan.length,
        gnewsEntertainment: gnewsResults.entertainment.length,
        xTrends: xTrends.length,
      },
    };

    trendingCache = { data: result, timestamp: Date.now() };
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// fetchAiTrending は削除済み — 8つの具体的データソースで十分なカバレッジ
