/* Optify KSA offline service worker.
 *
 * Scope: only the /deliveries route. The driver opens the page online once,
 * the SW caches the rendered HTML + JS chunks + CSS, and subsequent visits
 * load from cache when the network is unreachable.
 *
 * Network-first for same-origin GETs (so updates land when online),
 * cache fallback when fetch rejects (offline). All non-GET and cross-origin
 * requests bypass the SW entirely — Supabase REST goes straight to network
 * because stale data here would be worse than an offline error.
 */

const CACHE = "optify-deliveries-v1";

self.addEventListener("install", (event) => {
  // Take over immediately on first install
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Don't cache Supabase calls — they go via supabase.co, but defensively
  // also skip /api routes here.
  if (url.pathname.startsWith("/api/")) return;

  // Cache the deliveries route + Next.js static assets that load it.
  const isDeliveries = url.pathname === "/deliveries" || url.pathname.startsWith("/deliveries/");
  const isNextStatic = url.pathname.startsWith("/_next/static/");
  if (!isDeliveries && !isNextStatic) return;

  event.respondWith(
    (async () => {
      try {
        const fresh = await fetch(req);
        // Only cache successful, basic responses
        if (fresh.ok && fresh.type === "basic") {
          const cache = await caches.open(CACHE);
          cache.put(req, fresh.clone());
        }
        return fresh;
      } catch {
        const cached = await caches.match(req);
        if (cached) return cached;
        // Last-resort: return a minimal offline shell for the deliveries page
        if (isDeliveries) {
          return new Response(
            "<!doctype html><meta charset=utf-8><title>Offline · Optify</title>" +
              "<body style='font:14px Inter,system-ui;padding:24px;color:#171717'>" +
              "<h1 style='font-size:20px;font-weight:500;margin:0 0 8px'>You’re offline</h1>" +
              "<p style='color:#525252'>Open this page once with internet to cache it. " +
              "Pending status updates will sync automatically when you reconnect.</p>",
            { headers: { "content-type": "text/html; charset=utf-8" } },
          );
        }
        throw new Error("offline and uncached");
      }
    })(),
  );
});
