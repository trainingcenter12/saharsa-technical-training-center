/* Saharsa Technical Training Centre: service worker
   - HTML pages + same-site files: served instantly from cache, refreshed in the background
   - CDN images, fonts and Supabase photos: cache-first after the first visit
   Bump VERSION to force every visitor to drop the old cache. */
const VERSION = "sttc-v5";
const RT = VERSION + "-rt";
const SHELL = ["/", "/favicon.png"];
const CDN = /(^|\.)(cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com)$/;
const MAX_RT = 160;

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL).catch(() => {})).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION && k !== RT).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

async function trim(name, max) {
  const c = await caches.open(name), ks = await c.keys();
  if (ks.length > max) await Promise.all(ks.slice(0, ks.length - max).map(k => c.delete(k)));
}
/* stale-while-revalidate: answer from cache at once, update the cache behind the scenes */
async function swr(req, name, cors) {
  const c = await caches.open(name);
  const hit = await c.match(req, { ignoreVary: true });
  const net = fetch(cors ? new Request(req.url, { mode: "cors", credentials: "omit" }) : req)
    .then(r => { if (r && r.ok) { c.put(req, r.clone()).then(() => name === RT && trim(RT, MAX_RT)).catch(() => {}); } return r; })
    .catch(() => hit);
  return hit || net;
}

self.addEventListener("fetch", e => {
  const r = e.request;
  if (r.method !== "GET" || r.headers.has("range")) return;
  const u = new URL(r.url);
  if (u.origin === location.origin) {
    if (u.pathname === "/sw.js") return;
    e.respondWith(swr(r, VERSION, false));
    return;
  }
  if (CDN.test(u.hostname) || (u.hostname.endsWith(".supabase.co") && u.pathname.includes("/storage/v1/object/public/"))) {
    e.respondWith(swr(r, RT, true));
  }
});
