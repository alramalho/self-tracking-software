import { Response, Router } from "express";
import { z } from "zod";

import { AuthenticatedRequest, requireAuth } from "../middleware/auth";
import { logger } from "../utils/logger";
import { prisma } from "../utils/prisma";

const router = Router();

const sourceSchema = z.enum([
  "USER_REPORTED",
  "COACH_INFERRED",
  "USER_CONFIRMED",
]);

const nullableDateSchema = z
  .string()
  .datetime()
  .nullable()
  .optional()
  .transform((value) => (value ? new Date(value) : value));

const createContextEventSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).nullable().optional(),
  occurredAt: nullableDateSchema,
  endedAt: nullableDateSchema,
  source: sourceSchema.optional(),
  sourceMessageId: z.string().trim().min(1).nullable().optional(),
  confidence: z.number().min(0).max(1).nullable().optional(),
});

const updateContextEventSchema = createContextEventSchema.partial();

router.get(
  "/",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const events = await prisma.userContextEvent.findMany({
        where: {
          userId: req.user!.id,
          deletedAt: null,
        },
        orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
      });

      res.json({ events });
    } catch (error) {
      logger.error("Error fetching context events:", error);
      res.status(500).json({ error: "Failed to fetch context events" });
    }
  }
);

router.post(
  "/",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const parsed = createContextEventSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    try {
      const event = await prisma.userContextEvent.create({
        data: {
          userId: req.user!.id,
          title: parsed.data.title,
          description: parsed.data.description ?? null,
          occurredAt: parsed.data.occurredAt ?? null,
          endedAt: parsed.data.endedAt ?? null,
          source: parsed.data.source ?? "USER_REPORTED",
          sourceMessageId: parsed.data.sourceMessageId ?? null,
          confidence: parsed.data.confidence ?? null,
        },
      });

      res.status(201).json({ event });
    } catch (error) {
      logger.error("Error creating context event:", error);
      res.status(500).json({ error: "Failed to create context event" });
    }
  }
);

router.patch(
  "/:eventId",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const parsed = updateContextEventSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    try {
      const existing = await prisma.userContextEvent.findFirst({
        where: {
          id: req.params.eventId,
          userId: req.user!.id,
          deletedAt: null,
        },
      });

      if (!existing) {
        res.status(404).json({ error: "Context event not found" });
        return;
      }

      const event = await prisma.userContextEvent.update({
        where: { id: existing.id },
        data: parsed.data,
      });

      res.json({ event });
    } catch (error) {
      logger.error("Error updating context event:", error);
      res.status(500).json({ error: "Failed to update context event" });
    }
  }
);

router.delete(
  "/:eventId",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const existing = await prisma.userContextEvent.findFirst({
        where: {
          id: req.params.eventId,
          userId: req.user!.id,
          deletedAt: null,
        },
      });

      if (!existing) {
        res.status(404).json({ error: "Context event not found" });
        return;
      }

      await prisma.userContextEvent.update({
        where: { id: existing.id },
        data: { deletedAt: new Date() },
      });

      res.json({ success: true });
    } catch (error) {
      logger.error("Error deleting context event:", error);
      res.status(500).json({ error: "Failed to delete context event" });
    }
  }
);

export const contextEventsRouter: Router = router;
export default contextEventsRouter;
