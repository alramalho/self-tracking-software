import type { Plan, ActivityEntry } from "@/core/types";
import type {
  FollowThroughState,
  PracticeSession,
} from "@tsw/prisma/follow-through";
export interface WeekOverviewProps {
  plans: Plan[];
  entries: ActivityEntry[];
}
export interface CalendarConnectionProps {
  asMenu?: boolean;
}
export interface SessionRowProps {
  grouped?: boolean;
  session: PracticeSession;
  plan: Plan;
}
export interface SupportEditorProps {
  toolsOnly?: boolean;
  plan: Plan;
}
export interface FollowThroughHomeProps extends WeekOverviewProps {}
export interface SessionViewData {
  state?: FollowThroughState;
  plans: Plan[];
  now?: Date;
}
