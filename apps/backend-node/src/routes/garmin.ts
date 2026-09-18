import { Response, Router } from "express";

import { AuthenticatedRequest, requireAuth } from "@/middleware/auth";
import {
  GarminConfigurationError,
  GarminApiError,
} from "@/services/health/garmin/oauth";
import {
  disconnectGarmin,
  finishGarminConnection,
  getGarminDailyMetrics,
  getGarminOAuthReturnUrl,
  getGarminStatus,
  ingestGarminWebhook,
  startGarminConnection,
  syncGarminForUser,
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

router.post(
  "/sync",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const requestedDays = Number(req.body?.days ?? 14);
      const days =
        Number.isInteger(requestedDays) && requestedDays > 0
          ? Math.min(requestedDays, 7)
          : 14;
      const result = await syncGarminForUser(req.user!.id, {
        days,
        requestBackfill: true,
      });
      res.json({ result });
    } catch (error) {
      logger.error("Failed to sync Garmin Connect", {
        userId: req.user!.id,
        error,
      });
      res.status(error instanceof GarminApiError ? 502 : 500).json({
        error: "Failed to sync Garmin Connect data",
      });
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
      const requestedDays = Number(req.query.days ?? 180);
      const days =
        Number.isInteger(requestedDays) && requestedDays > 0
          ? Math.min(requestedDays, 366)
          : 180;
      res.json(
        await getSleepScoresForProvider(req.user!.id, "garmin_connect", days),
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
router.post("/webhook", async (req, res: Response): Promise<void> => {
  try {
    const result = await ingestGarminWebhook(
      (req.body ?? {}) as GarminWebhookPayload,
    );
    res.status(202).json(result);
  } catch (error) {
    logger.error("Failed to process Garmin Connect webhook", { error });
    res.status(500).json({ error: "Failed to process Garmin webhook" });
  }
});

// Garmin redirects here without a tracking.so auth header. The short-lived
// request token is the binding back to the user who started the flow.
router.get("/callback", async (req, res: Response): Promise<void> => {
  const requestToken = queryValue(req.query.oauth_token);
  const verifier = queryValue(req.query.oauth_verifier);
  const deniedToken = queryValue(req.query.denied);
  const callbackToken = requestToken ?? deniedToken;
  const returnUrl = callbackToken
    ? await getGarminOAuthReturnUrl(callbackToken)
    : null;

  if (deniedToken || !requestToken || !verifier) {
    res.redirect(frontendRedirect("cancelled", returnUrl));
    return;
  }

  try {
    await finishGarminConnection(requestToken, verifier);
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
