import React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useApiWithAuth } from "@/api";
import AINotification from "@/components/AINotification";
import { useAIMessageCache } from "@/hooks/useAIMessageCache";
import { useFeatureFlag } from "@/hooks/useFeatureFlags";

export function MetricsAINotification() {
  const router = useRouter();
  const { message: aiMessage, messageId, isDismissed, dismiss, timestamp } = useAIMessageCache('metrics');
  const [shouldShowNotification, setShouldShowNotification] = React.useState(false);

  React.useEffect(() => {
    if (aiMessage && !isDismissed) {
      setShouldShowNotification(true);
    }
  }, [aiMessage, isDismissed]);

  if (!shouldShowNotification) {
    return null;
  }

  return (
    <AINotification
      message={aiMessage}
      createdAt={new Date(timestamp).toISOString()}
      onDismiss={() => {
        setShouldShowNotification(false);
        dismiss();
      }}
      onClick={() => {
        setShouldShowNotification(false);
        router.push(
          `/ai?assistantType=metrics-companion&messageId=${messageId}&messageText=${aiMessage}`
        );
      }}
    />
  );
} 