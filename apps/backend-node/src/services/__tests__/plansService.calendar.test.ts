import { PlanOutlineType, type Activity, type ActivityEntry, type Plan, type PlanSession, type User } from "@tsw/prisma";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  plan: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
  user: { findFirst: vi.fn() },
  activity: { findMany: vi.fn() },
  activityEntry: { findMany: vi.fn() },
}));
vi.mock("../../utils/prisma", () => ({ prisma: db }));
vi.mock("../../utils/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock("../aiService", () => ({ aiService: { setPlansService: vi.fn() } }));
vi.mock("../embeddingService", () => ({ embeddingService: {} }));
vi.mock("../coachPersonalityService", () => ({ getCoachPersonalityConfig: vi.fn() }));

import { PlansService } from "../plansService";

const user = { id: "owner", timezone: "Europe/Lisbon" } as User;
const activity = { id: "studying", userId: user.id } as Activity;
const plan = {
  id: "study-plan", userId: user.id, goal: "Studying", outlineType: PlanOutlineType.TIMES_PER_WEEK,
  timesPerWeek: 2, activities: [activity], sessions: [], finishingDate: null,
  progressCalculatedAt: null, progressState: null,
} as Plan & { activities: Activity[] };
let entries: ActivityEntry[];
let service: PlansService;

function logDays(days: string[]) {
  entries = days.map((datetime, i) => ({
    id: String(i), userId: user.id, activityId: activity.id,
    datetime: new Date(datetime), quantity: 1, deletedAt: null,
  })) as ActivityEntry[];
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-23T12:00:00Z"));
  vi.resetAllMocks();
  service = new PlansService();
  entries = [];
  db.plan.findUnique.mockResolvedValue(plan);
  db.plan.findMany.mockResolvedValue([{ ...plan, user }]);
  db.user.findFirst.mockResolvedValue(user);
  db.activity.findMany.mockResolvedValue([activity]);
  db.activityEntry.findMany.mockImplementation(async ({ where, take }) => {
    const matching = entries.filter(e => !e.deletedAt &&
      (!where.datetime || (e.datetime >= where.datetime.gte &&
        e.datetime < where.datetime.lt && e.datetime <= where.datetime.lte)));
    return take ? matching.slice(0, take) : matching;
  });
});
afterEach(() => vi.useRealTimers());

describe("plan owner's local calendar", () => {
  it("counts Sunday logs before UTC midnight in their local week: two completed weeks yield 2, not 1", async () => {
    logDays(["2026-09-12T23:30:00Z", "2026-09-14T12:00:00Z", "2026-09-19T23:30:00Z", "2026-09-21T12:00:00Z"]);
    const progress = await service.computePlanProgress(plan, user);
    expect(progress.achievement.streak).toBe(2);
    expect(progress.achievement.completedWeeks).toBe(2);
    expect(progress.weeks[0].startDate.toISOString()).toBe("2026-09-13T00:00:00.000Z");
    expect(progress.currentWeekStats.daysCompletedThisWeek).toBe(2);
    expect(db.plan.update.mock.calls[0][0].data.progressState).toMatchObject({
      calculationVersion: 2, calculationTimezone: "Europe/Lisbon",
    });
  });

  it("assigns late Saturday logs after UTC midnight to the previous week west of UTC", async () => {
    const owner = { ...user, timezone: "America/Los_Angeles" };
    db.user.findFirst.mockResolvedValue(owner);
    logDays(["2026-09-18T12:00:00Z", "2026-09-20T06:30:00Z"]);
    const progress = await service.computePlanProgress(plan, owner);
    expect(progress.achievement.streak).toBe(1);
    expect(progress.weeks[0].isCompleted).toBe(true);
    expect(progress.currentWeekStats.daysCompletedThisWeek).toBe(0);
  });

  it("uses the owner's calendar when a friend requests batch progress", async () => {
    logDays(["2026-09-12T23:30:00Z", "2026-09-14T12:00:00Z", "2026-09-19T23:30:00Z", "2026-09-21T12:00:00Z"]);
    const [progress] = await service.getBatchPlanProgress([plan.id], "viewer-in-another-timezone");
    expect(progress.achievement.streak).toBe(2);
    expect(progress.currentWeekStats.daysCompletedThisWeek).toBe(2);
  });

  it("matches a Sunday scheduled session with its entry before UTC midnight", async () => {
    const scheduled = { ...plan, outlineType: PlanOutlineType.SPECIFIC, sessions: [
      { id: "s", activityId: activity.id, date: new Date("2026-09-20T00:00:00Z"), quantity: 1 },
    ] as PlanSession[] };
    db.plan.findUnique.mockResolvedValue(scheduled);
    logDays(["2026-09-19T23:30:00Z"]);
    const progress = await service.computePlanProgress(scheduled, user);
    expect(progress.achievement.streak).toBe(1);
    expect(progress.currentWeekStats.daysCompletedThisWeek).toBe(1);
  });

  it("uses local midnights across the DST fallback instead of assuming a 168-hour week", async () => {
    vi.setSystemTime(new Date("2026-10-28T12:00:00Z"));
    logDays(["2026-10-24T23:30:00Z", "2026-10-26T12:00:00Z"]);
    const progress = await service.computePlanProgress(plan, user);
    expect(progress.achievement.streak).toBe(1);
    const range = db.activityEntry.findMany.mock.calls.find(([query]) => query.where.datetime)?.[0].where.datetime;
    expect(range.gte.toISOString()).toBe("2026-10-24T23:00:00.000Z");
    expect(range.lt.toISOString()).toBe("2026-11-01T00:00:00.000Z");
  });

  it("counts days once and excludes deleted and future entries", async () => {
    logDays(["2026-09-20T12:00:00Z", "2026-09-20T14:00:00Z", "2026-09-21T12:00:00Z", "2026-09-24T12:00:00Z"]);
    entries[2].deletedAt = new Date();
    const progress = await service.computePlanProgress(plan, user);
    expect(progress.achievement.streak).toBe(0);
    expect(progress.currentWeekStats.daysCompletedThisWeek).toBe(1);
  });

  it("preserves completed, held and missed scoring without turning the score into the longest streak", async () => {
    const weekly = { ...plan, timesPerWeek: 3 };
    db.plan.findUnique.mockResolvedValue(weekly);
    vi.setSystemTime(new Date("2026-09-30T12:00:00Z"));
    logDays([
      "2026-09-07T12:00:00Z", "2026-09-08T12:00:00Z", "2026-09-09T12:00:00Z",
      "2026-09-14T12:00:00Z", "2026-09-15T12:00:00Z",
      "2026-09-21T12:00:00Z", "2026-09-22T12:00:00Z",
    ]);
    const progress = await service.computePlanProgress(weekly, user);
    expect(progress.achievement.streak).toBe(0);
    expect(progress.weeks.slice(0, 3).map(w => w.outcome)).toEqual(["complete", "held", "missed"]);
    expect(progress.achievement.missedLastWeek).toEqual({ streakBefore: 1, streakAfter: 0, inARow: 1 });
  });
});

describe("progress cache calendar", () => {
  it.each([undefined, "UTC"])("recomputes an obsolete or differently zoned cache (%s) before returning it", async timezone => {
    const cached = { ...plan, progressCalculatedAt: new Date(), progressState: {
      calculationVersion: timezone ? 2 : undefined, calculationTimezone: timezone,
      achievement: { streak: 1 },
    } } as unknown as typeof plan;
    db.plan.findMany.mockResolvedValue([{ ...cached, user }]);
    const fresh = { achievement: { streak: 2 } } as Awaited<ReturnType<PlansService["computePlanProgress"]>>;
    const compute = vi.spyOn(service, "computePlanProgress").mockResolvedValue(fresh);
    expect(await service.getPlanProgress(cached, user)).toBe(fresh);
    expect(await service.getBatchPlanProgress([plan.id], "viewer", false, { staleWhileRevalidate: true })).toEqual([fresh]);
    expect(compute).toHaveBeenCalledTimes(2);
  });

  it.each(["Europe/Sofia", "America/Los_Angeles"])("expires the previous week at Sunday midnight in %s", async timezone => {
    const now = timezone === "Europe/Sofia" ? "2026-09-26T22:00:00Z" : "2026-09-27T08:00:00Z";
    vi.setSystemTime(new Date(now));
    const owner = { ...user, timezone };
    const cached = { ...plan, progressCalculatedAt: new Date(new Date(now).getTime() - 2 * 3600000),
      progressState: { calculationVersion: 2, calculationTimezone: timezone } } as unknown as typeof plan;
    const compute = vi.spyOn(service, "computePlanProgress").mockResolvedValue({} as never);
    await service.getPlanProgress(cached, owner);
    expect(compute).toHaveBeenCalledOnce();
  });

  it("keeps a valid cache on Saturday west of UTC even after UTC Sunday has started", async () => {
    vi.setSystemTime(new Date("2026-09-27T02:00:00Z"));
    const owner = { ...user, timezone: "America/Los_Angeles" };
    db.user.findFirst.mockResolvedValue(owner);
    await service.computePlanProgress(plan, owner);
    const cached = { ...plan, progressCalculatedAt: new Date("2026-09-26T22:00:00Z"),
      progressState: db.plan.update.mock.calls[0][0].data.progressState };
    const compute = vi.spyOn(service, "computePlanProgress");
    await service.getPlanProgress(cached, owner);
    expect(compute).not.toHaveBeenCalled();
  });
});
