import { z } from "zod/v4";
import { dateKey, time } from "../../schema";
export const stageSchema = z.enum([
  "goal",
  "baseline",
  "rhythm",
  "support",
  "review",
]);
export const questionSchema = z.object({
  title: z.string().min(1).max(180),
  purpose: z.string().max(250),
  options: z.array(z.string().max(180)).max(4),
});
export const factsSchema = z.object({
  goal: z.string().max(300),
  goalReason: z.string().max(600),
  baseline: z.string().max(1000),
  emoji: z.string().max(24),
  activityTitle: z.string().max(100),
  measure: z.string().max(32),
  frequency: z.number().int().min(1).max(7),
  commitment: z.enum(["WEEKLY", "DAYS", "TIMED"]),
  weekdays: z.array(z.number().int().min(0).max(6)).max(7),
  time: time.nullable(),
  targetDate: dateKey.nullable(),
  resourceName: z.string().max(100),
  resourceUrl: z.string().max(2048),
  nextStep: z.string().max(600),
  recommendation: z.enum(["coaching", "tracking"]),
  recommendationReason: z.string().max(500),
  wantsCoaching: z.boolean(),
});
export const turnSchema = z.object({
  stage: stageSchema,
  question: z.string().max(400),
  answer: z.string().max(1500),
  feedback: z.string().max(600),
  accepted: z.boolean(),
});
export const resultSchema = z.object({
  accepted: z.boolean(),
  summary: z.string().min(1).max(600),
  checks: z
    .array(
      z.object({
        label: z.string().max(70),
        passed: z.boolean(),
        detail: z.string().max(220),
      }),
    )
    .min(1)
    .max(3),
  question: questionSchema,
  nextQuestion: questionSchema,
  facts: factsSchema,
});

export const interviewStateSchema = z.object({
  pending: resultSchema.optional(),
  version: z.literal(1),
  stage: stageSchema,
  question: questionSchema,
  turns: z.array(turnSchema).max(60),
  facts: factsSchema,
  confirmed: z.array(stageSchema).max(5),
});
export const interviewRequestSchema = z.object({
  state: interviewStateSchema,
  answer: z.string().trim().min(1).max(1500),
  timezone: z.string().max(100),
});
