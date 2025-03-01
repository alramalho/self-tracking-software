import { useLocalStorage } from "./useLocalStorage";
import { useEffect, useState } from "react";
import { useApiWithAuth } from "@/api";
import { useQuery } from "@tanstack/react-query";

interface CachedMessage {
  message: string;
  messageId: string;
  timestamp: number;
  dismissedAt: number | null;
}

const CACHE_DURATION = 16 * 60 * 60 * 1000; // 16 hours in milliseconds
const DISMISSAL_DURATION = 16 * 60 * 60 * 1000; // 16 hours in milliseconds

export function useAIMessageCache(type: "metrics" | "activity" | "plan") {
  const [cachedData, setCachedData] = useLocalStorage<CachedMessage | null>(
    `ai-message-${type}`,
    null
  );
  const [shouldFetch, setShouldFetch] = useState(false);
  const api = useApiWithAuth();

  // Check if we need to fetch new data
  useEffect(() => {
    const now = Date.now();
    const shouldFetchNew =
      !cachedData || now - cachedData.timestamp > CACHE_DURATION;
    setShouldFetch(shouldFetchNew);
  }, [cachedData]);

  // Check if the message is dismissed
  const isDismissed = () => {
    if (!cachedData?.dismissedAt) return false;
    const now = Date.now();
    return now - cachedData.dismissedAt < DISMISSAL_DURATION;
  };

  const dismiss = () => {
    if (cachedData) {
      setCachedData({
        ...cachedData,
        dismissedAt: Date.now(),
      });
    }
  };

  const reset = () => {
    if (cachedData) {
      setCachedData({
        ...cachedData,
        dismissedAt: null,
      });
    }
  };

  // Query configuration
  const endpoints = {
    metrics: "/ai/generate-metrics-dashboard-message",
    activity: "/ai/generate-activity-message",
    plan: "/ai/generate-plan-message",
  };

  const { data: aiMessageData } = useQuery({
    queryKey: [`${type}-message`],
    queryFn: async () => {
      const response = await api.get(endpoints[type]);
      const newData = {
        message: response.data.message,
        messageId: response.data.message_id,
        timestamp: Date.now(),
        dismissedAt: null,
      };
      setCachedData(newData);
      return response.data;
    },
    enabled: shouldFetch, // Only run query if we need new data
  });

  return {
    message: cachedData?.message || aiMessageData?.message || "",
    messageId: cachedData?.messageId || aiMessageData?.messageId || "",
    isStale: shouldFetch,
    isDismissed: isDismissed(),
    dismiss,
    reset,
  };
}
