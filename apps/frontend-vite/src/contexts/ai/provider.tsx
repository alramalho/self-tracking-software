import { useApiWithAuth } from "@/api";
import { useLogError } from "@/hooks/useLogError";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import React from "react";
import { toast } from "react-hot-toast";
import {
  createCoachChat,
  updateChatTitle,
  submitFeedback,
  acceptMetric,
  rejectMetric,
  submitAISatisfaction,
} from "./service";
import { AIContext, type AIContextType, type MessageFeedback } from "./types";
import { useCurrentUser } from "@/contexts/users";
import { useMessages, type Chat, type Message } from "@/contexts/messages";

export const AIProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const queryClient = useQueryClient();
  const api = useApiWithAuth();
  const { handleQueryError } = useLogError();
  const { currentUser } = useCurrentUser();
  const isUserAIWhitelisted = ["liocas", "alex"].includes(
    currentUser?.username || ""
  );

  // Get base messaging functionality from MessagesProvider
  const messagesContext = useMessages();

  const createCoachChatMutation = useMutation({
    mutationFn: async (data: {
      title?: string | null;
      initialCoachMessage?: string;
    }) => {
      return await createCoachChat(api, data);
    },
    onSuccess: (newChat) => {
      // Add the new chat to the cache
      queryClient.setQueryData(["chats"], (oldChats: Chat[] = []) => {
        return [newChat, ...oldChats];
      });
      // Auto-select the new chat
      messagesContext.setCurrentChatId(newChat.id);
    },
    onError: (error) => {
      const customErrorMessage = `Failed to create chat`;
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
      queryClient.setQueryData(["chats"], (oldChats: Chat[] = []) => {
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
        ["messages", messagesContext.currentChatId],
        (oldMessages: Message[] = []) => {
          return oldMessages.map((msg) => {
            if (msg.id === messageId) {
              return { ...msg, feedback: [feedback] };
            }
            return msg;
          });
        }
      );
      if (feedback.metadata?.feedbackType === "POSITIVE") {
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
    onSuccess: () => {
      // Refetch messages to get updated status
      queryClient.invalidateQueries({
        queryKey: ["messages", messagesContext.currentChatId],
      });
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
    onSuccess: () => {
      // Refetch messages to get updated status
      queryClient.invalidateQueries({
        queryKey: ["messages", messagesContext.currentChatId],
      });
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
    // Base messaging functionality from MessagesProvider
    ...messagesContext,

    // AI-specific functionality
    createCoachChat: createCoachChatMutation.mutateAsync,
    isCreatingCoachChat: createCoachChatMutation.isPending,
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
