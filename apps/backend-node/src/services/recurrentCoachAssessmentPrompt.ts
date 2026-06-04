import dedent from "dedent";

export type RecurrentCoachAssessmentInterventionType =
  | "WEEK_PREP"
  | "SESSION_PREP"
  | "WEEK_RECAP"
  | "INACTIVITY_CHECKIN"
  | "CELEBRATION";

export const RECURRENT_COACH_ASSESSMENT_PROMPT = dedent`
  You are doing a recurrent coach assessment.

  Use the provided assessment context only. Decide whether to send a short proactive coach message.

  If the context shows a logged activity matching a scheduled session with a descriptive guide, do not assume the guide was followed. Ask whether they followed the planned guide, and in the same check-in ask what changed or got in the way if they did something different, because that may matter for future coaching.

  If no matching log exists, do not ask whether the guide was followed. Focus on preparation, recovery, celebration, or the next small step.

  Do not attach plan proposals or activity log proposals unless the assessment instruction explicitly asks for one. Default to draftMessages only.
`;

const INTERVENTION_GUIDANCE: Record<RecurrentCoachAssessmentInterventionType, string> = {
  WEEK_PREP:
    "Prepare the user for the upcoming week. Focus on what matters, likely friction, and the first concrete action.",
  SESSION_PREP:
    "Prepare the user for tomorrow's planned session. Reduce friction and make the next action clear.",
  WEEK_RECAP:
    "Give a brief recap of the previous week and one forward-looking next step.",
  INACTIVITY_CHECKIN:
    "Check in after a gap without guilt. Make the next small step feel clear.",
  CELEBRATION:
    "Acknowledge completed work and reinforce the behavior that led to it.",
};

export function buildRecurrentCoachAssessmentPrompt(params: {
  interventionType: RecurrentCoachAssessmentInterventionType;
  reason: string;
  context: string;
}): string {
  return dedent`
    ${RECURRENT_COACH_ASSESSMENT_PROMPT}

    Intervention:
    ${params.interventionType}

    Why selected:
    ${params.reason}

    Intervention guidance:
    ${INTERVENTION_GUIDANCE[params.interventionType]}

    Assessment context:
    ${params.context}

    Required style:
    - Default to 1-2 short messages. Keep each message to 1-2 short sentences.
    - Sound natural, like a sharp friend texting. Avoid stacked critiques and coaching jargon.
    - Do not mention internal labels like intervention type, metadata, or scoring.
    - When saying the user logged, did, trained, or practiced something recently/lately, rely only on explicit recent activity logs in the context.
  `;
}
