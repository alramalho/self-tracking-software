import type { PendingMatch } from "./types";

// Onboarding finishes the plan, then hands its circle choice to the match screen.
// Kept in memory only (never the URL, it can hold a location): after a reload the
// match screen falls back to the default preferences.
let pending: PendingMatch | null = null;

export function setPendingMatch(value: PendingMatch) {
  pending = value;
}

// Reading doesn't consume it (React may render twice); the match screen clears it once used.
export function readPendingMatch(planId: string): PendingMatch | null {
  return pending?.planId === planId ? pending : null;
}

export function clearPendingMatch() {
  pending = null;
}
