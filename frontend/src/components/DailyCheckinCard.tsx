import React, { useEffect, useState } from "react";
import { usePaidPlan } from "@/hooks/usePaidPlan";
import AINotification from "./AINotification";
import { useUserPlan } from "@/contexts/UserPlanContext";
import { useDailyCheckinPopover } from "@/contexts/DailyCheckinContext";
import { useDailyCheckin } from "@/hooks/useDailyCheckin";

interface DailyCheckinCardProps {}

export const DailyCheckinCard: React.FC<DailyCheckinCardProps> = ({}) => {
  const { useCurrentUserDataQuery } = useUserPlan();
  const currentUserDataQuery = useCurrentUserDataQuery();
  const { data: userData } = currentUserDataQuery;
  const user = userData?.user;
  const { show: showDailyCheckinPopover } = useDailyCheckinPopover();
  const { wasSubmittedToday } = useDailyCheckin();
  const [dismissed, setDismissed] = useState(false);
  const { userPaidPlanType } = usePaidPlan();
  const visible =
    !wasSubmittedToday && !dismissed && userPaidPlanType !== "free";
  const [message, setMessage] = useState<string | null>(null);
  const [messageId, setMessageId] = useState<string | null>(null);

  const DAILY_CHECKIN_MESSAGES = {
    "How was your day?": `Hey ${user?.username}, how was your day?`,
    "How are you feeling today?": `Hi ${user?.username}! How are you feeling today?`,
    "Tell me about your day": `${user?.username}, I'd love to hear about your day!`, 
    "Time to check in!": `Time to check in ${user?.username} :) `
  };

  useEffect(() => {
    const messages = Object.values(DAILY_CHECKIN_MESSAGES);
    const randomPick = messages[Math.floor(Math.random() * messages.length)];
    setMessage(randomPick);
    setMessageId(Object.keys(DAILY_CHECKIN_MESSAGES)[Math.floor(Math.random() * Object.keys(DAILY_CHECKIN_MESSAGES).length)]);
  }, [user]);

  if (!visible || !message || !messageId) return null;

  return (
    <AINotification
      message={message}
      createdAt={new Date().toISOString()}
      onDismiss={() => {
        setDismissed(true);
      }}
      onClick={() => {
        showDailyCheckinPopover(messageId);
      }}
    />
  );
};
