from __future__ import annotations as _annotations

import asyncio
import os
import urllib.parse
from dataclasses import dataclass
from typing import Any

from httpx import AsyncClient
from controllers.plan_controller import PlanController
from entities.user import User
from entities.plan import Plan
from pydantic import BaseModel
from ai.llm import ask_schema_simple_openai
import pytz
from datetime import datetime, timedelta
from constants import LLM_MODEL


def generate_notification_message(user: User, plan: Plan):
    from controllers.plan_controller import PlanController

    num_planned_activities_this_week, num_left_days_in_the_week, num_activities_left = PlanController().get_plan_week_stats(plan, user)

    current_date = datetime.now(pytz.timezone(user.timezone))

    def generate_plan_details(plan_state, n_days_left, n_activities_left, date_str):
        return (
            f"You are assisting the user {user.name} with the plan {plan.goal}"
            f"Today is {date_str}, and there are {n_days_left} days till sunday and the"
            f"and the user still got {n_activities_left} activities lefte to do."
            f"Becuase of that, the plan is {plan_state}"
        )

    system = (
        "You are an expert coach that knows how to to motivate a user with few words",
        "Your goal is to generate simple motivational messages to be used for the user, based on the given plan data.",
        "The message must contain 12 words at max.",
        "The 'FAILED' state message should be always the same.",
    )

    class MessageSchema(BaseModel):
        message: str

    return ask_schema_simple_openai(
        pymodel=MessageSchema,
        message_history=[
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
                "content": "Almost there! Slow and steady, and you will be proud of yourself!",
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
                "content": "New week, new start! Let's crush your 3 activiies! 💪",
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
                "content": "You didn't make it this week. Click here to readjust your plan",
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
                "content": "Way to go! I'm proud of you 🔥",
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
        ],
        model="gpt-4o-mini",
        temperature=0,
    ).message
