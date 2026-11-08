import type { ActivityEntry, Metric, MetricEntry, Plan, User } from "@/core/types";
export interface HomeTodoProps {
  plans: Plan[];
  entries: ActivityEntry[];
  metrics: Metric[];
  metricEntries: MetricEntry[];
  user?: User;
  onCheckin: () => void;
}
export interface CoachNoteProps {
  user?: User;
}
