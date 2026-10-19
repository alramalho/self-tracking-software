import { z } from "zod/v4";
import { targetsSchema } from "../../../plan-design/schema";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const newSessionSchema = z.object({
  activityId: z.string().min(1),
  date,
  quantity: z.number().int().positive(),
  descriptiveGuide: z.string().min(1).max(3000),
  title: z.string().max(50).nullable().describe("Short session name, e.g. Easy run. Null if not needed."),
  targets: targetsSchema
    .nullable()
    .describe("Measurable prescription (duration, effort, pace range or sets/reps/load, what to log). Null only for a plain habit."),
});

export const setupOutputSchema = z.object({
  message: z.string().min(1).max(600),
  requiresReply: z.boolean(),
  sessions: z.array(newSessionSchema).max(7),
  alsoTrack: z
    .array(
      z.object({
        title: z.string().min(1).max(60),
        measure: z.string().min(1).max(24).describe("A short unit, e.g. kg, cm, kcal"),
        emoji: z.string().min(1).max(8).describe("A single emoji character, e.g. ⚖️"),
      }),
    )
    .max(2)
    .describe(
      "Measurements you need to judge progress that the plan's activities don't capture, e.g. Weight in kg for a body-weight goal. Empty when the activities already show progress.",
    ),
});

// A text from a person, not a report: one line that asks whether they're around.
export const OPENER_MAX = 180;
const opener = z
  .string()
  .min(1)
  .max(OPENER_MAX)
  .describe(
    "One short line (max ~15 words) that opens a conversation and ends with a question. No stats, no plan list, no advice.",
  );

export const followUpOutputSchema = z.object({
  opener: opener.nullable(),
  agenda: z
    .string()
    .min(1)
    .max(2000)
    .nullable()
    .describe(
      "Private notes for yourself, never shown as-is: what happened per plan, what you suspect, what you want to ask, and what you'd change. You'll share it one step at a time once they reply.",
    ),
  modifications: z
    .array(
      z.object({
        planId: z.string().min(1),
        description: z.string().min(1).max(250),
        timesPerWeek: z
          .number()
          .int()
          .min(1)
          .max(7)
          .nullable()
          .describe(
            "A new ongoing weekly target explicitly requested by the person. Null for a temporary week adjustment.",
          ),
        newSessions: z.array(newSessionSchema).max(14),
        revisedSessions: z
          .array(
            z.object({
              id: z.string().min(1),
              activityId: z.string().min(1),
              date,
              quantity: z.number().int().positive(),
              descriptiveGuide: z.string().min(1).max(3000),
              title: z.string().max(50).nullable(),
              targets: targetsSchema.nullable(),
            }),
          )
          .max(14),
        removeSessionIds: z.array(z.string().min(1)).max(14),
      }),
    )
    .max(8),
  archives: z
    .array(
      z.object({
        planId: z.string().min(1),
        description: z.string().min(1).max(250),
      }),
    )
    .max(8),
});

export const lapseOutputSchema = z.object({
  message: z.string().min(1).max(220),
});

// A nudge quotes the person's own words back, so it gets a little more room than a lapse.
export const nudgeOutputSchema = z.object({
  message: z.string().min(1).max(320),
});
export type SetupOutput = z.infer<typeof setupOutputSchema>;
export type FollowUpOutput = z.infer<typeof followUpOutputSchema>;
export type LapseOutput = z.infer<typeof lapseOutputSchema>;
export type NudgeOutput = z.infer<typeof nudgeOutputSchema>;
