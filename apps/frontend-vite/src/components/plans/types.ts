import type { CompletePlan } from "@/contexts/plans";

export type PlanDrawerView = "settings" | "pause" | "delete";
export type PlanOperation = "pause" | "resume" | "archive" | "unarchive" | "delete";
export interface PlanDrawerProps {
  plan: CompletePlan;
  open: boolean;
  onClose: () => void;
}

export interface PlanRendererv2Props {
  selectedPlan: CompletePlan;
  scrollTo?: string;
}
export interface PlanProgressStripProps {
  plan: CompletePlan;
}
