import { useEffect } from "react";
import { AppState, Platform } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/auth/provider";
import type { WidgetData } from "./types";
import { widgetBridge } from "./bridge";
import { widgetSnapshot } from "./model";

const keys = ["plans", "activity-entries", "metrics", "metric-entries", "follow-through"];

export function WidgetSync() {
  const { isSignedIn, userId } = useSession();
  const client = useQueryClient();
  useEffect(() => {
    if (Platform.OS !== "ios") return;
    const account = isSignedIn ? userId : null;
    let cancelled = false;
    let previous = "";
    let timer: ReturnType<typeof setTimeout>;
    const sync = async () => {
      if (!account || cancelled) return;
      const plans = client.getQueryData<WidgetData["plans"]>(["plans"]);
      const entries = client.getQueryData<WidgetData["entries"]>(["activity-entries"]);
      const metrics = client.getQueryData<WidgetData["metrics"]>(["metrics"]);
      const metricEntries = client.getQueryData<WidgetData["metricEntries"]>(["metric-entries"]);
      if (!plans || !entries || !metrics || !metricEntries) return;
      // A failed fetch must not give cached data a new freshness timestamp.
      const updated = keys.slice(0, 4).map(key => client.getQueryState([key])?.dataUpdatedAt ?? 0);
      const snapshot = widgetSnapshot({ plans, entries, metrics, metricEntries,
        followThrough: client.getQueryData<WidgetData["followThrough"]>(["follow-through"]) });
      snapshot.updatedAt = new Date(Math.min(...updated)).toISOString();
      const payload = JSON.stringify(snapshot);
      if (payload === previous) return;
      try {
        await widgetBridge.setSnapshot(account, payload);
        if (!cancelled) previous = payload;
      } catch {
        // Retry on the next cache update or foreground; widgets are optional.
      }
    };
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void sync(), 250);
    };
    void widgetBridge.setAccount(account).then(schedule).catch(() => {});
    const unsubscribe = client.getQueryCache().subscribe(event => {
      if (keys.includes(String(event.query.queryKey[0]))) schedule();
    });
    const foreground = AppState.addEventListener("change", state => {
      if (state === "active") schedule();
    });
    const clock = setInterval(schedule, 60_000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      clearInterval(clock);
      unsubscribe();
      foreground.remove();
    };
  }, [isSignedIn, userId, client]);
  return null;
}
