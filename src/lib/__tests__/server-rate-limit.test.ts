import { describe, it, expect } from 'vitest';
import { checkRateLimit } from '../server-rate-limit';

// 注意: Supabase未設定時はインメモリフォールバックで動作する。
// テスト環境ではSupabaseが未設定のため、フォールバックモードでテストされる。
// テスト間でIPとパスを完全にユニークにすることで干渉を防いでいる。

describe('checkRateLimit', () => {
  it('最初のリクエストは許可さ���る', async () => {
    const result = await checkRateLimit('192.168.1.1', '/api/topics');
    expect(result.allowed).toBe(true);
  });

  it('制限内��リクエストは許可される', async () => {
    const ip = '10.0.0.1';
    // /api/topics の上限は10件。9回実行してから10回目を確認
    for (let i = 0; i < 9; i++) {
      await checkRateLimit(ip, '/api/topics');
    }
    const result = await checkRateLimit(ip, '/api/topics');
    expect(result.allowed).toBe(true);
  });

  it('制限を超えたリクエストは拒否される', async () => {
    const ip = '10.0.0.2';
    // 上限10件に達した後の11回��は拒否される
    for (let i = 0; i < 10; i++) {
      await checkRateLimit(ip, '/api/topics');
    }
    const result = await checkRateLimit(ip, '/api/topics');
    expect(result.allowed).toBe(false);
  });

  it('異なるIPは独立してカウントされる', async () => {
    // 10.0.0.3 が上限に達しても 10.0.0.4 には影響しない
    for (let i = 0; i < 10; i++) {
      await checkRateLimit('10.0.0.3', '/api/topics');
    }
    const result = await checkRateLimit('10.0.0.4', '/api/topics');
    expect(result.allowed).toBe(true);
  });

  it('異な��パスは独立してカウント���れる', async () => {
    // 10.0.0.5 が /api/topics の上限に達しても /api/trending は独立
    for (let i = 0; i < 10; i++) {
      await checkRateLimit('10.0.0.5', '/api/topics');
    }
    const result = await checkRateLimit('10.0.0.5', '/api/trending');
    expect(result.allowed).toBe(true);
  });

  it('remaining が正しく減少す��', async () => {
    const ip = '10.0.0.6';
    // 上限10件、1回消費後に remaining=9
    const first = await checkRateLimit(ip, '/api/topics');
    expect(first.remaining).toBe(9);
    // 2回消費後に remaining=8
    const second = await checkRateLimit(ip, '/api/topics');
    expect(second.remaining).toBe(8);
  });

  it('ゲストは制限が厳しい', async () => {
    const ip = '10.0.0.7';
    // ゲストの /api/topics 上限は5件
    for (let i = 0; i < 5; i++) {
      await checkRateLimit(ip, '/api/topics', true);
    }
    const result = await checkRateLimit(ip, '/api/topics', true);
    expect(result.allowed).toBe(false);
  });
});
