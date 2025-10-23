import { useApiWithAuth } from "@/api";
import { useSession } from "@/contexts/auth";
import { useLogError } from "@/hooks/useLogError";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import { toast } from "react-hot-toast";
import { createChat, getChats, getMessages, sendMessage, submitFeedback, updateChatTitle, acceptMetric, rejectMetric, submitAISatisfaction } from "./service";
import { AIContext, type AIContextType, type Chat, type Message } from "./types";
import { useCurrentUser } from "@/contexts/users";
import { useAI } from ".";

export const AIProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { isSignedIn, isLoaded } = useSession();
  const queryClient = useQueryClient();
  const api = useApiWithAuth();
  const { handleQueryError } = useLogError();
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const {currentUser} = useCurrentUser(); 
  const isUserAIWhitelisted = ["liocas", "alex"].includes(currentUser?.username || "");

  const chats = useQuery({
    queryKey: ["ai-chats"],
    queryFn: async () => {
      console.log("fetching chats");
      const result = await getChats(api);
      // Auto-select the most recent chat if none is selected
      if (!currentChatId && result.length > 0) {
        setCurrentChatId(result[0].id);
      }
      return result;
    },
    enabled: isLoaded && isSignedIn && isUserAIWhitelisted,
  });

  if (chats.error) {
    const customErrorMessage = `Failed to get chats`;
    handleQueryError(chats.error, customErrorMessage);
    toast.error(customErrorMessage);
  }

  const messages = useQuery({
    queryKey: ["ai-messages", currentChatId],
    queryFn: async () => {
      if (!currentChatId) return [];
      console.log("fetching messages for chat", currentChatId);
      return await getMessages(api, currentChatId);
    },
    enabled: isLoaded && isSignedIn && isUserAIWhitelisted && !!currentChatId,
  });

  if (messages.error) {
    const customErrorMessage = `Failed to get messages`;
    handleQueryError(messages.error, customErrorMessage);
    toast.error(customErrorMessage);
  }

  const createChatMutation = useMutation({
    mutationFn: async (data: { title?: string | null; initialCoachMessage?: string }) => {
      return await createChat(api, data);
    },
    onSuccess: (newChat) => {
      // Add the new chat to the cache
      queryClient.setQueryData(["ai-chats"], (oldChats: Chat[] = []) => {
        return [newChat, ...oldChats];
      });
      // Auto-select the new chat
      setCurrentChatId(newChat.id);
    },
    onError: (error) => {
      const customErrorMessage = `Failed to create chat`;
      handleQueryError(error, customErrorMessage);
      toast.error(customErrorMessage);
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (data: { message: string; chatId: string }) => {
      // Optimistically add user message to the cache immediately
      const userMessage: Message = {
        id: `temp-${Date.now()}`,
        role: "USER",
        content: data.message,
        createdAt: new Date(),
      };

      queryClient.setQueryData(
        ["ai-messages", data.chatId],
        (oldMessages: Message[] = []) => {
          return [...oldMessages, userMessage];
        }
      );

      // Make the API call which returns the coach's response
      return await sendMessage(api, data);
    },
    onSuccess: (coachMessage, { chatId, message }) => {
      // Add the coach's response to the cache
      queryClient.setQueryData(
        ["ai-messages", chatId],
        (oldMessages: Message[] = []) => {
          return [...oldMessages, coachMessage];
        }
      );
      // Update the chat's updatedAt timestamp
      queryClient.setQueryData(["ai-chats"], (oldChats: Chat[] = []) => {
        return oldChats.map((chat) => {
          if (chat.id === chatId) {
            return { ...chat, updatedAt: new Date() };
          }
          return chat;
        });
      });

      // If this was the first message (detected by checking if we only have 2 messages now),
      // refetch chats after a delay to get the AI-generated title
      queryClient.setQueryData(
        ["ai-messages", chatId],
        (currentMessages: Message[] = []) => {
          // Check if this is the first exchange (user + coach = 2 messages)
          if (currentMessages.length === 2) {
            // Refetch chats after 2 seconds to get the generated title
            setTimeout(() => {
              queryClient.invalidateQueries({ queryKey: ["ai-chats"] });
            }, 2000);
          }
          return currentMessages;
        }
      );
    },
    onError: (error, { chatId }) => {
      // Rollback: remove the optimistic user message on error
      queryClient.setQueryData(
        ["ai-messages", chatId],
        (oldMessages: Message[] = []) => {
          return oldMessages.filter((msg) => !msg.id.startsWith("temp-"));
        }
      );
      const customErrorMessage = `Failed to send message`;
      handleQueryError(error, customErrorMessage);
      toast.error(customErrorMessage);
    },
  });

  const updateChatTitleMutation = useMutation({
    mutationFn: async (data: { chatId: string; title: string }) => {
      return await updateChatTitle(api, data);
    },
    onSuccess: (updatedChat) => {
      // Update the chat in the cache
      queryClient.setQueryData(["ai-chats"], (oldChats: Chat[] = []) => {
        return oldChats.map((chat) => {
          if (chat.id === updatedChat.id) {
            return updatedChat;
          }
          return chat;
        });
      });
      toast.success("Chat title updated");
    },
    onError: (error) => {
      const customErrorMessage = `Failed to update chat title`;
      handleQueryError(error, customErrorMessage);
      toast.error(customErrorMessage);
    },
  });

  const submitFeedbackMutation = useMutation({
    mutationFn: async (data: {
      messageId: string;
      feedbackType: "POSITIVE" | "NEGATIVE";
      feedbackReasons?: string[];
      additionalComments?: string;
    }) => {
      return await submitFeedback(api, data);
    },
    onSuccess: (feedback, { messageId }) => {
      // Update the message in the cache with the new feedback
      queryClient.setQueryData(
        ["ai-messages", currentChatId],
        (oldMessages: Message[] = []) => {
          return oldMessages.map((msg) => {
            if (msg.id === messageId) {
              return { ...msg, feedback: [feedback] };
            }
            return msg;
          });
        }
      );
      if (feedback.feedbackType === "POSITIVE") {
        toast.success("Thanks for your feedback!");
      }
    },
    onError: (error) => {
      const customErrorMessage = `Failed to submit feedback`;
      handleQueryError(error, customErrorMessage);
      toast.error(customErrorMessage);
    },
  });

  const acceptMetricMutation = useMutation({
    mutationFn: async (data: { messageId: string; date?: string }) => {
      return await acceptMetric(api, data);
    },
    onSuccess: (_, { messageId }) => {
      // Refetch messages to get updated status
      queryClient.invalidateQueries({ queryKey: ["ai-messages", currentChatId] });
    },
    onError: (error) => {
      const customErrorMessage = `Failed to accept metric`;
      handleQueryError(error, customErrorMessage);
      toast.error(customErrorMessage);
    },
  });

  const rejectMetricMutation = useMutation({
    mutationFn: async (messageId: string) => {
      return await rejectMetric(api, messageId);
    },
    onSuccess: (_, messageId) => {
      // Refetch messages to get updated status
      queryClient.invalidateQueries({ queryKey: ["ai-messages", currentChatId] });
    },
    onError: (error) => {
      const customErrorMessage = `Failed to reject metric`;
      handleQueryError(error, customErrorMessage);
      toast.error(customErrorMessage);
    },
  });

  const submitAISatisfactionMutation = useMutation({
    mutationFn: async (data: { liked: boolean; content?: string }) => {
      return await submitAISatisfaction(api, data);
    },
    onSuccess: () => {
      toast.success("Thank you for your feedback!");
    },
    onError: (error) => {
      const customErrorMessage = `Failed to submit feedback`;
      handleQueryError(error, customErrorMessage);
      toast.error(customErrorMessage);
    },
  });

  const context: AIContextType = {
    chats: chats.data,
    isLoadingChats: chats.isLoading,
    currentChatId,
    setCurrentChatId,
    messages: messages.data,
    isLoadingMessages: messages.isLoading,
    createChat: createChatMutation.mutateAsync,
    isCreatingChat: createChatMutation.isPending,
    sendMessage: sendMessageMutation.mutateAsync,
    isSendingMessage: sendMessageMutation.isPending,
    updateChatTitle: updateChatTitleMutation.mutateAsync,
    isUpdatingChatTitle: updateChatTitleMutation.isPending,
    submitFeedback: submitFeedbackMutation.mutateAsync,
    isSubmittingFeedback: submitFeedbackMutation.isPending,
    acceptMetric: acceptMetricMutation.mutateAsync,
    isAcceptingMetric: acceptMetricMutation.isPending,
    rejectMetric: rejectMetricMutation.mutateAsync,
    isRejectingMetric: rejectMetricMutation.isPending,
    submitAISatisfaction: submitAISatisfactionMutation.mutateAsync,
    isSubmittingAISatisfaction: submitAISatisfactionMutation.isPending,
    isUserAIWhitelisted,
  };

  return <AIContext.Provider value={context}>{children}</AIContext.Provider>;
};
