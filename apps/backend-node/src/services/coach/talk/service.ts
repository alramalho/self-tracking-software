import { addDays, format, parseISO } from "date-fns";
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
import { talkPrompt } from "./prompt";
import { turnSchema } from "./schema";
import type { CoachTurn, TalkContext, TalkRequest, TalkTurn } from "./types";

const MAX_QUESTIONS = 2;
const MAX_QUIET_DAYS = 30;
const ASK_AGAIN_DAYS = 3;
const REASON_WORDS: Record<TalkRequest["reason"], string> = {
  busy: "I was busy.",
  sick: "I was tired or sick.",
  travel: "I'm travelling.",
  motivation: "I lost motivation.",
  other: "",
  talk: "",
};

const words = (text: string, max: number) => text.trim().split(/\s+/).slice(0, max).join(" ");

/**
 * The owner's rules, enforced after the model: at most two questions, "not sure" always ends with
 * an ask-again, and a quiet day must be a real date within a month.
 */
export function settleTurn(turn: CoachTurn, request: TalkRequest, today: string) {
  const answered = request.turns.length;
  const ask = turn.ask === "text" && answered < MAX_QUESTIONS && !request.notSure ? "text" : "none";
  let action = request.notSure ? "ask_again" : turn.action;
  const latest = format(addDays(parseISO(today), MAX_QUIET_DAYS), "yyyy-MM-dd");
  let until = /^\d{4}-\d{2}-\d{2}$/.test(turn.until) && turn.until >= today && turn.until <= latest ? turn.until : "";
  if (action === "ask_again" && !until) until = format(addDays(parseISO(today), ASK_AGAIN_DAYS), "yyyy-MM-dd");
  if (action !== "none" && !until) action = "none";
  const shown: TalkTurn = {
    say: words(turn.say, 12) || "Got it.",
    detail: words(turn.detail, 30),
    ask,
    placeholder: ask === "text" ? words(turn.placeholder, 5) : "",
    quietUntil: action === "quiet" ? until : null,
  };
  const quiet = action === "none" ? null : { until, why: action === "quiet" ? ("away" as const) : ("not_sure" as const) };
  return { shown, quiet };
}

async function talkContext(userId: string, planId: string): Promise<TalkContext> {
  const [user, plan] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { timezone: true, coachPersonality: true } }),
    prisma.plan.findFirst({
      where: { id: planId, userId, deletedAt: null },
      select: { goal: true, emoji: true, timesPerWeek: true, activities: { select: { id: true, title: true } } },
    }),
  ]);
  if (!plan) throw new FollowThroughInputError("Plan not found");
  const last = await prisma.activityEntry.findFirst({
    where: { userId, deletedAt: null, activityId: { in: plan.activities.map((a) => a.id) } },
    orderBy: { datetime: "desc" },
    select: { datetime: true },
  });
  const timezone = user.timezone || "Europe/Berlin";
  const coach = getCoachPersonalityConfig(user.coachPersonality);
  const now = new Date();
  return {
    coach: { name: coach.displayName, persona: coach.systemPrompt },
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
    prompt: JSON.stringify({ ...context, coach: context.coach.name, reason: request.reason, turns: request.turns, notSure: request.notSure }),
    model,
    effort: effortFor(model),
  });
  const { shown, quiet } = settleTurn(object, request, context.today);
  if (quiet)
    await changeState(userId, async (state) => {
      state.monitoring ??= monitoringState();
      state.monitoring.quiet = { ...state.monitoring.quiet, [planId]: { ...quiet, at: new Date().toISOString() } };
    });
  const latest = request.turns.at(-1);
  const said = request.notSure ? "Not sure yet." : latest ? latest.answer : REASON_WORDS[request.reason];
  await remember(userId, planId, said, shown).catch((error) => logger.warn("Talk to coach: chat copy failed", { error }));
  return shown;
}

/** "Keep nudging me": undo the quiet a turn just set. */
export async function endQuiet(userId: string, planId: string) {
  await changeState(userId, async (state) => {
    if (state.monitoring?.quiet) delete state.monitoring.quiet[planId];
  });
}
