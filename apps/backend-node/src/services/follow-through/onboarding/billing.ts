import Stripe from "stripe";
import type { User } from "@tsw/prisma";

// The coaching plans shown on the paywall, read live from Stripe payment links so price and
// trial terms are never invented here. COACHING_PAYMENT_LINKS lists them in paywall order,
// e.g. "quarterly=plink_…,monthly=plink_…,weekly=plink_…". Without it, the original monthly
// link is the only plan.
const LEGACY_LINK = process.env.ONBOARDING_PAYMENT_LINK_ID || "plink_1SeCxKG1Uxsr0eW48xMnLmee";

export type CoachingPlanId = "weekly" | "monthly" | "quarterly";

export interface CoachingPlan {
  id: CoachingPlanId;
  url: string;
  trialDays: number;
  amount: number;
  currency: string;
  interval: string;
  intervalCount: number;
}

function configuredLinks(): { id: CoachingPlanId; link: string }[] {
  const pairs = (process.env.COACHING_PAYMENT_LINKS ?? "")
    .split(",")
    .map((pair) => pair.trim().split("="))
    .filter(([id, link]) => ["weekly", "monthly", "quarterly"].includes(id) && link);
  return pairs.length
    ? pairs.map(([id, link]) => ({ id: id as CoachingPlanId, link }))
    : [{ id: "monthly", link: LEGACY_LINK }];
}

async function readPlan(
  stripe: Stripe,
  user: User,
  id: CoachingPlanId,
  linkId: string
): Promise<CoachingPlan | null> {
  const link = await stripe.paymentLinks.retrieve(linkId, { expand: ["line_items"] });
  const price = link.line_items?.data[0]?.price;
  if (!link.active || !price?.unit_amount || !price.recurring) return null;
  const url = new URL(link.url);
  url.searchParams.set("client_reference_id", user.id);
  return {
    id,
    url: url.toString(),
    trialDays: link.subscription_data?.trial_period_days ?? 0,
    amount: price.unit_amount,
    currency: price.currency,
    interval: price.recurring.interval,
    intervalCount: price.recurring.interval_count,
  };
}

export async function coachingOffer(user: User) {
  const stripe = new Stripe(process.env.STRIPE_API_KEY!);
  const plans = (
    await Promise.all(configuredLinks().map(({ id, link }) => readPlan(stripe, user, id, link)))
  ).filter((plan): plan is CoachingPlan => !!plan);
  if (!plans.length)
    throw new Error("Coaching checkout is unavailable. You can start tracking now.");
  // Top-level fields are the first plan, for app builds that only know one plan.
  return { ...plans[0], plans };
}
