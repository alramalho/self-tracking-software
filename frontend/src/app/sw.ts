import { defaultCache } from "@serwist/next/browser";
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
  runtimeCaching: defaultCache,
});

// Modify your existing showNotification code
self.addEventListener("push", function (event: any) {
  console.log("Push message received:", event);
  if (event.data) {
    const data = event.data.json();
    console.log("Push data:", data);
    event.waitUntil(
      self.registration.showNotification(data.title, {
        body: data.body,
        icon: data.icon || "/icons/icon-192x192.png",
        data: { url: data.url },
      })
    );
  }
});
