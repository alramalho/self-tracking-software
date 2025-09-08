import { type ClassValue, clsx } from "clsx";
import { isAfter } from "date-fns";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const handleQueryError = (
  error: Error & { digest?: string },
  customErrorMessage: string
) => {
  customErrorMessage;
  let customError = {
    ...error,
    digest: error.digest || "",
    message: "(useQuery Error)" + customErrorMessage + +error.message || "",
  };
  console.error(customError);
  logError(customError);
};

export const logError = async (
  error: Error & { digest?: string },
  url?: string
) => {
  try {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
    if (!backendUrl) {
      console.error("Backend URL not configured");
      return;
    }

    await fetch(`${backendUrl}/admin/public/log-error`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        error_message: error.message,
        error_digest: error.digest,
        url:
          url || (typeof window !== "undefined" ? window.location.href : null),
        referrer:
          typeof document !== "undefined"
            ? document.referrer || "direct"
            : null,
        user_agent:
          typeof window !== "undefined" ? window.navigator.userAgent : null,
        timestamp: new Date().toISOString(),
        user_clerk_id: null,
      }),
    });
  } catch (e) {
    // Silently fail if we can't log the error
    console.error("Failed to log error:", e);
  }
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
