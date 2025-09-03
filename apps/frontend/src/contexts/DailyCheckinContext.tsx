import { InsightsBanner } from "@/components/InsightsBanner";
import { useMetrics } from "@/contexts/metrics";
import { differenceInCalendarDays, isToday } from "date-fns";
import React, { createContext, useContext, useEffect, useState } from "react";
import { useCurrentUser } from "./users";

interface DailyCheckinContextType {
  show: (initialMessage?: string) => void;
  hasCheckedInToday: boolean;
  shouldShowNotification: boolean;
  dismissCheckin: () => void;
  markAsSubmitted: () => void;
  checkinMessage: string | undefined;
  buildCheckinMessage: () => { message: string; id: string };
  logIndividualMetric: (metricId: string, rating: number) => Promise<void>;
  areAllMetricsCompleted: boolean;
}

const DailyCheckinContext = createContext<DailyCheckinContextType | undefined>(
  undefined
);

export const useDailyCheckin = () => {
  const context = useContext(DailyCheckinContext);
  if (!context) {
    throw new Error(
      "useDailyCheckin must be used within a DailyCheckinProvider"
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
  const [hasCheckedInToday, setHasCheckedInToday] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const { currentUser: user } = useCurrentUser();
  const { metrics, entries, logIndividualMetric } = useMetrics();
  const [checkinMessage, setCheckinMessage] = useState<string | undefined>(
    undefined
  );

  useEffect(() => {
    if (user) {
      setCheckinMessage(buildCheckinMessage().message);
    }
  }, [user]);

  const buildCheckinMessage = (): { message: string; id: string } => {
    const currentHours = new Date().getHours();
    let pool: Record<string, string> = {};

    if (currentHours < 19) {
      pool[
        "How is your day going?"
      ] = `Hey ${user?.username}! You haven't checked in yet. How is your day going?`;
    } else {
      pool["How was your day?"] = `Hey ${user?.username}! How was your day?`;
    }

    const randomPick = Math.floor(Math.random() * Object.keys(pool).length);
    return {
      message: pool[Object.keys(pool)[randomPick]],
      id: Object.keys(pool)[randomPick],
    };
  };

  const areAllMetricsCompleted = React.useMemo(() => {
    if (!metrics?.length) return false;

    return metrics.every((metric) => {
      const todaysEntry = entries?.find(
        (entry) => entry.metricId === metric.id && isToday(entry.date)
      );

      return todaysEntry && (todaysEntry.rating > 0 || todaysEntry.skipped);
    });
  }, [metrics, entries]);

  const latestEntry =
    entries && entries.length > 0
      ? entries.reduce(
          (latest, current) =>
            new Date(current.date) > new Date(latest.date) ? current : latest,
          entries[0]
        )
      : undefined;

  const daysSinceLastEntry = latestEntry
    ? differenceInCalendarDays(new Date(), new Date(latestEntry.date))
    : undefined;

  useEffect(() => {
    if (!latestEntry || (daysSinceLastEntry && daysSinceLastEntry >= 1)) {
      setHasCheckedInToday(false);
      return;
    }

    const lastCheckin = new Date(latestEntry.date);
    const today = new Date();

    const wasToday =
      lastCheckin.getFullYear() === today.getFullYear() &&
      lastCheckin.getMonth() === today.getMonth() &&
      lastCheckin.getDate() === today.getDate();

    if (wasToday) {
      setHasCheckedInToday(true);
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

  const shouldShowNotification = hasCheckedInToday && !isDismissed;

  return (
    <DailyCheckinContext.Provider
      value={{
        show: (initialMessage?: string) => {
          setInitialMessage(initialMessage);
          setShowDailyCheckinPopover(true);
        },
        hasCheckedInToday: hasCheckedInToday,
        shouldShowNotification,
        dismissCheckin,
        markAsSubmitted,
        checkinMessage,
        buildCheckinMessage,
        logIndividualMetric,
        areAllMetricsCompleted,
      }}
    >
      {children}
      <InsightsBanner
        open={showDailyCheckinPopover}
        onClose={() => setShowDailyCheckinPopover(false)}
      />
    </DailyCheckinContext.Provider>
  );
};
