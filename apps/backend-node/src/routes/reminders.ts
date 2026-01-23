import { Response, Router } from "express";
import { AuthenticatedRequest, requireAuth } from "../middleware/auth";
import { logger } from "../utils/logger";
import { prisma } from "../utils/prisma";

const router = Router();

// Get all reminders for the current user
router.get(
  "/",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response | void> => {
    try {
      const user = req.user!;

      const reminders = await prisma.reminder.findMany({
        where: {
          userId: user.id,
          status: { not: "CANCELLED" },
        },
        orderBy: { triggerAt: "asc" },
      });

      logger.info(`Fetched ${reminders.length} reminders for user ${user.username}`);

      res.json({ reminders });
    } catch (error) {
      logger.error("Error fetching reminders:", error);
      res.status(500).json({ error: "Failed to fetch reminders" });
    }
  }
);

// Delete (cancel) a reminder
router.delete(
  "/:reminderId",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response | void> => {
    try {
      const user = req.user!;
      const { reminderId } = req.params;

      // Verify the reminder belongs to the user
      const reminder = await prisma.reminder.findFirst({
        where: {
          id: reminderId,
          userId: user.id,
        },
      });

      if (!reminder) {
        return res.status(404).json({ error: "Reminder not found" });
      }

      // Cancel the reminder (soft delete)
      await prisma.reminder.update({
        where: { id: reminderId },
        data: { status: "CANCELLED" },
      });

      logger.info(`Cancelled reminder ${reminderId} for user ${user.username}`);

      res.json({ success: true });
    } catch (error) {
      logger.error("Error deleting reminder:", error);
      res.status(500).json({ error: "Failed to delete reminder" });
    }
  }
);

export const remindersRouter: Router = router;
export default remindersRouter;
