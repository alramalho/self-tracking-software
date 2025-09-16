import { Response, Router } from "express";
import { Prisma } from "@tsw/prisma";

import { AuthenticatedRequest, requireAuth } from "@/middleware/auth";
import { logger } from "../utils/logger";
import { prisma } from "../utils/prisma";
import { todaysLocalDate, toMidnightUTCDate } from "../utils/date";

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
  async (req: AuthenticatedRequest, res: Response) => {
    const { title, emoji } = req.body as { title?: string; emoji?: string };

    if (!title || !emoji) {
      return res.status(400).json({ error: "Title and emoji are required" });
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
        return res
          .status(400)
          .json({
            error: `A metric with this name '${title}' already exists`,
          });
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

// Upsert metric entry for a specific date
router.post(
  "/entries",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    const {
      metricId,
      rating,
      date,
      description,
      skipped,
      descriptionSkipped,
    } = req.body as {
      metricId?: string;
      rating?: number;
      date?: string;
      description?: string;
      skipped?: boolean;
      descriptionSkipped?: boolean;
    };

    if (!metricId) {
      return res.status(400).json({ error: "Metric ID is required" });
    }

    try {
      const metric = await prisma.metric.findFirst({
        where: {
          id: metricId,
          userId: req.user!.id,
        },
      });

      if (!metric) {
        return res.status(404).json({ error: "Metric not found" });
      }

      let entryDate = todaysLocalDate();
      if (date) {
        const parsedDate = new Date(date);
        if (Number.isNaN(parsedDate.getTime())) {
          return res.status(400).json({ error: "Invalid date provided" });
        }
        entryDate = toMidnightUTCDate(parsedDate);
      }

      const existingEntry = await prisma.metricEntry.findFirst({
        where: {
          metricId,
          userId: req.user!.id,
          date: entryDate,
        },
      });

      const updateData: Prisma.MetricEntryUpdateInput = {};
      if (rating !== undefined) updateData.rating = rating;
      if (description !== undefined) updateData.description = description;
      if (skipped !== undefined) updateData.skipped = skipped;
      if (descriptionSkipped !== undefined)
        updateData.descriptionSkipped = descriptionSkipped;

      let entry;

      if (existingEntry) {
        entry = await prisma.metricEntry.update({
          where: { id: existingEntry.id },
          data: updateData,
        });
      } else {
        entry = await prisma.metricEntry.create({
          data: {
            userId: req.user!.id,
            metricId,
            rating: rating ?? 0,
            date: entryDate,
            description,
            skipped: skipped ?? false,
            descriptionSkipped: descriptionSkipped ?? false,
          },
        });
      }

      res.json(entry);
    } catch (error) {
      logger.error("Error upserting metric entry:", error);
      res.status(500).json({ error: "Failed to upsert metric entry" });
    }
  }
);

// Update today's note (description/skip flag) for all entries of the user
router.patch(
  "/entries/today-note",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    const { note, skip } = req.body as { note?: string; skip?: boolean };

    try {
      const today = todaysLocalDate();

      const todaysEntries = await prisma.metricEntry.findMany({
        where: {
          userId: req.user!.id,
          date: today,
        },
      });

      if (todaysEntries.length === 0) {
        return res
          .status(404)
          .json({ error: "No metric entries found for today" });
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
          date: today,
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
      const metric = await prisma.metric.findUnique({ where: { id: metricId } });

      if (!metric || metric.userId !== req.user!.id) {
        return res.status(404).json({ error: "Metric not found" });
      }

      await prisma.metric.delete({ where: { id: metricId } });

      res.json({ message: "Metric deleted successfully" });
    } catch (error) {
      logger.error("Error deleting metric:", error);
      res.status(500).json({ error: "Failed to delete metric" });
    }
  }
);

export const metricsRouter = router;
export default metricsRouter;
