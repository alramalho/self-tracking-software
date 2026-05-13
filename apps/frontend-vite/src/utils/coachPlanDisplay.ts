import { type CompletePlan } from "@/contexts/plans";

const GENERIC_CATEGORIES = new Set([
  "other",
  "habit_building",
  "self_care",
  "productivity",
]);

const CATEGORY_LABELS: Record<string, string> = {
  running: "Running",
  cycling: "Cycling",
  swimming: "Swimming",
  strength_training: "Strength",
  yoga: "Yoga",
  martial_arts: "Martial Arts",
  team_sports: "Team Sports",
  outdoor_adventure: "Outdoor",
  dance: "Dance",
  flexibility_mobility: "Mobility",
  nutrition: "Nutrition",
  weight_management: "Weight Management",
  sleep: "Sleep",
  mental_health: "Mental Health",
  meditation: "Meditation",
  reading: "Reading",
  language_learning: "Language",
  music: "Music",
  writing: "Writing",
  coding: "Coding",
  art: "Art",
  finance: "Finance",
  social: "Social",
  career: "Career",
  home: "Home",
};

const KEYWORD_DOMAINS: Array<{ label: string; patterns: RegExp[] }> = [
  { label: "Chess", patterns: [/\bchess\b/i] },
  {
    label: "Strength",
    patterns: [
      /\bstrength\b/i,
      /\btrain(?:ing)?\b/i,
      /\bworkout\b/i,
      /\bgym\b/i,
      /\blift(?:ing)?\b/i,
      /\bmuscle\b/i,
      /\bmass\b/i,
    ],
  },
  {
    label: "Running",
    patterns: [/\brun(?:ning)?\b/i, /\bmarathon\b/i, /\b5k\b/i, /\b10k\b/i],
  },
  { label: "Meditation", patterns: [/\bmeditat(?:e|ion|ing)\b/i] },
  {
    label: "Language",
    patterns: [/\bgerman\b/i, /\bspanish\b/i, /\bfrench\b/i, /\blanguage\b/i],
  },
  {
    label: "Study",
    patterns: [/\bstud(?:y|ying)\b/i, /\blearn\b/i, /\bexam\b/i],
  },
];

export function getPlanDomainLabel(plan: Pick<CompletePlan, "category" | "goal">) {
  const category = plan.category || "";

  if (category && !GENERIC_CATEGORIES.has(category)) {
    return CATEGORY_LABELS[category] || category.replaceAll("_", " ");
  }

  const goal = plan.goal || "";
  const inferred = KEYWORD_DOMAINS.find(({ patterns }) =>
    patterns.some((pattern) => pattern.test(goal))
  );

  return inferred?.label || null;
}

export function getCoachPlanInsight(
  plan: CompletePlan,
  nextSessionLabel?: string | null
) {
  if (!plan.isCoached) return null;

  if (plan.coachSuggestedTimesPerWeek || plan.suggestedByCoachAt) {
    return "Coach Oli suggested a plan adjustment. Review it before the next session.";
  }

  if (plan.coachNotes?.trim()) {
    return plan.coachNotes.trim();
  }

  if (plan.currentWeekState === "AT_RISK") {
    return "This plan needs attention this week. Review the next action with Coach Oli.";
  }

  if (plan.currentWeekState === "FAILED") {
    return "This week is off track. Coach Oli can help reset the next session.";
  }

  if (plan.currentWeekState === "COMPLETED") {
    return "Week completed. Coach Oli can help shape the next progression.";
  }

  if (nextSessionLabel) {
    return `Next coached session: ${nextSessionLabel}.`;
  }

  return null;
}
