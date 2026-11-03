/* Offline shell: the app opens without signal; data syncs when back online. */
const C = "fp-shell-v2";
self.addEventListener("install", e => { e.waitUntil(caches.open(C).then(c => c.addAll(["./", "apple-touch-icon.png", "icon-192.png", "manifest.webmanifest"]))); self.skipWaiting(); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== C).map(x => caches.delete(x))))); self.clients.claim(); });
self.addEventListener("fetch", e => {
  const r = e.request; if (r.method !== "GET") return;
  const u = new URL(r.url), nav = r.mode === "navigate";
  if (!(nav || u.origin === location.origin || u.href.includes("supabase-js@"))) return;
  const key = nav ? "./" : r;
  e.respondWith(fetch(r).then(res => { if (res.ok) { const cp = res.clone(); caches.open(C).then(c => c.put(key, cp)); } return res; }).catch(() => caches.match(key)));
});
