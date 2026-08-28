export const COACH_CONVERSATION_STARTER_IDS = [
  "you-got-this",
  "still-on-track",
  "done-beats-perfect",
  "consistency-beats-intensity",
] as const;

export type CoachConversationStarterId =
  (typeof COACH_CONVERSATION_STARTER_IDS)[number];

export function isCoachConversationStarterId(
  value: unknown,
): value is CoachConversationStarterId {
  return (
    typeof value === "string" &&
    (COACH_CONVERSATION_STARTER_IDS as readonly string[]).includes(value)
  );
}

export function getCoachConversationStarter(
  id: CoachConversationStarterId,
  firstName: string,
) {
  const messages: Record<CoachConversationStarterId, string> = {
    "you-got-this": `You got this, ${firstName}`,
    "still-on-track": "Still on track?",
    "done-beats-perfect": "Done is better than perfect",
    "consistency-beats-intensity": "Consistency beats intensity",
  };

  return messages[id];
}
