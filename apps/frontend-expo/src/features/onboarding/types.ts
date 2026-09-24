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
export interface CoachingOffer {
  url: string;
  trialDays: number;
  amount: number;
  currency: string;
  interval: string;
  intervalCount: number;
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
