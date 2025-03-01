import { useLocalStorage } from "./useLocalStorage";
import { useEffect, useState } from "react";
import { useApiWithAuth } from "@/api";
import { useQuery } from "@tanstack/react-query";

interface CachedMessage {
  message: string;
  timestamp: number;
}

const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

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
        timestamp: Date.now(),
      };
      setCachedData(newData);
      return response.data;
    },
    enabled: shouldFetch, // Only run query if we need new data
  });

  return {
    message: cachedData?.message || aiMessageData?.message || "",
    isStale: shouldFetch,
  };
}
