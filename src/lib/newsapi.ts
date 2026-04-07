// NewsAPI.org — 海外ニュース取得（日本ニュースは GNews + Yahoo RSS でカバー）

export interface NewsApiItem {
  title: string;
  description: string;
  source: string;
  url: string;
  publishedAt: string;
}

/**
 * NewsAPI で海外トップヘッドラインを取得
 * 環境変数 NEWS_API_KEY が必要
 */
export async function fetchNewsApi(): Promise<{ japan: NewsApiItem[]; world: NewsApiItem[] }> {
  const apiKey = process.env.NEWS_API_KEY;
  if (!apiKey) {
    console.log('NewsAPI: NEWS_API_KEY が未設定');
    return { japan: [], world: [] };
  }

  try {
    // 米国ニュース：一般＋テクノロジーを並列取得
    const [generalRes, techRes] = await Promise.allSettled([
      fetchHeadlines(apiKey, 'us', 'general', 10),
      fetchHeadlines(apiKey, 'us', 'technology', 8),
    ]);

    return {
      japan: [], // 日本ニュースは GNews + Yahoo RSS に委譲
      world: [
        ...(generalRes.status === 'fulfilled' ? generalRes.value : []),
        ...(techRes.status === 'fulfilled' ? techRes.value : []),
      ],
    };
  } catch (err) {
    console.error('NewsAPI取得エラー:', err);
    return { japan: [], world: [] };
  }
}

async function fetchHeadlines(
  apiKey: string,
  country: string,
  category: string,
  pageSize: number,
): Promise<NewsApiItem[]> {
  const url = new URL('https://newsapi.org/v2/top-headlines');
  url.searchParams.set('country', country);
  url.searchParams.set('category', category);
  url.searchParams.set('pageSize', String(pageSize));
  url.searchParams.set('apiKey', apiKey);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  const res = await fetch(url.toString(), { signal: controller.signal });
  clearTimeout(timeout);

  if (!res.ok) {
    console.error(`NewsAPI (${country}/${category}) エラー:`, res.status);
    return [];
  }

  const data = await res.json();
  if (data.status !== 'ok' || !Array.isArray(data.articles)) return [];

  return data.articles
    .filter((a: any) => a.title && a.title !== '[Removed]')
    .map((a: any) => ({
      title: (a.title || '').slice(0, 80),
      description: (a.description || '').slice(0, 120),
      source: a.source?.name || '',
      url: a.url || '',
      publishedAt: a.publishedAt || '',
    }));
}
