import { TZDate } from "@date-fns/tz";
import { Prisma } from "@tsw/prisma";
import { logger } from "../../../utils/logger";
import { prisma } from "../../../utils/prisma";
import { notificationService } from "../../notificationService";
import { plansService } from "../../plansService";
import { circleBoard } from "../board/service";
import { togetherStreak, type MemberHistory } from "../board/model";
import { ensureCircleChat } from "../chat";
import { HALFWAY_HOUR, RECAP_HOUR } from "../config";
import { circleLabel } from "../notify";
import { halfwayPost, weekRecapPost, type RecapPerson } from "./model";

const COACH_NAME = "Helly";

interface CircleRef {
  id: string;
  name: string;
  emoji: string;
}

const firstName = (user: { name: string | null; username: string | null }) =>
  user.name?.split(" ")[0] ?? user.username ?? "Someone";

// Posts once per key (a circle and a week): the coach's message in the circle chat,
// and a push to every member that opens the chat.
export async function postCoachMessage(circle: CircleRef, content: string, key: string, headline: string) {
  const chatId = await ensureCircleChat(circle);
  const already = await prisma.message.findFirst({
    where: { chatId, role: "COACH", metadata: { path: ["postKey"], equals: key } },
    select: { id: true },
  });
  if (already) return false;
  await prisma.message.create({
    data: {
      chatId,
      role: "COACH",
      content,
      metadata: { source: "circle_coach", postKey: key, coachName: COACH_NAME, circleId: circle.id },
    },
  });
  await prisma.chat.update({ where: { id: chatId }, data: { updatedAt: new Date() } });
  const members = await prisma.circleMember.findMany({
    where: { circleId: circle.id, provenAt: { not: null } },
    select: { userId: true },
  });
  for (const { userId } of members) {
    try {
      await notificationService.createAndProcessNotification({
        userId,
        type: "CIRCLE",
        title: `${COACH_NAME} · ${circleLabel(circle)}`,
        message: headline,
        relatedId: chatId,
        relatedData: { url: `/chat/${chatId}`, chatId, circleId: circle.id },
        dedupeKey: `${key}:${userId}`,
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"))
        logger.error("Could not notify a circle about a coach post", { circleId: circle.id, userId, error });
    }
  }
  return true;
}

// Last finished week for everyone who was already in the circle when it started.
async function lastWeek(circleId: string) {
  const members = await prisma.circleMember.findMany({
    where: { circleId, provenAt: { not: null }, user: { deletedAt: null } },
    include: { user: true, plan: { include: { activities: true } } },
  });
  const histories: MemberHistory[] = [];
  const people: (RecapPerson & { weekStart: string })[] = [];
  for (const m of members) {
    const progress = await plansService.getPlanProgress(m.plan, m.user).catch(() => null);
    const weeks = (progress?.weeks ?? []) as MemberHistory["weeks"];
    histories.push({ proven: true, name: firstName(m.user), joinedAt: m.joinedAt, weeks });
    const finished = weeks.filter((w) => w.outcome).at(-1);
    if (!finished || m.joinedAt > new Date(finished.startDate)) continue;
    people.push({
      name: firstName(m.user),
      done: finished.doneCount ?? 0,
      target: finished.targetCount ?? 0,
      hit: finished.outcome === "complete" || finished.outcome === "held",
      weekStart: new Date(finished.startDate).toISOString().slice(0, 10),
    });
  }
  return { people, streak: togetherStreak(histories) };
}

async function weekRecap(circle: CircleRef) {
  const { people, streak } = await lastWeek(circle.id);
  const content = weekRecapPost(people, streak);
  if (!content) return false;
  const missed = people.filter((p) => !p.hit).map((p) => p.name);
  const headline = missed.length
    ? `Week recap is up. ${missed.join(", ")} could use some support.`
    : "Week recap is up. Everyone hit their week 🔥";
  return postCoachMessage(circle, content, `recap:${circle.id}:${people[0].weekStart}`, headline);
}

async function halfwayCheck(circle: CircleRef, ownerId: string, now: Date) {
  const board = await circleBoard(ownerId, circle.id, now);
  const behind = board.members
    .filter((m) => !m.pending && m.week.behind)
    .map((m) => ({ name: firstName(m.user), toGo: m.week.toGo, daysLeft: m.week.daysLeft }));
  const content = halfwayPost(behind);
  if (!content) return false;
  return postCoachMessage(
    circle,
    content,
    `halfway:${circle.id}:${now.toISOString().slice(0, 10)}`,
    `Halfway check: ${behind.map((b) => b.name).join(", ")} could use a push.`,
  );
}

// Sunday evening recap and a Thursday halfway check, in the owner's time zone.
export async function circleCoachPosts(now = new Date()): Promise<number> {
  const circles = await prisma.circle.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      name: true,
      emoji: true,
      members: { where: { role: "OWNER" }, select: { userId: true, user: { select: { timezone: true } } } },
    },
  });
  let posted = 0;
  for (const circle of circles) {
    const owner = circle.members[0];
    if (!owner) continue;
    const local = new TZDate(now, owner.user.timezone || "UTC");
    try {
      if (local.getDay() === 0 && local.getHours() === RECAP_HOUR && (await weekRecap(circle))) posted += 1;
      if (local.getDay() === 4 && local.getHours() === HALFWAY_HOUR && (await halfwayCheck(circle, owner.userId, now)))
        posted += 1;
    } catch (error) {
      logger.error("Circle coach post failed", { circleId: circle.id, error });
    }
  }
  return posted;
}
