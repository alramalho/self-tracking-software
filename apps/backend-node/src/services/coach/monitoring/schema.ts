import { z } from "zod/v4";

export const planCoachingSchema = z.object({
  role: z.enum(["tracking", "consistency", "training"]),
  followUps: z.boolean(),
  dataAccess: z.object({ workouts: z.boolean(), sleep: z.boolean() }),
});
