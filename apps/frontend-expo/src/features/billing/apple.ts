import { useEffect } from "react";
import { Platform } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import {
  ErrorCode,
  fetchProducts,
  finishTransaction,
  getAvailablePurchases,
  getUserFriendlyErrorMessage,
  initConnection,
  isEligibleForIntroOfferIOS,
  isUserCancelledError,
  purchaseUpdatedListener,
  requestPurchase,
  restorePurchases,
  type ProductSubscriptionIOS,
  type Purchase,
} from "expo-iap";
import { api } from "@/data/api";
import type { User } from "@/core/types";
import type { CoachingPlan } from "@/features/onboarding/types";

// In the iOS app coaching is sold through Apple in-app purchase (App Store Guideline 3.1.1);
// web keeps Stripe. The server checks every purchase with Apple (backend routes/appleBilling.ts).
export const appleBilling = Platform.OS === "ios";
export const APPLE_SUBSCRIPTIONS_URL = "itms-apps://apps.apple.com/account/subscriptions";

/** Coaching bought in the iOS app and still renewing (Apple, not Stripe, manages it). */
export const hasAppleSubscription = (user?: User) =>
  appleBilling &&
  (user?.appleSubscriptionStatus === "active" || user?.appleSubscriptionStatus === "grace") &&
  !["active", "trialing"].includes(user?.stripeSubscriptionStatus ?? "");

// The "tracking.so Coaching" subscription group in App Store Connect, in paywall order.
const PLAN_IDS: Record<string, CoachingPlan["id"]> = {
  "so.tracking.app.quarterly": "quarterly",
  "so.tracking.app.monthly": "monthly",
  "so.tracking.app.weekly": "weekly",
};
const DAYS: Record<string, number> = { day: 1, week: 7, month: 30, year: 365 };

let connection: Promise<unknown> | undefined;
const connect = () =>
  (connection ??= initConnection().catch((error) => {
    connection = undefined;
    throw error;
  }));

/** The plans with the App Store's local prices, and the free trial only while this Apple ID can still get it. */
export async function loadApplePlans(): Promise<CoachingPlan[]> {
  await connect();
  const products = ((await fetchProducts({ skus: Object.keys(PLAN_IDS), type: "subs" })) ??
    []) as ProductSubscriptionIOS[];
  const group = products[0]?.subscriptionGroupIdIOS;
  const trialAllowed = group ? await isEligibleForIntroOfferIOS(group) : false;
  const plans = Object.keys(PLAN_IDS).flatMap((productId): CoachingPlan[] => {
    const product = products.find((item) => item.id === productId);
    if (!product) return [];
    const trial = product.subscriptionOffers?.find(
      (offer) => offer.type === "introductory" && offer.paymentMode === "free-trial",
    );
    return [
      {
        id: PLAN_IDS[productId],
        productId,
        amount: Math.round((product.price ?? 0) * 100),
        currency: product.currency,
        displayPrice: product.displayPrice,
        interval: product.subscriptionPeriodUnitIOS ?? "month",
        intervalCount: Number(product.subscriptionPeriodNumberIOS) || 1,
        trialDays:
          trialAllowed && trial?.period
            ? (DAYS[trial.period.unit] ?? 0) * trial.period.value * (trial.periodCount || 1)
            : 0,
      },
    ];
  });
  if (!plans.length) throw new Error("Couldn’t load the plans from the App Store. Check your connection and try again.");
  return plans;
}

// The server checks the purchases with Apple and turns coaching on; then StoreKit can let them go.
// A purchase the server turns down stays unfinished, so StoreKit offers it again on the next launch.
async function sendToServer(purchases: Purchase[]) {
  const ours = purchases.filter((purchase) => purchase.productId in PLAN_IDS && purchase.purchaseToken);
  if (!ours.length) return undefined;
  const user = (
    await api.post<User>("/billing/apple/transactions", {
      signedTransactions: ours.map((purchase) => purchase.purchaseToken),
    })
  ).data;
  for (const purchase of ours) await finishTransaction({ purchase, isConsumable: false });
  return user;
}

// While the paywall is buying, it sends its own purchase; the update listener leaves it alone.
let buying = false;

/** Buys the plan with StoreKit and waits for the server to turn coaching on. */
export async function buyApplePlan(productId: string): Promise<"purchased" | "cancelled" | "pending"> {
  await connect();
  // Ties the App Store subscription to this account (appAccountToken on every transaction).
  const { appAccountToken } = (await api.get<{ appAccountToken: string }>("/billing/apple/account-token")).data;
  buying = true;
  try {
    let purchase: Purchase | undefined;
    try {
      const result = await requestPurchase({ type: "subs", request: { apple: { sku: productId, appAccountToken } } });
      purchase = (Array.isArray(result) ? result[0] : result) ?? undefined;
    } catch (error) {
      if (isUserCancelledError(error)) return "cancelled";
      const code = (error as { code?: string }).code;
      if (code === ErrorCode.Pending || code === ErrorCode.DeferredPayment) return "pending";
      throw new Error(getUserFriendlyErrorMessage(error as { code?: string }));
    }
    // Ask to Buy and other approvals: the update listener sends it once it goes through.
    if (!purchase || purchase.purchaseState === "pending") return "pending";
    const user = await sendToServer([purchase]);
    if (!user || user.planType === "FREE")
      throw new Error("Your purchase went through, but coaching isn’t on yet. Tap Restore in a moment.");
    return "purchased";
  } finally {
    buying = false;
  }
}

/** Restore: sends this Apple ID's App Store subscriptions to the server. Returns false when there are none. */
export async function restoreApplePurchases() {
  await connect();
  await restorePurchases();
  const purchases = await getAvailablePurchases({ onlyIncludeActiveItemsIOS: true });
  return !!(await sendToServer(purchases));
}

/** Renewals, Ask to Buy approvals and purchases that couldn't reach the server before reach it here. */
export function useAppleTransactionUpdates() {
  const client = useQueryClient();
  useEffect(() => {
    if (!appleBilling) return;
    const subscription = purchaseUpdatedListener((purchase) => {
      if (buying) return;
      sendToServer([purchase])
        .then((user) => user && client.invalidateQueries({ queryKey: ["current-user"] }))
        .catch(() => {});
    });
    // Connecting starts StoreKit's transaction updates, including unfinished ones from earlier.
    connect().catch(() => {});
    return () => subscription.remove();
  }, [client]);
}
