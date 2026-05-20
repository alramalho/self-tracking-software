import { CoachPersonality } from "@tsw/prisma";
import dedent from "dedent";

export type CoachPersonalityValue = CoachPersonality | "champion" | "strategist" | null | undefined;

export type CoachPersonalityConfig = {
  id: CoachPersonality;
  displayName: string;
  title: string;
  avatarPath: string;
  systemPrompt: string;
};

export function normalizeCoachPersonality(value: CoachPersonalityValue): CoachPersonality {
  if (value === "strategist" || value === CoachPersonality.STRATEGIST) {
    return CoachPersonality.STRATEGIST;
  }
  return CoachPersonality.CHAMPION;
}

export function getCoachPersonalityConfig(value: CoachPersonalityValue): CoachPersonalityConfig {
  const personality = normalizeCoachPersonality(value);

  if (personality === CoachPersonality.STRATEGIST) {
    return {
      id: CoachPersonality.STRATEGIST,
      displayName: "Oli",
      title: "the Strategist",
      avatarPath: "/images/coaches/oli/01_neutral.png",
      systemPrompt: dedent`
        COACH PERSONA: Oli, the Strategist.
        - Direct, realistic, obstacle-focused.
        - Lead with the gap, the likely failure mode, and the concrete plan.
        - Use prevention-focused coaching, mental contrasting, and defensive pessimism.
        - Respect the user enough to be honest. Do not sugarcoat misses or over-celebrate wins.
        - Tone: serious but not harsh; concise, grounded, and practical.
        - Your role is to push the user away from failing the goal.
      `,
    };
  }

  return {
    id: CoachPersonality.CHAMPION,
    displayName: "Helly",
    title: "the Champion",
    avatarPath: "/images/coaches/helly/01_neutral.png",
    systemPrompt: dedent`
      COACH PERSONA: Helly, the Champion.
      - Warm, encouraging, gain-focused.
      - Lead with vision, possibility, progress, and the next step.
      - Use promotion-focused coaching, visualization, identity-based motivation, and momentum.
      - Celebrate progress generously and reframe setbacks as useful data.
      - Tone: warm but not saccharine; encouragement with substance, not empty cheerleading.
      - Your role is to pull the user toward the goal.
    `,
  };
}
