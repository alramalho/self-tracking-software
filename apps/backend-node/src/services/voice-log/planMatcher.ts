import { experimental_evaluate as evaluate } from "ai";
import { logger } from "../../utils/logger";
import type {
  VoiceLogActivityPreview,
  VoiceLogNote,
  VoiceLogPlanMatch,
  VoiceLogUnresolved,
} from "./types";

const JEV_MODEL = "typesafe-ai/jev";
const MIN_MATCH_SCORE = 0.86;
const MIN_MATCH_MARGIN = 0.08;

type VoiceLogPlanCandidate = {
  id: string;
  goal: string;
  emoji: string | null;
  outlineType: string;
  notes: string | null;
  activities: Array<{
    id: string;
    title: string;
    measure: string;
  }>;
};

type MatchInput = {
  transcript: string;
  activities: VoiceLogActivityPreview[];
  note: VoiceLogNote;
  unresolved: VoiceLogUnresolved[];
  plans: VoiceLogPlanCandidate[];
};

const futureContextPattern =
  /\b(?:next time|next session|later|future|want to|would like to|plan(?:ning)? to|hope to|intend to|more regularly|keep doing|try a|should|could)\b/i;

function normalized(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function activityIsMentioned(input: MatchInput, plan: VoiceLogPlanCandidate) {
  const extractedActivityIds = new Set(
    input.activities.map((activity) => activity.activityId),
  );
  const text = normalized(
    [
      input.transcript,
      input.note.text,
      ...input.unresolved.map((item) => item.text),
    ].join(" "),
  );

  return plan.activities.some(
    (activity) =>
      extractedActivityIds.has(activity.id) ||
      text.includes(normalized(activity.title)),
  );
}

function contextText(input: MatchInput) {
  const futureUnresolved = input.unresolved.find((item) =>
    futureContextPattern.test(`${item.text} ${item.reason}`),
  );
  if (futureUnresolved) return futureUnresolved.text.slice(0, 500);
  if (futureContextPattern.test(input.note.text)) {
    return input.note.text.trim().slice(0, 500);
  }
  return null;
}

function probability(
  result: { answers?: Record<string, { probability?: unknown }> },
  key: string,
) {
  const value = result.answers?.[key]?.probability;
  return typeof value === "number" ? value : 0;
}

function matchedActivity(input: MatchInput, plan: VoiceLogPlanCandidate) {
  const extractedActivityIds = new Set(
    input.activities.map((activity) => activity.activityId),
  );
  return (
    plan.activities.find((activity) => extractedActivityIds.has(activity.id)) ??
    plan.activities[0]
  );
}

async function scorePlan(
  input: MatchInput,
  plan: VoiceLogPlanCandidate,
  context: string,
) {
  const result = await evaluate({
    model: JEV_MODEL,
    state: JSON.stringify({
      voiceNote: {
        transcript: input.transcript,
        extractedActivities: input.activities.map((activity) => ({
          id: activity.activityId,
          title: activity.title,
          measure: activity.measure,
        })),
        privateNote: input.note.text,
        futureContext: context,
      },
      plan: {
        id: plan.id,
        goal: plan.goal,
        type: plan.outlineType,
        notes: plan.notes,
        activities: plan.activities,
      },
    }),
    questions: {
      isPlanGuidance: {
        type: "boolean",
        instructions:
          "Does the voice note contain a future preference, intention, constraint, or next-session cue that should be remembered for coaching, rather than a completed activity?",
      },
      activityMatches: {
        type: "boolean",
        instructions:
          "Does the voice note clearly refer to at least one activity belonging to this plan? Match natural language such as run/running/running route to the saved activity title when the meaning is clear.",
      },
      fitsThisPlan: {
        type: "boolean",
        instructions:
          "Would saving this cue to this specific plan be useful and coherent for future coaching? Reject a generic life reflection, a different goal, or a weakly related plan.",
      },
    },
    maxRetries: 1,
  });

  const isPlanGuidance = probability(result, "isPlanGuidance");
  const activityMatches = probability(result, "activityMatches");
  const fitsThisPlan = probability(result, "fitsThisPlan");
  const score =
    isPlanGuidance * 0.3 + activityMatches * 0.35 + fitsThisPlan * 0.35;

  return {
    plan,
    score,
    isPlanGuidance,
    activityMatches,
    fitsThisPlan,
  };
}

export async function matchVoiceLogToPlans(
  input: MatchInput,
): Promise<VoiceLogPlanMatch[]> {
  const context = contextText(input);
  if (!context || (!process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL)) {
    return [];
  }

  const structuredPlans = input.plans.filter(
    (plan) => plan.outlineType === "SPECIFIC",
  );
  const mentionedPlans = structuredPlans.filter((plan) =>
    activityIsMentioned(input, plan),
  );
  const candidates = mentionedPlans.length ? mentionedPlans : structuredPlans;
  if (!candidates.length) return [];

  const scored = await Promise.all(
    candidates.slice(0, 12).map(async (plan) => {
      try {
        return await scorePlan(input, plan, context);
      } catch (error) {
        logger.warn("Voice-log plan matching failed for candidate", {
          planId: plan.id,
          error: error instanceof Error ? error.message : String(error),
        });
        return null;
      }
    }),
  );

  const qualified = scored
    .filter(
      (value): value is NonNullable<typeof value> =>
        value !== null &&
        value.score >= MIN_MATCH_SCORE &&
        value.isPlanGuidance >= 0.78 &&
        value.activityMatches >= 0.82 &&
        value.fitsThisPlan >= 0.82,
    )
    .sort((a, b) => b.score - a.score);
  const best = qualified[0];
  const second = qualified[1];
  if (!best || (second && best.score - second.score < MIN_MATCH_MARGIN)) {
    return [];
  }

  const activity = matchedActivity(input, best.plan);
  if (!activity) return [];

  return [
    {
      planId: best.plan.id,
      planGoal: best.plan.goal,
      planEmoji: best.plan.emoji,
      activityId: activity.id,
      activityTitle: activity.title,
      contextText: context,
      confidence: Number(best.score.toFixed(3)),
    },
  ];
}
