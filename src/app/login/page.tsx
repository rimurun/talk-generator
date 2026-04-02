'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { Zap, Mail, Lock, ArrowLeft, Sparkles, Radio, Monitor } from 'lucide-react';
import Link from 'next/link';

// ランディング + ログインページ
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
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0a0a1a 0%, #0d1230 50%, #0a0a1a 100%)' }}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Supabase未設定の場合は案内メッセージを表示
  if (!isConfigured) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-4"
        style={{ background: 'linear-gradient(135deg, #0a0a1a 0%, #0d1230 50%, #0a0a1a 100%)' }}
      >
        <div
          className="max-w-md w-full text-center p-8 rounded-2xl"
          style={{
            background: 'rgba(255,255,255,0.04)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 25px 80px rgba(0,0,0,0.6)',
          }}
        >
          <div className="bg-gradient-to-r from-blue-500 to-purple-500 p-3 rounded-xl w-fit mx-auto mb-6">
            <Zap size={32} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-white mb-3">認証機能は未設定です</h1>
          <p className="text-gray-400 text-sm mb-6 leading-relaxed">
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
      // ログイン成功：ゲストモードフラグをクリアしてホームにリダイレクト
      localStorage.removeItem('talkgen_guest_mode');
      router.push('/');
    }
  };

  return (
    <>
      {/* グローバルアニメーション定義 */}
      <style>{`
        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes floatA {
          0%, 100% { transform: translateY(0px) rotate(0deg); opacity: 0.15; }
          50% { transform: translateY(-30px) rotate(10deg); opacity: 0.25; }
        }
        @keyframes floatB {
          0%, 100% { transform: translateY(0px) rotate(0deg); opacity: 0.1; }
          50% { transform: translateY(20px) rotate(-8deg); opacity: 0.2; }
        }
        @keyframes floatC {
          0%, 100% { transform: translateY(0px) scale(1); opacity: 0.08; }
          50% { transform: translateY(-15px) scale(1.1); opacity: 0.15; }
        }
        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 0 20px rgba(99,102,241,0.3); }
          50% { box-shadow: 0 0 40px rgba(99,102,241,0.6), 0 0 80px rgba(99,102,241,0.2); }
        }
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(30px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-float-a { animation: floatA 7s ease-in-out infinite; }
        .animate-float-b { animation: floatB 9s ease-in-out infinite 1s; }
        .animate-float-c { animation: floatC 11s ease-in-out infinite 2s; }
        .animate-slide-in { animation: slideInRight 0.6s ease-out forwards; }
        .animate-fade-up { animation: fadeInUp 0.5s ease-out forwards; }
        .login-bg {
          background: linear-gradient(-45deg, #0a0a1a, #0d1230, #0f0a20, #080818);
          background-size: 400% 400%;
          animation: gradientShift 15s ease infinite;
        }
        .glass-card {
          background: rgba(255,255,255,0.04);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid rgba(255,255,255,0.08);
        }
        .input-field {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.12);
          color: white;
          outline: none;
          transition: all 0.2s;
        }
        .input-field:focus {
          background: rgba(255,255,255,0.08);
          border-color: rgba(99,102,241,0.7);
          box-shadow: 0 0 0 3px rgba(99,102,241,0.15);
        }
        .input-field::placeholder {
          color: rgba(255,255,255,0.3);
        }

      `}</style>

      <div className="login-bg min-h-screen flex items-center justify-center relative overflow-hidden">

        {/* 装飾的な浮遊要素（CSS-onlyアニメーション） */}
        <div
          className="animate-float-a absolute top-[15%] left-[8%] w-64 h-64 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)' }}
        />
        <div
          className="animate-float-b absolute bottom-[20%] left-[12%] w-48 h-48 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(168,85,247,0.12) 0%, transparent 70%)' }}
        />
        <div
          className="animate-float-c absolute top-[40%] right-[5%] w-80 h-80 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.1) 0%, transparent 70%)' }}
        />
        <div
          className="animate-float-a absolute top-[60%] left-[35%] w-32 h-32 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(236,72,153,0.08) 0%, transparent 70%)', animationDelay: '3s' }}
        />

        {/* メインレイアウト：左右分割 */}
        <div className="w-full max-w-6xl mx-auto px-4 py-8 flex flex-col lg:flex-row items-center gap-12 lg:gap-16">

          {/* ─── 左側：ヒーロー・機能紹介 ─────────────────────── */}
          <div className="flex-1 text-center lg:text-left animate-fade-up">
            {/* ロゴ */}
            <Link href="/" className="inline-flex items-center gap-3 mb-10 group">
              <div
                className="bg-gradient-to-r from-blue-500 to-purple-600 p-2.5 rounded-xl transition-transform duration-200 group-hover:scale-105"
                style={{ boxShadow: '0 0 20px rgba(99,102,241,0.4)' }}
              >
                <Zap size={26} className="text-white" />
              </div>
              <div className="text-left">
                <span className="text-2xl font-bold text-white">TalkGen</span>
                <span className="block text-xs text-gray-500">配信用台本ツール</span>
              </div>
            </Link>

            {/* メインキャッチコピー */}
            <h1 className="text-4xl lg:text-5xl xl:text-6xl font-black leading-tight mb-6">
              <span
                style={{
                  background: 'linear-gradient(135deg, #60a5fa 0%, #a78bfa 50%, #f472b6 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                配信を、
              </span>
              <br />
              <span
                style={{
                  background: 'linear-gradient(135deg, #a78bfa 0%, #60a5fa 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                もっとスマートに
              </span>
            </h1>

            <p className="text-gray-400 text-lg mb-10 leading-relaxed max-w-lg mx-auto lg:mx-0">
              AIがリアルタイムトレンドを分析し、あなたの配信スタイルに合った台本を瞬時に生成します。
            </p>

            {/* 機能ハイライト3つ */}
            <div className="space-y-4 max-w-md mx-auto lg:mx-0">
              <FeatureCard
                icon={<Sparkles size={20} className="text-blue-400" />}
                title="AIトーク生成"
                description="Claude AIがトレンドに合わせた台本を数秒で生成"
                delay="0s"
              />
              <FeatureCard
                icon={<Radio size={20} className="text-purple-400" />}
                title="リアルタイムトレンド"
                description="ニュース・SNS・TikTokの最新トレンドを自動収集"
                delay="0.1s"
              />
              <FeatureCard
                icon={<Monitor size={20} className="text-pink-400" />}
                title="テレプロンプター"
                description="生成した台本をそのままプロンプターで読み上げ"
                delay="0.2s"
              />
            </div>
          </div>

          {/* ─── 右側：ログインフォーム ──────────────────────── */}
          <div className="w-full max-w-sm lg:max-w-md animate-slide-in">
            <div
              className="glass-card rounded-2xl p-8"
              style={{ boxShadow: '0 25px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)' }}
            >
              {/* フォームヘッダー */}
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-white mb-2">
                  {mode === 'login' ? 'ログイン' : 'アカウント作成'}
                </h2>
                <p className="text-sm text-gray-400">
                  {mode === 'login'
                    ? 'お気に入り・履歴をクラウドに同期できます'
                    : '無料でアカウントを作成して、データを保存しましょう'}
                </p>
              </div>

              {/* 新規登録成功時のメッセージ */}
              {success ? (
                <div className="text-center py-6">
                  <div className="w-16 h-16 bg-green-500/15 border border-green-500/30 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Mail size={28} className="text-green-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">確認メールを送信しました</h3>
                  <p className="text-gray-400 text-sm mb-6 leading-relaxed">
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
                <>
                  {/* フォーム */}
                  <form onSubmit={handleSubmit} className="space-y-4">
                    {/* メールアドレス入力 */}
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1.5 tracking-wide uppercase">
                        メールアドレス
                      </label>
                      <div className="relative">
                        <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          className="input-field w-full pl-10 pr-4 py-3 rounded-xl text-sm"
                          placeholder="example@email.com"
                        />
                      </div>
                    </div>

                    {/* パスワード入力 */}
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1.5 tracking-wide uppercase">
                        パスワード
                      </label>
                      <div className="relative">
                        <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                        <input
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          minLength={6}
                          className="input-field w-full pl-10 pr-4 py-3 rounded-xl text-sm"
                          placeholder="6文字以上"
                        />
                      </div>
                    </div>

                    {/* エラーメッセージ */}
                    {error && (
                      <div className="bg-red-500/10 border border-red-500/30 text-red-300 px-4 py-3 rounded-xl text-sm">
                        {error}
                      </div>
                    )}

                    {/* 送信ボタン */}
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full text-white font-semibold py-3 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                      style={{
                        background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                        boxShadow: submitting ? 'none' : '0 4px 20px rgba(99,102,241,0.4)',
                        transform: 'translateY(0)',
                      }}
                      onMouseEnter={(e) => {
                        if (!submitting) (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
                      }}
                    >
                      {submitting ? '処理中...' : mode === 'login' ? 'ログイン' : 'アカウント作成'}
                    </button>
                  </form>

                  {/* モード切替 */}
                  <div className="mt-5 text-center">
                    <button
                      onClick={() => {
                        setMode(mode === 'login' ? 'signup' : 'login');
                        setError(null);
                      }}
                      className="text-sm text-gray-400 hover:text-white transition-colors"
                    >
                      {mode === 'login'
                        ? 'アカウントをお持ちでない方は'
                        : 'すでにアカウントをお持ちの方は'}
                      {' '}
                      <span className="text-blue-400 hover:text-blue-300 font-medium">
                        {mode === 'login' ? '新規登録' : 'ログイン'}
                      </span>
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* ゲストとして試すボタン */}
            <div className="mt-4">
              <button
                onClick={() => {
                  localStorage.setItem('talkgen_guest_mode', 'true');
                  // 同一タブ内のlocalStorage変更をAppShellに通知
                  window.dispatchEvent(new Event('talkgen_guest_change'));
                  router.push('/');
                }}
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm text-gray-400 hover:text-white transition-all duration-200 cursor-pointer"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.07)',
                }}
              >
                <ArrowLeft size={14} />
                ゲストとして試す（ログイン不要）
              </button>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}

// 機能紹介カードコンポーネント
function FeatureCard({
  icon,
  title,
  description,
  delay,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  delay: string;
}) {
  return (
    <div
      className="flex items-start gap-4 p-4 rounded-xl"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
        animationDelay: delay,
      }}
    >
      <div
        className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
        style={{ background: 'rgba(255,255,255,0.05)' }}
      >
        {icon}
      </div>
      <div>
        <h3 className="text-white font-semibold text-sm mb-0.5">{title}</h3>
        <p className="text-gray-500 text-xs leading-relaxed">{description}</p>
      </div>
    </div>
  );
}
