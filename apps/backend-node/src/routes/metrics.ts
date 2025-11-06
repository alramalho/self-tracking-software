import { Prisma } from "@tsw/prisma";
import { Response, Router } from "express";

import { AuthenticatedRequest, requireAuth } from "@/middleware/auth";
import { todaysLocalDate, toMidnightUTCDate } from "../utils/date";
import { logger } from "../utils/logger";
import { prisma } from "../utils/prisma";

const router = Router();

// Fetch metrics for the authenticated user
router.get(
  "/",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const metrics = await prisma.metric.findMany({
        where: { userId: req.user!.id },
        orderBy: { createdAt: "desc" },
      });

      res.json(metrics);
    } catch (error) {
      logger.error("Error fetching metrics:", error);
      res.status(500).json({ error: "Failed to fetch metrics" });
    }
  }
);

// Fetch metric entries for the authenticated user
router.get(
  "/entries",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const entries = await prisma.metricEntry.findMany({
        where: { userId: req.user!.id },
        orderBy: { createdAt: "desc" },
      });

      res.json(entries);
    } catch (error) {
      logger.error("Error fetching metric entries:", error);
      res.status(500).json({ error: "Failed to fetch metric entries" });
    }
  }
);

// Create a new metric for the user (with case-insensitive title uniqueness)
router.post(
  "/",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { title, emoji } = req.body as { title?: string; emoji?: string };

    if (!title || !emoji) {
      res.status(400).json({ error: "Title and emoji are required" });
      return;
    }

    try {
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
        res.status(400).json({
          error: `A metric with this name '${title}' already exists`,
        });
        return;
      }

      const metric = await prisma.metric.create({
        data: {
          userId: req.user!.id,
          title,
          emoji,
        },
      });

      res.status(201).json(metric);
    } catch (error) {
      logger.error("Error creating metric:", error);
      res.status(500).json({ error: "Failed to create metric" });
    }
  }
);

// Create a new metric entry (allows multiple entries per day)
router.post(
  "/entries",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { metricId, rating, date, description, skipped, descriptionSkipped } =
      req.body as {
        metricId?: string;
        rating?: number;
        date?: string;
        description?: string;
        skipped?: boolean;
        descriptionSkipped?: boolean;
      };

    if (!metricId) {
      res.status(400).json({ error: "Metric ID is required" });
      return;
    }

    try {
      const metric = await prisma.metric.findFirst({
        where: {
          id: metricId,
          userId: req.user!.id,
        },
      });

      if (!metric) {
        res.status(404).json({ error: "Metric not found" });
        return;
      }

      let entryDate = todaysLocalDate();
      if (date) {
        const parsedDate = new Date(date);
        if (Number.isNaN(parsedDate.getTime())) {
          res.status(400).json({ error: "Invalid date provided" });
          return;
        }
        entryDate = toMidnightUTCDate(parsedDate);
      }

      // Always create a new entry (allow multiple per day)
      const entry = await prisma.metricEntry.create({
        data: {
          userId: req.user!.id,
          metricId,
          rating: rating ?? 0,
          createdAt: entryDate,
          description,
          skipped: skipped ?? false,
          descriptionSkipped: descriptionSkipped ?? false,
        },
      });

      res.json(entry);
    } catch (error) {
      logger.error("Error creating metric entry:", error);
      res.status(500).json({ error: "Failed to create metric entry" });
    }
  }
);

// Update today's note (description/skip flag) for all entries of the user
router.patch(
  "/entries/today-note",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { note, skip } = req.body as { note?: string; skip?: boolean };

    try {
      const today = todaysLocalDate();

      const todaysEntries = await prisma.metricEntry.findMany({
        where: {
          userId: req.user!.id,
          createdAt: today,
        },
      });

      if (todaysEntries.length === 0) {
        res.status(404).json({ error: "No metric entries found for today" });
        return;
      }

      const data: Prisma.MetricEntryUpdateManyMutationInput = {};
      if (note !== undefined) {
        data.description = note;
      }
      if (skip !== undefined) {
        data.descriptionSkipped = skip;
      }

      const result = await prisma.metricEntry.updateMany({
        where: {
          userId: req.user!.id,
          createdAt: today,
        },
        data,
      });

      res.json(result);
    } catch (error) {
      logger.error("Error updating today's note:", error);
      res.status(500).json({ error: "Failed to update today's note" });
    }
  }
);

// Delete a metric owned by the user
router.delete(
  "/:metricId",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    const { metricId } = req.params;

    try {
      const metric = await prisma.metric.findUnique({
        where: { id: metricId },
      });

      if (!metric || metric.userId !== req.user!.id) {
        res.status(404).json({ error: "Metric not found" });
        return;
      }

      await prisma.metric.delete({ where: { id: metricId } });

      res.json({ message: "Metric deleted successfully" });
    } catch (error) {
      logger.error("Error deleting metric:", error);
      res.status(500).json({ error: "Failed to delete metric" });
    }
  }
);

export const metricsRouter: Router = router;
export default metricsRouter;
