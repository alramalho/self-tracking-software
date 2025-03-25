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

export const DailyCheckinCard: React.FC<DailyCheckinCardProps> = ({ aiMessage }) => {
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
  } = useDailyCheckin();
  const { userPaidPlanType } = usePaidPlan();
  const [message, setMessage] = useState<string | null>(null);
  const [messageId, setMessageId] = useState<string | null>(null);


  function buildMessage() {
    let pool: Record<string, string> = {};
    if (daysSinceLastEntry && daysSinceLastEntry >= 3) {
      pool[
        "How did yesterday go?"
      ] = `Hey ${user?.username}! It's been ${daysSinceLastEntry} days since your last checkin, let's start with yesterday. How did it went?`;
      pool[
        "How was your day yesterday?"
      ] = `Hey ${user?.username}, long time no see (${daysSinceLastEntry} days actually). How was your day yesterday?`;
    } else if (daysSinceLastEntry && daysSinceLastEntry == 2) {
      // means last checkin was not today (0 days ago), nor yesterday (1)
      pool[
        "How did yesterday go?"
      ] = `Hey ${user?.username}! Yesterday I didn't hear from you. How was your day?`;
      pool[
        "How was your day yesterday?"
      ] = `Hey ${user?.username}, long time no see (${daysSinceLastEntry} days actually). How was your day yesterday?`;
    } else {
      pool["How was your day?"] = `Hey ${user?.username}! how was your day?`;
      pool[
        "How are you feeling today?"
      ] = `Hi ${user?.username}, how are you feeling today?`;
      pool[
        "Tell me about your day"
      ] = `hi ${user?.username}, care to tell me about your day?`;
    }

    const randomPick = Math.floor(Math.random() * Object.keys(pool).length);
    return {
      message: pool[Object.keys(pool)[randomPick]],
      id: Object.keys(pool)[randomPick],
    };
  }

  useEffect(() => {
    const message = buildMessage();
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
