"use client";

import * as React from "react";

/**
 * SW UNINSTALLER. Earlier versions of this app registered a service
 * worker scoped to /deliveries (since removed). The SW over-cached
 * /_next/static/ across the entire app and made deploys feel broken
 * because users kept seeing old chunks long after a release.
 *
 * This component now actively unregisters any leftover SW on mount and
 * wipes every Cache Storage entry, so existing installations heal on
 * the next page load. /sw.js itself is also a kill-switch — see
 * public/sw.js for details.
 */
export function ServiceWorkerRegister() {
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    (async () => {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
      } catch {
        // best-effort cleanup; failure to clean caches is not fatal
      }
    })();
  }, []);

  return null;
}
