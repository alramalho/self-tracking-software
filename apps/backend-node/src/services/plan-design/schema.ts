import { z } from "zod/v4";

// Structured outputs need every field present, so "absent" is always an explicit null.
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const goalSpecSchema = z.object({
  metric: z.string().max(40).nullable(),
  value: z.number().nullable(),
  unit: z.string().max(24).nullable(),
  text: z.string().max(120).nullable(),
  chosenByUser: z.boolean(),
});

const activitySchema = z.object({
  title: z.string().min(1).max(40),
  measure: z.string().min(1).max(24),
  emoji: z.string().min(1).max(8),
});

export const classifySchema = z.object({
  orientation: z.enum(["OUTCOME", "CONSISTENCY"]),
  reason: z.string().max(200),
  activity: activitySchema,
  goalSpec: goalSpecSchema,
  baselineQuestion: z.string().min(1).max(90),
});

export const subgoalSchema = z.object({
  ask: z.boolean(),
  kind: z.string().max(40).nullable(),
  title: z.string().max(110).nullable(),
  choices: z.array(z.string().min(1).max(40)).max(4),
});

const paceSchema = z.object({
  minSecondsPerKm: z.number().min(150).max(1200).nullable(),
  maxSecondsPerKm: z.number().min(150).max(1200).nullable(),
  basis: z.enum(["USER_REPORTED_EASY_PACE", "PERFORMANCE_ESTIMATE", "UNKNOWN"]),
  evidence: z.string().max(200).nullable(),
});

export const targetsSchema = z.object({
  durationMinutes: z.number().int().min(5).max(240),
  effort: z.string().min(1).max(60),
  pace: paceSchema.nullable(),
  exercise: z.string().max(60).nullable(),
  sets: z.number().int().min(1).max(12).nullable(),
  reps: z.number().int().min(1).max(50).nullable(),
  loadKg: z.number().min(0).max(500).nullable(),
  restSeconds: z.number().int().min(0).max(600).nullable(),
  progressMeasure: z.string().min(8).max(160),
});

export const sessionSchema = z.object({
  date: day,
  activity: z.string().min(1).max(40),
  quantity: z.number().int().min(1).max(10000),
  title: z.string().min(1).max(50),
  descriptiveGuide: z.string().min(25).max(700),
  targets: targetsSchema,
});

export const phaseSchema = z.object({
  title: z.string().min(1).max(40),
  startWeek: z.number().int().min(1).max(104),
  endWeek: z.number().int().min(1).max(104),
  progressCheck: z.string().min(8).max(160),
});

export const optionSchema = z.object({
  id: z.enum(["steady", "focused"]),
  estimatedWeeks: z.number().int().min(2).max(104),
  rationale: z.string().min(10).max(260),
  assumptions: z.array(z.string().max(160)).max(4),
  phases: z.array(phaseSchema).min(2).max(6),
  sessions: z.array(sessionSchema).max(28),
});

/** One route per call, so the two routes are built in parallel instead of one long answer. */
export const routeSchema = z.object({
  status: z.enum(["READY", "ASK"]),
  /** Only when a missing fact makes an honest route impossible. */
  question: z.string().max(160).nullable(),
  baselineMeasurements: z
    .array(
      z.object({
        metric: z.string().max(40),
        value: z.number(),
        unit: z.string().max(24),
        sourceQuote: z.string().max(160),
      }),
    )
    .max(8),
  route: optionSchema.nullable(),
});

export const windowSchema = z.object({
  summary: z.string().min(10).max(300),
  phases: z.array(phaseSchema).min(2).max(6),
  sessions: z.array(sessionSchema).max(28),
});

export type RouteOutput = z.infer<typeof routeSchema>;
export type WindowOutput = z.infer<typeof windowSchema>;

/** The coach's read of the preferred days against the goal and starting point, before any route is built. */
export const assessSchema = z.object({
  verdict: z.enum(["FITS", "ADJUSTED", "PUSHBACK"]),
  /** In the coach's voice, one or two short sentences. Required unless FITS. */
  message: z.string().max(360).nullable(),
  steady: z.object({ daysMin: z.number().int().min(1).max(7), daysMax: z.number().int().min(1).max(7), weeks: z.number().int().min(2).max(104) }),
  focused: z.object({ daysMin: z.number().int().min(1).max(7), daysMax: z.number().int().min(1).max(7), weeks: z.number().int().min(2).max(104) }),
  /** PUSHBACK only: the fewest days a first honest plan needs. */
  suggestedDays: z.number().int().min(1).max(7).nullable(),
  /** PUSHBACK only: true when the person's own target (finish time, load) is part of the problem. */
  targetInvolved: z.boolean(),
});
