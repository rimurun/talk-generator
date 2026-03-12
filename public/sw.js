// TalkGen Service Worker
const CACHE_NAME = 'talkgen-v1';
const STATIC_ASSETS = [
  '/',
  '/favorites',
  '/history',
  '/settings',
  '/manifest.json',
];

// インストール: 静的アセットをキャッシュ
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// アクティベート: 古いキャッシュを削除
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// フェッチ: API以外はキャッシュ優先、APIはネットワーク優先
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // APIリクエストはネットワーク優先
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // 成功したレスポンスをキャッシュ（GETのみ）
          if (request.method === 'GET' && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          // オフライン時はキャッシュから返す
          return caches.match(request).then((cached) => {
            if (cached) return cached;
            return new Response(
              JSON.stringify({ error: 'オフラインです。インターネット接続を確認してください。' }),
              { status: 503, headers: { 'Content-Type': 'application/json' } }
            );
          });
        })
    );
    return;
  }

  // 静的アセットはキャッシュ優先
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        // 成功したレスポンスをキャッシュ
        if (response.ok && request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      });
    }).catch(() => {
      // HTMLリクエストのフォールバック
      if (request.headers.get('accept')?.includes('text/html')) {
        return caches.match('/');
      }
      return new Response('オフライン', { status: 503 });
    })
  );
});
