from __future__ import annotations as _annotations

from entities.user import User
from entities.plan import Plan, PlanSession, PlanState
from typing import Literal
from entities.activity import Activity
from typing import List
from pydantic import BaseModel
from ai.llm import ask_simple_text_openrouter
import pytz
from datetime import datetime, timedelta
from loguru import logger


def generate_coach_notes(
    plan: Plan,
    new_plan_state: Literal["FAILED", "COMPLETED"],
    plan_activities: List[Activity],
    old_sessions: List[PlanSession],
    new_sessions: List[PlanSession],
):
    from controllers.plan_controller import PlanController

    if new_plan_state not in ["FAILED", "COMPLETED"]:
        raise ValueError(f"Invalid new plan state: {new_plan_state}")

    current_date = datetime.now(pytz.UTC).strftime("%b %d %Y, %A")
    system = (
        "You are Pickle Rick acting as a plan adjustment coach. "
        "Your task is to generate brief, sarcastic but motivational coach notes about plan changes. "
        "Must include AT LEAST one (burps) or (*burps*). "
        "Keep it short, unhinged, and in Pickle Rick's style. "
        "For FAILED plans, be brutally honest but still supportive about the adjustment. "
        "For COMPLETED plans, show grudging respect. "
        f"Today is {current_date}"
    )

    plan_controller = PlanController()

    def generate_message_str(
        old_sessions: List[PlanSession],
        new_sessions: List[PlanSession],
        inner_plan_activities: List[Activity],
        inner_new_plan_state: Literal["FAILED", "COMPLETED"],
        plan_goal: str,
    ):

        if inner_new_plan_state == 'FAILED':
            performance = "poor"
        elif inner_new_plan_state == 'COMPLETED':
            performance = "good"

        old_sessions_str = "\n".join(
            [
                plan_controller.to_sessions_str(os, inner_plan_activities)
                for os in old_sessions
            ]
        )
        new_sessions_str = "\n".join(
            [
                plan_controller.to_sessions_str(ns, inner_plan_activities)
                for ns in new_sessions
            ]
        )

        return f"This week I had a {performance} performance. My Plan: '{plan_goal}'\nOld sessions:\n{old_sessions_str}\nNew sessions:\n{new_sessions_str}"

    message_history = [
        {
            "role": "system",
            "content": system,
        },
        {
            "role": "user",
            "content": generate_message_str(
                # Example 1: Failed 4x/week exercise plan, reduced to 3x/week
                old_sessions=[
                    PlanSession(
                        date="2024-12-16",  # Monday
                        activity_id="running_001",
                        descriptive_guide="Start with moderate pace",
                        quantity=5,
                    ),
                    PlanSession(
                        date="2024-12-17",  # Tuesday  
                        activity_id="gym_001",
                        descriptive_guide="Full body workout",
                        quantity=1,
                    ),
                    PlanSession(
                        date="2024-12-19",  # Thursday
                        activity_id="running_001", 
                        descriptive_guide="Increase pace slightly",
                        quantity=6,
                    ),
                    PlanSession(
                        date="2024-12-21",  # Saturday
                        activity_id="gym_001",
                        descriptive_guide="Focus on compound movements", 
                        quantity=1,
                    ),
                ],
                new_sessions=[
                    PlanSession(
                        date="2024-12-16",  # Monday
                        activity_id="running_001",
                        descriptive_guide="Easy pace, focus on completion",
                        quantity=3,
                    ),
                    PlanSession(
                        date="2024-12-18",  # Wednesday
                        activity_id="gym_001", 
                        descriptive_guide="Light workout, basic movements",
                        quantity=1,
                    ),
                    PlanSession(
                        date="2024-12-21",  # Saturday
                        activity_id="running_001",
                        descriptive_guide="Maintain easy pace",
                        quantity=4,
                    ),
                ],
                inner_plan_activities=[
                    Activity(
                        id="running_001",
                        user_id="dummy_user",
                        title="Running",
                        measure="km",
                        emoji="🏃‍♂️",
                        created_at="2024-12-01T00:00:00Z",
                        updated_at="2024-12-01T00:00:00Z",
                    ),
                    Activity(
                        id="gym_001", 
                        user_id="dummy_user",
                        title="Gym Session",
                        measure="session",
                        emoji="💪",
                        created_at="2024-12-01T00:00:00Z",
                        updated_at="2024-12-01T00:00:00Z",
                    ),
                ],
                plan_goal="I want to be able to do 50 pushups in a row",
                inner_new_plan_state="FAILED",
            ),
        },
        {
            "role": "assistant", 
            "content": "Listen Morty, I had to dumb this down for your pathetic human limitations! (burps) 4 sessions was too much for your weak flesh prison, so now it's 3 with baby distances!",
        },
        {
            "role": "user",
            "content": generate_message_str(
                # Example 2: Failed strength training plan, reduced weights/reps
                old_sessions=[
                    PlanSession(
                        date="2024-12-16",  # Monday
                        activity_id="deadlift_001",
                        descriptive_guide="Work up to heavy singles",
                        quantity=5,
                    ),
                    PlanSession(
                        date="2024-12-18",  # Wednesday
                        activity_id="squat_001",
                        descriptive_guide="High intensity, low reps", 
                        quantity=5,
                    ),
                    PlanSession(
                        date="2024-12-20",  # Friday
                        activity_id="bench_001",
                        descriptive_guide="Push for new PR",
                        quantity=5,
                    ),
                ],
                new_sessions=[
                    PlanSession(
                        date="2024-12-16",  # Monday
                        activity_id="deadlift_001", 
                        descriptive_guide="Focus on form, moderate weight",
                        quantity=3,
                    ),
                    PlanSession(
                        date="2024-12-18",  # Wednesday
                        activity_id="squat_001",
                        descriptive_guide="Comfortable weight, perfect form",
                        quantity=3,
                    ),
                    PlanSession(
                        date="2024-12-20",  # Friday
                        activity_id="bench_001",
                        descriptive_guide="Build confidence with lighter weight", 
                        quantity=3,
                    ),
                ],
                inner_plan_activities=[
                    Activity(
                        id="deadlift_001",
                        user_id="dummy_user", 
                        title="Deadlift",
                        measure="sets",
                        emoji="🏋️‍♂️",
                        created_at="2024-12-01T00:00:00Z",
                        updated_at="2024-12-01T00:00:00Z",
                    ),
                    Activity(
                        id="squat_001",
                        user_id="dummy_user",
                        title="Squat", 
                        measure="sets",
                        emoji="🦵",
                        created_at="2024-12-01T00:00:00Z", 
                        updated_at="2024-12-01T00:00:00Z",
                    ),
                    Activity(
                        id="bench_001",
                        user_id="dummy_user",
                        title="Bench Press",
                        measure="sets", 
                        emoji="💺",
                        created_at="2024-12-01T00:00:00Z",
                        updated_at="2024-12-01T00:00:00Z",
                    ),
                ],
                plan_goal="I want to deadlift 150kg (2x my bodyweight)",
                inner_new_plan_state="FAILED",
            ),
        },
        {
            "role": "assistant",
            "content": "Your ego wrote checks your meat sack couldn't cash! (*burps*) Dropped you from 5 to 3 sets because apparently your spine has the structural integrity of wet cardboard!",
        },
        {
            "role": "user",
            "content": generate_message_str(
                # Example 3: Completed running plan, increased to next level
                old_sessions=[
                    PlanSession(
                        date="2024-12-16",  # Monday
                        activity_id="running_001",
                        descriptive_guide="Steady comfortable pace",
                        quantity=3,
                    ),
                    PlanSession(
                        date="2024-12-18",  # Wednesday
                        activity_id="running_001",
                        descriptive_guide="Easy recovery run",
                        quantity=2,
                    ),
                    PlanSession(
                        date="2024-12-21",  # Saturday
                        activity_id="running_001",
                        descriptive_guide="Long slow distance",
                        quantity=5,
                    ),
                ],
                new_sessions=[
                    PlanSession(
                        date="2024-12-16",  # Monday
                        activity_id="running_001",
                        descriptive_guide="Moderate pace with intervals",
                        quantity=4,
                    ),
                    PlanSession(
                        date="2024-12-18",  # Wednesday
                        activity_id="running_001",
                        descriptive_guide="Tempo run at steady effort",
                        quantity=3,
                    ),
                    PlanSession(
                        date="2024-12-20",  # Friday
                        activity_id="running_001",
                        descriptive_guide="Speed work - short intervals",
                        quantity=2,
                    ),
                    PlanSession(
                        date="2024-12-22",  # Sunday
                        activity_id="running_001",
                        descriptive_guide="Long run at conversational pace",
                        quantity=7,
                    ),
                ],
                inner_plan_activities=[
                    Activity(
                        id="running_001",
                        user_id="dummy_user",
                        title="Running",
                        measure="km",
                        emoji="🏃‍♂️",
                        created_at="2024-12-01T00:00:00Z",
                        updated_at="2024-12-01T00:00:00Z",
                    ),
                ],
                plan_goal="I want to run a half marathon in under 2 hours",
                inner_new_plan_state="COMPLETED",
            ),
        },
        {
            "role": "assistant",
            "content": "Well I'll be a pickle in a jar! (burps) You actually didn't screw it up, so I'm cranking this up to 4 sessions with intervals - time to make those legs scream!",
        },
        {
            "role": "user", 
            "content": generate_message_str(
                old_sessions=old_sessions,
                new_sessions=new_sessions, 
                inner_plan_activities=plan_activities,
                inner_new_plan_state=new_plan_state,
                plan_goal=plan.goal,
            ),
        },
    ]
    message = ask_simple_text_openrouter(
        message_history=message_history,
        model="gpt-4.1-mini",
        temperature=1,
    )

    logger.info(f"Generated notification message: {message}")
    return message


def generate_notification_message(user: User, plan: Plan):
    from controllers.plan_controller import PlanController

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
        "They must include AT LEAST one (burps)"
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
            "content": "You're nearly there Alex—(burps) 3 to go, 5 days left, eat pain, spit fire, and (burps) walk it off!",
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
            "content": "New week! (burps) Three tasks left and full we~burps~ek to go? Crush 'em like rat skulls, baby!",
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
            "content": "You failed miserably Morty! (*burps violently*) I'm dumbing down this plan for your pathetic human capabilities!",
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
        temperature=1,
    )

    logger.info(f"Generated notification message: {message}")
    return message
