// Google Trends — 日本の急上昇ワードを取得（APIキー不要）

export interface GoogleTrendItem {
  title: string;
  description: string;
  trafficVolume: string; // 例: "100,000+"
}

/**
 * Google Trends の日本デイリートレンドを取得
 * google-trends-api パッケージを使用
 */
export async function fetchGoogleTrends(): Promise<GoogleTrendItem[]> {
  try {
    // google-trends-api は CommonJS モジュールのため dynamic import
    const googleTrends = await import('google-trends-api');
    const result = await googleTrends.default.dailyTrends({
      geo: 'JP',
    });

    const parsed = JSON.parse(result);
    const days = parsed?.default?.trendingSearchesDays;
    if (!Array.isArray(days) || days.length === 0) return [];

    const items: GoogleTrendItem[] = [];
    // 直近2日分のトレンドを取得
    for (const day of days.slice(0, 2)) {
      if (!Array.isArray(day.trendingSearches)) continue;
      for (const search of day.trendingSearches) {
        const title = search.title?.query || '';
        const desc = search.articles?.[0]?.title || '';
        const traffic = search.formattedTraffic || '';
        if (title) {
          items.push({
            title: title.slice(0, 60),
            description: desc.slice(0, 80),
            trafficVolume: traffic,
          });
        }
      }
    }

    return items.slice(0, 15);
  } catch (err) {
    console.error('Google Trends取得エラー:', err);
    return [];
  }
}
