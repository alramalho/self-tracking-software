import { TZDate } from "@date-fns/tz";
import { startOfDay, startOfWeek } from "date-fns";
import { blockedUserIds } from "../../../utils/blocks";
import { prisma } from "../../../utils/prisma";
import { plansService } from "../../plansService";
import { paceLabel, sharedPlace } from "../cards";
import { CIRCLE_CAP } from "../config";
import { CircleError } from "../errors";
import { weeklyTarget } from "../matching/profiles";
import { lastWeekRecap, memberWeek, togetherStreak, type MemberHistory } from "./model";
import type { BoardMember, CircleBoard } from "../types";

const person = { id: true, name: true, username: true, picture: true } as const;

export async function requireMember(userId: string, circleId: string) {
  const member = await prisma.circleMember.findUnique({
    where: { circleId_userId: { circleId, userId } },
  });
  if (!member) throw new CircleError("Join this circle to see its week");
  return member;
}

// Start of "today" and "this week" where the person lives.
export function localStarts(timezone: string | null, now = new Date()) {
  const local = new TZDate(now, timezone || "UTC");
  return {
    day: new Date(startOfDay(local).getTime()),
    week: new Date(startOfWeek(local, { weekStartsOn: 0 }).getTime()),
  };
}

// First log on the circle plan after joining: that log is the person's intro.
export async function introEntryId(
  userId: string,
  planId: string,
  joinedAt: Date,
): Promise<string | null> {
  const entry = await prisma.activityEntry.findFirst({
    where: {
      userId,
      deletedAt: null,
      createdAt: { gte: joinedAt },
      activity: { plans: { some: { id: planId } } },
    },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return entry?.id ?? null;
}

export async function circleBoard(viewerId: string, circleId: string, now = new Date()): Promise<CircleBoard> {
  const me = await requireMember(viewerId, circleId);
  // Blocked people stay in the circle but disappear from each other's view.
  const hidden = await blockedUserIds(viewerId);
  const circle = await prisma.circle.findUniqueOrThrow({
    where: { id: circleId },
    include: {
      members: {
        where: { OR: [{ userId: viewerId }, { userId: { notIn: hidden } }], user: { deletedAt: null } },
        orderBy: { joinedAt: "asc" },
        include: {
          user: true,
          plan: { include: { activities: true } },
        },
      },
    },
  });
  const viewer = circle.members.find((m) => m.userId === viewerId)?.user;
  const today = localStarts(viewer?.timezone ?? null, now).day;
  const nudged = new Set(
    (
      await prisma.circleNudge.findMany({
        where: { circleId, fromId: viewerId, createdAt: { gte: today } },
        select: { toId: true },
      })
    ).map((n) => n.toId),
  );

  const histories: MemberHistory[] = [];
  const members: BoardMember[] = await Promise.all(
    circle.members.map(async (m) => {
      const [stats, progress, intro] = await Promise.all([
        plansService.getPlanWeekStats(m.plan, m.user, now),
        plansService.getPlanProgress(m.plan, m.user).catch(() => null),
        introEntryId(m.userId, m.planId, m.joinedAt),
      ]);
      histories.push({
        name: m.user.name?.split(" ")[0] ?? m.user.username,
        joinedAt: m.joinedAt,
        weeks: (progress?.weeks ?? []) as MemberHistory["weeks"],
      });
      return {
        user: { id: m.user.id, name: m.user.name, username: m.user.username, picture: m.user.picture },
        plan: { id: m.plan.id, goal: m.plan.goal, emoji: m.plan.emoji },
        role: m.role,
        joinedAt: m.joinedAt,
        week: memberWeek(stats, m.joinedAt, localStarts(m.user.timezone, now).week),
        hasIntro: !!intro,
        nudgedToday: nudged.has(m.userId),
      };
    }),
  );
  const mine = members.find((m) => m.user.id === viewerId);
  return {
    id: circle.id,
    name: circle.name,
    emoji: circle.emoji,
    status: circle.status,
    inviteCode: circle.inviteCode,
    openToMatching: circle.openToMatching,
    discoverable: circle.discoverable,
    place: sharedPlace(circle.members.map((m) => m.user.approxPlace)),
    paceLabel: paceLabel(circle.members.map((m) => weeklyTarget(m.plan))),
    cap: CIRCLE_CAP,
    me: { role: me.role, planId: me.planId, hasIntro: !!mine?.hasIntro },
    members,
    togetherStreak: circle.status === "ACTIVE" ? togetherStreak(histories) : 0,
    recap: circle.status === "ACTIVE" ? lastWeekRecap(histories) : null,
  };
}

// The circle's logs since each person joined, newest first, shaped like timeline entries.
export async function circleFeed(viewerId: string, circleId: string, limit = 30) {
  await requireMember(viewerId, circleId);
  const hidden = await blockedUserIds(viewerId);
  const members = await prisma.circleMember.findMany({
    where: { circleId, userId: { notIn: hidden }, user: { deletedAt: null } },
    select: { userId: true, planId: true, joinedAt: true },
  });
  if (!members.length) return { entries: [], introIds: [] };
  const visibleComments = { deletedAt: null, userId: { notIn: hidden } };
  const entries = await prisma.activityEntry.findMany({
    where: {
      deletedAt: null,
      OR: members.map((m) => ({
        userId: m.userId,
        createdAt: { gte: m.joinedAt },
        activity: { plans: { some: { id: m.planId } } },
      })),
    },
    orderBy: [{ datetime: "desc" }, { id: "desc" }],
    take: limit,
    select: {
      id: true,
      userId: true,
      activityId: true,
      quantity: true,
      datetime: true,
      timezone: true,
      description: true,
      difficulty: true,
      imageUrls: true,
      imageUrl: true,
      createdAt: true,
      activity: { select: { id: true, title: true, emoji: true, measure: true } },
      user: { select: person },
      reactions: {
        where: { userId: { notIn: hidden } },
        include: { user: { select: { id: true, username: true } } },
      },
      comments: {
        where: visibleComments,
        orderBy: { createdAt: "desc" },
        take: 2,
        include: { user: { select: { id: true, username: true, picture: true } } },
      },
      _count: { select: { comments: { where: visibleComments } } },
    },
  });
  const introIds = (
    await Promise.all(members.map((m) => introEntryId(m.userId, m.planId, m.joinedAt)))
  ).filter((id): id is string => !!id);
  return { entries, introIds };
}
