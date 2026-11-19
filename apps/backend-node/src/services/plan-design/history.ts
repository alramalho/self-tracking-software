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
    take: 60,
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
  const logged = activities.map((activity) => {
    const recent = activity.entries.filter((e) => e.datetime >= since);
    return {
      title: activity.title,
      measure: activity.measure,
      sessionsLast4Weeks: recent.length,
      lastLoggedAt: activity.entries[0]?.datetime.toISOString().slice(0, 10) ?? null,
      baseline: baselineFromLogs(recent, { title: activity.title, measure: activity.measure, now }),
    };
  });
  // The habits they keep logging come first, however long ago the activity itself was edited.
  return logged
    .sort((a, b) => (b.lastLoggedAt ?? "").localeCompare(a.lastLoggedAt ?? ""))
    .slice(0, 20);
}

/** "Meditate", "Meditation" and "meditating" are one habit; so are "Run" and "Running". */
function stem(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z]/g, "")
    .replace(/(ing|ions|ion|es|s)$/, "")
    .replace(/(ate|at|e)$/, "")
    .replace(/(.)\1$/, "$1");
}

/**
 * The logged activity the goal turned out to be about. The model names activities its own way
 * ("Meditation" for their "meditate"), so an exact title is only the first try.
 */
export function loggedActivityFor(history: LoggedActivity[], activity: { title: string; measure: string }): LoggedActivity | null {
  const exact = history.find((a) => a.title.toLowerCase() === activity.title.toLowerCase() && a.measure === activity.measure);
  if (exact) return exact;
  const same = history.filter((a) => stem(a.title) === stem(activity.title));
  return same.find((a) => a.measure === activity.measure) ?? same.find((a) => a.baseline) ?? same[0] ?? null;
}

/** The starting point measured from the logs of the activity the goal is about. */
export function baselineFor(history: LoggedActivity[], activity: { title: string; measure: string }): DesignBaseline | null {
  return loggedActivityFor(history, activity)?.baseline ?? null;
}

/** Their logs answer "where are you now?", so the coach asks them to confirm it. */
export function confirmLogsQuestion(baseline: DesignBaseline): string {
  const perWeek = baseline.measurements.find((m) => m.metric === "sessions_per_week")?.value;
  return perWeek ? `Your logs say about ${perWeek} a week. Still right?` : "Your logs show a start. Still right?";
}
