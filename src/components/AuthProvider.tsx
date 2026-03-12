'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase';
import { setStorageUser } from '@/lib/storage';

// 認証状態の型定義
interface AuthState {
  user: { id: string; email: string } | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  isConfigured: boolean;
}

// デフォルト値（Supabase未設定時のフォールバック）
const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  signIn: async () => ({ error: null }),
  signUp: async () => ({ error: null }),
  signOut: async () => {},
  isConfigured: false,
});

export const useAuth = () => useContext(AuthContext);

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const isConfigured = isSupabaseConfigured();

  useEffect(() => {
    // Supabase未設定の場合はスキップ（LocalStorageのみで動作）
    if (!isConfigured) {
      setLoading(false);
      return;
    }

    const sb = getSupabaseClient();
    if (!sb) {
      setLoading(false);
      return;
    }

    // 現在のセッションを確認
    sb.auth.getSession().then(({ data }) => {
      const u = data.session?.user;
      setUser(u ? { id: u.id, email: u.email || '' } : null);
      // ストレージのユーザースコープを初期化
      setStorageUser(u ? u.id : null);
      setLoading(false);
    });

    // 認証状態の変更を監視（ログイン・ログアウト・トークンリフレッシュ）
    const { data: { subscription } } = sb.auth.onAuthStateChange((_event, session) => {
      const u = session?.user;
      setUser(u ? { id: u.id, email: u.email || '' } : null);
      // 認証状態変更時にストレージのユーザースコープを更新
      setStorageUser(session?.user ? session.user.id : null);
    });

    return () => subscription.unsubscribe();
  }, [isConfigured]);

  // メールアドレス＋パスワードでログイン
  const signIn = async (email: string, password: string) => {
    const sb = getSupabaseClient();
    if (!sb) return { error: 'Supabaseが設定されていません' };

    const { error } = await sb.auth.signInWithPassword({ email, password });
    return { error: error?.message || null };
  };

  // 新規アカウント作成
  const signUp = async (email: string, password: string) => {
    const sb = getSupabaseClient();
    if (!sb) return { error: 'Supabaseが設定されていません' };

    const { error } = await sb.auth.signUp({ email, password });
    return { error: error?.message || null };
  };

  // ログアウト
  const signOut = async () => {
    const sb = getSupabaseClient();
    if (sb) await sb.auth.signOut();
    setUser(null);
    // ログアウト時はストレージをguestスコープに戻す
    setStorageUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut, isConfigured }}>
      {children}
    </AuthContext.Provider>
  );
}
