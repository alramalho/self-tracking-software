import { differenceInCalendarDays, formatDistanceToNowStrict } from "date-fns";
import type { DateValue, Plan } from "@/core/types";
import type { AgentSyncTier } from "./types";

type PlanDates = Pick<Plan, "archivedAt" | "deletedAt" | "finishingDate">;

export const isPlanArchived = (plan: Pick<Plan, "archivedAt">) =>
  !!plan.archivedAt;

export const isPlanExpired = (
  plan: Pick<Plan, "finishingDate">,
  now = new Date(),
) => !!plan.finishingDate && new Date(plan.finishingDate) < now;

export const isPlanInactive = (plan: PlanDates, now = new Date()) =>
  isPlanArchived(plan) || isPlanExpired(plan, now);

export const isPlanActive = (plan: PlanDates, now = new Date()) =>
  !plan.deletedAt && !isPlanInactive(plan, now);

// Mirrors the PWA's client-side limit: free accounts keep one plan.
export const maxPlans = (planType?: string | null) =>
  planType && planType !== "FREE" ? 100 : 1;

export const inactivePlanStatus = (plan: PlanDates, now = new Date()) => {
  const archived = isPlanArchived(plan);
  const expired = isPlanExpired(plan, now);
  if (archived && expired) return "This plan is archived and expired";
  return archived ? "This plan is archived" : "This plan has expired";
};

// Mirrors the backend ladder: fresh <3d (agent owns weeks), stale 3-7d or
// never (nudge to sync), dark >=7d (coach has resumed planning).
export function agentSyncTier(
  lastSyncAt?: DateValue | null,
  now = new Date(),
): AgentSyncTier {
  if (!lastSyncAt) return "stale";
  const days = differenceInCalendarDays(now, new Date(lastSyncAt));
  return days < 3 ? "fresh" : days >= 7 ? "dark" : "stale";
}

export function agentSyncLabel(lastSyncAt?: DateValue | null, now = new Date()) {
  if (agentSyncTier(lastSyncAt, now) === "dark")
    return "Teacher quiet · coach took over";
  return lastSyncAt
    ? `Teacher · synced ${formatDistanceToNowStrict(new Date(lastSyncAt), { addSuffix: true })}`
    : "Teacher · never synced";
}
