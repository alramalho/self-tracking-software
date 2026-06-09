import { tool } from "../../../../utils/aiSdk";
import dedent from "dedent";
import { z } from "zod/v4";
import {
  getRepeatedRecentAssistantDraft,
  REPEATED_DRAFT_FAILURE_LIMIT,
} from "../../draftGuards";

export function createDraftMessagesTool(params: {
  recentAssistantMessages: string[];
}) {
  let repeatedDraftFailureCount = 0;

  return tool({
    description: dedent`
      Send your response as chat messages. Always use this to reply.
      Never include prior app state, conversation-history tags, internal metadata, proposal ledgers, tool names, or raw proposal statuses in the visible response.
      Saved plan and activity mentions MUST use the linked-entity DSL:
      - plans: {{plan:<planId>|<visible label>}}
      - activities: {{activity:<activityId>|<visible label>}}
      Use ids exactly from the active plan/activity context. Do not mention saved plans or activities as plain text when a matching entity exists.
    `,
    inputSchema: z.object({
      messages: z.array(z.object({
        content: z.string().trim().min(1).describe("A short chat message (1-2 sentences). Saved plan/activity mentions must use {{plan:<planId>|<label>}} or {{activity:<activityId>|<label>}}."),
      })).min(1).max(3),
    }),
    execute: async ({ messages }) => {
      const repeatedDraft = getRepeatedRecentAssistantDraft({
        drafts: messages,
        recentAssistantMessages: params.recentAssistantMessages,
      });

      if (repeatedDraft) {
        repeatedDraftFailureCount += 1;
        const repeatLimitExceeded =
          repeatedDraftFailureCount >= REPEATED_DRAFT_FAILURE_LIMIT;

        return {
          success: false,
          repeatGuard: true,
          repeatAttempt: repeatedDraftFailureCount,
          repeatLimit: REPEATED_DRAFT_FAILURE_LIMIT,
          repeatLimitExceeded,
          repeatedDraftPreview: repeatedDraft.slice(0, 500),
          error: repeatLimitExceeded
            ? `Your draft repeated a recent coach message ${REPEATED_DRAFT_FAILURE_LIMIT} times. Stop trying to answer with the same wording.`
            : "Your draft repeats a recent coach message exactly. Do not send it. Answer the user's latest message directly, acknowledge the new information, and move the conversation forward.",
        };
      }

      return { success: true, count: messages.length };
    },
  });
}
