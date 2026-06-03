import { PlanOutlineType } from "@tsw/prisma";
import { isSameWeek } from "date-fns";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../utils/prisma";
import { plansService } from "../plansService";

const testUserId = "test-plan-progress-user";

async function cleanup() {
  await prisma.activityEntry.deleteMany({
    where: { userId: testUserId },
  });
  await prisma.planSession.deleteMany({
    where: {
      OR: [
        { plan: { userId: testUserId } },
        { activity: { userId: testUserId } },
      ],
    },
  });
  await prisma.activity.deleteMany({
    where: { userId: testUserId },
  });
  await prisma.plan.deleteMany({
    where: { userId: testUserId },
  });
  await prisma.user.deleteMany({
    where: { id: testUserId },
  });
}

describe("PlansService progress", () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-03T12:00:00.000Z"));
    await cleanup();
  });

  afterEach(async () => {
    vi.useRealTimers();
    await cleanup();
  });

  it("includes the current week for active times-per-week plans even when the historical range is empty", async () => {
    const user = await prisma.user.create({
      data: {
        id: testUserId,
        email: `${testUserId}@test.com`,
        username: testUserId,
        name: "Plan Progress User",
        timezone: "Europe/Sofia",
      },
    });

    const plan = await prisma.plan.create({
      data: {
        userId: testUserId,
        goal: "Meditate more often",
        emoji: "M",
        outlineType: PlanOutlineType.TIMES_PER_WEEK,
        timesPerWeek: 3,
      },
      include: {
        activities: true,
      },
    });

    const progress = await plansService.computePlanProgress(plan, user);
    const currentWeek = progress.weeks.find((week) =>
      isSameWeek(week.startDate, new Date(), { weekStartsOn: 0 })
    );

    expect(currentWeek).toBeDefined();
    expect(currentWeek?.plannedActivities).toBe(3);
    expect(currentWeek?.weekActivities).toEqual([]);
    expect(currentWeek?.completedActivities).toEqual([]);
    expect(currentWeek?.isCompleted).toBe(false);
    expect(progress.currentWeekStats.numActiveDaysInTheWeek).toBe(3);
  });

  it("caps current week planned activities at zero for ended times-per-week plans", async () => {
    const user = await prisma.user.create({
      data: {
        id: testUserId,
        email: `${testUserId}@test.com`,
        username: testUserId,
        name: "Plan Progress User",
        timezone: "Europe/Sofia",
      },
    });

    const plan = await prisma.plan.create({
      data: {
        userId: testUserId,
        goal: "Meditate more often",
        emoji: "M",
        outlineType: PlanOutlineType.TIMES_PER_WEEK,
        timesPerWeek: 3,
        finishingDate: new Date("2025-04-04T00:00:00.000Z"),
      },
      include: {
        activities: true,
      },
    });

    const progress = await plansService.computePlanProgress(plan, user);
    const currentWeek = progress.weeks.find((week) =>
      isSameWeek(week.startDate, new Date(), { weekStartsOn: 0 })
    );

    expect(currentWeek).toBeDefined();
    expect(currentWeek?.plannedActivities).toBe(0);
    expect(currentWeek?.weekActivities).toEqual([]);
    expect(currentWeek?.completedActivities).toEqual([]);
    expect(currentWeek?.isCompleted).toBe(false);
    expect(progress.currentWeekStats.numActiveDaysInTheWeek).toBe(0);
  });

  it("only counts matching same-day activity entries for specific scheduled sessions", async () => {
    const user = await prisma.user.create({
      data: {
        id: testUserId,
        email: `${testUserId}@test.com`,
        username: testUserId,
        name: "Plan Progress User",
        timezone: "Europe/Sofia",
      },
    });

    const running = await prisma.activity.create({
      data: {
        userId: testUserId,
        title: "running",
        measure: "km",
        emoji: "🏃",
      },
    });
    const gym = await prisma.activity.create({
      data: {
        userId: testUserId,
        title: "gym",
        measure: "session",
        emoji: "💪",
      },
    });

    const plan = await prisma.plan.create({
      data: {
        userId: testUserId,
        goal: "run 20km under 2 hours",
        emoji: "🏃",
        outlineType: PlanOutlineType.SPECIFIC,
        finishingDate: new Date("2026-08-26T00:00:00.000Z"),
        activities: {
          connect: [{ id: running.id }, { id: gym.id }],
        },
        sessions: {
          create: [
            {
              activityId: running.id,
              date: new Date("2026-06-04T00:00:00.000Z"),
              quantity: 5,
            },
            {
              activityId: running.id,
              date: new Date("2026-06-06T00:00:00.000Z"),
              quantity: 6,
            },
          ],
        },
      },
      include: {
        activities: true,
      },
    });

    await prisma.activityEntry.createMany({
      data: [
        {
          userId: testUserId,
          activityId: gym.id,
          quantity: 1,
          datetime: new Date("2026-05-31T10:56:00.000Z"),
        },
        {
          userId: testUserId,
          activityId: gym.id,
          quantity: 1,
          datetime: new Date("2026-06-02T00:00:00.000Z"),
        },
      ],
    });

    const progress = await plansService.computePlanProgress(plan, user);
    const currentWeek = progress.weeks.find((week) =>
      isSameWeek(week.startDate, new Date(), { weekStartsOn: 0 })
    );

    expect(currentWeek).toBeDefined();
    expect(currentWeek?.plannedActivities).toHaveLength(2);
    expect(currentWeek?.completedActivities).toEqual([]);
    expect(currentWeek?.isCompleted).toBe(false);
    expect(progress.currentWeekStats.numActiveDaysInTheWeek).toBe(2);
    expect(progress.currentWeekStats.daysCompletedThisWeek).toBe(0);
    expect(progress.currentWeekStats.numActiveDaysLeftInTheWeek).toBe(2);
  });
});
