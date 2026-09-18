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

export interface MetricCorrelation {
  activity: import("@/core/types").Activity;
  correlation: number;
  sampleSize: number;
  // Sleep is surfaced through the same row as an activity, but its copy and
  // reliability wording differ because nights are synced rather than logged.
  kind?: "activity" | "sleep";
}
export interface MetricInsightsProps {
  metric: import("@/core/types").Metric;
  correlations: MetricCorrelation[];
  // Present from the first synced night that pairs with a check-in, even while
  // every night is still learning.
  sleep?: import("./model").SleepCorrelation | null;
  onHelp: () => void;
}
export interface CorrelationRowProps {
  row: MetricCorrelation;
  onReliability: () => void;
}

export interface SleepRowProps {
  sleep: import("./model").SleepCorrelation;
  metric: import("@/core/types").Metric;
  onReliability: () => void;
}

export interface ReliabilitySample {
  count: number;
  kind: "activity" | "sleep";
}
