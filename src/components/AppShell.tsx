'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useSyncExternalStore } from 'react';
import { useAuth } from './AuthProvider';
import Navigation from './Navigation';
import PageTransition from './PageTransition';

// 認証不要のパス
const PUBLIC_PATHS = ['/login', '/pricing'];

// localStorageからゲストモードを同期的に読み取る（SSRでは false）
function getGuestMode(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('talkgen_guest_mode') === 'true';
}

// useSyncExternalStore用のsubscribe（storageイベントで更新検知）
function subscribeGuestMode(callback: () => void) {
  const handler = (e: StorageEvent) => {
    if (e.key === 'talkgen_guest_mode') callback();
  };
  window.addEventListener('storage', handler);
  // カスタムイベントも監視（同一タブ内のlocalStorage変更検知用）
  window.addEventListener('talkgen_guest_change', callback);
  return () => {
    window.removeEventListener('storage', handler);
    window.removeEventListener('talkgen_guest_change', callback);
  };
}

// 認証状態とパスに応じてレイアウトを切り替えるシェルコンポーネント
export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  // ゲストモードを同期的に読み取り（useEffect遅延なし）
  const guestMode = useSyncExternalStore(subscribeGuestMode, getGuestMode, () => false);

  const isPublicPage = PUBLIC_PATHS.includes(pathname);
  const authResolved = !loading;

  // リダイレクトが必要かどうか
  const needsRedirect = authResolved && !isPublicPage && !user && !guestMode;

  // 未認証かつゲストモードでない場合、ログインページにリダイレクト
  useEffect(() => {
    if (needsRedirect) {
      router.replace('/login');
    }
  }, [needsRedirect, router]);

  // 認証チェック中 or リダイレクト待ちはローディング表示（公開ページは除外）
  if (!isPublicPage && (!authResolved || needsRedirect)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  const showNav = !isPublicPage && authResolved && (!!user || guestMode);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
      {showNav && <Navigation />}

      <main className={`
        ${showNav
          ? [
              'lg:ml-60',
              'pb-[calc(3.5rem+env(safe-area-inset-bottom))] lg:pb-0',
            ].join(' ')
          : ''
        }
      `}>
        <PageTransition>
          {children}
        </PageTransition>
      </main>
    </div>
  );
}
