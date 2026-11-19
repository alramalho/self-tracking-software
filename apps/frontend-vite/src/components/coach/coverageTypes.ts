import type { CoachEntry } from "@tsw/prisma/follow-through/coach-inbox";
import type { CompletePlan } from "@/contexts/plans";

export interface CoverageAnswerProps {
  plan: CompletePlan;
  entry: CoachEntry;
  onClose: () => void;
  onSkip: () => void;
  skipping: boolean;
}

/** What POST /voice-logs/coverage returns: the coach's read, and a suggestion only when clearly ahead or behind. */
export interface CoverageReply {
  pace: "ON_TRACK" | "AHEAD" | "BEHIND" | "UNCLEAR";
  covered: string;
  suggestion: { message: string; chatId: string; messageId: string } | null;
}
