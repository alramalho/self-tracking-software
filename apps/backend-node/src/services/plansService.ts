import { logger } from "../utils/logger";
import { prisma } from "../utils/prisma";

export class PlansService {
  async getUserFirstPlan(userId: string) {
    try {
      const plans = await prisma.plan.findMany({
        where: {
          userId,
          deletedAt: null,
        },
        include: {
          sessions: {
            include: {
              activity: true,
            },
          },
          activities: true,
        },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      });

      return plans.length > 0 ? plans[0] : null;
    } catch (error) {
      logger.error("Error getting user's first plan:", error);
      throw error;
    }
  }

  async recalculateCurrentWeekState(
    planId: string,
    userId: string
  ): Promise<void> {
    try {
      // This is a simplified version of the Python recalculate_current_week_state
      // In a full implementation, this would:
      // 1. Calculate which week of the plan we're in
      // 2. Check session completion status
      // 3. Update plan progress/state fields

      const plan = await prisma.plan.findUnique({
        where: { id: planId },
        include: {
          sessions: true,
        },
      });

      if (!plan || plan.userId !== userId) {
        throw new Error("Plan not found or not authorized");
      }

      // Calculate basic progress
      const totalSessions = plan.sessions.length;
      // Note: PlanSession model doesn't have a completedAt field yet
      // This would need to be implemented when session completion tracking is added
      const completedSessions = 0; // Placeholder until completion tracking is implemented
      const progressPercentage =
        totalSessions > 0
          ? Math.round((completedSessions / totalSessions) * 100)
          : 0;

      // Calculate current week (simplified)
      const planStartDate = plan.createdAt;
      const daysSinceStart = Math.floor(
        (Date.now() - planStartDate.getTime()) / (24 * 60 * 60 * 1000)
      );
      const currentWeek = Math.ceil(daysSinceStart / 7);

      logger.info(
        `Recalculated plan ${planId} state: ${progressPercentage}% complete, week ${currentWeek}`
      );

      // In a full implementation, you might update plan fields here:
      // await prisma.plan.update({
      //   where: { id: planId },
      //   data: {
      //     currentWeek,
      //     progressPercentage,
      //     lastRecalculatedAt: new Date()
      //   }
      // });
    } catch (error) {
      logger.error("Error recalculating plan week state:", error);
      throw error;
    }
  }
}

export const plansService = new PlansService();
