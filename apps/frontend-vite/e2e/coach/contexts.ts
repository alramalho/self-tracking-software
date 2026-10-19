// Stand-ins for the app's data contexts and API, so the real components render without signing in.
import axios from "axios";
import { activities, activityEntries, followThrough, metricEntries, metrics, plans } from "./data";

export const requests: { method: string; url: string; body: unknown }[] = [];
(window as unknown as { __requests: typeof requests }).__requests = requests;

const api = axios.create();
api.defaults.adapter = async (config) => {
  const url = config.url ?? "";
  const body = config.data ? JSON.parse(config.data as string) : undefined;
  requests.push({ method: (config.method ?? "get").toUpperCase(), url, body });
  let data: unknown = {};
  if (url === "/follow-through") data = structuredClone(followThrough);
  else if (url === "/follow-through/reach-outs") {
    followThrough.state.pausedAt = body.enabled ? null : new Date().toISOString();
    followThrough.state.monitoring.outreachPaused = !body.enabled;
  } else if (url.startsWith("/follow-through/plans/")) {
    followThrough.state.supports[url.split("/").at(-1)!] = body;
  } else if (url.startsWith("/follow-through/nudges/")) {
    for (const r of followThrough.state.monitoring.requests) if (r.messageId === url.split("/").at(-1)) r.resolvedAt = new Date().toISOString();
  } else if (url === "/ai/coach/attention") data = { attentionItems: [] };
  else if (url === "/circles/mine") data = [];
  return { data, status: 200, statusText: "OK", headers: {}, config };
};
export const useApiWithAuth = () => api;

export const usePlans = () => ({
  plans,
  isLoadingPlans: false,
  pausePlan: async () => {},
  resumePlan: async () => {},
  archivePlan: async () => {},
  unarchivePlan: async () => {},
  deletePlan: async () => {},
});
export const useActivities = () => ({ activities, activityEntries, isLoadingActivityEntries: false });
export const useMetrics = () => ({ metrics, entries: metricEntries });
export const useCurrentUser = () => ({
  currentUser: { username: "alex", name: "Alex", coachPersonality: "CHAMPION", planType: "PLUS" },
});
export const useTheme = () => ({ effectiveTheme: "blue" });
export const useNotifications = () => ({ notificationCount: 0 });
export const useUpgrade = () => ({ setShowUpgradePopover: () => {} });
