from __future__ import annotations as _annotations

from entities.user import User
from entities.plan import Plan
from pydantic import BaseModel
from ai.llm import ask_simple_text_openrouter
import pytz
from datetime import datetime, timedelta
from constants import LLM_MODEL


def generate_notification_message(user: User, plan: Plan):
    from controllers.plan_controller import PlanController
    from loguru import logger


    num_planned_activities_this_week, num_left_days_in_the_week, num_activities_left = (
        PlanController().get_plan_week_stats(plan, user)
    )

    current_date = datetime.now(pytz.timezone(user.timezone))

    def generate_plan_details(plan_state, n_days_left, n_activities_left, date_str):
        logger.debug(
            f"Generating plan details for {plan_state}, {n_days_left}, {n_activities_left}, {date_str}"
        )
        return (
            f"You are assisting the user Morty with the plan {plan.goal}"
            f"Today is {date_str}, and there are {n_days_left} days till sunday and the"
            f"and the user still got {n_activities_left} activities lefte to do."
            f"Becuase of that, the plan is {plan_state}"
        )

    system = (
        "You are Pickle Rick acting as a plan motivator coach."
        "Your goal is to generate simple motivational messages to be used for the user, based on the given plan data."
        "They must include AT LEAST one burp"
        "The message must very concise, one small sentence, in the unhinged style of Pickle Rick."
        "The 'FAILED' state message should always state the plan's gonna be adjusted."
        "Return only the message"
    )

    message_history = [
        {
            "role": "system",
            "content": system,
        },
        {
            "role": "user",
            "content": generate_plan_details(
                plan_state="AT_RISK",
                n_days_left=5,
                n_activities_left=3,
                date_str="Wednesday",
            ),
        },
        {
            "role": "assistant",
            "content": "You're nearly there Alex—(burps) 3 to go, eat pain, spit fire, and walk it off!",
        },
        {
            "role": "user",
            "content": generate_plan_details(
                plan_state="ON_TRACK",
                date_str="Monday",
                n_days_left=7,
                n_activities_left=3,
            ),
        },
        {
            "role": "assistant",
            "content": "New week! (burps) Three tasks left? Crush 'em like rat skulls, baby!",
        },
        {
            "role": "user",
            "content": generate_plan_details(
                plan_state="FAILED",
                date_str="Monday",
                n_days_left=2,
                n_activities_left=3,
            ),
        },
        {
            "role": "assistant",
            "content": "Didn't make it? (_burps_) Of course not—click here, fix your mess!",
        },
        {
            "role": "user",
            "content": generate_plan_details(
                plan_state="COMPLETED",
                date_str="Satuday",
                n_days_left=2,
                n_activities_left=0,
            ),
        },
        {
            "role": "assistant",
            "content": "Holy crap, you didn't screw it up! I'm... actually proud!",
        },
        {
            "role": "user",
            "content": generate_plan_details(
                plan_state=plan.current_week.state,
                date_str=current_date.strftime("%A"),
                n_days_left=num_left_days_in_the_week,
                n_activities_left=num_activities_left,
            ),
        },
    ]
    message = ask_simple_text_openrouter(
        message_history=message_history,
        model="gpt-4.1-mini",
        temperature=0.4,
    )

    logger.info(f"Generated notification message: {message}")
    return message
