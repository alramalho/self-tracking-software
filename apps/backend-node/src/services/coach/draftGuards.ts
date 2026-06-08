export const REPEATED_DRAFT_FAILURE_LIMIT = 3;

function normalizeDraftForRepeatCheck(content: string) {
  return content
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function containsInternalStateLeak(content: string) {
  return [
    /<visible_user_saw\b/i,
    /<\/visible_user_saw>/i,
    /<internal_metadata\b/i,
    /<\/internal_metadata>/i,
    /\bprevious_proposal_state\b/i,
    /\bPRIOR APP STATE FOR THE IMMEDIATELY PRECEDING ASSISTANT MESSAGE\b/i,
    /\bvisibility=["']not_user_visible["']/i,
    /\bpurpose=["']state_only["']/i,
    /^\s*[-•]\s*type:\s*(activity_log|activity_edit|plan_creation|plan_modification)\b/im,
  ].some((pattern) => pattern.test(content));
}

export function getRepeatedRecentAssistantDraft(params: {
  drafts: Array<{ content: string }>;
  recentAssistantMessages: string[];
}): string | null {
  const recent = new Set(
    params.recentAssistantMessages
      .map(normalizeDraftForRepeatCheck)
      .filter(Boolean)
  );

  const repeatedDraft = params.drafts.find((draft) => {
    const normalized = normalizeDraftForRepeatCheck(draft.content);
    return normalized.length > 0 && recent.has(normalized);
  });

  return repeatedDraft?.content ?? null;
}
