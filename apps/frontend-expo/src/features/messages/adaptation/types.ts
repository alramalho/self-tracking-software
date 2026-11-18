import type { ReactNode } from "react";

export type CoachMood = "sad" | "smiling";

export interface CoachNoteProps {
  strategist: boolean;
  mood: CoachMood;
  children: ReactNode;
}

export interface AdaptationPreviewProps {
  strategist: boolean;
  note: string;
  from: number;
  to: number;
}
