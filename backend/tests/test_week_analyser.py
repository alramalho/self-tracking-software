from shared.logger import create_logger

create_logger()

import pytest
from datetime import datetime, UTC, timedelta
from ai.assistant.week_analyser import WeekAnalyserAssistant
from ai.assistant.memory import ArrayMemory
from entities.user import User
from entities.activity import Activity
from entities.plan import Plan
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
def empty_activities():
    return []


@pytest.fixture
def empty_plans():
    return []


@pytest.fixture
def memory():
    return ArrayMemory(minimum_messages=1)


@pytest.fixture
def three_plans():
    return [
        Plan(
            id="111111111111111111111111",
            user_id="666666666666666666666666",
            goal="Running",
            times_per_week=None,
            sessions=[],
            created_at=datetime.now(UTC).isoformat(),
            type="specific"
        ),
        Plan(
            id="222222222222222222222222",
            user_id="666666666666666666666666",
            goal="Meditation",
            times_per_week=3,
            sessions=[],
            created_at=datetime.now(UTC).isoformat(),
            type="times_per_week"
        ),
        Plan(
            id="333333333333333333333333",
            user_id="666666666666666666666666",
            goal="Reading",
            times_per_week=None,
            sessions=[],
            created_at=datetime.now(UTC).isoformat(),
            type="specific"
        )
    ]


@pytest.mark.asyncio
async def test_conversation_with_no_plans(
    test_user, empty_activities, empty_plans, memory
):
    # Setup
    assistant = WeekAnalyserAssistant(
        user=test_user,
        user_activities=empty_activities,
        user_plans=empty_plans,
        memory=memory,
    )

    # Simulate user message
    response, extracted = await assistant.get_response(
        "Hi, how are you doing today?",
    )

    # Assertions
    assert response is not None
    assert assistant.framework.execution_path == [
        "CheckMessageIntent_0",
        "ExtractPlanNames_0",
        "StartPlanLoop_0",
        "NextPlan_0",
        "Conclude_0",
    ]


@pytest.mark.asyncio
async def test_activity_extraction_with_no_plans(
    test_user, empty_activities, empty_plans, memory
):
    # Setup
    assistant = WeekAnalyserAssistant(
        user=test_user,
        user_activities=empty_activities,
        user_plans=empty_plans,
        memory=memory,
    )

    # Simulate user message about logging activity
    response, extracted = await assistant.get_response(
        "I went for a run yesterday",
    )

    # Assertions
    assert response is not None
    assert assistant.framework.execution_path == [
        "CheckMessageIntent_0",
        "ExitToActivityExtractor_0",
    ]


@pytest.mark.asyncio
async def test_plan_management_with_no_plans(
    test_user, empty_activities, empty_plans, memory
):
    # Setup
    assistant = WeekAnalyserAssistant(
        user=test_user,
        user_activities=empty_activities,
        user_plans=empty_plans,
        memory=memory,
    )

    # Simulate user message about changing plan sessions
    response, extracted = await assistant.get_response(
        "I want to change my running sessions for next week",
    )

    # Assertions
    assert response is not None
    assert assistant.framework.execution_path == [
        "CheckMessageIntent_0",
        "ExtractPlanName_0",
        "CheckPlanRelevance_0",
        "AnalyzePlanStatus_0",
        "SuggestChanges_0",
    ]


@pytest.mark.asyncio
async def test_change_times_per_week_with_multiple_plans(
    test_user, empty_activities, three_plans, memory
):
    # Setup
    assistant = WeekAnalyserAssistant(
        user=test_user,
        user_activities=empty_activities,
        user_plans=three_plans,
        memory=memory,
    )

    # Simulate user message about changing meditation times per week
    response, extracted = await assistant.get_response(
        "I want to change my meditation to 4 sessions per week",
    )

    # Assertions
    assert response is not None
    assert assistant.framework.execution_path == [
        "CheckMessageIntent_0",
        "ExtractPlanName_0",
        "CheckPlanRelevance_0",
        "AnalyzePlanStatus_0",
        "MakeChanges_0",
        "InformUserAboutChanges_0",
    ]