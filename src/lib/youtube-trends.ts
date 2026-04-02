// YouTube Data API v3 — 日本の急上昇動画（無料枠 10,000 units/日）

export interface YoutubeTrendItem {
  title: string;
  channelTitle: string;
  description: string;
  viewCount: string;
  videoId: string;
}

/**
 * YouTube Data API で日本の急上昇動画を取得
 * 環境変数 YOUTUBE_API_KEY が必要
 */
export async function fetchYoutubeTrends(): Promise<YoutubeTrendItem[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    console.log('YouTube API: YOUTUBE_API_KEY が未設定');
    return [];
  }

  try {
    const url = new URL('https://www.googleapis.com/youtube/v3/videos');
    url.searchParams.set('part', 'snippet,statistics');
    url.searchParams.set('chart', 'mostPopular');
    url.searchParams.set('regionCode', 'JP');
    url.searchParams.set('maxResults', '20');
    url.searchParams.set('key', apiKey);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url.toString(), { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      console.error('YouTube API エラー:', res.status);
      return [];
    }

    const data = await res.json();
    if (!Array.isArray(data.items)) return [];

    return data.items.map((item: any) => ({
      title: (item.snippet?.title || '').slice(0, 80),
      channelTitle: (item.snippet?.channelTitle || '').slice(0, 40),
      description: (item.snippet?.description || '').slice(0, 100),
      viewCount: item.statistics?.viewCount || '0',
      videoId: item.id || '',
    }));
  } catch (err) {
    console.error('YouTube Trends取得エラー:', err);
    return [];
  }
}

/**
 * 再生回数を人間が読みやすい形式に変換
 */
export function formatViewCount(count: string): string {
  const n = parseInt(count, 10);
  if (isNaN(n)) return count;
  if (n >= 10_000_000) return `${(n / 10_000_000).toFixed(1)}千万`;
  if (n >= 10_000) return `${(n / 10_000).toFixed(1)}万`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}千`;
  return String(n);
}
