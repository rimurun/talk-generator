import { describe, it, expect } from 'vitest';
// parseTrendingText は src/lib/parse-trending.ts に抽出済み
import { parseTrendingText } from '@/lib/parse-trending';

describe('parseTrendingText', () => {
  it('カテゴリ別にパースできる', () => {
    const text = `ニュース
1. テストニュース - ニュースの説明
2. 二つ目のニュース - 説明文

エンタメ
1. テストエンタメ - エンタメの説明`;

    const result = parseTrendingText(text);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('ニュース');
    expect(result[0].items).toHaveLength(2);
    expect(result[1].name).toBe('エンタメ');
    expect(result[1].items).toHaveLength(1);
  });

  it('空文字列は空配列を返す', () => {
    expect(parseTrendingText('')).toHaveLength(0);
  });

  it('タイトルと説明を正しく分離する', () => {
    const text = `ニュース
1. タイトル - 説明文`;
    const result = parseTrendingText(text);
    expect(result[0].items[0].title).toBe('タイトル');
    expect(result[0].items[0].description).toBe('説明文');
  });
});
