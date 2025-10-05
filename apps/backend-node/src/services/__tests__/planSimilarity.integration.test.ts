import { afterAll, beforeAll, describe, expect, it } from "vitest";
import logger from "../../utils/logger";
import { plansPineconeService } from "../pineconeService";

// NOTE TO SELF: we need to
// 1. make sure plan similarity works
// 2. refactor frontend to be more simple -> plan similarity focused
// so basically, make matching algorithm almost exclusive to plan similarity
// activity based can be hidden (just use for filtering out)

async function calculatePlanSimilarity(
  planGoal: string,
  targetPlanGoal: string,
  targetUserId: string
): Promise<number> {
  try {
    plansPineconeService.upsertRecords([
      {
        text: targetPlanGoal,
        identifier: `test-${targetPlanGoal}-${targetUserId}`,
        metadata: { user_id: targetUserId },
      },
    ]);
    const results = await plansPineconeService.query(planGoal, 50, {
      user_id: { $eq: targetUserId },
    });

    if (results.length === 0) {
      return 0;
    }

    // Find the matching result
    const match = results.find((r) => r.fields.user_id === targetUserId);
    return match?.score || 0;
  } catch (error) {
    logger.error("Error calculating plan similarity:", error);
    return 0;
  }
}

describe("Plan Similarity Integration Tests", () => {
  const testUserId1 = "test-user-similarity-1";
  const testUserId2 = "test-user-similarity-2";
  const testUserId3 = "test-user-similarity-3";

  beforeAll(async () => {
    // Setup test data in Pinecone
    await plansPineconeService.upsertRecords([
      {
        text: "Run a marathon",
        identifier: "plan-marathon",
        metadata: { user_id: testUserId1 },
      },
      {
        text: "Complete a 5K race",
        identifier: "plan-5k",
        metadata: { user_id: testUserId2 },
      },
      {
        text: "Learn to code in Python",
        identifier: "plan-coding",
        metadata: { user_id: testUserId3 },
      },
    ]);

    // Wait for Pinecone to index
    await new Promise((resolve) => setTimeout(resolve, 2000));
  });

  afterAll(async () => {
    // Cleanup test data
    await plansPineconeService.deleteRecords([
      "plan-marathon",
      "plan-5k",
      "plan-coding",
    ]);
  });

  describe("Identical Plans", () => {
    it("should return ~1.0 for identical plan goals", async () => {
      const similarity = await calculatePlanSimilarity(
        "Run a marathon",
        "Run a marathon",
        testUserId1
      );

      expect(similarity).toBeGreaterThan(0.95);
      expect(similarity).toBeLessThanOrEqual(1.0);
    });
  });

  describe("Similar Plans", () => {
    it("should give high similarity for related running plans", async () => {
      const similarity = await calculatePlanSimilarity(
        "Run a marathon",
        "Complete a 5K race",
        testUserId2
      );

      // Running plans should be highly similar
      expect(similarity).toBeGreaterThan(0.7);
      expect(similarity).toBeLessThan(1.0);
    });

    it("should give moderate-high similarity for fitness variations", async () => {
      // Test with slightly different phrasing
      const similarity = await calculatePlanSimilarity(
        "Running daily",
        "Run a marathon",
        testUserId1
      );

      expect(similarity).toBeGreaterThan(0.6);
    });
  });

  describe("Dissimilar Plans", () => {
    it("should give low similarity for completely unrelated plans", async () => {
      const similarity = await calculatePlanSimilarity(
        "Run a marathon",
        "Learn to code in Python",
        testUserId3
      );

      // Running and coding should have low similarity
      expect(similarity).toBeLessThan(0.4);
    });

    it("should give very low similarity for opposite domains", async () => {
      const similarity = await calculatePlanSimilarity(
        "Complete a 5K race",
        "Learn to code in Python",
        testUserId3
      );

      expect(similarity).toBeLessThan(0.3);
    });
  });

  describe("Edge Cases", () => {
    it("should return 0 for non-existent user", async () => {
      const similarity = await calculatePlanSimilarity(
        "Run a marathon",
        "Some plan",
        "non-existent-user"
      );

      expect(similarity).toBe(0);
    });

    it("should handle empty plan goals gracefully", async () => {
      const similarity = await calculatePlanSimilarity(
        "",
        "Run a marathon",
        testUserId1
      );

      expect(similarity).toBeGreaterThanOrEqual(0);
      expect(similarity).toBeLessThanOrEqual(1);
    });
  });

  describe("Real-world Scenarios", () => {
    it("should correctly rank fitness plan similarities", async () => {
      const basePlan = "Run a marathon";

      // Test against 5K (very similar)
      const sim5k = await calculatePlanSimilarity(
        basePlan,
        "Complete a 5K race",
        testUserId2
      );

      // Test against coding (dissimilar)
      const simCoding = await calculatePlanSimilarity(
        basePlan,
        "Learn to code in Python",
        testUserId3
      );

      // Marathon should be more similar to 5K than to coding
      expect(sim5k).toBeGreaterThan(simCoding);
      expect(sim5k).toBeGreaterThan(0.6);
      expect(simCoding).toBeLessThan(0.4);
    });

    it("should recognize learning/studying similarity", async () => {
      // Both are learning-related
      const similarity = await calculatePlanSimilarity(
        "Learn Spanish",
        "Learn to code in Python",
        testUserId3
      );

      // Should have moderate similarity due to "learn" concept
      expect(similarity).toBeGreaterThan(0.4);
      expect(similarity).toBeLessThan(0.8);
    });
  });
});
