import type { ActivityEntry, MissedWeek, Plan } from "@/core/types";
import type { LucideIcon } from "lucide-react-native";
import type { MyCircle } from "@/features/circles/types";
export interface PlanPreviewProps {
  plan: Plan;
  entries: ActivityEntry[];
  /** The circle this plan is shared in, shown as faces on the card instead of a card of its own. */
  circle?: MyCircle;
}
export interface CirclePreviewProps {
  circle: MyCircle;
}
export interface PlanCircleFacesProps {
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
  id: import("@tsw/prisma/follow-through").MissReasonId;
  label: string;
  emoji: string;
  /** Sessions to suggest this week, from the weekly target and the days left. */
  suggest: (target: number, daysLeft: number) => number;
}
/** How the coach chat opens from the sheet: a prefilled message, optionally sent straight away. */
