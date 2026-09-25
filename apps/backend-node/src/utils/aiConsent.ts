// AI data sharing consent (App Store Guideline 5.1.2(i)).
// People choose in the app whether their data may be sent to third-party AI
// providers. The rule is enforced only when AI_CONSENT_ENFORCED=true, so older
// app builds that never ask keep working until the flag is flipped.
import type { User } from "@tsw/prisma";
import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "../middleware/auth";
import { getCurrentUser } from "./requestContext";

type ConsentFields = Pick<User, "aiConsentGrantedAt" | "aiConsentDeclinedAt">;

export const AI_CONSENT_REQUIRED = {
  error: "Turn on AI features in Settings to use this.",
  code: "AI_CONSENT_REQUIRED",
};

export function hasAiConsent(user: ConsentFields | null | undefined): boolean {
  if (process.env.AI_CONSENT_ENFORCED !== "true") return true;
  const granted = user?.aiConsentGrantedAt;
  const declined = user?.aiConsentDeclinedAt;
  if (!granted) return false;
  return !declined || granted > declined;
}

// Route guard. Put it after requireAuth.
export function requireAiConsent(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  if (hasAiConsent(req.user)) {
    next();
    return;
  }
  res.status(403).json(AI_CONSENT_REQUIRED);
}

export class AiConsentRequiredError extends Error {
  statusCode = 403;
  code = AI_CONSENT_REQUIRED.code;
  constructor() {
    super(AI_CONSENT_REQUIRED.error);
  }
}

// Safety net before any call to an AI provider: if this code runs inside a
// signed-in request whose user has not allowed AI, stop here.
export function assertAiConsent(): void {
  if (!currentUserAllowsAi()) throw new AiConsentRequiredError();
}

// For optional AI extras (auto-categorising, embeddings): skip quietly instead.
// True outside a signed-in request (cron jobs filter people themselves).
export function currentUserAllowsAi(): boolean {
  const user = getCurrentUser();
  return !user || hasAiConsent(user);
}
