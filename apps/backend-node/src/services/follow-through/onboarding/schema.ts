import { interviewStateSchema } from "./interview/schema";
import { planCoachingSchema } from "../../coach/monitoring/schema";
import { z } from "zod/v4";
import { dateKey, time, timezone, preferencesSchema } from "../schema";
export const draftSchema = z.object({
  coaching: planCoachingSchema.optional(),
  interview: interviewStateSchema.optional(),
  awaitingUpgrade: z.boolean().optional(),
  id: z.string().uuid(),
  // Goals may come from dictation and can include context. Keep the same
  // bounded input size as interview answers rather than truncating a natural
  // spoken response at the old 300-character limit.
  goal: z.string().trim().max(1500),
  emoji: z.string().max(24),
  activityId: z.string().nullable(),
  activityTitle: z.string().trim().max(100),
  measure: z.string().trim().max(32),
  commitment: z.enum(["WEEKLY", "DAYS", "TIMED"]),
  frequency: z.number().int().min(1).max(7),
  weekdays: z
    .array(z.number().int().min(0).max(6))
    .max(7)
    .transform((d) => [...new Set(d)].sort()),
  time: time.nullable(),
  durationMinutes: z.number().int().min(1).max(1440),
  timezone,
  targetDate: dateKey.nullable(),
  resourceName: z.string().max(100),
  resourceUrl: z
    .string()
    .max(2048)
    .refine(
      (v) => !v || (/^https:\/\//i.test(v) && URL.canParse(v)),
      "Use an https link",
    ),
  nextStep: z.string().max(600),
  format: z.enum(["LOG", "TIMER", "RESOURCE"]),
  wantsCoaching: z.boolean(),
  answers: z
    .array(
      z.object({
        question: z.string().max(400),
        answer: z.string().max(1500),
        use: z.string().max(400),
      }),
    )
    .max(60),
  step: z.string().max(40),
  createdPlanId: z.string().nullable(),
  preferences: preferencesSchema.optional(),
});
export const nextSchema = z.object({
  ready: z.boolean(),
  question: z
    .object({
      icon: z.string().max(16),
      title: z.string().min(1).max(180),
      purpose: z.string().min(1).max(200),
      type: z.enum(["text", "choice"]),
      options: z.array(z.string().max(140)).max(4),
    })
    .nullable(),
  nextStep: z.string().max(400),
  explanation: z.string().max(500),
  suggestedFormat: z.enum(["LOG", "TIMER", "RESOURCE"]),
});
