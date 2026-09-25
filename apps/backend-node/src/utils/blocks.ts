import { prisma } from "./prisma";

// Blocking works both ways: the people `userId` blocked and the people who blocked `userId`
// are hidden from each other everywhere (feed, comments, messages, circles, profiles).
export async function blockedUserIds(userId: string): Promise<string[]> {
  const blocks = await prisma.userBlock.findMany({
    where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
    select: { blockerId: true, blockedId: true },
  });
  return blocks.map((block) =>
    block.blockerId === userId ? block.blockedId : block.blockerId
  );
}

export async function isBlockedPair(a: string, b: string): Promise<boolean> {
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
