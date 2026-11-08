/* Offline shell. Always asks the network first (bypassing the browser cache) so updates show on the next open. */
const C = "fp-shell-2026.11.08.2229";
self.addEventListener("install", e => { e.waitUntil(caches.open(C).then(c => c.addAll(["./", "apple-touch-icon.png", "icon-192.png", "manifest.webmanifest"].map(u => new Request(u, {cache:"reload"}))))); self.skipWaiting(); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== C).map(x => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener("push", e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (_) { d = { title: "Healthspan", body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.title || "Healthspan", { body: d.body || "", icon: "icon-192.png", badge: "icon-192.png", tag: d.tag || "healthspan", data: { url: d.url || "./" } }));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const target = new URL(e.notification.data && e.notification.data.url || "./", self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => { const w = list.find(c => c.url.startsWith(self.registration.scope)); if (w) { w.navigate(target); return w.focus(); } return self.clients.openWindow(target); }));
});
self.addEventListener("fetch", e => {
  const r = e.request; if (r.method !== "GET") return;
  const u = new URL(r.url), nav = r.mode === "navigate", same = u.origin === location.origin;
  if (!(nav || same || u.href.includes("supabase-js@"))) return;
  const key = nav ? "./" : r;
  const net = same || nav ? fetch(r.url, {cache:"no-store", credentials:"same-origin"}) : fetch(r);
  e.respondWith(net.then(res => { if (res.ok) { const cp = res.clone(); caches.open(C).then(c => c.put(key, cp)); } return res; }).catch(() => caches.match(key)));
});
