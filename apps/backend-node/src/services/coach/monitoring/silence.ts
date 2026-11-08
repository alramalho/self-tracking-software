/** Messages the coach sent without being asked: scheduled reviews, check-ins and legacy assessments. */
const PROACTIVE_SOURCES = new Set(["plan_monitoring", "autonomous_coach"]);

interface ConversationMessage {
  role: string;
  createdAt: Date;
  metadata: unknown;
}

function outreachKey(message: ConversationMessage) {
  const metadata = message.metadata as { coachRequestId?: string } | null;
  // One outreach can span several bubbles; count it once.
  return metadata?.coachRequestId ?? String(Math.floor(message.createdAt.getTime() / 60000));
}

/** How many times the coach reached out since the person last wrote. A real coach doesn't keep talking into silence. */
export function unansweredOutreaches(messages: ConversationMessage[]) {
  const lastUserAt = Math.max(
    0,
    ...messages.filter((m) => m.role === "USER").map((m) => m.createdAt.getTime()),
  );
  const outreaches = new Set(
    messages
      .filter(
        (m) =>
          m.role === "COACH" &&
          m.createdAt.getTime() > lastUserAt &&
          PROACTIVE_SOURCES.has((m.metadata as { source?: string } | null)?.source ?? ""),
      )
      .map(outreachKey),
  );
  return outreaches.size;
}

/** At most one opener and one honest last nudge go unanswered; then the coach waits for the person. */
export const MAX_UNANSWERED_OUTREACHES = 2;
