'use client';

import { useState } from 'react';
import { useAuth } from './AuthProvider';
import { X } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // モーダルが閉じている場合はレンダリングしない
  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = mode === 'login'
      ? await signIn(email, password)
      : await signUp(email, password);

    setLoading(false);

    if (result.error) {
      setError(result.error);
    } else {
      if (mode === 'signup') {
        // サインアップ成功：確認メール送信済みを表示
        setSuccess(true);
      } else {
        // ログイン成功：モーダルを閉じる
        onClose();
      }
    }
  };

  // モード切替時にエラーとメッセージをリセット
  const switchMode = () => {
    setMode(mode === 'login' ? 'signup' : 'login');
    setError(null);
    setSuccess(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 border border-gray-700 rounded-xl w-full max-w-md p-6 relative">
        {/* 閉じるボタン */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>

        <h2 className="text-xl font-bold text-white mb-6">
          {mode === 'login' ? 'ログイン' : 'アカウント作成'}
        </h2>

        {success ? (
          // サインアップ成功メッセージ
          <div className="text-center py-4">
            <p className="text-green-400 mb-2">確認メールを送信しました</p>
            <p className="text-gray-400 text-sm">メール内のリンクをクリックして認証を完了してください</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                メールアドレス
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="example@email.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                パスワード
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="6文字以上"
              />
            </div>

            {/* エラーメッセージ */}
            {error && (
              <div className="bg-red-500/20 border border-red-500/30 text-red-300 px-3 py-2 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition-all"
            >
              {loading ? '処理中...' : mode === 'login' ? 'ログイン' : 'アカウント作成'}
            </button>
          </form>
        )}

        {/* モード切替リンク */}
        <div className="mt-4 text-center">
          <button
            onClick={switchMode}
            className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            {mode === 'login' ? 'アカウントを作成する' : 'ログインに戻る'}
          </button>
        </div>

        <p className="mt-3 text-xs text-gray-500 text-center">
          ログインするとお気に入り・履歴がクラウドに同期されます
        </p>
      </div>
    </div>
  );
}
