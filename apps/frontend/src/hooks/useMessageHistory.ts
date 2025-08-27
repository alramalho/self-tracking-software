import { useState, useEffect, useCallback } from "react";

export interface Message {
  role: "user" | "assistant";
  content: string;
}

export function useMessageHistory() {
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    // Load messages from localStorage on initial render
    const storedMessages = localStorage.getItem("messageHistory");
    if (storedMessages) {
      setMessages(JSON.parse(storedMessages));
    }
  }, []);

  const addMessage = useCallback((message: Message) => {
    setMessages((prevMessages) => {
      const newMessages = [...prevMessages, message];
      localStorage.setItem("messageHistory", JSON.stringify(newMessages));
      return newMessages;
    });
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    localStorage.removeItem("messageHistory");
  }, []);

  return { messages, addMessage, clearMessages };
}
