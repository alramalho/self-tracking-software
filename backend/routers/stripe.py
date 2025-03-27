import time
import traceback
from datetime import UTC, datetime
from typing import Any, Literal
from gateways.users import UsersGateway

import stripe
from entities.user import User
from fastapi import APIRouter, HTTPException, Request
from services.telegram_service import TelegramService
from loguru import logger
import emails.loops as loops
from constants import STRIPE_PLUS_PRODUCT_ID, STRIPE_API_KEY, STRIPE_ENDPOINT_SECRET

router = APIRouter(prefix="/stripe")

stripe.api_key = STRIPE_API_KEY
telegram_service = TelegramService()


def get_user_plan(product_id: str, event: Any):
    plan = None
    if product_id == STRIPE_PLUS_PRODUCT_ID:
        plan = "plus"
    else:
        logger.error(f"Unknown product id {product_id}")
        logger.error(f"Full event: {event}")
        telegram_service.send_message(
            (
                f"🚨 <b>Unknown product id {product_id}</b>\n\n"
                f"<b>UTC Time:</b> {datetime.now(UTC).strftime('%H:%M, %A %B %d, %Y')}\n"
                f"<b>Check logs for full event</b>\n"
            )
        )
        plan = "free"
    return plan


@router.post("/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    headers = dict(request.headers)
    stripe_signature = headers.get("stripe-signature")
    event = None

    try:
        event = stripe.Webhook.construct_event(
            payload, stripe_signature, STRIPE_ENDPOINT_SECRET
        )

        # Handle the event
        users_gateway = UsersGateway()

        if event["type"] in [
            "customer.subscription.deleted",
            "customer.subscription.updated",
            "customer.subscription.paused",
            "customer.subscription.resumed",
            "customer.subscription.trial_will_end",
            "customer.subscription.created",
        ]:
            subscription = event["data"]["object"]
            subscription = stripe.Subscription.retrieve(
                id=subscription.id, expand=["customer"]
            )

        elif event["type"] == "payment_intent.succeeded":
            payment_intent = event["data"]["object"]
            payment_intent = stripe.PaymentIntent.retrieve(
                payment_intent.id, expand=["invoice"]
            )
            subscription = stripe.Subscription.retrieve(
                id=payment_intent.invoice.subscription, expand=["customer"]
            )
        else:
            logger.error("Unhandled event type {}".format(event["type"]))
            raise HTTPException(
                status_code=400, detail="Unhandled event type {}".format(event["type"])
            )

        user_email = subscription.customer.email
        logger.info(f"User email from stripe: {user_email}")

        user = users_gateway.get_user_by_safely("email", user_email)

        product_id = subscription["items"]["data"][0]["price"]["product"]
        plan_type = get_user_plan(product_id=product_id, event=event)

        if user:
            user = users_gateway.update_fields(
                user.id,
                {
                    "stripe_settings": {
                        "customer_id": subscription.customer.id,
                        "subscription_id": subscription.id,
                        "subscription_status": subscription.status,
                    },
                    "plan_type": plan_type,
                },
            )
        else:
            logger.error(
                f"UNEXISTENT USER triggered {event['type']} on product '{product_id}'. Full Event: {event}"
            )
            telegram_service.send_message(
                (
                    f"🚨 <b>UNEXISTENT USER triggered {event['type']} on product '{product_id}'</b>\n\n"
                    f"<b>UTC Time:</b> {datetime.now(UTC).strftime('%H:%M, %A %B %d, %Y')}\n"
                    f"<b>Check logs for full event</b>\n"
                )
            )
            return {"success": False}

        if event["type"] == "customer.subscription.created":
            logger.info(f"Sending welcome emails to {user.email}")
            loops.send_loops_event(user.email, "plus_upgrade", user_id=user.id)

        logger.info(f"Event {event['type']} handled successfully")
        logger.info(f"Email: {user.email}")
        logger.info(f"Subscription status: {user.stripe_settings.subscription_status}")

        return {"success": True}

    except ValueError as e:
        logger.error(str(e))
        raise HTTPException(status_code=400, detail=str(e))
    except stripe.error.SignatureVerificationError as e:
        logger.error(str(e))
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(traceback.format_exc())
        telegram_service.send_message(
            (
                f"🚨 <b>Something went terribly wrong at checkout</b>\n\n"
                f"<b>UTC Time:</b> {datetime.now(UTC).strftime('%H:%M, %A %B %d, %Y')}\n"
                f"<b>Check logs for traceback</b>"
            )
        )

    return {"success": False}
