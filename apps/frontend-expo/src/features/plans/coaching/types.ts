import type {
  PlanCoaching,
  SupportPreferences,
} from "@tsw/prisma/follow-through";
import type { LucideIcon } from "lucide-react-native";
import type { Plan } from "@/core/types";
import type { GroupedRow } from "@/components/types";

export interface CoachingFieldsProps {
  value: PlanCoaching;
  preferences: SupportPreferences;
  onChange: (value: PlanCoaching) => void;
  onPreferences: (value: SupportPreferences) => void;
  canCoach: boolean;
}
export interface PlanCoachingProps {
  plan: Plan;
  showPlanTitle?: boolean;
  inlineEditor?: boolean;
  onEditingChange?: (editing: boolean) => void;
  /** Rows shown above the Coaching row in the same card, e.g. the coach's open request. */
  leadingRows?: GroupedRow[];
}
export interface CoachingChoiceProps {
  label: string;
  icon?: LucideIcon;
  detail?: string;
  selected: boolean;
  card?: boolean;
  disabled?: boolean;
  onPress: () => void;
}
