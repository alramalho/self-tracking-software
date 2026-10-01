import { randomUUID } from "node:crypto";
import type { Prisma } from "@tsw/prisma";
import { blockedUserIds } from "../../utils/blocks";
import { logger } from "../../utils/logger";
import { prisma } from "../../utils/prisma";
import { circleBoard, proofEntryId } from "./board/service";
import { circleCards } from "./cards";
import { syncCircleChat } from "./chat";
import { ACTIVE_AT, CIRCLE_CAP, MATCHING_TARGET } from "./config";
import { CircleError } from "./errors";
import { recordCircleEvent } from "./events";
import { circleLabel, notifyCircle, othersLabel } from "./notify";
import type { ApproxLocation, CircleCard, MatchPreferences } from "./types";

// Only the three "Match me by" choices are stored on a membership.
const preferenceFields = ({ wantsPace, wantsNearby, wantsAge }: MatchPreferences) => ({
  wantsPace,
  wantsNearby,
  wantsAge,
});

const firstName = (user: { name: string | null; username: string | null }) =>
  user.name?.split(" ")[0] ?? user.username ?? "Someone";

// "Run a 10K under 50 min · Lisbon": the starter's goal, cut at a word boundary.
export function circleName(goal: string, place?: string | null): string {
  const clean = goal.replace(/\s+/g, " ").trim();
  let short = clean;
  if (short.length > 32) {
    short = short.slice(0, 32);
    short = short.slice(0, Math.max(short.lastIndexOf(" "), 16)).trim();
  }
  return place ? `${short} · ${place}` : short;
}

// Stored rounded to about 11 km, and only when someone asks for nearby matches.
export async function saveApproxLocation(userId: string, location: ApproxLocation) {
  const round = (n: number) => Math.round(n * 10) / 10;
  await prisma.user.update({
    where: { id: userId },
    data: {
      approxLatitude: round(location.latitude),
      approxLongitude: round(location.longitude),
      approxPlace: location.place?.slice(0, 60) || null,
    },
  });
}

async function requireFreePlan(userId: string, planId: string, tx: Prisma.TransactionClient) {
  const plan = await tx.plan.findFirst({
    where: { id: planId, userId, deletedAt: null, archivedAt: null },
    include: { circleMember: true },
  });
  if (!plan) throw new CircleError("Choose one of your active plans");
  if (plan.circleMember) throw new CircleError("This plan is already in a circle");
  return plan;
}

// Every circle is open: discoverable and matchable, and invite links still work.
// The starter is pending like anyone else until their first photo log.
export async function startCircle(
  userId: string,
  planId: string,
  preferences: MatchPreferences,
): Promise<{ id: string }> {
  const created = await prisma.$transaction(async (tx) => {
    const plan = await requireFreePlan(userId, planId, tx);
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { approxPlace: true } });
    return tx.circle.create({
      data: {
        name: circleName(plan.goal, preferences.wantsNearby ? user.approxPlace : null),
        emoji: plan.emoji || "✨",
        inviteCode: randomUUID(),
        members: { create: { userId, planId, role: "OWNER", ...preferenceFields(preferences) } },
      },
      select: { id: true },
    });
  });
  await recordCircleEvent("JOINED", { userId, circleId: created.id, planId });
  return created;
}

type JoinVia = "match" | "invite";

// Joining is immediate, with no owner approval, but you're pending until your first
// photo log on the plan: nobody sees you in the circle until then.
export async function joinCircle(
  userId: string,
  circleId: string,
  planId: string,
  preferences: MatchPreferences,
  via: JoinVia,
): Promise<{ id: string; pending: true }> {
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "public"."circles" WHERE "id" = ${circleId} FOR UPDATE`;
    const circle = await tx.circle.findUnique({
      where: { id: circleId },
      include: { members: { select: { userId: true } } },
    });
    if (!circle) throw new CircleError("Circle not found");
    if (circle.members.some((m) => m.userId === userId))
      throw new CircleError("You're already in this circle");
    await requireFreePlan(userId, planId, tx);
    const hidden = new Set(await blockedUserIds(userId));
    if (circle.members.some((m) => hidden.has(m.userId)))
      throw new CircleError("This circle isn't available");
    // Pending members hold a spot, so a circle can't be overfilled while people post their proof.
    const limit = via === "invite" ? CIRCLE_CAP : MATCHING_TARGET;
    if (circle.members.length >= limit)
      throw new CircleError(via === "invite" ? "This circle is full" : "This circle just filled up");
    await tx.circleMember.create({ data: { circleId, userId, planId, ...preferenceFields(preferences) } });
  });
  await recordCircleEvent("JOINED", { userId, circleId, planId });
  return { id: circleId, pending: true };
}

export async function joinByInvite(
  userId: string,
  inviteCode: string,
  planId: string,
  preferences: MatchPreferences,
) {
  const circle = await prisma.circle.findUnique({ where: { inviteCode }, select: { id: true } });
  if (!circle) throw new CircleError("This invite link doesn't work anymore");
  return joinCircle(userId, circle.id, planId, preferences, "invite");
}

export async function invitePreview(userId: string, inviteCode: string): Promise<CircleCard> {
  const circle = await prisma.circle.findUnique({ where: { inviteCode }, select: { id: true } });
  if (!circle) throw new CircleError("This invite link doesn't work anymore");
  const [card] = await circleCards([circle.id], new Map(), await blockedUserIds(userId));
  if (!card) throw new CircleError("This invite link doesn't work anymore");
  return card;
}

// "Later" on the photo prompt: they stay pending, and the coach nudges once the next day.
export async function skipProof(userId: string, circleId: string): Promise<void> {
  const member = await prisma.circleMember.findUnique({ where: { circleId_userId: { circleId, userId } } });
  if (!member || member.provenAt) return;
  await recordCircleEvent("PROOF_SKIPPED", { userId, circleId, planId: member.planId });
}

// Leaving keeps your own history. The longest-standing member takes over as owner,
// and a circle with fewer than 3 proven people goes back to forming.
export async function leaveCircle(userId: string, circleId: string): Promise<void> {
  const left = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "public"."circles" WHERE "id" = ${circleId} FOR UPDATE`;
    const member = await tx.circleMember.findUnique({ where: { circleId_userId: { circleId, userId } } });
    if (!member) return null;
    await tx.circleMember.delete({ where: { circleId_userId: { circleId, userId } } });
    await settleAfterLeaving(tx, circleId, member.role === "OWNER");
    return member;
  });
  if (left) {
    await recordCircleEvent("LEFT", { userId, circleId, planId: left.planId });
    await syncCircleChat(circleId);
  }
}

export async function settleAfterLeaving(tx: Prisma.TransactionClient, circleId: string, ownerLeft: boolean) {
  const rest = await tx.circleMember.findMany({ where: { circleId }, orderBy: { joinedAt: "asc" } });
  if (!rest.length) {
    await tx.circle.delete({ where: { id: circleId } });
    return;
  }
  if (ownerLeft) {
    const next = rest.find((m) => m.provenAt) ?? rest[0];
    await tx.circleMember.update({
      where: { circleId_userId: { circleId, userId: next.userId } },
      data: { role: "OWNER" },
    });
  }
  if (rest.filter((m) => m.provenAt).length < ACTIVE_AT)
    await tx.circle.update({ where: { id: circleId }, data: { status: "FORMING" } });
}

async function requireOwner(userId: string, circleId: string) {
  const member = await prisma.circleMember.findUnique({ where: { circleId_userId: { circleId, userId } } });
  if (!member) throw new CircleError("Circle not found");
  if (member.role !== "OWNER") throw new CircleError("Only the circle's owner can do that");
}

// The owner's settings: the circle's name, and whether the coach posts in its chat.
export async function updateCircle(
  userId: string,
  circleId: string,
  changes: { name?: string; coachPosts?: boolean },
) {
  await requireOwner(userId, circleId);
  await prisma.circle.update({ where: { id: circleId }, data: changes });
  if (changes.name) await syncCircleChat(circleId);
}

// Each member's own switch: no pushes from this circle's chat or the coach's posts.
export async function muteCircle(userId: string, circleId: string, muted: boolean) {
  const { count } = await prisma.circleMember.updateMany({ where: { circleId, userId }, data: { muted } });
  if (!count) throw new CircleError("Join this circle to change its notifications");
}

export async function removeMember(ownerId: string, circleId: string, memberId: string) {
  await requireOwner(ownerId, circleId);
  if (ownerId === memberId) throw new CircleError("Leave the circle instead");
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "public"."circles" WHERE "id" = ${circleId} FOR UPDATE`;
    const removed = await tx.circleMember.deleteMany({ where: { circleId, userId: memberId } });
    if (removed.count) await settleAfterLeaving(tx, circleId, false);
  });
  await syncCircleChat(circleId);
}

export interface MyCircle {
  id: string;
  name: string;
  emoji: string;
  status: "FORMING" | "ACTIVE";
  planId: string;
  memberCount: number;
  onTrack: number;
  daysLeft: number;
  // Waiting for this person's first photo log on the circle plan.
  pending: boolean;
  hasIntro: boolean;
  people: { name: string | null; picture: string | null; onTrack: boolean; isMe: boolean }[];
}

// Compact view for Home squares and plan pages.
export async function myCircles(userId: string): Promise<MyCircle[]> {
  const memberships = await prisma.circleMember.findMany({
    where: { userId, plan: { deletedAt: null, archivedAt: null } },
    orderBy: { joinedAt: "asc" },
    select: { circleId: true },
  });
  const boards = await Promise.all(memberships.map((m) => circleBoard(userId, m.circleId)));
  return boards.map((board) => {
    const me = board.members.find((m) => m.user.id === userId);
    const onTrack = (m: (typeof board.members)[number]) => !m.week.behind;
    return {
      id: board.id,
      name: board.name,
      emoji: board.emoji,
      status: board.status,
      planId: board.me.planId,
      memberCount: board.members.filter((m) => !m.pending).length,
      onTrack: board.members.filter((m) => !m.pending && onTrack(m)).length,
      daysLeft: me?.week.daysLeft ?? 0,
      pending: board.me.pending,
      hasIntro: board.me.hasIntro,
      people: board.members
        .filter((m) => !m.pending || m.user.id === userId)
        .map((m) => ({
          name: m.user.name?.split(" ")[0] ?? m.user.username,
          picture: m.user.picture,
          onTrack: onTrack(m),
          isMe: m.user.id === userId,
        })),
    };
  });
}

// A pending member's first photo log proves they're in: the circle hears they joined,
// and a forming circle with 3 proven people starts its board.
async function proveMembership(
  member: { circleId: string; userId: string; planId: string },
  circle: { id: string; name: string; emoji: string; status: "FORMING" | "ACTIVE" },
  user: { name: string | null; username: string | null },
) {
  const now = new Date();
  const proven = await prisma.circleMember.updateMany({
    where: { circleId: member.circleId, userId: member.userId, provenAt: null },
    data: { provenAt: now },
  });
  if (!proven.count) return;
  await recordCircleEvent("PROVED", member);
  await syncCircleChat(member.circleId);
  const hidden = new Set(await blockedUserIds(member.userId));
  const members = await prisma.circleMember.findMany({
    where: { circleId: member.circleId, provenAt: { not: null } },
    select: { userId: true },
  });
  const label = circleLabel(circle);
  if (circle.status === "FORMING" && members.length >= ACTIVE_AT) {
    await prisma.circle.update({ where: { id: circle.id }, data: { status: "ACTIVE" } });
    await notifyCircle(
      members.map((m) => m.userId),
      circle,
      "Your circle is ready",
      `${label}: ${othersLabel(members.length - 1)} with a similar goal. The board starts now.`,
      `circle-ready:${circle.id}`,
    );
    return;
  }
  const name = firstName(user);
  await notifyCircle(
    members.map((m) => m.userId).filter((id) => id !== member.userId && !hidden.has(id)),
    circle,
    `${name} joined`,
    `${name} joined ${label} with their first session.`,
    `circle-joined:${circle.id}:${member.userId}`,
  );
}

// Called after any activity is logged or gets photos. A member's first photo log on
// their circle plan is both their proof and their intro.
export async function onEntryLogged(entry: {
  id: string;
  userId: string;
  activityId: string | null;
  imageUrls?: string[] | null;
  imageUrl?: string | null;
}) {
  if (!entry.activityId || !(entry.imageUrls?.length || entry.imageUrl)) return;
  try {
    const membership = await prisma.circleMember.findFirst({
      where: { userId: entry.userId, provenAt: null, plan: { activities: { some: { id: entry.activityId } } } },
      include: { circle: true, user: { select: { name: true, username: true } } },
    });
    if (!membership) return;
    if (!(await proofEntryId(entry.userId, membership.planId, membership.joinedAt))) return;
    await proveMembership(membership, membership.circle, membership.user);
  } catch (error) {
    logger.error("Circle proof check failed", { entryId: entry.id, error });
  }
}
