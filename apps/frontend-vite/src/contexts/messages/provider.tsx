import { useApiWithAuth } from "@/api";
import { useSession } from "@/contexts/auth";
import { useLogError } from "@/hooks/useLogError";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { toast } from "react-hot-toast";
import {
  getChats,
  getMessages,
  sendMessage,
  createDirectChat,
  markMessagesAsRead,
  clearCoachHistory,
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
  const [pendingStaggeredMessages, setPendingStaggeredMessages] = useState<Message[]>([]);
  const staggerTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Cleanup stagger timers on unmount
  useEffect(() => {
    return () => {
      staggerTimersRef.current.forEach(clearTimeout);
    };
  }, []);

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
    staleTime: 1000 * 60 * 2,
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
    staleTime: 1000 * 60 * 2,
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
    onSuccess: (responseMessages, { chatId }) => {
      // Clear any existing stagger timers
      staggerTimersRef.current.forEach(clearTimeout);
      staggerTimersRef.current = [];

      if (responseMessages.length <= 1) {
        // Single message — add immediately
        const msg = responseMessages[0];
        if (msg) {
          queryClient.setQueryData(
            ["messages", chatId],
            (oldMessages: Message[] = []) => {
              const exists = oldMessages.some((m) => m.id === msg.id);
              return exists ? oldMessages : [...oldMessages, msg];
            }
          );
        }
        queryClient.invalidateQueries({ queryKey: ["messages", chatId] });
      } else {
        // Multiple messages — stagger delivery
        const [firstMsg, ...rest] = responseMessages;

        // Add first message immediately
        queryClient.setQueryData(
          ["messages", chatId],
          (oldMessages: Message[] = []) => {
            const exists = oldMessages.some((m) => m.id === firstMsg.id);
            return exists ? oldMessages : [...oldMessages, firstMsg];
          }
        );

        // Queue remaining messages with staggered delays
        setPendingStaggeredMessages(rest);

        let cumulativeDelay = 0;
        rest.forEach((msg, idx) => {
          // Delay based on previous message's word count
          const prevMsg = idx === 0 ? firstMsg : rest[idx - 1];
          const wordCount = prevMsg.content.split(/\s+/).length;
          const delay = Math.min(Math.max(wordCount * 500, 800), 4000);
          cumulativeDelay += delay;

          const timer = setTimeout(() => {
            queryClient.setQueryData(
              ["messages", chatId],
              (oldMessages: Message[] = []) => {
                const exists = oldMessages.some((m) => m.id === msg.id);
                return exists ? oldMessages : [...oldMessages, msg];
              }
            );
            setPendingStaggeredMessages((prev) => prev.filter((m) => m.id !== msg.id));

            // After last message is delivered, invalidate
            if (idx === rest.length - 1) {
              queryClient.invalidateQueries({ queryKey: ["messages", chatId] });
            }
          }, cumulativeDelay);

          staggerTimersRef.current.push(timer);
        });
      }

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
      // Clear stagger timers on error
      staggerTimersRef.current.forEach(clearTimeout);
      staggerTimersRef.current = [];
      setPendingStaggeredMessages([]);

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
    onMutate: ({ chatId, messageIds }) => {
      // Optimistically update messages in cache immediately
      queryClient.setQueryData(
        ["messages", chatId],
        (oldMessages: Message[] = []) => {
          return oldMessages.map((msg) =>
            messageIds.includes(msg.id) ? { ...msg, status: "READ" as const } : msg
          );
        }
      );
      // Optimistically decrement unread count on the chat
      queryClient.setQueryData(["chats"], (oldChats: Chat[] = []) => {
        return oldChats.map((chat) => {
          if (chat.id === chatId) {
            const newCount = Math.max(0, (chat.unreadCount || 0) - messageIds.length);
            return { ...chat, unreadCount: newCount };
          }
          return chat;
        });
      });
    },
    onSuccess: (_, { chatId }) => {
      // Invalidate chats to update unread counts
      queryClient.invalidateQueries({ queryKey: ["chats"] });
      // Invalidate notifications so concluded week_recap notifications are reflected
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const clearCoachHistoryMutation = useMutation({
    mutationFn: async () => {
      await clearCoachHistory(api);
    },
    onSuccess: () => {
      setCurrentChatId(null);
      queryClient.invalidateQueries({ queryKey: ["chats"] });
      queryClient.invalidateQueries({ queryKey: ["messages"] });
    },
    onError: (error) => {
      handleQueryError(error, "Failed to clear coach history");
      toast.error("Failed to clear coach history");
    },
  });

  const markMessagesAsReadStable = useCallback(
    async (chatId: string, messageIds: string[]) => {
      await markMessagesAsReadMutation.mutateAsync({ chatId, messageIds });
    },
    [markMessagesAsReadMutation.mutateAsync]
  );

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
    pendingStaggeredMessages,
    createDirectChat: createDirectChatMutation.mutateAsync,
    isCreatingDirectChat: createDirectChatMutation.isPending,
    markMessagesAsRead: markMessagesAsReadStable,
    clearCoachHistory: clearCoachHistoryMutation.mutateAsync,
    isClearingCoachHistory: clearCoachHistoryMutation.isPending,
  };

  return (
    <MessagesContext.Provider value={context}>
      {children}
    </MessagesContext.Provider>
  );
};
