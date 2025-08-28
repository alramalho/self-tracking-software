import { Response, Router } from "express";
import { AuthenticatedRequest, requireAuth } from "../middleware/auth";
import { logger } from "../utils/logger";
import { prisma } from "../utils/prisma";

const router = Router();

// Get all metrics for the current user
router.get(
  "/",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const metrics = await prisma.metric.findMany({
        where: { userId: req.user!.id },
        orderBy: { createdAt: "desc" },
      });

      logger.info(
        `Retrieved ${metrics.length} metrics for user ${req.user!.id}`
      );

      res.json(metrics);
    } catch (error) {
      logger.error("Error getting metrics:", error);
      res.status(500).json({ error: "Failed to get metrics" });
    }
  }
);

// Create a new metric
router.post(
  "/",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response | void> => {
    try {
      const { title, emoji } = req.body;

      if (!title || !emoji) {
        return res.status(400).json({ error: "title and emoji are required" });
      }

      // Check if metric with same name already exists
      const existingMetric = await prisma.metric.findFirst({
        where: {
          userId: req.user!.id,
          title: {
            equals: title,
            mode: "insensitive",
          },
        },
      });

      if (existingMetric) {
        return res.status(409).json({
          error: `A metric with this name '${title}' already exists`,
        });
      }

      const newMetric = await prisma.metric.create({
        data: {
          userId: req.user!.id,
          title,
          emoji,
        },
      });

      logger.info(`Created metric ${newMetric.id} for user ${req.user!.id}`);
      res.status(201).json(newMetric);
    } catch (error) {
      logger.error("Error creating metric:", error);
      res.status(500).json({ error: "Failed to create metric" });
    }
  }
);

// Log a metric rating
router.post(
  "/log-metric",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response | void> => {
    try {
      const {
        metric_id,
        rating,
        date,
        description,
        skipped = false,
        description_skipped = false,
      } = req.body;

      if (!metric_id) {
        return res.status(400).json({ error: "metric_id is required" });
      }

      const entryDate = date || new Date().toISOString().split("T")[0]; // YYYY-MM-DD format

      // Check if an entry already exists for this date
      const existingEntry = await prisma.metricEntry.findFirst({
        where: {
          metricId: metric_id,
          date: entryDate,
        },
      });

      let result;
      if (existingEntry) {
        // Update existing entry
        const updateData: any = {};
        if (rating !== undefined) updateData.rating = rating;
        if (description !== undefined) updateData.description = description;
        if (skipped !== undefined) updateData.skipped = skipped;
        if (description_skipped !== undefined)
          updateData.descriptionSkipped = description_skipped;

        result = await prisma.metricEntry.update({
          where: { id: existingEntry.id },
          data: updateData,
        });
        logger.info(`Updated metric entry ${existingEntry.id}`);
      } else {
        // Create new entry
        result = await prisma.metricEntry.create({
          data: {
            userId: req.user!.id,
            metricId: metric_id,
            rating: rating || 0,
            date: entryDate,
            description,
            skipped,
            descriptionSkipped: description_skipped,
          },
        });
        logger.info(`Created metric entry ${result.id}`);
      }

      res.json(result);
    } catch (error) {
      logger.error("Error logging metric:", error);
      res.status(500).json({ error: "Failed to log metric" });
    }
  }
);

// Skip a metric for a specific date
router.post(
  "/skip-metric",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response | void> => {
    try {
      const { metric_id, date, description_skipped = false } = req.body;

      if (!metric_id) {
        return res.status(400).json({ error: "metric_id is required" });
      }

      const entryDate = date || new Date().toISOString().split("T")[0]; // YYYY-MM-DD format

      // Check if an entry already exists for this date
      const existingEntry = await prisma.metricEntry.findFirst({
        where: {
          metricId: metric_id,
          date: entryDate,
        },
      });

      let result;
      if (existingEntry) {
        // Update existing entry to mark as skipped
        result = await prisma.metricEntry.update({
          where: { id: existingEntry.id },
          data: {
            skipped: true,
            descriptionSkipped: description_skipped,
          },
        });
        logger.info(`Updated metric entry ${existingEntry.id} to skipped`);
      } else {
        // Create new skipped entry
        result = await prisma.metricEntry.create({
          data: {
            userId: req.user!.id,
            metricId: metric_id,
            rating: 0, // Default rating for skipped metrics
            date: entryDate,
            skipped: true,
            descriptionSkipped: description_skipped,
          },
        });
        logger.info(`Created skipped metric entry ${result.id}`);
      }

      res.json(result);
    } catch (error) {
      logger.error("Error skipping metric:", error);
      res.status(500).json({ error: "Failed to skip metric" });
    }
  }
);

// Get metric entries, optionally filtered by metric_id
router.get(
  "/metric-entries",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response | void> => {
    try {
      const { metric_id } = req.query;

      let metricEntries;
      if (metric_id) {
        metricEntries = await prisma.metricEntry.findMany({
          where: { metricId: metric_id as string },
          orderBy: { date: "desc" },
        });
      } else {
        metricEntries = await prisma.metricEntry.findMany({
          where: { userId: req.user!.id },
          orderBy: { date: "desc" },
        });
      }

      logger.info(
        `Retrieved ${metricEntries.length} metric entries for user ${req.user!.id}`
      );
      res.json(metricEntries);
    } catch (error) {
      logger.error("Error getting metric entries:", error);
      res.status(500).json({ error: "Failed to get metric entries" });
    }
  }
);

// Delete a metric and all its entries
router.delete(
  "/metrics/:metricId",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response | void> => {
    try {
      const { metricId } = req.params;

      // Verify ownership
      const metric = await prisma.metric.findUnique({
        where: { id: metricId },
      });

      if (!metric) {
        return res.status(404).json({ error: "Metric not found" });
      }

      if (metric.userId !== req.user!.id) {
        return res
          .status(403)
          .json({ error: "Not authorized to delete this metric" });
      }

      // Delete metric (entries will be cascade deleted)
      await prisma.metric.delete({
        where: { id: metricId },
      });

      logger.info(`Deleted metric ${metricId} for user ${req.user!.id}`);
      res.json({ message: "Metric deleted successfully" });
    } catch (error) {
      logger.error("Error deleting metric:", error);
      res.status(500).json({ error: "Failed to delete metric" });
    }
  }
);

// Add a note to all of today's metric entries
router.post(
  "/log-todays-note",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response | void> => {
    try {
      const { note } = req.body;
      const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD format

      if (!note) {
        return res.status(400).json({ error: "note is required" });
      }

      // Get all metric entries for today
      const todaysEntries = await prisma.metricEntry.findMany({
        where: {
          userId: req.user!.id,
          date: new Date(today),
        },
      });

      if (todaysEntries.length === 0) {
        return res
          .status(404)
          .json({ error: "No metric entries found for today" });
      }

      // Update all today's entries with the note
      const updateResult = await prisma.metricEntry.updateMany({
        where: {
          userId: req.user!.id,
          date: new Date(today),
        },
        data: {
          description: note,
        },
      });

      logger.info(
        `Added note to ${updateResult.count} metric entries for user ${req.user!.id}`
      );

      res.json({
        message: "Note added to today's entries successfully",
        entries_updated: updateResult.count,
      });
    } catch (error) {
      logger.error("Error logging today's note:", error);
      res.status(500).json({ error: "Failed to log today's note" });
    }
  }
);

// Skip adding a note to today's metric entries
router.post(
  "/skip-todays-note",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response | void> => {
    try {
      const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD format

      // Get all metric entries for today
      const todaysEntries = await prisma.metricEntry.findMany({
        where: {
          userId: req.user!.id,
          date: new Date(today),
        },
      });

      if (todaysEntries.length === 0) {
        return res
          .status(404)
          .json({ error: "No metric entries found for today" });
      }

      // Update all today's entries to mark description as skipped
      const updateResult = await prisma.metricEntry.updateMany({
        where: {
          userId: req.user!.id,
          date: new Date(today),
        },
        data: {
          descriptionSkipped: true,
        },
      });

      logger.info(
        `Marked ${updateResult.count} metric entries as description skipped for user ${req.user!.id}`
      );

      res.json({
        message: "Today's note skipped successfully",
        entries_updated: updateResult.count,
      });
    } catch (error) {
      logger.error("Error skipping today's note:", error);
      res.status(500).json({ error: "Failed to skip today's note" });
    }
  }
);

export const metricsRouter: Router = router;
export default metricsRouter;
