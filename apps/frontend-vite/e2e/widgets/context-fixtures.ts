import { metrics, entries } from "./data";
export const useMetrics = () => ({ metrics, entries });
export const useCurrentUser = () => ({
  currentUser: { coachPersonality: "CHAMPION" },
});
export const useTheme = () => ({ effectiveTheme: "blue" });
