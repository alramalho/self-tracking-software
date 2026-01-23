import { useApiWithAuth } from "@/api";
import { useSession } from "@/contexts/auth";
import { useLogError } from "@/hooks/useLogError";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useState, useMemo } from "react";
import { toast } from "react-hot-toast";
import {
  getChats,
  getMessages,
  sendMessage,
  createDirectChat,
  markMessagesAsRead,
} from "./service";
import {
  MessagesContext,
  type MessagesContextType,
  type Chat,
  type Message,
} from "./types";

export const MessagesProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { isSignedIn, isLoaded } = useSession();
  const queryClient = useQueryClient();
  const api = useApiWithAuth();
  const { handleQueryError } = useLogError();
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);

  const chats = useQuery({
    queryKey: ["chats"],
    queryFn: async () => {
      console.log("fetching chats");
      const result = await getChats(api);
      // Auto-select the most recent chat if none is selected
      if (!currentChatId && result.length > 0) {
        setCurrentChatId(result[0].id);
      }
      return result;
    },
    enabled: isLoaded && isSignedIn,
  });

  if (chats.error) {
    const customErrorMessage = `Failed to get chats`;
    handleQueryError(chats.error, customErrorMessage);
  }

  const messages = useQuery({
    queryKey: ["messages", currentChatId],
    queryFn: async () => {
      if (!currentChatId) return [];
      console.log("fetching messages for chat", currentChatId);
      return await getMessages(api, currentChatId);
    },
    enabled: isLoaded && isSignedIn && !!currentChatId,
  });

  if (messages.error) {
    const customErrorMessage = `Failed to get messages`;
    handleQueryError(messages.error, customErrorMessage);
  }

  const sendMessageMutation = useMutation({
    mutationFn: async (data: { message: string; chatId: string; coachVersion?: "v1" | "v2" }) => {
      // Optimistically add user message to the cache immediately
      const userMessage: Message = {
        id: `temp-${Date.now()}`,
        role: "USER",
        content: data.message,
        createdAt: new Date(),
      };

      queryClient.setQueryData(
        ["messages", data.chatId],
        (oldMessages: Message[] = []) => {
          return [...oldMessages, userMessage];
        }
      );

      // Make the API call
      return await sendMessage(api, data);
    },
    onSuccess: (responseMessage, { chatId }) => {
      // Replace the temp message with the actual response or add the response
      queryClient.setQueryData(
        ["messages", chatId],
        (oldMessages: Message[] = []) => {
          // Filter out temp messages and add the response
          const filteredMessages = oldMessages.filter(
            (msg) => !msg.id.startsWith("temp-")
          );
          // Check if response message is already in the list
          const exists = filteredMessages.some(
            (msg) => msg.id === responseMessage.id
          );
          if (exists) {
            return filteredMessages;
          }
          return [...filteredMessages, responseMessage];
        }
      );

      // Invalidate to ensure cache is fresh (handles race conditions)
      queryClient.invalidateQueries({ queryKey: ["messages", chatId] });

      // Update the chat's updatedAt timestamp
      queryClient.setQueryData(["chats"], (oldChats: Chat[] = []) => {
        return oldChats.map((chat) => {
          if (chat.id === chatId) {
            return { ...chat, updatedAt: new Date() };
          }
          return chat;
        });
      });
    },
    onError: (error, { chatId }) => {
      // Rollback: remove the optimistic user message on error
      queryClient.setQueryData(
        ["messages", chatId],
        (oldMessages: Message[] = []) => {
          return oldMessages.filter((msg) => !msg.id.startsWith("temp-"));
        }
      );
      const customErrorMessage = `Failed to send message`;
      handleQueryError(error, customErrorMessage);
      toast.error(customErrorMessage);
    },
  });

  const createDirectChatMutation = useMutation({
    mutationFn: async (userId: string) => {
      return await createDirectChat(api, userId);
    },
    onSuccess: (newChat) => {
      // Add the new chat to the cache (or update if it exists)
      queryClient.setQueryData(["chats"], (oldChats: Chat[] = []) => {
        const exists = oldChats.some((chat) => chat.id === newChat.id);
        if (exists) {
          return oldChats.map((chat) =>
            chat.id === newChat.id ? newChat : chat
          );
        }
        return [newChat, ...oldChats];
      });
    },
    onError: (error) => {
      const customErrorMessage = `Failed to create chat`;
      handleQueryError(error, customErrorMessage);
      toast.error(customErrorMessage);
    },
  });

  const markMessagesAsReadMutation = useMutation({
    mutationFn: async ({
      chatId,
      messageIds,
    }: {
      chatId: string;
      messageIds: string[];
    }) => {
      return await markMessagesAsRead(api, chatId, messageIds);
    },
    onSuccess: (_, { chatId, messageIds }) => {
      // Optimistically update the messages in cache
      queryClient.setQueryData(
        ["messages", chatId],
        (oldMessages: Message[] = []) => {
          return oldMessages.map((msg) =>
            messageIds.includes(msg.id) ? { ...msg, status: "READ" as const } : msg
          );
        }
      );
      // Invalidate chats to update unread counts
      queryClient.invalidateQueries({ queryKey: ["chats"] });
    },
  });

  const totalUnreadCount = useMemo(() => {
    return (
      chats.data?.reduce((sum, chat) => sum + (chat.unreadCount || 0), 0) || 0
    );
  }, [chats.data]);

  const context: MessagesContextType = {
    chats: chats.data,
    isLoadingChats: chats.isLoading,
    currentChatId,
    setCurrentChatId,
    totalUnreadCount,
    messages: messages.data,
    isLoadingMessages: messages.isLoading,
    sendMessage: sendMessageMutation.mutateAsync,
    isSendingMessage: sendMessageMutation.isPending,
    createDirectChat: createDirectChatMutation.mutateAsync,
    isCreatingDirectChat: createDirectChatMutation.isPending,
    markMessagesAsRead: async (chatId: string, messageIds: string[]) => {
      await markMessagesAsReadMutation.mutateAsync({ chatId, messageIds });
    },
  };

  return (
    <MessagesContext.Provider value={context}>
      {children}
    </MessagesContext.Provider>
  );
};
