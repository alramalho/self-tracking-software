// Coaching bought in the iOS app through Apple in-app purchase (App Store Guideline 3.1.1).
// The app buys with StoreKit 2 and sends us the signed transaction; Apple also tells us about
// renewals, expiries and refunds through App Store Server Notifications V2.
// Web keeps paying through Stripe (routes/stripe.ts); either one gives planType PLUS.
import { randomUUID } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  Environment,
  JWSTransactionDecodedPayload,
  NotificationTypeV2,
  ResponseBodyV2DecodedPayload,
  SignedDataVerifier,
} from "@apple/app-store-server-library";
import type { User } from "@tsw/prisma";
import { Request, Response, Router } from "express";
import { AuthenticatedRequest, requireAuth } from "../middleware/auth";
import { loopsService } from "../services/loopsService";
import { TelegramService } from "../services/telegramService";
import { logger } from "../utils/logger";
import { prisma } from "../utils/prisma";

const router = Router();
const telegramService = new TelegramService();

const BUNDLE_ID = "so.tracking.app";
const APP_APPLE_ID = 6754610882;
// The "tracking.so Coaching" subscription group in App Store Connect.
export const APPLE_PRODUCT_IDS = [
  "so.tracking.app.quarterly",
  "so.tracking.app.monthly",
  "so.tracking.app.weekly",
];

// "grace" keeps access while Apple retries a failed renewal (billing grace period).
type AppleStatus = "active" | "grace" | "billing_retry" | "expired" | "revoked";

export const hasActiveAppleSubscription = (
  user: Pick<User, "appleSubscriptionStatus" | "appleSubscriptionExpiresAt">
) =>
  (user.appleSubscriptionStatus === "active" || user.appleSubscriptionStatus === "grace") &&
  !!user.appleSubscriptionExpiresAt &&
  user.appleSubscriptionExpiresAt > new Date();

const hasActiveStripeSubscription = (user: Pick<User, "stripeSubscriptionStatus">) =>
  user.stripeSubscriptionStatus === "active" || user.stripeSubscriptionStatus === "trialing";

// Apple's public root certificates, from https://www.apple.com/certificateauthority/ (see certs/apple/README.md).
function appleRootCertificates(): Buffer[] {
  const dir = process.env.APPLE_ROOT_CERTS_DIR || path.join(__dirname, "../../certs/apple");
  const files = existsSync(dir) ? readdirSync(dir).filter((file) => file.endsWith(".cer")) : [];
  if (!files.length)
    throw new Error(`No Apple root certificates (*.cer) in ${dir}. Set APPLE_ROOT_CERTS_DIR or see certs/apple/README.md.`);
  return files.map((file) => readFileSync(path.join(dir, file)));
}

// One verifier per App Store environment. TestFlight and App Review purchases are "Sandbox".
const verifiers = new Map<Environment, SignedDataVerifier>();
function verifier(environment: Environment) {
  if (!verifiers.has(environment)) {
    verifiers.set(
      environment,
      new SignedDataVerifier(
        appleRootCertificates(),
        // Certificate revocation checks call Apple; tests with their own certificates turn them off.
        process.env.APPLE_JWS_ONLINE_CHECKS !== "false",
        environment,
        BUNDLE_ID,
        APP_APPLE_ID
      )
    );
  }
  return verifiers.get(environment)!;
}

// Apple writes the environment into the signed payload; that environment's verifier checks the rest.
function verifierFor(signed: string) {
  const payload = JSON.parse(Buffer.from(signed.split(".")[1] ?? "", "base64url").toString() || "{}");
  const environment = payload.environment ?? payload.data?.environment ?? payload.summary?.environment;
  return verifier(environment === Environment.SANDBOX ? Environment.SANDBOX : Environment.PRODUCTION);
}

function transactionStatus(transaction: JWSTransactionDecodedPayload): AppleStatus {
  if (transaction.revocationDate) return "revoked";
  return (transaction.expiresDate ?? 0) > Date.now() ? "active" : "expired";
}

// Saves the Apple subscription on the user and gives or removes coaching access.
// `downgrade` removes PLUS when Apple access ends, unless Stripe (web) still pays for it.
async function saveSubscription(
  user: User,
  transaction: JWSTransactionDecodedPayload,
  status: AppleStatus,
  { until = transaction.expiresDate, downgrade = false }: { until?: number; downgrade?: boolean } = {}
): Promise<User> {
  // A late or replayed message about an older period never undoes a newer paid one.
  if (
    user.appleOriginalTransactionId === transaction.originalTransactionId &&
    user.appleSubscriptionStatus === "active" &&
    user.appleSubscriptionExpiresAt &&
    user.appleSubscriptionExpiresAt.getTime() > (transaction.expiresDate ?? 0)
  )
    return user;

  const active = status === "active" || status === "grace";
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      planType: active ? "PLUS" : downgrade && !hasActiveStripeSubscription(user) ? "FREE" : user.planType,
      appleOriginalTransactionId: transaction.originalTransactionId,
      appleProductId: transaction.productId,
      appleSubscriptionExpiresAt: new Date(until ?? 0),
      appleSubscriptionStatus: status,
    },
  });
  logger.info(
    `Apple subscription for user ${user.id}: ${transaction.productId} ${status} until ${updated.appleSubscriptionExpiresAt?.toISOString()}, plan=${updated.planType}`
  );

  const isNew =
    active &&
    (user.appleOriginalTransactionId !== transaction.originalTransactionId ||
      user.appleSubscriptionStatus === "expired" ||
      user.appleSubscriptionStatus === "revoked");
  if (isNew) {
    try {
      await loopsService.sendPlusUpgradeEvent(updated.email, updated.id);
    } catch (loopsError) {
      logger.error("Failed to send Loops event:", loopsError);
    }
    telegramService.sendAlert(
      `🎉 *New PLUS subscription (Apple)*!\n\n` +
        `User: ${updated.email}\n` +
        `Product: ${transaction.productId}\n` +
        `Environment: ${transaction.environment}\n` +
        `UTC Time: ${new Date().toISOString()}`
    );
  }
  return updated;
}

// The UUID the app passes to StoreKit as appAccountToken, so Apple's transactions name this user.
router.get(
  "/account-token",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response): Promise<Response | void> => {
    try {
      const id = req.user!.id;
      // Only fills an empty token, so two requests at once still agree on one.
      await prisma.user.updateMany({
        where: { id, appleAppAccountToken: null },
        data: { appleAppAccountToken: randomUUID() },
      });
      const { appleAppAccountToken } = await prisma.user.findUniqueOrThrow({
        where: { id },
        select: { appleAppAccountToken: true },
      });
      res.json({ appAccountToken: appleAppAccountToken });
    } catch (error) {
      logger.error("Error creating Apple account token:", error);
      res.status(500).json({ error: "Failed to create account token" });
    }
  }
);

// The app sends the signed transactions (JWS) from a purchase, a restore or a background update.
router.post(
  "/transactions",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response): Promise<Response | void> => {
    const signedTransactions = req.body?.signedTransactions;
    if (
      !Array.isArray(signedTransactions) ||
      !signedTransactions.length ||
      signedTransactions.length > 20 ||
      !signedTransactions.every((jws) => typeof jws === "string")
    )
      return res.status(400).json({ error: "signedTransactions must be a list of signed transactions" });

    try {
      const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
      const transactions: JWSTransactionDecodedPayload[] = [];
      for (const jws of signedTransactions) {
        let transaction: JWSTransactionDecodedPayload;
        try {
          transaction = await verifierFor(jws).verifyAndDecodeTransaction(jws);
        } catch (error) {
          logger.warn(`Rejected an Apple transaction for user ${user.id}:`, error);
          return res.status(400).json({ error: "This purchase could not be verified with Apple." });
        }
        if (!transaction.originalTransactionId || !APPLE_PRODUCT_IDS.includes(transaction.productId ?? ""))
          return res.status(400).json({ error: `Unknown product: ${transaction.productId}` });

        // Ours when we already linked it to this user, or when it was bought with this user's token.
        const owner = await prisma.user.findUnique({
          where: { appleOriginalTransactionId: transaction.originalTransactionId },
        });
        const mine = owner
          ? owner.id === user.id
          : !!transaction.appAccountToken && transaction.appAccountToken === user.appleAppAccountToken;
        if (!mine) {
          logger.warn(`Apple subscription ${transaction.originalTransactionId} is not user ${user.id}'s`);
          return res.status(403).json({
            error: "This App Store subscription belongs to another tracking.so account.",
          });
        }
        transactions.push(transaction);
      }

      // The period that ends last is the one that counts.
      const latest = transactions.sort((a, b) => (b.expiresDate ?? 0) - (a.expiresDate ?? 0))[0];
      res.json(await saveSubscription(user, latest, transactionStatus(latest)));
    } catch (error) {
      logger.error("Error saving Apple transactions:", error);
      res.status(500).json({ error: "Failed to save the purchase" });
    }
  }
);

async function handleNotification({ notificationType, subtype, data }: ResponseBodyV2DecodedPayload) {
  logger.info(`Apple notification ${notificationType}${subtype ? `/${subtype}` : ""} (${data?.environment})`);
  // TEST and summary notifications carry no transaction.
  if (!data?.signedTransactionInfo) return;
  const transaction = await verifierFor(data.signedTransactionInfo).verifyAndDecodeTransaction(data.signedTransactionInfo);
  if (!transaction.originalTransactionId || !APPLE_PRODUCT_IDS.includes(transaction.productId ?? "")) {
    logger.warn(`Apple notification for unknown product ${transaction.productId}`);
    return;
  }

  const user =
    (await prisma.user.findUnique({
      where: { appleOriginalTransactionId: transaction.originalTransactionId },
    })) ||
    (transaction.appAccountToken
      ? await prisma.user.findUnique({ where: { appleAppAccountToken: transaction.appAccountToken } })
      : null);
  if (!user) {
    logger.warn(`No user for Apple subscription ${transaction.originalTransactionId}`);
    return;
  }

  switch (notificationType) {
    case NotificationTypeV2.SUBSCRIBED:
    case NotificationTypeV2.DID_RENEW:
    case NotificationTypeV2.OFFER_REDEEMED:
    case NotificationTypeV2.RENEWAL_EXTENDED:
    case NotificationTypeV2.REFUND_REVERSED:
      await saveSubscription(user, transaction, transactionStatus(transaction));
      return;

    case NotificationTypeV2.EXPIRED:
    case NotificationTypeV2.GRACE_PERIOD_EXPIRED:
    case NotificationTypeV2.REVOKE:
    case NotificationTypeV2.REFUND:
      await saveSubscription(user, transaction, transaction.revocationDate ? "revoked" : "expired", {
        downgrade: true,
      });
      return;

    case NotificationTypeV2.DID_FAIL_TO_RENEW: {
      // With a billing grace period, access continues until Apple gives up.
      const renewal = data.signedRenewalInfo
        ? await verifierFor(data.signedRenewalInfo).verifyAndDecodeRenewalInfo(data.signedRenewalInfo)
        : undefined;
      const graceUntil = renewal?.gracePeriodExpiresDate ?? 0;
      if (graceUntil > Date.now())
        await saveSubscription(user, transaction, "grace", { until: graceUntil });
      else await saveSubscription(user, transaction, "billing_retry", { downgrade: true });
      return;
    }

    default:
      // DID_CHANGE_RENEWAL_STATUS, DID_CHANGE_RENEWAL_PREF, PRICE_INCREASE…: nothing changes access,
      // only keep the current period and product up to date.
      if (transactionStatus(transaction) === "active")
        await saveSubscription(user, transaction, "active");
  }
}

// App Store Server Notifications V2. Set this URL in App Store Connect for Production and Sandbox.
router.post("/notifications", async (req: Request, res: Response): Promise<Response | void> => {
  const signedPayload = req.body?.signedPayload;
  if (typeof signedPayload !== "string") return res.status(400).json({ error: "signedPayload is required" });

  let notification: ResponseBodyV2DecodedPayload;
  try {
    notification = await verifierFor(signedPayload).verifyAndDecodeNotification(signedPayload);
  } catch (error) {
    logger.error("Apple notification verification failed:", error);
    return res.status(400).json({ error: "Invalid notification" });
  }

  try {
    await handleNotification(notification);
  } catch (error) {
    logger.error(`Error processing Apple notification ${notification.notificationType}:`, error);
    telegramService.sendAlert(
      `🚨 *Apple notification processing failed*\n\n` +
        `Type: ${notification.notificationType}\n` +
        `UTC Time: ${new Date().toISOString()}\n` +
        `Check logs for details`
    );
  }
  // Verified: always 200, so Apple doesn't retry something we can't fix by retrying.
  res.json({ received: true });
});

export const appleBillingRouter: Router = router;
export default appleBillingRouter;
