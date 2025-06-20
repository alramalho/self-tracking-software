from fastapi import APIRouter
from gateways.activities import ActivitiesGateway
from services.notification_manager import NotificationManager
from gateways.messages import MessagesGateway
from gateways.users import UsersGateway
from typing import List, Dict, Tuple
from fastapi import Depends, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Any
from ai.llm import ask_schema_async
from entities.user import User
from entities.message import Message
from gateways.database.dynamodb import DynamoDBGateway
from ai.assistant.memory import DatabaseMemory
from entities.activity import Activity
from auth.clerk import is_clerk_user
from typing import Optional
from entities.plan import PlanSession
from loguru import logger
from controllers.plan_controller import PlanController
import traceback


router = APIRouter(prefix="/onboarding")

activities_gateway = ActivitiesGateway()
notification_manager = NotificationManager()
messages_gateway = MessagesGateway()
users_gateway = UsersGateway()
plan_controller = PlanController()


class QuestionAnalysisSchema(BaseModel):
    question: str = Field(
        ...,
        description="The question that the user should answer.",
    )
    reasoning: str = Field(
        ...,
        description="The step by step reasoning regarding the question and whether the conversation contains information to answer the question.",
    )
    decision: bool = Field(
        ...,
        description="The boolean representing the decisions (true if there is sufficient information, false otherwise).",
    )


class QuestionChecksSchema(BaseModel):
    analysis: List[QuestionAnalysisSchema] = Field(
        description="The analysis of each question and user message.",
    )


class MessageGenerationSchema(BaseModel):
    message: str = Field(
        ...,
        description="The message to be sent to the user where you should either thank him, or ask him to address the missing questions.",
    )


async def analyse_question_checks(
    question_checks: List[str], conversation_history: str
) -> Tuple[bool, Dict[str, bool], str]:

    question_checks_response = await ask_schema_async(
        text=(
            f"Analyse the conversation history and determine whether it contains "
            f"information to answer all the questions: {question_checks}. \n\n"
            f"Conversation history: {conversation_history}"
        ),
        system="",
        pymodel=QuestionChecksSchema,
    )

    question_results = {
        question_checks[i]: question_checks_response.analysis[i].decision
        for i in range(len(question_checks))
    }
    unanswered_questions = [
        q for q, answered in question_results.items() if not answered
    ]

    all_questions_answered = all(question_results.values())

    message_response = await ask_schema_async(
        text=f"""Based on the conversation history: {conversation_history}
                And the question check results:
                {question_checks_response.analysis}
                
                Generate an appropriate very succint message to the user.
                If there are unanswered questions, state what's wrong and ask for the underlying missing information which the question is asking for.
                If all questions are answered, thank the user.""",
        system=(
            "You are an AI that is helping the user to create a profile and plan for the tracking.so app."
            "You will act as an message generator, based on user provided information and pre existent quality assessment of that information."
        ),
        pymodel=MessageGenerationSchema,
    )

    return all_questions_answered, question_results, message_response.message


def get_conversation(user: User, message: str):
    # Initialize memory and assistant
    memory = DatabaseMemory(DynamoDBGateway("messages"), user.id)

    memory.write(
        Message.new(
            text=message,
            sender_name=user.name,
            sender_id=user.id,
            recipient_name="Jarvis",
            recipient_id="0",
            emotions=[],
        )
    )

    return memory, memory.read_all_as_str(max_age_in_minutes=30)


@router.post("/check-plan-goal")
async def get_plan_goal(request: Request, user: User = Depends(is_clerk_user)):
    try:
        body = await request.json()
        message = body["message"]
        question_checks = body["question_checks"]

        memory, conversation_history = get_conversation(user, message)

        result = {}

        all_questions_answered, question_results, message_response = (
            await analyse_question_checks(question_checks, conversation_history)
        )
        result["question_checks"] = question_results

        if not all_questions_answered:
            result["message"] = message_response

            memory.write(
                Message.new(
                    text=message_response,
                    sender_name="Jarvis",
                    sender_id="0",
                    recipient_name=user.name,
                    recipient_id=user.id,
                    emotions=[],
                )
            )

        else:
            result["goal"] = message

        return result

    except Exception as e:
        logger.error(f"Error extracting plan: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


class ExtractedActivity(BaseModel):
    id: Optional[str] = Field(
        ...,
        description="The id of the activity, if known. If it is a new activity, the id will be created by the system, so do not include it.",
    )
    reasoning: str = Field(
        ...,
        description="Your step by step reasoning on which activity details are most suitable.",
    )
    title: str = Field(..., description="The title of the activity")
    emoji: str = Field(..., description="The emoji of the activity")
    measure: str = Field(
        ...,
        description=(
            "The unit of measurement to measure the activity. Note this should be as atomic as possible "
            "(e.g. 'marathons' or 'books' wouldn't be valid, but 'pages' or 'minutes' would be valid). For example, for 'reading' the measure could be 'pages',"
            "for 'running' the measure could be 'kilometers' or 'gym' could 'minutes' or 'sessions'."
            "note that for example 'sessions per week' would not be valid, as it is not a unit of single activity measurement,"
            "but rather a frequency of the activity."
        ),
    )


@router.post("/generate-plan-activities")
async def generate_plan_activities(
    request: Request, user: User = Depends(is_clerk_user)
):
    try:
        body = await request.json()
        message = body["message"]
        plan_goal = body["plan_goal"]
        # question_checks = body["question_checks"]

        memory, conversation_history = get_conversation(user, message)

        # result = {}

        # all_questions_answered, question_results, message_response = (
        #     await analyse_question_checks(question_checks, conversation_history)
        # )
        result = {}
        result["question_checks"] = {}

        class ExtractionSchema(BaseModel):
            reasoning: str = Field(
                ...,
                description="Your step by step reasoning on which activity details are most suitable.",
            )
            activities: List[ExtractedActivity] = Field(
                ...,
                description="List of activities to be extracted. ",
            )

        response = await ask_schema_async(
            text=f"Extract activities based on the conversation history: {conversation_history}",
            system=(
                f"You are an AI that is helping the user create activities for the plan '{plan_goal}' the tracking.so app."
                "You goal is to extract activities based conversation history."
                "You should give priority to the activities included in the conversation history, but you may fill in the informational gaps, if any."
            ),
            pymodel=ExtractionSchema,
        )

        result["activities"] = [
            Activity.new(
                user_id=user.id,
                emoji=activity.emoji,
                title=activity.title,
                measure=activity.measure,
            )
            for activity in response.activities
        ]

        return result

    except Exception as e:
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


from ai.assistant.plan_creation_assistant_simple import (
    PlanCreationAssistant as PlanCreationAssistantSimple,
)
from bson import ObjectId
from datetime import datetime, timedelta, UTC
from entities.plan import Plan


class GuidelineTimeframeSchema(BaseModel):
    number_of_weeks: int = Field(
        ...,
        description="The number of weeks of the plan.",
    )
    sessions_per_week: str = Field(
        ...,
        description="The number (or range of numbers) of sessions per week of the plan. (e.g 3, or 4-5)",
    )

async def extract_guidelines_and_emoji(plan_goal: str, plan_progress: str) -> Tuple[str, GuidelineTimeframeSchema, str]:

    class GuidelinesSchema(BaseModel):
        guidelines: str = Field(
            ...,
            description=("The listified guidelines"),
        )
        timeframe_guidelines: List[GuidelineTimeframeSchema] = Field(
            ...,
            description=(
                "The timeframe guidelines as explained above. Must be a list of two elements."
            ),
        )
        emoji: str = Field(
            ...,
            description="The emoji of the plan, based on the goal. It should be a single emoji.",
        )

    guidelines_response = await ask_schema_async(
        text=f"Extract guidelines for creating a plan with the goal of '{plan_goal}' for someone who reported the progress of '{plan_progress}'",
        system=(
            "You are an AI that is helping the user create a plan for the tracking.so app."
            "You must act as a professional plan creator. You specialize in the area of the given plan, and you must create"
            "a set of guidelines that are to be followed to create a progressive plan from the user standpoint."
            "The guidelines should include any of tips, requirements, caveats, or points to consider when creating an activity plan."
            "The guidelines should also include an instruction set on how to propely the duration of the plan."
            "The guidelines should not be generic, but specifically adapted to the nature of the plan provided"
            "The guidelines should be created in a listified format."
            "The guidelines should present a timeframe range with total weeks AND sessions per week, for two ends of a plan intensity spectrum"
            "(Example 12 weeks, 3 sessions per week and 8 weeks, 4 to 5 sessions per week. Always two options, one more relaxed, followed by one more intense)"
        ),
        pymodel=GuidelinesSchema,
    )
    return guidelines_response.guidelines, guidelines_response.timeframe_guidelines, guidelines_response.emoji


async def generate_plan(
    user: User,
    plan_goal: str,
    plan_activities: List[Activity],
    plan_progress: str,
    weeks: int,
    sessions_per_week: str,
    guidelines: str,
    emoji: str,
):
    plan_controller = PlanController()

    finishing_date = (datetime.now(UTC) + timedelta(days=7 * weeks)).isoformat()
    generated_sessions = await plan_controller.generate_sessions(
        goal=plan_goal,
        finishing_date=finishing_date,
        activities=plan_activities,
        edit_description=(
            f"The user provided guidelines for the plan: {guidelines}\n"
            f"The plan should span across {weeks} weeks, with approximately {sessions_per_week} sessions per week."
            f"The user provided plan progress (how advanced along is he): {plan_progress}\n"
            f"You must use as the basis for your output."
        ),
    )

    return Plan.new(
        user_id=user.id,
        goal=plan_goal,
        emoji=emoji,
        finishing_date=finishing_date,
        activity_ids=[a.id for a in plan_activities],
        sessions=generated_sessions,
        outline_type="specific",
    )


import asyncio

@router.post("/generate-plans")
async def generate_plan_route(request: Request, user: User = Depends(is_clerk_user)):
    try:
        body = await request.json()
        plan_goal = body["plan_goal"]
        plan_activities = [
            Activity.model_validate(activity) for activity in body["plan_activities"]
        ]
        plan_progress = body["plan_progress"]

        guidelines, timeframe_guidelines, emoji = await extract_guidelines_and_emoji(plan_goal, plan_progress)

        plan_1, plan_2 = await asyncio.gather(
            generate_plan(
                user=user,
                plan_goal=plan_goal,
                plan_activities=plan_activities,
                plan_progress=plan_progress,
                weeks=timeframe_guidelines[0].number_of_weeks,
                sessions_per_week=timeframe_guidelines[0].sessions_per_week,
                guidelines=guidelines,
                emoji=emoji,
            ),
            generate_plan(
                user=user,
                plan_goal=plan_goal,
                plan_activities=plan_activities,
                plan_progress=plan_progress,
                weeks=timeframe_guidelines[1].number_of_weeks,
                sessions_per_week=timeframe_guidelines[1].sessions_per_week,
                guidelines=guidelines,
                emoji=emoji,
            ),
        )

        result = {}
        result["message"] = "Here are two plans for you to choose from"
        result["plans"] = sorted(
            [plan_1, plan_2], 
            key=lambda x: (datetime.fromisoformat(x.finishing_date) - datetime.fromisoformat(x.created_at)).total_seconds() / len(x.sessions),
            reverse=True
        )
        result["activities"] = plan_activities

        return result

    except Exception as e:
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))
