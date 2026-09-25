import { Response, Router } from "express";

import { AuthenticatedRequest, requireAuth } from "@/middleware/auth";
import {
  GarminConfigurationError,
  GarminApiError,
} from "@/services/health/garmin/oauth";
import {
  disconnectGarmin,
  finishGarminConnection,
  garminAvailableFor,
  getGarminDailyMetrics,
  getGarminOAuthReturnUrl,
  getGarminStatus,
  ingestGarminWebhook,
  startGarminConnection,
  refreshGarminConnection,
} from "@/services/health/garmin/service";
import type { GarminWebhookPayload } from "@/services/health/garmin/types";
import { getGarminOAuthConfig } from "@/services/health/garmin/oauth";
import { logger } from "@/utils/logger";
import { getSleepScoresForProvider } from "@/services/health/apple/sleep/service";

const router = Router();

const queryValue = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

const isNativeReturnUrl = (value: string | undefined): value is string => {
  if (!value) return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "trackingso:" &&
      url.hostname === "garmin" &&
      url.pathname === "/callback" &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
};

const frontendRedirect = (
  status: "connected" | "cancelled" | "error",
  returnUrl?: string | null,
): string => {
  const frontendUrl =
    getGarminOAuthConfig()?.frontendUrl || "https://app.tracking.so";
  const redirect = new URL(
    isNativeReturnUrl(returnUrl ?? undefined) ? returnUrl! : "/",
    isNativeReturnUrl(returnUrl ?? undefined) ? undefined : frontendUrl,
  );
  redirect.searchParams.set("garmin", status);
  return redirect.toString();
};

router.get(
  "/status",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      res.json(await getGarminStatus(req.user!.id));
    } catch (error) {
      logger.error("Failed to read Garmin Connect status", { error });
      res.status(500).json({ error: "Failed to read Garmin Connect status" });
    }
  },
);

router.get(
  "/connect",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!(await garminAvailableFor(req.user!.id))) {
        res.status(403).json({ error: "Garmin Connect isn't available yet." });
        return;
      }
      const returnUrl = queryValue(req.query.returnUrl);
      res.json(
        await startGarminConnection(
          req.user!.id,
          isNativeReturnUrl(returnUrl) ? returnUrl : undefined,
        ),
      );
    } catch (error) {
      if (error instanceof GarminConfigurationError) {
        res.status(503).json({ error: error.message });
        return;
      }
      logger.error("Failed to start Garmin Connect authorization", {
        userId: req.user!.id,
        error,
      });
      res
        .status(502)
        .json({ error: "Could not start Garmin Connect authorization" });
    }
  },
);

// Garmin sends data to our webhook after the watch syncs; we never pull it ourselves.
// Older app builds still call this after "Sync Garmin now", so it only refreshes what the
// person shares with us and reports nothing newly imported.
router.post(
  "/sync",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      await refreshGarminConnection(req.user!.id);
      const status = await getGarminStatus(req.user!.id);
      res.json({
        result: {
          counts: {
            dailyMetrics: 0,
            workouts: 0,
            sleepSamples: 0,
            summaryTypes: 0,
            backfillRequested: false,
            backfillStatus: "not_requested",
          },
          lastSyncCompletedAt: status.lastSyncCompletedAt,
        },
      });
    } catch (error) {
      logger.error("Failed to refresh Garmin Connect", { userId: req.user!.id, error });
      res.status(500).json({ error: "Failed to refresh Garmin Connect" });
    }
  },
);

router.get(
  "/daily-metrics",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const requestedDays = Number(req.query.days ?? 14);
      const days =
        Number.isInteger(requestedDays) && requestedDays > 0
          ? Math.min(requestedDays, 60)
          : 14;
      res.json(await getGarminDailyMetrics(req.user!.id, days));
    } catch (error) {
      logger.error("Failed to read Garmin daily metrics", {
        userId: req.user!.id,
        error,
      });
      res.status(500).json({ error: "Could not load your Garmin metrics" });
    }
  },
);

router.get(
  "/sleep",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const requestedDays =
        req.query.days == null ? undefined : Number(req.query.days);
      if (
        requestedDays != null &&
        (!Number.isInteger(requestedDays) || requestedDays <= 0)
      ) {
        res.status(400).json({ error: "days must be a positive integer" });
        return;
      }
      res.json(
        await getSleepScoresForProvider(
          req.user!.id,
          "garmin_connect",
          requestedDays,
        ),
      );
    } catch (error) {
      logger.error("Failed to read Garmin sleep scores", {
        userId: req.user!.id,
        error,
      });
      res
        .status(500)
        .json({ error: "Could not load your Garmin sleep scores" });
    }
  },
);

// Garmin sends Health/Activity notifications here. The payload contains an
// opaque user access token; the service hashes it before looking up the
// encrypted token belonging to the matching tracking.so user.
//
// Garmin requires an immediate 200 response. Processing the callback URLs
// before acknowledging the notification can make Garmin retry or drop the
// delivery, so the ingestion work deliberately continues after the response.
router.post("/webhook", (req, res: Response): void => {
  const payload = (req.body ?? {}) as GarminWebhookPayload;
  res.status(200).json({ accepted: true });

  setImmediate(() => {
    void ingestGarminWebhook(payload)
      .then((result) => {
        logger.info("Garmin Connect webhook processed", result);
      })
      .catch((error) => {
        logger.error("Failed to process Garmin Connect webhook", { error });
      });
  });
});

// Garmin redirects here without a tracking.so auth header. The short-lived request
// (OAuth1 request token, or OAuth2 PKCE state) is the binding back to the user.
router.get("/callback", async (req, res: Response): Promise<void> => {
  const oauth1Token = queryValue(req.query.oauth_token);
  const verifier = queryValue(req.query.oauth_verifier);
  const state = queryValue(req.query.state);
  const code = queryValue(req.query.code);
  const denied = queryValue(req.query.denied) ?? queryValue(req.query.error);
  const key = oauth1Token ?? state ?? queryValue(req.query.denied);
  const returnUrl = key ? await getGarminOAuthReturnUrl(key) : null;

  const callback =
    state && code
      ? { state, code }
      : oauth1Token && verifier
        ? { requestToken: oauth1Token, verifier }
        : null;
  if (denied || !callback) {
    res.redirect(frontendRedirect("cancelled", returnUrl));
    return;
  }

  try {
    await finishGarminConnection(callback);
    res.redirect(frontendRedirect("connected", returnUrl));
  } catch (error) {
    if (
      !(error instanceof GarminConfigurationError) &&
      !(error instanceof GarminApiError)
    ) {
      logger.error("Failed to finish Garmin Connect authorization", { error });
    } else {
      logger.warn("Garmin Connect authorization failed", {
        error: error.name,
        status: error instanceof GarminApiError ? error.status : undefined,
      });
    }
    res.redirect(frontendRedirect("error", returnUrl));
  }
});

router.delete(
  "/",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      await disconnectGarmin(req.user!.id, req.query.deleteData === "true");
      res.status(204).send();
    } catch (error) {
      logger.error("Failed to disconnect Garmin Connect", {
        userId: req.user!.id,
        error,
      });
      res.status(500).json({ error: "Failed to disconnect Garmin Connect" });
    }
  },
);

export const garminRouter: Router = router;
