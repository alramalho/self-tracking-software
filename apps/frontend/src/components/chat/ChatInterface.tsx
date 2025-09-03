import {
  ChatBubble,
  ChatBubbleAvatar,
  ChatBubbleMessage,
} from "@/components/ui/chat/chat-bubble";
import { ChatMessageList } from "@/components/ui/chat/chat-message-list";
import { useCurrentUser } from "@/contexts/users";
import { Message } from "@/hooks/useMessageHistory";
import { Eclipse } from 'lucide-react';
import React from 'react';

interface ChatInterfaceProps {
  messages: Message[];
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ messages }) => {
  const { currentUser } = useCurrentUser();
  
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
                message.role === "user" ? currentUser?.picture || "" : undefined
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