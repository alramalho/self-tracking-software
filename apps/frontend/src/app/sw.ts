import type { PrecacheEntry } from "@serwist/precaching";
import { installSerwist } from "@serwist/sw";

// @ts-ignore
declare const self: ServiceWorkerGlobalScope & {
  // Change this attribute's name to your `injectionPoint`.
  // `injectionPoint` is an InjectManifest option.
  // See https://serwist.pages.dev/docs/build/inject-manifest/configuring
  __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
};

installSerwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  // runtimeCaching: defaultCache, // disable cache (relying on useQuery + localStorage)
});

// Modify your existing showNotification code
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
    data.badge && navigator.setAppBadge && navigator.setAppBadge(data.badge);
  }
});

// Add this new event listener
self.addEventListener("notificationclick", function (event: any) {
  event.notification.close();

  if (event.notification.data && event.notification.data.url) {
    event.waitUntil(
      // @ts-ignore clients is not defined in the service worker global scope
      clients.matchAll({ type: "window" }).then(function (clientList: any) {
        for (const client of clientList) {
          if (
            client.url ===
              "https://app.tracking.so" + event.notification.data.url &&
            "focus" in client
          ) {
            return client.focus();
          }
        }
        // @ts-ignore clients is not defined in the service worker global scope
        if (clients.openWindow) {
          // @ts-ignore clients is not defined in the service worker global scope
          return clients.openWindow(
            "https://app.tracking.so" + event.notification.data.url
          );
        }
      })
    );
  }
});
