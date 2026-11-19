import type { CoachingPlan } from "../types";

// Prices as the paywall shows them, from the Stripe plans the server reads.
export const LABELS: Record<CoachingPlan["id"], string> = { weekly: "Weekly", monthly: "Monthly", quarterly: "Quarterly" };
const WEEKS_PER: Record<string, number> = { day: 1 / 7, week: 1, month: 52 / 12, year: 52 };

export const weeksIn = (plan: CoachingPlan) => (WEEKS_PER[plan.interval] ?? 1) * plan.intervalCount;
export const money = (plan: CoachingPlan, amount = plan.amount) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: plan.currency }).format(amount / 100);
export const period = (plan: CoachingPlan) =>
  plan.intervalCount === 3 && plan.interval === "month" ? "3 months" : plan.intervalCount > 1 ? `${plan.intervalCount} ${plan.interval}s` : plan.interval;

/** Button text for the chosen plan: the trial is the promise, otherwise the start. */
export const paywallCta = (plan?: CoachingPlan) => (plan?.trialDays ? `Start my ${plan.trialDays} free days` : "Start coaching");

/** How much a longer plan saves against paying weekly, in percent. */
export function savingVsWeekly(plan: CoachingPlan, plans: CoachingPlan[]) {
  const weekly = plans.find((candidate) => candidate.id === "weekly");
  return weekly && plan.id !== "weekly" ? Math.round((1 - plan.amount / weeksIn(plan) / weekly.amount) * 100) : 0;
}

// Stripe checkout charges in the buyer's local currency when the price has it (USD in the US),
// otherwise in the price's own (EUR). The server can't see the country, so the time zone stands in.
const US_ZONE = /^(America\/(New_York|Detroit|Kentucky\/.*|Indiana\/.*|Chicago|Menominee|North_Dakota\/.*|Denver|Boise|Phoenix|Los_Angeles|Anchorage|Juneau|Sitka|Metlakatla|Yakutat|Nome|Adak|Puerto_Rico)|Pacific\/Honolulu|US\/.*)$/;

export function buyersCurrency(timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone) {
  return US_ZONE.test(timeZone ?? "") ? "usd" : undefined;
}

/** The plan priced in the currency checkout will charge this buyer. */
export function inBuyersCurrency(plan: CoachingPlan, currency = buyersCurrency()): CoachingPlan {
  const amount = currency && plan.amounts?.[currency];
  return currency && amount ? { ...plan, amount, currency } : plan;
}
