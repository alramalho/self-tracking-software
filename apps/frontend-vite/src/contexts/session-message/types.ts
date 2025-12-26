import { createContext } from "react";

// Snapshot of a session to attach to a message
// This is "frozen" data - won't change even if the original session is edited
export interface SessionSnapshot {
  // Activity info
  activityId: string;
  activityTitle: string;
  activityEmoji: string | null;
  activityMeasure: string;
  // Session info
  date: string; // ISO string
  quantity?: number;
  descriptiveGuide?: string;
  // Plan info
  planId: string;
  planGoal: string;
  planEmoji: string | null;
  // Coach info (for navigation)
  coachUsername: string;
}

export interface SessionMessageContextType {
  // The session to attach to the next message
  pendingSession: SessionSnapshot | null;
  // Set a session to attach (called when "Talk to coach" is clicked)
  setPendingSession: (session: SessionSnapshot | null) => void;
  // Clear after message is sent
  clearPendingSession: () => void;
}

export const SessionMessageContext = createContext<SessionMessageContextType | undefined>(undefined);
