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
