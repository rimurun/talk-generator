'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Star,
  Clock,
  Settings,
  Zap,
  LogIn,
  LogOut,
  User,
  TrendingUp,
  BarChart3,
  ChevronDown,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from './AuthProvider';

// ナビゲーション項目の型定義
interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  description: string;
}

// プライマリナビ（常に表示）
const primaryNav: NavItem[] = [
  { name: 'ホーム',     href: '/',         icon: Home,      description: 'トピック生成' },
  { name: 'トレンド',   href: '/trending', icon: TrendingUp, description: '今日の話題' },
];

// セカンダリナビ（折りたたみ可能）
const secondaryNav: NavItem[] = [
  { name: 'お気に入り', href: '/favorites', icon: Star,      description: '保存済みトピック' },
  { name: '履歴',       href: '/history',   icon: Clock,     description: '生成履歴' },
  { name: '分析',       href: '/analytics', icon: BarChart3, description: '利用分析' },
];

// ボトムタブバー用（モバイル・5項目まで）
const bottomTabs: NavItem[] = [
  { name: 'ホーム',     href: '/',          icon: Home,      description: 'トピック生成' },
  { name: 'トレンド',   href: '/trending',  icon: TrendingUp, description: '今日の話題' },
  { name: 'お気に入り', href: '/favorites', icon: Star,      description: '保存済みトピック' },
  { name: '履歴',       href: '/history',   icon: Clock,     description: '生成履歴' },
  { name: '設定',       href: '/settings',  icon: Settings,  description: 'プロファイル設定' },
];

export default function Navigation() {
  const pathname = usePathname();
  const { user, isConfigured, signOut } = useAuth();

  // セカンダリナビの折りたたみ状態
  const [isSecondaryOpen, setIsSecondaryOpen] = useState(true);
  // サイドバーのコンパクトモード（アイコンのみ）: localStorageで永続化
  const [isCompact, setIsCompact] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('talkgen_nav_compact') === 'true';
    }
    return false;
  });

  // isCompact 変更時に localStorage を更新し、他コンポーネントに通知
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('talkgen_nav_compact', String(isCompact));
      window.dispatchEvent(new CustomEvent('talkgen_nav_compact_change'));
    }
  }, [isCompact]);

  // アクティブ判定ヘルパー
  const isActive = (href: string) => pathname === href;

  // サイドバーの個別ナビリンク（デスクトップ用）
  const SidebarLink = ({ item }: { item: NavItem }) => {
    const active = isActive(item.href);
    const Icon = item.icon;

    return (
      <Link
        href={item.href}
        title={isCompact ? item.name : undefined}
        aria-label={isCompact ? item.name : undefined}
        className={`
          group relative flex items-center gap-3 px-3 py-2.5 rounded-lg
          transition-all duration-200
          ${active
            ? 'bg-blue-600/20 text-blue-400'
            : 'text-[var(--color-text-muted)] hover:bg-white/5 hover:text-white'
          }
        `}
      >
        {/* アクティブ時のインジケーターピル */}
        {active && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-blue-400 rounded-full" />
        )}

        <Icon
          size={18}
          aria-hidden="true"
          className={`shrink-0 transition-colors ${active ? 'text-blue-400' : 'text-[var(--color-text-muted)] group-hover:text-white'}`}
        />

        {/* コンパクトモード時はテキスト非表示 */}
        {!isCompact && (
          <div className="flex-1 min-w-0">
            <div className={`text-sm font-medium leading-tight ${active ? 'text-blue-300' : ''}`}>
              {item.name}
            </div>
            <div className="text-xs text-[var(--color-text-muted)] truncate">{item.description}</div>
          </div>
        )}

        {/* コンパクトモード時のホバーツールチップ */}
        {isCompact && (
          <span className="
            pointer-events-none absolute left-full ml-2 px-2 py-1
            bg-[var(--color-surface-alt)] text-white text-xs rounded-md whitespace-nowrap
            opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50
          ">
            {item.name}
          </span>
        )}
      </Link>
    );
  };

  return (
    <>
      {/* ============================
          デスクトップ サイドバー
          ============================ */}
      <nav className={`
        hidden lg:flex flex-col fixed top-0 left-0 h-full z-40
        bg-gray-950/95 backdrop-blur-md
        border-r border-transparent
        transition-all duration-300 ease-in-out
        ${isCompact ? 'w-16' : 'w-60'}
      `}
        /* グラデーションボーダーを疑似的に実装 */
        style={{
          borderRight: '1px solid transparent',
          backgroundClip: 'padding-box',
          boxShadow: '1px 0 0 0 rgba(99,102,241,0.18), 2px 0 8px 0 rgba(0,0,0,0.4)',
        }}
      >
        {/* ロゴエリア */}
        <div className="flex items-center justify-between px-3 pt-5 pb-4">
          <Link
            href="/"
            className={`flex items-center gap-2.5 text-white hover:text-blue-400 transition-colors min-w-0 ${isCompact ? 'justify-center w-full' : ''}`}
          >
            <div className="shrink-0 bg-gradient-to-br from-blue-500 to-purple-600 p-1.5 rounded-lg shadow-lg shadow-blue-900/30">
              <Zap size={18} aria-hidden="true" />
            </div>
            {!isCompact && (
              <div className="min-w-0">
                <h1 className="text-sm font-bold leading-tight">TalkGen</h1>
                <p className="text-xs text-[var(--color-text-muted)] truncate">配信用台本ツール</p>
              </div>
            )}
          </Link>
        </div>

        {/* コンパクトモード切り替えボタン */}
        <button
          onClick={() => setIsCompact(!isCompact)}
          className={`
            mx-3 mb-4 flex items-center justify-center gap-1.5 px-2 py-1.5
            text-xs text-[var(--color-text-muted)] hover:text-white
            bg-white/5 hover:bg-white/10 rounded-md transition-all duration-200
          `}
          title={isCompact ? 'サイドバーを展開' : 'サイドバーを折りたたむ'}
          aria-label={isCompact ? 'サイドバーを展開' : 'サイドバーを折りたたむ'}
        >
          {isCompact
            ? <PanelLeftOpen size={14} aria-hidden="true" />
            : <><PanelLeftClose size={14} aria-hidden="true" /><span>折りたたむ</span></>
          }
        </button>

        {/* プライマリナビ */}
        <div className={`px-2 space-y-0.5 ${isCompact ? 'px-2' : 'px-3'}`}>
          {!isCompact && (
            <p className="px-2 pb-1 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
              メイン
            </p>
          )}
          {primaryNav.map((item) => (
            <SidebarLink key={item.href} item={item} />
          ))}
        </div>

        {/* セクション区切り */}
        <div className="mx-3 my-3 border-t border-[var(--color-border)]" />

        {/* セカンダリナビ（折りたたみ可能） */}
        <div className={`${isCompact ? 'px-2' : 'px-3'}`}>
          {/* 折りたたみトグル（コンパクト時は非表示） */}
          {!isCompact && (
            <button
              onClick={() => setIsSecondaryOpen(!isSecondaryOpen)}
              className="w-full flex items-center justify-between px-2 pb-1 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider hover:text-[var(--color-text-muted)] transition-colors"
            >
              <span>ライブラリ</span>
              {isSecondaryOpen
                ? <ChevronDown size={12} aria-hidden="true" />
                : <ChevronRight size={12} aria-hidden="true" />
              }
            </button>
          )}

          {/* 折りたたみアニメーション */}
          <div className={`
            overflow-hidden transition-all duration-200 ease-in-out space-y-0.5
            ${isSecondaryOpen || isCompact ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'}
          `}>
            {secondaryNav.map((item) => (
              <SidebarLink key={item.href} item={item} />
            ))}
          </div>
        </div>

        {/* 下部：設定 + ユーザー情報 */}
        <div className="mt-auto">
          {/* 設定リンク */}
          <div className={`${isCompact ? 'px-2' : 'px-3'} mb-2`}>
            <SidebarLink item={{ name: '設定', href: '/settings', icon: Settings, description: 'プロファイル設定' }} />
          </div>

          {/* リーガルリンク（展開時のみ表示） */}
          {!isCompact && (
            <div className="px-5 mb-2 flex gap-3 text-xs text-[var(--color-text-muted)]">
              <Link href="/terms" className="hover:text-[var(--color-text-muted)] transition-colors">利用規約</Link>
              <Link href="/privacy" className="hover:text-[var(--color-text-muted)] transition-colors">プライバシー</Link>
            </div>
          )}

          {/* ユーザー情報（Supabase設定済みの場合のみ） */}
          {isConfigured && (
            <div className={`${isCompact ? 'px-2 pb-4' : 'px-3 pb-4'} border-t border-[var(--color-border)] pt-3`}>
              {user ? (
                // ログイン済み
                <div className={`${isCompact ? '' : 'bg-[var(--color-bg)] rounded-lg p-2.5 space-y-1.5'}`}>
                  {!isCompact && (
                    <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                      <User size={13} aria-hidden="true" className="shrink-0 text-[var(--color-text-muted)]" />
                      <span className="truncate">{user.email}</span>
                    </div>
                  )}
                  <button
                    onClick={() => signOut()}
                    title={isCompact ? 'ログアウト' : undefined}
                    aria-label={isCompact ? 'ログアウト' : undefined}
                    className={`
                      flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] hover:text-red-400 transition-colors
                      ${isCompact ? 'justify-center w-full py-1' : ''}
                    `}
                  >
                    <LogOut size={13} aria-hidden="true" />
                    {!isCompact && 'ログアウト'}
                  </button>
                </div>
              ) : (
                // 未ログイン
                <Link
                  href="/login"
                  title={isCompact ? 'ログイン' : undefined}
                  aria-label={isCompact ? 'ログイン' : undefined}
                  className={`
                    flex items-center gap-2 text-xs text-[var(--color-text-muted)] hover:text-white hover:bg-white/5
                    px-2 py-2 rounded-lg transition-all
                    ${isCompact ? 'justify-center' : ''}
                  `}
                >
                  <LogIn size={14} aria-hidden="true" />
                  {!isCompact && 'ログイン / 登録'}
                </Link>
              )}

              {/* バージョン表記（展開時のみ） */}
              {!isCompact && (
                <div className="mt-2 px-1 text-xs text-[var(--color-text-muted)]">
                  <Link href="/pricing" className="text-blue-500/70 hover:text-blue-400 transition-colors block mb-0.5">
                    Pro プランを見る →
                  </Link>
                  <div>v2.0.0</div>
                </div>
              )}
            </div>
          )}
        </div>
      </nav>

      {/* ============================
          モバイル ボトムタブバー
          ============================ */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40"
        style={{
          /* ノッチ付き端末のセーフエリア対応 */
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {/* グラスモーフィズム背景 */}
        <div className="
          bg-gray-950/85 backdrop-blur-xl
          border-t border-white/10
          shadow-[0_-4px_24px_rgba(0,0,0,0.5)]
        ">
          <div className="flex items-stretch justify-around h-14">
            {bottomTabs.map((item) => {
              const active = isActive(item.href);
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex flex-col items-center justify-center flex-1 gap-0.5 relative"
                >
                  {/* アクティブ時のグロー背景 */}
                  {active && (
                    <span className="absolute inset-x-2 top-1 h-8 rounded-xl bg-blue-500/15 blur-sm" />
                  )}

                  {/* アイコン（アクティブ時はスケール＋グローアニメ） */}
                  <span className={`
                    relative transition-all duration-200
                    ${active ? 'tab-active-glow scale-110 text-blue-400' : 'text-[var(--color-text-muted)]'}
                  `}>
                    <Icon size={20} aria-hidden="true" />
                    {/* アクティブドット */}
                    {active && (
                      <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-blue-400 rounded-full" />
                    )}
                  </span>

                  {/* ラベル */}
                  <span className={`
                    text-[10px] leading-none font-medium transition-colors duration-200
                    ${active ? 'text-blue-400' : 'text-[var(--color-text-muted)]'}
                  `}>
                    {item.name}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
    </>
  );
}
