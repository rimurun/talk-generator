// フロントエンド用APIヘルパー
// API呼び出し時に認証ヘッダーを自動付与する（短時間キャッシュ付き）

import { getSupabaseClient } from './supabase';

// セッショントークンの短時間キャッシュ（同一リクエスト内の重複呼び出しを防ぐ）
let cachedHeaders: Record<string, string> | null = null;
let cacheExpiry = 0;
const CACHE_TTL = 5000; // 5秒

/**
 * 現在のSupabaseセッションからAuthorizationヘッダーを生成する
 * 5秒間キャッシュして、連続API呼び出し時のオーバーヘッドを削減
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  // キャッシュ有効期間内ならそのまま返す
  if (cachedHeaders && Date.now() < cacheExpiry) {
    return cachedHeaders;
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    cachedHeaders = {};
    cacheExpiry = Date.now() + CACHE_TTL;
    return {};
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      cachedHeaders = {};
      cacheExpiry = Date.now() + CACHE_TTL;
      return {};
    }
    const headers = { 'Authorization': `Bearer ${session.access_token}` };
    cachedHeaders = headers;
    cacheExpiry = Date.now() + CACHE_TTL;
    return headers;
  } catch {
    cachedHeaders = {};
    cacheExpiry = Date.now() + CACHE_TTL;
    return {};
  }
}

/**
 * 認証付きでAPIにPOSTリクエストを送信する
 */
export async function fetchWithAuth(
  url: string,
  body: unknown,
  options?: RequestInit
): Promise<Response> {
  const authHeaders = await getAuthHeaders();
  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
    },
    body: JSON.stringify(body),
    ...options,
  });
}

/**
 * 認証付きでAPIにGETリクエストを送信する
 */
export async function fetchGetWithAuth(
  url: string,
  options?: RequestInit
): Promise<Response> {
  const authHeaders = await getAuthHeaders();
  return fetch(url, {
    headers: {
      ...authHeaders,
    },
    ...options,
  });
}
