import type {
  PlanWeekFlexibleCell,
  PlanWeekScheduledSession,
} from "@tsw/prisma/plan-week";
import type { ActivityEntry, Milestone, Plan } from "@/core/types";
import type { LucideIcon } from "lucide-react-native";
export interface PlanEditorProps {
  plan?: Plan;
}
export type PlanEditorSection =
  | "overview"
  | "goal"
  | "emoji"
  | "frequency"
  | "structure"
  | "visibility"
  | "duration"
  | "activities"
  | "milestones"
  | "background";
export interface PlanEditorOverviewItem {
  label: string;
  value: string;
  icon: LucideIcon;
  onPress: () => void;
}
export interface PlanEditorOverviewProps {
  emoji: string;
  items: PlanEditorOverviewItem[];
  canSave: boolean;
  saving: boolean;
  onSave: () => void;
}
export interface PlanEditorChoiceProps {
  label: string;
  description?: string;
  icon?: LucideIcon;
  selected: boolean;
  onPress: () => void;
}
export interface MilestoneOverviewProps {
  milestones: Milestone[];
  own: boolean;
  onEdit: () => void;
}
export interface MilestoneChange {
  id: string;
  delta: number;
}
export interface DraftMilestone extends Omit<Milestone, "date"> {
  date: string;
}
export interface MilestoneFieldsProps {
  milestones: DraftMilestone[];
  onChange: (milestones: DraftMilestone[]) => void;
}
export interface PlanTileProps {
  plan: Plan;
  index: number;
  count: number;
  columns: number;
  size: number;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
  onMove: (targetIndex: number) => void;
}
export interface PlanOrderChange {
  id: string;
  targetIndex: number;
}
export interface CoachOverviewProps {
  plans: Plan[];
  entries: ActivityEntry[];
}
export type WeekCalendarSelection =
  | { kind: "scheduled"; session: PlanWeekScheduledSession }
  | {
      kind: "flexible";
      cell: PlanWeekFlexibleCell;
      planTitle: string;
    };
export type WeekCalendarSelectionDisplay = "sheet" | "card";
export interface WeekCalendarProps {
  plans: Plan[];
  entries: ActivityEntry[];
  onLog?: (activityId: string, date: Date) => void;
  rolling?: boolean;
  weekCount?: 1 | 2;
  selectionDisplay?: WeekCalendarSelectionDisplay;
}
export interface WeekProgressProps {
  plan: Plan;
  entries: import("@/core/types").ActivityEntry[];
  date?: Date;
  own?: boolean;
}
export interface PlanBackgroundProps {
  value: string | null;
  onChange: (value: string | null) => void;
  onBusyChange: (busy: boolean) => void;
}

export interface PlanProgressStripProps {
  plan: Plan;
}
export interface SteppedProgressProps {
  value: number;
  max: number;
  color: string;
  icon: import("lucide-react-native").LucideIcon;
  label: string;
}

export interface AchievementGlowProps {
  color: string;
}
