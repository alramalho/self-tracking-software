import type { Visibility } from "@tsw/prisma";
import { prisma } from "../../utils/prisma";
import type { PlanWithActivities } from "./types";

// What other people see of a plan:
//   PUBLIC / FRIENDS → the plan and its logs
//   LOGS_ONLY        → only the logs, never the plan
//   PRIVATE          → nothing
export function planShownToOthers(visibility: Visibility): boolean {
  return visibility === "PUBLIC" || visibility === "FRIENDS";
}

export function logsShownToOthers(visibility: Visibility): boolean {
  return visibility !== "PRIVATE";
}

// An activity can sit in several plans. Its logs stay hidden only when every
// plan it belongs to hides them: a log under a visible plan says nothing about
// the hidden one. Activities in no plan are visible.
export function hiddenActivityIds(plans: PlanWithActivities[]): Set<string> {
  const hidden = new Set<string>();
  const shown = new Set<string>();
  for (const plan of plans) {
    const bucket = logsShownToOthers(plan.visibility) ? shown : hidden;
    for (const activity of plan.activities) bucket.add(activity.id);
  }
  for (const id of shown) hidden.delete(id);
  return hidden;
}

// Finished plans count too: ending a hidden plan doesn't publish its logs.
export async function loadHiddenActivityIds(
  userIds: string[],
): Promise<Set<string>> {
  if (!userIds.length) return new Set();
  const plans = await prisma.plan.findMany({
    where: { userId: { in: userIds }, deletedAt: null },
    select: { visibility: true, activities: { select: { id: true } } },
  });
  return hiddenActivityIds(plans);
}
