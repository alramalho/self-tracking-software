import type { ActivityEntry, Metric, MetricEntry, Plan } from "@/core/types";
import type { LucideIcon } from "lucide-react-native";
export interface PlanPreviewProps {
  plan: Plan;
  entries: ActivityEntry[];
}
export interface MetricPreviewProps {
  metrics: Metric[];
  entries: MetricEntry[];
  onLog: () => void;
}
export interface StepsProps {
  value: number;
  max: number;
  color: string;
  iconColor?: string;
  icon: LucideIcon;
  label: string;
  /** The leftover dots turn dashed amber: the week only fits if nearly every remaining day is used. */
  atRisk?: boolean;
}
export interface UpcomingSessionsProps {
  plans: Plan[];
  entries: ActivityEntry[];
}
export interface WarningSheetProps {
  visible: boolean;
  plan: Plan;
  entries: ActivityEntry[];
  slipping: boolean;
  nudge?: { chatId?: string; messageId?: string };
  needed: number;
  daysLeft: number;
  onOpenPlan: () => void;
  onClose: () => void;
}
