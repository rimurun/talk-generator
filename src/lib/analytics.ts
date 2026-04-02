// GA4カスタムイベント送信ユーティリティ
// gtag未ロード時は何もしない（エラーを出さない）

type GTagEvent = {
  action: string;
  category: string;
  label?: string;
  value?: number;
};

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}

export function trackEvent({ action, category, label, value }: GTagEvent): void {
  if (typeof window === 'undefined' || !window.gtag) return;

  window.gtag('event', action, {
    event_category: category,
    event_label: label,
    value: value,
  });
}

// 定義済みイベント
export const events = {
  // トピック生成
  generateTopics: (mode: 'normal' | 'batch') =>
    trackEvent({ action: 'generate_topics', category: 'engagement', label: mode }),

  // 台本生成
  generateScript: () =>
    trackEvent({ action: 'generate_script', category: 'engagement' }),

  // お気に入り追加
  addFavorite: () =>
    trackEvent({ action: 'add_favorite', category: 'engagement' }),

  // エクスポート
  exportScript: (format: string) =>
    trackEvent({ action: 'export_script', category: 'engagement', label: format }),

  // ページビュー（SPAナビゲーション用）
  pageView: (path: string) =>
    trackEvent({ action: 'page_view', category: 'navigation', label: path }),

  // Proプラン checkout開始
  beginCheckout: () =>
    trackEvent({ action: 'begin_checkout', category: 'monetization' }),

  // ゲストモード開始
  guestModeStart: () =>
    trackEvent({ action: 'guest_mode_start', category: 'engagement' }),
};
