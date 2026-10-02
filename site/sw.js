// ============================================================
// Service Worker — офлайн-режим PWA
// ============================================================
//
// При изменении данных (обновил закон, прогнал parse.py + export_to_js.py)
// надо увеличить CACHE_VERSION ниже. Иначе браузер отдаст старую версию.
//
// Пример: было 'v1', стало 'v2'. При следующей загрузке SW перекачает
// всё заново.

const CACHE_VERSION = 'v30';
const CACHE_NAME = `ro-memo-${CACHE_VERSION}`;

// Файлы, которые кэшируются сразу при первой установке SW
const PRECACHE = [
  './',
  './index.html',
  './faction.html',
  './app.html',
  './law.html',
  './css/app.css',

  './js/profile.js',
  './js/data.js',
  './js/store.js',
  './js/render.js',
  './js/modal.js',
  './js/app.js',
  './js/law.js',

  './js/data/_manifest.js',
  './js/data/changelog.js',
  './js/data/ak.js',
  './js/data/pdd.js',
  './js/data/pk.js',
  './js/data/uk.js',
  './js/data/advocacy.js',
  './js/data/business.js',
  './js/data/courts.js',
  './js/data/duma.js',
  './js/data/emergency.js',
  './js/data/ethics.js',
  './js/data/government.js',
  './js/data/ministries.js',
  './js/data/parties.js',
  './js/data/secret.js',
  './js/data/service.js',
  './js/data/territories.js',
  './js/data/tk.js',
  './js/data/constitution.js',
  './js/data/fso.js',
  './js/data/weapons.js',
  './js/data/vs.js',
  './js/data/fsb.js',
  './js/data/police.js',
  './js/data/gibdd.js',
  './js/data/sk.js',
  './js/data/prosecutor.js',
  './js/data/health.js',
  './js/data/immunity.js',

  './icons/icon-192.png',
  './icons/icon-512.png',
  './manifest.webmanifest',
];

// Установка — кэшируем всё из PRECACHE
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE);
    }).then(() => self.skipWaiting())
  );
});

// Активация — удаляем старые версии кэша
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && key.startsWith('ro-memo-'))
          .map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch — стратегия «сначала кэш, потом сеть»
// Хорошо для офлайна, но при обновлении данных надо инкрементировать
// CACHE_VERSION выше, иначе старая версия из кэша не сбросится.
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Только GET
  if (req.method !== 'GET') return;

  // Пропускаем всё, что не с нашего origin
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;

      return fetch(req).then((response) => {
        // Кэшируем успешные ответы
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        }
        return response;
      }).catch(() => {
        // Fallback: страница навигации → app.html
        if (req.mode === 'navigate') {
          return caches.match('./app.html');
        }
        // Для остального — пустой Response вместо ошибки,
        // чтобы браузер не падал с "Failed to convert value to 'Response'"
        return new Response('', {
          status: 504,
          statusText: 'Offline',
        });
      });
    })
  );
});