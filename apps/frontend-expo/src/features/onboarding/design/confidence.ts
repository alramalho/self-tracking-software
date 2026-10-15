import type { PlanConfidence, PlanDesign } from "@tsw/prisma/follow-through";
import type { LighterPlan } from "./types";

/** Below this, the coach offers a lighter plan before the person commits. */
export const CONFIDENT = 7;
export const FIRST_SCORE = 5;

export function confidenceLabel(score: number) {
  if (score <= 3) return "Not sure yet";
  if (score <= 6) return "Somewhat sure";
  if (score <= 8) return "Pretty sure";
  return "Certain";
}

/**
 * Sure of it: "why not lower?" makes the person argue for their own commitment instead of defending a doubt.
 * Still unsure (after the lighter plan was offered, or with none to offer): what would get them to sure,
 * which is something the coach can act on.
 */
export function whyQuestion(score: number) {
  if (score < CONFIDENT) return `What would make it a ${CONFIDENT}?`;
  return `Why ${score === 8 ? "an" : "a"} ${score}, and not a ${score - 3}?`;
}

/**
 * The smaller version of this plan the coach can offer, or null when there is nothing smaller.
 * Only changes that need no new plan: Helly's route is already built, and a habit is just a weekly number.
 * Fewer days on Helly's route would mean designing the weeks again, so that isn't offered here.
 */
export function lighterPlan(design: PlanDesign): LighterPlan | null {
  if (design.orientation === "CONSISTENCY") {
    return design.preferredDays > 1 ? { kind: "fewer-days", days: design.preferredDays - 1 } : null;
  }
  const chosen = design.options.find((o) => o.id === design.selected);
  const steady = chosen && design.options.find((o) => o.coach === "Helly" && o.id !== chosen.id);
  return steady ? { kind: "other-route", route: steady.id, daysMin: steady.daysMin, daysMax: steady.daysMax } : null;
}

/** The plan with the lighter version applied. */
export const applyLighter = (design: PlanDesign, lighter: LighterPlan): PlanDesign =>
  lighter.kind === "other-route" ? { ...design, selected: lighter.route } : { ...design, preferredDays: lighter.days };

export function lighterMessage(lighter: LighterPlan) {
  if (lighter.kind === "other-route")
    return `Helly’s route gets you there with ${lighter.daysMin}–${lighter.daysMax} days a week. A plan you keep beats a bigger one you drop.`;
  return `How about ${lighter.days} ${lighter.days === 1 ? "time" : "times"} a week? A plan you keep beats a bigger one you drop.`;
}

export const confidenceFor = (score: number, why: string, question: string, now = new Date()): PlanConfidence => ({
  score,
  why: why.trim(),
  question,
  askedAt: now.toISOString(),
});

/** Turns a recorder level in decibels (about -160 silent to 0 loud) into 0–1 for the meter. */
export const voiceLevel = (decibels: number | undefined) =>
  decibels === undefined ? 0 : Math.max(0, Math.min(1, (decibels + 50) / 45));
