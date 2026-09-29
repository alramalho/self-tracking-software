import { subDays } from "date-fns";
import { blockedUserIds } from "../../../utils/blocks";
import { prisma } from "../../../utils/prisma";
import { plansService } from "../../plansService";
import { circleCards } from "../cards";
import {
  ACTIVE_WITHIN_DAYS,
  MATCHING_TARGET,
  MATCH_THRESHOLD,
  RELAXED_THRESHOLD,
} from "../config";
import { circleScore, matchReasons, mutualScore } from "./levers";
import { goalCosines, loadProfiles, type ProfileRequest } from "./profiles";
import type { CircleCard, CircleMatch, MatchPreferences } from "../types";

const DEFAULT_PREFERENCES: MatchPreferences = {
  wantsPace: true,
  wantsNearby: false,
  wantsAge: false,
};

interface OpenCircle {
  id: string;
  status: "FORMING" | "ACTIVE";
  discoverable: boolean;
  members: ProfileRequest[];
}

// Circles still taking people through matching, excluding ones the user is in,
// ones with someone they blocked (or who blocked them), and ones nobody has opened lately.
async function openCircles(userId: string, onlyDiscoverable: boolean): Promise<OpenCircle[]> {
  const hidden = new Set(await blockedUserIds(userId));
  const activeSince = subDays(new Date(), ACTIVE_WITHIN_DAYS);
  const circles = await prisma.circle.findMany({
    where: {
      openToMatching: true,
      ...(onlyDiscoverable ? { discoverable: true } : {}),
      members: { none: { userId } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      status: true,
      discoverable: true,
      members: {
        select: {
          userId: true,
          planId: true,
          wantsPace: true,
          wantsNearby: true,
          wantsAge: true,
          user: { select: { lastActiveAt: true, createdAt: true, deletedAt: true, suspendedAt: true } },
          plan: { select: { deletedAt: true, archivedAt: true } },
        },
      },
    },
  });
  return circles
    .map((c) => ({
      ...c,
      members: c.members.filter(
        (m) => !m.user.deletedAt && !m.user.suspendedAt && !m.plan.deletedAt && !m.plan.archivedAt,
      ),
    }))
    .filter(
      (c) =>
        c.members.length > 0 &&
        c.members.length < MATCHING_TARGET &&
        c.members.every((m) => !hidden.has(m.userId)) &&
        c.members.some(
          (m) => (m.user.lastActiveAt ?? m.user.createdAt) >= activeSince,
        ),
    )
    .map((c) => ({
      id: c.id,
      status: c.status,
      discoverable: c.discoverable,
      members: c.members.map(({ userId, planId, wantsPace, wantsNearby, wantsAge }) => ({
        userId,
        planId,
        wantsPace,
        wantsNearby,
        wantsAge,
      })),
    }));
}

// Ranks open circles for one plan. Forming circles win ties so fewer stay half-empty.
export async function rankCircles(
  userId: string,
  planId: string,
  preferences: MatchPreferences,
  options: { threshold: number; onlyDiscoverable?: boolean; limit?: number },
): Promise<CircleMatch[]> {
  await plansService.getPlanEmbedding(planId);
  const circles = await openCircles(userId, !!options.onlyDiscoverable);
  if (!circles.length) return [];
  const memberRequests = circles.flatMap((c) => c.members);
  const [profiles, cosines] = await Promise.all([
    loadProfiles([
      {
        userId,
        planId,
        wantsPace: preferences.wantsPace,
        wantsNearby: preferences.wantsNearby,
        wantsAge: preferences.wantsAge,
      },
      ...memberRequests,
    ]),
    goalCosines(planId, memberRequests.map((m) => m.planId)),
  ]);
  const me = profiles.get(planId);
  if (!me) return [];
  return circles
    .map((circle) => {
      const members = circle.members
        .map((m) => profiles.get(m.planId))
        .filter((p): p is NonNullable<typeof p> => !!p);
      const score =
        circleScore(me, members, cosines) + (circle.status === "FORMING" ? 0.02 : 0);
      return { circleId: circle.id, score, reasons: matchReasons(me, members, cosines) };
    })
    .filter((m) => m.score >= options.threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, options.limit ?? 1);
}

export type MatchResult =
  | { state: "found"; circle: CircleCard; score: number }
  | { state: "none"; similarPeople: number };

// The onboarding / "Find a circle" match. Nothing is joined here; the person taps Join.
export async function matchPlan(
  userId: string,
  planId: string,
  preferences: MatchPreferences,
): Promise<MatchResult> {
  const [best] = await rankCircles(userId, planId, preferences, {
    threshold: MATCH_THRESHOLD,
  });
  if (best) {
    const [card] = await circleCards(
      [best.circleId],
      new Map([[best.circleId, best.reasons]]),
      await blockedUserIds(userId),
    );
    if (card) return { state: "found", circle: card, score: best.score };
  }
  // Honest count for "N others are waiting too": people in forming circles who'd fit.
  const near = await rankCircles(userId, planId, preferences, {
    threshold: RELAXED_THRESHOLD,
    limit: 20,
  });
  const forming = await prisma.circleMember.count({
    where: { circleId: { in: near.map((m) => m.circleId) }, circle: { status: "FORMING" } },
  });
  return { state: "none", similarPeople: forming };
}

export interface PlanSuggestions {
  plan: { id: string; goal: string; emoji: string | null };
  circles: CircleCard[];
}

// Search → Circles with an empty query: a few circles for each plan that has none yet.
export async function suggestions(userId: string): Promise<PlanSuggestions[]> {
  const plans = await prisma.plan.findMany({
    where: { userId, deletedAt: null, archivedAt: null, circleMember: null },
    orderBy: { createdAt: "desc" },
    take: 3,
    select: { id: true, goal: true, emoji: true },
  });
  const hidden = await blockedUserIds(userId);
  const result: PlanSuggestions[] = [];
  for (const plan of plans) {
    const ranked = await rankCircles(userId, plan.id, DEFAULT_PREFERENCES, {
      threshold: RELAXED_THRESHOLD,
      onlyDiscoverable: true,
      limit: 3,
    });
    const circles = await circleCards(
      ranked.map((r) => r.circleId),
      new Map(ranked.map((r) => [r.circleId, r.reasons])),
      hidden,
    );
    if (circles.length) result.push({ plan, circles });
  }
  return result;
}

export async function searchCircles(userId: string, query: string): Promise<CircleCard[]> {
  const hidden = await blockedUserIds(userId);
  const found = await prisma.circle.findMany({
    where: {
      discoverable: true,
      openToMatching: true,
      members: { none: { userId: { in: [userId, ...hidden] } } },
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { members: { some: { plan: { goal: { contains: query, mode: "insensitive" } } } } },
      ],
    },
    take: 20,
    select: { id: true, _count: { select: { members: true } } },
  });
  return circleCards(
    found.filter((c) => c._count.members < MATCHING_TARGET).map((c) => c.id),
    new Map(),
    hidden,
  );
}

// Two forming circles whose members all fit each other are better as one.
export async function mergeableInto(
  source: ProfileRequest[],
  target: ProfileRequest[],
): Promise<boolean> {
  const profiles = await loadProfiles([...source, ...target]);
  for (const s of source) {
    const cosines = await goalCosines(s.planId, target.map((t) => t.planId));
    const a = profiles.get(s.planId);
    for (const t of target) {
      const b = profiles.get(t.planId);
      if (!a || !b || mutualScore(a, b, cosines.get(t.planId) ?? 0) < MATCH_THRESHOLD)
        return false;
    }
  }
  return true;
}
