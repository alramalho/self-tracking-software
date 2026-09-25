import { interview } from "../services/follow-through/onboarding/interview/service";
import {
  goalGuidance,
  goalGuidanceRequestSchema,
} from "../services/follow-through/onboarding/interview/guidance";
import { getInterviewContext } from "../services/follow-through/onboarding/interview/context";
import { interviewRequestSchema } from "../services/follow-through/onboarding/interview/schema";
import { FollowThroughInputError } from "../services/follow-through/errors";
import rateLimit from "express-rate-limit";
import { calendarSessions } from "../services/follow-through/calendar";
import { coachingOffer } from "../services/follow-through/onboarding/billing";
import { draftSchema } from "../services/follow-through/onboarding/schema";
import {
  nextQuestion,
  saveDraft,
  finishOnboarding,
} from "../services/follow-through/onboarding/service";
import { preferencesSchema } from "../services/follow-through/schema";
import { Router, type Response } from "express";
import { z } from "zod/v4";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth";
import {
  snapshot,
  configure,
  createSession,
  timer,
  outcome,
  move,
} from "../services/follow-through/service";
import {
  dateKey,
  supportSchema,
  time,
} from "../services/follow-through/schema";
import { changeState } from "../services/follow-through/store";
import { logger } from "../utils/logger";
import { startPlanMonitoring } from "../services/coach/monitoring/service";
import { monitoringState } from "../services/coach/monitoring/model";
import { answerNudge } from "../services/coach/monitoring/requests";

const router = Router();
type Operation = (req: AuthenticatedRequest, res: Response) => Promise<unknown>;
const handle =
  (operation: Operation) =>
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      await operation(req, res);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res
          .status(400)
          .json({ error: error.issues[0]?.message ?? "Invalid input" });
        return;
      }
      logger.warn("Follow-through request failed", { error });
      res.status(400).json({
        error:
          error instanceof FollowThroughInputError
            ? error.message
            : "Could not save changes. Please retry.",
      });
    }
  };
router.use(requireAuth);
// The two buttons on the coach's silent "you've gone quiet" message.
router.post("/nudges/:messageId", handle(async (req, res) => {
  const { action } = z.object({ action: z.enum(["remind", "archive"]) }).parse(req.body);
  res.json(await answerNudge(req.user!.id, String(req.params.messageId), action));
}));

router.post("/coaching/presence", handle(async (req, res) => {
  await changeState(req.user!.id, async state => {
    state.monitoring ??= monitoringState();
    state.monitoring.viewingUntil = new Date(Date.now() + 90000).toISOString();
  });
  res.json({ ok: true });
}));
router.post("/coaching/resume", handle(async (req, res) => {
  const { planId } = z.object({ planId: z.string().max(200) }).parse(req.body);
  await changeState(req.user!.id, async state => {
    if (!state.supports[planId]) throw new FollowThroughInputError("Plan not found");
    if (state.monitoring) state.monitoring.pausedPlanIds = state.monitoring.pausedPlanIds.filter(id => id !== planId);
  });
  res.json({ ok: true });
}));
router.get(
  "/calendar",
  handle(async (req, res) => res.json(await calendarSessions(req.user!))),
);
router.get(
  "/onboarding/offer",
  handle(async (req, res) => res.json(await coachingOffer(req.user!))),
);
router.post(
  "/onboarding/next",
  rateLimit({
    windowMs: 60000,
    max: 10,
    keyGenerator: (req) => (req as AuthenticatedRequest).user!.id,
    standardHeaders: true,
    legacyHeaders: false,
  }),
  handle(async (req, res) =>
    res.json(await nextQuestion(draftSchema.parse(req.body))),
  ),
);
router.post(
  "/onboarding/interview",
  rateLimit({
    windowMs: 60000,
    max: 20,
    keyGenerator: (req) => (req as AuthenticatedRequest).user!.id,
    standardHeaders: true,
    legacyHeaders: false,
  }),
  handle(async (req, res) => {
    const input = interviewRequestSchema.parse(req.body);
    const context = await getInterviewContext(req.user!.id, input.state);
    return res.json(await interview(input, context));
  }),
);
router.post(
  "/onboarding/goal-guidance",
  rateLimit({
    windowMs: 60000,
    max: 60,
    keyGenerator: (req) => (req as AuthenticatedRequest).user!.id,
    standardHeaders: true,
    legacyHeaders: false,
  }),
  handle(async (req, res) =>
    res.json(await goalGuidance(goalGuidanceRequestSchema.parse(req.body))),
  ),
);
router.put(
  "/onboarding/draft",
  handle(async (req, res) =>
    res.json(await saveDraft(req.user!.id, draftSchema.parse(req.body))),
  ),
);
router.post(
  "/onboarding/finish",
  handle(async (req, res) => {
    const body = z
      .object({ draft: draftSchema, preferences: preferencesSchema })
      .parse(req.body);
    const result = await finishOnboarding(req.user!, body.draft, body.preferences);
    res.json(result);
    startPlanMonitoring(req.user!);
  }),
);
router.get(
  "/",
  handle(async (req, res) => res.json(await snapshot(req.user!))),
);
router.put(
  "/plans/:id",
  handle(async (req, res) => {
    const support = supportSchema.parse({ ...req.body, planId: req.params.id });
    const result = await configure(req.user!, support);
    res.json(result);
    startPlanMonitoring(req.user!);
  }),
);
router.post(
  "/sessions",
  handle(async (req, res) => {
    const body = z
      .object({ planId: z.string(), date: dateKey, time: time.nullable() })
      .parse(req.body);
    return res.json(
      await createSession(req.user!, body.planId, body.date, body.time),
    );
  }),
);
router.post(
  "/sessions/:id/timer",
  handle(async (req, res) => {
    const body = z
      .object({ action: z.enum(["START", "PAUSE", "FINISH"]) })
      .parse(req.body);
    return res.json(await timer(req.user!.id, req.params.id, body.action));
  }),
);
router.post(
  "/sessions/:id/outcome",
  handle(async (req, res) => {
    const body = z
      .object({
        outcome: z.enum(["DONE", "PARTLY", "SKIPPED"]),
        entryId: z.string().optional(),
      })
      .parse(req.body);
    return res.json(
      await outcome(req.user!.id, req.params.id, body.outcome, body.entryId),
    );
  }),
);
router.patch(
  "/sessions/:id",
  handle(async (req, res) => {
    const body = z
      .object({ date: dateKey, time: time.nullable() })
      .parse(req.body);
    return res.json(
      await move(req.user!.id, req.params.id, body.date, body.time),
    );
  }),
);
router.post(
  "/checks/:id",
  handle(async (req, res) => {
    const { action } = z
      .object({ action: z.enum(["ANSWER", "DISMISS"]) })
      .parse(req.body);
    await changeState(req.user!.id, async (state) => {
      const check = state.checks[req.params.id];
      if (!check) throw new FollowThroughInputError("Check-in not found");
      if (action === "ANSWER") check.answeredAt = new Date().toISOString();
      else check.dismissedAt = new Date().toISOString();
    });
    return res.sendStatus(204);
  }),
);
router.post(
  "/reach-outs",
  handle(async (req, res) => {
    const { enabled } = z.object({ enabled: z.boolean() }).parse(req.body);
    await changeState(req.user!.id, async (state) => {
      state.pausedAt = enabled ? null : new Date().toISOString();
      state.monitoring ??= monitoringState();
      state.monitoring.outreachPaused = !enabled;
      if (enabled) state.monitoring.pausedPlanIds = [];
      if (enabled)
        for (const check of Object.values(state.checks))
          if (!check.answeredAt) check.answeredAt = new Date().toISOString();
    });
    return res.sendStatus(204);
  }),
);
export const followThroughRouter: Router = router;
