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
from bson import ObjectId
from auth.clerk import is_clerk_user
from loguru import logger
import traceback

router = APIRouter(prefix="/onboarding")

activities_gateway = ActivitiesGateway()
notification_manager = NotificationManager()
messages_gateway = MessagesGateway()
users_gateway = UsersGateway()


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


@router.post("/check-plan-goal")
async def get_plan_goal(request: Request, user: User = Depends(is_clerk_user)):
    try:
        body = await request.json()
        message = body["message"]
        question_checks = body["question_checks"]

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

        conversation_history = memory.read_all_as_str(max_age_in_minutes=30)
        print(conversation_history)

        # Log the extraction request
        logger.info(
            f"Extracting plan for user {user.id} from message: {message[:50]}..."
        )

        result = {}

        all_questions_answered, question_results, message_response = (
            await analyse_question_checks(question_checks, conversation_history)
        )
        result["question_checks"] = question_results

        if not all_questions_answered:
            result["message"] = message_response
        else:
            result["goal"] = message

        return result

    except Exception as e:
        logger.error(f"Error extracting plan: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))
