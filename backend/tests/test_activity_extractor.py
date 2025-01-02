from shared.logger import create_logger

create_logger()

import pytest
from datetime import datetime, UTC, timedelta
from ai.assistant.activity_extractor import ActivityExtractorAssistant
from ai.assistant.memory import ArrayMemory
from entities.user import User
from entities.activity import Activity
from entities.message import Message


@pytest.fixture
def test_user():
    return User(
        id="666666666666666666666666",
        name="Test User",
        email="test@example.com",
        created_at=datetime.now(UTC).isoformat(),
    )


@pytest.fixture
def test_activities():
    return [
        Activity.new(
            user_id="666666666666666666666666",
            title="Running",
            measure="minutes",
            emoji="🏃",
        ),
        Activity.new(
            user_id="666666666666666666666666",
            title="Reading",
            measure="minutes",
            emoji="📖",
        ),
    ]


@pytest.mark.asyncio
async def test_simple_conversation(test_user, test_activities):
    # Setup
    assistant = ActivityExtractorAssistant(
        user=test_user,
        user_activities=test_activities,
        memory=ArrayMemory(minimum_messages=1, initial_messages=[]),
    )

    # Simulate user message
    response, extracted = await assistant.get_response(
        "Hi, how are you doing today?",
        message_id="test_message_1",
    )

    # Assertions
    assert response is not None
    assert assistant.framework.execution_path == [
        "ActivityScanner_0",
        "Converse_0",
    ]


@pytest.mark.asyncio
async def test_activity_extraction_incomplete(test_user, test_activities):
    # Setup
    memory = ArrayMemory(minimum_messages=1, initial_messages=[])
    assistant = ActivityExtractorAssistant(
        user=test_user,
        user_activities=test_activities,
        memory=memory,
    )

    # Simulate user message about logging activity without quantity
    response, extracted = await assistant.get_response(
        "Can you log my run from yesterday?",
        message_id="test_message_2",
    )

    # Assertions
    assert response is not None
    assert assistant.framework.execution_path == [
        "ActivityScanner_0",
        "CheckActivityAlreadyConcluded_0",
        "CheckActivityQualifies_0",
        "CheckActivityDetails_0",
        "AskForMoreInformation_0",
    ]


@pytest.mark.asyncio
async def test_activity_extraction_complete(test_user, test_activities):
    memory = ArrayMemory(minimum_messages=1, initial_messages=[])
    # Setup
    assistant = ActivityExtractorAssistant(
        user=test_user,
        user_activities=test_activities,
        memory=memory,
    )

    # Simulate user message with complete activity information
    response, extracted = await assistant.get_response(
        "Can you log my 30 minute run from yesterday?",
        message_id="test_message_3",
    )

    # Assertions
    assert response is not None
    assert assistant.framework.execution_path == [
        "ActivityScanner_0",
        "CheckActivityAlreadyConcluded_0",
        "CheckActivityQualifies_0",
        "CheckActivityDetails_0",
        "ExtractActivity_0",
        "InformTheUserAboutTheActivity_0",
    ]


@pytest.mark.asyncio
async def test_activity_extraction_nonexistent(test_user, test_activities):
    memory = ArrayMemory(minimum_messages=1, initial_messages=[])
    # Setup
    assistant = ActivityExtractorAssistant(
        user=test_user,
        user_activities=test_activities,
        memory=memory,
    )

    # Simulate user message about logging a non-existent activity
    response, extracted = await assistant.get_response(
        "Can you log my meditation session from yesterday?",
        message_id="test_message_4",
    )

    # Assertions
    assert response is not None
    assert assistant.framework.execution_path == [
        "ActivityScanner_0",
        "CheckActivityAlreadyConcluded_0",
        "CheckActivityQualifies_0",
        "InformTheUserOnlyExistingActivitiesAreSupported_0",
    ]


@pytest.mark.asyncio
async def test_activity_already_extracted(test_user, test_activities):
    # Setup memory with initial messages
    memory = ArrayMemory(
        minimum_messages=1,
        initial_messages=[
            Message.new(
                text="ive been reading a book about espinosa",
                sender_name=test_user.name,
                sender_id=test_user.id,
                recipient_name="Jarvis",
                recipient_id="0",
            ),
            Message.new(
                text="That sounds interesting! Espinosa's work often dives into deep philosophical ideas. What specific themes or concepts from the book have caught your attention? Also, have you thought about tracking your reading activities? It might be helpful to reflect on what you've read!",
                sender_name="Jarvis",
                sender_id="0",
                recipient_name=test_user.name,
                recipient_id=test_user.id,
            ),
            Message.new(
                text="you're right,ive just created a reading activity, mark that ive read yesterday",
                sender_name=test_user.name,
                sender_id=test_user.id,
                recipient_name="Jarvis",
                recipient_id="0",
            ),
            Message.new(
                text="Could you please provide the duration in minutes for your reading activity yesterday? This will help me log it accurately!",
                sender_name="Jarvis",
                sender_id="0",
                recipient_name=test_user.name,
                recipient_id=test_user.id,
            ),
            Message.new(
                text="yeah, ive read 15min",
                sender_name=test_user.name,
                sender_id=test_user.id,
                recipient_name="Jarvis",
                recipient_id="0",
            ),
            Message.new(
                text="I've extracted the reading activity of 15 minutes from yesterday. Please confirm if you would like to accept or reject this entry!",
                sender_name="Jarvis",
                sender_id="0",
                recipient_name=test_user.name,
                recipient_id=test_user.id,
            ),
            Message.new(
                text="User accepted and logged the following activities:",
                sender_name="System",
                sender_id="system",
                recipient_name=test_user.name,
                recipient_id=test_user.id,
            ),
        ],
    )

    assistant = ActivityExtractorAssistant(
        user=test_user,
        user_activities=test_activities,
        memory=memory,
    )

    # Try to log the same activity
    response, extracted = await assistant.get_response(
        "mark that I've read yesterday",
        message_id="test_message_2",
    )

    # Assertions
    assert response is not None
    assert assistant.framework.execution_path == [
        "ActivityScanner_0",
        "CheckActivityAlreadyConcluded_0",
        "Converse_0",
    ]


@pytest.mark.asyncio
async def test_assistant_conversation_termination(test_user, test_activities):
    # Setup memory with initial messages simulating a conversation about activities and plans
    memory = ArrayMemory(
        minimum_messages=1,
        initial_messages=[
            Message.new(
                text="I've been thinking about starting some new activities",
                sender_name=test_user.name,
                sender_id=test_user.id,
                recipient_name="Jarvis",
                recipient_id="0",
            ),
            Message.new(
                text="That's great! What kind of activities are you interested in? I see you already have running and reading set up!",
                sender_name="Jarvis",
                sender_id="0",
                recipient_name=test_user.name,
                recipient_id=test_user.id,
            ),
        ],
    )

    assistant = ActivityExtractorAssistant(
        user=test_user,
        user_activities=test_activities,
        memory=memory,
    )

    # Send a message that clearly indicates the user wants to end the conversation
    response, extracted = await assistant.get_response(
        "Thanks, that's all for now. I'll let you know when I go for my next run.",
        message_id="test_message_1",
    )

    # Assertions
    assert response is not None
    assert assistant.framework.execution_path == [
        "ActivityScanner_0",
        "Converse_0",
    ]
    # Ensure the response doesn't contain a question mark, indicating no follow-up questions
    assert "?" not in response
