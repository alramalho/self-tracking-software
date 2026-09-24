import type {
  PlanSupport,
  CoachMonitoringState,
  PracticeSession,
} from "@tsw/prisma/follow-through";
import type { CoachDraftMessage, CoachHealthAccess } from "../types";

export interface MonitoringPlan {
  id: string;
  goal: string;
  isPaused: boolean;
  archivedAt: Date | null;
  deletedAt: Date | null;
  finishingDate: Date | null;
  activityIds: string[];
}
export interface MonitoringEntry {
  id: string;
  activityId: string | null;
  datetime: Date;
  updatedAt: Date;
  difficulty: string | null;
  privateNotes: string | null;
  source: string;
}
export interface MonitoringMessage {
  id: string;
  role: string;
  planId: string | null;
  createdAt: Date;
  metadata: unknown;
}
export interface MonitoringMessageMetadata {
  coachRequestId?: string;
  requiresReply?: boolean;
  planProposals?: { planId?: string; status?: string | null; patch?: { sessions?: { upsert?: unknown[] } } }[];
}
export interface MonitoringInput {
  now: Date;
  entitled: boolean;
  plans: MonitoringPlan[];
  supports: Record<string, PlanSupport>;
  entries: MonitoringEntry[];
  messages: MonitoringMessage[];
  sessions: PracticeSession[];
  legacyLastOutreachAt?: string;
  state: CoachMonitoringState;
}
export interface MonitoringDecision {
  id: string;
  kind: "setup" | "review" | "difficulty" | "session" | "lapse" | "reminder";
  planIds: string[];
  dueKey?: string;
  entryId?: string;
  requestId?: string;
  sessionId?: string;
}
export interface MonitoringGenerated {
  draftMessages: CoachDraftMessage[];
  healthDataAccess?: CoachHealthAccess[];
  skipped?: boolean;
  usage?: { model: string; inputTokens: number; outputTokens: number; costUsd?: number };
}
export interface MonitoringRunPorts {
  claim(): Promise<MonitoringDecision | null>;
  generate(decision: MonitoringDecision): Promise<MonitoringGenerated>;
  commit(
    decision: MonitoringDecision,
    result: MonitoringGenerated,
  ): Promise<boolean>;
  release(decision: MonitoringDecision): Promise<void>;
}
