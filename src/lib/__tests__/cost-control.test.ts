import { describe, it, expect, beforeEach, vi } from 'vitest';

// cost-control.ts はモジュールレベルの変数でコストを蓄積するため、
// テストごとにモ��ュールキ���ッシュをリセットし��初期状態に戻す。
// Supabase未設定時はインメモリフォールバックで動作する。
describe('cost-control', () => {
  let recordCost: (cost: number) => Promise<void>;
  let checkCostLimit: () => Promise<{ allowed: boolean; reason?: string; dailyTotal: number; monthlyTotal: number }>;
  let getCostStats: () => Promise<{ daily: { date: string; total: number; limit: number }; monthly: { month: string; total: number; limit: number } }>;

  beforeEach(async () => {
    // モジ��ールキャッシュをリセットし���各テストを独立させる
    vi.resetModules();
    const mod = await import('../cost-control');
    recordCost = mod.recordCost;
    checkCostLimit = mod.checkCostLimit;
    getCostStats = mod.getCostStats;
  });

  it('���期状態ではallowed=true', async () => {
    const result = await checkCostLimit();
    expect(result.allowed).toBe(true);
  });

  it('���ストを記録するとstatsに���映される', async () => {
    await recordCost(0.01);
    const stats = await getCostStats();
    expect(stats.daily.total).toBeGreaterThan(0);
    expect(stats.monthly.total).toBeGreaterThan(0);
  });
});
