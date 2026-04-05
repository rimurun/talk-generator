// フロントエンド用APIヘルパー
// API呼び出し時に認証ヘッダーを自動付与する

import { getSupabaseClient } from './supabase';

/**
 * 現在のSupabaseセッションからAuthorizationヘッダーを生成する
 * 未認証時は空オブジェクトを返す
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const supabase = getSupabaseClient();
  if (!supabase) return {};

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return {};
    return { 'Authorization': `Bearer ${session.access_token}` };
  } catch {
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
