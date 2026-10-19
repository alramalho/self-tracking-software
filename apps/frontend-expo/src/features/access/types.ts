import type { ReactNode } from "react";

// The phone permissions a feature can ask for through the access checklist.
// Camera, photos, microphone and calendar are asked by iOS directly when the
// person taps the button that needs them.
export type AccessKind = "notifications" | "health" | "location";

// pending: never asked (or turned off inside tracking.so), so Continue asks.
// off: declined in iOS, so only Settings can turn it back on.
export type AccessStatus = "pending" | "allowed" | "off" | "unavailable";

export type AccessStatuses = Partial<Record<AccessKind, AccessStatus>>;

export interface AccessItem {
  kind: AccessKind;
  // Why this feature needs it, in the feature's own words.
  detail: string;
}

export interface AccessRequest {
  // "<who> needs access" and "to <why>", like the system's own wording.
  title: string;
  subtitle: string;
  items: AccessItem[];
  // Set when another sheet closes right before: iOS can't present two at once.
  afterSheet?: boolean;
}

export interface AccessChecklist {
  // Shows the checklist when something is still pending. Resolves with the
  // final statuses (immediately, without a sheet, when nothing is pending).
  ask: (request: AccessRequest) => Promise<AccessStatuses>;
  // Render this where you call ask(), so the sheet opens above that screen.
  sheet: ReactNode;
}

export interface AccessContext {
  notificationsEnabled: boolean;
  healthAvailable: boolean;
  healthEnabled: boolean;
}

export interface AccessSheetProps {
  request: AccessRequest;
  initial: AccessStatuses;
  onRequest: (kind: AccessKind) => Promise<AccessStatus>;
  onDone: (statuses: AccessStatuses) => void;
}

export interface AccessRowProps {
  kind: AccessKind;
  detail: string;
  status?: AccessStatus;
  asking: boolean;
  first: boolean;
}
