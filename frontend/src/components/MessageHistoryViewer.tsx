import React from "react";
import { Message, useUserPlan } from "@/contexts/UserPlanContext";
import { ChatInterface } from "./chat/ChatInterface";
import { EmotionBadges } from "./chat/EmotionBadges";
import { Card } from "./ui/card";
import { ChatBubbleAvatar } from "./ui/chat/chat-bubble";
import { ChatBubbleMessage } from "./ui/chat/chat-bubble";
import { ChatBubble } from "./ui/chat/chat-bubble";
import { ChatMessageList } from "./ui/chat/chat-message-list";
import { Eclipse } from "lucide-react";
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

  function getMessageRole(message: Message) {
    if (message.sender_id === userData?.user?.id) {
      return "user";
    }
    if (message.sender_id === "-1") {
      return "system";
    }
    return "assistant";
  }

  return (
    <ChatMessageList>
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
              const role = getMessageRole(message);
              if (role === "system") {
                return <Divider text={message.text} key={message.id} />;
              }
              return (
                <ChatBubble
                  key={message.id}
                  variant={role === "assistant" ? "received" : "sent"}
                >
                  <ChatBubbleAvatar
                    src={role === "user" ? userData?.user?.picture : undefined}
                    fallback={<Eclipse className="w-8 h-8" />}
                  />
                  <div className="flex flex-col gap-2">
                    <ChatBubbleMessage
                      message={message.text}
                      variant={role === "assistant" ? "received" : "sent"}
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
