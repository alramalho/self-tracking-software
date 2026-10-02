# RevenueCat plan: Apple in-app purchase for coaching (review finding #1)

Status (September 30, 2026): **plan only. Nothing is implemented or configured.** No Stripe, App Store Connect or RevenueCat setting was changed. The open decisions at the end block implementation. Prices and trials are not proposed here; they stay the owner's call ([product decisions](app-store-product-decisions.md)).

## Where billing stands today

| Piece | Location | Behaviour |
| --- | --- | --- |
| Offer | `apps/backend-node/src/services/follow-through/onboarding/billing.ts` | Reads the live Stripe Payment Link (`ONBOARDING_PAYMENT_LINK_ID`) and returns its URL with `client_reference_id=<user.id>`, plus trial, amount and interval read from Stripe. |
| Native checkout | `apps/frontend-expo/src/features/onboarding/Onboarding.tsx` | Opens that URL in a browser, then polls `/users/user` until `planType` is no longer `FREE`. |
| Entitlement | `User.planType` (`FREE` / `PLUS`), plus `stripeCustomerId`, `stripeSubscriptionId`, `stripeSubscriptionStatus` | Only `apps/backend-node/src/routes/stripe.ts` writes it. `checkout.session.completed` links the customer to the user. `customer.subscription.*` sets `PLUS` or `FREE`. |
| Gates | `planType === "PLUS"` / `!== "FREE"` in `plans.ts`, `activities.ts`, `ai.ts`, `mcp.ts`, `plansService.ts`, coach assessment/monitoring, and several Expo screens | Everything reads the one column. |
| Manage | `apps/frontend-expo/src/app/settings.tsx` | A fixed Stripe billing-portal login link. |
| Deletion | `apps/backend-node/src/routes/users.ts` | Cancels the Stripe subscription. Failures are swallowed (review finding #4). |

What breaks when a second store arrives: `stripe.ts` writes `FREE` on `customer.subscription.deleted`. That would downgrade someone who still has an active Apple subscription. The entitlement has to be worked out from every source, not overwritten by whichever webhook arrives last.

## Target design

```
 iPhone app ──StoreKit──▶ Apple ──server notifications──▶ RevenueCat ──webhook──▶ backend-node
 Web app ──Payment Link──▶ Stripe ──webhook──▶ backend-node ──POST /v1/receipts──▶ RevenueCat
                                                     │
                                  User.planType (derived) ◀── one entitlement: "coaching"
```

1. **One identity.** The RevenueCat App User ID is the database `User.id`. That is the same id used for Stripe's `client_reference_id` and for PostHog `identify`. The app calls `Purchases.logIn(user.id)` after sign-in and `Purchases.logOut()` on sign-out. Purchases are only offered to signed-in users (the app already requires sign-in), so there are no anonymous purchasers to merge later.
2. **One entitlement.** Create a RevenueCat entitlement, for example `coaching`, and attach both the App Store product(s) and the Stripe product (`STRIPE_PLUS_PRODUCT_ID`) to it. An active `coaching` entitlement means `planType = PLUS`.
3. **Stripe into RevenueCat.** RevenueCat has no Stripe "restore". Our existing Stripe webhook already knows the user, so on `customer.subscription.created` it also sends `POST https://api.revenuecat.com/v1/receipts` with `X-Platform: stripe`, `fetch_token=<sub_…>` and `app_user_id=<user.id>`. After that, RevenueCat refreshes the subscription itself; cancellations can take up to about 2 hours to show there. A one-off, dry-run-first script backfills today's active Stripe subscribers the same way. RevenueCat's own Stripe server notifications with "track new purchases" are an alternative, but they need the app user id in Checkout Session or Subscription metadata. A shared Payment Link cannot set that per user, so the explicit receipt post is simpler.
4. **The server stays the authority.** Backend gates (the coach scheduler, MCP, plan limits) keep reading `planType`. A new additive table records each source separately:

   ```prisma
   model BillingEntitlement {
     id          String   @id @default(cuid())
     userId      String
     source      String   // "stripe" | "app_store"
     externalId  String   @unique // Stripe sub_… or Apple original_transaction_id
     status      String   // active | grace | billing_issue | expired | cancelled
     expiresAt   DateTime?
     updatedAt   DateTime @updatedAt
     user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
     @@index([userId])
   }
   ```

   `resolvePlanType(entitlements)` returns `PLUS` if any row is active or in grace, and `FREE` otherwise. Both webhook handlers write their row and then recompute `planType`. They never set `planType` directly. This is additive: existing columns stay, and the backfill writes one Stripe row per active subscription.
5. **RevenueCat webhook** (`POST /revenuecat/webhook`, new file `apps/backend-node/src/routes/revenuecat.ts`, logic in `src/services/billing/`):
   - Check the configured `Authorization` header (and the `X-RevenueCat-Webhook-Signature` HMAC if it is enabled). Reply 200 quickly. RevenueCat retries non-200 responses up to 5 times, over about 2.5 hours.
   - Make it idempotent on the event `id`.
   - Don't trust the event body for state. Following RevenueCat's advice, call `GET /v1/subscribers/{app_user_id}` and upsert `BillingEntitlement` rows from `subscriber.entitlements.coaching` and `subscriptions`.
   - Ignore `environment: SANDBOX` in production, except for an allow-list of review and test accounts.
   - `TRANSFER` events: recompute both users named in `transferred_from` and `transferred_to`.
   - Send the existing Telegram alerts and Loops `plus_upgrade` for new App Store subscriptions, matching the Stripe path.
6. **Immediate sync.** A `POST /billing/sync` endpoint runs the same `GET /subscribers` → upsert → recompute. The app calls it right after a purchase or restore, so the user never waits for the webhook. The existing onboarding poll of `/users/user` then succeeds straight away.

## Client (Expo)

- Dependency: `react-native-purchases` (10.10.x at the time of writing, native, so a new local build is needed). Optionally add `react-native-purchases-ui` if we use RevenueCat's hosted paywall. The house paywall principles (real social proof, the best plan preselected, a Terms · Restore · Privacy footer) favour our own UI fed by `Purchases.getOfferings()`.
- New folder `src/features/billing/`: `purchases.ts` (configure, logIn/logOut, purchase, restore, manage), `useCoachingAccess.ts` (server `planType` plus billing source), `types.ts`. Configure it once with `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`. With no key the paywall keeps today's behaviour, so development and E2E builds still work.
- The paywall shows localized StoreKit price and intro-offer text from the product. It never hard-codes a price.
- Analytics: `purchase-started` / `purchase-completed` use `store: "app-store"`. Those events already exist in `src/analytics/types.ts`.

## Restore and manage subscription

- **Restore Purchases** goes in the paywall footer and in Settings → Subscription. It calls `Purchases.restorePurchases()`, then `POST /billing/sync`, then refetches `/users/user`. Set RevenueCat's restore behaviour to **"Keep with original App User ID"**. Otherwise one Apple ID could move coaching between tracking.so accounts, and a restore on a second account would silently downgrade the first. The app shows "This Apple ID's subscription belongs to another tracking.so account".
- **Manage**: `/users/user` returns `billingSource` (`app_store` | `stripe` | null).
  - `app_store`: call `Purchases.showManageSubscriptions()`, which opens Apple's sheet.
  - `stripe`: open a Stripe Customer Portal session created on the server for that customer. This replaces the fixed link in `settings.tsx`.
- **Account deletion** (fixes finding #4 at the same time): cancel Stripe with a retry and an honest failure state. An Apple subscription cannot be cancelled by us, so the deletion screen tells the user to cancel it in Apple settings first and offers the manage sheet. Then `DELETE /v1/subscribers/{id}` in RevenueCat.

## Duplicate-subscription protection

| Case | Guard |
| --- | --- |
| Web subscriber opens the iOS paywall | The paywall checks server `planType` first. If `PLUS`, it shows "Coaching is active (web)" plus Manage, and no purchase button. The onboarding flow already re-checks the account before checkout. Keep that check before `purchasePackage`. |
| Apple subscriber opens web checkout | `/follow-through/onboarding/offer` and the web upgrade popover refuse when an active `app_store` entitlement exists, and point to Apple subscription settings. |
| The same Apple ID on two tracking.so accounts | "Keep with original App User ID" restore behaviour, plus the message above. |
| A race leaves both stores active | `resolvePlanType` still gives `PLUS`. A Telegram alert asks for a manual refund of the newer one. We never auto-cancel. |
| Upgrade or downgrade within Apple | Put all coaching products in one App Store subscription group, so Apple handles changes and never double-bills. |

## Storefront branching

- Read `Purchases.getStorefront()` (StoreKit's `Storefront.countryCode`).
- **Default: Apple in-app purchase in every storefront.** This is the only option safe worldwide, and it matches the recorded direction ("Add Apple in-app subscriptions for coaching").
- An optional, server-configured allow-list (`BILLING_EXTERNAL_LINK_STOREFRONTS`, empty by default) could also show the web checkout link where Apple's rules currently allow it, such as the US storefront. That is the owner's decision, and the current guideline text must be re-checked at submission time. EU alternative terms (the DMA entitlement) are out of scope.
- Web users are unaffected: web keeps Stripe.

## Configuration and manual steps (owner)

1. App Store Connect: active Paid Apps Agreement with tax and banking. Create a subscription group and product(s) at the chosen price and trial, with localizations and a review screenshot. Create an In-App Purchase key for RevenueCat. Point App Store Server Notifications (V2) at RevenueCat.
2. RevenueCat: create a project with an iOS app (bundle `so.tracking.app`) and a Stripe app. Add the `coaching` entitlement, a `default` offering, the webhook URL and an auth header. Set restore behaviour to Keep with original App User ID.
3. Environment placeholders (values set by the owner, never committed):
   - Expo: `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`
   - Backend: `REVENUECAT_SECRET_API_KEY`, `REVENUECAT_STRIPE_PUBLIC_API_KEY`, `REVENUECAT_WEBHOOK_AUTH`, `REVENUECAT_ENTITLEMENT_ID=coaching`, `BILLING_EXTERNAL_LINK_STOREFRONTS=`
4. Backend deploy with the additive migration: back up first, run a health check, and write down the rollback. Then run the Stripe backfill dry run, then the real backfill.
5. Local production build, sandbox purchase, restore and cancel on a physical device. Then TestFlight. No Expo cloud build, no OTA.

## Delivery order once unblocked

1. Backend: `BillingEntitlement` migration, `resolvePlanType`, Stripe handler writes its row, RevenueCat webhook, `/billing/sync`, `billingSource`. Unit tests for the resolver and the webhook mapping.
2. Stripe → RevenueCat receipt post and backfill script (dry run by default).
3. Expo: billing feature folder, paywall on StoreKit offerings, restore and manage, storefront check. Screenshots in light and dark.
4. Web: refuse checkout for App Store subscribers, portal session for Stripe.
5. Deletion hardening (finding #4).

## Decisions needed before implementation

1. **Apple price and trial**: match the current Stripe offer, or set different terms? Monthly only, or annual too?
2. **Stripe in RevenueCat**: attach Stripe subscriptions to RevenueCat (recommended, one entitlement ledger and unified revenue charts), or keep Stripe out and merge only on our server?
3. **Storefront**: in-app purchase only everywhere (recommended to start), or also the US external link?
4. **Restore behaviour**: confirm "Keep with original App User ID".
5. **Accounts**: who creates the RevenueCat project and the App Store Connect products, and when a backend deploy with an additive migration is acceptable.

Sources: [RevenueCat webhooks](https://www.revenuecat.com/docs/integrations/webhooks), [RevenueCat: track external Stripe purchases](https://www.revenuecat.com/docs/web/integrations/stripe/track-external-purchases), [RevenueCat Stripe integration](https://www.revenuecat.com/docs/web/integrations/stripe), [App Review Guidelines 3.1](https://developer.apple.com/app-store/review/guidelines/#in-app-purchase).
