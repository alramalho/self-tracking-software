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

/**
 * When the model skips the draftMessages tool, it sometimes writes the tool's arguments as plain
 * text, e.g. `{"messages":[{"content":"…"}]} ꦏꦺ` with stray tokens after it. Read the messages out
 * of that instead of sending raw JSON to the user. Returns null for JSON that can't be read, so the
 * caller retries rather than showing it.
 */
export function draftsFromRawText(
  text: string
): Array<{ content: string; requiresReply?: boolean }> | null {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "");
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return [{ content: text }];
  const start = trimmed.search(/[[{]/);
  const end = Math.max(trimmed.lastIndexOf("}"), trimmed.lastIndexOf("]"));
  try {
    const parsed = JSON.parse(trimmed.slice(start, end + 1));
    const list = Array.isArray(parsed) ? parsed : parsed?.messages;
    const drafts = (Array.isArray(list) ? list : [])
      .filter((item: any) => typeof item?.content === "string" && item.content.trim())
      .map((item: any) => ({
        content: item.content as string,
        requiresReply: item.requiresReply === true,
      }));
    return drafts.length ? drafts : null;
  } catch {
    return null;
  }
}
