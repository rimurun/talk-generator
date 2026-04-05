// APIコスト管理（Supabase RPC でアトミック永続化）

import { getSupabaseServer, isSupabaseConfigured } from './supabase';

const DAILY_COST_LIMIT = parseFloat(process.env.DAILY_COST_LIMIT || '5.0');
const MONTHLY_COST_LIMIT = parseFloat(process.env.MONTHLY_COST_LIMIT || '50.0');

// インメモリフォールバック（Supabase未設定時のみ使用）
let fallbackDaily = { date: '', total: 0 };
let fallbackMonthly = { month: '', total: 0 };

/** JST基準の日付キー */
function getJstTodayKey(): string {
  return new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
}
function getJstMonthKey(): string {
  return new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 7);
}

/**
 * API呼び出しのコストを記録する（RPC でアトミック加算）
 * 生成成功後に呼び出す
 */
export async function recordCost(cost: number): Promise<void> {
  if (cost <= 0) return;

  const supabase = getSupabaseServer();
  if (!supabase) {
    const today = getJstTodayKey();
    const month = getJstMonthKey();
    if (fallbackDaily.date !== today) fallbackDaily = { date: today, total: 0 };
    if (fallbackMonthly.month !== month) fallbackMonthly = { month: month, total: 0 };
    fallbackDaily.total += cost;
    fallbackMonthly.total += cost;
    return;
  }

  try {
    const { error } = await supabase.rpc('record_api_cost', { p_cost: cost });
    if (error) console.error('コスト記録RPCエラー:', error);
  } catch (err) {
    console.error('コスト記録エラー:', err);
  }
}

/**
 * コスト上限チェック
 * Supabase設定済みで障害時はフェイルクローズ（拒否）
 */
export async function checkCostLimit(): Promise<{
  allowed: boolean;
  reason?: string;
  dailyTotal: number;
  monthlyTotal: number;
}> {
  const supabase = getSupabaseServer();

  if (!supabase) {
    // Supabase未設定: インメモリフォールバック（開発環境用）
    const today = getJstTodayKey();
    const month = getJstMonthKey();
    if (fallbackDaily.date !== today) fallbackDaily = { date: today, total: 0 };
    if (fallbackMonthly.month !== month) fallbackMonthly = { month: month, total: 0 };
    return checkLimits(fallbackDaily.total, fallbackMonthly.total);
  }

  try {
    const today = getJstTodayKey();
    const month = getJstMonthKey();

    const [dailyRes, monthlyRes] = await Promise.all([
      supabase.from('cost_tracking').select('total_cost')
        .eq('period_key', today).eq('period_type', 'daily').maybeSingle(),
      supabase.from('cost_tracking').select('total_cost')
        .eq('period_key', month).eq('period_type', 'monthly').maybeSingle(),
    ]);

    const dailyTotal = dailyRes.data?.total_cost ?? 0;
    const monthlyTotal = monthlyRes.data?.total_cost ?? 0;
    return checkLimits(dailyTotal, monthlyTotal);
  } catch (err) {
    console.error('コスト制限チェックエラー:', err);
    // Supabase設定済みだが障害 → フェイルクローズ
    return {
      allowed: false,
      reason: 'コスト管理システムに一時的な問題が発生しています。',
      dailyTotal: 0, monthlyTotal: 0,
    };
  }
}

function checkLimits(dailyTotal: number, monthlyTotal: number) {
  if (dailyTotal >= DAILY_COST_LIMIT) {
    return {
      allowed: false,
      reason: `本日のAPI使用量が上限（$${DAILY_COST_LIMIT}）に達しました。明日リセットされます。`,
      dailyTotal, monthlyTotal,
    };
  }
  if (monthlyTotal >= MONTHLY_COST_LIMIT) {
    return {
      allowed: false,
      reason: `今月のAPI使用量が上限（$${MONTHLY_COST_LIMIT}）に達しました。`,
      dailyTotal, monthlyTotal,
    };
  }
  return { allowed: true, dailyTotal, monthlyTotal };
}

/** 現在のコスト統計を返す */
export async function getCostStats(): Promise<{
  daily: { date: string; total: number; limit: number };
  monthly: { month: string; total: number; limit: number };
}> {
  const today = getJstTodayKey();
  const month = getJstMonthKey();
  const supabase = getSupabaseServer();
  let dailyTotal = 0, monthlyTotal = 0;

  if (supabase) {
    try {
      const [d, m] = await Promise.all([
        supabase.from('cost_tracking').select('total_cost')
          .eq('period_key', today).eq('period_type', 'daily').maybeSingle(),
        supabase.from('cost_tracking').select('total_cost')
          .eq('period_key', month).eq('period_type', 'monthly').maybeSingle(),
      ]);
      dailyTotal = d.data?.total_cost ?? 0;
      monthlyTotal = m.data?.total_cost ?? 0;
    } catch { /* フォールバック */ }
  } else {
    dailyTotal = fallbackDaily.date === today ? fallbackDaily.total : 0;
    monthlyTotal = fallbackMonthly.month === month ? fallbackMonthly.total : 0;
  }

  return {
    daily: { date: today, total: dailyTotal, limit: DAILY_COST_LIMIT },
    monthly: { month: month, total: monthlyTotal, limit: MONTHLY_COST_LIMIT },
  };
}
