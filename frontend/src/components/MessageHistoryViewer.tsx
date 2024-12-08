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

interface MessageHistoryViewerProps {
  messages: Message[];
}

export function MessageHistoryViewer({ messages }: MessageHistoryViewerProps) {
  const { useUserDataQuery } = useUserPlan();
  const { data: userData } = useUserDataQuery("me");

  return (
    <Card className="w-full max-w-4xl mx-auto p-4">
      <div className="space-y-8">
        <ChatMessageList>
          {messages.map((message, index) => {
            const role =
              message.sender_id === userData?.user?.id ? "user" : "assistant";
            return (
              <ChatBubble
                key={index}
                variant={role === "assistant" ? "received" : "sent"}
              >
                <div className={`flex items-start gap-2 ${role === "user" ? "flex-row-reverse" : ""}`}>
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
        </ChatMessageList>
      </div>
    </Card>
  );
}
