/**
 * The live layer: every Talk to coach screen in the journeys, and every proactive message the scheduler
 * decided to send, written by the real model with the real prompts, then scored.
 *
 * Rules every coach text must keep (the owner's: underdo, ask little, accountability only):
 * at most one question, short, no schedule-change offers nobody asked for, never "your streak is safe".
 * A judge model then answers one question per text: would a busy person be glad to get this?
 */
import { createGateway } from "ai";
import { z } from "zod/v4";
import { talkPrompt } from "../../src/services/coach/talk/prompt";
import { turnSchema } from "../../src/services/coach/talk/schema";
import { gatewayGenerator } from "../../src/services/plan-design/generator";
import { effortFor, planModel, GPT_6_LUNA_MODEL } from "../../src/services/aiModelIds";
import { getCoachPersonalityConfig } from "../../src/services/coachPersonalityService";
import { generateFromSnapshot } from "../../src/services/coach/monitoring/generation/service";
import { scheduledCoachSnapshot } from "../../src/services/coach/monitoring/generation/context";
import type { Journey, SimResult, TalkModel, TalkExpectation, MessageExpectation } from "./simulate";

const coach = getCoachPersonalityConfig("CHAMPION" as never);
let spend = 0;
export const liveSpend = () => spend;

const cost = (r: { providerMetadata?: unknown }) => Number((r.providerMetadata as { gateway?: { cost?: string } } | undefined)?.gateway?.cost) || 0;

export const liveTalk: TalkModel = async ({ journey, reason, turns, notSure, today, weekday, history }) => {
  const model = planModel("quick");
  const result = await gatewayGenerator({
    name: "talkTurn",
    schema: turnSchema,
    system: talkPrompt(coach.systemPrompt),
    prompt: JSON.stringify({
      coach: coach.displayName,
      checkIn: { earliestToday: null, latest: "22:00", usual: "20:00" },
      morningCheckIn: "09:00",
      plan: { goal: journey.plan.goal, emoji: null, timesPerWeek: journey.plan.timesPerWeek, activities: ["training"] },
      today,
      weekday,
      lastLog: null,
      history,
      reason,
      turns: turns.map((t) => ({ say: t.question, answer: t.answer })),
      notSure,
    }),
    model,
    effort: effortFor(model),
  } as never);
  spend += (result as { usage?: { costUsd?: number } }).usage?.costUsd ?? 0;
  return (result as { object: never }).object;
};

/** The proactive messages the scheduler sent in a journey, written by the real prompts. */
export async function liveMessages(journey: Journey, result: SimResult) {
  const out: { kind: string; day: number; text: string }[] = [];
  for (const g of result.generated) {
    const plan = {
      id: "plan",
      goal: journey.plan.goal,
      goalReason: PERSON.goalReason,
      confidence: { level: 7, why: PERSON.confidenceWhy },
      notes: null,
      coachNotes: null,
      finishingDate: null,
      outlineType: "TIMES_PER_WEEK",
      orientation: "HABIT",
      goalSpec: null,
      baseline: null,
      outline: null,
      designedThrough: null,
      timesPerWeek: journey.plan.timesPerWeek,
      activities: [{ id: "act", title: "training", measure: "sessions" }],
      sessions: [],
      curriculumFiles: [],
    };
    const today = new Date(Date.UTC(2026, 10, 1 + g.day)).toISOString().slice(0, 10);
    const now = new Date(`${today}T${g.kind === "nudge" ? "08" : "18"}:07:00Z`);
    const entries = [
      ...journey.pastLogs.map((d) => ({ day: -d, at: "08:00" })),
      ...journey.events.filter((e) => "log" in e).map((e) => e as { day: number; at: string; difficulty?: string; note?: string }),
    ]
      .map((l, i) => ({
        id: `e${i}`,
        activityId: "act",
        datetime: new Date(Date.UTC(2026, 10, 1 + l.day, Number(l.at.slice(0, 2)), Number(l.at.slice(3)))),
        quantity: 1,
        difficulty: (l as { difficulty?: string }).difficulty ?? null,
        privateNotes: (l as { note?: string }).note ?? null,
      }))
      .filter((e) => e.datetime <= now);
    const input = {
      user: { id: "coach-journeys", timezone: "UTC", coachPersonality: "CHAMPION" } as never,
      now,
      decision: g.decision as never,
      plans: [plan as never],
      supports: { plan: { mode: "WEEKLY", weekdays: [], time: null, timezone: "UTC", coaching: { role: "consistency" } } } as never,
      entries: entries as never,
      conversationHistory: g.history.filter((m) => m.content).map((m) => ({ role: m.role === "USER" ? "user" : "assistant", content: m.content })) as never,
      assumedMissedSessionIds: [],
      unansweredOutreaches: 0,
    };
    const snapshot = scheduledCoachSnapshot(input, "");
    const generated = await generateFromSnapshot(input, snapshot);
    spend += generated.usage?.costUsd ?? 0;
    for (const d of generated.draftMessages) out.push({ kind: g.kind, day: g.day, text: d.content });
  }
  return out;
}

const QUESTION = /\?/g;
const SCHEDULE_OFFER = /(want|try|how about|switch to|go for|take) (a )?lighter (week|plan)|fewer sessions|cut (it|the plan) (back|down)|reduce (your|the) (target|plan|sessions)|move (your|the) sessions?|reschedul|swap (a|the) day/i;
const STREAK_SAFE = /streak (is )?(safe|protected|paused|intact)|(won't|doesn't|will not) (count|cost)/i;
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

export function scoreTalk(expect: TalkExpectation | undefined, screens: { say: string; detail: string; ask: string }[]) {
  const problems: string[] = [];
  const all = screens.map((s) => `${s.say} ${s.detail}`).join(" ");
  screens.forEach((s, i) => {
    const text = `${s.say} ${s.detail}`;
    if ((text.match(QUESTION) ?? []).length > 1) problems.push(`screen ${i + 1} asks more than one thing: "${text}"`);
    if (words(text) > 30) problems.push(`screen ${i + 1} is ${words(text)} words`);
  });
  if (SCHEDULE_OFFER.test(all)) problems.push(`offers a schedule change: "${all}"`);
  if (STREAK_SAFE.test(all)) problems.push(`says the streak is safe: "${all}"`);
  if (expect) {
    const firstAsks = screens[0]?.ask === "text";
    if (expect.firstAsks === "must" && !firstAsks) problems.push(`should ask first: "${screens[0]?.say} ${screens[0]?.detail}"`);
    if (expect.firstAsks === "never" && firstAsks) problems.push(`should not ask: "${screens[0]?.say} ${screens[0]?.detail}"`);
    for (const re of expect.neverAsks ?? []) {
      const asked = screens.find((s) => s.ask === "text" && re.test(`${s.say} ${s.detail}`));
      if (asked) problems.push(`asks what it was told (${re}): "${asked.say} ${asked.detail}"`);
    }
    for (const re of expect.mentions ?? []) if (!re.test(all)) problems.push(`never mentions ${re}: "${all}"`);
  }
  return problems;
}

export function scoreMessage(expect: MessageExpectation | undefined, text: string) {
  const problems: string[] = [];
  if ((text.match(QUESTION) ?? []).length > 1) problems.push(`asks more than one thing`);
  if (words(text) > 40) problems.push(`${words(text)} words`);
  if (SCHEDULE_OFFER.test(text)) problems.push("offers a schedule change");
  if (STREAK_SAFE.test(text)) problems.push("says the streak is safe");
  for (const re of expect?.mentions ?? []) if (!re.test(text)) problems.push(`never mentions ${re}`);
  for (const re of expect?.never ?? []) if (re.test(text)) problems.push(`says ${re}`);
  return problems;
}

const verdictSchema = z.object({ worthIt: z.boolean(), why: z.string() });

/** The person every live message is written for (also what the generation snapshot says). */
export const PERSON = {
  goalReason: "I want to feel strong and have energy for my kids.",
  confidenceWhy: "I've done it before when I had a routine.",
};

/**
 * One question to a second model: is this a high-signal accountability message, worth a busy person's attention?
 * It knows the facts the coach had and the owner's rules, so it judges the choice, not the mechanism.
 */
export async function judge(situation: string, text: string) {
  // Two independent reads; a text fails only when both say it isn't worth it, so one noisy read can't fail it.
  const [a, b] = await Promise.all([judgeOnce(situation, text), judgeOnce(situation, text)]);
  return a.worthIt || b.worthIt ? { worthIt: true, why: "" } : { worthIt: false, why: `${a.why} / ${b.why}` };
}

async function judgeOnce(situation: string, text: string) {
  const gateway = createGateway({ apiKey: process.env.AI_GATEWAY_API_KEY });
  const { generateObject } = await import("ai");
  const result = await generateObject({
    model: gateway(GPT_6_LUNA_MODEL),
    schema: verdictSchema,
    providerOptions: { openai: { reasoningEffort: "medium" } },
    system: `You review messages from the AI coach of a habit-tracking app. Its only job is accountability: a tiny nudge at the right moment. Messages that aren't worth reading teach people to ignore the coach, so the bar is high.
The app's rules, which you must not penalise:
- When the person set the plan up they wrote why (goalReason) and why they're confident (confidenceWhy). Quoting those back is allowed and encouraged when a plan slipped.
- A slipping plan gets one silent in-app nudge whose two buttons are fixed: "get back to it tomorrow" or "let it go". Asking that choice is the design.
- In a conversation, the coach may ask at most two short questions in total, only about the next session: when it happens, when they're back from a trip, or (after lost motivation) the smallest session they'd still do and when. A closing line that holds them to it ("Counting on you.", "I'll be looking for that log.") is wanted, except to someone who is ill.
- The coach books one check-in push on the day they named, or the morning after a trip, and says the day and time. For a named day it checks a little after the time of day they said (morning → 12:00, evening → 21:30, no time → 20:00); after a trip it checks the morning after the return day at 09:00. That is the design.
- To someone tired or sick, one short warm line and nothing else is exactly right.
- The weekly review opener knocks first: one short line that invites a reply.
- "Not sure yet" ends the conversation with when the coach will ask again (three days later). That is the design.
- Asking whether a session they planned actually happened is accountability too.
- A lapse message (weeks without logs or replies) asks honestly whether the plan still fits; an archive button is attached.
- The situation lists what happened before in order with days; only what they said in the same conversation or since counts as "already told".
Judge the content. worthIt is true only if a busy person would be glad to get this text now: it matches the facts, it is short, it asks at most one thing and that thing matters (their next session, a decision, or something concrete they reported such as pain), it doesn't ask what they already said, doesn't offer changes nobody asked for, and has no filler. A weekly review for a week that went fully to plan, with nothing to decide, is not worth a push unless it is very short and specific. A message that asks nothing is fine when nothing needs asking.
Answer with worthIt and one short reason.`,
    prompt: JSON.stringify({ situation, person: PERSON, message: text }),
  });
  spend += cost(result as never);
  return result.object;
}
