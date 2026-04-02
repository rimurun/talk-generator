// TalkGen Service Worker v2
const CACHE_NAME = 'talkgen-v2';
const STATIC_ASSETS = [
  '/manifest.json',
];

// インストール: 即座にアクティベート（新バージョンを待たない）
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// アクティベート: 古いキャッシュを全て削除
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

// フェッチ戦略:
// - APIリクエスト → ネットワークのみ（キャッシュしない）
// - HTMLページ → ネットワーク優先（失敗時のみキャッシュ）
// - 静的アセット（JS/CSS/画像） → キャッシュ優先
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // APIリクエストはネットワークのみ（キャッシュしない）
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(
          JSON.stringify({ error: 'オフラインです。インターネット接続を確認してください。' }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }
        );
      })
    );
    return;
  }

  // HTMLページはネットワーク優先（常に最新を取得、オフライン時のみキャッシュ使用）
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // 成功したら新しいHTMLをキャッシュに保存
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          // オフライン時はキャッシュから返す
          return caches.match(request).then((cached) => {
            return cached || new Response('オフライン', { status: 503 });
          });
        })
    );
    return;
  }

  // 静的アセット（JS/CSS/画像/フォント）はキャッシュ優先
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok && request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      });
    }).catch(() => {
      return new Response('オフライン', { status: 503 });
    })
  );
});
