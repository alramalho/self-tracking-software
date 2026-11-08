import { addDays, format, parseISO, startOfWeek, subWeeks } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { prisma } from "../../../utils/prisma";
import { logger } from "../../../utils/logger";
import { getCoachPersonalityConfig } from "../../coachPersonalityService";
import { effortFor, planModel } from "../../aiModelIds";
import { gatewayGenerator } from "../../plan-design/generator";
import type { ObjectGenerator } from "../../plan-design/types";
import { changeState } from "../../follow-through/store";
import { FollowThroughInputError } from "../../follow-through/errors";
import { monitoringState } from "../monitoring/model";
import type { FollowThroughState, MissReasonId, PlanQuiet } from "@tsw/prisma/follow-through";
import { checkInAt, checkInTimes } from "./commitment";
import { talkPrompt } from "./prompt";
import { turnSchema } from "./schema";
import type { CheckInClock, CoachTurn, TalkContext, TalkRequest, TalkTurn } from "./types";

const MAX_QUESTIONS = 2;
const MAX_QUIET_DAYS = 30;
const MAX_COMMIT_DAYS = 7;
const ASK_AGAIN_DAYS = 3;
const REASON_WORDS: Record<TalkRequest["reason"], string> = {
  busy: "I was busy.",
  sick: "I was tired or sick.",
  travel: "I'm travelling.",
  motivation: "I lost motivation.",
  other: "",
  talk: "",
};

const sentences = (text: string) => text.replace(/\s*;\s*(\S)/g, (_, c: string) => `. ${c.toUpperCase()}`);
const words = (text: string, max: number) => sentences(text).trim().split(/\s+/).slice(0, max).join(" ");
/** The last screen asks nothing: any question the model left in it goes. */
const withoutQuestions = (text: string) =>
  (text.match(/[^.!?]+[.!?]*/g) ?? []).filter((s) => !s.trim().endsWith("?")).join("").trim();

const dayWithin = (value: string, today: string, days: number) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) && value >= today && value <= format(addDays(parseISO(today), days), "yyyy-MM-dd");

/**
 * The owner's rules, enforced after the model: at most two questions, "not sure" always ends with an
 * ask-again, a named day ends with a commitment the coach checks on, and quiet days are real dates.
 * Once the conversation is over the plan's alert is answered: until the committed or return day, or
 * for the rest of today.
 */
export function settleTurn(turn: CoachTurn, request: TalkRequest, today: string) {
  const answered = request.turns.length;
  let action = request.notSure ? "ask_again" : turn.action;
  const limit = action === "commit" ? MAX_COMMIT_DAYS : MAX_QUIET_DAYS;
  let until = dayWithin(turn.until, today, limit) ? turn.until : "";
  if (action === "ask_again" && !until) until = format(addDays(parseISO(today), ASK_AGAIN_DAYS), "yyyy-MM-dd");
  if (action !== "none" && !until) action = "none";
  const asks = turn.ask === "text" && answered < MAX_QUESTIONS && !request.notSure && action !== "commit";
  const ask = asks ? "text" : "none";
  const say = ask === "none" ? withoutQuestions(turn.say) : turn.say;
  const detail = ask === "none" ? withoutQuestions(turn.detail) : turn.detail;
  // "Not sure yet" always says when the coach will ask again, even if the model left it out.
  const askAgain = action === "ask_again" && !/again/i.test(`${say} ${detail}`) ? `I'll ask again ${format(parseISO(until), "EEEE")}.` : "";
  const shown: TalkTurn = {
    say: words(say || detail, 12) || "Got it.",
    detail: [say ? words(detail, 30) : "", askAgain].filter(Boolean).join(" "),
    ask,
    placeholder: ask === "text" ? words(turn.placeholder, 5) : "",
    quietUntil: action === "quiet" ? until : null,
  };
  const why: Record<string, PlanQuiet["why"]> = { quiet: "away", ask_again: "not_sure", commit: "committed" };
  const quiet: Omit<PlanQuiet, "at"> | null =
    action !== "none" ? { until, why: why[action] } : ask === "none" ? { until: today, why: "answered" } : null;
  return { shown, quiet, commitDay: action === "commit" ? until : null, over: ask === "none" };
}

async function talkContext(userId: string, planId: string): Promise<TalkContext & { clock: CheckInClock }> {
  const [user, plan, row] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { timezone: true, coachPersonality: true } }),
    prisma.plan.findFirst({
      where: { id: planId, userId, deletedAt: null },
      select: { goal: true, emoji: true, timesPerWeek: true, activities: { select: { id: true, title: true } } },
    }),
    prisma.coachingState.findUnique({ where: { userId }, select: { data: true } }),
  ]);
  if (!plan) throw new FollowThroughInputError("Plan not found");
  const last = await prisma.activityEntry.findFirst({
    where: { userId, deletedAt: null, activityId: { in: plan.activities.map((a) => a.id) } },
    orderBy: { datetime: "desc" },
    select: { datetime: true },
  });
  const support = (row?.data as FollowThroughState | undefined)?.supports?.[planId];
  const timezone = support?.timezone || user.timezone || "Europe/Berlin";
  const clock = { timezone, morning: support?.preferences.dayReminderTime ?? "09:00" };
  const coach = getCoachPersonalityConfig(user.coachPersonality);
  const now = new Date();
  return {
    clock,
    coach: { name: coach.displayName, persona: coach.systemPrompt },
    checkIn: checkInTimes(now, clock),
    plan: { goal: plan.goal, emoji: plan.emoji, timesPerWeek: plan.timesPerWeek, activities: plan.activities.map((a) => a.title) },
    today: formatInTimeZone(now, timezone, "yyyy-MM-dd"),
    weekday: formatInTimeZone(now, timezone, "EEEE"),
    lastLog: last ? formatInTimeZone(last.datetime, timezone, "yyyy-MM-dd") : null,
  };
}

/** Both sides land in the coach chat, so the full coach and its history know what was said. */
async function remember(userId: string, planId: string, said: string, shown: TalkTurn) {
  const chat = await prisma.chat.findFirst({ where: { userId, type: "COACH" }, orderBy: { updatedAt: "desc" } });
  if (!chat) return;
  const metadata = { source: "talk_to_coach" };
  if (said) await prisma.message.create({ data: { chatId: chat.id, planId, role: "USER", senderId: userId, content: said, metadata } });
  await prisma.message.create({
    data: { chatId: chat.id, planId, role: "COACH", content: [shown.say, shown.detail].filter(Boolean).join(" "), metadata },
  });
  await prisma.chat.update({ where: { id: chat.id }, data: { updatedAt: new Date() } });
}

/** One screen of Talk to coach: the coach's line, maybe one question, maybe quieting the plan. */
export async function talkTurn(userId: string, planId: string, request: TalkRequest, generate: ObjectGenerator = gatewayGenerator) {
  const context = await talkContext(userId, planId);
  const model = planModel("quick");
  const { object } = await generate({
    name: "talkTurn",
    schema: turnSchema,
    system: talkPrompt(context.coach.persona),
    prompt: JSON.stringify({
      ...context,
      clock: undefined,
      coach: context.coach.name,
      reason: request.reason,
      turns: request.turns,
      notSure: request.notSure,
    }),
    model,
    effort: effortFor(model),
  });
  const settled = settleTurn(object, request, context.today);
  if (settled.over) await finish(userId, planId, request, settled, context);
  const { shown } = settled;
  const latest = request.turns.at(-1);
  const said = request.notSure ? "Not sure yet." : latest ? latest.answer : REASON_WORDS[request.reason];
  await remember(userId, planId, said, shown).catch((error) => logger.warn("Talk to coach: chat copy failed", { error }));
  return shown;
}

/**
 * The conversation is over, so whatever the coach was waiting on is answered: the alert goes quiet
 * (until the committed or return day, or for today), an open nudge is resolved, a missed week counts
 * as answered on every device, and a committed day (or the morning after a trip) gets its check-in push.
 */
async function finish(
  userId: string,
  planId: string,
  request: TalkRequest,
  settled: ReturnType<typeof settleTurn>,
  context: TalkContext & { clock: CheckInClock },
) {
  const now = new Date();
  await changeState(userId, async (state) => {
    const monitoring = (state.monitoring ??= monitoringState());
    if (settled.quiet) monitoring.quiet = { ...monitoring.quiet, [planId]: { ...settled.quiet, at: now.toISOString() } };
    for (const nudge of monitoring.requests)
      if (nudge.kind === "nudge" && nudge.planIds.includes(planId) && !nudge.resolvedAt && !nudge.closedAt)
        nudge.resolvedAt = now.toISOString();
    // A named day, or the morning after they're back: one push, unless they've logged by then.
    const checkDay =
      settled.commitDay ??
      (settled.quiet?.why === "away" ? format(addDays(parseISO(settled.quiet.until), 1), "yyyy-MM-dd") : null);
    if (checkDay) {
      const at = checkInAt(checkDay, now, context.clock);
      monitoring.reminders = (monitoring.reminders ?? []).filter((r) => r.planId !== planId || r.sentAt);
      if (at) monitoring.reminders.push({ planId, dueAt: at.toISOString() });
    }
    if (request.missed) {
      const week = format(startOfWeek(subWeeks(parseISO(context.today), 1)), "yyyy-MM-dd");
      const reason: MissReasonId = request.reason === "talk" ? "other" : request.reason;
      state.missedWeeks = { ...state.missedWeeks, [planId]: { week, reason, days: [], answeredAt: now.toISOString() } };
    }
  });
}

/** "Keep nudging me": undo the quiet a turn just set. */
export async function endQuiet(userId: string, planId: string) {
  await changeState(userId, async (state) => {
    if (state.monitoring?.quiet) delete state.monitoring.quiet[planId];
  });
}
