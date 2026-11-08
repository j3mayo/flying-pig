/* Offline shell. Always asks the network first (bypassing the browser cache) so updates show on the next open. */
const C = "fp-shell-2026.11.08.2101";
self.addEventListener("install", e => { e.waitUntil(caches.open(C).then(c => c.addAll(["./", "apple-touch-icon.png", "icon-192.png", "manifest.webmanifest"].map(u => new Request(u, {cache:"reload"}))))); self.skipWaiting(); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== C).map(x => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const r = e.request; if (r.method !== "GET") return;
  const u = new URL(r.url), nav = r.mode === "navigate", same = u.origin === location.origin;
  if (!(nav || same || u.href.includes("supabase-js@"))) return;
  const key = nav ? "./" : r;
  const net = same || nav ? fetch(r.url, {cache:"no-store", credentials:"same-origin"}) : fetch(r);
  e.respondWith(net.then(res => { if (res.ok) { const cp = res.clone(); caches.open(C).then(c => c.put(key, cp)); } return res; }).catch(() => caches.match(key)));
});
