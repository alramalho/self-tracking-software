/// <reference lib="webworker" />

import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

// Type declarations for service worker
interface ServiceWorkerGlobalScope extends WorkerGlobalScope {
  registration: ServiceWorkerRegistration;
  clients: Clients;
}

// This declares the value of `injectionPoint` to TypeScript.
// `injectionPoint` is the string that will be replaced by the
// actual precache manifest. By default, this string is set to
// `"self.__SW_MANIFEST"`.
declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  // No runtime caching - only cache precached static assets
  runtimeCaching: [],
});

// This replaces the old installSerwist call
serwist.addEventListeners();

// Your existing push notification handler
self.addEventListener("push", function (event: any) {
  if (event.data) {
    const data = event.data.json();
    event.waitUntil(
      self.registration.showNotification(data.title, {
        body: data.body,
        icon: data.icon || "/icons/icon-192x192.png",
        data: { url: data.url },
      })
    );
    if (data.badge && navigator.setAppBadge) {
      navigator.setAppBadge(data.badge);
    }
  }
});

// Your existing notification click handler
self.addEventListener("notificationclick", function (event: any) {
  event.notification.close();

  if (event.notification.data && event.notification.data.url) {
    event.waitUntil(
      self.clients
        .matchAll({ type: "window" })
        .then(function (clientList: any) {
          for (const client of clientList) {
            if (
              client.url ===
                "https://app.tracking.so" + event.notification.data.url &&
              "focus" in client
            ) {
              return client.focus();
            }
          }
          if (self.clients.openWindow) {
            return self.clients.openWindow(
              "https://app.tracking.so" + event.notification.data.url
            );
          }
        })
    );
  }
});
