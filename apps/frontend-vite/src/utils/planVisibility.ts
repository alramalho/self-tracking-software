import type { CompletePlan } from "@/contexts/plans";
import { isBefore } from "date-fns";

export type PlanVisibilityFields = Pick<
  CompletePlan,
  "archivedAt" | "deletedAt" | "finishingDate"
>;

export function isPlanExpired(
  plan: Pick<PlanVisibilityFields, "finishingDate">,
  now: Date = new Date()
): boolean {
  if (!plan.finishingDate) return false;
  return isBefore(new Date(plan.finishingDate), now);
}

export function isPlanArchived(
  plan: Pick<PlanVisibilityFields, "archivedAt">
): boolean {
  return !!plan.archivedAt;
}

export function isActivePlanForSelection(
  plan: PlanVisibilityFields
): boolean {
  return isActivePlanForSelectionAt(plan, new Date());
}

export function isActivePlanForSelectionAt(
  plan: PlanVisibilityFields,
  now: Date
): boolean {
  return !plan.deletedAt && !isPlanArchived(plan) && !isPlanExpired(plan, now);
}
