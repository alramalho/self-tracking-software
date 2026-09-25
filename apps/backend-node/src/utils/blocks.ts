import { prisma } from "./prisma";

// Blocking works both ways: the people `userId` blocked and the people who blocked `userId`
// are hidden from each other everywhere (feed, comments, messages, circles, profiles).
// Suspended accounts are hidden from everyone the same way.
export async function blockedUserIds(userId: string): Promise<string[]> {
  const [blocks, suspended] = await Promise.all([
    prisma.userBlock.findMany({
      where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
      select: { blockerId: true, blockedId: true },
    }),
    prisma.user.findMany({ where: { suspendedAt: { not: null } }, select: { id: true } }),
  ]);
  return [
    ...blocks.map((block) => (block.blockerId === userId ? block.blockedId : block.blockerId)),
    ...suspended.map((user) => user.id),
  ];
}

export async function isBlockedPair(a: string, b: string): Promise<boolean> {
  const suspended = await prisma.user.count({
    where: { id: { in: [a, b] }, suspendedAt: { not: null } },
  });
  if (suspended) return true;
  const block = await prisma.userBlock.findFirst({
    where: {
      OR: [
        { blockerId: a, blockedId: b },
        { blockerId: b, blockedId: a },
      ],
    },
    select: { id: true },
  });
  return !!block;
}
