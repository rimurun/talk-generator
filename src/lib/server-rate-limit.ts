// サーバーサイドのレート制限（Supabase永続化）
// Vercelサーバーレス環境でインスタンス間で共有される

import { getSupabaseServer } from './supabase';

// パスごとのレート制限設定
// ゲストは認証済みユーザーの半分の回数に制限
export const RATE_LIMITS: Record<string, { windowMs: number; maxRequests: number; guestMaxRequests: number }> = {
  '/api/topics':   { windowMs: 60_000, maxRequests: 10, guestMaxRequests: 5 },
  '/api/script':   { windowMs: 60_000, maxRequests: 10, guestMaxRequests: 5 },
  '/api/batch':    { windowMs: 60_000, maxRequests: 3,  guestMaxRequests: 1 },
  '/api/trending': { windowMs: 3_600_000, maxRequests: 20, guestMaxRequests: 10 },
};

// インメモリフォールバック（Supabase未設定時 or エラー時）
const fallbackStore = new Map<string, { count: number; resetAt: number }>();

/**
 * レート制限チェック（Supabase永続化）
 * @param identifier ユーザーID または IPハッシュ
 * @param path       APIパス（例: '/api/topics'）
 * @param isGuest    ゲストかどうか（ゲストは制限が厳しい）
 */
export async function checkRateLimit(
  identifier: string,
  path: string,
  isGuest: boolean = false
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const limit = RATE_LIMITS[path];
  if (!limit) {
    return { allowed: true, remaining: 999, resetAt: Date.now() + 60_000 };
  }

  const maxRequests = isGuest ? limit.guestMaxRequests : limit.maxRequests;
  const supabase = getSupabaseServer();

  // Supabase未設定時はインメモリフォールバック
  if (!supabase) {
    return checkRateLimitFallback(identifier, path, limit.windowMs, maxRequests);
  }

  try {
    const { data, error } = await supabase.rpc('check_and_increment_rate_limit', {
      p_identifier: identifier,
      p_path: path,
      p_window_ms: limit.windowMs,
      p_max_requests: maxRequests,
    });

    if (error) {
      console.error('レート制限RPCエラー:', error);
      return checkRateLimitFallback(identifier, path, limit.windowMs, maxRequests);
    }

    // RPCはJSON型で返すためパース不要
    const result = typeof data === 'string' ? JSON.parse(data) : data;

    return {
      allowed: result.allowed,
      remaining: result.remaining,
      resetAt: Math.round(result.resetAt),
    };
  } catch (err) {
    console.error('レート制限チェックエラー:', err);
    return checkRateLimitFallback(identifier, path, limit.windowMs, maxRequests);
  }
}

/**
 * インメモリフォールバック
 */
function checkRateLimitFallback(
  identifier: string,
  path: string,
  windowMs: number,
  maxRequests: number
): { allowed: boolean; remaining: number; resetAt: number } {
  // 古いエントリを定期的にクリーンアップ
  if (fallbackStore.size > 500) {
    const now = Date.now();
    for (const [key, entry] of fallbackStore) {
      if (entry.resetAt <= now) fallbackStore.delete(key);
    }
  }

  const key = `${identifier}:${path}`;
  const now = Date.now();
  const entry = fallbackStore.get(key);

  if (!entry || entry.resetAt <= now) {
    const resetAt = now + windowMs;
    fallbackStore.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: maxRequests - 1, resetAt };
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count += 1;
  return { allowed: true, remaining: maxRequests - entry.count, resetAt: entry.resetAt };
}
