import { randomUUID } from "node:crypto";
import { Prisma } from "@tsw/prisma";
import { prisma } from "../../../utils/prisma";
const person = { id: true, name: true, username: true, picture: true } as const;
const summary = {
  id: true,
  name: true,
  topic: true,
  discoverable: true,
  _count: { select: { members: true } },
} as const;
export async function circles(userId: string, search: string) {
  const [mine, discover] = await Promise.all([
    prisma.practiceCircle.findMany({
      where: { members: { some: { userId } } },
      select: summary,
      orderBy: { createdAt: "desc" },
    }),
    prisma.practiceCircle.findMany({
      where: {
        discoverable: true,
        members: { none: { userId } },
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" as const } },
                { topic: { contains: search, mode: "insensitive" as const } },
              ],
            }
          : {}),
      },
      select: summary,
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ]);
  return { mine, discover };
}
async function requirePlan(
  userId: string,
  planId: string,
  tx: Prisma.TransactionClient,
) {
  const plan = await tx.plan.findFirst({
    where: { id: planId, userId, deletedAt: null, archivedAt: null },
  });
  if (!plan) throw new Error("Choose one of your active plans");
  return plan;
}
export async function createCircle(
  userId: string,
  name: string,
  topic: string,
  planId: string,
  discoverable: boolean,
) {
  return prisma.$transaction(async (tx) => {
    await requirePlan(userId, planId, tx);
    return tx.practiceCircle.create({
      data: {
        name,
        topic,
        discoverable,
        inviteCode: randomUUID(),
        members: { create: { userId, planId, owner: true } },
      },
      select: { id: true },
    });
  });
}
export async function joinCircle(
  userId: string,
  planId: string,
  id?: string,
  inviteCode?: string,
) {
  return prisma.$transaction(async (tx) => {
    await requirePlan(userId, planId, tx);
    const circle = await tx.practiceCircle.findFirst({
      where: inviteCode ? { inviteCode } : { id, discoverable: true },
    });
    if (!circle) throw new Error("Circle not found. Check your invite code.");
    await tx.$queryRaw`SELECT id FROM practice_circles WHERE id = ${circle.id} FOR UPDATE`;
    const member = await tx.practiceCircleMember.findUnique({
      where: { circleId_userId: { circleId: circle.id, userId } },
    });
    if (member) return { id: circle.id };
    if (
      (await tx.practiceCircleMember.count({
        where: { circleId: circle.id },
      })) >= 12
    )
      throw new Error("This circle is full (12 people)");
    await tx.practiceCircleMember.create({
      data: { circleId: circle.id, userId, planId },
    });
    return { id: circle.id };
  });
}
async function requireMember(
  userId: string,
  circleId: string,
  tx: Prisma.TransactionClient = prisma,
) {
  const member = await tx.practiceCircleMember.findUnique({
    where: { circleId_userId: { circleId, userId } },
  });
  if (!member) throw new Error("Join this circle to see its activity");
  return member;
}
export async function circleDetail(userId: string, id: string) {
  await requireMember(userId, id);
  return prisma.practiceCircle.findUniqueOrThrow({
    where: { id },
    select: {
      ...summary,
      inviteCode: true,
      members: {
        where: { user: { deletedAt: null }, plan: { deletedAt: null } },
        select: {
          user: { select: person },
          plan: { select: { id: true, goal: true, emoji: true } },
          owner: true,
        },
      },
      posts: {
        where: {
          entry: { deletedAt: null },
          user: {
            deletedAt: null,
            circleMemberships: {
              some: { circleId: id, plan: { deletedAt: null } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          user: { select: person },
          createdAt: true,
          entry: {
            select: {
              id: true,
              datetime: true,
              quantity: true,
              activity: { select: { title: true, emoji: true, measure: true } },
            },
          },
        },
      },
    },
  });
}
export async function shareLog(
  userId: string,
  circleId: string,
  entryId: string,
) {
  return prisma.$transaction(async (tx) => {
    const member = await requireMember(userId, circleId, tx);
    const entry = await tx.activityEntry.findFirst({
      where: {
        id: entryId,
        userId,
        deletedAt: null,
        activity: { plans: { some: { id: member.planId } } },
      },
    });
    if (!entry)
      throw new Error("Choose one of your logs from the plan you joined with");
    return tx.practiceCirclePost.upsert({
      where: { circleId_entryId: { circleId, entryId } },
      create: { circleId, userId, entryId },
      update: {},
    });
  });
}
export async function leaveCircle(userId: string, circleId: string) {
  await prisma.$transaction(async (tx) => {
    const member = await requireMember(userId, circleId, tx);
    await tx.practiceCirclePost.deleteMany({ where: { circleId, userId } });
    await tx.practiceCircleMember.delete({
      where: { circleId_userId: { circleId, userId } },
    });
    const next = await tx.practiceCircleMember.findFirst({
      where: { circleId },
      orderBy: { joinedAt: "asc" },
    });
    if (!next) await tx.practiceCircle.delete({ where: { id: circleId } });
    else if (member.owner)
      await tx.practiceCircleMember.update({
        where: { circleId_userId: { circleId, userId: next.userId } },
        data: { owner: true },
      });
  });
}
export async function unshareLog(
  userId: string,
  circleId: string,
  postId: string,
) {
  await requireMember(userId, circleId);
  await prisma.practiceCirclePost.deleteMany({
    where: { id: postId, circleId, userId },
  });
}
