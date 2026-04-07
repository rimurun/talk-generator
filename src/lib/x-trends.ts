// X (Twitter) Trends — 日本のトレンドを取得（API v2）

export interface XTrendItem {
  name: string;
  tweetCount?: number;
}

/**
 * X API v2 を使って日本のトレンドを取得
 * 環境変数 X_API_BEARER_TOKEN が未設定の場合は空配列を返す
 */
export async function fetchXTrends(): Promise<XTrendItem[]> {
  const token = process.env.X_API_BEARER_TOKEN;
  if (!token) {
    console.log('X_API_BEARER_TOKEN が未設定のため、Xトレンドの取得をスキップします');
    return [];
  }

  try {
    // 8秒タイムアウト
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    // 日本の WOEID: 23424856
    const url = 'https://api.x.com/2/trends/by/woeid/23424856';

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      console.error(`Xトレンド取得エラー: HTTP ${res.status} ${res.statusText}`);
      return [];
    }

    const data = await res.json();
    const trends = data?.data;
    if (!Array.isArray(trends) || trends.length === 0) return [];

    // trend_name と tweet_count を抽出し、最大15件に制限
    const items: XTrendItem[] = [];
    for (const trend of trends) {
      const name = trend.trend_name;
      if (!name) continue;

      items.push({
        name: String(name).slice(0, 80),
        tweetCount: trend.tweet_count != null ? Number(trend.tweet_count) : undefined,
      });

      if (items.length >= 15) break;
    }

    return items;
  } catch (err) {
    // AbortError を含む全エラーをキャッチし、空配列で返す
    console.error('Xトレンド取得エラー:', err);
    return [];
  }
}
