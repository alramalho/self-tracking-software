import crypto from "crypto";
import { Response, Router } from "express";
import { AuthenticatedRequest, requireAuth } from "../middleware/auth";
import { logger } from "../utils/logger";
import { prisma } from "../utils/prisma";

const router = Router();

const API_KEY_PREFIX = "tsk_";
const MAX_ACTIVE_KEYS = 10;

export function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

// Create a personal API key. The plaintext key is returned exactly once.
router.post(
  "/",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response | void> => {
    try {
      const label =
        typeof req.body?.label === "string" && req.body.label.trim()
          ? req.body.label.trim().slice(0, 100)
          : null;

      const activeKeys = await prisma.apiKey.count({
        where: { userId: req.user!.id, revokedAt: null },
      });
      if (activeKeys >= MAX_ACTIVE_KEYS) {
        return res.status(400).json({
          error: `You already have ${MAX_ACTIVE_KEYS} active API keys. Revoke one first.`,
        });
      }

      const key = `${API_KEY_PREFIX}${crypto.randomBytes(24).toString("hex")}`;
      const created = await prisma.apiKey.create({
        data: {
          userId: req.user!.id,
          keyHash: hashApiKey(key),
          label,
        },
      });

      logger.info(`User ${req.user!.id} created API key ${created.id}`);
      res.json({
        id: created.id,
        label: created.label,
        createdAt: created.createdAt,
        key,
        note: "Store this key now. It cannot be retrieved again.",
      });
    } catch (error) {
      logger.error("Error creating API key:", error);
      res.status(500).json({ error: "Failed to create API key" });
    }
  }
);

// List API keys (no secrets)
router.get(
  "/",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response | void> => {
    try {
      const keys = await prisma.apiKey.findMany({
        where: { userId: req.user!.id, revokedAt: null },
        select: { id: true, label: true, createdAt: true, lastUsedAt: true },
        orderBy: { createdAt: "desc" },
      });
      res.json({ keys });
    } catch (error) {
      logger.error("Error listing API keys:", error);
      res.status(500).json({ error: "Failed to list API keys" });
    }
  }
);

// Revoke an API key
router.delete(
  "/:keyId",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response | void> => {
    try {
      const { keyId } = req.params;
      const key = await prisma.apiKey.findFirst({
        where: { id: keyId, userId: req.user!.id, revokedAt: null },
      });
      if (!key) {
        return res.status(404).json({ error: "API key not found" });
      }

      await prisma.apiKey.update({
        where: { id: key.id },
        data: { revokedAt: new Date() },
      });
      logger.info(`User ${req.user!.id} revoked API key ${key.id}`);
      res.json({ success: true });
    } catch (error) {
      logger.error("Error revoking API key:", error);
      res.status(500).json({ error: "Failed to revoke API key" });
    }
  }
);

export const apiKeysRouter: Router = router;
export default apiKeysRouter;
