export interface CoachPreviewProps {
  strategist: boolean;
}

export interface LockScreenPreviewProps {
  coachName: string;
  message: string;
}

export interface AdaptingWeeksProps {
  strategist: boolean;
  /** The plan's emoji, so the tiles look like the person's own plan. */
  emoji: string;
}
