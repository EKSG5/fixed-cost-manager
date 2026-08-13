const CACHE_NAME = "fixed-cost-manager-v30";
const APP_SHELL = ["./", "./index.html", "./style.css", "./app.js", "./manifest.json", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/icon-maskable-512.png"];
const NETWORK_FIRST_PATHS = new Set(["", "index.html", "style.css", "app.js", "manifest.json"]);
const OFFLINE_PAGE = new URL("./index.html", self.registration.scope).href;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => Promise.all(APP_SHELL.map((path) => {
    const request = new Request(new URL(path, self.registration.scope), { cache: "reload" });
    return fetch(request).then((response) => {
      if (!response.ok) throw new Error(`キャッシュできませんでした: ${path}`);
      return cache.put(request, response);
    });
  }))).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys
    .filter((key) => (key.startsWith("subscription-manager-") || key.startsWith("fixed-cost-manager-")) && key !== CACHE_NAME)
    .map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(new URL("./", self.registration.scope).pathname)) return;
  const relativePath = url.pathname.slice(new URL("./", self.registration.scope).pathname.length);
  const useNetworkFirst = event.request.mode === "navigate" || NETWORK_FIRST_PATHS.has(relativePath);
  event.respondWith(useNetworkFirst ? networkFirst(event.request) : cacheFirst(event.request));
});

async function networkFirst(originalRequest) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const request = new Request(originalRequest, { cache: "no-store" });
    const response = await fetch(request);
    if (!response.ok) throw new Error(`ネットワーク応答エラー: ${response.status}`);
    await cache.put(originalRequest, response.clone());
    return response;
  } catch {
    return (await cache.match(originalRequest)) || (originalRequest.mode === "navigate" ? cache.match(OFFLINE_PAGE) : undefined);
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}
