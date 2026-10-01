import { z } from "zod/v4";
import { goalSpecSchema, optionSchema } from "./schema";

const measurement = z.object({
  metric: z.string().max(40),
  value: z.number(),
  unit: z.string().max(24),
  sourceQuote: z.string().max(160),
});

/** The design a person reviewed in onboarding, sent back with the draft and stored on the plan. */
export const planDesignDraftSchema = z.object({
  orientation: z.enum(["OUTCOME", "CONSISTENCY"]),
  goalSpec: goalSpecSchema,
  baseline: z.object({ text: z.string().max(1000), measurements: z.array(measurement).max(8) }),
  activities: z
    .array(z.object({ key: z.string().max(40), title: z.string().max(40), measure: z.string().max(24), emoji: z.string().max(8) }))
    .min(1)
    .max(1),
  preferredDays: z.number().int().min(1).max(7),
  coachNote: z
    .object({
      verdict: z.enum(["FITS", "ADJUSTED", "PUSHBACK"]),
      message: z.string().max(360).nullable(),
      suggestedDays: z.number().int().min(1).max(7).nullable(),
      targetInvolved: z.boolean(),
    })
    .nullable(),
  fixedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  asked: z.array(z.object({ question: z.string().max(200), answer: z.string().max(300) })).max(4),
  options: z
    .array(
      optionSchema.omit({ id: true, sessions: true }).extend({
        id: z.enum(["steady", "focused"]),
        coach: z.enum(["Helly", "Oli"]),
        daysMin: z.number().int().min(1).max(7),
        daysMax: z.number().int().min(1).max(7),
        finishingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        sessions: optionSchema.shape.sessions,
      }),
    )
    .max(2),
  selected: z.enum(["steady", "focused"]).nullable(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
