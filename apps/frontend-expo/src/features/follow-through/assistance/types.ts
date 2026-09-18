import type { PlanSupport } from "@tsw/prisma/follow-through";
import type { Plan } from "@/core/types";
export type Control =
  | "schedule"
  | "reminders"
  | "review"
  | "tools"
  | "check-in";
export type Step = "choice" | "days" | "optional-time" | "time";
export interface AssistanceSheetProps {
  control: Control;
  plan: Plan;
  support: PlanSupport;
  canCoach: boolean;
  onClose: () => void;
  onSaved: () => void;
}
export interface ChoiceProps {
  icon: string;
  title: string;
  detail?: string;
  selected?: boolean;
  disabled?: boolean;
  onPress: () => void;
}
export interface TimeInputProps {
  value: string;
  onChange: (value: string) => void;
}
export interface DaysInputProps {
  value: number[];
  onChange: (days: number[]) => void;
  single?: boolean;
  maximum?: number;
}

export interface AssistanceRow {
  id: Control;
  icon: string;
  title: string;
  value: string;
}
