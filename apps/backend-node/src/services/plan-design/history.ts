import type { DesignBaseline } from "@tsw/prisma/follow-through";
import { healthSafeActivityFilter } from "../health/apple/ai-boundary";
import { prisma } from "../../utils/prisma";
import { baselineFromLogs } from "./baseline";
import type { LoggedActivity } from "./types";

const DAY = 86_400_000;

/**
 * What the person has already logged, per activity, so the coach never asks what their history answers.
 * Recent means the last 4 weeks; lastLoggedAt covers older habits that have lapsed.
 */
export async function loggedActivities(userId: string, now = new Date()): Promise<LoggedActivity[]> {
  const since = new Date(now.getTime() - 28 * DAY);
  const activities = await prisma.activity.findMany({
    where: { userId, deletedAt: null },
    orderBy: { updatedAt: "desc" },
    take: 20,
    select: {
      title: true,
      measure: true,
      entries: {
        where: { ...healthSafeActivityFilter, userId, deletedAt: null },
        orderBy: { datetime: "desc" },
        take: 60,
        select: { datetime: true, quantity: true },
      },
    },
  });
  return activities.map((activity) => {
    const recent = activity.entries.filter((e) => e.datetime >= since);
    return {
      title: activity.title,
      measure: activity.measure,
      sessionsLast4Weeks: recent.length,
      lastLoggedAt: activity.entries[0]?.datetime.toISOString().slice(0, 10) ?? null,
      baseline: baselineFromLogs(recent, { title: activity.title, measure: activity.measure, now }),
    };
  });
}

/** The starting point measured from the logs of the activity the goal turned out to be about. */
export function baselineFor(history: LoggedActivity[], activity: { title: string; measure: string }): DesignBaseline | null {
  const match = history.find(
    (a) => a.title.toLowerCase() === activity.title.toLowerCase() && a.measure === activity.measure,
  );
  return match?.baseline ?? null;
}
