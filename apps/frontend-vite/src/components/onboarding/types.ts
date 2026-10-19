import type {
  CoachNote,
  DesignActivity,
  DesignOption,
  DesignSession,
  GoalGuidanceResult,
  InterviewFacts,
  PlanCoaching,
  PlanDesign,
  SessionTargets,
  SupportPreferences,
} from "@tsw/prisma/follow-through";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { MatchPreferences } from "@/components/circles/types";

// The web onboarding is the native app's coach-designed flow, screen for screen.
// Drafts are saved on the server in the same shape, so a person can start on one
// platform and finish on the other.

export type QuestionStage = "goal" | "baseline" | "motivation";

export type OnboardingScreen =
  | { name: "question"; stage: QuestionStage }
  | { name: "design" }
  | { name: "coach"; step: number }
  | { name: "circle" }
  | { name: "confidence" }
  | { name: "paywall" };

export interface OnboardingProgress {
  current: number;
  total: number;
}

export interface ClassifyResponse {
  orientation: PlanDesign["orientation"];
  reason: string;
  activity: { key: string; title: string; measure: string; emoji: string };
  goalSpec: PlanDesign["goalSpec"];
  baselineQuestion: string;
}

export interface OptionsResponse {
  status: "READY" | "ASK" | "PUSHBACK";
  question: string | null;
  coachNote: CoachNote | null;
  baseline: PlanDesign["baseline"];
  options: DesignOption[];
  startDate: string;
}

export interface CoachingPlan {
  id: "weekly" | "monthly" | "quarterly";
  /** Stripe checkout link with the person's id attached. */
  url?: string;
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

/** The smaller plan offered when the person isn't sure of the one they picked. */
export type LighterPlan =
  | { kind: "other-route"; route: DesignOption["id"]; daysMin: number; daysMax: number }
  | { kind: "fewer-days"; days: number };

export type DesignStepName = "subgoal" | "days" | "loading" | "ask" | "pushback" | "retarget" | "options" | "preview";

export type ConfidenceStepName = "rate" | "lighter" | "why";

export type OnboardingArtName = "goal" | "baseline" | "motivation" | "rhythm" | "review" | "match" | "question";

export interface OnboardingRouteSearch {
  /** A goal to start from, e.g. one left over from an earlier multi-goal answer. */
  goal?: string;
}

export interface OnboardingFlowProps {
  initialGoal?: string;
}

export interface OnboardingFrameProps {
  /** Changing it replays the entry fade, so each screen arrives on its own. */
  screenKey: string;
  progress?: OnboardingProgress;
  /** The welcome hides the progress line. */
  bare?: boolean;
  busy?: boolean;
  backDisabled?: boolean;
  onBack?: () => void;
  onSkip?: () => void;
  onClose?: () => void;
  actions?: ReactNode;
  children: ReactNode;
}

export interface OnboardingButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  busy?: boolean;
}

export interface QuietButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  /** "secondary" is a soft filled button; "link" is underlined text. */
  variant?: "secondary" | "link";
}

export interface NumberPickerProps {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  unit: string;
  decreaseLabel: string;
  increaseLabel: string;
  disabled?: boolean;
  testId: string;
}

export interface OnboardingArtProps {
  name: OnboardingArtName;
  size?: number;
}

export interface ScreenHeadingProps {
  title: string;
  detail?: string;
  /** Art or an avatar above the title. */
  art?: ReactNode;
}

export interface CoachAvatarProps {
  coach: "Helly" | "Oli";
  size: number;
}

export type WelcomeStepName = "intro" | "profile" | "age";

export interface ConsentListProps {
  title: string;
  items: string[];
}

/** The account fields that record whether AI features are allowed. */
export interface AiConsentFields {
  aiConsentGrantedAt?: Date | string | null;
  aiConsentDeclinedAt?: Date | string | null;
}

export interface WelcomeProps {
  savedAge?: number | null;
  /** New sign-ups through Google or Apple still need a username. */
  needsUsername: boolean;
  busy: boolean;
  onContinue: (age: number) => void;
}

export interface ProfileSetupProps {
  onDone: () => void;
}

export interface AiConsentStepProps {
  busy: boolean;
  onAllow: () => void;
  onDecline: () => void;
}

export interface QuestionStepProps {
  stage: QuestionStage;
  title: string;
  answer: string;
  onAnswer: (answer: string) => void;
  guidance: GoalGuidanceResult;
  checking: boolean;
}

export interface GoalGuidanceProps {
  result: GoalGuidanceResult;
  loading: boolean;
}

export interface DesignSectionProps {
  design: PlanDesign;
  goal: string;
  goalReason: string;
  timezone: string;
  busy: boolean;
  /** Saves progress so the person can leave and come back. */
  onChange: (design: PlanDesign) => Promise<void>;
  /** Back from the first design screen returns to the previous question. */
  onBack: () => void;
  onClose?: () => void;
  onDone: (design: PlanDesign) => void;
}

export interface RouteCardProps {
  option: DesignOption;
  selected: boolean;
  onClick: () => void;
}

export interface TwoWeeksProps {
  sessions: DesignSession[];
  activity: DesignActivity;
  startDate: string;
}

export interface SessionDetailProps {
  session: DesignSession;
  activity: DesignActivity;
}

export interface SessionTargetRowsProps {
  targets: SessionTargets;
}

export interface TargetRowProps {
  icon: LucideIcon;
  children: string;
}

export interface CoachStepProps {
  step: number;
  coach: "Helly" | "Oli";
  facts: InterviewFacts;
  coaching: PlanCoaching;
  preferences: SupportPreferences;
  onCoaching: (coaching: PlanCoaching) => void;
  onPreferences: (preferences: SupportPreferences) => void;
}

export interface CoachingChoiceProps {
  label: string;
  detail: string;
  selected: boolean;
  icon?: LucideIcon;
  onClick: () => void;
}

export interface ExampleCardProps {
  label: string;
  children: string;
}

export interface CircleStepProps {
  prefs: MatchPreferences | null;
  age: number | null | undefined;
  weeklyTarget: number;
  busy: boolean;
  locating: boolean;
  locationDenied: boolean;
  place: string | null;
  onPrefs: (prefs: MatchPreferences | null) => void;
  onAge: (age: number) => void;
  onInvite: () => void;
  onSolo: () => void;
}

export interface ConfidenceSectionProps {
  design: PlanDesign;
  busy: boolean;
  onBack: () => void;
  onClose?: () => void;
  /** The design with `confidence` set, and the lighter plan applied when the person took it. */
  onDone: (design: PlanDesign) => void;
}

export interface ConfidenceDialProps {
  score: number;
  onChange?: (score: number) => void;
  /** Smaller and read-only, shown above the "why" question. */
  compact?: boolean;
}

export interface PaywallProps {
  facts: InterviewFacts;
  plans: CoachingPlan[];
  selected: CoachingPlan["id"];
  onSelect: (id: CoachingPlan["id"]) => void;
  coach: "Helly" | "Oli";
}

export interface PaywallRow {
  text: string;
  free: boolean;
}
