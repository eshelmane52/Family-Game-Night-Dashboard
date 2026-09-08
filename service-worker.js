const CACHE_NAME = "family-game-night-dashboard-v3.04";

const APP_ASSETS = [
    "./",
    "./index.html",
    "./workouts.html",
    "./gift-cards.html",
    "./styles.css",
    "./workouts.css",
    "./gift-cards.css",
    "./dashboard-ui.js",
    "./workout-utils.js",
    "./app.js",
    "./workouts.js",
    "./gift-cards.js",
    "./assets/audio/victory.mp3",
    "./assets/audio/workout-complete.mp3",
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
                    let fallbackPage = "./index.html";

                    if (requestUrl.pathname.endsWith("/gift-cards.html")) {
                        fallbackPage = "./gift-cards.html";
                    } else if (requestUrl.pathname.endsWith("/workouts.html")) {
                        fallbackPage = "./workouts.html";
                    }

                    return caches.match(fallbackPage, { ignoreSearch: true });
                }
            });
        })
    );
});
