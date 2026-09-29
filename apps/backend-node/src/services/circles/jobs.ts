import { TZDate } from "@date-fns/tz";
import { subDays } from "date-fns";
import { logger } from "../../utils/logger";
import { prisma } from "../../utils/prisma";
import { circleBoard } from "./board/service";
import { recapMessage } from "./board/model";
import { ACTIVE_AT, MATCHING_TARGET, RECAP_HOUR, STALLED_AFTER_DAYS } from "./config";
import { mergeableInto } from "./matching/service";
import { circleLabel, notifyCircle } from "./notify";

const memberSelect = {
  userId: true,
  planId: true,
  wantsPace: true,
  wantsNearby: true,
  wantsAge: true,
} as const;

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
        if (target.members.length + source.members.length >= ACTIVE_AT)
          await tx.circle.update({ where: { id: target.id }, data: { status: "ACTIVE" } });
      });
      gone.add(source.id);
      merges += 1;
      const everyone = [...target.members, ...source.members].map((m) => m.userId);
      if (everyone.length >= ACTIVE_AT)
        await notifyCircle(
          everyone,
          target,
          "Your circle is ready",
          `${circleLabel(target)}: you and ${everyone.length - 1} others with a similar goal. The board starts now.`,
          `circle-ready:${target.id}`,
        );
      else
        await notifyCircle(
          source.members.map((m) => m.userId),
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

// Sunday evening in each member's own time zone: how last week went for the circle.
export async function sundayRecaps(now = new Date()): Promise<number> {
  const memberships = await prisma.circleMember.findMany({
    where: { circle: { status: "ACTIVE" }, user: { deletedAt: null } },
    include: { user: { select: { timezone: true } }, circle: true },
  });
  let sent = 0;
  for (const m of memberships) {
    const local = new TZDate(now, m.user.timezone || "UTC");
    if (local.getDay() !== 0 || local.getHours() !== RECAP_HOUR) continue;
    try {
      const board = await circleBoard(m.userId, m.circleId, now);
      if (!board.recap) continue;
      await notifyCircle(
        [m.userId],
        m.circle,
        `Sunday recap · ${circleLabel(m.circle)}`,
        recapMessage(board.recap, board.togetherStreak),
        `circle-recap:${m.circleId}:${board.recap.weekStart}`,
      );
      sent += 1;
    } catch (error) {
      logger.error("Circle recap failed", { circleId: m.circleId, userId: m.userId, error });
    }
  }
  return sent;
}

export async function runCircleJobs(now = new Date()) {
  const merged = await mergeFormingCircles();
  const stalled = await stalledNotices(now);
  const recaps = await sundayRecaps(now);
  logger.info("Circle jobs finished", { merged, stalled, recaps });
}
