import type { Chat, Message } from "../src/features/messages/types";
export function seedChats() {
  const date = new Date().toISOString();
  const chats: Chat[] = [
    {
      id: "coach-main",
      type: "COACH",
      title: "Weekly progress",
      createdAt: date,
      updatedAt: date,
      unreadCount: 1,
    },
    {
      id: "direct-sam",
      type: "DIRECT",
      title: null,
      createdAt: date,
      updatedAt: date,
      participants: [
        { id: "p1", userId: "test-user", name: "Alex", joinedAt: date },
        {
          id: "p2",
          userId: "sam",
          name: "Sam",
          username: "sam",
          joinedAt: date,
        },
      ],
      lastMessage: { content: "See you tomorrow", createdAt: date },
      unreadCount: 1,
    },
  ];
  const messages: Message[] = [
    {
      id: "coach-old",
      chatId: "coach-older",
      role: "COACH",
      content: "Your earlier conversation is here too.",
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      status: "READ",
    },
    {
      id: "coach-welcome",
      chatId: "coach-main",
      role: "COACH",
      content: "**Nice progress, Alex.** How did your run feel?",
      createdAt: date,
      status: "SENT",
      activityLogProposals: [
        {
          activityId: "run",
          activityName: "Running",
          activityEmoji: "🏃",
          activityMeasure: "kilometers",
          quantity: 5,
          date,
          description: "An easy run",
          status: null,
        },
      ],
    },
    {
      id: "sam-hi",
      chatId: "direct-sam",
      role: "USER",
      senderId: "sam",
      senderName: "Sam",
      content: "See you tomorrow",
      createdAt: date,
      status: "SENT",
    },
  ];
  return { chats, messages };
}
