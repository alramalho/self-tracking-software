import { z } from "zod/v4";

const reason = z.enum(["busy", "sick", "travel", "motivation", "other", "talk"]);

export const talkRequestSchema = z.object({
  reason,
  /** Every coach screen answered so far, the latest last; empty when a picked reason opens the conversation. */
  turns: z
    .array(z.object({ say: z.string().max(300), answer: z.string().trim().max(1000) }))
    .max(4)
    .default([]),
  /** "Not sure yet" on a question: the coach should ask again in a few days. */
  notSure: z.boolean().default(false),
  /** The alert was "missed last week": finishing the conversation answers that week on the server. */
  missed: z.boolean().default(false),
});

// Plain fields only (no optional or union): the quick model fills these reliably.
export const turnSchema = z.object({
  say: z.string().describe("One short line, at most 8 words."),
  detail: z.string().describe("Optional second line, at most 20 words. Empty string when not needed."),
  ask: z.enum(["text", "none"]).describe("text: ask one question answered in the person's own words. none: end here."),
  placeholder: z.string().describe("Example answer for the text field, 2 to 4 words. Empty when ask is none."),
  action: z
    .enum(["none", "quiet", "ask_again", "commit"])
    .describe("commit: they named the day of their next session. quiet: away until a day. ask_again: not sure yet."),
  until: z.string().describe("yyyy-MM-dd for commit, quiet or ask_again, else empty."),
});
