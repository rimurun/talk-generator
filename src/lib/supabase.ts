// Supabase クライアント設定
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Supabaseが設定済みかどうかを判定
 */
export function isSupabaseConfigured(): boolean {
  return !!(supabaseUrl && supabaseAnonKey);
}

// クライアントサイド用 Supabase クライアント（シングルトン）
let clientInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;

  if (!clientInstance) {
    clientInstance = createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: typeof window !== 'undefined',
        autoRefreshToken: true,
      },
    });
  }

  return clientInstance;
}

// サーバーサイド用 Supabase クライアント（service role key使用）
let serverInstance: SupabaseClient | null = null;

export function getSupabaseServer(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serverInstance) {
    // service role keyがある場合はRLSバイパス、なければanon keyでRLS適用
    serverInstance = createClient(
      supabaseUrl!,
      serviceRoleKey || supabaseAnonKey!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );
  }

  return serverInstance;
}
