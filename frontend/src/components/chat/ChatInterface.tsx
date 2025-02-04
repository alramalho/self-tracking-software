import React from 'react';
import { Message } from "@/hooks/useMessageHistory";
import {
  ChatBubble,
  ChatBubbleAvatar,
  ChatBubbleMessage,
} from "@/components/ui/chat/chat-bubble";
import { ChatMessageList } from "@/components/ui/chat/chat-message-list";
import { useUserPlan } from '@/contexts/UserPlanContext';
import { Eclipse } from 'lucide-react';

interface ChatInterfaceProps {
  messages: Message[];
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ messages }) => {
  const { useCurrentUserDataQuery } = useUserPlan();
  const currentUserDataQuery = useCurrentUserDataQuery();
  const { data: userData } = currentUserDataQuery;
  
  return (
    <div className="w-full max-w-3xl mx-auto px-4">
      <ChatMessageList>
        {messages.map((message, index) => (
          <ChatBubble
            key={index}
            variant={message.role === "assistant" ? "received" : "sent"}
          >
            <ChatBubbleAvatar
              src={
                message.role === "user" ? userData?.user?.picture : undefined
              }
              fallback={<Eclipse className="w-8 h-8 bg-transparent" />}
            />
            <ChatBubbleMessage className={`${message.role === "user" ? "p-3" : "p-1 bg-transparent"}`} message={message.content} variant={message.role === "assistant" ? "received" : "sent"} />
          </ChatBubble>
        ))}
      </ChatMessageList>
    </div>
  );
}; 