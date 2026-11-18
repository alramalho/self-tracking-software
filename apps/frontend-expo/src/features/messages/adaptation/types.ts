import type { ReactNode } from "react";

export type CoachMood = "sad" | "smiling";

export interface CoachNoteProps {
  strategist: boolean;
  mood: CoachMood;
  /** "small" for notes beside other visuals, like the two weeks in onboarding. */
  size?: "regular" | "small";
  children: ReactNode;
}
