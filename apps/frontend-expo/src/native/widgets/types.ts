import type { ActivityEntry, Metric, MetricEntry, Plan } from "@/core/types";
import type { FollowThroughSnapshot } from "@tsw/prisma/follow-through";

export interface WidgetPlan {
  id: string;
  title: string;
  emoji: string;
  completed: number;
  target: number;
  streak: number;
  stage: string;
  stageTarget: number;
  paused: boolean;
  ended: boolean;
}
export interface WidgetSession {
  id: string;
  planId: string;
  title: string;
  emoji: string;
  date: string;
  time: string | null;
  timezone: string;
  durationMinutes: number;
}
export interface WidgetMetric {
  id: string;
  title: string;
  emoji: string;
  loggedDays: string[];
}
export interface WidgetSnapshot {
  version: 1;
  updatedAt: string;
  weekStart: string;
  plans: WidgetPlan[];
  sessions: WidgetSession[];
  metrics: WidgetMetric[];
}
export interface WidgetData {
  plans: Plan[];
  entries: ActivityEntry[];
  metrics: Metric[];
  metricEntries: MetricEntry[];
  followThrough?: FollowThroughSnapshot;
}
export interface WidgetBridge {
  setAccount(account: string | null): Promise<void>;
  setSnapshot(account: string, snapshot: string): Promise<void>;
}
