import multer from "multer";
import { Response, Router } from "express";
import { z } from "zod/v4";

import { AuthenticatedRequest, requireAuth } from "../middleware/auth";
import { commitVoiceLog, previewVoiceLog } from "../services/voice-log/service";
import { logger } from "../utils/logger";
import {
  voiceLogCommitSchema,
  voiceLogRefinementContextSchema,
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

      const preview = await previewVoiceLog({
        userId: req.user!.id,
        audioBytes: req.file.buffer,
        audioFormat: req.body.audio_format,
        timezone: req.body.timezone,
        clientRequestId: clientRequestId.data,
        refinement,
      });
      res.json(preview);
    } catch (error) {
      logger.error("Error creating voice log preview:", error);
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

export { router as voiceLogsRouter };
