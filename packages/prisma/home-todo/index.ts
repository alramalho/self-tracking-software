// The homepage's top: this week and next across every plan, and the one coach note worth showing.
// Shared by the iPhone app and the web app so both show the same days and the same note.
import { addDaysToDateKey, getPlanWeekDateKey } from "../plan-week";
import { HABIT_WEEKS, LIFESTYLE_WEEKS } from "../follow-through/streak";
import type { CoachNoteCandidate, HomeDay, HomeDayItem, HomeDaysInput, HomeProgressInput, HomeProgressRow, HomeProgressStreak } from "./types";

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
        const plan = planOf(cell.planId);
        // "Exercise 4 days a week" is any of its activities, unless the plan pins this day to one.
        const anyActivity = !cell.pinned && (plan?.activities?.length ?? 0) > 1;
        add(
          itemFor(cell.planId, cell.activityId, key, "flexible", {
            remaining: summary?.remaining,
            week,
            ...(anyActivity && plan
              ? { anyActivity, title: plan.goal, emoji: plan.emoji || activityOf(cell.activityId)?.emoji || "•", measure: undefined }
              : {}),
          }),
        );
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
          if (same.anyActivity && session.activityId) {
            // The coach chose one of the plan's activities for this day: show that one.
            const chosen = itemFor(session.planId, session.activityId, key, same.kind);
            Object.assign(same, { activityId: chosen.activityId, title: chosen.title, emoji: chosen.emoji, measure: chosen.measure, anyActivity: false });
          }
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

const whole = (value: number | undefined, fallback = 0) =>
  typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : fallback;

/** The streak and the badge it is heading for. Achievement flags describe the current stage, not whether earlier stages were reached. */
export function streakProgress(progress: HomeProgressStreak | null | undefined): HomeProgressRow["streak"] {
  const habit = progress?.habitAchievement;
  const lifestyle = progress?.lifestyleAchievement;
  const habitTarget = Math.max(1, whole(habit?.maxValue, HABIT_WEEKS));
  const lifestyleTarget = Math.max(habitTarget, whole(lifestyle?.maxValue, LIFESTYLE_WEEKS));
  const value = whole(
    progress?.achievement?.streak ?? progress?.currentStreak,
    Math.max(
      whole(habit?.progressValue),
      whole(lifestyle?.progressValue),
      lifestyle?.isAchieved ? lifestyleTarget : habit?.isAchieved ? habitTarget : 0,
    ),
  );
  const stage = value >= habitTarget ? "Lifestyle" : "Habit";
  return { stage, value, target: stage === "Lifestyle" ? lifestyleTarget : habitTarget };
}

/** Every plan with sessions this week, in plan order: the same counts the day tiles show, plus its streak. */
export function homeProgress({ projection, plans, entries }: HomeProgressInput): HomeProgressRow[] {
  const weekEndKey = addDaysToDateKey(projection.weekStartKey, 7);
  const thisWeek = (key: string) => key >= projection.weekStartKey && key < weekEndKey;
  return plans.flatMap((plan) => {
    const summary = projection.summaries.find((s) => s.planId === plan.id && s.weekIndex === 0);
    // A weekly-count plan has its week summed up already; a dated plan counts this week's sessions and the days it was logged.
    const ids = new Set(plan.activities?.map((activity) => activity.id));
    const target =
      summary?.target ?? projection.scheduledSessions.filter((s) => s.planId === plan.id && thisWeek(s.dateKey)).length;
    const done =
      summary?.completedDays ??
      new Set(
        entries
          .filter((entry) => !entry.deletedAt && entry.activityId && ids.has(entry.activityId))
          .map((entry) => getPlanWeekDateKey(entry.datetime))
          .filter(thisWeek),
      ).size;
    if (!target) return [];
    return [
      {
        planId: plan.id,
        goal: plan.goal,
        emoji: plan.emoji || plan.activities?.[0]?.emoji || "•",
        week: { done, target },
        streak: streakProgress(plan.progress),
      },
    ];
  });
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
