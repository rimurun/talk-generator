// システムレベルのNGワード定義（カテゴリ別）
// ユーザー設定のNGワードとは独立して、サービス全体に適用される
const SYSTEM_NG_WORDS: { category: string; words: string[] }[] = [
  {
    category: '差別・ヘイト',
    words: [
      // 差別的表現（日本語）
      '殺せ', '死ね', '氏ね',
    ],
  },
  {
    category: '犯罪助長',
    words: [
      '爆弾の作り方', '殺人方法', '自殺方法', '薬物の入手',
    ],
  },
  {
    category: '個人情報',
    words: [
      '住所を特定', '電話番号を晒', '個人情報を公開',
    ],
  },
];

// フラット化したNGワードリスト（照合用）
const FLAT_NG_WORDS = SYSTEM_NG_WORDS.flatMap(cat =>
  cat.words.map(word => ({ word: word.toLowerCase(), category: cat.category }))
);

export interface ModerationResult {
  safe: boolean;
  flaggedWords: { word: string; category: string }[];
}

/**
 * テキストのモデレーションチェック
 * NGワードが含まれていればフラグを立てて返す
 */
export function moderateContent(text: string): ModerationResult {
  if (!text) return { safe: true, flaggedWords: [] };

  const lowerText = text.toLowerCase();
  const flagged: { word: string; category: string }[] = [];

  for (const { word, category } of FLAT_NG_WORDS) {
    if (lowerText.includes(word)) {
      flagged.push({ word, category });
    }
  }

  return {
    safe: flagged.length === 0,
    flaggedWords: flagged,
  };
}

/**
 * 生成されたトピック配列のフィルタリング
 * NGワードを含むトピックを除外し、除外件数を返す
 * ジェネリック型で title と summary? を持つ任意のオブジェクトに適用可能
 */
export function filterTopics<T extends { title: string; summary?: string }>(
  topics: T[]
): { filtered: T[]; removed: number } {
  const filtered = topics.filter(topic => {
    const textToCheck = `${topic.title} ${topic.summary || ''}`;
    const result = moderateContent(textToCheck);
    return result.safe;
  });

  return {
    filtered,
    removed: topics.length - filtered.length,
  };
}

/**
 * 台本テキストのサニタイズ
 * NGワードを「***」に置換して返す
 */
export function sanitizeScript(text: string): string {
  let result = text;
  for (const { word } of FLAT_NG_WORDS) {
    // 大文字小文字を無視して置換
    const regex = new RegExp(escapeRegExp(word), 'gi');
    result = result.replace(regex, '***');
  }
  return result;
}

/**
 * 正規表現のメタ文字をエスケープ
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
