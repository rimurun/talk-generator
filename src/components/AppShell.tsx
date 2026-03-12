'use client';

import { usePathname } from 'next/navigation';
import { useAuth } from './AuthProvider';
import Navigation from './Navigation';

// 認証状態とパスに応じてレイアウトを切り替えるシェルコンポーネント
export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();

  // ログインページ or 未認証時はナビゲーション非表示・フル幅レイアウト
  const isLoginPage = pathname === '/login';
  const showNav = !isLoginPage && !loading && !!user;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
      {showNav && <Navigation />}
      <main className={showNav ? 'lg:ml-64 lg:pt-16' : ''}>
        {children}
      </main>
    </div>
  );
}
