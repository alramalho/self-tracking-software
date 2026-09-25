import type { ReactNode } from "react";

export interface AiConsent {
  // True when the person allowed AI features (and their latest choice was Allow).
  allowed: boolean;
  // Shows the consent sheet if needed. Resolves true when AI may be used.
  ask: () => Promise<boolean>;
  // Render this where you call ask(), so the sheet opens above that screen.
  sheet: ReactNode;
}
export interface AiConsentSheetProps {
  visible: boolean;
  busy: boolean;
  error: unknown;
  onChoose: (granted: boolean) => void;
  onClose: () => void;
}
export interface AiConsentChoice {
  aiConsentGrantedAt: string | null;
  aiConsentDeclinedAt: string | null;
}
