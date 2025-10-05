import { Plan, Recommendation, User } from "@tsw/prisma";
import { logger } from "../utils/logger";
import { prisma } from "../utils/prisma";
import { plansPineconeService } from "./pineconeService";
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

const PLAN_SIM_WEIGHT = 0.5;
const ACTIVITY_CONSISTENCY_WEIGHT = 0.3;
const GEO_SIM_WEIGHT = 0.1;
const AGE_SIM_WEIGHT = 0.1;

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

      // Calculate base similarities (geo, age, activity) once for all target users
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

        // Activity consistency (activities logged in past 15 days)
        baseSimilarities[targetUser.id].activityConsistencyScore =
          await calculateActivityConsistency(targetUser.id);
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

        // Calculate plan similarity using Pinecone for this specific plan
        try {
          const planSearchResults = await plansPineconeService.query(
            userPlan.goal,
            50,
            { user_id: { $in: userIds } }
          );

          for (const result of planSearchResults) {
            const userId = result.fields.user_id;
            planResults[userId] = { planSimScore: result.score };
          }
        } catch (error) {
          logger.warn(
            `Failed to get plan similarities from Pinecone for plan ${userPlan.id}:`,
            error
          );
        }

        // Merge base similarities with plan-specific similarities and create recommendations
        for (const targetUserId of userIds) {
          const scores = {
            planSimScore: planResults[targetUserId]?.planSimScore ?? 0,
            geoSimScore: baseSimilarities[targetUserId]?.geoSimScore ?? 0,
            ageSimScore: baseSimilarities[targetUserId]?.ageSimScore ?? 0,
            activityConsistencyScore:
              baseSimilarities[targetUserId]?.activityConsistencyScore ?? 0,
          };

          const finalScore =
            scores.planSimScore * PLAN_SIM_WEIGHT +
            scores.activityConsistencyScore * ACTIVITY_CONSISTENCY_WEIGHT +
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
                  activityConsistencyScore: scores.activityConsistencyScore,
                  activityConsistencyWeight: ACTIVITY_CONSISTENCY_WEIGHT,
                },
              },
            });
            results[targetUserId] = {
              planSimScore: scores.planSimScore,
              geoSimScore: scores.geoSimScore,
              ageSimScore: scores.ageSimScore,
              activityConsistencyScore: scores.activityConsistencyScore,
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

  /**
   * Get readable plan text for embedding
   */
  async getReadablePlan(planId: string): Promise<string> {
    try {
      const plan = await prisma.plan.findUnique({
        where: { id: planId },
        include: {
          activities: true,
          sessions: {
            where: {
              date: {
                gte: new Date(),
              },
            },
            take: 10,
            orderBy: { date: "asc" },
          },
        },
      });

      if (!plan) {
        return "";
      }

      const activityNames = plan.activities.map((a) => a.title);
      return `${plan.goal} (${activityNames.join(", ")})`;
    } catch (error) {
      logger.error("Error generating readable plan:", error);
      return "";
    }
  }

  /**
   * Force reset all plan embeddings in Pinecone
   * Deletes all existing embeddings and recreates them from active plans in the database
   */
  async forceResetPlanEmbeddings(): Promise<{
    total_plans: number;
    embeddings_created: number;
    failures: number;
  }> {
    try {
      logger.info("Starting force reset of plan embeddings");

      // Get all active plans from database
      const allPlans = await prisma.plan.findMany({
        where: {
          deletedAt: null,
          OR: [{ finishingDate: null }, { finishingDate: { gt: new Date() } }],
        },
        select: {
          id: true,
          userId: true,
          goal: true,
        },
      });

      logger.info(
        `Found ${allPlans.length} active plans to recreate embeddings`
      );

      // Delete all existing plan embeddings by their IDs
      const planIds = allPlans.map((p) => p.id);
      if (planIds.length > 0) {
        await plansPineconeService.deleteRecords(planIds);
        logger.info(`Deleted ${planIds.length} plan embeddings from Pinecone`);
      }

      // Build records for batch upsert
      const recordsToUpsert: Array<{
        text: string;
        identifier: string;
        metadata: { user_id: string };
      }> = [];
      let failureCount = 0;

      for (const plan of allPlans) {
        try {
          const readablePlan = await this.getReadablePlan(plan.id);
          if (readablePlan) {
            recordsToUpsert.push({
              text: readablePlan,
              identifier: plan.id,
              metadata: { user_id: plan.userId },
            });
          } else {
            failureCount++;
            logger.warn(`Skipped plan ${plan.id} - no readable text generated`);
          }
        } catch (error) {
          logger.error(
            `Failed to create embedding for plan ${plan.id}:`,
            error
          );
          failureCount++;
        }
      }

      // Batch upsert records in chunks of 96 (Pinecone max batch size)
      let successCount = 0;
      const BATCH_SIZE = 96;

      if (recordsToUpsert.length > 0) {
        for (let i = 0; i < recordsToUpsert.length; i += BATCH_SIZE) {
          const batch = recordsToUpsert.slice(i, i + BATCH_SIZE);
          try {
            await plansPineconeService.upsertRecords(batch);
            successCount += batch.length;
            logger.info(
              `Upserted batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(recordsToUpsert.length / BATCH_SIZE)} (${batch.length} records)`
            );
          } catch (error) {
            logger.error(
              `Failed to upsert batch starting at index ${i}:`,
              error
            );
            throw error;
          }
        }
      }

      const result = {
        total_plans: allPlans.length,
        embeddings_created: successCount,
        failures: failureCount,
      };

      logger.info(
        `Force reset completed: ${successCount} embeddings created, ${failureCount} failures`
      );

      return result;
    } catch (error) {
      logger.error("Error during force reset of plan embeddings:", error);
      throw error;
    }
  }
}

export const recommendationsService = new RecommendationsService();
export default recommendationsService;
