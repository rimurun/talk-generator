// Wikipedia Pageviews API — 日本語Wikipediaで最も閲覧されたページ（完全無料）

export interface WikiTrendItem {
  title: string;
  views: number;
}

/**
 * 日本語Wikipediaの前日のページビューTop記事を取得
 * メインページやSpecialページは除外
 */
export async function fetchWikipediaTrends(): Promise<WikiTrendItem[]> {
  try {
    // 前日の日付を YYYY/MM/DD 形式で取得
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const y = yesterday.getFullYear();
    const m = String(yesterday.getMonth() + 1).padStart(2, '0');
    const d = String(yesterday.getDate()).padStart(2, '0');

    const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/top/ja.wikipedia/all-access/${y}/${m}/${d}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'TalkGenerator/1.0 (contact: support@talkgen.app)',
      },
    });
    clearTimeout(timeout);

    if (!res.ok) return [];
    const data = await res.json();

    const articles = data?.items?.[0]?.articles;
    if (!Array.isArray(articles)) return [];

    // メインページ、Special、Wikipedia名前空間を除外
    const excludePatterns = [
      'メインページ',
      'Main_Page',
      'Special:',
      'Wikipedia:',
      'Help:',
      'Template:',
      'Category:',
      'Portal:',
      'ファイル:',
    ];

    const items: WikiTrendItem[] = [];
    for (const article of articles) {
      const title = (article.article || '').replace(/_/g, ' ');
      if (!title) continue;
      if (excludePatterns.some(p => title.startsWith(p))) continue;

      items.push({
        title: title.slice(0, 60),
        views: article.views || 0,
      });

      if (items.length >= 20) break;
    }

    return items;
  } catch (err) {
    console.error('Wikipedia Trends取得エラー:', err);
    return [];
  }
}
