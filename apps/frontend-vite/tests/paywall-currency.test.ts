import assert from "node:assert/strict";
import { test } from "node:test";
import { buyersCurrency, inBuyersCurrency, money } from "../src/components/onboarding/paywall/plans.ts";
import type { CoachingPlan } from "../src/components/onboarding/types.ts";

const quarterly: CoachingPlan = {
  id: "quarterly",
  trialDays: 7,
  amount: 2699,
  currency: "eur",
  amounts: { eur: 2699, usd: 2699 },
  interval: "month",
  intervalCount: 3,
};

test("US time zones see dollars, everyone else the price's own euros", () => {
  assert.equal(buyersCurrency("America/Los_Angeles"), "usd");
  assert.equal(buyersCurrency("America/Indiana/Indianapolis"), "usd");
  assert.equal(buyersCurrency("Pacific/Honolulu"), "usd");
  assert.equal(buyersCurrency("Europe/Lisbon"), undefined);
  assert.equal(buyersCurrency("America/Toronto"), undefined);
  assert.equal(money(inBuyersCurrency(quarterly, "usd"), undefined).replace(/\s/g, ""), "$26.99");
  assert.equal(inBuyersCurrency(quarterly, undefined).currency, "eur");
});

test("a price without that currency stays in its own", () => {
  const { amounts: _, ...euroOnly } = quarterly;
  assert.deepEqual(inBuyersCurrency(euroOnly, "usd"), euroOnly);
});
