// ===== Service Worker для PWA «Змейка» =====
// Кэширует файлы игры, чтобы она открывалась и работала без интернета.

// Имя кэша с версией. Поднимай версию (v2, v3…), когда меняешь файлы игры,
// — тогда старый кэш очистится и пользователь получит свежую версию.
const CACHE = 'snake-game-v6';

// Файлы, которые нужно сохранить для офлайна.
// Пути ОТНОСИТЕЛЬНЫЕ — работают и на GitHub Pages в подпапке /snake-game/.
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// 1) Установка: складываем файлы игры в кэш.
//    Тянем СТРОГО из сети (cache: 'no-store'), чтобы в кэш не попала
//    устаревшая версия из HTTP-кэша браузера.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.all(ASSETS.map((url) =>
        fetch(url, { cache: 'no-store' }).then((resp) => cache.put(url, resp))
      ))
    )
  );
  self.skipWaiting(); // сразу активируем новый воркер
});

// 2) Активация: удаляем старые версии кэша
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// 3) Запросы:
//    - HTML/страница (навигация) — СНАЧАЛА СЕТЬ, потом кэш.
//      Так свежие изменения видны сразу, а офлайн работает из кэша.
//    - Остальные файлы (иконки, манифест) — сначала кэш (быстро).
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return; // кэшируем только чтение

  // Навигация по странице — сеть в приоритете, строго свежая (минуя HTTP-кэш)
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req, { cache: 'no-store' })
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put('./index.html', copy));
          return response;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
    );
    return;
  }

  // Статические файлы — сначала кэш, иначе сеть (и докладываем в кэш)
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(req, copy));
        return response;
      });
    })
  );
});
