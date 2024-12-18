import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function arrayBufferToBase64Async(arrayBuffer: ArrayBuffer) {
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  return base64;
}
