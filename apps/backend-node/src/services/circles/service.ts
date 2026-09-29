import { randomUUID } from "node:crypto";
import type { Prisma } from "@tsw/prisma";
import { blockedUserIds } from "../../utils/blocks";
import { logger } from "../../utils/logger";
import { prisma } from "../../utils/prisma";
import { circleBoard, introEntryId } from "./board/service";
import { circleCards } from "./cards";
import { ACTIVE_AT, CIRCLE_CAP, MATCHING_TARGET } from "./config";
import { circleLabel, notifyCircle } from "./notify";
import { CircleError } from "./errors";
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

export async function startCircle(
  userId: string,
  planId: string,
  preferences: MatchPreferences,
  openToMatching: boolean,
): Promise<{ id: string }> {
  return prisma.$transaction(async (tx) => {
    const plan = await requireFreePlan(userId, planId, tx);
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { approxPlace: true } });
    return tx.circle.create({
      data: {
        name: circleName(plan.goal, preferences.wantsNearby ? user.approxPlace : null),
        emoji: plan.emoji || "✨",
        inviteCode: randomUUID(),
        openToMatching,
        discoverable: openToMatching,
        members: { create: { userId, planId, role: "OWNER", ...preferenceFields(preferences) } },
      },
      select: { id: true },
    });
  });
}

type JoinVia = "match" | "invite";

// Joining happens straight away, with no owner approval: a circle needs people most in its first days.
export async function joinCircle(
  userId: string,
  circleId: string,
  planId: string,
  preferences: MatchPreferences,
  via: JoinVia,
): Promise<{ id: string; status: "FORMING" | "ACTIVE" }> {
  const joined = await prisma.$transaction(async (tx) => {
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
    const limit = via === "invite" ? CIRCLE_CAP : MATCHING_TARGET;
    if (via === "match" && !circle.openToMatching)
      throw new CircleError("This circle only takes people by invite");
    if (circle.members.length >= limit)
      throw new CircleError(via === "invite" ? "This circle is full" : "This circle just filled up");
    await tx.circleMember.create({ data: { circleId, userId, planId, ...preferenceFields(preferences) } });
    const count = circle.members.length + 1;
    const becameActive = circle.status === "FORMING" && count >= ACTIVE_AT;
    if (becameActive) await tx.circle.update({ where: { id: circleId }, data: { status: "ACTIVE" } });
    return { circle, becameActive, others: circle.members.map((m) => m.userId) };
  });

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true, username: true } });
  const label = circleLabel(joined.circle);
  if (joined.becameActive)
    await notifyCircle(
      [...joined.others, userId],
      joined.circle,
      "Your circle is ready",
      `${label}: you and ${joined.others.length} others with a similar goal. The board starts now.`,
      `circle-ready:${circleId}`,
    );
  else
    await notifyCircle(joined.others, joined.circle, `${firstName(user)} joined`, `${firstName(user)} joined ${label}.`);
  return { id: circleId, status: joined.becameActive ? "ACTIVE" : joined.circle.status };
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

// Leaving keeps your own history. The longest-standing member takes over as owner,
// and a circle that drops below 3 goes back to forming.
export async function leaveCircle(userId: string, circleId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "public"."circles" WHERE "id" = ${circleId} FOR UPDATE`;
    const member = await tx.circleMember.findUnique({ where: { circleId_userId: { circleId, userId } } });
    if (!member) return;
    await tx.circleMember.delete({ where: { circleId_userId: { circleId, userId } } });
    await settleAfterLeaving(tx, circleId, member.role === "OWNER");
  });
}

async function settleAfterLeaving(tx: Prisma.TransactionClient, circleId: string, ownerLeft: boolean) {
  const rest = await tx.circleMember.findMany({ where: { circleId }, orderBy: { joinedAt: "asc" } });
  if (!rest.length) {
    await tx.circle.delete({ where: { id: circleId } });
    return;
  }
  if (ownerLeft)
    await tx.circleMember.update({
      where: { circleId_userId: { circleId, userId: rest[0].userId } },
      data: { role: "OWNER" },
    });
  if (rest.length < ACTIVE_AT)
    await tx.circle.update({ where: { id: circleId }, data: { status: "FORMING" } });
}

async function requireOwner(userId: string, circleId: string) {
  const member = await prisma.circleMember.findUnique({ where: { circleId_userId: { circleId, userId } } });
  if (!member) throw new CircleError("Circle not found");
  if (member.role !== "OWNER") throw new CircleError("Only the circle's owner can do that");
}

export async function updateCircle(
  userId: string,
  circleId: string,
  changes: { name?: string; openToMatching?: boolean; discoverable?: boolean },
) {
  await requireOwner(userId, circleId);
  await prisma.circle.update({ where: { id: circleId }, data: changes });
}

export async function removeMember(ownerId: string, circleId: string, memberId: string) {
  await requireOwner(ownerId, circleId);
  if (ownerId === memberId) throw new CircleError("Leave the circle instead");
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "public"."circles" WHERE "id" = ${circleId} FOR UPDATE`;
    const removed = await tx.circleMember.deleteMany({ where: { circleId, userId: memberId } });
    if (removed.count) await settleAfterLeaving(tx, circleId, false);
  });
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
  // Whether this person has logged their first session on the circle plan yet.
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
      memberCount: board.members.length,
      onTrack: board.members.filter(onTrack).length,
      daysLeft: me?.week.daysLeft ?? 0,
      hasIntro: board.me.hasIntro,
      people: board.members.map((m) => ({
        name: m.user.name?.split(" ")[0] ?? m.user.username,
        picture: m.user.picture,
        onTrack: onTrack(m),
        isMe: m.user.id === userId,
      })),
    };
  });
}

// Called after any activity is logged. A member's first log on their circle plan
// is their intro, and the rest of the circle hears about it once.
export async function onEntryLogged(entry: { id: string; userId: string; activityId: string | null }) {
  if (!entry.activityId) return;
  try {
    const membership = await prisma.circleMember.findFirst({
      where: { userId: entry.userId, plan: { activities: { some: { id: entry.activityId } } } },
      include: { circle: { include: { members: { select: { userId: true } } } }, user: true },
    });
    if (!membership) return;
    const intro = await introEntryId(entry.userId, membership.planId, membership.joinedAt);
    if (intro !== entry.id) return;
    const hidden = new Set(await blockedUserIds(entry.userId));
    const others = membership.circle.members.map((m) => m.userId).filter((id) => id !== entry.userId && !hidden.has(id));
    const name = firstName(membership.user);
    await notifyCircle(
      others,
      membership.circle,
      `${name} said hi`,
      `${name} logged their first session in ${circleLabel(membership.circle)}.`,
      `circle-intro:${membership.circleId}:${entry.userId}`,
    );
  } catch (error) {
    logger.error("Circle intro notification failed", { entryId: entry.id, error });
  }
}
