import { dayKey, localDateTime } from "@/core/dates";
import type { ActivityEntry } from "@/core/types";
import type {
  VoiceLogAlreadyLogged,
  VoiceLogPlanSuggestion,
  VoiceLogPreview,
} from "./types";

const futureSignals = /\b(?:want to|would like to|plan(?:ning)? to|plan of|hope to|intend to|every day|daily|days? (?:a|per) week|for (?:about )?(?:\d+|one|two|three|four|five|six|seven) (?:weeks?|months?))\b/i;
const intentionStart = /\b(?:i\s+(?:want|would like|plan|hope|intend)|i['’]?m\s+planning|my plan is)\b/i;
const numberWords: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
};

function numberValue(value: string) {
  return Number(value) || numberWords[value.toLowerCase()] || undefined;
}

function frequencyPerWeek(text: string) {
  if (/\b(?:every day|daily)\b/i.test(text)) return 7;
  const match = text.match(
    /\b(\d+|one|two|three|four|five|six|seven)\s+days?\s+(?:a|per)\s+week\b/i,
  );
  return match ? numberValue(match[1]) : undefined;
}

function durationWeeks(text: string) {
  const weeks = text.match(
    /\b(?:for\s+)?(?:about\s+)?(\d+|one|two|three|four|five|six|seven)\s+weeks?\b/i,
  );
  if (weeks) return numberValue(weeks[1]);
  const months = text.match(
    /\b(?:for\s+)?(?:about\s+)?(\d+|one|two|three|four|five|six|seven)\s+months?\b/i,
  );
  return months ? (numberValue(months[1]) ?? 0) * 4 : undefined;
}

function intentionText(transcript: string) {
  const start = transcript.search(intentionStart);
  if (start < 0) return transcript.trim().slice(0, 240);
  return transcript
    .slice(start)
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 300);
}

function activityIsNamed(transcript: string, title: string) {
  return transcript.toLocaleLowerCase().includes(title.toLocaleLowerCase());
}

export function deriveVoiceLogPlanSuggestions(
  preview: VoiceLogPreview,
): VoiceLogPlanSuggestion[] {
  if (!futureSignals.test(preview.transcript)) return [];
  const activities = [...preview.activities, ...(preview.alreadyLogged ?? [])];
  const text = intentionText(preview.transcript);
  const intentionStartIndex = preview.transcript.search(intentionStart);
  const contextBeforeIntention =
    intentionStartIndex >= 0
      ? preview.transcript.slice(0, intentionStartIndex)
      : "";
  const activity =
    activities.find((item) => activityIsNamed(text, item.title)) ??
    [...activities]
      .reverse()
      .find((item) => activityIsNamed(contextBeforeIntention, item.title));
  if (!activity) return [];
  // "Log 90 minutes for every day I missed, I've been doing it daily" fills in past days; it isn't a new plan.
  const daysLogged = new Set(
    preview.activities.filter((item) => item.activityId === activity.activityId).map((item) => item.date),
  );
  if (daysLogged.size > 1) return [];
  return [
    {
      activityId: activity.activityId,
      activityTitle: activity.title,
      emoji: activity.emoji,
      text,
      frequencyPerWeek: frequencyPerWeek(text) ?? null,
      durationWeeks: durationWeeks(text) ?? null,
    },
  ];
}

function sameVoiceLogOccurrence(
  activity: VoiceLogPreview["activities"][number],
  entry: ActivityEntry,
) {
  if (entry.activityId !== activity.activityId || dayKey(entry.datetime) !== activity.date)
    return false;
  if (!activity.time) return true;
  return localDateTime(entry.datetime).slice(11, 16) === activity.time;
}

export function enrichVoiceLogPreview(
  preview: VoiceLogPreview,
  entries: ActivityEntry[],
): VoiceLogPreview {
  const planSuggestions = preview.planSuggestions?.length
    ? preview.planSuggestions
    : deriveVoiceLogPlanSuggestions(preview);
  const alreadyLogged: VoiceLogAlreadyLogged[] = [];
  const activities = preview.activities.filter((activity) => {
    // Share more adds details to a session saved a moment ago; it is meant to match it.
    if (activity.detailsOnly) return true;
    const matching = entries.filter((entry) =>
      sameVoiceLogOccurrence(activity, entry),
    );
    if (!matching.length) return true;
    alreadyLogged.push({
      ...activity,
      existingQuantity: matching.reduce((total, entry) => total + entry.quantity, 0),
      existingEntryId: matching[0].id,
    });
    return false;
  });
  return {
    ...preview,
    activities,
    alreadyLogged: [
      ...(preview.alreadyLogged ?? []),
      ...alreadyLogged,
    ],
    planSuggestions,
  };
}

/**
 * After "Yes, log it" on a gone-quiet alert: where the week stands now, in the coach's words. Weeks run
 * Sunday to Saturday and count days with a log, like the plan's own progress.
 */
export function weekStanding(
  plan: { timesPerWeek?: number | null; activities: { id: string }[] },
  entries: { activityId?: string | null; datetime: string | Date }[],
  logged: { activityId: string; date: string }[],
  today: Date = new Date(),
): string {
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());
  const from = dayKey(start);
  const to = dayKey(today);
  const ids = new Set(plan.activities.map((a) => a.id));
  const days = new Set(
    [
      ...entries.filter((e) => e.activityId && ids.has(e.activityId)).map((e) => dayKey(e.datetime)),
      ...logged.filter((l) => ids.has(l.activityId)).map((l) => l.date),
    ].filter((day) => day >= from && day <= to),
  );
  const done = days.size;
  const target = plan.timesPerWeek ?? 0;
  if (!target) return `That's ${done} this week.`;
  if (done > target) return `That's ${done} this week, ahead of your ${target}.`;
  if (done === target) return `That's ${done} of ${target} this week. Right on track.`;
  const left = target - done;
  return `That's ${done} of ${target} this week. ${left} to go.`;
}
