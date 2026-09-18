import { Router, type Response } from "express";
import { z } from "zod/v4";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth";
import {
  circles,
  circleDetail,
  createCircle,
  joinCircle,
  shareLog,
  unshareLog,
  leaveCircle,
} from "../services/follow-through/circles/service";
import { logger } from "../utils/logger";
const router: Router = Router();
type Operation = (req: AuthenticatedRequest, res: Response) => Promise<unknown>;
const handle =
  (fn: Operation) => async (req: AuthenticatedRequest, res: Response) => {
    try {
      await fn(req, res);
    } catch (error) {
      logger.warn("Circle request failed", { error });
      const message =
        error instanceof z.ZodError
          ? error.issues[0]?.message
          : error instanceof Error &&
              /^(Choose|Circle not found|This circle|Join this)/.test(
                error.message,
              )
            ? error.message
            : "Could not update this circle. Please retry.";
      res.status(400).json({ error: message });
    }
  };
router.use(requireAuth);
router.get(
  "/",
  handle(async (req, res) =>
    res.json(
      await circles(
        req.user!.id,
        z
          .string()
          .max(100)
          .parse(req.query.search || ""),
      ),
    ),
  ),
);
router.post(
  "/",
  handle(async (req, res) => {
    const body = z
      .object({
        name: z.string().trim().min(1).max(80),
        topic: z.string().trim().min(1).max(120),
        planId: z.string().min(1),
        discoverable: z.boolean(),
      })
      .parse(req.body);
    return res.json(
      await createCircle(
        req.user!.id,
        body.name,
        body.topic,
        body.planId,
        body.discoverable,
      ),
    );
  }),
);
router.post(
  "/join",
  handle(async (req, res) => {
    const body = z
      .object({
        id: z.string().optional(),
        inviteCode: z.string().uuid().optional(),
        planId: z.string().min(1),
      })
      .refine((b) => !!b.id || !!b.inviteCode)
      .parse(req.body);
    return res.json(
      await joinCircle(req.user!.id, body.planId, body.id, body.inviteCode),
    );
  }),
);
router.get(
  "/:id",
  handle(async (req, res) =>
    res.json(await circleDetail(req.user!.id, req.params.id)),
  ),
);
router.post(
  "/:id/logs",
  handle(async (req, res) => {
    const { entryId } = z
      .object({ entryId: z.string().min(1) })
      .parse(req.body);
    return res.json(await shareLog(req.user!.id, req.params.id, entryId));
  }),
);
router.delete(
  "/:id/logs/:postId",
  handle(async (req, res) => {
    await unshareLog(req.user!.id, req.params.id, req.params.postId);
    res.sendStatus(204);
  }),
);
router.delete(
  "/:id/membership",
  handle(async (req, res) => {
    await leaveCircle(req.user!.id, req.params.id);
    res.sendStatus(204);
  }),
);
export const circlesRouter: Router = router;
