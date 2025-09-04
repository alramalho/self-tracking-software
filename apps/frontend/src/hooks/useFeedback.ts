import { useApiWithAuth } from "@/api";
import { useCurrentUser } from "@/contexts/users";
import { useMutation } from "@tanstack/react-query";
import { toast } from "react-hot-toast";

export const useFeedback = () => {
  const api = useApiWithAuth();
  const { currentUser } = useCurrentUser();

  const sendFeedbackMutation = useMutation({
    mutationFn: async (data: {
      text: string;
      type: "feature_request" | "help_request" | "bug_report";
    }) => {
      await api.post("/users/report-feedback", {
        email: currentUser?.email,
        text: data.text,
        type: data.type,
      });
    },
    onSuccess: () => {
      toast.success("Feedback sent successfully");
    },
    onError: (error) => {
      console.error("Error sending feedback:", error);
      toast.error("Failed to send feedback");
    },
  });

  return {
    sendFeedback: sendFeedbackMutation.mutateAsync,
    isSendingFeedback: sendFeedbackMutation.isPending,
  };
};
