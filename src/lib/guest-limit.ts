// ゲスト使用回数のサーバーサイド管理
// RPC でアトミックにチェック+インクリメント（TOCTOU排除）

import { getSupabaseServer } from './supabase';
import { hashIp } from './auth';

const GUEST_MAX_USAGE = 3;

export interface GuestUsageResult {
  allowed: boolean;
  remaining: number;
  used: number;
}

/**
 * ゲストの使用回数をチェックのみ行う（消費しない）
 * UIの残数表示等に使用
 */
export async function checkGuestUsage(ip: string): Promise<GuestUsageResult> {
  const supabase = getSupabaseServer();
  if (!supabase) {
    return { allowed: true, remaining: GUEST_MAX_USAGE, used: 0 };
  }

  const ipHash = hashIp(ip);
  const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);

  try {
    const { data } = await supabase
      .from('guest_usage')
      .select('usage_count')
      .eq('ip_hash', ipHash)
      .eq('usage_date', today)
      .maybeSingle();

    const used = data?.usage_count ?? 0;
    return { allowed: used < GUEST_MAX_USAGE, remaining: Math.max(0, GUEST_MAX_USAGE - used), used };
  } catch (err) {
    console.error('ゲスト使用回数チェックエラー:', err);
    // 設定済みだが障害 → フェイルクローズ
    return { allowed: false, remaining: 0, used: GUEST_MAX_USAGE };
  }
}

/**
 * ゲストの使用回数をアトミックにチェック+消費する（RPC使用）
 * allowed=true の場合、使用回数は既にインクリメント済み
 * allowed=false の場合、使用回数は変更されない
 */
export async function checkAndIncrementGuestUsage(ip: string): Promise<GuestUsageResult> {
  const supabase = getSupabaseServer();
  if (!supabase) {
    return { allowed: true, remaining: GUEST_MAX_USAGE, used: 0 };
  }

  const ipHash = hashIp(ip);

  try {
    const { data, error } = await supabase.rpc('check_and_increment_guest_usage', {
      p_ip_hash: ipHash,
      p_max_usage: GUEST_MAX_USAGE,
    });

    if (error) {
      console.error('ゲスト使用回数RPCエラー:', error);
      // 設定済みだが障害 → フェイルクローズ
      return { allowed: false, remaining: 0, used: GUEST_MAX_USAGE };
    }

    const result = typeof data === 'string' ? JSON.parse(data) : data;
    return {
      allowed: result.allowed,
      remaining: result.remaining,
      used: result.used,
    };
  } catch (err) {
    console.error('ゲスト使用回数エラー:', err);
    return { allowed: false, remaining: 0, used: GUEST_MAX_USAGE };
  }
}
