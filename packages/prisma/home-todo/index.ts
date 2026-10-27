// The homepage's top: this week and next across every plan, and the one coach note worth showing.
// Shared by the iPhone app and the web app so both show the same days and the same note.
import { addDaysToDateKey, getPlanWeekDateKey } from "../plan-week";
import type { CoachNoteCandidate, HomeDay, HomeDayItem, HomeDaysInput } from "./types";

export type * from "./types";

/** A coach message older than this is no longer news on the homepage. */
export const COACH_NOTE_FRESH_HOURS = 48;

const KIND_ORDER = { scheduled: 0, flexible: 1, done: 2 } as const;

/** This week and next, Sunday first: every plan's sessions, open weekly slots and logs, per day. */
export function homeDays({ projection, plans, entries, practice = [] }: HomeDaysInput): HomeDay[][] {
  const planOf = (id: string) => plans.find((plan) => plan.id === id);
  const activityOf = (id: string) => projection.activities.find((activity) => activity.id === id);
  const loggedOn = (activityId: string, key: string) =>
    entries.some(
      (entry) => !entry.deletedAt && entry.activityId === activityId && getPlanWeekDateKey(entry.datetime) === key,
    );
  const itemFor = (
    planId: string,
    activityId: string,
    key: string,
    kind: HomeDayItem["kind"],
    extra: Partial<HomeDayItem> = {},
  ): HomeDayItem => {
    const activity = activityOf(activityId);
    const plan = planOf(planId);
    return {
      id: `${kind}:${planId}:${activityId}:${key}`,
      planId,
      planGoal: plan?.goal ?? "",
      activityId,
      title: activity?.title ?? plan?.goal ?? "",
      emoji: activity?.emoji || plan?.emoji || "•",
      kind,
      measure: activity?.measure,
      ...extra,
    };
  };

  return [0, 1].map((week) =>
    Array.from({ length: 7 }, (_, index) => {
      const key = addDaysToDateKey(projection.weekStartKey, week * 7 + index);
      const items: HomeDayItem[] = [];
      const add = (item: HomeDayItem) => {
        if (!items.some((existing) => existing.id === item.id)) items.push(item);
      };
      for (const session of projection.scheduledSessions.filter((s) => s.dateKey === key))
        add(
          itemFor(session.planId, session.activityId, key, loggedOn(session.activityId, key) ? "done" : "scheduled", {
            quantity: session.quantity,
          }),
        );
      for (const cell of projection.flexibleCells.filter((c) => c.dateKey === key)) {
        if (items.some((item) => item.planId === cell.planId)) continue;
        const summary = projection.summaries.find((s) => s.planId === cell.planId && s.weekIndex === week);
        add(itemFor(cell.planId, cell.activityId, key, "flexible", { remaining: summary?.remaining }));
      }
      // Logged cells carry no plan of their own: the plan is the one that owns the activity.
      for (const cell of projection.completedCells.filter((c) => c.dateKey === key)) {
        const owner = plans.find((plan) => plan.activities?.some((a) => a.id === cell.activityId));
        if (owner) add(itemFor(owner.id, cell.activityId, key, "done"));
      }
      for (const session of practice.filter((p) => p.date === key && p.outcome !== "SKIPPED")) {
        const done = session.outcome === "DONE" || session.outcome === "PARTLY";
        const same = items.find((item) => item.planId === session.planId);
        if (same) {
          // The practice session is the same piece of work as the plan's slot that day: one row, with its time.
          same.sessionId = session.id;
          same.time = session.time;
          if (done) same.kind = "done";
          else if (same.kind === "flexible") same.kind = "scheduled";
        } else
          add(itemFor(session.planId, session.activityId, key, done ? "done" : "scheduled", { sessionId: session.id, time: session.time }));
      }
      items.sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || (a.time ?? "99:99").localeCompare(b.time ?? "99:99"));
      return {
        key,
        isToday: key === projection.todayKey,
        isPast: key < projection.todayKey,
        items,
      };
    }),
  );
}

/** How much a coach item matters right now, lowest first; null when it is not homepage news. */
function noteRank(item: CoachNoteCandidate, now: Date): number | null {
  if (item.kind === "checkin") return null;
  if (item.kind === "alert") {
    if (item.alert?.status === "at_risk") return 1;
    if (item.alert?.status === "missed") return 4;
    // A plan going quiet is only news once the coach has actually reached out about it.
    return item.alert?.nudge ? 5 : null;
  }
  const ageHours = (now.getTime() - new Date(item.at).getTime()) / 3_600_000;
  if (ageHours < 0 || ageHours > COACH_NOTE_FRESH_HOURS) return null;
  return item.kind === "request" ? 0 : item.kind === "attention" ? 2 : 3;
}

/**
 * The one thing from the Coach tab worth a note on the homepage: the coach asked you something,
 * a plan is at risk this week, or a fresh plan warning. Nothing else, so the note stays rare.
 */
export function pickCoachNote<T extends CoachNoteCandidate>(items: T[], now = new Date()): T | null {
  let best: { item: T; rank: number } | null = null;
  for (const item of items) {
    const rank = noteRank(item, now);
    if (rank === null) continue;
    if (!best || rank < best.rank || (rank === best.rank && item.at > best.item.at)) best = { item, rank };
  }
  return best?.item ?? null;
}
