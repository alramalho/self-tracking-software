import { Router, type Response } from "express";
import { z } from "zod/v4";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth";
import { circleBoard, circleFeed } from "../services/circles/board/service";
import { CircleError } from "../services/circles/errors";
import { matchPlan, searchCircles, suggestions } from "../services/circles/matching/service";
import { nudge } from "../services/circles/nudges";
import {
  invitePreview,
  joinByInvite,
  joinCircle,
  leaveCircle,
  myCircles,
  removeMember,
  renameCircle,
  saveApproxLocation,
  skipProof,
  startCircle,
} from "../services/circles/service";
import { logger } from "../utils/logger";

const router: Router = Router();

type Operation = (req: AuthenticatedRequest, res: Response) => Promise<unknown>;
const handle =
  (fn: Operation) => async (req: AuthenticatedRequest, res: Response) => {
    try {
      await fn(req, res);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.issues[0]?.message ?? "Check the details and try again." });
        return;
      }
      if (error instanceof CircleError) {
        res.status(400).json({ error: error.message });
        return;
      }
      logger.error("Circle request failed", { path: req.path, error });
      res.status(500).json({ error: "Could not update this circle. Please retry." });
    }
  };

const preferences = z.object({
  wantsPace: z.boolean().default(true),
  wantsNearby: z.boolean().default(false),
  wantsAge: z.boolean().default(false),
});
const withPlan = preferences.extend({ planId: z.string().min(1) });

router.use(requireAuth);

router.get("/mine", handle(async (req, res) => res.json(await myCircles(req.user!.id))));

router.get("/suggestions", handle(async (req, res) => res.json(await suggestions(req.user!.id))));

router.get(
  "/search",
  handle(async (req, res) => {
    const query = z.string().trim().min(1).max(80).parse(req.query.q);
    res.json(await searchCircles(req.user!.id, query));
  }),
);

// Finds the best circle for a plan. Nothing is joined until the person taps Join.
router.post(
  "/match",
  handle(async (req, res) => {
    const body = withPlan
      .extend({
        location: z
          .object({
            latitude: z.number().min(-90).max(90),
            longitude: z.number().min(-180).max(180),
            place: z.string().trim().max(60).optional(),
          })
          .optional(),
      })
      .parse(req.body);
    if (body.location && body.wantsNearby) await saveApproxLocation(req.user!.id, body.location);
    res.json(await matchPlan(req.user!.id, body.planId, body));
  }),
);

// Start a circle with this plan; the starter owns it. Every circle is open.
router.post(
  "/",
  handle(async (req, res) => {
    const body = withPlan.parse(req.body);
    res.json(await startCircle(req.user!.id, body.planId, body));
  }),
);

router.get(
  "/invites/:code",
  handle(async (req, res) => res.json(await invitePreview(req.user!.id, req.params.code))),
);

router.post(
  "/invites/:code",
  handle(async (req, res) => {
    const body = withPlan.parse(req.body);
    res.json(await joinByInvite(req.user!.id, req.params.code, body.planId, body));
  }),
);

router.get("/:id", handle(async (req, res) => res.json(await circleBoard(req.user!.id, req.params.id))));

router.get("/:id/feed", handle(async (req, res) => res.json(await circleFeed(req.user!.id, req.params.id))));

router.post(
  "/:id/join",
  handle(async (req, res) => {
    const body = withPlan.parse(req.body);
    res.json(await joinCircle(req.user!.id, req.params.id, body.planId, body, "match"));
  }),
);

router.patch(
  "/:id",
  handle(async (req, res) => {
    const { name } = z.object({ name: z.string().trim().min(1).max(60) }).parse(req.body);
    await renameCircle(req.user!.id, req.params.id, name);
    res.sendStatus(204);
  }),
);

// "Later" on the first-photo prompt. They stay pending; the coach reminds them tomorrow.
router.post(
  "/:id/proof-skipped",
  handle(async (req, res) => {
    await skipProof(req.user!.id, req.params.id);
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

router.delete(
  "/:id/members/:userId",
  handle(async (req, res) => {
    await removeMember(req.user!.id, req.params.id, req.params.userId);
    res.sendStatus(204);
  }),
);

router.post(
  "/:id/nudges",
  handle(async (req, res) => {
    const { toUserId } = z.object({ toUserId: z.string().min(1) }).parse(req.body);
    await nudge(req.user!.id, req.params.id, toUserId);
    res.sendStatus(204);
  }),
);

export const circlesRouter: Router = router;
