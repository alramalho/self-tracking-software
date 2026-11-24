// Fair use of AI features (Terms of Service, "Fair use").
// Every AI request someone makes (coach replies, voice logs, dictation, plan design) counts
// towards a monthly allowance, so one account can never run up the AI bill. Tap logging,
// plans, streaks and friends never count. The allowance resets on the 1st (UTC).
import type { PlanType } from "@tsw/prisma";
import type { NextFunction, Response } from "express";
import rateLimit from "express-rate-limit";
import type { AuthenticatedRequest } from "../middleware/auth";
import { requireAiConsent } from "./aiConsent";
import { prisma } from "./prisma";

/** AI uses per calendar month; the terms quote these numbers. */
export const MONTHLY_ALLOWANCE: Record<PlanType, number> = { FREE: 150, PLUS: 600 };
/** Against scripts and stuck loops, not people. */
export const PER_MINUTE = 20;

export type AiUsage = { used: number; limit: number; resetsAt: string };

export const monthKey = (now = new Date()) => now.toISOString().slice(0, 7);
const nextMonthStart = (now = new Date()) =>
  new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();

export const allowanceFor = (planType: PlanType | null | undefined) =>
  MONTHLY_ALLOWANCE[planType ?? "FREE"] ?? MONTHLY_ALLOWANCE.FREE;

export function monthlyLimitReached(usage: AiUsage) {
  return {
    error: `You've used this month's ${usage.limit} AI uses (fair use). They come back on the 1st. Logging by tap keeps working.`,
    code: "AI_FAIR_USE_MONTHLY",
    ...usage,
  };
}

export const AI_RATE_LIMITED = {
  error: "That's a lot of AI requests in a minute. Wait a moment and try again.",
  code: "AI_FAIR_USE_RATE",
};

/** How much of this month's allowance someone has used. */
export async function aiUsage(user: { id: string; planType?: PlanType | null }): Promise<AiUsage> {
  const row = await prisma.aiUsage.findUnique({
    where: { userId_month: { userId: user.id, month: monthKey() } },
  });
  return { used: row?.count ?? 0, limit: allowanceFor(user.planType), resetsAt: nextMonthStart() };
}

/**
 * Counts one AI use. Returns the limit message instead when the allowance is used up,
 * so callers answer 429 and the AI provider is never called.
 */
export async function useAiAllowance(user: { id: string; planType?: PlanType | null }) {
  const usage = await aiUsage(user);
  if (usage.used >= usage.limit) return monthlyLimitReached(usage);
  await prisma.aiUsage.upsert({
    where: { userId_month: { userId: user.id, month: monthKey() } },
    create: { userId: user.id, month: monthKey(), count: 1 },
    update: { count: { increment: 1 } },
  });
  return null;
}

const perMinute = rateLimit({
  windowMs: 60000,
  max: PER_MINUTE,
  keyGenerator: (req) => (req as AuthenticatedRequest).user!.id,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => void res.status(429).json(AI_RATE_LIMITED),
});

async function monthly(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const blocked = await useAiAllowance(req.user!);
    if (blocked) return void res.status(429).json(blocked);
    next();
  } catch (error) {
    next(error);
  }
}

/** Route guard for AI features, after requireAuth: consent first, then fair use. */
export const requireAiAllowance = [requireAiConsent, perMinute, monthly];
