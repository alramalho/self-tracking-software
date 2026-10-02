import { z } from "zod/v4";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const newSessionSchema = z.object({
  activityId: z.string().min(1),
  date,
  quantity: z.number().int().positive(),
  descriptiveGuide: z.string().min(1).max(3000),
});

export const setupOutputSchema = z.object({
  message: z.string().min(1).max(1200),
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

export const followUpOutputSchema = z.object({
  message: z.string().min(1).max(1200).nullable(),
  requiresReply: z.boolean(),
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
  message: z.string().min(1).max(800),
});
export type SetupOutput = z.infer<typeof setupOutputSchema>;
export type FollowUpOutput = z.infer<typeof followUpOutputSchema>;
export type LapseOutput = z.infer<typeof lapseOutputSchema>;
