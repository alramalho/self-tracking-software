import { Response, Router } from "express";

import { AuthenticatedRequest, requireAuth } from "@/middleware/auth";
import { appleHealthSyncBatchSchema } from "@/services/health/apple/schemas";
import {
  applyWorkoutReconciliations,
  getWorkoutReconciliationPreview,
  WorkoutReconciliationError,
} from "@/services/health/apple/reconciliation/service";
import { workoutReconciliationRequestSchema } from "@/services/health/apple/reconciliation/schemas";
import {
  disconnectAppleHealth,
  getAppleHealthStatus,
  markAppleHealthSyncFailed,
  syncAppleHealthBatch,
} from "@/services/health/apple/syncService";
import type { AppleHealthSyncBatch } from "@/services/health/apple/types";
import { logger } from "@/utils/logger";

const router = Router();

router.get(
  "/apple/status",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      res.json(await getAppleHealthStatus(req.user!.id));
    } catch (error) {
      logger.error("Failed to read Apple Health status", error);
      res.status(500).json({ error: "Failed to read Apple Health status" });
    }
  },
);

router.post(
  "/apple/sync",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const parsed = appleHealthSyncBatchSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    try {
      const counts = await syncAppleHealthBatch(
        req.user!.id,
        parsed.data as AppleHealthSyncBatch,
      );
      logger.info("Apple Health sync batch imported", {
        userId: req.user!.id,
        counts,
        isFinalBatch: parsed.data.isFinalBatch,
      });
      res.json({ counts });
    } catch (error) {
      await markAppleHealthSyncFailed(
        req.user!.id,
        parsed.data.deviceId,
        error,
      ).catch(() => undefined);
      logger.error("Failed to import Apple Health sync batch", {
        userId: req.user!.id,
        error,
      });
      res.status(500).json({ error: "Failed to import Apple Health data" });
    }
  },
);

router.get(
  "/apple/workouts/reconciliation-preview",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      res.json(await getWorkoutReconciliationPreview(req.user!.id));
    } catch (error) {
      logger.error("Failed to preview Apple Health workout reconciliation", {
        userId: req.user!.id,
        error,
      });
      res.status(500).json({
        error: "Failed to preview Apple Health workout reconciliation",
      });
    }
  },
);

router.post(
  "/apple/workouts/reconcile",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const parsed = workoutReconciliationRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    try {
      res.json(
        await applyWorkoutReconciliations(req.user!.id, parsed.data.decisions),
      );
    } catch (error) {
      if (error instanceof WorkoutReconciliationError) {
        res.status(400).json({ error: error.message });
        return;
      }
      logger.error("Failed to reconcile Apple Health workouts", {
        userId: req.user!.id,
        error,
      });
      res.status(500).json({
        error: "Failed to reconcile Apple Health workouts",
      });
    }
  },
);

router.delete(
  "/apple",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const deleteImportedData = req.query.deleteData === "true";

    try {
      await disconnectAppleHealth(req.user!.id, deleteImportedData);
      res.status(204).send();
    } catch (error) {
      logger.error("Failed to disconnect Apple Health", {
        userId: req.user!.id,
        error,
      });
      res.status(500).json({ error: "Failed to disconnect Apple Health" });
    }
  },
);

export const healthRouter: Router = router;
