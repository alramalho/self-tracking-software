import { isBlockedPair } from "../../utils/blocks";
import { prisma } from "../../utils/prisma";
import { plansService } from "../plansService";
import { localStarts, requireMember } from "./board/service";
import { NUDGES_RECEIVED_PER_DAY } from "./config";
import { circleLabel, notifyCircle } from "./notify";
import { CircleError } from "./errors";

export function nudgeMessage(toGo: number, daysLeft: number, circle: string): string {
  const left = toGo === 1 ? "One session left" : `${toGo} sessions left`;
  const days = daysLeft === 1 ? "1 day" : `${daysLeft} days`;
  return `${left} for your week in ${circle}. You have ${days}.`;
}

// One tap, text written by us. One per sender and receiver per day, at most three
// received per day, and none once the person has already hit their week.
export async function nudge(fromId: string, circleId: string, toId: string): Promise<void> {
  if (fromId === toId) throw new CircleError("You can't nudge yourself");
  await requireMember(fromId, circleId);
  const target = await prisma.circleMember.findUnique({
    where: { circleId_userId: { circleId, userId: toId } },
    include: { user: true, plan: { include: { activities: true } }, circle: true },
  });
  if (!target) throw new CircleError("They're not in this circle anymore");
  if (!target.provenAt) throw new CircleError("They haven't posted their first session yet");
  if (await isBlockedPair(fromId, toId)) throw new CircleError("You can't nudge this person");

  const from = await prisma.user.findUniqueOrThrow({
    where: { id: fromId },
    select: { name: true, username: true, timezone: true },
  });
  const [sentToday, receivedToday] = await Promise.all([
    prisma.circleNudge.count({
      where: { fromId, toId, createdAt: { gte: localStarts(from.timezone).day } },
    }),
    prisma.circleNudge.count({
      where: { toId, createdAt: { gte: localStarts(target.user.timezone).day } },
    }),
  ]);
  if (sentToday) throw new CircleError("You already nudged them today");
  if (receivedToday >= NUDGES_RECEIVED_PER_DAY)
    throw new CircleError("They've had enough nudges for today");

  const stats = await plansService.getPlanWeekStats(target.plan, target.user);
  const toGo = Math.max(0, stats.numActiveDaysInTheWeek - stats.daysCompletedThisWeek);
  if (!toGo) throw new CircleError("They've already hit their week");

  await prisma.circleNudge.create({ data: { circleId, fromId, toId } });
  const name = from.name?.split(" ")[0] ?? from.username ?? "Someone";
  await notifyCircle(
    [toId],
    target.circle,
    `${name} nudged you`,
    nudgeMessage(toGo, stats.numLeftDaysInTheWeek, circleLabel(target.circle)),
  );
}
