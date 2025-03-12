import { useEffect, useState } from "react";
import { useLocalStorage } from "./useLocalStorage";

export function useDailyCheckin() {
  const [lastCheckinDate, setLastCheckinDate] = useLocalStorage<string | null>(
    "lastCheckinDatetime",
    null
  );

  const [wasSubmittedToday, setWasSubmittedToday] = useState<boolean>(false);

  useEffect(() => {
    if (!lastCheckinDate) {
      setWasSubmittedToday(false);
      return;
    }

    const lastCheckin = new Date(lastCheckinDate);
    const today = new Date();

    // Check if the last check-in was today
    const wasToday =
      lastCheckin.getFullYear() === today.getFullYear() &&
      lastCheckin.getMonth() === today.getMonth() &&
      lastCheckin.getDate() === today.getDate();

    setWasSubmittedToday(wasToday);
  }, [lastCheckinDate]);

  const markAsSubmitted = () => {
    setLastCheckinDate(new Date().toISOString());
    setWasSubmittedToday(true);
  };

  return {
    wasSubmittedToday,
    markAsSubmitted,
  };
}
