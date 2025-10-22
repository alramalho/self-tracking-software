import prisma from "@/utils/prisma";
import { Chat, Coach } from "@tsw/prisma";

class ChatService {
  private async ensureChatAndCoachExist(
    userId: string,
    idPrefix: string
  ): Promise<{ coach: Coach; chat: Chat }> {
    const coachId = `${userId}-${idPrefix}-coach`;
    const chatId = `${userId}-${idPrefix}-chat`;
    let coach = await prisma.coach.findFirst({
      where: { id: coachId },
    });

    if (!coach) {
      coach = await prisma.coach.create({
        data: { ownerId: userId, id: coachId },
      });
    }
    let chat = await prisma.chat.findFirst({
      where: { userId, coachId: coachId, id: chatId },
    });

    if (!chat) {
      chat = await prisma.chat.create({
        data: { userId, coachId: coachId, id: chatId },
      });
    }

    return { coach, chat };
  }

  async ensureNotificationsCoachExists(
    userId: string
  ): Promise<{ coach: Coach; chat: Chat }> {
    return this.ensureChatAndCoachExist(userId, "notifications");
  }
  async ensureOnboardingChatAndCoachExist(
    userId: string
  ): Promise<{ coach: Coach; chat: Chat }> {
    return this.ensureChatAndCoachExist(userId, "onboarding");
  }
}

export const chatService = new ChatService();
