// Service Worker登録ユーティリティ
export function registerServiceWorker(): void {
  if (typeof window === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('[SW] 登録成功:', registration.scope);

      // アップデート検知
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'activated') {
              console.log('[SW] 新しいバージョンが利用可能です');
            }
          });
        }
      });
    } catch (error) {
      console.error('[SW] 登録失敗:', error);
    }
  });
}
