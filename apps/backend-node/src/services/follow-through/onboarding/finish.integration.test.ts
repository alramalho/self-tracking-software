import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// Importing the service pulls in modules that insist on a gateway key being set. Nothing here calls a model.
vi.hoisted(() => {
  process.env.AI_GATEWAY_API_KEY ??= "unused-in-this-test";
});
import { randomUUID } from "node:crypto";
import type { OnboardingDraft, PlanDesign, SupportPreferences, SessionTargets } from "@tsw/prisma/follow-through";
import type { User } from "@tsw/prisma";
import { prisma } from "../../../utils/prisma";
import { executePlanProposalPatch, getProposalPatch } from "../../planProposalPatchService";
import { windowMessage } from "../../coach/monitoring/generation/window";
import { finishOnboarding } from "./service";
import { redesignPlan } from "../../plan-design/apply";

// Fail closed: only the isolated local test database, only synthetic users.
const database = new URL(process.env.DATABASE_URL || "http://not-configured");
if (database.hostname !== "127.0.0.1" || database.port !== "55432" || database.pathname !== "/tracking_follow_through_test")
  throw new Error("Persistence tests require the isolated local database on port 55432.");

const prefix = `finish-design-test-${randomUUID()}`;
let user: User;

const targets = (km: number): SessionTargets => ({
  durationMinutes: Math.ceil(km * 7.4) + 6,
  effort: "easy, can talk",
  pace: { minSecondsPerKm: 420, maxSecondsPerKm: 444, basis: "USER_REPORTED_EASY_PACE", evidence: "easy 5 km in 35–37 min" },
  exercise: null, sets: null, reps: null, loadKg: null, restSeconds: null,
  progressMeasure: "Finish able to talk in sentences",
});
const design = (): PlanDesign => ({
  orientation: "OUTCOME",
  goalSpec: { metric: null, value: null, unit: null, text: null, chosenByUser: false },
  baseline: { text: "Easy 5 km in 35–37 min", measurements: [{ metric: "easy_pace_fast", value: 420, unit: "s/km", sourceQuote: "easy 5 km in 35–37 min" }] },
  activities: [{ key: "running", title: "Running", measure: "km", emoji: "🏃" }],
  preferredDays: 3,
  coachNote: null,
  fixedDate: null,
  asked: [],
  startDate: "2026-10-05",
  selected: "focused",
  options: [
    {
      id: "focused", coach: "Oli", daysMin: 3, daysMax: 4, estimatedWeeks: 12, finishingDate: "2026-12-27",
      rationale: "More days, shorter road.", assumptions: ["No injury"],
      phases: [
        { title: "Base", startWeek: 1, endWeek: 4, progressCheck: "5 km easy twice" },
        { title: "Build", startWeek: 5, endWeek: 12, progressCheck: "Long run 15 km" },
      ],
      sessions: [["2026-10-05", 3], ["2026-10-07", 4], ["2026-10-10", 6], ["2026-10-12", 3], ["2026-10-14", 4], ["2026-10-17", 7]].map(([date, km]) => ({
        date: date as string, activity: "running", quantity: km as number, title: "Easy run",
        descriptiveGuide: "Walk 5 minutes, then run easy and finish with a walk.", targets: targets(km as number),
      })),
    },
  ],
});
const draft = (id: string, d: PlanDesign | undefined): OnboardingDraft => ({
  id, goal: "Finish my first half marathon", emoji: "🏃", activityId: null, activityTitle: "Running", measure: "km",
  commitment: "WEEKLY", frequency: 3, weekdays: [], time: null, durationMinutes: 20, timezone: "UTC", targetDate: null,
  resourceName: "", resourceUrl: "", nextStep: "First run", format: "LOG", wantsCoaching: true, answers: [], step: "interview-finish",
  createdPlanId: null, design: d,
});
const preferences: SupportPreferences = {
  coaching: true, reminder: false, reminderMinutes: 30, dayReminderTime: "09:00", checkIn: true, checkInTime: "10:00",
  weeklyReview: true, reviewDay: 0, reviewTime: "18:00",
};

beforeEach(async () => {
  user = await prisma.user.create({ data: { id: `${prefix}-${randomUUID()}`, email: `${randomUUID()}@example.invalid`, planType: "PLUS", timezone: "UTC" } });
});
afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { startsWith: prefix } } });
  await prisma.$disconnect();
});

describe("finishing onboarding with a designed plan", () => {
  it("stores the road, the goal facts and every session's measurable targets, and meets the coach as Oli", async () => {
    const id = randomUUID();
    await finishOnboarding(user, draft(id, design()), preferences);
    const plan = await prisma.plan.findUniqueOrThrow({ where: { id }, include: { sessions: { orderBy: { date: "asc" } } } });
    expect(plan).toMatchObject({ orientation: "OUTCOME", outlineType: "SPECIFIC", timesPerWeek: 3, estimatedWeeks: 12 });
    expect(plan.designedThrough?.toISOString().slice(0, 10)).toBe("2026-10-17");
    expect(plan.finishingDate?.toISOString().slice(0, 10)).toBe("2026-12-27");
    expect(plan.outline).toMatchObject({ route: "focused", coach: "Oli", daysMin: 3, daysMax: 4 });
    expect(plan.baseline).toMatchObject({ text: "Easy 5 km in 35–37 min" });
    expect(plan.sessions).toHaveLength(6);
    expect(plan.sessions[0]).toMatchObject({ title: "Easy run", quantity: 3 });
    expect((plan.sessions[2].targets as unknown as SessionTargets).pace?.basis).toBe("USER_REPORTED_EASY_PACE");
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).coachPersonality).toBe("STRATEGIST");
    const state = (await prisma.coachingState.findUniqueOrThrow({ where: { userId: user.id } })).data as any;
    // The first two weeks already exist, so the coach has nothing to set up.
    expect(state.supports[id].coaching.role).toBe("training");
    expect(state.monitoring?.setupPlanIds ?? []).not.toContain(id);
  });

  it("is idempotent for the same plan id, and refuses an outcome plan with no chosen route", async () => {
    const id = randomUUID();
    await finishOnboarding(user, draft(id, design()), preferences);
    await finishOnboarding(user, draft(id, design()), preferences);
    expect(await prisma.plan.count({ where: { userId: user.id } })).toBe(1);
    expect(await prisma.planSession.count({ where: { plan: { userId: user.id } } })).toBe(6);
    await expect(finishOnboarding(user, draft(randomUUID(), { ...design(), selected: null }), preferences)).rejects.toThrow(/Choose one of the two plans/);
  });

  it("a habit keeps today's behaviour: a weekly target, no sessions", async () => {
    const id = randomUUID();
    const habit: PlanDesign = { ...design(), orientation: "CONSISTENCY", options: [], selected: null };
    await finishOnboarding(user, draft(id, habit), preferences);
    const plan = await prisma.plan.findUniqueOrThrow({ where: { id }, include: { sessions: true } });
    expect(plan).toMatchObject({ orientation: "CONSISTENCY", outlineType: "TIMES_PER_WEEK", timesPerWeek: 3, designedThrough: null });
    expect(plan.sessions).toHaveLength(0);
    const state = (await prisma.coachingState.findUniqueOrThrow({ where: { userId: user.id } })).data as any;
    expect(state.supports[id].coaching.role).toBe("consistency");
  });
});

describe("the coach extends the plan", () => {
  it("applies a window proposal: replaces upcoming sessions, adds the next weeks, moves designedThrough", async () => {
    const id = randomUUID();
    await finishOnboarding(user, draft(id, design()), preferences);
    const before = await prisma.plan.findUniqueOrThrow({ where: { id }, include: { sessions: { orderBy: { date: "asc" } }, activities: true } });
    const upcoming = before.sessions.slice(3).map((s) => s.id); // the second week, not yet done
    const activityId = before.activities[0].id;
    const message = windowMessage(before as never, {
      replaceSessionIds: upcoming,
      sessions: [
        { date: "2026-10-19", activityId, quantity: 3, title: "Easy run", descriptiveGuide: "Lighter week after a hard long run.", targets: targets(3) },
        { date: "2026-10-22", activityId, quantity: 4, title: "Easy run", descriptiveGuide: "Same pace, conversational the whole way.", targets: targets(4) },
      ],
      phases: design().options[0].phases,
      summary: "Held the distance after a hard long run.",
      designedThrough: "2026-11-01",
      usage: { model: "x", inputTokens: 0, outputTokens: 0, reasoningTokens: 0 },
    });
    await executePlanProposalPatch({ planId: id, patch: getProposalPatch(message.planProposals![0]), userId: user.id });
    const after = await prisma.plan.findUniqueOrThrow({ where: { id }, include: { sessions: { orderBy: { date: "asc" } } } });
    expect(after.designedThrough?.toISOString().slice(0, 10)).toBe("2026-11-01");
    expect(after.sessions.map((s) => s.date.toISOString().slice(5, 10))).toEqual(["10-05", "10-07", "10-10", "10-19", "10-22"]);
    expect((after.sessions[4].targets as unknown as SessionTargets).durationMinutes).toBe(targets(4).durationMinutes);
    expect(after.sessions[3].isCoachSuggested).toBe(true);
  });
});

describe("redesigning a plan that already exists", () => {
  async function existingPlan() {
    const activity = await prisma.activity.create({ data: { userId: user.id, title: "Running", emoji: "🏃", measure: "km" } });
    const plan = await prisma.plan.create({
      data: { userId: user.id, goal: "Finish my first half marathon", outlineType: "TIMES_PER_WEEK", timesPerWeek: 2, activities: { connect: { id: activity.id } } },
    });
    const at = (day: string) => new Date(`${day}T12:00:00Z`);
    await prisma.planSession.createMany({
      data: [
        { planId: plan.id, activityId: activity.id, date: at("2026-10-01"), quantity: 3 }, // past: kept
        { planId: plan.id, activityId: activity.id, date: at("2026-10-07"), quantity: 5 }, // future, already logged: kept
        { planId: plan.id, activityId: activity.id, date: at("2026-10-09"), quantity: 5 }, // future, not logged: replaced
      ],
    });
    await prisma.activityEntry.create({ data: { userId: user.id, activityId: activity.id, quantity: 5, datetime: new Date("2026-10-07T08:00:00Z") } });
    return plan.id;
  }

  it("keeps the past and anything logged, replaces the rest of the future, and stores the road", async () => {
    const id = await existingPlan();
    await redesignPlan(user, id, design());
    const plan = await prisma.plan.findUniqueOrThrow({ where: { id }, include: { sessions: { orderBy: { date: "asc" } } } });
    expect(plan).toMatchObject({ orientation: "OUTCOME", outlineType: "SPECIFIC", timesPerWeek: 3, estimatedWeeks: 12 });
    expect(plan.outline).toMatchObject({ route: "focused", daysMin: 3, daysMax: 4 });
    const days = plan.sessions.map((s) => s.date.toISOString().slice(5, 10));
    // 10-01 (past) and 10-07 (logged) survive; 10-09 is gone; the six designed sessions arrive.
    expect(days).toContain("10-01");
    expect(plan.sessions.filter((s) => s.date.toISOString().slice(5, 10) === "10-09")).toHaveLength(0);
    expect(plan.sessions.filter((s) => s.targets !== null)).toHaveLength(6);
    expect(plan.designedThrough?.toISOString().slice(0, 10)).toBe("2026-10-17");
  });

  it("turns a plan into a habit without touching its sessions, and refuses someone else's plan", async () => {
    const id = await existingPlan();
    await redesignPlan(user, id, { ...design(), orientation: "CONSISTENCY", options: [], selected: null, preferredDays: 4 });
    const plan = await prisma.plan.findUniqueOrThrow({ where: { id }, include: { sessions: true } });
    expect(plan).toMatchObject({ orientation: "CONSISTENCY", outlineType: "TIMES_PER_WEEK", timesPerWeek: 4 });
    expect(plan.sessions).toHaveLength(3);
    const stranger = await prisma.user.create({ data: { id: `${prefix}-${randomUUID()}`, email: `${randomUUID()}@example.invalid`, planType: "PLUS", timezone: "UTC" } });
    await expect(redesignPlan(stranger, id, design())).rejects.toThrow(/Plan not found/);
  });
});
