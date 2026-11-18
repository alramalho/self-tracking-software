import { z } from "zod/v4";

export const coverageSchema = z.object({
  pace: z.enum(["ON_TRACK", "AHEAD", "BEHIND", "UNCLEAR"]),
  /** What they covered, a few words ("numbers 1–10, tones"). */
  covered: z.string().max(120),
  /** AHEAD or BEHIND only: one or two short sentences in the coach's voice about the change. */
  message: z.string().max(200).nullable(),
  /** AHEAD or BEHIND only: rewritten upcoming sessions, by id. */
  sessions: z
    .array(z.object({ id: z.string(), title: z.string().min(1).max(50), descriptiveGuide: z.string().min(25).max(700) }))
    .max(3),
});
