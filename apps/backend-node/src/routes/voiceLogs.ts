import multer from "multer";
import { Response, Router } from "express";
import { z } from "zod/v4";

import { AuthenticatedRequest, requireAuth } from "../middleware/auth";
import { requireAiConsent } from "../utils/aiConsent";
import { commitVoiceLog, previewVoiceLog } from "../services/voice-log/service";
import { logger } from "../utils/logger";
import { checkCoverage } from "../services/coach/learning/service";
import {
  voiceLogCommitSchema,
  voiceLogFollowUpSchema,
  voiceLogRefinementContextSchema,
  type VoiceLogFollowUp,
  type VoiceLogRefinementContext,
} from "../services/voice-log/types";

const router: Router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const requestIdSchema = z.string().uuid();

router.post(
  "/preview",
  requireAuth,
  requireAiConsent,
  upload.single("audio_file"),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "No audio file provided" });
        return;
      }

      const clientRequestId = requestIdSchema.safeParse(
        req.body.client_request_id,
      );
      if (!clientRequestId.success) {
        res.status(400).json({ error: "client_request_id must be a UUID" });
        return;
      }

      let refinement: VoiceLogRefinementContext | undefined;
      if (req.body.refinement_context) {
        let parsedJson: unknown;
        try {
          parsedJson = JSON.parse(req.body.refinement_context);
        } catch {
          res.status(400).json({ error: "refinement_context must be valid JSON" });
          return;
        }
        const parsedRefinement = voiceLogRefinementContextSchema.safeParse(parsedJson);
        if (!parsedRefinement.success) {
          res.status(400).json({ error: parsedRefinement.error.flatten() });
          return;
        }
        refinement = parsedRefinement.data;
      }

      let followUp: VoiceLogFollowUp | undefined;
      if (req.body.follow_up_context) {
        let parsedJson: unknown;
        try {
          parsedJson = JSON.parse(req.body.follow_up_context);
        } catch {
          res.status(400).json({ error: "follow_up_context must be valid JSON" });
          return;
        }
        const parsedFollowUp = voiceLogFollowUpSchema.safeParse(parsedJson);
        if (!parsedFollowUp.success) {
          res.status(400).json({ error: parsedFollowUp.error.flatten() });
          return;
        }
        followUp = parsedFollowUp.data;
      }

      const focusActivityId =
        typeof req.body.focus_activity_id === "string" && req.body.focus_activity_id.trim()
          ? req.body.focus_activity_id.trim()
          : undefined;

      const preview = await previewVoiceLog({
        userId: req.user!.id,
        audioBytes: req.file.buffer,
        audioFormat: req.body.audio_format,
        timezone: req.body.timezone,
        clientRequestId: clientRequestId.data,
        refinement,
        followUp,
        focusActivityId,
      });
      res.json(preview);
    } catch (error) {
      logger.error("Error creating voice log preview:", error);
      const message = error instanceof Error ? error.message : "";
      if (message.includes("no longer available")) {
        res.status(400).json({ error: message });
        return;
      }
      res.status(500).json({ error: "Voice log processing failed" });
    }
  },
);

router.post(
  "/commit",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const parsed = voiceLogCommitSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    try {
      const result = await commitVoiceLog({
        userId: req.user!.id,
        commit: parsed.data,
      });
      res.json(result);
    } catch (error) {
      logger.error("Error committing voice log:", error);
      const message = error instanceof Error ? error.message : "Voice log commit failed";
      if (
        message.includes("no longer available") ||
        message.includes("Invalid")
      ) {
        res.status(400).json({ error: message });
        return;
      }
      res.status(500).json({ error: "Voice log commit failed" });
    }
  },
);

// "What did you cover?" on a learning plan: after a Share more note is saved, the coach reads it against the plan.
const coverageRequestSchema = z.object({
  logged: z
    .array(z.object({ activityId: z.string().min(1), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
    .min(1)
    .max(10),
  said: z.string().trim().min(1).max(4000),
});

router.post(
  "/coverage",
  requireAuth,
  requireAiConsent,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const parsed = coverageRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    try {
      res.json({ coverage: await checkCoverage(req.user!.id, parsed.data.logged, parsed.data.said) });
    } catch (error) {
      // The note is already saved; a failed read only means no suggestion this time.
      logger.error("Error checking learning coverage:", error);
      res.json({ coverage: null });
    }
  },
);

export { router as voiceLogsRouter };
