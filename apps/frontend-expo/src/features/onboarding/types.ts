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
  url: string;
  trialDays: number;
  amount: number;
  currency: string;
  interval: string;
  intervalCount: number;
}
/** The first plan's fields stay at the top level for older app builds. */
export interface CoachingOffer extends Omit<CoachingPlan, "id"> {
  plans?: CoachingPlan[];
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
