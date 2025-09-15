import { type ClassValue, clsx } from "clsx";
import { format, isAfter } from "date-fns";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const todaysLocalDate = () => {
  return new Date(format(new Date(), "yyyy-MM-dd") + "T00:00:00.000Z");
};

export const toMidnightUTCDate = (date: Date) => {
  const newDate = new Date(format(date, "yyyy-MM-dd") + "T00:00:00.000Z");
  return newDate;
};

export const isActivePlan = (plan: {
  finishingDate: Date | string | null;
  deletedAt: Date | string | null;
}) => {
  if (!plan.finishingDate) return true;
  if (plan.deletedAt) return false;

  return isAfter(new Date(plan.finishingDate), new Date());
};

export function arrayBufferToBase64Async(arrayBuffer: ArrayBuffer) {
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  return base64;
}

export function capitalizeFirstLetter(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function formatTimeAgo(date: string | Date) {
  const now = new Date();
  const past = new Date(date);
  const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return "just now";
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours}h ago`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `${diffInDays}d ago`;
  }

  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks < 4) {
    return `${diffInWeeks}w ago`;
  }

  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) {
    return `${diffInMonths}mo ago`;
  }

  const diffInYears = Math.floor(diffInDays / 365);
  return `${diffInYears}y ago`;
}

export function getMessagePreview(message: string): string {
  console.log({ message });
  const firstLine = message.split("\n")[0].trim();
  if (firstLine.length > 50) {
    return firstLine.substring(0, 50) + " ...";
  }
  return firstLine;
}
