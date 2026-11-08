export type HomeCoachPreview = {
  id: string;
  content: string;
  createdAt: Date | string;
  isUnread: boolean;
};

export type HomeCoachNoteInput = {
  preview?: HomeCoachPreview | null;
  planType?: string | null;
  proactiveCoachingEnabled?: boolean | null;
  now: Date;
};

export type HomeCoachNote = {
  id: string;
  text: string;
  createdAt: Date;
};

export type HomeTodoPlan = {
  id: string;
  goal: string;
  emoji?: string | null;
  outlineType?: string | null;
  finishingDate?: Date | string | null;
  deletedAt?: Date | string | null;
  archivedAt?: Date | string | null;
  sessions?: { date: Date | string }[] | null;
};

export type PlanDecisionReason = "ended" | "unscheduled";

export type PlanNeedingDecision = {
  planId: string;
  goal: string;
  emoji?: string | null;
  reason: PlanDecisionReason;
};

export type HomeTodoMetric = { id: string };

export type HomeTodoMetricEntry = {
  metricId: string;
  createdAt: Date | string;
  rating: number;
  skipped?: boolean | null;
};
