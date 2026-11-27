import { randomUUID } from "node:crypto";
import { format, parseISO, subDays } from "date-fns";
import { evaluate } from "../../../utils/aiSdk";
import { logger } from "../../../utils/logger";
import { prisma } from "../../../utils/prisma";
import { extractVoiceLog, localDate, RECENT_DAYS, type VoiceLogActivityContext } from "../../voice-log/extract";
import { recordVoiceLogSample } from "../../voice-log/samples";
import { recentActivity } from "../../voice-log/service";
import type { VoiceLogActivity } from "../../voice-log/types";
import type { LogDraft } from "./types";

const JEV_MODEL = "typesafe-ai/jev";
/** The extractor's own confidence, before Jev is asked at all. */
export const MIN_EXTRACTED_CONFIDENCE = 0.8;
/** Jev's probability that their words plainly state that day and that amount. Set with scripts/coach-journeys/log-from-words.ts. */
export const MIN_JEV_PROBABILITY = 0.8;
const JEV_TIMEOUT_MS = 6000;

type Candidate = VoiceLogActivity & { title: string; measure: string };

/**
 * Whether the card may show: every session confident, an amount they said (not an estimate from another unit),
 * and Jev agreeing the list logs exactly what they said. All or nothing: a card that quietly drops one of the
 * days they named reads as a mistake. Anything less and they say it on the voice note: a wrong log in a
 * tracking app costs more than one more tap (owner, 27 Nov 2026: "never overdo it").
 */
export function keepSure<T extends Candidate>(candidates: T[], jev: number): T[] {
  const sure = candidates.every((a) => a.confidence >= MIN_EXTRACTED_CONFIDENCE && !a.estimatedFrom && !a.detailsOnly);
  return candidates.length && sure && jev >= MIN_JEV_PROBABILITY ? candidates : [];
}

const dayWords = (date: string, today: string) => {
  const yesterday = format(subDays(parseISO(today), 1), "yyyy-MM-dd");
  const name = format(parseISO(date), "EEEE d MMMM");
  return date === today ? `today (${name})` : date === yesterday ? `yesterday (${name})` : name;
};

/** Jev reads their words and the list once: is this exactly what they said they did? */
export async function jevConfirms(said: string, today: string, candidates: Candidate[]): Promise<number> {
  if (!candidates.length) return 0;
  try {
    const result = await evaluate({
      model: JEV_MODEL,
      state: JSON.stringify({
        today: dayWords(today, today),
        whatTheySaid: said,
        whatWeWouldLog: candidates.map((a) => `${a.title}: ${a.quantity} ${a.measure} on ${dayWords(a.date, today)}`),
      }),
      questions: {
        matches: {
          type: "boolean" as const,
          instructions:
            "The app is about to log whatWeWouldLog as sessions the person did. Is every entry something they said they did, on that day, with that amount (or the same amount in other words, like 'half an hour' for 30 minutes), and is nothing logged that they didn't say? Answer no if any entry rests on a guess: a range of amounts, a vague frequency ('almost daily', 'a few times', 'here and there'), a plan or a wish.",
        },
      },
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(JEV_TIMEOUT_MS),
    });
    const answer = result.answers.matches;
    return answer?.type === "boolean" ? answer.probability : 0;
  } catch (error) {
    // No answer is no confirmation: they say it on the voice note instead.
    logger.warn(`Talk log check skipped: ${error instanceof Error ? error.message : error}`);
    return 0;
  }
}

/** The extractor reads their words, Jev checks each session, and only the sure ones stay. */
export async function sureSessions(said: string, now: Date, timezone: string, catalog: VoiceLogActivityContext[]) {
  const { extraction, costUsd } = await extractVoiceLog({
    transcript: said,
    now,
    timezone,
    activities: catalog,
    metrics: [],
    fillingOneLog: catalog.length === 1,
  });
  const byId = new Map(catalog.map((a) => [a.activityId, a]));
  const candidates = extraction.activities.map((a) => {
    const { title, emoji, measure } = byId.get(a.activityId)!;
    return { ...a, title, emoji, measure };
  });
  const jev = await jevConfirms(said, localDate(now, timezone), candidates);
  return { extraction, candidates, jev, kept: keepSure(candidates, jev), costUsd };
}

/** The plan's activities as the voice-log extractor sees them: what was logged lately and what was planned. */
async function planCatalog(userId: string, planId: string, timezone: string, now: Date): Promise<VoiceLogActivityContext[]> {
  const since = new Date(now.getTime() - (RECENT_DAYS + 1) * 86_400_000);
  const plan = await prisma.plan.findFirst({
    where: { id: planId, userId, deletedAt: null },
    select: {
      goal: true,
      emoji: true,
      timesPerWeek: true,
      activities: { where: { deletedAt: null }, select: { id: true, title: true, emoji: true, measure: true } },
      sessions: { where: { date: { gte: since, lte: now } }, select: { activityId: true, date: true } },
    },
  });
  if (!plan?.activities.length) return [];
  const ids = plan.activities.map((a) => a.id);
  const [entries, latest] = await Promise.all([
    prisma.activityEntry.findMany({
      where: { userId, deletedAt: null, activityId: { in: ids }, datetime: { gte: since } },
      select: { activityId: true, datetime: true, quantity: true },
    }),
    prisma.activityEntry.groupBy({ by: ["activityId"], where: { userId, deletedAt: null, activityId: { in: ids } }, _max: { datetime: true } }),
  ]);
  const recent = recentActivity(entries, [{ ...plan, activities: plan.activities.map(({ id }) => ({ id })) }], timezone);
  return plan.activities.map((a) => {
    const last = latest.find((l) => l.activityId === a.id)?._max.datetime;
    return {
      activityId: a.id,
      title: a.title,
      emoji: a.emoji,
      measure: a.measure,
      lastLoggedOn: last ? localDate(last, timezone) : null,
      loggedDays: recent.loggedDays(a.id),
      plan: recent.plan(a.id),
    };
  });
}

/**
 * They told the coach they did it but didn't log it. Read the sessions straight from what they said, with the
 * voice note's extractor and the plan's activities only, and keep the ones Jev confirms. Null when none are
 * sure: then "Log it" opens the voice note as before.
 */
export async function logFromWords(userId: string, planId: string, said: string, now = new Date()): Promise<LogDraft | null> {
  if (!said.trim()) return null;
  try {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { timezone: true } });
    const timezone = user.timezone || "Europe/Berlin";
    const catalog = await planCatalog(userId, planId, timezone, now);
    if (!catalog.length) return null;
    const today = localDate(now, timezone);
    const { extraction, jev, kept } = await sureSessions(said, now, timezone, catalog);
    recordVoiceLogSample({ kind: "talk", userId, planId, timezone, localDate: today, transcript: said, extraction, jev, kept: kept.length });
    if (!kept.length) return null;
    return {
      clientRequestId: randomUUID(),
      transcript: said,
      activities: kept,
      metrics: [],
      planMatches: [],
      note: extraction.note ?? { title: "Told the coach", text: said, date: today, confidence: 1 },
      unresolved: [],
    };
  } catch (error) {
    logger.warn("Talk to coach: reading the logs from their words failed", { error });
    return null;
  }
}
