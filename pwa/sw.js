'use strict';
const CACHE_NAME = 'static-cache-v1';
const FILES_TO_CACHE = [
    'index.html'
];

self.addEventListener('install', (evt) => {
    evt.waitUntil(
        cacehs.open(CACHE_NAME).then((cache) => {
            console.log('[ServiceWorker] Pre-caching offline page');
            return cache.addAll(FILES_TO_CACHE);
        })
    );
});