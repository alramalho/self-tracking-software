import { z } from "zod/v4";
import { goalSpecSchema } from "./schema";

const asked = z.array(z.object({ question: z.string().max(200), answer: z.string().max(300) })).max(4);
const activity = z.object({
  key: z.string().min(1).max(40),
  title: z.string().min(1).max(40),
  measure: z.string().min(1).max(24),
  emoji: z.string().min(1).max(8),
});

export const classifyRequestSchema = z.object({ goal: z.string().trim().min(3).max(1500) });
export const subgoalRequestSchema = z.object({
  goal: z.string().trim().min(3).max(1500),
  orientation: z.enum(["OUTCOME", "CONSISTENCY"]),
  goalSpec: goalSpecSchema,
  activity: activity.pick({ title: true, measure: true }),
  baseline: z.string().max(1000),
  asked,
});
export const optionsRequestSchema = z.object({
  goal: z.string().trim().min(3).max(1500),
  goalSpec: goalSpecSchema,
  baseline: z.string().trim().max(1000),
  activities: z.array(activity).length(1),
  preferredDays: z.number().int().min(1).max(7),
  fixedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  asked,
  timezone: z.string().max(100),
});
