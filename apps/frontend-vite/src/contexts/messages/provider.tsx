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
  sendMessageStream,
  rewriteMessageStream,
  createDirectChat,
  markMessagesAsRead,
  clearCoachHistory,
  clearCoachMemory,
} from "./service";
import {
  MessagesContext,
  type MessagesContextType,
  type Chat,
  type Message,
} from "./types";

const hasPlanCreationProposal = (message: Message) =>
  (message.planCreationProposals?.length || 0) > 0;

const cancelPendingPlanCreationProposalsInCache = (
  messages: Message[],
  exceptMessageIds: Set<string> = new Set()
): Message[] =>
  messages.map((message) => {
    if (exceptMessageIds.has(message.id) || !message.planCreationProposals) {
      return message;
    }

    let changed = false;
    const planCreationProposals = message.planCreationProposals.map((proposal) => {
      if (proposal.status) return proposal;
      changed = true;
      return { ...proposal, status: "cancelled" as const };
    });

    return changed ? { ...message, planCreationProposals } : message;
  });

type RewriteMessageInput = {
  chatId: string;
  cacheChatId?: string;
  messageId: string;
  message: string;
};

export const MessagesProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { isSignedIn, isLoaded } = useSession();
  const queryClient = useQueryClient();
  const api = useApiWithAuth();
  const { handleQueryError } = useLogError();
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [pendingStaggeredMessages, setPendingStaggeredMessages] = useState<Message[]>([]);
  const [coachResponseStatus, setCoachResponseStatus] = useState<"thinking" | "searching" | "drafting" | null>(null);
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
      const currentChat = chats.data?.find((chat) => chat.id === currentChatId);
      return await getMessages(api, currentChatId, {
        includeCoachHistory: currentChat?.type === "COACH",
      });
    },
    enabled: isLoaded && isSignedIn && !!currentChatId && !!chats.data,
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

      if (data.coachVersion === "v2") {
        setCoachResponseStatus("thinking");
        return await sendMessageStream(api, data, setCoachResponseStatus);
      }

      setCoachResponseStatus(null);
      return await sendMessage(api, data);
    },
    onSuccess: (responseMessages, { chatId, message }) => {
      // Clear any existing stagger timers
      staggerTimersRef.current.forEach(clearTimeout);
      staggerTimersRef.current = [];
      setPendingStaggeredMessages([]);

      const persistedUserMessage = responseMessages.find(
        (msg) => msg.role === "USER" && msg.content === message
      );
      const coachMessages = responseMessages.filter(
        (msg) => msg.id !== persistedUserMessage?.id
      );
      const newProposalMessageIds = new Set(coachMessages.map((msg) => msg.id));
      const shouldCancelPendingPlanCreations = coachMessages.some(hasPlanCreationProposal);

      queryClient.setQueryData(
        ["messages", chatId],
        (oldMessages: Message[] = []) => {
          const preparedMessages = shouldCancelPendingPlanCreations
            ? cancelPendingPlanCreationProposalsInCache(oldMessages, newProposalMessageIds)
            : oldMessages;
          const withoutTemp = preparedMessages.filter(
            (msg) => !(msg.id.startsWith("temp-") && msg.content === message)
          );
          if (!persistedUserMessage) return withoutTemp;
          const exists = withoutTemp.some((msg) => msg.id === persistedUserMessage.id);
          return exists ? withoutTemp : [...withoutTemp, persistedUserMessage];
        }
      );

      if (coachMessages.length === 0) {
        queryClient.invalidateQueries({ queryKey: ["messages", chatId] });
      } else if (coachMessages.length === 1) {
        // Single message — add immediately
        const msg = coachMessages[0];
        if (msg) {
          queryClient.setQueryData(
            ["messages", chatId],
            (oldMessages: Message[] = []) => {
              const preparedMessages = shouldCancelPendingPlanCreations
                ? cancelPendingPlanCreationProposalsInCache(oldMessages, newProposalMessageIds)
                : oldMessages;
              const exists = preparedMessages.some((m) => m.id === msg.id);
              return exists ? preparedMessages : [...preparedMessages, msg];
            }
          );
        }
        queryClient.invalidateQueries({ queryKey: ["messages", chatId] });
      } else {
        // Multiple messages — stagger delivery
        const [firstMsg, ...rest] = coachMessages;

        // Add first message immediately
        queryClient.setQueryData(
          ["messages", chatId],
          (oldMessages: Message[] = []) => {
            const preparedMessages = shouldCancelPendingPlanCreations
              ? cancelPendingPlanCreationProposalsInCache(oldMessages, newProposalMessageIds)
              : oldMessages;
            const exists = preparedMessages.some((m) => m.id === firstMsg.id);
            return exists ? preparedMessages : [...preparedMessages, firstMsg];
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
                const preparedMessages = shouldCancelPendingPlanCreations
                  ? cancelPendingPlanCreationProposalsInCache(oldMessages, newProposalMessageIds)
                  : oldMessages;
                const exists = preparedMessages.some((m) => m.id === msg.id);
                return exists ? preparedMessages : [...preparedMessages, msg];
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
      queryClient.invalidateQueries({ queryKey: ["chats"] });
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
    onSettled: () => {
      setCoachResponseStatus(null);
    },
  });

  const rewriteMessageMutation = useMutation({
    mutationFn: async (data: RewriteMessageInput) => {
      staggerTimersRef.current.forEach(clearTimeout);
      staggerTimersRef.current = [];
      setPendingStaggeredMessages([]);
      setCoachResponseStatus("thinking");

      return await rewriteMessageStream(api, data, setCoachResponseStatus);
    },
    onMutate: async ({ chatId, cacheChatId, messageId, message }) => {
      const visibleChatId = cacheChatId || chatId;
      await queryClient.cancelQueries({ queryKey: ["messages", visibleChatId] });
      const previousMessages = queryClient.getQueryData<Message[]>([
        "messages",
        visibleChatId,
      ]);

      queryClient.setQueryData(
        ["messages", visibleChatId],
        (oldMessages: Message[] = []) => {
          const targetIndex = oldMessages.findIndex((msg) => msg.id === messageId);
          if (targetIndex === -1) return oldMessages;

          return oldMessages.slice(0, targetIndex + 1).map((msg, index) =>
            index === targetIndex
              ? {
                  ...msg,
                  content: message,
                  userAction: null,
                }
              : msg
          );
        }
      );

      return { previousMessages, visibleChatId, sourceChatId: chatId };
    },
    onSuccess: (responseMessages, { chatId, cacheChatId, messageId }) => {
      const visibleChatId = cacheChatId || chatId;
      queryClient.setQueryData(
        ["messages", visibleChatId],
        (oldMessages: Message[] = []) => {
          const targetIndex = oldMessages.findIndex((msg) => msg.id === messageId);
          const retainedMessages =
            targetIndex === -1 ? oldMessages : oldMessages.slice(0, targetIndex);
          return [...retainedMessages, ...responseMessages];
        }
      );

      queryClient.setQueryData(["chats"], (oldChats: Chat[] = []) => {
        return oldChats.map((chat) => {
          if (chat.id === chatId || chat.id === visibleChatId) {
            return { ...chat, updatedAt: new Date() };
          }
          return chat;
        });
      });
      queryClient.invalidateQueries({ queryKey: ["messages"] });
      queryClient.invalidateQueries({ queryKey: ["chats"] });
    },
    onError: (error, { chatId }, context) => {
      if (context?.previousMessages) {
        queryClient.setQueryData(
          ["messages", context.visibleChatId || chatId],
          context.previousMessages
        );
      }
      const customErrorMessage = `Failed to edit message`;
      handleQueryError(error, customErrorMessage);
      toast.error(customErrorMessage);
    },
    onSettled: () => {
      setCoachResponseStatus(null);
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
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["chats"] });
      await queryClient.cancelQueries({ queryKey: ["messages"] });

      const previousChatId = currentChatId;
      const previousChats = queryClient.getQueryData<Chat[]>(["chats"]);
      const previousMessagesQueries = queryClient.getQueriesData<Message[]>({
        queryKey: ["messages"],
      });
      const coachChatIds = new Set(
        (previousChats || [])
          .filter((chat) => chat.type === "COACH")
          .map((chat) => chat.id)
      );

      staggerTimersRef.current.forEach(clearTimeout);
      staggerTimersRef.current = [];
      setPendingStaggeredMessages([]);
      setCoachResponseStatus(null);
      setCurrentChatId(null);

      queryClient.setQueryData(["chats"], (oldChats: Chat[] = []) =>
        oldChats.filter((chat) => chat.type !== "COACH")
      );

      previousMessagesQueries.forEach(([queryKey]) => {
        const [, chatId] = queryKey as [string, string | null | undefined];
        if (!chatId || coachChatIds.has(chatId) || chatId === previousChatId) {
          queryClient.setQueryData(queryKey, []);
        }
      });

      return { previousChatId, previousChats, previousMessagesQueries };
    },
    onSuccess: () => {
      setCurrentChatId(null);
      queryClient.invalidateQueries({ queryKey: ["chats"] });
      queryClient.invalidateQueries({ queryKey: ["messages"] });
    },
    onError: (error, _variables, context) => {
      if (context?.previousChats) {
        queryClient.setQueryData(["chats"], context.previousChats);
      }
      context?.previousMessagesQueries.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });
      setCurrentChatId(context?.previousChatId || null);
      handleQueryError(error, "Failed to clear coach history");
      toast.error("Failed to clear coach history");
    },
  });

  const clearCoachMemoryMutation = useMutation({
    mutationFn: async () => {
      await clearCoachMemory(api);
    },
    onSuccess: () => {
      toast.success("Coach memory cleared");
    },
    onError: (error) => {
      handleQueryError(error, "Failed to clear coach memory");
      toast.error("Failed to clear coach memory");
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
    rewriteMessage: rewriteMessageMutation.mutateAsync,
    isSendingMessage: sendMessageMutation.isPending,
    coachResponseStatus,
    isRewritingMessage: rewriteMessageMutation.isPending,
    pendingStaggeredMessages,
    createDirectChat: createDirectChatMutation.mutateAsync,
    isCreatingDirectChat: createDirectChatMutation.isPending,
    markMessagesAsRead: markMessagesAsReadStable,
    clearCoachHistory: clearCoachHistoryMutation.mutateAsync,
    isClearingCoachHistory: clearCoachHistoryMutation.isPending,
    clearCoachMemory: clearCoachMemoryMutation.mutateAsync,
    isClearingCoachMemory: clearCoachMemoryMutation.isPending,
  };

  return (
    <MessagesContext.Provider value={context}>
      {children}
    </MessagesContext.Provider>
  );
};
