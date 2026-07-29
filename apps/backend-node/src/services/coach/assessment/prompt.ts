import dedent from "dedent";

export type RecurrentCoachAssessmentInterventionType =
  | "WEEK_PREP"
  | "SESSION_PREP"
  | "WEEK_RECAP"
  | "INACTIVITY_CHECKIN"
  | "CELEBRATION";

export const RECURRENT_COACH_ASSESSMENT_PROMPT = dedent`
  You are doing a recurrent coach assessment.

  Use the provided assessment context only. This outreach must change what the
  user should do next. Lead with the concrete risk or decision, then give one
  specific action.

  Never message just because the user logged or completed an activity, a new week
  started, a session is tomorrow, or a recap is available. Never ask "how did it
  go?", "how did it feel?", or whether a planned guide was followed after a
  routine log. Treat a completed log as settled unless the context contains
  explicit evidence that requires a plan change.

  Ask a question only when the answer is required to choose or apply the action.
  Do not manufacture a check-in question to keep the conversation going.

  Do not attach plan proposals or activity log proposals unless the assessment instruction explicitly asks for one. Default to draftMessages only.
`;

const INTERVENTION_GUIDANCE: Record<RecurrentCoachAssessmentInterventionType, string> = {
  WEEK_PREP:
    "Only surface a time-sensitive conflict that requires action before the week starts.",
  SESSION_PREP:
    "Only surface a concrete blocker that requires action before tomorrow's session.",
  WEEK_RECAP:
    "Only surface a result that requires a specific change to the current plan.",
  INACTIVITY_CHECKIN:
    "State the immediate risk and the single smallest action that keeps the plan viable.",
  CELEBRATION:
    "Do not praise by default. Only name a concrete progression the completion now unlocks.",
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
    - Use one short message of at most 2 sentences.
    - Sound direct and natural. No praise sandwich, motivational filler, or coaching jargon.
    - Do not mention internal labels like intervention type, metadata, or scoring.
    - When saying the user logged, did, trained, or practiced something recently/lately, rely only on explicit recent activity logs in the context.
  `;
}
