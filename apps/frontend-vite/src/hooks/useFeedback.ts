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
      email?: string;
      images?: File[];
    }) => {
      const formData = new FormData();
      formData.append("email", data.email || currentUser?.email || "");
      formData.append("text", data.text);
      formData.append("type", data.type);

      // Add images if provided
      if (data.images && data.images.length > 0) {
        data.images.forEach((image) => {
          formData.append("images", image);
        });
      }

      await api.post("/users/report-feedback", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
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
