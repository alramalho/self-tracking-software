import { z } from "zod/v4";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^\d{2}:\d{2}$/;

export const voiceLogActivitySchema = z.object({
  activityId: z.string().min(1),
  quantity: z.number().int().positive().max(100_000),
  date: z.string().regex(datePattern),
  time: z.string().regex(timePattern).nullable().optional(),
  description: z.string().trim().max(500).nullable().optional(),
  privateNotes: z.string().trim().max(1_000).nullable().optional(),
  difficulty: z
    .enum(["very_easy", "easy", "moderate", "hard", "very_hard"])
    .nullable()
    .optional(),
  confidence: z.number().min(0).max(1),
});

export const voiceLogMetricSchema = z.object({
  metricId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  date: z.string().regex(datePattern),
  description: z.string().trim().max(500).nullable().optional(),
  confidence: z.number().min(0).max(1),
});

export const voiceLogNoteSchema = z.object({
  title: z.string().trim().min(1).max(120),
  text: z.string().trim().min(1).max(2_000),
  date: z.string().regex(datePattern),
  confidence: z.number().min(0).max(1),
});

export const voiceLogUnresolvedSchema = z.object({
  text: z.string().trim().min(1).max(300),
  reason: z.string().trim().min(1).max(300),
});

export const voiceLogExtractionSchema = z.object({
  activities: z.array(voiceLogActivitySchema).max(10),
  metrics: z.array(voiceLogMetricSchema).max(10),
  note: voiceLogNoteSchema.nullable(),
  unresolved: z.array(voiceLogUnresolvedSchema).max(10),
});

export const voiceLogCommitSchema = z.object({
  clientRequestId: z.string().uuid(),
  transcript: z.string().trim().min(1).max(4_000),
  timezone: z.string().trim().min(1).max(100),
  activities: z.array(voiceLogActivitySchema.omit({ confidence: true })).max(10),
  metrics: z.array(voiceLogMetricSchema.omit({ confidence: true })).max(10),
  note: voiceLogNoteSchema,
});

export const voiceLogRefinementContextSchema = z.object({
  originalTranscript: z.string().trim().min(1).max(4_000),
  currentDraft: voiceLogExtractionSchema,
});

export type VoiceLogActivity = z.infer<typeof voiceLogActivitySchema>;
export type VoiceLogMetric = z.infer<typeof voiceLogMetricSchema>;
export type VoiceLogNote = z.infer<typeof voiceLogNoteSchema>;
export type VoiceLogExtraction = z.infer<typeof voiceLogExtractionSchema>;
export type VoiceLogCommit = z.infer<typeof voiceLogCommitSchema>;
export type VoiceLogRefinementContext = z.infer<typeof voiceLogRefinementContextSchema>;

export type VoiceLogActivityPreview = VoiceLogActivity & {
  title: string;
  emoji: string;
  measure: string;
};

export type VoiceLogMetricPreview = VoiceLogMetric & {
  title: string;
  emoji: string;
};

export type VoiceLogPreview = {
  clientRequestId: string;
  transcript: string;
  activities: VoiceLogActivityPreview[];
  metrics: VoiceLogMetricPreview[];
  note: VoiceLogNote;
  unresolved: z.infer<typeof voiceLogUnresolvedSchema>[];
};
