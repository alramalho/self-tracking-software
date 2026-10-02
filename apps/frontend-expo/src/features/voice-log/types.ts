import type { ReactNode } from "react";

export interface VoiceLogActivity {
  activityId: string;
  title: string;
  emoji: string;
  measure: string;
  quantity: number;
  date: string;
  time?: string | null;
  description?: string | null;
  privateNotes?: string | null;
  difficulty?: string | null;
  confidence: number;
}

export interface VoiceLogMetric {
  metricId: string;
  title: string;
  emoji: string;
  rating: number;
  date: string;
  description?: string | null;
  confidence: number;
}

export interface VoiceLogNote {
  title: string;
  text: string;
  date: string;
  confidence: number;
}

export interface VoiceLogUnresolved {
  text: string;
  reason: string;
}

export interface VoiceLogPlanMatch {
  planId: string;
  planGoal: string;
  planEmoji?: string | null;
  activityId: string;
  activityTitle: string;
  contextText: string;
  confidence: number;
}

export interface VoiceLogAlreadyLogged extends VoiceLogActivity {
  existingQuantity: number;
  existingEntryId?: string;
}

export interface VoiceLogPlanSuggestion {
  activityId?: string | null;
  activityTitle: string;
  emoji?: string | null;
  text: string;
  frequencyPerWeek?: number | null;
  durationWeeks?: number | null;
}

export interface VoiceLogPreview {
  clientRequestId: string;
  transcript: string;
  activities: VoiceLogActivity[];
  metrics: VoiceLogMetric[];
  note: VoiceLogNote;
  unresolved: VoiceLogUnresolved[];
  planMatches: VoiceLogPlanMatch[];
  alreadyLogged?: VoiceLogAlreadyLogged[];
  planSuggestions?: VoiceLogPlanSuggestion[];
}

export interface VoiceLogDraft {
  preview: VoiceLogPreview;
  selectedActivityKeys: string[];
  selectedMetricKeys: string[];
  selectedPlanId?: string | null;
  savedAt: string;
}

export function voiceLogActivityKey(activity: VoiceLogActivity) {
  return `${activity.activityId}-${activity.date}-${activity.time ?? "day"}`;
}

export function voiceLogMetricKey(metric: VoiceLogMetric) {
  return `${metric.metricId}-${metric.date}`;
}

export interface VoiceLogRefinementContext {
  originalTranscript: string;
  currentDraft: VoiceLogPreview;
}

export interface PreviewVoiceLogOptions {
  timezone: string;
  clientRequestId: string;
  refinementContext?: VoiceLogRefinementContext;
}

export interface VoiceLogCommitActivity {
  activityId: string;
  quantity: number;
  date: string;
  time?: string | null;
  description?: string | null;
  privateNotes?: string | null;
  difficulty?: string | null;
}

export interface VoiceLogCommitMetric {
  metricId: string;
  rating: number;
  date: string;
  description?: string | null;
}

export interface VoiceLogCommitRequest {
  clientRequestId: string;
  transcript: string;
  timezone: string;
  activities: VoiceLogCommitActivity[];
  metrics: VoiceLogCommitMetric[];
  note: VoiceLogNote;
  planContextPlanId?: string | null;
  planContextActivityId?: string | null;
  planContextText?: string | null;
}

export interface VoiceLogCommitResponse {
  success: boolean;
  duplicate: boolean;
  activityEntryIds: string[];
  metricEntryIds: string[];
  noteId: string;
}

export type VoiceLogRecordingKind = "initial" | "refinement";
export type VoiceLogPhase =
  | "ready"
  | "recording"
  | "processing"
  | "committing"
  | "review"
  | "committed";

export interface VoiceLogDrawerProps {
  onClose: () => void;
  initialDraft?: VoiceLogDraft | null;
  onPendingChange?: (draft: VoiceLogDraft | null) => void;
}

export interface VoiceLogSelectionGroupProps {
  children: ReactNode;
}

export interface VoiceLogRecorderOptions {
  onRecordingReady: (uri: string) => void;
  onError: (error: unknown) => void;
}
