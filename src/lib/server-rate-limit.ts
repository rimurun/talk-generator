// サーバーサイドのインメモリレート制限
// Vercelサーバーレス環境で動作（Edge Runtimeは非対応）

// パスごとのレート制限設定
export const RATE_LIMITS: Record<string, { windowMs: number; maxRequests: number }> = {
  '/api/topics':   { windowMs: 60_000, maxRequests: 10 },  // 1分10回
  '/api/script':   { windowMs: 60_000, maxRequests: 10 },  // 1分10回
  '/api/batch':    { windowMs: 60_000, maxRequests: 3 },   // 1分3回
  '/api/trending': { windowMs: 60_000, maxRequests: 20 },  // 1分20回
};

// リクエスト追跡用ストア: key = "{ip}:{path}"
const store = new Map<string, { count: number; resetAt: number }>();

// 古いエントリのクリーンアップ（Mapサイズが1000超えたら期限切れ順に削除）
function cleanup(): void {
  if (store.size < 1000) return;

  const now = Date.now();
  // 期限切れエントリを先に削除
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) {
      store.delete(key);
    }
  }

  // それでも1000超えなら古い順（resetAt昇順）に削除して800件まで絞る
  if (store.size >= 1000) {
    const sorted = [...store.entries()].sort((a, b) => a[1].resetAt - b[1].resetAt);
    const deleteCount = store.size - 800;
    for (let i = 0; i < deleteCount; i++) {
      store.delete(sorted[i][0]);
    }
  }
}

/**
 * レート制限チェック
 * @param ip      クライアントIPアドレス
 * @param path    APIパス（例: '/api/topics'）
 * @returns allowed: 許可/拒否、remaining: 残リクエスト数、resetAt: リセット時刻(ms)
 */
export function checkRateLimit(
  ip: string,
  path: string
): { allowed: boolean; remaining: number; resetAt: number } {
  const limit = RATE_LIMITS[path];

  // 設定のないパスは無制限で許可
  if (!limit) {
    return { allowed: true, remaining: 999, resetAt: Date.now() + 60_000 };
  }

  cleanup();

  const key = `${ip}:${path}`;
  const now = Date.now();
  const entry = store.get(key);

  // ウィンドウが未作成 or リセット済みの場合は新規エントリを作成
  if (!entry || entry.resetAt <= now) {
    const resetAt = now + limit.windowMs;
    store.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: limit.maxRequests - 1, resetAt };
  }

  // ウィンドウ内で上限超過
  if (entry.count >= limit.maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  // カウントアップして許可
  entry.count += 1;
  const remaining = limit.maxRequests - entry.count;
  return { allowed: true, remaining, resetAt: entry.resetAt };
}
