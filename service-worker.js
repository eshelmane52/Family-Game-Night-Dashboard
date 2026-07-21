const CACHE_NAME = "family-game-night-dashboard-v2.02";

const APP_ASSETS = [
    "./",
    "./index.html",
    "./gift-cards.html",
    "./styles.css",
    "./gift-cards.css",
    "./dashboard-ui.js",
    "./app.js",
    "./gift-cards.js",
    "./assets/audio/victory.mp3",
    "./manifest.webmanifest",
    "./icons/icon-192.png",
    "./icons/icon-512.png",
    "./icons/apple-touch-icon.png"
];

self.addEventListener("install", function (event) {
    event.waitUntil(
        caches.open(CACHE_NAME).then(function (cache) {
            return cache.addAll(APP_ASSETS);
        })
    );

    self.skipWaiting();
});

self.addEventListener("activate", function (event) {
    event.waitUntil(
        caches.keys().then(function (cacheNames) {
            return Promise.all(
                cacheNames
                    .filter(function (cacheName) {
                        return cacheName !== CACHE_NAME;
                    })
                    .map(function (cacheName) {
                        return caches.delete(cacheName);
                    })
            );
        })
    );

    self.clients.claim();
});

self.addEventListener("fetch", function (event) {
    if (event.request.method !== "GET") {
        return;
    }

    event.respondWith(
        caches.match(event.request).then(function (cachedResponse) {
            if (cachedResponse) {
                return cachedResponse;
            }

            return fetch(event.request).catch(function () {
                if (event.request.mode === "navigate") {
                    const requestUrl = new URL(event.request.url);
                    const fallbackPage = requestUrl.pathname.endsWith("/gift-cards.html")
                        ? "./gift-cards.html"
                        : "./index.html";

                    return caches.match(fallbackPage, { ignoreSearch: true });
                }
            });
        })
    );
});
