'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { Zap, Mail, Lock, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const { user, loading, signIn, signUp, isConfigured } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // ログイン済みならホームにリダイレクト
  useEffect(() => {
    if (!loading && user) {
      router.push('/');
    }
  }, [user, loading, router]);

  // ローディング中はスピナー表示
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Supabase未設定の場合は案内メッセージを表示
  if (!isConfigured) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-8 max-w-md w-full text-center">
          <div className="bg-gradient-to-r from-blue-500 to-purple-500 p-3 rounded-lg w-fit mx-auto mb-6">
            <Zap size={32} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-white mb-3">認証機能は未設定です</h1>
          <p className="text-gray-400 text-sm mb-6">
            ログイン機能を使用するには、Supabaseの環境変数を設定してください。
            ログインなしでもLocalStorageを使ってアプリをご利用いただけます。
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors"
          >
            <ArrowLeft size={16} />
            ホームに戻る
          </Link>
        </div>
      </div>
    );
  }

  // フォーム送信処理
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const result = mode === 'login'
      ? await signIn(email, password)
      : await signUp(email, password);

    setSubmitting(false);

    if (result.error) {
      setError(result.error);
    } else if (mode === 'signup') {
      // 新規登録成功：確認メール送信済みメッセージを表示
      setSuccess(true);
    } else {
      // ログイン成功：ホームにリダイレクト
      router.push('/');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* ロゴ */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-3">
            <div className="bg-gradient-to-r from-blue-500 to-purple-500 p-2 rounded-lg">
              <Zap size={28} className="text-white" />
            </div>
            <div className="text-left">
              <h1 className="text-2xl font-bold text-white">TalkGen</h1>
              <p className="text-xs text-gray-400">配信用台本ツール</p>
            </div>
          </Link>
        </div>

        {/* フォームカード */}
        <div className="bg-gray-800/60 backdrop-blur-sm border border-gray-700 rounded-xl p-8">
          <h2 className="text-xl font-bold text-white mb-2">
            {mode === 'login' ? 'ログイン' : 'アカウント作成'}
          </h2>
          <p className="text-sm text-gray-400 mb-6">
            {mode === 'login'
              ? 'お気に入り・履歴をクラウドに同期できます'
              : '無料でアカウントを作成して、データをクラウドに保存'}
          </p>

          {/* 新規登録成功時のメッセージ */}
          {success ? (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Mail size={32} className="text-green-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">確認メールを送信しました</h3>
              <p className="text-gray-400 text-sm mb-6">
                メール内のリンクをクリックして認証を完了してください
              </p>
              <button
                onClick={() => {
                  setMode('login');
                  setSuccess(false);
                  setEmail('');
                  setPassword('');
                }}
                className="text-blue-400 hover:text-blue-300 text-sm transition-colors"
              >
                ログインページに戻る
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* メールアドレス入力 */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  メールアドレス
                </label>
                <div className="relative">
                  <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full pl-10 pr-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="example@email.com"
                  />
                </div>
              </div>

              {/* パスワード入力 */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  パスワード
                </label>
                <div className="relative">
                  <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full pl-10 pr-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="6文字以上"
                  />
                </div>
              </div>

              {/* エラーメッセージ */}
              {error && (
                <div className="bg-red-500/20 border border-red-500/30 text-red-300 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {/* 送信ボタン */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-all duration-200 transform hover:scale-[1.02]"
              >
                {submitting ? '処理中...' : mode === 'login' ? 'ログイン' : 'アカウント作成'}
              </button>
            </form>
          )}

          {/* モード切替リンク */}
          {!success && (
            <div className="mt-6 text-center space-y-3">
              <div className="border-t border-gray-700 pt-4">
                <button
                  onClick={() => {
                    setMode(mode === 'login' ? 'signup' : 'login');
                    setError(null);
                  }}
                  className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                >
                  {mode === 'login'
                    ? 'アカウントをお持ちでない方はこちら'
                    : 'すでにアカウントをお持ちの方'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ログインせずに使うリンク */}
        <div className="mt-6 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={14} />
            ログインせずに使う
          </Link>
        </div>
      </div>
    </div>
  );
}
