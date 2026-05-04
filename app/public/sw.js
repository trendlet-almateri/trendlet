// KILL-SWITCH service worker. Old versions of this SW (when /deliveries
// existed) cached every Next.js static chunk under /_next/static/ across
// the entire app, which broke deploys — users kept seeing old code even
// after hard-refresh because the SW intercepted requests for new chunk
// hashes and mixed old runtime with new chunks.
//
// This replacement does NOTHING except uninstall itself and wipe every
// cache on activate. Browsers refresh the SW automatically every 24h
// or when navigating to the site, so installations heal themselves on
// the next visit. New installs are prevented by removing the
// registration entrypoint in components/offline/sw-register.tsx.

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(Promise.resolve());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: "window" });
      for (const client of clients) client.navigate(client.url);
    })(),
  );
});

// Pass-through fetch — never intercept, so new chunks always come fresh
// from the network during the brief window before unregister completes.
self.addEventListener("fetch", () => {});
