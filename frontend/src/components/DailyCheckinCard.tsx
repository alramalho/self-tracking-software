import React, { useEffect, useState } from "react";
import { usePaidPlan } from "@/hooks/usePaidPlan";
import AINotification from "./AINotification";
import { useUserPlan } from "@/contexts/UserPlanContext";
import { useDailyCheckin } from "@/contexts/DailyCheckinContext";
import { differenceInDays } from "date-fns";
import { ScanFace } from "lucide-react";
import { useThemeColors } from "@/hooks/useThemeColors";
import { getThemeVariants } from "@/utils/theme";

interface DailyCheckinCardProps {
  aiMessage: string | null;
}

export const DailyCheckinCard: React.FC<DailyCheckinCardProps> = ({
  aiMessage,
}) => {
  const { useCurrentUserDataQuery, useMetricsAndEntriesQuery } = useUserPlan();
  const currentUserDataQuery = useCurrentUserDataQuery();
  const metricsAndEntriesQuery = useMetricsAndEntriesQuery();
  const { data: metricsAndEntriesData } = metricsAndEntriesQuery;
  const entries = metricsAndEntriesData?.entries;

  // Find the latest entry by date
  const latestEntry =
    entries && entries.length > 0
      ? entries.reduce(
          (latest, current) =>
            new Date(current.date) > new Date(latest.date) ? current : latest,
          entries[0]
        )
      : undefined;

  const daysSinceLastEntry = latestEntry
    ? differenceInDays(new Date(), new Date(latestEntry.date))
    : undefined;

  const { data: userData } = currentUserDataQuery;
  const user = userData?.user;
  const {
    show: showDailyCheckinPopover,
    shouldShowNotification,
    hasMissingCheckin,
    dismissCheckin,
    buildCheckinMessage,
  } = useDailyCheckin();
  const { userPaidPlanType } = usePaidPlan();
  const [message, setMessage] = useState<string | null>(null);
  const [messageId, setMessageId] = useState<string | null>(null);

  useEffect(() => {
    const message = buildCheckinMessage();
    setMessage(message.message);
    setMessageId(message.id);
  }, [user, hasMissingCheckin]);

  if (!hasMissingCheckin)
    return (
      <AINotification
        messages={[aiMessage ?? "Thanks for submitting your daily checkin!"]}
        hasNotification={shouldShowNotification}
        createdAt={new Date().toISOString()}
      />
    );

  if (
    (!shouldShowNotification && userPaidPlanType !== "free") ||
    !message ||
    !messageId
  )
    return null;

  return (
    <AINotification
      messages={[aiMessage ?? message]}
      hasNotification={shouldShowNotification}
      createdAt={new Date().toISOString()}
      onDismiss={() => {
        dismissCheckin();
      }}
      onClick={() => {
        showDailyCheckinPopover(messageId);
      }}
    />
  );
};
