import { describe, it, expect } from 'vitest';
import { moderateContent, filterTopics, sanitizeScript } from '../content-moderation';

describe('moderateContent', () => {
  it('安全なテキストはsafe=trueを返す', () => {
    const result = moderateContent('今日のニュースについて話しましょう');
    expect(result.safe).toBe(true);
    expect(result.flaggedWords).toHaveLength(0);
  });

  it('NGワードを含むテキストはsafe=falseを返す', () => {
    // SYSTEM_NG_WORDS に含まれる「殺せ」を使用
    const result = moderateContent('殺せという表現');
    expect(result.safe).toBe(false);
    expect(result.flaggedWords.length).toBeGreaterThan(0);
  });

  it('空文字列はsafe=trueを返す', () => {
    const result = moderateContent('');
    expect(result.safe).toBe(true);
  });
});

describe('filterTopics', () => {
  it('安全なトピックはすべて残る', () => {
    const topics = [
      { title: '今日の天気', summary: '晴れです' },
      { title: '新しいアプリ', summary: 'リリースされました' },
    ];
    const { filtered, removed } = filterTopics(topics);
    expect(filtered).toHaveLength(2);
    expect(removed).toBe(0);
  });

  it('NGワードを含むトピックは除外される', () => {
    const topics = [
      { title: '今日の天気', summary: '晴れです' },
      { title: '殺せと叫ぶ人', summary: '事件です' },
    ];
    const { filtered, removed } = filterTopics(topics);
    expect(filtered).toHaveLength(1);
    expect(removed).toBe(1);
    expect(filtered[0].title).toBe('今日の天気');
  });
});

describe('sanitizeScript', () => {
  it('NGワードが***に置換される', () => {
    const result = sanitizeScript('これは殺せという単語のテスト');
    expect(result).toContain('***');
    expect(result).not.toContain('殺せ');
  });

  it('安全なテキストは変更されない', () => {
    const text = '今日は良い天気ですね';
    expect(sanitizeScript(text)).toBe(text);
  });
});
