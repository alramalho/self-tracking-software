import type { MatchPreferences } from "@/features/circles/types";
export interface FollowupQuestion {
  icon: string;
  title: string;
  purpose: string;
  type: "text" | "choice";
  options: string[];
}
export interface NextResponse {
  ready: boolean;
  question: FollowupQuestion | null;
  nextStep: string;
  explanation: string;
  suggestedFormat: "LOG" | "TIMER" | "RESOURCE";
}
export interface CoachingPlan {
  id: "weekly" | "monthly" | "quarterly";
  /** Stripe checkout link (web). */
  url?: string;
  /** App Store product (iOS). */
  productId?: string;
  trialDays: number;
  amount: number;
  /** The store's own price text, e.g. "€9.99" from the App Store. */
  displayPrice?: string;
  currency: string;
  interval: string;
  intervalCount: number;
}
/** The first plan's fields stay at the top level for older app builds. */
export interface CoachingOffer extends Omit<CoachingPlan, "id"> {
  plans?: CoachingPlan[];
}
export interface FreeTrackingSheetProps {
  visible: boolean;
  plan?: CoachingPlan;
  busy: boolean;
  onTrial: () => void;
  onFree: () => void;
  onClose: () => void;
}
export interface PaywallProps {
  facts: import("@tsw/prisma/follow-through").InterviewFacts;
  plans: CoachingPlan[];
  selected: CoachingPlan["id"];
  onSelect: (id: CoachingPlan["id"]) => void;
}
export interface OnboardingProps {
  preview?: boolean;
  initialGoal?: string;
}
export interface CoachingTourProps {
  step: number;
  facts: import("@tsw/prisma/follow-through").InterviewFacts;
  coaching: import("@tsw/prisma/follow-through").PlanCoaching;
  preferences: import("@tsw/prisma/follow-through").SupportPreferences;
  onCoaching: (coaching: import("@tsw/prisma/follow-through").PlanCoaching) => void;
  onPreferences: (preferences: import("@tsw/prisma/follow-through").SupportPreferences) => void;
}
export interface PlanConclusionProps {
  facts: import("@tsw/prisma/follow-through").InterviewFacts;
  coaching?: import("@tsw/prisma/follow-through").PlanCoaching;
  preferences?: import("@tsw/prisma/follow-through").SupportPreferences;
}

export interface CircleAskProps {
  busy: boolean;
  onFind: () => void;
  onInvite: () => void;
  onSolo: () => void;
}

export interface CirclePrefsProps {
  value: MatchPreferences;
  onChange: (value: MatchPreferences) => void;
  place: string | null;
  age: number | null | undefined;
  weeklyTarget: number;
  locating: boolean;
  locationDenied: boolean;
  onAge: (age: number) => void;
}

