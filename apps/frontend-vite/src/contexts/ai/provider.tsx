import { useApiWithAuth } from "@/api";
import { useLogError } from "@/hooks/useLogError";
import { toDisplayErrorMessage } from "@/utils/errorMessage";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import React from "react";
import { toast } from "react-hot-toast";
import {
  createCoachChat,
  runCoachAssessment,
  updateChatTitle,
  submitFeedback,
  acceptMetric,
  rejectMetric,
  acceptProposal,
  rejectProposal,
  acceptPlanCreationProposal,
  rejectPlanCreationProposal,
  proposePlanCreationChanges,
  acceptActivityLogProposal,
  rejectActivityLogProposal,
  acceptActivityEditProposal,
  rejectActivityEditProposal,
  acceptUserContextEventProposal,
  rejectUserContextEventProposal,
  submitAISatisfaction,
} from "./service";
import { AIContext, type AIContextType } from "./types";
import { useCurrentUser } from "@/contexts/users";
import { useMessages, type Chat, type Message } from "@/contexts/messages";

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

const COACH_NO_REPORT_STORAGE_KEY = "tracking-so:last-coach-no-report-at";

const readLastCoachNoReportAt = () => {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(COACH_NO_REPORT_STORAGE_KEY);
};

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
  const [lastCoachNoReportAt, setLastCoachNoReportAt] = React.useState<
    string | null
  >(readLastCoachNoReportAt);

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

  const runCoachAssessmentMutation = useMutation({
    mutationFn: async () => {
      return await runCoachAssessment(api);
    },
    onSuccess: (response) => {
      if (response.result.action === "agent_skipped") {
        const noReportAt = new Date().toISOString();
        setLastCoachNoReportAt(noReportAt);
        if (typeof window !== "undefined") {
          window.localStorage.setItem(COACH_NO_REPORT_STORAGE_KEY, noReportAt);
        }
      } else {
        setLastCoachNoReportAt(null);
        if (typeof window !== "undefined") {
          window.localStorage.removeItem(COACH_NO_REPORT_STORAGE_KEY);
        }
      }
      queryClient.invalidateQueries({ queryKey: ["chats"] });
      queryClient.invalidateQueries({
        queryKey: ["messages", messagesContext.currentChatId],
      });
    },
    onError: (error: any) => {
      const customErrorMessage =
        toDisplayErrorMessage(
          error?.response?.data?.error,
          "Failed to run coach assessment"
        );
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

  const acceptProposalMutation = useMutation({
    mutationFn: async (data: { messageId: string; proposalIndex: number }) => {
      return await acceptProposal(api, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["messages", messagesContext.currentChatId],
      });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["plans"] });
      queryClient.invalidateQueries({ queryKey: ["current-user"] });
      toast.success("Plan updated!");
    },
    onError: (error) => {
      handleQueryError(error, "Failed to accept proposal");
      toast.error("Failed to accept proposal");
    },
  });

  const rejectProposalMutation = useMutation({
    mutationFn: async (data: { messageId: string; proposalIndex: number }) => {
      return await rejectProposal(api, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["messages", messagesContext.currentChatId],
      });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (error) => {
      handleQueryError(error, "Failed to reject proposal");
      toast.error("Failed to reject proposal");
    },
  });

  const acceptPlanCreationProposalMutation = useMutation({
    mutationFn: async (data: { messageId: string; proposalIndex: number }) => {
      return await acceptPlanCreationProposal(api, data);
    },
    onSuccess: (result, { messageId, proposalIndex }) => {
      queryClient.setQueryData(
        ["messages", messagesContext.currentChatId],
        (oldMessages: Message[] = []) =>
          oldMessages.map((msg) => {
            if (msg.id !== messageId || !msg.planCreationProposals) return msg;

            const updatedProposals = msg.planCreationProposals.map(
              (proposal, index) =>
                index === proposalIndex
                  ? {
                      ...proposal,
                      status: "accepted" as const,
                      planId: result.plan?.id || proposal.planId,
                    }
                  : proposal
            );

            return { ...msg, planCreationProposals: updatedProposals };
          })
      );
      queryClient.invalidateQueries({
        queryKey: ["messages", messagesContext.currentChatId],
      });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["plans"] });
      queryClient.invalidateQueries({ queryKey: ["current-user"] });
      toast.success("Plan created!");
    },
    onError: (error) => {
      handleQueryError(error, "Failed to create plan");
      toast.error("Failed to create plan");
    },
  });

  const rejectPlanCreationProposalMutation = useMutation({
    mutationFn: async (data: { messageId: string; proposalIndex: number }) => {
      return await rejectPlanCreationProposal(api, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["messages", messagesContext.currentChatId],
      });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (error) => {
      handleQueryError(error, "Failed to reject plan creation");
      toast.error("Failed to reject plan creation");
    },
  });

  const proposePlanCreationChangesMutation = useMutation({
    mutationFn: async (data: {
      messageId: string;
      proposalIndex: number;
      requestedProposal: unknown;
      note?: string | null;
    }) => {
      return await proposePlanCreationChanges(api, data);
    },
    onSuccess: (newMessages, { messageId, proposalIndex }) => {
      queryClient.setQueryData(
        ["messages", messagesContext.currentChatId],
        (oldMessages: Message[] = []) => {
          const newProposalMessageIds = new Set(newMessages.map((msg) => msg.id));
          const shouldCancelPendingPlanCreations =
            newMessages.some(hasPlanCreationProposal);
          const preparedMessages = shouldCancelPendingPlanCreations
            ? cancelPendingPlanCreationProposalsInCache(
                oldMessages,
                newProposalMessageIds
              )
            : oldMessages;
          const updatedMessages = preparedMessages.map((msg) => {
            if (msg.id !== messageId || !msg.planCreationProposals) return msg;
            const updatedProposals = [...msg.planCreationProposals];
            updatedProposals[proposalIndex] = {
              ...updatedProposals[proposalIndex],
              status: "changes_requested",
            };
            return { ...msg, planCreationProposals: updatedProposals };
          });

          const existingIds = new Set(updatedMessages.map((msg) => msg.id));
          return [
            ...updatedMessages,
            ...newMessages.filter((msg) => !existingIds.has(msg.id)),
          ];
        }
      );
      queryClient.invalidateQueries({
        queryKey: ["messages", messagesContext.currentChatId],
      });
      queryClient.invalidateQueries({ queryKey: ["chats"] });
    },
    onError: (error) => {
      handleQueryError(error, "Failed to propose plan changes");
      toast.error("Failed to propose plan changes");
    },
  });

  const acceptActivityLogProposalMutation = useMutation({
    mutationFn: async (data: { messageId: string; proposalIndex: number }) => {
      return await acceptActivityLogProposal(api, data);
    },
    onSuccess: (_, { messageId, proposalIndex }) => {
      queryClient.setQueryData(
        ["messages", messagesContext.currentChatId],
        (oldMessages: Message[] = []) =>
          oldMessages.map((msg) => {
            if (msg.id !== messageId || !msg.activityLogProposals) return msg;
            const updated = [...msg.activityLogProposals];
            updated[proposalIndex] = { ...updated[proposalIndex], status: "accepted" };
            return { ...msg, activityLogProposals: updated };
          })
      );
      toast.success("Activity logged!");
    },
    onError: (error) => {
      handleQueryError(error, "Failed to log activity");
      toast.error("Failed to log activity");
    },
  });

  const rejectActivityLogProposalMutation = useMutation({
    mutationFn: async (data: { messageId: string; proposalIndex: number }) => {
      return await rejectActivityLogProposal(api, data);
    },
    onSuccess: (_, { messageId, proposalIndex }) => {
      queryClient.setQueryData(
        ["messages", messagesContext.currentChatId],
        (oldMessages: Message[] = []) =>
          oldMessages.map((msg) => {
            if (msg.id !== messageId || !msg.activityLogProposals) return msg;
            const updated = [...msg.activityLogProposals];
            updated[proposalIndex] = { ...updated[proposalIndex], status: "rejected" };
            return { ...msg, activityLogProposals: updated };
          })
      );
    },
    onError: (error) => {
      handleQueryError(error, "Failed to reject activity log");
      toast.error("Failed to reject activity log");
    },
  });

  const acceptActivityEditProposalMutation = useMutation({
    mutationFn: async (data: { messageId: string; proposalIndex: number }) => {
      return await acceptActivityEditProposal(api, data);
    },
    onSuccess: (_, { messageId, proposalIndex }) => {
      queryClient.setQueryData(
        ["messages", messagesContext.currentChatId],
        (oldMessages: Message[] = []) =>
          oldMessages.map((msg) => {
            if (msg.id !== messageId || !msg.activityEditProposals) return msg;
            const updated = [...msg.activityEditProposals];
            updated[proposalIndex] = {
              ...updated[proposalIndex],
              status: "accepted",
            };
            return { ...msg, activityEditProposals: updated };
          })
      );
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      queryClient.invalidateQueries({ queryKey: ["activity-entries"] });
      queryClient.invalidateQueries({ queryKey: ["plans"] });
      queryClient.invalidateQueries({ queryKey: ["timeline"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("Activity updated!");
    },
    onError: (error) => {
      handleQueryError(error, "Failed to update activity");
      toast.error(toDisplayErrorMessage(error, "Failed to update activity"));
    },
  });

  const rejectActivityEditProposalMutation = useMutation({
    mutationFn: async (data: { messageId: string; proposalIndex: number }) => {
      return await rejectActivityEditProposal(api, data);
    },
    onSuccess: (_, { messageId, proposalIndex }) => {
      queryClient.setQueryData(
        ["messages", messagesContext.currentChatId],
        (oldMessages: Message[] = []) =>
          oldMessages.map((msg) => {
            if (msg.id !== messageId || !msg.activityEditProposals) return msg;
            const updated = [...msg.activityEditProposals];
            updated[proposalIndex] = {
              ...updated[proposalIndex],
              status: "rejected",
            };
            return { ...msg, activityEditProposals: updated };
          })
      );
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (error) => {
      handleQueryError(error, "Failed to reject activity edit");
      toast.error("Failed to reject activity edit");
    },
  });

  const acceptUserContextEventProposalMutation = useMutation({
    mutationFn: async (data: { messageId: string; proposalIndex: number }) => {
      return await acceptUserContextEventProposal(api, data);
    },
    onSuccess: (result, { messageId, proposalIndex }) => {
      queryClient.setQueryData(
        ["messages", messagesContext.currentChatId],
        (oldMessages: Message[] = []) =>
          oldMessages.map((msg) => {
            if (msg.id !== messageId || !msg.userContextEventProposals) return msg;
            const updated = [...msg.userContextEventProposals];
            updated[proposalIndex] = {
              ...updated[proposalIndex],
              status: "accepted",
              contextEventId: result.event?.id || updated[proposalIndex]?.contextEventId,
            };
            return { ...msg, userContextEventProposals: updated };
          })
      );
      queryClient.invalidateQueries({ queryKey: ["context-events"] });
      toast.success("Context saved");
    },
    onError: (error) => {
      handleQueryError(error, "Failed to save context");
      toast.error("Failed to save context");
    },
  });

  const rejectUserContextEventProposalMutation = useMutation({
    mutationFn: async (data: { messageId: string; proposalIndex: number }) => {
      return await rejectUserContextEventProposal(api, data);
    },
    onSuccess: (_, { messageId, proposalIndex }) => {
      queryClient.setQueryData(
        ["messages", messagesContext.currentChatId],
        (oldMessages: Message[] = []) =>
          oldMessages.map((msg) => {
            if (msg.id !== messageId || !msg.userContextEventProposals) return msg;
            const updated = [...msg.userContextEventProposals];
            updated[proposalIndex] = {
              ...updated[proposalIndex],
              status: "rejected",
            };
            return { ...msg, userContextEventProposals: updated };
          })
      );
    },
    onError: (error) => {
      handleQueryError(error, "Failed to reject context");
      toast.error("Failed to reject context");
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
    runCoachAssessment: runCoachAssessmentMutation.mutateAsync,
    isRunningCoachAssessment: runCoachAssessmentMutation.isPending,
    lastCoachNoReportAt,
    updateChatTitle: updateChatTitleMutation.mutateAsync,
    isUpdatingChatTitle: updateChatTitleMutation.isPending,
    submitFeedback: submitFeedbackMutation.mutateAsync,
    isSubmittingFeedback: submitFeedbackMutation.isPending,
    acceptMetric: acceptMetricMutation.mutateAsync,
    isAcceptingMetric: acceptMetricMutation.isPending,
    rejectMetric: rejectMetricMutation.mutateAsync,
    isRejectingMetric: rejectMetricMutation.isPending,
    acceptProposal: acceptProposalMutation.mutateAsync,
    rejectProposal: rejectProposalMutation.mutateAsync,
    acceptPlanCreationProposal: acceptPlanCreationProposalMutation.mutateAsync,
    rejectPlanCreationProposal: rejectPlanCreationProposalMutation.mutateAsync,
    proposePlanCreationChanges: proposePlanCreationChangesMutation.mutateAsync,
    acceptActivityLogProposal: acceptActivityLogProposalMutation.mutateAsync,
    rejectActivityLogProposal: rejectActivityLogProposalMutation.mutateAsync,
    acceptActivityEditProposal: acceptActivityEditProposalMutation.mutateAsync,
    rejectActivityEditProposal: rejectActivityEditProposalMutation.mutateAsync,
    acceptUserContextEventProposal: acceptUserContextEventProposalMutation.mutateAsync,
    rejectUserContextEventProposal: rejectUserContextEventProposalMutation.mutateAsync,
    submitAISatisfaction: submitAISatisfactionMutation.mutateAsync,
    isSubmittingAISatisfaction: submitAISatisfactionMutation.isPending,
    isUserAIWhitelisted,
  };

  return <AIContext.Provider value={context}>{children}</AIContext.Provider>;
};
