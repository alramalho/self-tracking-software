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
    ]


@pytest.fixture
def memory():
    return ArrayMemory(minimum_messages=1)


@pytest.mark.asyncio
async def test_simple_conversation(test_user, test_activities, memory):
    # Setup
    assistant = ActivityExtractorAssistant(
        user=test_user,
        user_activities=test_activities,
        memory=memory,
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
async def test_activity_extraction_incomplete(test_user, test_activities, memory):
    # Setup
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
        "CheckActivityQualifies_0",
        "CheckActivityDetails_0",
        "AskForMoreInformation_0",
    ]


@pytest.mark.asyncio
async def test_activity_extraction_complete(test_user, test_activities, memory):
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
        "CheckActivityQualifies_0",
        "CheckActivityDetails_0",
        "ExtractActivity_0",
        "InformTheUserAboutTheActivity_0",
    ]


@pytest.mark.asyncio
async def test_activity_extraction_nonexistent(test_user, test_activities, memory):
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
        "CheckActivityQualifies_0",
        "InformTheUserOnlyExistingActivitiesAreSupported_0",
    ] 