import { useCallback, useEffect, useRef, useState } from "react";
import { useIsFocused } from "expo-router";
import type { ViewToken } from "react-native";
import { api } from "@/data/api";
import type { User } from "@/core/types";
import type { FeedItem, TimelineRow } from "./types";

export function useTimelineSeen(user: User | undefined, items: FeedItem[]) {
  const focused = useIsFocused();
  const [baseline, setBaseline] = useState<number | null>();
  const lastSynced = useRef(0);
  const pending = useRef(false);
  useEffect(() => {
    if (user && baseline === undefined)
      setBaseline(
        user.lastSeenTimelineAt
          ? new Date(user.lastSeenTimelineAt).getTime()
          : null,
      );
  }, [user, baseline]);
  const dividerIndex =
    baseline && items[0]?.date > baseline
      ? items.findIndex((item) => item.date <= baseline)
      : -1;
  const rows: TimelineRow[] = items.map((item) => ({ id: item.id, item }));
  if (dividerIndex > 0) rows.splice(dividerIndex, 0, { id: "seen-divider" });
  const newest = items[0]?.date ?? 0;
  const sync = useCallback(async () => {
    if (!focused || !user || pending.current || newest <= lastSynced.current)
      return;
    pending.current = true;
    try {
      await api.post("/users/update-timeline-seen", {
        lastSeenTimelineAt: new Date(newest).toISOString(),
      });
      lastSynced.current = newest;
    } catch {
      /* Retry on the next view; a failed sync must not interrupt reading. */
    } finally {
      pending.current = false;
    }
  }, [focused, user, newest]);
  const latestSync = useRef(sync);
  latestSync.current = sync;
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken<TimelineRow>[] }) => {
      if (viewableItems.some((row) => row.item.id === "seen-divider"))
        void latestSync.current();
    },
  ).current;
  useEffect(() => {
    if (!focused || baseline === undefined || dividerIndex > 0 || !newest)
      return;
    const timer = setTimeout(() => void sync(), 3000);
    return () => clearTimeout(timer);
  }, [focused, baseline, dividerIndex, newest, sync]);
  return { rows, onViewableItemsChanged };
}
