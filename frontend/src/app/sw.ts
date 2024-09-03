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

// Add these new event listeners
self.addEventListener("periodicsync", (event: any) => {
  if (event.tag === "daily-sync") {
    event.waitUntil(dailySync());
  }
});

async function dailySync() {
  console.log("Daily sync occurred at:", new Date().toISOString());

  const lastLogin = await getLastLoginDate();
  const daysSinceLastLogin = getDaysSince(lastLogin);

  if (daysSinceLastLogin > 0) {
    scheduleNotification(daysSinceLastLogin);
  }
}

async function getLastLoginDate() {
  // Implement this to fetch the last login date from your backend or local storage
  // For now, let's assume it returns a Date object
  return new Date("2023-05-01");
}

function getDaysSince(date: Date) {
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

function scheduleNotification(days: number) {
  const now = new Date();
  const notificationTime = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    20,
    0,
    0
  );

  if (now > notificationTime) {
    notificationTime.setDate(notificationTime.getDate() + 1);
  }

  const delay = notificationTime.getTime() - now.getTime();

  setTimeout(() => {
    self.registration.showNotification("Login Reminder", {
      body: `You have not logged in for ${days} days.`,
      icon: "/icons/icon-192x192.png",
    });
  }, delay);
}
