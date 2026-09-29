import { subDays, subHours } from "date-fns";
import { logger } from "../../utils/logger";
import { prisma } from "../../utils/prisma";
import {
  ACTIVE_AT,
  MATCHING_TARGET,
  PENDING_EXPIRES_AFTER_DAYS,
  PROOF_NUDGE_AFTER_HOURS,
  STALLED_AFTER_DAYS,
} from "./config";
import { syncCircleChat } from "./chat";
import { circleCoachPosts } from "./coach/service";
import { recordCircleEvent } from "./events";
import { settleAfterLeaving } from "./service";
import { mergeableInto } from "./matching/service";
import { circleLabel, notifyCircle, othersLabel } from "./notify";

const memberSelect = {
  userId: true,
  planId: true,
  wantsPace: true,
  wantsNearby: true,
  wantsAge: true,
  provenAt: true,
} as const;

const provenCount = (members: { provenAt: Date | null }[]) => members.filter((m) => m.provenAt).length;

// Two forming circles whose people all fit each other become one: the newer
// circle's members move into the older one.
export async function mergeFormingCircles(): Promise<number> {
  const forming = await prisma.circle.findMany({
    where: { status: "FORMING", openToMatching: true },
    orderBy: { createdAt: "asc" },
    include: { members: { select: memberSelect } },
  });
  const gone = new Set<string>();
  let merges = 0;
  for (const target of forming) {
    if (gone.has(target.id)) continue;
    for (const source of forming) {
      if (source.id === target.id || gone.has(source.id) || source.createdAt < target.createdAt) continue;
      if (target.members.length + source.members.length > MATCHING_TARGET) continue;
      const blocked = await prisma.userBlock.count({
        where: {
          OR: [
            { blockerId: { in: source.members.map((m) => m.userId) }, blockedId: { in: target.members.map((m) => m.userId) } },
            { blockerId: { in: target.members.map((m) => m.userId) }, blockedId: { in: source.members.map((m) => m.userId) } },
          ],
        },
      });
      if (blocked || !(await mergeableInto(source.members, target.members))) continue;
      await prisma.$transaction(async (tx) => {
        await tx.circleMember.updateMany({ where: { circleId: source.id }, data: { circleId: target.id, role: "MEMBER" } });
        await tx.circle.delete({ where: { id: source.id } });
        if (provenCount([...target.members, ...source.members]) >= ACTIVE_AT)
          await tx.circle.update({ where: { id: target.id }, data: { status: "ACTIVE" } });
      });
      gone.add(source.id);
      merges += 1;
      await syncCircleChat(target.id);
      const merged = [...target.members, ...source.members];
      const everyone = merged.filter((m) => m.provenAt).map((m) => m.userId);
      if (everyone.length >= ACTIVE_AT)
        await notifyCircle(
          everyone,
          target,
          "Your circle is ready",
          `${circleLabel(target)}: ${othersLabel(everyone.length - 1)} with a similar goal. The board starts now.`,
          `circle-ready:${target.id}`,
        );
      else
        await notifyCircle(
          source.members.filter((m) => m.provenAt).map((m) => m.userId),
          target,
          "We found you company",
          `You're now in ${circleLabel(target)} with someone on a similar goal.`,
        );
      target.members.push(...source.members);
    }
  }
  return merges;
}

// After a week still forming, the owner hears once how to get it going.
export async function stalledNotices(now = new Date()): Promise<number> {
  const stalled = await prisma.circle.findMany({
    where: { status: "FORMING", stalledNoticeAt: null, createdAt: { lte: subDays(now, STALLED_AFTER_DAYS) } },
    include: { members: { select: { userId: true, role: true } } },
  });
  for (const circle of stalled) {
    const owner = circle.members.find((m) => m.role === "OWNER");
    await prisma.circle.update({ where: { id: circle.id }, data: { stalledNoticeAt: now } });
    if (!owner) continue;
    await notifyCircle(
      [owner.userId],
      circle,
      "Your circle is still forming",
      `${circleLabel(circle)} has ${circle.members.length} of ${ACTIVE_AT} people. Invite a friend to get it going. We'll keep adding people with a similar goal.`,
      `circle-stalled:${circle.id}`,
    );
  }
  return stalled.length;
}

// The day after joining without a photo, the coach reminds them once what gets them in.
export async function proofNudges(now = new Date()): Promise<number> {
  const waiting = await prisma.circleMember.findMany({
    where: { provenAt: null, proofNudgedAt: null, joinedAt: { lte: subHours(now, PROOF_NUDGE_AFTER_HOURS) } },
    include: { circle: true, user: { select: { coachPersonality: true } } },
  });
  for (const member of waiting) {
    // The coach steps in, in their own name.
    const coach = member.user.coachPersonality === "STRATEGIST" ? "Oli" : "Helly";
    await prisma.circleMember.update({
      where: { circleId_userId: { circleId: member.circleId, userId: member.userId } },
      data: { proofNudgedAt: now },
    });
    await notifyCircle(
      [member.userId],
      member.circle,
      `${coach} · Your circle is waiting`,
      `Post a photo from your next session to join ${circleLabel(member.circle)}.`,
      `circle-proof:${member.circleId}`,
    );
    await recordCircleEvent("PROOF_NUDGED", member);
  }
  return waiting.length;
}

// A spot held for a week without proof goes back to the circle.
export async function expirePending(now = new Date()): Promise<number> {
  const expired = await prisma.circleMember.findMany({
    where: { provenAt: null, joinedAt: { lte: subDays(now, PENDING_EXPIRES_AFTER_DAYS) } },
  });
  for (const member of expired) {
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "public"."circles" WHERE "id" = ${member.circleId} FOR UPDATE`;
      const removed = await tx.circleMember.deleteMany({
        where: { circleId: member.circleId, userId: member.userId, provenAt: null },
      });
      if (removed.count) await settleAfterLeaving(tx, member.circleId, member.role === "OWNER");
    });
    await recordCircleEvent("EXPIRED", member);
    await syncCircleChat(member.circleId);
  }
  return expired.length;
}

export async function runCircleJobs(now = new Date()) {
  const nudged = await proofNudges(now);
  const expired = await expirePending(now);
  const merged = await mergeFormingCircles();
  const stalled = await stalledNotices(now);
  const coachPosts = await circleCoachPosts(now);
  logger.info("Circle jobs finished", { nudged, expired, merged, stalled, coachPosts });
}
