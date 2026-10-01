import type { ActivityEntry, Metric, MetricEntry, MissedWeek, Plan } from "@/core/types";
import type { LucideIcon } from "lucide-react-native";
import type { MyCircle } from "@/features/circles/types";
export interface PlanPreviewProps {
  plan: Plan;
  entries: ActivityEntry[];
}
export interface CirclePreviewProps {
  circle: MyCircle;
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
  /** Last week was missed: the dot it cost shows as a red cross with "−1". */
  lost?: boolean;
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
  atRisk: boolean;
  nudge?: { chatId?: string; messageId?: string };
  needed: number;
  daysLeft: number;
  missed?: MissedWeek | null;
  /** Sessions done vs planned last week, shown when it was missed. */
  lastWeek: { done: number; target: number } | null;
  onOpenPlan: () => void;
  onClose: () => void;
}
export interface MissReason {
  label: string;
  /** The reason in the user's own words, as sent to the coach. */
  says: string;
}
/** How the coach chat opens from the sheet: a prefilled message, optionally sent straight away. */
export interface CoachOpening {
  prompt?: string;
  send?: boolean;
}
export interface ReasonChipProps {
  label: string;
  disabled: boolean;
  onPress: () => void;
}
