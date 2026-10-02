export interface MetricLoggerProps {
  onClose: () => void;
  title?: string;
}

export interface MetricVisualProps {
  metric: import("@/core/types").Metric;
  entries: import("@/core/types").MetricEntry[];
}

export interface MetricContextEvent {
  id: string;
  title: string;
  description?: string | null;
  occurredAt: import("@/core/types").DateValue | null;
  endedAt: import("@/core/types").DateValue | null;
}

export interface MetricEventImpact {
  event: MetricContextEvent;
  duringAverage: number;
  baselineAverage: number;
  delta: number;
  duringEntryCount: number;
  baselineEntryCount: number;
  startedAt: Date;
  endedAt: Date;
}

export interface MetricHeatmapProps extends MetricVisualProps {
  eventImpacts?: MetricEventImpact[];
}

export interface ActivityFinding {
  activity: import("@/core/types").Activity;
  // Average rating on days with the activity, and on all other rated days.
  average: number;
  otherAverage: number | null;
  // Share by which the two averages differ, e.g. -0.21 for 21% lower. Null
  // while either kind of day has fewer than five ratings.
  difference: number | null;
  days: number;
  otherDays: number;
}

// One line of the insights card, whether it came from an activity or sleep.
export interface FindingRowProps {
  testID: string;
  label: string;
  difference: number | null;
  // Zero to three bars.
  signal: number;
  // Shown in place of the number while there is too little to go on.
  waiting: string;
  onPress: () => void;
}

// What the detail sheet is showing.
export type FindingDetail =
  | { kind: "activity"; finding: ActivityFinding }
  | { kind: "sleep" }
  | { kind: "help" };

export interface MetricInsightsProps {
  metric: import("@/core/types").Metric;
  // Rated check-ins for this metric. Under seven, the card only counts up.
  checkIns: number;
  findings: ActivityFinding[];
  // Present from the first synced night that pairs with a check-in, even while
  // every night is still learning.
  sleep?: import("./model").SleepFinding | null;
}

export interface SleepDetailProps {
  sleep: import("./model").SleepFinding;
  metric: import("@/core/types").Metric;
}
