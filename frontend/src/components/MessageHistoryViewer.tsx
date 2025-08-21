import { useUserPlan } from "@/contexts/UserGlobalContext";
import { Message, MessageEmotion } from "@prisma/client";
import { Eclipse } from "lucide-react";
import React from "react";
import { EmotionBadges } from "./chat/EmotionBadges";
import Divider from "./Divider";
import { ChatBubble, ChatBubbleAvatar, ChatBubbleMessage } from "./ui/chat/chat-bubble";
import { ChatMessageList } from "./ui/chat/chat-message-list";

interface MessageHistoryViewerProps {
  messages: (Message & { emotions: MessageEmotion[] })[];
}

function formatDate(dateString: string) {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function MessageHistoryViewer({ messages }: MessageHistoryViewerProps) {
  const { useCurrentUserDataQuery } = useUserPlan();
  const currentUserDataQuery = useCurrentUserDataQuery();
  const { data: userData } = currentUserDataQuery;
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  // Scroll to bottom on mount and when messages change
  React.useEffect(() => {
    const scrollToBottom = () => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: "auto" });
      }
    };

    // Execute scroll after a brief delay to ensure content is rendered
    setTimeout(scrollToBottom, 100);
  }, [messages]);

  // Group messages by date
  const messagesByDate: { [key: string]: (Message & { emotions: MessageEmotion[] })[] } = {};

  messages.forEach((message) => {
    const date = new Date(message.createdAt);
    const dateKey = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate()
    ).toISOString();

    if (!messagesByDate[dateKey]) {
      messagesByDate[dateKey] = [];
    }
    messagesByDate[dateKey].push(message);
  });

  // Sort dates from oldest to newest
  const sortedDates = Object.entries(messagesByDate).sort((a, b) => {
    return new Date(a[0]).getTime() - new Date(b[0]).getTime();
  });

  function getMessageRole(message: Message) {
    return message.role.toLowerCase();
  }

  return (
    <ChatMessageList>
      {sortedDates.map(([dateKey, dateMessages], index) => (
        <React.Fragment key={dateKey}>
          <Divider text={formatDate(dateKey)} />
          {dateMessages
            .sort(
              (a, b) =>
                new Date(a.createdAt).getTime() -
                new Date(b.createdAt).getTime()
            )
            .map((message) => {
              const role = message.role;
              if (role === "SYSTEM") {
                return <Divider text={message.content} key={message.id} />;
              }
              return (
                <ChatBubble
                  key={message.id}
                  variant={role === "ASSISTANT" ? "received" : "sent"}
                >
                  <ChatBubbleAvatar
                    src={role === "USER" ? userData?.picture || "" : undefined}
                    fallback={<Eclipse className="w-8 h-8" />}
                  />
                  <div className="flex flex-col gap-2">
                    <ChatBubbleMessage
                      message={message.content}
                      variant={role === "ASSISTANT" ? "received" : "sent"}
                    />
                    <EmotionBadges emotions={message.emotions} loading={false} />
                  </div>
                </ChatBubble>
              );
            })}
        </React.Fragment>
      ))}
      <div ref={messagesEndRef} />
    </ChatMessageList>
  );
}
