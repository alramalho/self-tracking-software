import React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useApiWithAuth } from "@/api";
import AINotification from "@/components/AINotification";
import { useAIMessageCache } from "@/hooks/useAIMessageCache";
import { useFeatureFlag } from "@/hooks/useFeatureFlags";

export function MetricsAINotification() {
  const router = useRouter();
  const api = useApiWithAuth();
  const { message: aiMessage, messageId, isDismissed, dismiss } = useAIMessageCache('metrics');
  const [shouldShowNotification, setShouldShowNotification] = React.useState(false);
  const { isEnabled: isAIEnabled } = useFeatureFlag("ai-bot-access");

  React.useEffect(() => {
    if (aiMessage && !isDismissed && isAIEnabled) {
      setShouldShowNotification(true);
    }
  }, [aiMessage, isDismissed, isAIEnabled]);

  if (!shouldShowNotification || !isAIEnabled) {
    return null;
  }

  return (
    <AINotification
      message={aiMessage}
      createdAt={new Date().toISOString()}
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