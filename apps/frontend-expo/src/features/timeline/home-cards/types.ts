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
export interface MissReason {
  label: string;
  /** The reason in the user's own words, as sent to the coach. */
  says: string;
}
/** How the coach chat opens from the sheet: a prefilled message, optionally sent straight away. */
