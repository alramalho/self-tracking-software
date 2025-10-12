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

// Helper function to determine user plan from product ID
function getUserPlan(productId: string, event: any): string {
  if (productId === STRIPE_PLUS_PRODUCT_ID) {
    return "PLUS";
  } else {
    logger.error(`Unknown product id ${productId}`);
    logger.error(`Full event:`, event);

    // Send Telegram notification
    telegramService.sendMessage(
      `🚨 **Unknown product id ${productId}**\n\n` +
        `**UTC Time:** ${new Date().toISOString()}\n` +
        `**Check logs for full event**`
    );

    return "FREE";
  }
}

// Stripe webhook endpoint (requires raw body middleware)
router.post(
  "/webhook",
  async (req: Request, res: Response): Promise<Response | void> => {
    const sig = req.headers["stripe-signature"] as string;

    // For webhook verification, we need the raw body as a Buffer
    // This assumes raw body middleware is set up for this route
    const payload = req.body;

    let event: Stripe.Event;

    try {
      console.log({ payload, sig, STRIPE_WEBHOOK_SECRET });
      // Verify webhook signature
      if (Buffer.isBuffer(payload)) {
        event = stripe.webhooks.constructEvent(
          payload,
          sig,
          STRIPE_WEBHOOK_SECRET
        );
      } else {
        // Fallback for string
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

    try {
      logger.info(`Processing Stripe event: ${event.type}`);

      let subscription: Stripe.Subscription;

      // Handle different event types
      switch (event.type) {
        case "customer.subscription.deleted":
        case "customer.subscription.updated":
        case "customer.subscription.paused":
        case "customer.subscription.resumed":
        case "customer.subscription.trial_will_end":
        case "customer.subscription.created":
          subscription = await stripe.subscriptions.retrieve(
            (event.data.object as Stripe.Subscription).id,
            { expand: ["customer"] }
          );

          if (
            event.type === "customer.subscription.deleted" ||
            event.type === "customer.subscription.paused"
          ) {
            const customer = subscription.customer as Stripe.Customer;
            const userEmail = customer.email;

            if (!userEmail) {
              logger.error(
                "No user email found in customer data when downgrading user"
              );
              return res.status(400).json({
                error: "No customer email found when downgrading user",
              });
            }

            await prisma.user.update({
              where: { email: userEmail as string },
              data: {
                planType: "FREE",
                stripeCustomerId: customer.id,
                stripeSubscriptionId: subscription.id,
                stripeSubscriptionStatus: subscription.status,
              },
            });
          }
          break;

        case "payment_intent.succeeded":
          const paymentIntent = event.data.object as Stripe.PaymentIntent;

          // For payment intents, we need to find the related subscription
          // This is a simplified approach - in production you might want to store
          // the subscription ID in payment intent metadata
          try {
            // Get all active subscriptions for this customer and find the matching one
            if (paymentIntent.customer) {
              const subscriptions = await stripe.subscriptions.list({
                customer: paymentIntent.customer as string,
                status: "active",
                limit: 10,
              });

              if (subscriptions.data.length > 0) {
                subscription = await stripe.subscriptions.retrieve(
                  subscriptions.data[0].id,
                  { expand: ["customer"] }
                );

                // Send Telegram notification for successful payment
                const customer = subscription.customer as Stripe.Customer;
                const amount = paymentIntent.amount / 100; // Convert cents to dollars
                const currency = paymentIntent.currency.toUpperCase();
                telegramService.sendMessage(
                  `💰 User ${customer.email} paid ${amount} ${currency}.`
                );
              } else {
                logger.error("No active subscription found for payment intent");
                return res.status(400).json({ error: "No subscription found" });
              }
            } else {
              logger.error("No customer found in payment intent");
              return res.status(400).json({ error: "No customer found" });
            }
          } catch (subscriptionError) {
            logger.error(
              "Error retrieving subscription for payment intent:",
              subscriptionError
            );
            return res
              .status(400)
              .json({ error: "Error processing payment intent" });
          }
          break;

        default:
          logger.error(`Unhandled event type: ${event.type}`);
          return res
            .status(400)
            .json({ error: `Unhandled event type: ${event.type}` });
      }

      // Extract user information
      const customer = subscription.customer as Stripe.Customer;
      const userEmail = customer.email;

      if (!userEmail) {
        logger.error("No email found in customer data");
        return res.status(400).json({ error: "No customer email found" });
      }

      logger.info(`Processing webhook for user email: ${userEmail}`);

      // Extract product information first
      const productId = subscription.items.data[0]?.price?.product as string;

      // Find user by email
      const user = await prisma.user.findUnique({
        where: { email: userEmail },
      });

      if (!user) {
        logger.error(`User not found for email: ${userEmail}`);

        // Send Telegram notification
        telegramService.sendMessage(
          `🚨 **UNEXISTENT USER triggered ${event.type} on product '${productId}'**\n\n` +
            `**UTC Time:** ${new Date().toISOString()}\n` +
            `**Email:** ${userEmail}\n` +
            `**Check logs for full event**`
        );

        return res.status(404).json({ error: "User not found" });
      }
      const planType = getUserPlan(productId, event);

      // Update user with Stripe information
      await prisma.user.update({
        where: { id: user.id },
        data: {
          planType: planType as any, // Cast to match enum
          stripeCustomerId: customer.id,
          stripeSubscriptionId: subscription.id,
          stripeSubscriptionStatus: subscription.status,
        },
      });

      // Handle subscription created event (welcome email)
      if (event.type === "customer.subscription.created") {
        logger.info(`New subscription created for user: ${user.email}`);

        // Send plus upgrade event to Loops
        try {
          await loopsService.sendPlusUpgradeEvent(user.email, user.id);
          logger.info(`Sent plus_upgrade event to Loops for ${user.email}`);
        } catch (loopsError) {
          logger.error("Failed to send Loops event:", loopsError);
        }

        // Send Telegram notification for new subscription
        telegramService.sendMessage(
          `🎉 **New PLUS subscription created!**\n\n` +
            `**User:** ${user.email}\n` +
            `**Plan:** ${planType}\n` +
            `**UTC Time:** ${new Date().toISOString()}`
        );
      }

      logger.info(
        `Successfully processed ${event.type} for user: ${user.email}`
      );
      logger.info(`Updated user plan to: ${planType}`);
      logger.info(`Subscription status: ${subscription.status}`);

      res.json({ success: true });
    } catch (error) {
      logger.error("Error processing Stripe webhook:", error);

      // Send Telegram error notification
      telegramService.sendMessage(
        `🚨 **Something went terribly wrong at checkout**\n\n` +
          `**UTC Time:** ${new Date().toISOString()}\n` +
          `**Check logs for traceback**`
      );

      res.status(500).json({ success: false, error: "Internal server error" });
    }
  }
);

export const stripeRouter: Router = router;
export default stripeRouter;
