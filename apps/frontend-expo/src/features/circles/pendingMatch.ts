import type { PendingMatch } from "./types";

// Onboarding finishes the plan, then hands its circle choice to the match screen.
// Kept in memory only: if the app restarts first, the plan shows "Find a circle".
let pending: PendingMatch | null = null;

export function setPendingMatch(value: PendingMatch) {
  pending = value;
}

export function takePendingMatch(planId: string): PendingMatch | null {
  if (pending?.planId !== planId) return null;
  const value = pending;
  pending = null;
  return value;
}
