// ===== Service Worker для PWA «Змейка» =====
// Кэширует файлы игры, чтобы она открывалась и работала без интернета.

// Имя кэша с версией. Поднимай версию (v2, v3…), когда меняешь файлы игры,
// — тогда старый кэш очистится и пользователь получит свежую версию.
const CACHE = 'snake-game-v2';

// Файлы, которые нужно сохранить для офлайна.
// Пути ОТНОСИТЕЛЬНЫЕ — работают и на GitHub Pages в подпапке /snake-game/.
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// 1) Установка: складываем файлы игры в кэш
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS))
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

// 3) Запросы: сначала пытаемся отдать из кэша, иначе идём в сеть.
//    Если сети нет и файла в кэше нет — для переходов отдаём главную страницу.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return; // кэшируем только чтение

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached; // нашли в кэше — отдаём мгновенно

      return fetch(event.request)
        .then((response) => {
          // Попутно докладываем полученное в кэш (для следующего раза)
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => {
          // Сети нет и в кэше нет — для навигации показываем игру
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
    })
  );
});
