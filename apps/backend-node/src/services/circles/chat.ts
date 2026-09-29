import { logger } from "../../utils/logger";
import { prisma } from "../../utils/prisma";
import { CircleError } from "./errors";
import { circleLabel } from "./notify";

// The circle's group chat: proven members only, titled after the circle.
// Called whenever membership changes, so leaving or being removed also ends chat access.
export async function syncCircleChat(circleId: string): Promise<void> {
  try {
    const circle = await prisma.circle.findUnique({
      where: { id: circleId },
      select: {
        id: true,
        name: true,
        emoji: true,
        chat: { select: { id: true } },
        members: { where: { provenAt: { not: null } }, select: { userId: true } },
      },
    });
    if (!circle?.chat) return;
    const members = circle.members.map((m) => m.userId);
    await prisma.$transaction([
      prisma.chat.update({ where: { id: circle.chat.id }, data: { title: circleLabel(circle) } }),
      prisma.chatParticipant.deleteMany({ where: { chatId: circle.chat.id, userId: { notIn: members } } }),
      prisma.chatParticipant.createMany({
        data: members.map((userId) => ({ chatId: circle.chat!.id, userId })),
        skipDuplicates: true,
      }),
    ]);
  } catch (error) {
    logger.error("Could not sync a circle chat", { circleId, error });
  }
}

// Opens (or starts) the circle chat for a proven member.
export async function openCircleChat(userId: string, circleId: string): Promise<{ chatId: string }> {
  const member = await prisma.circleMember.findUnique({
    where: { circleId_userId: { circleId, userId } },
    include: { circle: { select: { id: true, name: true, emoji: true } } },
  });
  if (!member) throw new CircleError("Join this circle to see its week");
  if (!member.provenAt) throw new CircleError("Post your first photo to join the chat");
  return { chatId: await ensureCircleChat(member.circle) };
}

// The circle's chat, created the first time someone (or the coach) needs it.
export async function ensureCircleChat(circle: { id: string; name: string; emoji: string }): Promise<string> {
  const chat = await prisma.chat.upsert({
    where: { circleId: circle.id },
    create: { type: "GROUP", circleId: circle.id, title: circleLabel(circle) },
    update: {},
    select: { id: true },
  });
  await syncCircleChat(circle.id);
  return chat.id;
}
