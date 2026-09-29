import { prisma } from "../../../utils/prisma";
import type { MatchPreferences, MatchProfile } from "../types";

export interface ProfileRequest extends MatchPreferences {
  userId: string;
  planId: string;
}

interface CachedWeek {
  doneCount?: number;
  targetCount?: number;
  outcome?: string;
}

interface CachedProgress {
  weeks?: CachedWeek[];
  currentWeekStats?: { numActiveDaysInTheWeek?: number };
}

// Share of planned sessions done over the last four finished weeks, from the plan's
// cached progress. Null for new plans with no finished week yet.
export function completionRate(progress: unknown): number | null {
  const weeks = ((progress as CachedProgress | null)?.weeks ?? [])
    .filter((w) => w.outcome && (w.targetCount ?? 0) > 0)
    .slice(-4);
  if (!weeks.length) return null;
  const done = weeks.reduce((sum, w) => sum + Math.min(w.doneCount ?? 0, w.targetCount ?? 0), 0);
  const target = weeks.reduce((sum, w) => sum + (w.targetCount ?? 0), 0);
  return target ? done / target : null;
}

export function weeklyTarget(plan: {
  timesPerWeek: number | null;
  coachSuggestedTimesPerWeek: number | null;
  progressState: unknown;
}): number {
  return (
    plan.timesPerWeek ??
    plan.coachSuggestedTimesPerWeek ??
    (plan.progressState as CachedProgress | null)?.currentWeekStats?.numActiveDaysInTheWeek ??
    3
  );
}

export async function loadProfiles(
  requests: ProfileRequest[],
): Promise<Map<string, MatchProfile>> {
  const [users, plans] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: [...new Set(requests.map((r) => r.userId))] } },
      select: {
        id: true,
        timezone: true,
        age: true,
        approxLatitude: true,
        approxLongitude: true,
      },
    }),
    prisma.plan.findMany({
      where: { id: { in: requests.map((r) => r.planId) } },
      select: {
        id: true,
        timesPerWeek: true,
        coachSuggestedTimesPerWeek: true,
        progressState: true,
      },
    }),
  ]);
  const userById = new Map(users.map((u) => [u.id, u]));
  const planById = new Map(plans.map((p) => [p.id, p]));
  const profiles = new Map<string, MatchProfile>();
  for (const request of requests) {
    const user = userById.get(request.userId);
    const plan = planById.get(request.planId);
    if (!user || !plan) continue;
    profiles.set(request.planId, {
      userId: user.id,
      planId: plan.id,
      timezone: user.timezone,
      age: user.age,
      latitude: user.approxLatitude,
      longitude: user.approxLongitude,
      weeklyTarget: weeklyTarget(plan),
      completionRate: completionRate(plan.progressState),
      preferences: {
        wantsPace: request.wantsPace,
        wantsNearby: request.wantsNearby,
        wantsAge: request.wantsAge,
      },
    });
  }
  return profiles;
}

// Cosine similarity between one plan's goal embedding and others'.
export async function goalCosines(
  planId: string,
  otherPlanIds: string[],
): Promise<Map<string, number>> {
  if (!otherPlanIds.length) return new Map();
  const rows = await prisma.$queryRaw<{ id: string; cosine: number }[]>`
    SELECT p."id", (1 - (p."embedding" <=> me."embedding"))::float8 AS "cosine"
    FROM "public"."plans" p, "public"."plans" me
    WHERE me."id" = ${planId}
      AND p."id" = ANY(${otherPlanIds}::text[])
      AND p."embedding" IS NOT NULL
      AND me."embedding" IS NOT NULL`;
  return new Map(rows.map((r) => [r.id, Number(r.cosine)]));
}
