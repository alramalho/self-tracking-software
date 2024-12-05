import React from 'react';
import { Message } from "@/hooks/useMessageHistory";
import {
  ChatBubble,
  ChatBubbleAvatar,
  ChatBubbleMessage,
} from "@/components/ui/chat/chat-bubble";
import { ChatMessageList } from "@/components/ui/chat/chat-message-list";

interface ChatInterfaceProps {
  messages: Message[];
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ messages }) => {
  return (
    <div className="w-full max-w-xl mx-auto mt-12">
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
                  : "https://htmlcolorcodes.com/assets/images/colors/orange-color-solid-background-1920x1080.png"
              }
            />
            <ChatBubbleMessage message={message.content} />
          </ChatBubble>
        ))}
      </ChatMessageList>
    </div>
  );
}; 