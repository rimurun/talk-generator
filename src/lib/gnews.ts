// GNews API v4 — 日本語ニュース取得（一般 + エンタメ）

export interface GNewsItem {
  title: string;
  description: string;
  source: string;
  url: string;
  publishedAt: string; // ISO 8601 UTC
  image?: string;
}

/**
 * GNews API で日本語のトップヘッドラインを取得
 * 環境変数 GNEWS_API_KEY が必要
 */
export async function fetchGNews(): Promise<{ japan: GNewsItem[]; entertainment: GNewsItem[] }> {
  const apiKey = process.env.GNEWS_API_KEY;
  if (!apiKey) {
    console.log('GNews: GNEWS_API_KEY が未設定');
    return { japan: [], entertainment: [] };
  }

  try {
    // 一般ニュースとエンタメニュースを並列取得（2リクエスト/呼び出し）
    const [japanRes, entertainmentRes] = await Promise.allSettled([
      fetchHeadlines(apiKey, 'general', 10),
      fetchHeadlines(apiKey, 'entertainment', 10),
    ]);

    return {
      japan: japanRes.status === 'fulfilled' ? japanRes.value : [],
      entertainment: entertainmentRes.status === 'fulfilled' ? entertainmentRes.value : [],
    };
  } catch (err) {
    console.error('GNews取得エラー:', err);
    return { japan: [], entertainment: [] };
  }
}

async function fetchHeadlines(
  apiKey: string,
  category: string,
  max: number,
): Promise<GNewsItem[]> {
  const url = new URL('https://gnews.io/api/v4/top-headlines');
  url.searchParams.set('category', category);
  url.searchParams.set('lang', 'ja');
  url.searchParams.set('country', 'jp');
  url.searchParams.set('max', String(max));
  url.searchParams.set('apikey', apiKey);

  // 8秒でタイムアウト
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  const res = await fetch(url.toString(), { signal: controller.signal });
  clearTimeout(timeout);

  if (!res.ok) {
    console.error(`GNews (${category}) エラー:`, res.status);
    return [];
  }

  const data = await res.json();
  if (!Array.isArray(data.articles)) return [];

  return data.articles
    .filter((a: any) => a.title)
    .map((a: any) => ({
      title: (a.title || '').slice(0, 80),
      description: (a.description || '').slice(0, 120),
      source: a.source?.name || '',
      url: a.url || '',
      publishedAt: a.publishedAt || '',
      ...(a.image ? { image: a.image } : {}),
    }));
}
