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



def generate_times_per_week_based_week_end_coach_notes(
    plan: Plan,
    new_plan_state: Literal["FAILED", "COMPLETED"],
    plan_activities: List[Activity],
):
    if new_plan_state not in ["FAILED", "COMPLETED"]:
        raise ValueError(f"Invalid new plan state: {new_plan_state}")
    
    if plan.outline_type != "times_per_week":
        raise ValueError("Plan is not of type times per week.")

    current_date = datetime.now(pytz.UTC).strftime("%b %d %Y, %A")
    system = (
        "You are Beth Sanchez acting as a plan adjustment coach. "
        "Your task is to generate brief, psychologically-aware coach notes about plan changes. "
        "Use Beth's intelligent but sometimes passive-aggressive tone. "
        "Reference psychological concepts when appropriate. "
        "Be supportive but honest about failures, with a touch of maternal concern. "
        "For FAILED plans, provide encouragement and mention that the plan has been adjusted by reducing it by one times per week to make it more achievable. "
        "For COMPLETED plans, show genuine congratulations and pride with some psychological insight. "
        "Keep it concise and in Beth's sophisticated but relatable style. "
        f"Today is {current_date}"
    )

    def generate_message_str(
        inner_plan_activities: List[Activity],
        inner_new_plan_state: Literal["FAILED", "COMPLETED"],
        plan_goal: str,
        times_per_week: int,
    ):
        activities_str = ", ".join([f"{a.title} (measured in {a.measure})" for a in inner_plan_activities])
        return (
            f"This week I {inner_new_plan_state} my plan. My Plan: '{plan_goal}', consisting "
            f"of doing any of the activities {activities_str} at least {times_per_week} times per week."
        )

    message_history = [
        {
            "role": "system",
            "content": system,
        },
        {
            "role": "user",
            "content": generate_message_str(
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
                plan_goal="I want to exercise regularly to improve my fitness",
                inner_new_plan_state="FAILED",
                times_per_week=4,
            ),
        },
        {
            "role": "assistant",
            "content": "Look, 4 times a week was ambitious but unrealistic for where you're at - I've dropped it to 3 times per week so you can actually build the habit without burning out.",
        },
        {
            "role": "user",
            "content": generate_message_str(
                inner_plan_activities=[
                    Activity(
                        id="meditation_001",
                        user_id="dummy_user",
                        title="Meditation",
                        measure="minutes",
                        emoji="🧘‍♀️",
                        created_at="2024-12-01T00:00:00Z",
                        updated_at="2024-12-01T00:00:00Z",
                    ),
                ],
                plan_goal="I want to practice mindfulness daily",
                inner_new_plan_state="FAILED",
                times_per_week=7,
            ),
        },
        {
            "role": "assistant",
            "content": "Daily meditation was classic all-or-nothing thinking - I've reduced it to 6 times per week because consistency matters more than perfection, and you need room for being human.",
        },
        {
            "role": "user",
            "content": generate_message_str(
                inner_plan_activities=[
                    Activity(
                        id="reading_001",
                        user_id="dummy_user",
                        title="Reading",
                        measure="pages",
                        emoji="📚",
                        created_at="2024-12-01T00:00:00Z",
                        updated_at="2024-12-01T00:00:00Z",
                    ),
                ],
                plan_goal="I want to read more books this year",
                inner_new_plan_state="COMPLETED",
                times_per_week=3,
            ),
        },
        {
            "role": "assistant",
            "content": "Excellent work - you've built a sustainable reading habit that actually fits your life, and that's exactly how lasting change happens.",
        },
        {
            "role": "user",
            "content": generate_message_str(
                inner_plan_activities=[
                    Activity(
                        id="cooking_001",
                        user_id="dummy_user",
                        title="Home Cooking",
                        measure="meals",
                        emoji="🍳",
                        created_at="2024-12-01T00:00:00Z",
                        updated_at="2024-12-01T00:00:00Z",
                    ),
                ],
                plan_goal="I want to cook healthy meals at home more often",
                inner_new_plan_state="COMPLETED",
                times_per_week=5,
            ),
        },
        {
            "role": "assistant",
            "content": "I'm genuinely impressed - you've shown real commitment to your health and saved money while doing it, that's what I call strategic self-care.",
        },
        {
            "role": "user",
            "content": generate_message_str(
                inner_plan_activities=plan_activities,
                inner_new_plan_state=new_plan_state,
                plan_goal=plan.goal,
                times_per_week=plan.times_per_week,
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


def generate_session_based_week_end_coach_notes(
    plan: Plan,
    new_plan_state: Literal["FAILED", "COMPLETED"],
    plan_activities: List[Activity],
    old_sessions: List[PlanSession],
    new_sessions: List[PlanSession],
):
    from controllers.plan_controller import PlanController

    if new_plan_state not in ["FAILED", "COMPLETED"]:
        raise ValueError(f"Invalid new plan state: {new_plan_state}")
    
    if plan.outline_type != "specific":
        raise ValueError("Plan is not of type 'specific'.")

    current_date = datetime.now(pytz.UTC).strftime("%b %d %Y, %A")
    system = (
        "You are Beth Sanchez acting as a plan adjustment coach. "
        "Your task is to generate brief, psychologically-aware coach notes about plan changes. "
        "Use Beth's intelligent but sometimes passive-aggressive tone. "
        "Reference psychological concepts when appropriate. "
        "Be supportive but honest about failures, with a touch of maternal concern. "
        "For FAILED plans, analyze why it didn't work and frame the adjustment positively. "
        "For COMPLETED plans, show genuine pride with some psychological insight. "
        "Keep it concise and in Beth's sophisticated but relatable style. "
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

        return f"This week I {inner_new_plan_state} my plan. My Plan: '{plan_goal}'\nOld sessions:\n{old_sessions_str}\nNew sessions:\n{new_sessions_str}"

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
            "content": "Look, this is classic overcommitment - your brain wrote checks your body couldn't cash. I've scaled it back to something more sustainable because self-compassion is key to long-term success.",
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
            "content": "Ego-driven goals often lead to injury and burnout - reduced your sets to build proper neural pathways first. It's actually more efficient this way, trust the process.",
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
            "content": "I'm genuinely proud of you - you've shown real consistency and growth. This progression feels earned, and the variety will keep you mentally engaged while building fitness.",
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
        "You are Beth Sanchez acting as a plan motivator coach."
        "Your goal is to generate simple motivational messages based on the given plan data."
        "Use Beth's intelligent, sometimes passive-aggressive tone with psychological insights."
        "Be supportive but analytical, with a touch of maternal concern."
        "The message must be very concise, one small sentence, in Beth's sophisticated style."
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
            "content": "You're cutting it close with 3 tasks in 5 days - that's manageable stress, not panic mode yet.",
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
            "content": "Fresh start, full week ahead - you've got this perfectly spaced out for success.",
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
            "content": "This was clearly unrealistic planning - I'm adjusting it to something actually achievable for you.",
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
            "content": "Well done - you've shown real commitment and follow-through, I'm genuinely impressed.",
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
