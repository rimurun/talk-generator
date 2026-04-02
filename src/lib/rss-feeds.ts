// Yahoo News RSS フィード取得・パーサー
// APIキー不要、完全無料のデータソース

export interface RssItem {
  title: string;
  description: string;
  link: string;
  pubDate: string;
}

export interface RssFeedResult {
  category: string;
  items: RssItem[];
}

// Yahoo News RSSフィードURL（カテゴリ別）
const YAHOO_RSS_FEEDS: { category: string; url: string }[] = [
  { category: 'ニュース',    url: 'https://news.yahoo.co.jp/rss/topics/top-picks.xml' },
  { category: 'ニュース',    url: 'https://news.yahoo.co.jp/rss/topics/domestic.xml' },
  { category: 'エンタメ',    url: 'https://news.yahoo.co.jp/rss/topics/entertainment.xml' },
  { category: 'エンタメ',    url: 'https://news.yahoo.co.jp/rss/topics/sports.xml' },
  { category: 'SNS',         url: 'https://news.yahoo.co.jp/rss/topics/it.xml' },
  { category: '海外おもしろ', url: 'https://news.yahoo.co.jp/rss/topics/world.xml' },
];

// 簡易XMLパーサー（RSS用、依存ライブラリ不要）
function parseRssXml(xml: string): RssItem[] {
  const items: RssItem[] = [];
  // <item>...</item> ブロックを抽出
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const title = extractTag(block, 'title');
    const description = extractTag(block, 'description');
    const link = extractTag(block, 'link');
    const pubDate = extractTag(block, 'pubDate');
    if (title) {
      items.push({
        title: cleanHtml(title).slice(0, 80),
        description: cleanHtml(description || '').slice(0, 100),
        link: link || '',
        pubDate: pubDate || '',
      });
    }
  }
  return items;
}

// XMLタグの中身を抽出
function extractTag(xml: string, tag: string): string | null {
  // CDATA対応
  const cdataRegex = new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tag}>`, 'i');
  const cdataMatch = xml.match(cdataRegex);
  if (cdataMatch) return cdataMatch[1].trim();

  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : null;
}

// HTMLタグ・エンティティを除去
function cleanHtml(text: string): string {
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 全Yahoo News RSSフィードを並列取得し、カテゴリ別に集約
 * タイムアウト: 5秒（1フィードあたり）
 */
export async function fetchYahooNewsRss(): Promise<RssFeedResult[]> {
  const results = await Promise.allSettled(
    YAHOO_RSS_FEEDS.map(async (feed) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      try {
        const res = await fetch(feed.url, {
          signal: controller.signal,
          headers: { 'User-Agent': 'TalkGenerator/1.0' },
        });
        clearTimeout(timeout);
        if (!res.ok) return { category: feed.category, items: [] as RssItem[] };
        const xml = await res.text();
        return { category: feed.category, items: parseRssXml(xml) };
      } catch {
        clearTimeout(timeout);
        return { category: feed.category, items: [] as RssItem[] };
      }
    })
  );

  // 成功したフィードのみ集約
  const feedResults: RssFeedResult[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value.items.length > 0) {
      feedResults.push(result.value);
    }
  }

  // 同じカテゴリを統合（重複タイトル除去）
  const merged = new Map<string, RssItem[]>();
  for (const feed of feedResults) {
    const existing = merged.get(feed.category) || [];
    for (const item of feed.items) {
      // タイトル先頭20文字で重複チェック
      const key = item.title.slice(0, 20);
      if (!existing.some(e => e.title.slice(0, 20) === key)) {
        existing.push(item);
      }
    }
    merged.set(feed.category, existing);
  }

  return Array.from(merged.entries()).map(([category, items]) => ({
    category,
    // 最新順でソート、最大12件
    items: items
      .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())
      .slice(0, 12),
  }));
}
