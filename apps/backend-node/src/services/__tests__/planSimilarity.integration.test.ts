import { Plan as CompletePlan } from "@tsw/prisma/types";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import logger from "../../utils/logger";
import { prisma } from "../../utils/prisma";
import { plansService } from "../plansService";
import { recommendationsService } from "../recommendationsService";

const testUserId1 = "cmev4pw6x0000yz1sefkbyy1l";
const testUserId2 = "cmf55cdau0001yy1injs56d1y";
const testUserId3 = "cmf55nb160000yw1t6rwa2fuc";
const testUserId4 = "cmf59yhp30000yu1h1nkji9fr";
// TODO: these activities are not being used for anything rn, just match based on plan similarity
async function createTestPlanWithActivities(
  userId: string,
  planId: string,
  goal: string,
  activities: Array<{ title: string; measure: string; emoji: string }>
): Promise<void> {
  // Create plan
  await prisma.plan.create({
    data: {
      id: planId,
      userId,
      goal,
      emoji: activities[0]?.emoji || "🎯",
      timesPerWeek: 3,
    },
  });

  // Create activities and sessions
  for (const activity of activities) {
    const activityRecord = await prisma.activity.create({
      data: {
        userId,
        title: activity.title,
        measure: activity.measure,
        emoji: activity.emoji,
        plans: {
          connect: { id: planId },
        },
      },
    });

    // Create some plan sessions for this activity
    const today = new Date();
    for (let i = 0; i < 3; i++) {
      const sessionDate = new Date(today);
      sessionDate.setDate(today.getDate() + i);

      await prisma.planSession.create({
        data: {
          planId,
          activityId: activityRecord.id,
          date: sessionDate,
          quantity: 1,
          descriptiveGuide: `Day ${i + 1} session`,
        },
      });
    }
  }
}

async function getMostSimilarPlan(
  planId: string,
  options?: { userIds?: string[]; limit?: number }
): Promise<{ plan: CompletePlan; similarity: number } | null> {
  try {
    let eligibleUserIds = options?.userIds;
    if (!eligibleUserIds || eligibleUserIds?.length === 0) {
      eligibleUserIds = [testUserId1, testUserId2, testUserId3, testUserId4];
    }

    const sourcePlan = (await prisma.plan.findUnique({
      where: { id: planId },
    })) as CompletePlan;

    if (!sourcePlan) {
      logger.error(`Source plan ${planId} not found`);
      return null;
    }

    const similarPlans = await recommendationsService.retrieveSimilarPlans(
      sourcePlan,
      {
        limit: options?.limit ?? 1,
        userIds: eligibleUserIds,
      }
    );

    if (similarPlans.length === 0) {
      return null;
    }

    return {
      plan: similarPlans[0].plan as CompletePlan,
      similarity: similarPlans[0].similarity,
    };
  } catch (error) {
    logger.error("Error getting most similar plan:", error);
    return null;
  }
}

describe("Plan Similarity Integration Tests", () => {
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
        },
        update: {},
      });
    }
  });

  beforeEach(async () => {
    // Clean up all plans and activities before each test
    const users = [testUserId1, testUserId2, testUserId3, testUserId4];
    for (const userId of users) {
      await prisma.planSession.deleteMany({
        where: { plan: { userId } },
      });
      await prisma.activity.deleteMany({
        where: { userId },
      });
      await prisma.plan.deleteMany({
        where: { userId },
      });
    }

    // Create the 3 base test plans
    const testPlans = [
      {
        userId: testUserId1,
        planId: "plan-marathon",
        goal: "Run a marathon",
        activities: [
          { title: "Long run", measure: "km", emoji: "🏃" },
          { title: "Speed training", measure: "km", emoji: "⚡" },
          { title: "Recovery run", measure: "km", emoji: "🚶" },
        ],
      },
      {
        userId: testUserId2,
        planId: "plan-5k",
        goal: "Run a 10K race",
        activities: [
          { title: "Training run", measure: "km", emoji: "🏃" },
          { title: "Interval training", measure: "sets", emoji: "⏱️" },
        ],
      },
      {
        userId: testUserId3,
        planId: "plan-coding",
        goal: "Learn to code in Python",
        activities: [
          { title: "Code practice", measure: "hours", emoji: "💻" },
          { title: "Watch tutorials", measure: "hours", emoji: "📺" },
          { title: "Build projects", measure: "projects", emoji: "🛠️" },
        ],
      },
      {
        userId: testUserId4,
        planId: "plan-chess",
        goal: "I want to play a bit of chess everyday",
        activities: [{ title: "Chess", measure: "minutes", emoji: "♟️" }],
      },
    ];

    // Create plans with activities
    for (const plan of testPlans) {
      await createTestPlanWithActivities(
        plan.userId,
        plan.planId,
        plan.goal,
        plan.activities
      );
    }

    // Generate embeddings
    for (const plan of testPlans) {
      const embedding = await plansService.updatePlanEmbedding(plan.planId);
      if (!embedding) {
        logger.warn(`Failed to generate embedding for plan ${plan.planId}`);
      }
    }
  });

  afterAll(async () => {
    // Cleanup test users
    const users = [testUserId1, testUserId2, testUserId3, testUserId4];
    for (const userId of users) {
      await prisma.planSession.deleteMany({
        where: { plan: { userId } },
      });
      await prisma.activity.deleteMany({
        where: { userId },
      });
      await prisma.plan.deleteMany({
        where: { userId },
      });
    }

    await prisma.user.deleteMany({
      where: { id: { in: users } },
    });
  });

  describe("Similar Plans", () => {
    it("should find nearly identical similarity (~1.0) for duplicate plans", async () => {
      // Create an identical marathon plan
      const identicalPlanId = "test-dynamic-plan-identical-marathon";
      await createTestPlanWithActivities(
        testUserId2,
        identicalPlanId,
        "Run a marathon", // Same goal as plan-marathon
        [
          { title: "Long run", measure: "km", emoji: "🏃" },
          { title: "Speed training", measure: "km", emoji: "⚡" },
          { title: "Recovery run", measure: "km", emoji: "🚶" },
        ]
      );
      await plansService.updatePlanEmbedding(identicalPlanId);

      const result = await getMostSimilarPlan(identicalPlanId, { limit: 1 });

      expect(result).not.toBeNull();
      expect(result!.plan.id).toBe("plan-marathon");
      expect(result!.similarity).toBeGreaterThan(0.95);
      expect(result!.similarity).toBeLessThanOrEqual(1.0);
    });

    it("should find highly similar running plans", async () => {
      const result = await getMostSimilarPlan("plan-marathon", { limit: 1 });

      expect(result).not.toBeNull();
      expect(result!.plan.id).toBe("plan-5k");
      expect(result!.similarity).toBeGreaterThan(0.65);
      expect(result!.similarity).toBeLessThan(1.0);
    });

    it("should give moderate-high similarity for fitness variations", async () => {
      // Create a new running plan with different phrasing
      const dynamicPlanId = "test-dynamic-plan-running";
      await createTestPlanWithActivities(
        testUserId1,
        dynamicPlanId,
        "Running daily to improve fitness",
        [{ title: "Daily run", measure: "km", emoji: "🏃" }]
      );
      await plansService.updatePlanEmbedding(dynamicPlanId);

      const result = await getMostSimilarPlan(dynamicPlanId, { limit: 1 });

      expect(result).not.toBeNull();
      // Should match marathon or 5k
      expect(["plan-marathon", "plan-5k"]).toContain(result!.plan.id);
      expect(result!.similarity).toBeGreaterThan(0.5);
    });
  });

  describe("Dissimilar Plans", () => {
    it("should give low similarity for running and coding (1)", async () => {
      const result = await getMostSimilarPlan("plan-coding", {
        limit: 10,
      });

      expect(result).not.toBeNull();
      // The most similar plan to coding should not be running-related
      // and should have low similarity
      const runningSimilarity =
        result!.plan.id === "plan-marathon" || result!.plan.id === "plan-5k"
          ? result!.similarity
          : 0;

      console.log({ runningSimilarity });
      expect(runningSimilarity).toBeLessThan(0.1);
    });
    it("should give low similarity for chess and running and coding (1)", async () => {
      const result = await getMostSimilarPlan("plan-chess", {
        limit: 10,
      });

      expect(result).not.toBeNull();

      console.log({ similarity: result!.similarity });
      expect(result!.similarity).toBeLessThan(0.1);
    });
  });

  describe("Edge Cases", () => {
    it("should return null when no similar plans exist for a specific user", async () => {
      const result = await getMostSimilarPlan("plan-marathon", {
        userIds: ["non-existent-user"],
        limit: 1,
      });

      expect(result).toBeNull();
    });
  });

  describe("Real-world Scenarios", () => {
    it("should correctly rank fitness plan similarities", async () => {
      // Marathon should be most similar to 5K
      const marathonResult = await getMostSimilarPlan("plan-marathon", {
        limit: 1,
      });

      expect(marathonResult).not.toBeNull();
      expect(marathonResult!.plan.id).toBe("plan-5k");
      expect(marathonResult!.similarity).toBeGreaterThan(0.65);

      // 5K should be most similar to marathon
      const fiveKResult = await getMostSimilarPlan("plan-5k", { limit: 1 });

      expect(fiveKResult).not.toBeNull();
      expect(fiveKResult!.plan.id).toBe("plan-marathon");
    });

    it("should recognize learning/studying similarity", async () => {
      // Create a Spanish learning plan
      const spanishPlanId = "test-dynamic-plan-spanish";
      await createTestPlanWithActivities(
        testUserId3,
        spanishPlanId,
        "Learn Spanish fluently",
        [
          { title: "Spanish lessons", measure: "hours", emoji: "📚" },
          { title: "Practice speaking", measure: "hours", emoji: "🗣️" },
        ]
      );
      await plansService.updatePlanEmbedding(spanishPlanId);

      // Spanish learning should be most similar to Python learning
      const result = await getMostSimilarPlan(spanishPlanId, { limit: 1 });

      expect(result).not.toBeNull();
      expect(result!.plan.id).toBe("plan-coding");
      expect(result!.similarity).toBeGreaterThan(0.25);
      expect(result!.similarity).toBeLessThan(0.8);
    });

    it("should filter by userIds correctly", async () => {
      // Only look at user2's plans
      const result = await getMostSimilarPlan("plan-marathon", {
        userIds: [testUserId2],
        limit: 1,
      });

      expect(result).not.toBeNull();
      expect(result!.plan.userId).toBe(testUserId2);
      expect(result!.plan.id).toBe("plan-5k");
    });
  });
});
