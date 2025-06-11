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
        f"You are an expert coach assisting the user in the plan '{plan.goal}'"
        f"Your task now is to generate small coach notes that accompany this change"
        f"both explaining and motivating, based on the plan performance"
        f"The coach notes should be very very brief"
        f"Today is {current_date}"
    )

    def generate_message_str(
        inner_plan_activities: List[Activity],
        inner_new_plan_state: Literal["FAILED", "COMPLETED"],
        plan_goal: str,
        times_per_week: int,
    ):
        if inner_new_plan_state == 'FAILED':
            performance = "poor"
        elif inner_new_plan_state == 'COMPLETED':
            performance = "good"
            
        activities_str = ", ".join([f"{a.title} (measured in {a.measure})" for a in inner_plan_activities])
        return (
            f"This week I had a {performance} performance. My Plan: '{plan_goal}', consisting "
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
            "content": "Reduced from 4 to 3 times per week. Focus on consistency over intensity - building the habit is more important than pushing limits right now.",
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
            "content": "Scaled back from daily to 6 times per week. Consistency matters more than perfection - this gives you room to be human while still building the habit.",
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
            "content": "Excellent work! You've built a sustainable reading habit that fits your life. This consistency is exactly how lasting change happens.",
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
            "content": "Great commitment to your health! You've shown real dedication while also saving money - that's smart goal achievement.",
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
        f"You are an expert coach assisting the user in the plan '{plan.goal}'"
        f"Your task now is to generate small coach notes that accompany this change"
        f"both explaining and motivating, based on the old and new sessions the user provided"
        f"The coach notes should be very very brief"
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
            "content": "Reduced from 4 to 3 sessions per week and lowered running distance. Focus on consistency over intensity - building the habit is more important than pushing limits right now.",
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
            "content": "Scaled back the intensity and reduced sets from 5 to 3. Better to master technique with lighter weights than struggle with heavy ones - this builds a stronger foundation.",
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
            "content": "Excellent progress! Increased from 3 to 4 sessions per week and added variety with intervals and tempo runs. You've earned this upgrade - time to challenge yourself with more structured training.",
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

    _, num_left_days_in_the_week, num_activities_left = (
        PlanController().get_plan_week_stats(plan, user)
    )

    current_date = datetime.now(pytz.timezone(user.timezone))

    def generate_plan_details(plan_state, n_days_left, n_activities_left, date_str):
        logger.debug(
            f"Generating plan details for {plan_state}, {n_days_left}, {n_activities_left}, {date_str}"
        )
        user_first_name = user.name.split(" ")[0] if " " in user.name else user.name
        return (
            f"You are assisting the user {user_first_name} with the plan {plan.goal}"
            f"Today is {date_str}, and there are {n_days_left} days till sunday and the"
            f"and the user still got {n_activities_left} activities lefte to do."
            f"Becuase of that, the plan is {plan_state}"
        )

    system = (
        "You are an expert coach acting as a plan motivator."
        "Your goal is to generate simple motivational messages based on the given plan data."
        "Be supportive and encouraging with practical insights."
        "The message must be very concise, one small sentence, in a helpful coaching style."
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
            "content": "You're cutting it close with 3 tasks in 5 days - manageable but stay focused to finish strong.",
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
            "content": "Fresh start with a full week ahead - you've got this perfectly spaced out for success.",
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
            "content": "This plan was too ambitious - I'm adjusting it to something more achievable for you.",
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
            "content": "Well done - you've shown real commitment and follow-through, excellent work!",
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