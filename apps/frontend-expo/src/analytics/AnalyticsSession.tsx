import { useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSession } from "@/auth/provider";
import { useCurrentUser, usePlans } from "@/data/queries";
import { streakProgress } from "@/features/plans/streak-progress";
import { identify, track } from "./client";
import { newStreakMilestones } from "./streak-milestones";
import type { StreakMilestoneRecord } from "./types";

let reports = Promise.resolve();

/** Links this device to the signed-in account and reports streak milestones. */
export function AnalyticsSession() {
  const auth = useSession(),
    user = useCurrentUser(auth.isSignedIn),
    plans = usePlans(auth.isSignedIn);
  const userId = auth.isSignedIn ? user.data?.id : undefined;

  useEffect(() => {
    if (userId) identify(userId);
  }, [userId]);

  useEffect(() => {
    if (!userId || !plans.data) return;
    const streaks = plans.data
      .filter((plan) => !plan.archivedAt && !plan.deletedAt)
      .map((plan) => ({
        planId: plan.id,
        streak: streakProgress(plan.progress).streak,
      }));
    // Reports run one at a time so quick refetches cannot report a milestone twice.
    reports = reports.then(() => reportStreakMilestones(userId, streaks));
  }, [userId, plans.data]);

  return null;
}

async function reportStreakMilestones(
  userId: string,
  streaks: { planId: string; streak: number }[],
) {
  const key = `trackingso:analytics:streaks:${userId}`;
  try {
    const stored = await AsyncStorage.getItem(key);
    const reported: StreakMilestoneRecord = stored ? JSON.parse(stored) : {};
    const { next, reached } = newStreakMilestones(reported, streaks);
    await AsyncStorage.setItem(key, JSON.stringify(next));
    for (const { planId, weeks } of reached)
      track("streak-milestone-reached", { weeks, plan_id: planId });
  } catch {
    // Analytics must never interrupt the app.
  }
}
