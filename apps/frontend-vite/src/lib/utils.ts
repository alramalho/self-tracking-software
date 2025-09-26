import { type ClassValue, clsx } from "clsx";
import { format } from "date-fns";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function arrayBufferToBase64Async(arrayBuffer: ArrayBuffer): string {
  // Convert ArrayBuffer to Uint8Array
  const uint8Array = new Uint8Array(arrayBuffer);

  // Convert to string using String.fromCharCode
  let binaryString = "";
  for (let i = 0; i < uint8Array.length; i++) {
    binaryString += String.fromCharCode(uint8Array[i]);
  }

  // Use btoa for base64 encoding
  return btoa(binaryString);
}

export const isNotifySupported = () => {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "Notification" in window &&
    "PushManager" in window
  );
};

export const isGeoSupported = () => {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "geolocation" in navigator
  );
};

export const isStorageSupported = () => {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "storage" in navigator
  );
};

export const todaysLocalDate = () => {
  return new Date(format(new Date(), "yyyy-MM-dd") + "T00:00:00.000Z");
};

export const toMidnightUTCDate = (date: Date) => {
  const newDate = new Date(format(date, "yyyy-MM-dd") + "T00:00:00.000Z");
  return newDate;
};
