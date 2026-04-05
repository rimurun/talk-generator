// リクエスト認証ユーティリティ
// APIルートで使用し、認証済みユーザーかゲストかを判定する

import { NextRequest } from 'next/server';
import { createHash } from 'crypto';
import { getSupabaseServer } from './supabase';

export interface AuthResult {
  /** 認証済みユーザーのID（ゲストの場合はnull） */
  userId: string | null;
  /** ゲストかどうか */
  isGuest: boolean;
  /** クライアントIPアドレス */
  ip: string;
  /** レート制限用の識別子（userId または IPハッシュ） */
  identifier: string;
}

/**
 * IPアドレスをSHA-256でハッシュ化（先頭16文字）
 * プライバシー保護のため、生IPはDBに保存しない
 */
export function hashIp(ip: string): string {
  return createHash('sha256').update(ip).digest('hex').slice(0, 16);
}

/**
 * リクエストからIPアドレスを抽出する
 */
export function extractIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';
}

/**
 * APIリクエストを認証する
 * - Authorization: Bearer <token> があればSupabaseで検証
 * - なければゲスト扱い（IPベース追跡）
 */
export async function authenticateRequest(request: NextRequest): Promise<AuthResult> {
  const ip = extractIp(request);
  const ipHashed = hashIp(ip);

  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { userId: null, isGuest: true, ip, identifier: ipHashed };
  }

  const token = authHeader.slice(7);
  const supabase = getSupabaseServer();
  if (!supabase) {
    return { userId: null, isGuest: true, ip, identifier: ipHashed };
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return { userId: null, isGuest: true, ip, identifier: ipHashed };
    }
    return { userId: user.id, isGuest: false, ip, identifier: user.id };
  } catch {
    return { userId: null, isGuest: true, ip, identifier: ipHashed };
  }
}
