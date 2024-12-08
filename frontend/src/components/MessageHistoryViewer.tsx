import React from "react";
import { Message, useUserPlan } from "@/contexts/UserPlanContext";
import { Message as ChatMessage } from "@/hooks/useMessageHistory";
import { ChatInterface } from "./chat/ChatInterface";
import { EmotionBadges } from "./chat/EmotionBadges";
import { Card } from "./ui/card";
import { ChatBubbleAvatar } from "./ui/chat/chat-bubble";
import { ChatBubbleMessage } from "./ui/chat/chat-bubble";
import { ChatBubble } from "./ui/chat/chat-bubble";
import { ChatMessageList } from "./ui/chat/chat-message-list";
import { EmotionViewer } from "./EmotionViewer";
import Divider from "./Divider";

interface MessageHistoryViewerProps {
  messages: Message[];
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
  const { useUserDataQuery } = useUserPlan();
  const { data: userData } = useUserDataQuery("me");
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
  const messagesByDate: { [key: string]: Message[] } = {};

  messages.forEach((message) => {
    const date = new Date(message.created_at);
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

  return (
    <Card className="w-full flex-1 max-w-4xl mx-auto p-4 flex flex-col h-full overflow-hidden">
      <ChatMessageList className="flex-1 overflow-y-auto">
        {sortedDates.map(([dateKey, dateMessages], index) => (
          <React.Fragment key={dateKey}>
            <Divider text={formatDate(dateKey)} />
            {dateMessages
              .sort(
                (a, b) =>
                  new Date(a.created_at).getTime() -
                  new Date(b.created_at).getTime()
              )
              .map((message) => {
                const role =
                  message.sender_id === userData?.user?.id
                    ? "user"
                    : "assistant";
                return (
                  <ChatBubble
                    key={message.id}
                    variant={role === "assistant" ? "received" : "sent"}
                  >
                    <div
                      className={`flex items-start gap-2 w-full ${
                        role === "user" ? "flex-row-reverse" : ""
                      }`}
                    >
                      <ChatBubbleAvatar
                        src={
                          role === "assistant"
                            ? "https://htmlcolorcodes.com/assets/images/colors/sky-blue-color-solid-background-1920x1080.png"
                            : userData?.user?.picture
                        }
                        className={`${role === "user" ? "mt-2" : ""}`}
                      />
                      <div className="flex flex-col gap-2 justify-end">
                        <ChatBubbleMessage message={message.text} />
                        <EmotionBadges emotions={message.emotions} />
                      </div>
                    </div>
                  </ChatBubble>
                );
              })}
          </React.Fragment>
        ))}
        <div ref={messagesEndRef} /> {/* Scroll anchor */}
      </ChatMessageList>
    </Card>
  );
}
