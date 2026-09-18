import Stripe from "stripe";
import type { User } from "@tsw/prisma";
// Existing production monthly payment link. Read the live offer; never invent trial or price terms.
export async function coachingOffer(user: User) {
  const stripe = new Stripe(process.env.STRIPE_API_KEY!);
  const link = await stripe.paymentLinks.retrieve(
    process.env.ONBOARDING_PAYMENT_LINK_ID || "plink_1SeCxKG1Uxsr0eW48xMnLmee",
    { expand: ["line_items"] },
  );
  const price = link.line_items?.data[0]?.price;
  if (!link.active || !price?.unit_amount || !price.recurring)
    throw new Error(
      "Coaching checkout is unavailable. You can start tracking now.",
    );
  const url = new URL(link.url);
  url.searchParams.set("client_reference_id", user.id);
  return {
    url: url.toString(),
    trialDays: link.subscription_data?.trial_period_days ?? 0,
    amount: price.unit_amount,
    currency: price.currency,
    interval: price.recurring.interval,
    intervalCount: price.recurring.interval_count,
  };
}
