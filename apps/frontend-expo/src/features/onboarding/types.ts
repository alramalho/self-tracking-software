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
