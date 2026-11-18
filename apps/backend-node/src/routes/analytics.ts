import { Response, Router } from "express";
import { AuthenticatedRequest, requireAuth } from "../middleware/auth";
import { canSeeAnalytics } from "../services/analytics/people";
import { analyticsOverview } from "../services/analytics/service";
import { recordingKeyFor } from "../services/analytics/voiceNotes";
import { s3Service } from "../services/s3Service";
import { logger } from "../utils/logger";

// tracking.so/analytics (the web app's /analytics page). Only ANALYTICS_EMAILS get data.
const router: Router = Router();

router.use(...requireAuth, (req: AuthenticatedRequest, res: Response, next) => {
  if (!canSeeAnalytics(req.user?.email)) return void res.status(403).json({ error: "Not allowed" });
  next();
});

router.get("/access", (_req, res) => res.json({ allowed: true }));

router.get("/overview", async (req: AuthenticatedRequest, res: Response) => {
  try {
    res.json(await analyticsOverview(Number(req.query.days) || 30));
  } catch (error) {
    logger.error("Analytics overview failed:", error);
    res.status(500).json({ error: "Analytics failed" });
  }
});

/** A short-lived link to one voice note's recording. */
router.get("/voice-notes/:clientRequestId/recording", async (req: AuthenticatedRequest, res: Response) => {
  const key = await recordingKeyFor(req.params.clientRequestId);
  if (!key) return void res.status(404).json({ error: "No recording" });
  res.json({ url: await s3Service.generatePresignedUrl(key, 300) });
});

export const analyticsRouter = router;
