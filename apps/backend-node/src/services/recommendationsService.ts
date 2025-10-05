import { Plan, Recommendation, User } from "@tsw/prisma";
import { semanticSearch } from "@tsw/prisma/generated/prisma/sql/semanticSearch";
import { semanticSearchWithUsers } from "@tsw/prisma/generated/prisma/sql/semanticSearchWithUsers";
import { Plan as CompletePlan } from "@tsw/prisma/types";
import { logger } from "../utils/logger";
import { prisma } from "../utils/prisma";
import { plansService } from "./plansService";
import { userService } from "./userService";

export interface RecommendationScore {
  planSimScore?: number;
  geoSimScore?: number;
  ageSimScore?: number;
  activityConsistencyScore?: number;
  finalScore: number;
}

export interface RecommendedUsersResponse {
  recommendations: Recommendation[];
  users: Partial<User>[];
  plans: Plan[];
}

const PLAN_SIM_WEIGHT = 0.6;
const GEO_SIM_WEIGHT = 0.2;
const AGE_SIM_WEIGHT = 0.2;

/**
 * Compress similarity scores using sigmoid function
 * Penalizes low scores (<0.5) while preserving high scores (>0.5)
 */
function compressSimilarity(score: number): number {
  const k = 10; // steepness
  const midpoint = 0.5;
  return 1 / (1 + Math.exp(-k * (score - midpoint)));
}

/**
 * Calculate age similarity using exponential decay
 */
function calculateAgeSimilarity(age1: number, age2: number): number {
  const k = 2;
  return Math.exp(-k * Math.pow(Math.log(age1 / age2), 2));
}

/**
 * Calculate activity consistency score based on activities logged in the past 15 days
 * Cap at 5 activities for perfect score (aligns with ~3 times per week target)
 */
async function calculateActivityConsistency(userId: string): Promise<number> {
  const fifteenDaysAgo = new Date();
  fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);

  const activityCount = await prisma.activityEntry.count({
    where: {
      activity: {
        userId: userId,
        deletedAt: null,
      },
      date: {
        gte: fifteenDaysAgo,
      },
      deletedAt: null,
    },
  });

  // Cap at 5 activities for perfect score (1.0)
  return Math.min(activityCount / 5, 1.0);
}

/**
 * Calculate recency similarity using hyperbolic tangent fit
 * @deprecated - Replaced by calculateActivityConsistency
 */
function calculateRecencySimilarity(lastActiveAt: Date | null): number {
  if (!lastActiveAt) {
    return 0;
  }

  const hoursSinceLastActive =
    (Date.now() - lastActiveAt.getTime()) / (1000 * 60 * 60);

  return tanhFitRecency(hoursSinceLastActive);
}

/**
 * Hyperbolic tangent fit for recency scoring
 */
function tanhFitRecency(
  x: number,
  A: number = 0.61244,
  B: number = -0.777,
  C: number = 2.34078,
  D: number = 0.39498
): number {
  return Math.max(A * Math.tanh(B * Math.log10(x) + C) + D, 0);
}

/**
 * Calculate geographic similarity based on timezone
 */
async function calculateGeoSimilarity(
  timezone1: string,
  timezone2: string
): Promise<number> {
  try {
    // This is a simplified approach - in production you'd want a proper timezone-to-coordinates service
    // For now, we'll use a basic timezone comparison
    if (timezone1 === timezone2) {
      return 1.0;
    }

    // Extract continent/region from timezone (e.g., "America/New_York" -> "America")
    const region1 = timezone1.split("/")[0];
    const region2 = timezone2.split("/")[0];

    if (region1 === region2) {
      return 0.8;
    }

    return 0.3; // Different regions
  } catch (error) {
    logger.error("Error calculating geo similarity:", error);
    return 0.5; // Default fallback
  }
}

export class RecommendationsService {
  /**
   * Retrieve plans similar to a given plan based on embedding similarity
   * @param plan - The plan to find similar plans for
   * @param options - Optional filters (limit, userIds)
   * @returns Array of similar plans with similarity scores (excluding the source plan)
   */
  async retrieveSimilarPlans(
    plan: Plan | CompletePlan,
    options?: {
      limit?: number;
      userIds?: string[];
    }
  ): Promise<
    Array<{
      plan: Plan;
      similarity: number;
    }>
  > {
    try {
      // Get plan embedding
      const planEmbedding = await plansService.getPlanEmbedding(plan.id);

      if (!planEmbedding) {
        logger.warn(`No embedding found for plan ${plan.id}`);
        return [];
      }

      const limit = options?.limit ?? 50;
      const userIds = options?.userIds;

      // Use TypedSQL queries
      let results;
      if (userIds && userIds.length > 0) {
        results = await prisma.$queryRawTyped(
          semanticSearchWithUsers(
            plan.id,
            JSON.stringify(planEmbedding),
            userIds as any, // Cast to InputJsonObject for TypedSQL
            limit
          )
        );
      } else {
        results = await prisma.$queryRawTyped(
          semanticSearch(plan.id, JSON.stringify(planEmbedding), limit)
        );
      }

      // Fetch full plan objects
      const planIds = results.map((r) => r.planId);
      const plans = await prisma.plan.findMany({
        where: { id: { in: planIds } },
      });

      // Map back to maintain order and include similarity
      return results
        .map((r) => {
          const foundPlan = plans.find((p) => p.id === r.planId);
          return foundPlan && r.similarity !== null
            ? {
                plan: foundPlan,
                similarity: compressSimilarity(r.similarity),
              }
            : null;
        })
        .filter(
          (item): item is { plan: Plan; similarity: number } => item !== null
        );
    } catch (error) {
      logger.error("Error retrieving similar plans:", error);
      return [];
    }
  }

  /**
   * Compute recommended users for a given user
   */
  async computeRecommendedUsers(
    currentUserId: string,
    specificPlan?: Plan
  ): Promise<Record<string, any>> {
    try {
      logger.info(`Computing recommendations for user ${currentUserId}`);

      // Delete existing recommendations for this user
      await this.deleteAllRecommendationsForUser(currentUserId);

      // Get current user
      const currentUser = await userService.getUserById(currentUserId);
      if (!currentUser) {
        throw new Error("Current user not found");
      }

      // Get all users looking for accountability partners who have at least one active plan and exclude people who are >1 month old in the app without any logged activity
      const eligibleUsers = await prisma.user.findMany({
        where: {
          lookingForAp: true,
          id: { not: currentUserId },
          AND: [
            { email: { not: { startsWith: "alexandre.ramalho.1998+" } } },
            { email: { not: { startsWith: "lia.borges+" } } },
            {
              plans: {
                some: {
                  deletedAt: null,
                  OR: [
                    { finishingDate: null },
                    { finishingDate: { gt: new Date() } },
                  ],
                },
              },
            },
            // Exclude users who are already connected
            {
              NOT: {
                OR: [
                  {
                    connectionsTo: {
                      some: {
                        fromId: currentUserId,
                        status: "ACCEPTED",
                      },
                    },
                  },
                  {
                    connectionsFrom: {
                      some: {
                        toId: currentUserId,
                        status: "ACCEPTED",
                      },
                    },
                  },
                ],
              },
            },
            // Include new users (created within 30 days) OR users with recent activity
            {
              OR: [
                // New users (joined within last 30 days)
                {
                  createdAt: {
                    gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                  },
                },
                // OR users with logged activities in last 30 days
                {
                  activities: {
                    some: {
                      entries: {
                        some: {
                          date: {
                            gte: new Date(
                              Date.now() - 30 * 24 * 60 * 60 * 1000
                            ),
                          },
                        },
                      },
                    },
                  },
                },
              ],
            },
          ],
        },
      });

      if (eligibleUsers.length === 0) {
        logger.info("No users looking for accountability partners found");
        return {};
      }

      const results: Record<string, any> = {};
      const userIds = eligibleUsers.map((u) => u.id);

      // Calculate profile similarity using Pinecone
      // if (currentUser.profile) {
      //   try {
      //     const profileSearchResults = await usersPineconeService.query(
      //       currentUser.profile,
      //       50,
      //       { user_id: { $in: userIds } }
      //     );

      //     for (const result of profileSearchResults) {
      //       const userId = result.fields.user_id;
      //       if (!results[userId]) results[userId] = {};
      //       results[userId].profileSimScore = result.score;
      //     }
      //   } catch (error) {
      //     logger.warn(
      //       "Failed to get profile similarities from Pinecone:",
      //       error
      //     );
      //   }
      // }

      // Get all active plans for the current user
      let userPlans = await prisma.plan.findMany({
        where: {
          userId: currentUserId,
          deletedAt: null,
          OR: [{ finishingDate: null }, { finishingDate: { gt: new Date() } }],
        },
        orderBy: { sortOrder: "asc" },
      });

      if (userPlans.length === 0) {
        logger.info("User has no active plans, cannot compute recommendations");
        return {};
      }

      // Calculate base similarities (geo, age) once for all target users
      const baseSimilarities: Record<string, any> = {};

      for (const targetUser of eligibleUsers) {
        baseSimilarities[targetUser.id] = {};

        // Geographic similarity
        if (currentUser.timezone && targetUser.timezone) {
          baseSimilarities[targetUser.id].geoSimScore =
            await calculateGeoSimilarity(
              currentUser.timezone,
              targetUser.timezone
            );
        }

        // Age similarity
        if (currentUser.age && targetUser.age) {
          baseSimilarities[targetUser.id].ageSimScore = calculateAgeSimilarity(
            currentUser.age,
            targetUser.age
          );
        }
      }

      let eligiblePlans;
      if (specificPlan) {
        eligiblePlans = [specificPlan];
      } else {
        eligiblePlans = userPlans;
      }

      // For each user plan, compute plan similarity and create recommendations
      for (const userPlan of eligiblePlans) {
        const planResults: Record<string, any> = {};

        // Calculate plan similarity using pgvector for this specific plan
        try {
          // Use the reusable retrieveSimilarPlans function
          const similarPlans = await this.retrieveSimilarPlans(userPlan, {
            limit: 50,
            userIds, // Only include these users
          });

          for (const result of similarPlans) {
            planResults[result.plan.userId] = {
              planSimScore: result.similarity,
            };
          }
        } catch (error) {
          logger.warn(
            `Failed to get plan similarities from pgvector for plan ${userPlan.id}:`,
            error
          );
        }

        // Merge base similarities with plan-specific similarities and create recommendations
        for (const targetUserId of userIds) {
          const scores = {
            planSimScore: planResults[targetUserId]?.planSimScore ?? 0,
            geoSimScore: baseSimilarities[targetUserId]?.geoSimScore ?? 0,
            ageSimScore: baseSimilarities[targetUserId]?.ageSimScore ?? 0,
          };

          const finalScore =
            scores.planSimScore * PLAN_SIM_WEIGHT +
            scores.geoSimScore * GEO_SIM_WEIGHT +
            scores.ageSimScore * AGE_SIM_WEIGHT;

          // Only create recommendations above a minimum threshold
          if (finalScore > 0.1) {
            await prisma.recommendation.create({
              data: {
                userId: currentUserId,
                recommendationObjectType: "USER",
                recommendationObjectId: targetUserId,
                score: finalScore,
                metadata: {
                  relativeToPlanId: userPlan.id,
                  planSimScore: scores.planSimScore,
                  planSimWeight: PLAN_SIM_WEIGHT,
                  geoSimScore: scores.geoSimScore,
                  geoSimWeight: GEO_SIM_WEIGHT,
                  ageSimScore: scores.ageSimScore,
                  ageSimWeight: AGE_SIM_WEIGHT,
                },
              },
            });
            results[targetUserId] = {
              planSimScore: scores.planSimScore,
              geoSimScore: scores.geoSimScore,
              ageSimScore: scores.ageSimScore,
              finalScore: finalScore,
            };
          }
        }
      }

      // Update user's recommendation status
      await prisma.user.update({
        where: { id: currentUserId },
        data: {
          recommendationsOutdated: false,
          recommendationsLastCalculatedAt: new Date(),
        },
      });

      logger.info(
        `Computed ${Object.keys(results).length} recommendations for user ${currentUserId}`
      );

      return results;
    } catch (error) {
      logger.error("Error computing recommended users:", error);
      throw error;
    }
  }

  async getRecommendedUsers(userId: string): Promise<RecommendedUsersResponse> {
    try {
      // Check if recommendations need to be recomputed
      const user = await userService.getUserById(userId);
      if (!user) {
        throw new Error("User not found");
      }

      const shouldRecompute =
        user.recommendationsOutdated ||
        !user.recommendationsLastCalculatedAt ||
        this.isHoursOld(user.recommendationsLastCalculatedAt, 48);

      if (shouldRecompute) {
        await this.computeRecommendedUsers(userId);
      }

      // Get recommendations
      const recommendations = await prisma.recommendation.findMany({
        where: {
          userId,
          recommendationObjectType: "USER",
        },
        orderBy: { score: "desc" },
        take: 20,
      });

      const recommendedUserIds = recommendations.map(
        (r) => r.recommendationObjectId
      );

      // Get recommended users
      const recommendedUsers = await prisma.user.findMany({
        where: {
          id: { in: recommendedUserIds },
          AND: [
            { email: { not: { startsWith: "alexandre.ramalho.1998+" } } },
            { email: { not: { startsWith: "lia.borges+" } } },
          ],
        },
        select: {
          id: true,
          username: true,
          name: true,
          picture: true,
          age: true,
          timezone: true,
          profile: true,
          lastActiveAt: true,
        },
      });

      const userPlans = await Promise.all(
        recommendedUsers.map(async (user) => {
          const activePlans = await prisma.plan.findMany({
            where: {
              userId: user.id,
              deletedAt: null,
              OR: [
                { finishingDate: null },
                { finishingDate: { gt: new Date() } },
              ],
            },
          });

          return activePlans;
        })
      );

      return {
        recommendations: recommendations as any,
        users: recommendedUsers,
        plans: userPlans.flat(),
      };
    } catch (error) {
      logger.error("Error getting recommended users:", error);
      throw error;
    }
  }

  /**
   * Delete all recommendations for a user
   */
  async deleteAllRecommendationsForUser(userId: string): Promise<void> {
    try {
      await prisma.recommendation.deleteMany({
        where: { userId },
      });
      logger.info(`Deleted all recommendations for user ${userId}`);
    } catch (error) {
      logger.error(`Error deleting recommendations for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Mark user recommendations as outdated
   */
  async markRecommendationsOutdated(userId: string): Promise<void> {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { recommendationsOutdated: true },
      });
    } catch (error) {
      logger.error(
        `Error marking recommendations outdated for user ${userId}:`,
        error
      );
    }
  }

  /**
   * Check if a date is older than specified hours
   */
  private isHoursOld(date: Date, hours: number): boolean {
    const hoursDiff = (Date.now() - date.getTime()) / (1000 * 60 * 60);
    return hoursDiff > hours;
  }
}

export const recommendationsService = new RecommendationsService();
export default recommendationsService;
