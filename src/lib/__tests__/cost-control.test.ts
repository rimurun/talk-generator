import { describe, it, expect, beforeEach, vi } from 'vitest';

// cost-control.ts はモジュールレベルの変数でコストを蓄積するため、
// テストごとにモジュールキャッシュをリセットして初期状態に戻す。
describe('cost-control', () => {
  let recordCost: (cost: number) => void;
  let checkCostLimit: () => { allowed: boolean; reason?: string; dailyTotal: number; monthlyTotal: number };
  let getCostStats: () => { daily: { total: number; limit: number }; monthly: { total: number; limit: number } };

  beforeEach(async () => {
    // モジュールキャッシュをリセットして各テストを独立させる
    vi.resetModules();
    const mod = await import('../cost-control');
    recordCost = mod.recordCost;
    checkCostLimit = mod.checkCostLimit;
    getCostStats = mod.getCostStats;
  });

  it('初期状態ではallowed=true', () => {
    const result = checkCostLimit();
    expect(result.allowed).toBe(true);
  });

  it('コストを記録するとstatsに反映される', () => {
    recordCost(0.01);
    const stats = getCostStats();
    expect(stats.daily.total).toBeGreaterThan(0);
    expect(stats.monthly.total).toBeGreaterThan(0);
  });
});
