import type { CoveragePace } from "@tsw/prisma/follow-through/coverage";

/** What the Share more note was about: the sessions just logged. */
export interface CoverageLogged {
  activityId: string;
  date: string;
}

export interface CoverageInput {
  plan: { goal: string; course: string | null };
  /** The session planned for the day they logged, if any. */
  planned: { title: string | null; guide: string } | null;
  /** What they said in the note. */
  said: string;
  /** The next sessions, which the coach may rewrite. */
  upcoming: { id: string; date: string; title: string | null; guide: string }[];
  coach: string;
}

export interface CoverageResult {
  pace: CoveragePace;
  covered: string;
  /** Set when the coach suggested a change; the suggestion is a coach message with Review Changes. */
  suggestion: { message: string; chatId: string; messageId: string } | null;
}
