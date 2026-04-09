// トレンドテキストのパースロジック
// page.tsx と parse-trending.test.ts の両方から利用する

// カテゴリ順序（表示順を固定）
export const TRENDING_CATEGORY_ORDER = ['ニュース', 'エンタメ', 'SNS', 'TikTok', '海外おもしろ'];

export interface TrendingItem {
  title: string;
  description: string;
}

export interface TrendingCategory {
  name: string;
  items: TrendingItem[];
}

/**
 * AIが生成したトレンドテキストをカテゴリ別にパースする。
 * 各カテゴリ名の後に番号付きリスト形式でアイテムが続く構造を想定。
 *
 * @param text - パース対象のテキスト
 * @returns TrendingCategory の配列
 */
export function parseTrendingText(text: string): TrendingCategory[] {
  const categories: TrendingCategory[] = [];
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  let currentCategory: TrendingCategory | null = null;

  for (const line of lines) {
    // カテゴリ名の検出:
    //   - Markdown太字 「**ニュース**」「## ニュース」なども対応
    const cleanedLine = line.replace(/^#+\s*/, '').replace(/\*+/g, '').trim();
    const catMatch = TRENDING_CATEGORY_ORDER.find(
      cat =>
        cleanedLine === cat ||
        cleanedLine.startsWith(cat + ' ') ||
        cleanedLine.startsWith(cat + '　') ||
        cleanedLine.startsWith(cat + '（')  // 「ニュース（Yahoo News）」形式に対応
    );
    if (catMatch) {
      if (currentCategory && currentCategory.items.length > 0) {
        // 同名カテゴリが既にあれば追記、なければ新規追加
        const existing = categories.find(c => c.name === currentCategory!.name);
        if (existing) {
          for (const item of currentCategory.items) {
            // タイトル先頭20字で重複チェック
            if (!existing.items.some(e => e.title.slice(0, 20) === item.title.slice(0, 20))) {
              existing.items.push(item);
            }
          }
        } else {
          categories.push(currentCategory);
        }
      }
      // 既存カテゴリがあればそこに追記、なければ新規
      const existingCat = categories.find(c => c.name === catMatch);
      currentCategory = existingCat || { name: catMatch, items: [] };
      continue;
    }

    if (!currentCategory) continue;

    // 番号付きリスト行を解析: 1. タイトル - 説明 または 1. タイトル: 説明
    const itemMatch = line.match(/^\d+[.)]\s*(.+)/);
    if (itemMatch) {
      const content = itemMatch[1].trim();
      // タイトルと説明を分離（「 - 」「 — 」「：」「: 」で分割、最初の区切りのみ使用）
      const sepMatch =
        content.match(/^(.+?)\s+[－\-—―]\s+(.+)$/) ||
        content.match(/^(.+?)[：:]\s+(.+)$/);
      if (sepMatch) {
        currentCategory.items.push({
          title: sepMatch[1].trim().slice(0, 50),
          description: sepMatch[2].trim().slice(0, 300),
        });
      } else {
        currentCategory.items.push({
          title: content.slice(0, 50),
          description: '',
        });
      }
    }
  }

  if (currentCategory && currentCategory.items.length > 0) {
    // 同名カテゴリが既にあれば追記、なければ新規追加
    const existing = categories.find(c => c.name === currentCategory!.name);
    if (existing) {
      for (const item of currentCategory.items) {
        if (!existing.items.some(e => e.title.slice(0, 20) === item.title.slice(0, 20))) {
          existing.items.push(item);
        }
      }
    } else {
      categories.push(currentCategory);
    }
  }

  return categories;
}
