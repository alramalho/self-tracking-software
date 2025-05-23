import React, { createContext, useContext, useEffect, useState } from "react";
import { DailyCheckinBanner } from "@/components/DailyCheckinBanner";
import { useUserPlan } from "@/contexts/UserPlanContext";
import { differenceInDays } from "date-fns";
import { InsightsBanner } from "@/components/InsightsBanner";

interface DailyCheckinContextType {
  show: (initialMessage?: string) => void;
  hasMissingCheckin: boolean;
  shouldShowNotification: boolean;
  dismissCheckin: () => void;
  markAsSubmitted: () => void;
  checkinMessage: string | undefined;
}

const DailyCheckinContext = createContext<DailyCheckinContextType | undefined>(
  undefined
);

export const useDailyCheckin = () => {
  const context = useContext(DailyCheckinContext);
  if (!context) {
    throw new Error(
      "useDailyCheckinPopover must be used within a DailyCheckinPopoverProvider"
    );
  }
  return context;
};

export const DailyCheckinPopoverProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [showDailyCheckinPopover, setShowDailyCheckinPopover] = useState(false);
  const [initialMessage, setInitialMessage] = useState<string | undefined>(
    undefined
  );
  const [hasMissingCheckin, setHasMissingCheckin] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const { useMetricsAndEntriesQuery, useCurrentUserDataQuery } = useUserPlan();
  const metricsAndEntriesQuery = useMetricsAndEntriesQuery();
  const { data: metricsAndEntriesData } = metricsAndEntriesQuery;
  const entries = metricsAndEntriesData?.entries;
  const { data: userData } = useCurrentUserDataQuery();
  const [checkinMessage, setCheckinMessage] = useState<string | undefined>(
    undefined
  );
  const user = userData?.user;

  useEffect(() => {
    if (user) {
      setCheckinMessage(buildCheckinMessage().message);
    }
  }, [user]);

  const buildCheckinMessage = (): { message: string; id: string } => {
    const currentHours = new Date().getHours();
    let pool: Record<string, string> = {};

    if (currentHours < 19) {
      pool["How is your day going?"] = `Hey ${user?.username}! You haven't checked in yet. How is your day going?`;
    } else {
      pool["How was your day?"] = `Hey ${user?.username}! How was your day?`;
    }
    // pool[
    //   "How are you feeling today?"
    // ] = `Hi ${user?.username}, how are you feeling today?`;
    // pool[
    //   "Tell me about your day"
    // ] = `hi ${user?.username}, care to tell me about your day?`;

    const randomPick = Math.floor(Math.random() * Object.keys(pool).length);
    return {
      message: pool[Object.keys(pool)[randomPick]],
      id: Object.keys(pool)[randomPick],
    };
  }
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

  useEffect(() => {
    if (!latestEntry || (daysSinceLastEntry && daysSinceLastEntry > 1)) {
      setHasMissingCheckin(true);
      return;
    }

    const lastCheckin = new Date(latestEntry.date);
    const today = new Date();

    // Check if the last check-in was today
    const wasToday =
      lastCheckin.getFullYear() === today.getFullYear() &&
      lastCheckin.getMonth() === today.getMonth() &&
      lastCheckin.getDate() === today.getDate();

    if (wasToday) {
      setHasMissingCheckin(false);
    } else {
      const now = new Date();
      const hours = now.getHours();
      const isAfter4PM = hours >= 16;
      setHasMissingCheckin(isAfter4PM);
    }

    // Reset dismissal state at the start of a new day
    if (!wasToday && isDismissed) {
      setIsDismissed(false);
    }
  }, [latestEntry, isDismissed]);

  const markAsSubmitted = () => {
    setIsDismissed(false); // Reset dismissal when submitted
    setShowDailyCheckinPopover(false);
  };

  const dismissCheckin = () => {
    setIsDismissed(true);
    setShowDailyCheckinPopover(false);
  };

  const shouldShowNotification = hasMissingCheckin && !isDismissed;

  return (
    <DailyCheckinContext.Provider
      value={{
        show: (initialMessage?: string) => {
          setInitialMessage(initialMessage);
          setShowDailyCheckinPopover(true);
        },
        hasMissingCheckin,
        shouldShowNotification,
        dismissCheckin,
        markAsSubmitted,
        checkinMessage,
        buildCheckinMessage,
      }}
    >
      {children}
      {/* <DailyCheckinBanner
        open={showDailyCheckinPopover}
        onClose={() => setShowDailyCheckinPopover(false)}
        initialMessage={initialMessage}
      /> */}
      <InsightsBanner
        open={showDailyCheckinPopover}
        onClose={() => setShowDailyCheckinPopover(false)}
      />
    </DailyCheckinContext.Provider>
  );
};
