// Google Trends — 日本の急上昇ワードを取得（RSS フィード、APIキー不要）

export interface GoogleTrendItem {
  title: string;
  description: string;
  trafficVolume: string; // 例: "200+"
}

/**
 * Google Trends の日本デイリートレンドを RSS フィードから取得
 * 外部パッケージ不要、標準 fetch のみ使用
 */
export async function fetchGoogleTrends(): Promise<GoogleTrendItem[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch('https://trends.google.co.jp/trending/rss?geo=JP', {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      console.error(`Google Trends RSS エラー: HTTP ${res.status}`);
      return [];
    }

    const xml = await res.text();
    return parseRssItems(xml).slice(0, 15);
  } catch (err) {
    console.error('Google Trends取得エラー:', err);
    return [];
  }
}

/** RSS XML から <item> を正規表現でパース */
function parseRssItems(xml: string): GoogleTrendItem[] {
  const items: GoogleTrendItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;

  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];

    const title = extractTag(block, 'title');
    if (!title) continue;

    // <ht:approx_traffic> からトラフィック量を取得
    const traffic = extractTag(block, 'ht:approx_traffic') || '';

    // <ht:news_item_title> から関連ニュースのタイトルを取得（概要として使用）
    const newsTitle = extractTag(block, 'ht:news_item_title') || '';

    items.push({
      title: title.slice(0, 60),
      description: newsTitle.slice(0, 80),
      trafficVolume: traffic,
    });
  }

  return items;
}

/** XML タグの中身を抽出するヘルパー */
function extractTag(xml: string, tag: string): string {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`<${escaped}>([^<]*)</${escaped}>`);
  const m = xml.match(regex);
  return m ? m[1].trim() : '';
}
