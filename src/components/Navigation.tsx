'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Star, Clock, Settings, Menu, X, Zap, LogIn, LogOut, User } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from './AuthProvider';
import AuthModal from './AuthModal';

export default function Navigation() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const { user, isConfigured, signOut } = useAuth();
  const [showAuth, setShowAuth] = useState(false);

  const navigation = [
    {
      name: 'ホーム',
      href: '/',
      icon: Home,
      description: 'トピック生成'
    },
    {
      name: 'お気に入り',
      href: '/favorites',
      icon: Star,
      description: '保存済みトピック'
    },
    {
      name: '履歴',
      href: '/history',
      icon: Clock,
      description: '生成履歴'
    },
    {
      name: '設定',
      href: '/settings',
      icon: Settings,
      description: 'プロファイル設定'
    }
  ];

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  return (
    <>
      {/* モバイルメニューボタン */}
      <div className="lg:hidden fixed top-4 right-4 z-50">
        <button
          onClick={toggleMenu}
          className="bg-gray-800/80 backdrop-blur-sm border border-gray-600 text-white p-3 rounded-lg hover:bg-gray-700 transition-colors shadow-lg"
        >
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* モバイルオーバーレイ */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* サイドバーナビゲーション */}
      <nav className={`
        fixed top-0 left-0 h-full w-64 bg-gray-900/95 backdrop-blur-sm border-r border-gray-700 z-40
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0
      `}>
        <div className="p-6">
          {/* ロゴ */}
          <div className="mb-8">
            <Link href="/" className="flex items-center gap-3 text-white hover:text-blue-400 transition-colors">
              <div className="bg-gradient-to-r from-blue-500 to-purple-500 p-2 rounded-lg">
                <Zap size={24} />
              </div>
              <div>
                <h1 className="text-lg font-bold">TalkGen</h1>
                <p className="text-xs text-gray-400">配信用台本ツール</p>
              </div>
            </Link>
          </div>

          {/* メニュー項目 */}
          <ul className="space-y-2">
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className={`
                      flex items-center gap-3 px-3 py-3 rounded-lg transition-colors group
                      ${isActive 
                        ? 'bg-blue-600 text-white' 
                        : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                      }
                    `}
                  >
                    <Icon size={20} className={`
                      ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-white'}
                    `} />
                    <div className="flex-1">
                      <div className="font-medium">{item.name}</div>
                      <div className="text-xs opacity-70">{item.description}</div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* ユーザー情報（Supabase設定済みの場合のみ表示） */}
          {isConfigured && (
            <div className="absolute bottom-24 left-6 right-6">
              {user ? (
                // ログイン済み：メールアドレスとログアウトボタンを表示
                <div className="bg-gray-800 rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2 text-sm text-gray-300">
                    <User size={16} />
                    <span className="truncate">{user.email}</span>
                  </div>
                  <button
                    onClick={() => signOut()}
                    className="flex items-center gap-2 text-xs text-gray-400 hover:text-red-400 transition-colors"
                  >
                    <LogOut size={14} />
                    ログアウト
                  </button>
                </div>
              ) : (
                // 未ログイン：ログイン/登録ボタンを表示
                <button
                  onClick={() => setShowAuth(true)}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <LogIn size={18} />
                  ログイン / 登録
                </button>
              )}
            </div>
          )}

          {/* フッター情報 */}
          <div className="absolute bottom-12 left-6 right-6">
            <div className="text-xs text-gray-500 space-y-1">
              <div>Version 2.0.0</div>
              <div>© 2026 TalkGenerator</div>
            </div>
          </div>
        </div>
      </nav>

      {/* トップナビゲーション（デスクトップ用補助） */}
      <div className="hidden lg:block fixed top-0 left-64 right-0 bg-gray-900/80 backdrop-blur-sm border-b border-gray-700 z-30">
        <div className="px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-400">
              {navigation.map((item, index) => {
                if (pathname === item.href) {
                  return (
                    <span key={item.href} className="text-white font-medium">
                      {item.name}
                    </span>
                  );
                }
                return null;
              })}
            </div>

            <div className="flex items-center gap-4">
              <div className="text-xs text-gray-500">
                OpenAI GPT-4o + キャッシュ最適化
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 認証モーダル */}
      <AuthModal isOpen={showAuth} onClose={() => setShowAuth(false)} />
    </>
  );
}