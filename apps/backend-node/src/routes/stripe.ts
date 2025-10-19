import { Request, Response, Router } from "express";
import Stripe from "stripe";
import { loopsService } from "../services/loopsService";
import { TelegramService } from "../services/telegramService";
import { logger } from "../utils/logger";
import { prisma } from "../utils/prisma";

const router = Router();

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_API_KEY!, {
  apiVersion: "2025-07-30.basil", // Use the supported API version
});

if (!process.env.STRIPE_WEBHOOK_SECRET || !process.env.STRIPE_API_KEY) {
  throw new Error("STRIPE_WEBHOOK_SECRET is not set");
}

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET!;
const STRIPE_PLUS_PRODUCT_ID = process.env.STRIPE_PLUS_PRODUCT_ID!;
const telegramService = new TelegramService();

// Helper: Determine user plan from product ID
function getUserPlanFromProduct(productId: string): "PLUS" | "FREE" {
  if (productId === STRIPE_PLUS_PRODUCT_ID) {
    return "PLUS";
  }

  logger.error(`Unknown product id: ${productId}`);
  telegramService.sendMessage(
    `🚨 Unknown product id ${productId}\n\n` +
      `UTC Time: ${new Date().toISOString()}\n` +
      `Check logs for full event`
  );

  return "FREE";
}

// Helper: Find user by Stripe customer ID
async function findUserByCustomerId(customerId: string) {
  const user = await prisma.user.findUnique({
    where: { stripeCustomerId: customerId },
  });

  if (!user) {
    logger.error(`User not found for Stripe customer ID: ${customerId}`);
    telegramService.sendMessage(
      `🚨 **User not found for customer ID ${customerId}**\n\n` +
        `UTC Time: ${new Date().toISOString()}`
    );
  }

  return user;
}

// Helper: Update user subscription data
async function updateUserSubscription(
  customerId: string,
  subscription: Stripe.Subscription,
  planType: "PLUS" | "FREE"
) {
  const user = await findUserByCustomerId(customerId);
  if (!user) return null;

  return await prisma.user.update({
    where: { id: user.id },
    data: {
      planType,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      stripeSubscriptionStatus: subscription.status,
    },
  });
}

// Handler: Subscription events (user data updates)
async function handleSubscriptionEvent(
  event: Stripe.Event,
  subscription: Stripe.Subscription
): Promise<void> {
  const customer = subscription.customer as Stripe.Customer;
  const productId = subscription.items.data[0]?.price?.product as string;

  // Determine plan type based on subscription status and event
  let planType: "PLUS" | "FREE";
  if (
    event.type === "customer.subscription.deleted" ||
    event.type === "customer.subscription.paused"
  ) {
    planType = "FREE";
  } else {
    planType = getUserPlanFromProduct(productId);
  }

  // Update user subscription data
  const updatedUser = await updateUserSubscription(
    customer.id,
    subscription,
    planType
  );

  if (!updatedUser) {
    throw new Error(`User not found for customer ${customer.id}`);
  }

  logger.info(
    `Subscription ${event.type} processed for user ${updatedUser.email}: plan=${planType}, status=${subscription.status}`
  );

  // Handle new subscription creation
  if (event.type === "customer.subscription.created") {
    try {
      await loopsService.sendPlusUpgradeEvent(
        updatedUser.email,
        updatedUser.id
      );
      logger.info(`Sent plus_upgrade event to Loops for ${updatedUser.email}`);
    } catch (loopsError) {
      logger.error("Failed to send Loops event:", loopsError);
    }

    telegramService.sendMessage(
      `🎉 *New PLUS subscription*!\n\n` +
        `User: ${updatedUser.email}\n` +
        `Plan: ${planType}\n` +
        `UTC Time: ${new Date().toISOString()}`
    );
  }
}

// Handler: Checkout session completed (link customer to user)
async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session
): Promise<void> {
  const clientReferenceId = session.client_reference_id;
  const customerId = session.customer as string;

  if (!clientReferenceId) {
    logger.warn("Checkout session has no client_reference_id");
    return;
  }

  if (!customerId) {
    logger.warn("Checkout session has no customer");
    return;
  }

  // Find user by ID (from client_reference_id)
  const user = await prisma.user.findUnique({
    where: { id: clientReferenceId },
  });

  if (!user) {
    logger.error(`User not found for client_reference_id: ${clientReferenceId}`);
    telegramService.sendMessage(
      `🚨 **User not found for checkout session**\n\n` +
        `Client Reference ID: ${clientReferenceId}\n` +
        `Customer ID: ${customerId}\n` +
        `UTC Time: ${new Date().toISOString()}`
    );
    return;
  }

  // Link Stripe customer to user
  await prisma.user.update({
    where: { id: user.id },
    data: { stripeCustomerId: customerId },
  });

  logger.info(
    `Linked Stripe customer ${customerId} to user ${user.email} (${user.id})`
  );
}

// Handler: Payment events (notifications only)
async function handlePaymentIntent(
  paymentIntent: Stripe.PaymentIntent
): Promise<void> {
  if (!paymentIntent.customer) {
    logger.warn("Payment intent has no customer attached");
    return;
  }

  const user = await findUserByCustomerId(paymentIntent.customer as string);
  if (!user) {
    logger.warn(
      `Payment succeeded for unknown customer: ${paymentIntent.customer}`
    );
    return;
  }

  const amount = paymentIntent.amount / 100;
  const currency = paymentIntent.currency.toUpperCase();

  telegramService.sendMessage(
    `🎉💰 Payment received!\n\n` +
      `User: ${user.email}\n` +
      `Amount: ${amount} ${currency}\n` +
      `UTC Time: ${new Date().toISOString()}`
  );

  logger.info(
    `Payment intent succeeded: ${user.email} paid ${amount} ${currency}`
  );
}

// Stripe webhook endpoint (requires raw body middleware)
router.post(
  "/webhook",
  async (req: Request, res: Response): Promise<Response | void> => {
    const sig = req.headers["stripe-signature"] as string;
    const payload = req.body;

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      if (Buffer.isBuffer(payload)) {
        event = stripe.webhooks.constructEvent(
          payload,
          sig,
          STRIPE_WEBHOOK_SECRET
        );
      } else {
        event = stripe.webhooks.constructEvent(
          payload.toString(),
          sig,
          STRIPE_WEBHOOK_SECRET
        );
      }
    } catch (err: any) {
      logger.error(`Webhook signature verification failed: ${err.message}`);
      return res.status(400).json({ error: `Webhook Error: ${err.message}` });
    }

    // Process event
    try {
      logger.info(`Processing Stripe event: ${event.type}`);

      switch (event.type) {
        // Checkout session completed - link customer to user
        case "checkout.session.completed": {
          const session = event.data.object as Stripe.Checkout.Session;
          await handleCheckoutSessionCompleted(session);
          break;
        }

        // Subscription events - update user data
        case "customer.subscription.created":
        case "customer.subscription.updated":
        case "customer.subscription.deleted":
        case "customer.subscription.paused":
        case "customer.subscription.resumed":
        case "customer.subscription.trial_will_end": {
          const subscription = await stripe.subscriptions.retrieve(
            (event.data.object as Stripe.Subscription).id,
            { expand: ["customer"] }
          );
          await handleSubscriptionEvent(event, subscription);
          break;
        }

        // Payment events - notifications only
        case "payment_intent.succeeded": {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          await handlePaymentIntent(paymentIntent);
          break;
        }

        default:
          logger.warn(`Unhandled event type: ${event.type}`);
          return res.status(200).json({ received: true });
      }

      return res.json({ success: true });
    } catch (error) {
      logger.error(`Error processing webhook ${event.type}:`, error);

      telegramService.sendMessage(
        `🚨 *Webhook processing failed*\n\n` +
          `Event: ${event.type}\n` +
          `UTC Time: ${new Date().toISOString()}\n` +
          `Check logs for details`
      );

      return res
        .status(500)
        .json({ success: false, error: "Internal server error" });
    }
  }
);

export const stripeRouter: Router = router;
export default stripeRouter;
