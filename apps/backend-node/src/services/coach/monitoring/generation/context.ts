import { formatInTimeZone } from "date-fns-tz";
import type { ScheduledCoachInput } from "./types";

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
      notes: p.notes,
      coachNotes: p.coachNotes,
      finishingDate: p.finishingDate?.toISOString().slice(0, 10),
      outlineType: p.outlineType,
      timesPerWeek: p.timesPerWeek,
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
          descriptiveGuide: s.descriptiveGuide,
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
        date: e.datetime.toISOString().slice(0, 10),
        quantity: e.quantity,
        difficulty: e.difficulty,
        note: e.privateNotes,
      })),
    recentConversation: input.conversationHistory
      .slice(-12)
      .map((m) => ({ role: m.role, content: m.content })),
    selectedFeedback: input.entries.find((e) => e.id === input.decision.entryId)
      ? { entryId: input.decision.entryId }
      : null,
    approvedHealthContext: health || null,
  };
}
