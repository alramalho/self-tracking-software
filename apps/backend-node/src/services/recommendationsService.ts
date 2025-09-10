import { Plan, Recommendation, User } from "@tsw/prisma";
import { logger } from "../utils/logger";
import { prisma } from "../utils/prisma";
import { plansPineconeService } from "./pineconeService";
import { userService } from "./userService";

export interface RecommendationScore {
  planSimScore?: number;
  geoSimScore?: number;
  ageSimScore?: number;
  recentActivityScore?: number;
  finalScore: number;
}

export interface RecommendedUsersResponse {
  recommendations: Recommendation[];
  users: Partial<User>[];
  plans: Plan[];
}

const PLAN_SIM_WEIGHT = 0.33;
const RECENT_ACTIVITY_WEIGHT = 0.33;
const GEO_SIM_WEIGHT = 0.1666;
const AGE_SIM_WEIGHT = 0.1666;

/**
 * Calculate age similarity using exponential decay
 */
function calculateAgeSimilarity(age1: number, age2: number): number {
  const k = 2;
  return Math.exp(-k * Math.pow(Math.log(age1 / age2), 2));
}

/**
 * Calculate recency similarity using hyperbolic tangent fit
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
    currentUserId: string
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

      // Get all users looking for accountability partners
      const usersLookingForPartners = await prisma.user.findMany({
        where: {
          lookingForAp: true,
          id: { not: currentUserId },
          AND: [
            { email: { not: { startsWith: "alexandre.ramalho.1998+" } } },
            { email: { not: { startsWith: "lia.borges+" } } },
          ],
        },
      });

      if (usersLookingForPartners.length === 0) {
        logger.info("No users looking for accountability partners found");
        return {};
      }

      const results: Record<string, any> = {};
      const userIds = usersLookingForPartners.map((u) => u.id);

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

      // Calculate plan similarity using Pinecone
      const userPlans = await prisma.plan.findMany({
        where: {
          userId: currentUserId,
          deletedAt: null,
        },
        orderBy: { sortOrder: "asc" },
        take: 1,
      });

      if (userPlans.length > 0) {
        try {
          const planSearchResults = await plansPineconeService.query(
            userPlans[0].goal,
            50,
            { user_id: { $in: userIds } }
          );

          for (const result of planSearchResults) {
            const userId = result.fields.user_id;
            if (!results[userId]) results[userId] = {};
            results[userId].planSimScore = result.score;
          }
        } catch (error) {
          logger.warn("Failed to get plan similarities from Pinecone:", error);
        }
      }

      // Calculate other similarities
      for (const targetUser of usersLookingForPartners) {
        if (!results[targetUser.id]) results[targetUser.id] = {};

        // Geographic similarity
        if (currentUser.timezone && targetUser.timezone) {
          results[targetUser.id].geoSimScore = await calculateGeoSimilarity(
            currentUser.timezone,
            targetUser.timezone
          );
        }

        // Age similarity
        if (currentUser.age && targetUser.age) {
          results[targetUser.id].ageSimScore = calculateAgeSimilarity(
            currentUser.age,
            targetUser.age
          );
        }

        // Recent activity similarity
        results[targetUser.id].recentActivityScore = calculateRecencySimilarity(
          targetUser.lastActiveAt || targetUser.createdAt
        );
      }

      // Calculate final scores and create recommendations
      for (const [targetUserId, scores] of Object.entries(results)) {
        const finalScore =
          (scores.planSimScore || 0) * PLAN_SIM_WEIGHT +
          (scores.recentActivityScore || 0) * RECENT_ACTIVITY_WEIGHT +
          (scores.geoSimScore || 0) * GEO_SIM_WEIGHT +
          (scores.ageSimScore || 0) * AGE_SIM_WEIGHT;

        // Only create recommendations above a minimum threshold
        if (finalScore > 0.1) {
          await prisma.recommendation.create({
            data: {
              userId: currentUserId,
              recommendationObjectType: "USER",
              recommendationObjectId: targetUserId,
              score: finalScore,
              metadata: {
                planSimScore: scores.planSimScore,
                planSimWeight: PLAN_SIM_WEIGHT,
                geoSimScore: scores.geoSimScore,
                geoSimWeight: GEO_SIM_WEIGHT,
                ageSimScore: scores.ageSimScore,
                ageSimWeight: AGE_SIM_WEIGHT,
                recentActivityScore: scores.recentActivityScore,
                recentActivityWeight: RECENT_ACTIVITY_WEIGHT,
              },
            },
          });
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
      const currentDate = new Date();
      const planAge = Math.floor(
        (currentDate.getTime() - plan.createdAt.getTime()) /
          (1000 * 60 * 60 * 24 * 7)
      );

      // Get current week's activity entries (simplified - would need proper week calculation)
      const weekStart = new Date(currentDate);
      weekStart.setDate(currentDate.getDate() - currentDate.getDay());

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);

      // This is a simplified version - in production you'd want proper activity tracking
      const activitiesStr = activityNames.join("', '");
      const plannedCount = plan.timesPerWeek || plan.sessions.length;

      return `'${plan.goal}' is ${planAge} weeks old - with activities '${activitiesStr}'. This week the user had planned ${plannedCount} activities`;
    } catch (error) {
      logger.error("Error generating readable plan:", error);
      return "";
    }
  }
}

export const recommendationsService = new RecommendationsService();
export default recommendationsService;
