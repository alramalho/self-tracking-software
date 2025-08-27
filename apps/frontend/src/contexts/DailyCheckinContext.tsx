import { useApiWithAuth } from "@/api";
import { InsightsBanner } from "@/components/InsightsBanner";
import { useUserPlan } from "@/contexts/UserGlobalContext";
import { differenceInCalendarDays, isToday } from "date-fns";
import React, { createContext, useContext, useEffect, useState } from "react";
import { toast } from "react-hot-toast";

interface DailyCheckinContextType {
  show: (initialMessage?: string) => void;
  hasCheckedInToday: boolean;
  shouldShowNotification: boolean;
  dismissCheckin: () => void;
  markAsSubmitted: () => void;
  checkinMessage: string | undefined;
  buildCheckinMessage: () => { message: string; id: string };
  logIndividualMetric: (metricId: string, rating: number) => Promise<void>;
  skipMetric: (metricId: string) => Promise<void>;
  areAllMetricsCompleted: boolean;
  logTodaysNote: (note: string) => Promise<void>;
  skipTodaysNote: () => Promise<void>;
}

const DailyCheckinContext = createContext<DailyCheckinContextType | undefined>(
  undefined
);

export const useDailyCheckin = () => {
  const context = useContext(DailyCheckinContext);
  if (!context) {
    throw new Error("useDailyCheckin must be used within a DailyCheckinProvider");
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
  const { useMetricsAndEntriesQuery, useCurrentUserDataQuery } = useUserPlan();
  const metricsAndEntriesQuery = useMetricsAndEntriesQuery();
  const { data: metricsAndEntriesData } = metricsAndEntriesQuery;
  const entries = metricsAndEntriesData?.entries;
  const metrics = metricsAndEntriesData?.metrics || [];
  const { data: userData } = useCurrentUserDataQuery();
  const [checkinMessage, setCheckinMessage] = useState<string | undefined>(
    undefined
  );
  const user = userData;
  const api = useApiWithAuth();

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

    const randomPick = Math.floor(Math.random() * Object.keys(pool).length);
    return {
      message: pool[Object.keys(pool)[randomPick]],
      id: Object.keys(pool)[randomPick],
    };
  }

  // Check if all metrics are completed (either logged today or skipped)
  const areAllMetricsCompleted = React.useMemo(() => {
    if (!metrics.length) return false;
    
    const today = new Date().toISOString().split("T")[0];
    
    return metrics.every(metric => {
      // Check if metric is logged or skipped today
      const todaysEntry = entries?.find(
        entry => 
          entry.metricId === metric.id && 
          isToday(entry.date)
      );
      
      return todaysEntry && (todaysEntry.rating > 0 || todaysEntry.skipped);
    });
  }, [metrics, entries]);

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
    ? differenceInCalendarDays(new Date(), new Date(latestEntry.date))
    : undefined;

  useEffect(() => {
    
    if (!latestEntry || (daysSinceLastEntry && daysSinceLastEntry >= 1) ) {
      setHasCheckedInToday(false);
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

  const logIndividualMetric = async (metricId: string, rating: number): Promise<void> => {
    try {
      await api.post("/metrics/log-metric", {
        metric_id: metricId,
        rating: rating,
        date: new Date().toISOString(),
      });
      
      // Refresh metrics data
      await metricsAndEntriesQuery.refetch();
      toast.success("Metric logged successfully!");
    } catch (error) {
      console.error("Error logging individual metric:", error);
      toast.error("Failed to log metric");
      throw error;
    }
  };

  const logTodaysNote = async (note: string): Promise<void> => {
    try {
      await api.post("/metrics/log-todays-note", {
        note: note,
      });
      
      // Refresh metrics data to get updated descriptions
      await metricsAndEntriesQuery.refetch();
      toast.success("Note added to today's entries!");
    } catch (error) {
      console.error("Error logging today's note:", error);
      toast.error("Failed to add note");
      throw error;
    }
  };

  const skipMetric = async (metricId: string): Promise<void> => {
    try {
      await api.post("/metrics/skip-metric", {
        metric_id: metricId,
        date: new Date().toISOString(),
      });
      
      // Refresh metrics data
      await metricsAndEntriesQuery.refetch();
      toast.success("Metric skipped successfully!");
    } catch (error) {
      console.error("Error skipping metric:", error);
      toast.error("Failed to skip metric");
      throw error;
    }
  };

  const skipTodaysNote = async (): Promise<void> => {
    try {
      await api.post("/metrics/skip-todays-note");
      
      // Refresh metrics data
      await metricsAndEntriesQuery.refetch();
      toast.success("Today's note skipped successfully!");
    } catch (error) {
      console.error("Error skipping today's note:", error);
      toast.error("Failed to skip today's note");
      throw error;
    }
  };

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
        skipMetric,
        areAllMetricsCompleted,
        logTodaysNote,
        skipTodaysNote,
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
