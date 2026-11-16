import { formatInTimeZone } from "date-fns-tz";
import { reviewWeek } from "@tsw/prisma/follow-through/coach-inbox";
import type { ScheduledCoachInput } from "./types";

function lastLog(input: ScheduledCoachInput, activityIds: string[]) {
  const timezone = input.user.timezone || "UTC";
  const last = input.entries
    .filter((e) => !!e.activityId && activityIds.includes(e.activityId) && e.datetime <= input.now)
    .reduce<Date | null>((latest, e) => (!latest || e.datetime > latest ? e.datetime : latest), null);
  if (!last) return { lastLoggedOn: null, daysSinceLastLog: null };
  const day = (d: Date) => Date.parse(formatInTimeZone(d, timezone, "yyyy-MM-dd"));
  return {
    lastLoggedOn: formatInTimeZone(last, timezone, "yyyy-MM-dd"),
    daysSinceLastLog: Math.round((day(input.now) - day(last)) / 86_400_000),
  };
}

function sentOn(input: ScheduledCoachInput, sentAt: string) {
  const timezone = input.user.timezone || "UTC";
  const day = (d: Date) => Date.parse(formatInTimeZone(d, timezone, "yyyy-MM-dd"));
  const daysAgo = Math.round((day(input.now) - day(new Date(sentAt))) / 86_400_000);
  // "[2026-11-11 Wed, 4 days ago]": plain text, so the model reads it as a date, not a shape to copy.
  return `[${formatInTimeZone(new Date(sentAt), timezone, "yyyy-MM-dd EEE")}, ${daysAgo === 0 ? "today" : daysAgo === 1 ? "yesterday" : `${daysAgo} days ago`}]`;
}

function reviewedWeek(input: ScheduledCoachInput, plan: ScheduledCoachInput["plans"][number]) {
  const week = reviewWeek(
    { ...plan, createdAt: plan.createdAt ?? input.now },
    input.entries,
    input.now,
    { now: input.now, timezone: input.user.timezone || "UTC" },
  );
  return {
    from: week.days[0].key,
    to: week.days[6].key,
    isCurrentWeek: week.current,
    target: week.target,
    daysLogged: week.done,
    loggedOn: week.days.filter((d) => d.logged).map((d) => d.key),
  };
}

/** A small, factual snapshot. The scheduler owns eligibility; this is only generation input. */
export function scheduledCoachSnapshot(
  input: ScheduledCoachInput,
  health: string,
) {
  const planActivityIds = new Set(
    input.plans.flatMap((p) => p.activities.map((a) => a.id)),
  );
  return {
    today: formatInTimeZone(
      input.now,
      input.user.timezone || "UTC",
      "yyyy-MM-dd",
    ),
    plans: input.plans.map((p) => ({
      id: p.id,
      goal: p.goal,
      role: input.supports[p.id]?.coaching?.role,
      goalReason: p.goalReason,
      confidence: p.confidence,
      notes: p.notes,
      coachNotes: p.coachNotes,
      finishingDate: p.finishingDate?.toISOString().slice(0, 10),
      outlineType: p.outlineType,
      orientation: p.orientation,
      goalSpec: p.goalSpec,
      baseline: p.baseline,
      outline: p.outline,
      designedThrough: p.designedThrough?.toISOString().slice(0, 10) ?? null,
      timesPerWeek: p.timesPerWeek,
      // Counted here, not by the model: it miscounted "days since" in the 13 Nov journeys benchmark.
      ...lastLog(input, p.activities.map((a) => a.id)),
      // A weekly review looks back on one plan week, counted here. On a Sunday that is the week that just
      // ended: the 15 Nov review mixed the new week's first day into "this week" and asked what fits "before
      // the week ends" on its first evening.
      ...(input.decision.kind === "review" ? { reviewedWeek: reviewedWeek(input, p) } : {}),
      availability: {
        mode: input.supports[p.id]?.mode,
        weekdays: input.supports[p.id]?.weekdays,
        time: input.supports[p.id]?.time,
        timezone: input.supports[p.id]?.timezone,
      },
      activities: p.activities.map((a) => ({
        id: a.id,
        title: a.title,
        measure: a.measure,
      })),
      curriculumFiles: p.curriculumFiles.slice(0, 8).map((file) => ({
        path: file.path,
        content: file.content.slice(0, 12000),
        truncated: file.content.length > 12000,
      })),
      moreCurriculumFiles: Math.max(0, p.curriculumFiles.length - 8),
      sessions: p.sessions
        .filter(
          (s) =>
            Math.abs(s.date.getTime() - input.now.getTime()) <= 21 * 86400000,
        )
        .map((s) => ({
          id: s.id,
          activityId: s.activityId,
          date: s.date.toISOString().slice(0, 10),
          quantity: s.quantity,
          title: s.title,
          descriptiveGuide: s.descriptiveGuide,
          targets: s.targets,
          ...(input.assumedMissedSessionIds.includes(s.id)
            ? { assumedMissed: true }
            : {}),
        })),
    })),
    recentEntries: input.entries
      .filter((e) => !!e.activityId && planActivityIds.has(e.activityId))
      .slice(-35)
      .map((e) => ({
        id: e.id,
        activityId: e.activityId,
        date: formatInTimeZone(e.datetime, input.user.timezone || "UTC", "yyyy-MM-dd EEE"),
        quantity: e.quantity,
        difficulty: e.difficulty,
        note: e.privateNotes,
      })),
    // Dated, so something said days ago isn't news today ("Now you're back" four days after the trip).
    recentConversation: input.conversationHistory
      .slice(-12)
      .map((m) => `${m.sentAt ? `${sentOn(input, m.sentAt)} ` : ""}${m.role === "user" ? "them" : m.role === "assistant" ? "coach" : "app"}: ${m.content}`),
    unansweredOutreaches: input.unansweredOutreaches,
    selectedFeedback: input.entries.find((e) => e.id === input.decision.entryId)
      ? {
          entryId: input.decision.entryId,
          note: input.entries.find((e) => e.id === input.decision.entryId)?.privateNotes ?? null,
        }
      : null,
    approvedHealthContext: health || null,
  };
}
