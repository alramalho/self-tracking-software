import { prisma } from "@/utils/prisma";
import { healthPreview } from "./service";
import type { WorkoutDetail, WorkoutReconciliationAction } from "./types";

export async function getWorkoutDetail(
  viewerId: string,
  workoutId: string,
): Promise<WorkoutDetail | null> {
  const workout = await prisma.healthWorkout.findFirst({
    where: {
      id: workoutId,
      provider: { in: ["apple_health", "garmin_connect"] },
      deletedAt: null,
    },
    include: {
      reconciliation: {
        include: {
          activityEntry: { include: { activity: true } },
        },
      },
    },
  });
  if (!workout) return null;

  const own = workout.userId === viewerId;
  const reconciliation = workout.reconciliation;
  const entry = reconciliation?.activityEntry;
  const activeEntry =
    entry && !entry.deletedAt && entry.activityId && entry.activity && !entry.activity.deletedAt
      ? entry
      : null;
  const activity = activeEntry?.activity;
  const shared =
    reconciliation?.action !== "ignore" &&
    reconciliation?.matchReasons != null &&
    typeof reconciliation.matchReasons === "object" &&
    !Array.isArray(reconciliation.matchReasons) &&
    reconciliation.matchReasons.healthDataIsPublic === true;
  if (!own && !(shared && activeEntry)) return null;

  return {
    healthWorkout: healthPreview(workout),
    resolved: reconciliation
      ? {
          action: reconciliation.action as WorkoutReconciliationAction,
          activityEntryId: activeEntry ? reconciliation.activityEntryId : null,
          healthDataIsPublic: shared,
          linkedActivity: activeEntry && activity
            ? {
                title: activity.title,
                emoji: activity.emoji,
                measure: activity.measure,
                quantity: activeEntry.quantity,
              }
            : null,
          confirmedAt: reconciliation.confirmedAt.toISOString(),
        }
      : null,
    isOwner: own,
    canEditPrivacy: own && Boolean(activeEntry),
  };
}
