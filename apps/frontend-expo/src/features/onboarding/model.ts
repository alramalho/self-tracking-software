import type { OnboardingDraft } from "@tsw/prisma/follow-through";
export const newDraft = (id: string): OnboardingDraft => ({
  id,
  goal: "",
  emoji: "🎯",
  activityId: null,
  activityTitle: "",
  measure: "sessions",
  commitment: "WEEKLY",
  frequency: 3,
  weekdays: [],
  time: null,
  durationMinutes: 20,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  targetDate: null,
  resourceName: "",
  resourceUrl: "",
  nextStep: "",
  format: "LOG",
  wantsCoaching: false,
  answers: [],
  step: "goal",
  createdPlanId: null,
});
export const stepOrder = (d: OnboardingDraft) => [
  "goal",
  "activity",
  ...(d.activityId ? [] : ["measure", "emoji"]),
  "rhythm",
  "frequency",
  ...(d.commitment !== "WEEKLY" ? ["days"] : []),
  ...(d.commitment === "TIMED" ? ["time"] : []),
  "duration",
  "target",
  "guidance",
  ...(d.wantsCoaching
    ? ["resource", ...(d.resourceName ? ["link"] : []), "followup"]
    : []),
  "nextStep",
  ...(d.commitment !== "WEEKLY" ? ["format"] : []),
  "review",
  ...(d.commitment !== "WEEKLY" ? ["reminder"] : []),
  ...(d.wantsCoaching ? [...(d.commitment !== "WEEKLY" ? ["checkIn"] : []), "weeklyReview"] : []),
  "finish",
];
export function canContinue(d: OnboardingDraft) {
  switch (d.step) {
    case "goal":
      return !!d.goal.trim();
    case "activity":
      return !!d.activityTitle.trim();
    case "measure":
      return !!d.measure.trim();
    case "emoji":
      return !!d.emoji.trim();
    case "frequency":
      return (
        Number.isInteger(d.frequency) && d.frequency >= 1 && d.frequency <= 7
      );
    case "days":
      return d.weekdays.length > 0 && d.weekdays.length <= d.frequency;
    case "time":
      return /^([01]\d|2[0-3]):[0-5]\d$/.test(d.time || "");
    case "duration":
      return (
        Number.isInteger(d.durationMinutes) &&
        d.durationMinutes > 0 &&
        d.durationMinutes <= 1440
      );
    case "link":
      return /^https:\/\//i.test(d.resourceUrl) && URL.canParse(d.resourceUrl);
    case "target":
      return (
        !d.targetDate ||
        (/^\d{4}-\d{2}-\d{2}$/.test(d.targetDate) &&
          !Number.isNaN(Date.parse(d.targetDate)))
      );
    default:
      return true;
  }
}
