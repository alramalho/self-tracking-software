import React from 'react';
import { Message } from "@/hooks/useMessageHistory";
import {
  ChatBubble,
  ChatBubbleAvatar,
  ChatBubbleMessage,
} from "@/components/ui/chat/chat-bubble";
import { ChatMessageList } from "@/components/ui/chat/chat-message-list";
import { useUserPlan } from '@/contexts/UserPlanContext';

interface ChatInterfaceProps {
  messages: Message[];
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ messages }) => {
  const { useUserDataQuery } = useUserPlan();
  const { data: userData } = useUserDataQuery("me");
  
  return (
    <div className="w-full max-w-xl mx-auto">
      <ChatMessageList>
        {messages.map((message, index) => (
          <ChatBubble
            key={index}
            variant={message.role === "assistant" ? "received" : "sent"}
          >
            <ChatBubbleAvatar
              src={
                message.role === "assistant"
                  ? "https://htmlcolorcodes.com/assets/images/colors/sky-blue-color-solid-background-1920x1080.png"
                  : userData?.user?.picture
              }
            />
            <ChatBubbleMessage message={message.content} />
          </ChatBubble>
        ))}
      </ChatMessageList>
    </div>
  );
}; 