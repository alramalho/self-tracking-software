import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useIsFocused } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { usePlans } from "@/data/queries";
import { CelebrationOverlay } from "./CelebrationOverlay";
import { findUnseenMilestone, markMilestoneCelebrated } from "./milestones";
import type { Celebration, Milestone } from "./model";

/**
 * On Home: a Habit or Lifestyle badge earned where the log moment couldn't show it plays once, on its own,
 * when the app is opened (or comes back to the front). `blocked` while a sheet is open, since iOS can't
 * present the overlay's modal on top of another one.
 */
export function MilestoneRecap({ blocked }: { blocked?: boolean }) {
  const plans = usePlans();
  const client = useQueryClient();
  const focused = useIsFocused();
  const [shown, setShown] = useState<{ planId: string; kind: Milestone; celebration: Celebration } | null>(null);
  const [active, setActive] = useState(AppState.currentState === "active");
  const [retryTick, setRetryTick] = useState(0);
  const checking = useRef(false);
  const tries = useRef(0);
  const presented = useRef(false);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      setActive(state === "active");
      if (state === "active") void client.invalidateQueries({ queryKey: ["plans"] });
    });
    return () => sub.remove();
  }, [client]);

  useEffect(() => {
    // Wait for plans fetched this session: the saved copy may predate a badge being marked seen.
    if (shown || blocked || !focused || !active || !plans.isFetchedAfterMount || !plans.data || checking.current) return;
    if (tries.current >= 4) return;
    checking.current = true;
    void findUnseenMilestone(plans.data)
      .then((found) => {
        if (!found) return;
        const { plan, kind } = found;
        tries.current += 1;
        presented.current = false;
        setShown({
          planId: plan.id,
          kind,
          celebration: {
            emoji: plan.emoji || "🎯",
            line: plan.goal,
            plan: {
              id: plan.id,
              goal: plan.goal,
              emoji: plan.emoji || plan.activities[0]?.emoji || "🎯",
              target: 0,
              before: 0,
              after: 0,
              streakBefore: 0,
              streakAfter: 0,
            },
            weekDone: false,
            milestone: kind,
            recap: true,
          },
        });
      })
      .finally(() => {
        checking.current = false;
      });
  }, [shown, blocked, focused, active, plans.isFetchedAfterMount, plans.data, retryTick]);

  if (!shown) return null;
  return (
    <CelebrationOverlay
      key={`${shown.planId}:${shown.kind}`}
      celebration={shown.celebration}
      // Marked only once it is really on screen (so closing the app mid-moment doesn't replay it). If iOS
      // refused it because another sheet was up, it's tried again a little later.
      onShow={() => {
        presented.current = true;
        tries.current = 0;
        void markMilestoneCelebrated(shown.planId, shown.kind);
      }}
      onDone={() => {
        const retry = !presented.current;
        setShown(null);
        if (retry) setTimeout(() => setRetryTick((n) => n + 1), 3000);
        void client.invalidateQueries({ queryKey: ["plans"] });
      }}
    />
  );
}
