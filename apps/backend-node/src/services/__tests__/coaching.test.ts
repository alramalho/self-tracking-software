import { Activity, Plan, PlanOutlineType, PlanState, User } from "@tsw/prisma";
import { addDays, startOfWeek } from "date-fns";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { z } from "zod/v4";
import { toMidnightUTCDate } from "../../utils/date";
import logger from "../../utils/logger";
import { prisma } from "../../utils/prisma";
import { aiService } from "../aiService";
import { plansService } from "../plansService";

const testUserId1 = "test-coach-user-1";
const testUserId2 = "test-coach-user-2";
const testUserId3 = "test-coach-user-3";
const testUserId4 = "test-coach-user-4";

interface TestScenario {
  name: string;
  userId: string;
  planId: string;
  planGoal: string;
  planType: PlanOutlineType;
  timesPerWeek: number;
  activities: Array<{ title: string; measure: string; emoji: string }>;
  // Activity entries to create (dates relative to current week)
  activityEntries: Array<{ dayOffset: number }>; // 0 = Sunday (week start), 6 = Saturday
  currentDayOfWeek: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  expectedWeekStatus: PlanState;
  evaluationCriteria: string[];
}

async function createTestScenario(scenario: TestScenario): Promise<{
  plan: Plan & { activities: Activity[] };
  user: User;
}> {
  // Set mock date based on scenario's current day of week
  // Using October 2024 week: Sun 13th to Sat 19th
  const baseSunday = new Date("2024-10-13T12:00:00Z");
  const mockDate = new Date(baseSunday);
  mockDate.setDate(baseSunday.getDate() + scenario.currentDayOfWeek);
  vi.setSystemTime(mockDate);

  // Create user
  const user = await prisma.user.upsert({
    where: { id: scenario.userId },
    create: {
      id: scenario.userId,
      email: `${scenario.userId}@test.com`,
      username: scenario.userId,
      name: scenario.userId.replace("test-coach-user-", "User "),
    },
    update: {},
  });

  // Create plan
  const plan = await prisma.plan.create({
    data: {
      id: scenario.planId,
      userId: scenario.userId,
      goal: scenario.planGoal,
      emoji: scenario.activities[0]?.emoji || "🎯",
      timesPerWeek: scenario.timesPerWeek,
      outlineType: scenario.planType,
    },
  });

  // Create activities
  const createdActivities: Activity[] = [];
  for (const activity of scenario.activities) {
    const activityRecord = await prisma.activity.create({
      data: {
        userId: scenario.userId,
        title: activity.title,
        measure: activity.measure,
        emoji: activity.emoji,
        plans: {
          connect: { id: scenario.planId },
        },
      },
    });
    createdActivities.push(activityRecord);
  }

  // Create activity entries for this week based on dayOffset
  // Use toMidnightUTCDate to ensure consistent date handling with production code
  const weekStart = toMidnightUTCDate(
    startOfWeek(new Date(), { weekStartsOn: 0 })
  ); // Sunday at midnight UTC
  for (const entry of scenario.activityEntries) {
    const entryDate = addDays(weekStart, entry.dayOffset);
    await prisma.activityEntry.create({
      data: {
        userId: scenario.userId,
        activityId: createdActivities[0].id,
        date: entryDate,
        quantity: 1,
      },
    });
  }

  return {
    plan: { ...plan, activities: createdActivities },
    user,
  };
}

async function evaluateCoachMessage(
  message: string,
  scenario: TestScenario
): Promise<{
  passes: boolean;
  results: Array<{ criterion: string; pass: boolean; reasoning: string }>;
}> {
  const criteria = scenario.evaluationCriteria;

  // Build evaluation schema - array of criterion results
  const EvaluationSchema = z.object({
    results: z.array(
      z.object({
        criterion: z.string(),
        pass: z.boolean(),
        reasoning: z.string(),
      })
    ),
  });

  const systemPrompt =
    `You are an expert evaluator of coaching messages. Evaluate the following message against specific criteria.` +
    `` +
    `For each criterion, determine if it passes (true/false) and provide brief reasoning.` +
    `` +
    `Be strict: a criterion only passes if it's clearly met.`;

  const criteriaList = criteria.map((c, i) => `${i + 1}. ${c}`).join("\n");

  const prompt =
    `Evaluate this coaching message:\n"${message}"\n\n` +
    `Scenario context:\n` +
    `- Plan: ${scenario.planGoal}\n` +
    `- User name: ${scenario.userId.replace("test-coach-user-", "User ")}\n` +
    `- Week status: ${scenario.expectedWeekStatus}\n` +
    `- Completed: ${scenario.activityEntries.length}/${scenario.timesPerWeek} days\n\n` +
    `Criteria to evaluate:\n${criteriaList}\n\n` +
    `For each criterion, provide:\n` +
    `1. The criterion text (exactly as listed above)\n` +
    `2. Whether it passes (true/false)\n` +
    `3. Brief reasoning explaining your decision`;

  try {
    const evaluation = await aiService.generateStructuredResponse(
      prompt,
      EvaluationSchema,
      systemPrompt
    );

    const allPass = evaluation.results.every((result) => result.pass);

    // Log failed criteria
    if (!allPass) {
      logger.warn("❌ Message failed evaluation:");
      evaluation.results
        .filter((r) => !r.pass)
        .forEach((r) => {
          logger.warn(`  - ${r.criterion}: ${r.reasoning}`);
        });
    }

    return {
      passes: allPass,
      results: evaluation.results,
    };
  } catch (error) {
    logger.error("Error evaluating coach message:", error);
    throw error;
  }
}

async function evaluateCoachNotes(
  notes: string,
  scenario: TestScenario,
  additionalContext?: string
): Promise<{
  passes: boolean;
  results: Array<{ criterion: string; pass: boolean; reasoning: string }>;
}> {
  const criteria = scenario.evaluationCriteria;

  // Build evaluation schema - array of criterion results
  const EvaluationSchema = z.object({
    results: z.array(
      z.object({
        criterion: z.string(),
        pass: z.boolean(),
        reasoning: z.string(),
      })
    ),
  });

  const systemPrompt =
    `You are an expert evaluator of coaching notes. Evaluate the following notes against specific criteria.` +
    `` +
    `For each criterion, determine if it passes (true/false) and provide brief reasoning.` +
    `` +
    `Be strict: a criterion only passes if it's clearly met.`;

  const criteriaList = criteria.map((c, i) => `${i + 1}. ${c}`).join("\n");

  const prompt =
    `Evaluate these coach notes:\n"${notes}"\n\n` +
    `Scenario context:\n` +
    `- Plan: ${scenario.planGoal}\n` +
    `- Week status: ${scenario.expectedWeekStatus}\n` +
    `- Completed: ${scenario.activityEntries.length}/${scenario.timesPerWeek} days\n` +
    (additionalContext ? `- ${additionalContext}\n` : "") +
    `\n` +
    `Criteria to evaluate:\n${criteriaList}\n\n` +
    `For each criterion, provide:\n` +
    `1. The criterion text (exactly as listed above)\n` +
    `2. Whether it passes (true/false)\n` +
    `3. Brief reasoning explaining your decision`;

  try {
    const evaluation = await aiService.generateStructuredResponse(
      prompt,
      EvaluationSchema,
      systemPrompt
    );

    const allPass = evaluation.results.every((result) => result.pass);

    // Log failed criteria
    if (!allPass) {
      logger.warn("❌ Notes failed evaluation:");
      evaluation.results
        .filter((r) => !r.pass)
        .forEach((r) => {
          logger.warn(`  - ${r.criterion}: ${r.reasoning}`);
        });
    }

    return {
      passes: allPass,
      results: evaluation.results,
    };
  } catch (error) {
    logger.error("Error evaluating coach notes:", error);
    throw error;
  }
}

describe("Coaching Messages Tests", () => {
  beforeAll(async () => {
    // Create test users
    const users = [testUserId1, testUserId2, testUserId3, testUserId4];
    for (const userId of users) {
      await prisma.user.upsert({
        where: { id: userId },
        create: {
          id: userId,
          email: `${userId}@test.com`,
          username: userId,
          name: userId.replace("test-coach-user-", "User "),
        },
        update: {},
      });
    }
  });

  beforeEach(async () => {
    // Enable fake timers (each test will set its own date via createTestScenario)
    vi.useFakeTimers();

    // Clean up all plans, activities, and entries before each test
    const users = [testUserId1, testUserId2, testUserId3, testUserId4];

    // Get all activity IDs and plan IDs for these users
    const userActivities = await prisma.activity.findMany({
      where: { userId: { in: users } },
      select: { id: true },
    });
    const activityIds = userActivities.map((a) => a.id);

    const userPlans = await prisma.plan.findMany({
      where: { userId: { in: users } },
      select: { id: true },
    });
    const planIds = userPlans.map((p) => p.id);

    // Delete in proper order respecting foreign keys
    // 1. Delete activity entries first (no FK dependencies)
    await prisma.activityEntry.deleteMany({
      where: { userId: { in: users } },
    });

    // 2. Delete ALL plan sessions that reference either our plans OR our activities
    const deleteConditions = [];
    if (planIds.length > 0) {
      deleteConditions.push({ planId: { in: planIds } });
    }
    if (activityIds.length > 0) {
      deleteConditions.push({ activityId: { in: activityIds } });
    }
    if (deleteConditions.length > 0) {
      await prisma.planSession.deleteMany({
        where: {
          OR: deleteConditions,
        },
      });
    }

    // 3. Delete activities (this will auto-cleanup the _ActivityToPlan join table)
    await prisma.activity.deleteMany({
      where: { userId: { in: users } },
    });

    // 4. Finally delete plans
    await prisma.plan.deleteMany({
      where: { userId: { in: users } },
    });
  });

  afterEach(() => {
    // Restore real timers after each test
    vi.useRealTimers();
  });

  afterAll(async () => {
    // Cleanup test users
    const users = [testUserId1, testUserId2, testUserId3, testUserId4];

    // Get all activity IDs and plan IDs for these users
    const userActivities = await prisma.activity.findMany({
      where: { userId: { in: users } },
      select: { id: true },
    });
    const activityIds = userActivities.map((a) => a.id);

    const userPlans = await prisma.plan.findMany({
      where: { userId: { in: users } },
      select: { id: true },
    });
    const planIds = userPlans.map((p) => p.id);

    // Delete in proper order respecting foreign keys
    await prisma.activityEntry.deleteMany({
      where: { userId: { in: users } },
    });

    const deleteConditions = [];
    if (planIds.length > 0) {
      deleteConditions.push({ planId: { in: planIds } });
    }
    if (activityIds.length > 0) {
      deleteConditions.push({ activityId: { in: activityIds } });
    }
    if (deleteConditions.length > 0) {
      await prisma.planSession.deleteMany({
        where: {
          OR: deleteConditions,
        },
      });
    }

    await prisma.activity.deleteMany({
      where: { userId: { in: users } },
    });

    await prisma.plan.deleteMany({
      where: { userId: { in: users } },
    });

    await prisma.user.deleteMany({
      where: { id: { in: users } },
    });
  });

  describe("Week Status: FAILED", () => {
    it("should acknowledge impossibility and mention plan adjustment", async () => {
      const scenario: TestScenario = {
        name: "Week failed - 2/7 done with 3 days left",
        userId: testUserId1,
        planId: "plan-failed-1",
        planGoal: "I want to play chess every day",
        planType: PlanOutlineType.TIMES_PER_WEEK,
        timesPerWeek: 7,
        activities: [{ title: "Chess", measure: "minutes", emoji: "♟️" }],
        // 2 activities done on Sunday (0) and Monday (1)
        // Today is Thursday (4): 5 days in the past/present (Sun-Thu), 3 days left (Thu-Sat)
        // Need 5 more days, but only 3 days left = FAILED
        activityEntries: [{ dayOffset: 0 }, { dayOffset: 1 }],
        currentDayOfWeek: 4, // Thursday
        expectedWeekStatus: PlanState.FAILED,
        evaluationCriteria: [
          "Acknowledges the week cannot be completed",
          "Mentions the plan has been adjusted",
          "Avoids unrealistic promises",
          "Maintains encouragement",
          "Uses the user's name",
        ],
      };

      const { plan, user } = await createTestScenario(scenario);

      // Calculate plan progress to populate currentWeekState
      await plansService.recalculateCurrentWeekState(plan, user);

      const message = await aiService.generateCoachMessage(user, plan);

      logger.info(`Generated message: "${message}"`);

      const evaluation = await evaluateCoachMessage(message, scenario);

      // Log results
      evaluation.results.forEach((result) => {
        logger.info(
          `${result.pass ? "✓" : "✗"} ${result.criterion}: ${result.reasoning}`
        );
      });

      expect(evaluation.passes).toBe(true);
    }, 30000); // 30s timeout for AI calls
  });

  describe("Week Status: AT_RISK", () => {
    it("should acknowledge time constraint without false promises", async () => {
      const scenario: TestScenario = {
        name: "Week at risk - 4/7 done with 3 days left",
        userId: testUserId2,
        planId: "plan-at-risk-1",
        planGoal: "Exercise regularly",
        planType: PlanOutlineType.TIMES_PER_WEEK,
        timesPerWeek: 7,
        activities: [{ title: "Workout", measure: "sessions", emoji: "💪" }],
        // 4 activities done on Sun-Wed (0-3)
        // Today is Thursday (4): 5 days in the past/present (Sun-Thu), 3 days left (Thu-Sat)
        // Need 3 more days, have 3 days left = AT_RISK (no margin)
        activityEntries: [
          { dayOffset: 0 },
          { dayOffset: 1 },
          { dayOffset: 2 },
          { dayOffset: 3 },
        ],
        currentDayOfWeek: 4, // Thursday
        expectedWeekStatus: PlanState.AT_RISK,
        evaluationCriteria: [
          "Acknowledges the tight timeline or urgency",
          "Avoids unrealistic promises",
          "Maintains encouragement",
          "Uses the user's name",
        ],
      };

      const { plan, user } = await createTestScenario(scenario);

      // Calculate plan progress to populate currentWeekState
      await plansService.recalculateCurrentWeekState(plan, user);

      const message = await aiService.generateCoachMessage(user, plan);

      logger.info(`Generated message: "${message}"`);

      const evaluation = await evaluateCoachMessage(message, scenario);

      evaluation.results.forEach((result) => {
        logger.info(
          `${result.pass ? "✓" : "✗"} ${result.criterion}: ${result.reasoning}`
        );
      });

      expect(evaluation.passes).toBe(true);
    }, 30000); // 30s timeout for AI calls
  });

  describe("Week Status: ON_TRACK", () => {
    it("should encourage continued momentum with buffer time", async () => {
      const scenario: TestScenario = {
        name: "Week on track - 3/5 done with 3 days left",
        userId: testUserId3,
        planId: "plan-on-track-1",
        planGoal: "Read more books",
        planType: PlanOutlineType.TIMES_PER_WEEK,
        timesPerWeek: 5,
        activities: [{ title: "Reading", measure: "pages", emoji: "📚" }],
        // 3 activities done on Sun, Mon, Tue (0, 1, 2)
        // Today is Thursday (4): 5 days in the past/present (Sun-Thu), 3 days left (Thu-Sat)
        // Need 2 more days, have 3 days left = ON_TRACK (buffer of 1)
        activityEntries: [{ dayOffset: 0 }, { dayOffset: 1 }, { dayOffset: 2 }],
        currentDayOfWeek: 4, // Thursday
        expectedWeekStatus: PlanState.ON_TRACK,
        evaluationCriteria: [
          "Acknowledges good progress or buffer time",
          "Avoids unrealistic promises",
          "Maintains encouragement",
          "Uses the user's name",
        ],
      };

      const { plan, user } = await createTestScenario(scenario);

      // Calculate plan progress to populate currentWeekState
      await plansService.recalculateCurrentWeekState(plan, user);

      const message = await aiService.generateCoachMessage(user, plan);

      logger.info(`Generated message: "${message}"`);

      const evaluation = await evaluateCoachMessage(message, scenario);

      evaluation.results.forEach((result) => {
        logger.info(
          `${result.pass ? "✓" : "✗"} ${result.criterion}: ${result.reasoning}`
        );
      });

      expect(evaluation.passes).toBe(true);
    }, 30000); // 30s timeout for AI calls
  });

  describe("Week Status: COMPLETED", () => {
    it("should celebrate success and acknowledge completion", async () => {
      const scenario: TestScenario = {
        name: "Week completed - 5/5 done",
        userId: testUserId4,
        planId: "plan-completed-1",
        planGoal: "Practice meditation daily",
        planType: PlanOutlineType.TIMES_PER_WEEK,
        timesPerWeek: 5,
        activities: [{ title: "Meditation", measure: "minutes", emoji: "🧘" }],
        // 5 activities done on Sun-Thu (0-4)
        // Today is Thursday (4): 5 days in the past/present (Sun-Thu), 3 days left (Thu-Sat)
        // All 5 days completed = COMPLETED
        activityEntries: [
          { dayOffset: 0 },
          { dayOffset: 1 },
          { dayOffset: 2 },
          { dayOffset: 3 },
          { dayOffset: 4 },
        ],
        currentDayOfWeek: 4, // Thursday
        expectedWeekStatus: PlanState.COMPLETED,
        evaluationCriteria: [
          "Celebrates the success or completion",
          "Avoids unrealistic promises",
          "Maintains encouragement",
          "Uses the user's name",
        ],
      };

      const { plan, user } = await createTestScenario(scenario);

      // Calculate plan progress to populate currentWeekState
      await plansService.recalculateCurrentWeekState(plan, user);

      const message = await aiService.generateCoachMessage(user, plan);

      logger.info(`Generated message: "${message}"`);

      const evaluation = await evaluateCoachMessage(message, scenario);

      evaluation.results.forEach((result) => {
        logger.info(
          `${result.pass ? "✓" : "✗"} ${result.criterion}: ${result.reasoning}`
        );
      });

      expect(evaluation.passes).toBe(true);
    }, 30000); // 30s timeout for AI calls
  });
});

describe("Coach Notes Tests", () => {
  beforeAll(async () => {
    // Create test users
    const users = [testUserId1, testUserId2, testUserId3, testUserId4];
    for (const userId of users) {
      await prisma.user.upsert({
        where: { id: userId },
        create: {
          id: userId,
          email: `${userId}@test.com`,
          username: userId,
          name: userId.replace("test-coach-user-", "User "),
        },
        update: {},
      });
    }
  });

  beforeEach(async () => {
    // Enable fake timers (each test will set its own date via createTestScenario)
    vi.useFakeTimers();

    // Clean up all plans, activities, and entries before each test
    const users = [testUserId1, testUserId2, testUserId3, testUserId4];

    // Get all activity IDs and plan IDs for these users
    const userActivities = await prisma.activity.findMany({
      where: { userId: { in: users } },
      select: { id: true },
    });
    const activityIds = userActivities.map((a) => a.id);

    const userPlans = await prisma.plan.findMany({
      where: { userId: { in: users } },
      select: { id: true },
    });
    const planIds = userPlans.map((p) => p.id);

    // Delete in proper order respecting foreign keys
    // 1. Delete activity entries first (no FK dependencies)
    await prisma.activityEntry.deleteMany({
      where: { userId: { in: users } },
    });

    // 2. Delete ALL plan sessions that reference either our plans OR our activities
    const deleteConditions = [];
    if (planIds.length > 0) {
      deleteConditions.push({ planId: { in: planIds } });
    }
    if (activityIds.length > 0) {
      deleteConditions.push({ activityId: { in: activityIds } });
    }
    if (deleteConditions.length > 0) {
      await prisma.planSession.deleteMany({
        where: {
          OR: deleteConditions,
        },
      });
    }

    // 3. Delete activities (this will auto-cleanup the _ActivityToPlan join table)
    await prisma.activity.deleteMany({
      where: { userId: { in: users } },
    });

    // 4. Finally delete plans
    await prisma.plan.deleteMany({
      where: { userId: { in: users } },
    });
  });

  afterEach(() => {
    // Restore real timers after each test
    vi.useRealTimers();
  });

  afterAll(async () => {
    // Cleanup test users
    const users = [testUserId1, testUserId2, testUserId3, testUserId4];

    // Get all activity IDs and plan IDs for these users
    const userActivities = await prisma.activity.findMany({
      where: { userId: { in: users } },
      select: { id: true },
    });
    const activityIds = userActivities.map((a) => a.id);

    const userPlans = await prisma.plan.findMany({
      where: { userId: { in: users } },
      select: { id: true },
    });
    const planIds = userPlans.map((p) => p.id);

    // Delete in proper order respecting foreign keys
    await prisma.activityEntry.deleteMany({
      where: { userId: { in: users } },
    });

    const deleteConditions = [];
    if (planIds.length > 0) {
      deleteConditions.push({ planId: { in: planIds } });
    }
    if (activityIds.length > 0) {
      deleteConditions.push({ activityId: { in: activityIds } });
    }
    if (deleteConditions.length > 0) {
      await prisma.planSession.deleteMany({
        where: {
          OR: deleteConditions,
        },
      });
    }

    await prisma.activity.deleteMany({
      where: { userId: { in: users } },
    });

    await prisma.plan.deleteMany({
      where: { userId: { in: users } },
    });

    await prisma.user.deleteMany({
      where: { id: { in: users } },
    });
  });

  describe("FAILED state with plan adjustment", () => {
    it("should explain the adjustment made to the plan", async () => {
      const scenario: TestScenario = {
        name: "Week failed - plan adjusted",
        userId: testUserId1,
        planId: "plan-notes-failed-1",
        planGoal: "I want to run every day",
        planType: PlanOutlineType.TIMES_PER_WEEK,
        timesPerWeek: 7,
        activities: [{ title: "Running", measure: "km", emoji: "🏃" }],
        activityEntries: [{ dayOffset: 0 }, { dayOffset: 1 }],
        currentDayOfWeek: 4, // Thursday
        expectedWeekStatus: PlanState.FAILED,
        evaluationCriteria: [
          "Mentions the reduction in times per week (from 7 to 6)",
          "Explains why the adjustment was made",
          "Maintains supportive tone without guilt",
          "Focuses on sustainable progress",
        ],
      };

      const { plan, user } = await createTestScenario(scenario);

      // Calculate plan progress - this will trigger state transition and generate coach notes
      await plansService.recalculateCurrentWeekState(plan, user);

      // Fetch the updated plan to get the coach notes
      const updatedPlan = await prisma.plan.findUnique({
        where: { id: plan.id },
      });

      expect(updatedPlan?.coachNotes).toBeTruthy();
      logger.info(`Generated coach notes: "${updatedPlan!.coachNotes}"`);

      const evaluation = await evaluateCoachNotes(
        updatedPlan!.coachNotes!,
        scenario,
        "Plan adjusted from 7 to 6 times per week"
      );

      // Log results
      evaluation.results.forEach((result) => {
        logger.info(
          `${result.pass ? "✓" : "✗"} ${result.criterion}: ${result.reasoning}`
        );
      });

      expect(evaluation.passes).toBe(true);
    }, 30000);
  });

  describe("AT_RISK state", () => {
    it("should acknowledge challenge without adjustment", async () => {
      const scenario: TestScenario = {
        name: "Week at risk - no adjustment",
        userId: testUserId2,
        planId: "plan-notes-at-risk-1",
        planGoal: "Practice guitar daily",
        planType: PlanOutlineType.TIMES_PER_WEEK,
        timesPerWeek: 7,
        activities: [{ title: "Guitar", measure: "minutes", emoji: "🎸" }],
        activityEntries: [
          { dayOffset: 0 },
          { dayOffset: 1 },
          { dayOffset: 2 },
          { dayOffset: 3 },
        ],
        currentDayOfWeek: 4, // Thursday
        expectedWeekStatus: PlanState.AT_RISK,
        evaluationCriteria: [
          "Acknowledges the tight timeline or urgency",
          "Does NOT mention any plan adjustment",
          "Remains encouraging and supportive",
          "Avoids panic or negativity",
        ],
      };

      const { plan, user } = await createTestScenario(scenario);

      await plansService.recalculateCurrentWeekState(plan, user);

      const updatedPlan = await prisma.plan.findUnique({
        where: { id: plan.id },
      });

      expect(updatedPlan?.coachNotes).toBeTruthy();
      logger.info(`Generated coach notes: "${updatedPlan!.coachNotes}"`);

      const evaluation = await evaluateCoachNotes(
        updatedPlan!.coachNotes!,
        scenario
      );

      evaluation.results.forEach((result) => {
        logger.info(
          `${result.pass ? "✓" : "✗"} ${result.criterion}: ${result.reasoning}`
        );
      });

      expect(evaluation.passes).toBe(true);
    }, 30000);
  });

  describe("ON_TRACK state", () => {
    it("should encourage continued momentum", async () => {
      const scenario: TestScenario = {
        name: "Week on track - keep going",
        userId: testUserId3,
        planId: "plan-notes-on-track-1",
        planGoal: "Write daily journal",
        planType: PlanOutlineType.TIMES_PER_WEEK,
        timesPerWeek: 5,
        activities: [{ title: "Journaling", measure: "pages", emoji: "📝" }],
        activityEntries: [{ dayOffset: 0 }, { dayOffset: 1 }, { dayOffset: 2 }],
        currentDayOfWeek: 4, // Thursday
        expectedWeekStatus: PlanState.ON_TRACK,
        evaluationCriteria: [
          "Acknowledges good progress",
          "Does NOT mention any plan adjustment",
          "Maintains positive and encouraging tone",
          "Suggests staying the course",
        ],
      };

      const { plan, user } = await createTestScenario(scenario);

      await plansService.recalculateCurrentWeekState(plan, user);

      const updatedPlan = await prisma.plan.findUnique({
        where: { id: plan.id },
      });

      expect(updatedPlan?.coachNotes).toBeTruthy();
      logger.info(`Generated coach notes: "${updatedPlan!.coachNotes}"`);

      const evaluation = await evaluateCoachNotes(
        updatedPlan!.coachNotes!,
        scenario
      );

      evaluation.results.forEach((result) => {
        logger.info(
          `${result.pass ? "✓" : "✗"} ${result.criterion}: ${result.reasoning}`
        );
      });

      expect(evaluation.passes).toBe(true);
    }, 30000);
  });

  describe("COMPLETED state", () => {
    it("should celebrate success and reinforce achievement", async () => {
      const scenario: TestScenario = {
        name: "Week completed - celebration",
        userId: testUserId4,
        planId: "plan-notes-completed-1",
        planGoal: "Exercise 5 times a week",
        planType: PlanOutlineType.TIMES_PER_WEEK,
        timesPerWeek: 5,
        activities: [{ title: "Workout", measure: "sessions", emoji: "💪" }],
        activityEntries: [
          { dayOffset: 0 },
          { dayOffset: 1 },
          { dayOffset: 2 },
          { dayOffset: 3 },
          { dayOffset: 4 },
        ],
        currentDayOfWeek: 4, // Thursday
        expectedWeekStatus: PlanState.COMPLETED,
        evaluationCriteria: [
          "Celebrates the completion or success",
          "Does NOT mention any plan adjustment",
          "Reinforces the positive achievement",
          "Maintains encouraging tone for future",
        ],
      };

      const { plan, user } = await createTestScenario(scenario);

      const updatedPlan = await plansService.recalculateCurrentWeekState(
        plan,
        user
      );

      expect(updatedPlan?.coachNotes).toBeTruthy();
      logger.info(`Generated coach notes: "${updatedPlan!.coachNotes}"`);

      const evaluation = await evaluateCoachNotes(
        updatedPlan!.coachNotes!,
        scenario
      );

      evaluation.results.forEach((result) => {
        logger.info(
          `${result.pass ? "✓" : "✗"} ${result.criterion}: ${result.reasoning}`
        );
      });

      expect(evaluation.passes).toBe(true);
    }, 30000);
  });
});
