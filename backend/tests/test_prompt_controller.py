from shared.logger import create_logger

create_logger()

import pytest
from datetime import datetime, UTC, timedelta
from controllers.prompt_controller import RecurrentMessageGenerator
from entities.user import User
from entities.plan import Plan, PlanMilestone, PlanMilestoneCriteria
from entities.activity import Activity
from entities.message import Message
from services.notification_manager import NotificationManager
from gateways.users import UsersGateway
from gateways.activities import ActivitiesGateway
from controllers.plan_controller import PlanController
from controllers.milestones_controller import MilestonesController
from unittest.mock import MagicMock, patch
from gateways.metrics import MetricsGateway
from entities.metric import Metric, MetricEntry
from entities.activity import ActivityEntry
from entities.notification import Notification


@pytest.fixture
def test_user():
    return User(
        id="666666666666666666666666",
        name="Test User",
        email="test@example.com",
        created_at=datetime.now(UTC).isoformat(),
        language="en"
    )

@pytest.fixture
def test_plan():
    return Plan.new(
        user_id="666666666666666666666666",
        goal="Get fit and read more",
        emoji="🎯",
        finishing_date=(datetime.now(UTC) + timedelta(days=30)).isoformat(),
        activity_ids=["activity1", "activity2"],
        milestones=[
            PlanMilestone(
                date=(datetime.now(UTC) + timedelta(days=7)).isoformat(),
                description="Complete 5 activities",
                criteria=[
                    PlanMilestoneCriteria(
                        activity_id="activity1",
                        quantity=5
                    )
                ]
            )
        ]
    )

@pytest.fixture
def test_activities():
    return [
        Activity.new(
            id="activity1",
            user_id="666666666666666666666666",
            title="Running",
            measure="minutes",
            emoji="🏃",
        ),
        Activity.new(
            id="activity2",
            user_id="666666666666666666666666",
            title="Reading",
            measure="minutes",
            emoji="📖",
        ),
    ]

@pytest.fixture
def test_metrics():
    return [
        Metric.new(
            user_id="666666666666666666666666",
            title="Energy",
            emoji="⚡️",
        ),
        Metric.new(
            user_id="666666666666666666666666",
            title="Mood",
            emoji="😊",
        ),
    ]

@pytest.fixture
def test_metric_entries(test_metrics):
    now = datetime.now(UTC)
    return [
        MetricEntry.new(
            user_id="666666666666666666666666",
            metric_id=test_metrics[0].id,
            rating=4,
            date=(now - timedelta(days=1)).isoformat(),
            description=None
        ),
        MetricEntry.new(
            user_id="666666666666666666666666",
            metric_id=test_metrics[1].id,
            rating=5,
            date=now.isoformat(),
            description=None
        ),
    ]

@pytest.fixture
def test_metric_entries_with_descriptions(test_metrics):
    now = datetime.now(UTC)
    return [
        MetricEntry.new(
            user_id="666666666666666666666666",
            metric_id=test_metrics[0].id,
            rating=4,
            date=(now - timedelta(days=1)).isoformat(),
            description="Feeling great after morning workout"
        ),
        MetricEntry.new(
            user_id="666666666666666666666666",
            metric_id=test_metrics[1].id,
            rating=5,
            date=now.isoformat(),
            description="Had a productive day and good interactions"
        ),
    ]

@pytest.fixture
def test_recent_milestone_notification():
    """Recent notification about milestone progress"""
    return Notification.new(
        message="You're making great progress on your milestone!",
        user_id="666666666666666666666666",
        type="info",
        created_at=(datetime.now(UTC) - timedelta(days=1)).isoformat()
    )

@pytest.fixture
def test_activity_entries():
    """Activity entries for the past week"""
    now = datetime.now(UTC)
    return [
        ActivityEntry.new(
            user_id="666666666666666666666666",
            activity_id="activity1",
            quantity=30,
            date=(now - timedelta(days=2)).isoformat(),
            description="Morning run"
        ),
        ActivityEntry.new(
            user_id="666666666666666666666666",
            activity_id="activity2",
            quantity=45,
            date=(now - timedelta(days=1)).isoformat(),
            description="Evening reading"
        )
    ]

@pytest.fixture
def test_milestone_update():
    """Readable milestone update"""
    return "Complete 3 more activities to reach First Milestone (5/8 completed)"

@pytest.fixture
def test_readable_plan():
    """Readable plan format"""
    return "Test Plan: Running (3/5 sessions this week) and Reading (2/3 sessions this week)"

@pytest.mark.asyncio
async def test_no_plans_no_messages(test_user):
    """Test scenario where user has no plans and no messages"""
    # Create generator instance
    generator = RecurrentMessageGenerator()
    
    # Mock instance attributes
    generator.users_gateway = MagicMock(spec=UsersGateway)
    generator.users_gateway.get_user_by_id.return_value = test_user
    
    generator.plan_controller = MagicMock(spec=PlanController)
    generator.plan_controller.get_all_user_active_plans.return_value = []
    
    generator.notification_manager = MagicMock(spec=NotificationManager)
    generator.notification_manager.get_last_notifications_sent_to_user.return_value = []
    
    message = await generator.generate_message(test_user.id, "user-recurrent-checkin")
    
    assert message is not None
    assert isinstance(message, str)
    # Verify execution path
    assert generator.framework.execution_path == [
        "CheckRecentNotifications_0",
        "HandleMilestoneUpdate_0"
    ]

@pytest.mark.asyncio
async def test_has_plans_no_milestones_no_milestone_messages(test_user, test_plan, test_activities):
    """Test scenario where user has plans but no milestones and no recent milestone messages"""
    # Remove milestones from test plan
    test_plan.milestones = []
    
    # Create generator instance
    generator = RecurrentMessageGenerator()
    
    # Mock instance attributes
    generator.users_gateway = MagicMock(spec=UsersGateway)
    generator.users_gateway.get_user_by_id.return_value = test_user
    
    generator.plan_controller = MagicMock(spec=PlanController)
    generator.plan_controller.get_all_user_active_plans.return_value = [test_plan]
    
    generator.milestones_controller = MagicMock(spec=MilestonesController)
    generator.milestones_controller.get_readable_next_milestone.return_value = None
    
    generator.notification_manager = MagicMock(spec=NotificationManager)
    generator.notification_manager.get_last_notifications_sent_to_user.return_value = []
    
    generator.activities_gateway = MagicMock(spec=ActivitiesGateway)
    generator.activities_gateway.get_all_activity_entries_by_user_id.return_value = []
    generator.activities_gateway.get_activity_by_id.side_effect = lambda aid: next((a for a in test_activities if a.id == aid), None)

    generator.metrics_gateway = MagicMock(spec=MetricsGateway)
    generator.metrics_gateway.get_all_metrics_by_user_id.return_value = []
    generator.metrics_gateway.get_all_metric_entries_by_user_id.return_value = []
    
    message = await generator.generate_message(test_user.id, "user-recurrent-checkin")
    
    assert message is not None
    assert isinstance(message, str)
    # Verify execution path
    assert generator.framework.execution_path == [
        "CheckRecentNotifications_0",
        "HandleMilestoneUpdate_0",
    ]
    # Should finish on HandleMilestoneUpdate node
    assert "milestone" in message.lower()

@pytest.mark.asyncio
async def test_has_plans_has_milestones_no_milestone_messages(test_user, test_plan, test_activities):
    """Test scenario where user has plans with milestones but no recent milestone messages"""
    # Create generator instance
    generator = RecurrentMessageGenerator()
    
    # Mock instance attributes
    generator.users_gateway = MagicMock(spec=UsersGateway)
    generator.users_gateway.get_user_by_id.return_value = test_user
    
    generator.plan_controller = MagicMock(spec=PlanController)
    generator.plan_controller.get_all_user_active_plans.return_value = [test_plan]
    
    generator.milestones_controller = MagicMock(spec=MilestonesController)
    generator.milestones_controller.get_readable_next_milestone.return_value = "Complete 3 more activities to reach First Milestone"
    
    generator.notification_manager = MagicMock(spec=NotificationManager)
    generator.notification_manager.get_last_notifications_sent_to_user.return_value = []
    
    generator.activities_gateway = MagicMock(spec=ActivitiesGateway)
    generator.activities_gateway.get_all_activity_entries_by_user_id.return_value = []
    generator.activities_gateway.get_activity_by_id.side_effect = lambda aid: next((a for a in test_activities if a.id == aid), None)

    generator.metrics_gateway = MagicMock(spec=MetricsGateway)
    generator.metrics_gateway.get_all_metrics_by_user_id.return_value = []
    generator.metrics_gateway.get_all_metric_entries_by_user_id.return_value = []
    
    message = await generator.generate_message(test_user.id, "user-recurrent-checkin")
    
    assert message is not None
    assert isinstance(message, str)
    # Verify execution path
    assert generator.framework.execution_path == [
        "CheckRecentNotifications_0",
        'HandleMilestoneUpdate_0',
    ]
    # Should finish on HandleMilestoneUpdate node
    assert "milestone" in message.lower()

@pytest.mark.asyncio
async def test_has_plans_has_milestones_has_messages(test_user, test_plan, test_activities, test_recent_milestone_notification):
    """Test scenario where user has plans, milestones, and recent milestone messages"""
    # Create generator instance
    generator = RecurrentMessageGenerator()
    
    # Mock instance attributes
    generator.users_gateway = MagicMock(spec=UsersGateway)
    generator.users_gateway.get_user_by_id.return_value = test_user
    
    generator.plan_controller = MagicMock(spec=PlanController)
    generator.plan_controller.get_all_user_active_plans.return_value = [test_plan]
    
    generator.milestones_controller = MagicMock(spec=MilestonesController)
    generator.milestones_controller.get_readable_next_milestone.return_value = "Complete 3 more activities to reach First Milestone"
    
    generator.notification_manager = MagicMock(spec=NotificationManager)
    generator.notification_manager.get_last_notifications_sent_to_user.return_value = [test_recent_milestone_notification]
    
    generator.activities_gateway = MagicMock(spec=ActivitiesGateway)
    generator.activities_gateway.get_all_activity_entries_by_user_id.return_value = []
    generator.activities_gateway.get_activity_by_id.side_effect = lambda aid: next((a for a in test_activities if a.id == aid), None)

    generator.metrics_gateway = MagicMock(spec=MetricsGateway)
    generator.metrics_gateway.get_all_metrics_by_user_id.return_value = []
    generator.metrics_gateway.get_all_metric_entries_by_user_id.return_value = []
    
    message = await generator.generate_message(test_user.id, "user-recurrent-checkin")
    
    assert message is not None
    assert isinstance(message, str)
    # Verify execution path
    assert generator.framework.execution_path == [
        "CheckRecentNotifications_0",
        "CheckRecentMetrics_0",
        "AskForMetricsEntries_0"
    ]
    # Verify message content
    assert "track" in message.lower() or "log" in message.lower()

@pytest.mark.asyncio
async def test_has_metrics_no_description(
    test_user, 
    test_plan,
    test_metrics,
    test_metric_entries,
    test_recent_milestone_notification,
    test_activity_entries,
    test_milestone_update,
    test_readable_plan
):
    """Test scenario where user has metrics but without descriptions"""
    # Create generator instance
    generator = RecurrentMessageGenerator()
    
    # Mock instance attributes
    generator.users_gateway = MagicMock(spec=UsersGateway)
    generator.users_gateway.get_user_by_id.return_value = test_user
    
    generator.plan_controller = MagicMock(spec=PlanController)
    generator.plan_controller.get_all_user_active_plans.return_value = [test_plan]
    generator.plan_controller.get_readable_plan.return_value = test_readable_plan
    
    generator.milestones_controller = MagicMock(spec=MilestonesController)
    generator.milestones_controller.get_readable_next_milestone.return_value = test_milestone_update
    
    generator.notification_manager = MagicMock(spec=NotificationManager)
    generator.notification_manager.get_last_notifications_sent_to_user.return_value = [test_recent_milestone_notification]
    
    generator.activities_gateway = MagicMock(spec=ActivitiesGateway)
    generator.activities_gateway.get_all_activity_entries_by_user_id.return_value = test_activity_entries

    generator.metrics_gateway = MagicMock(spec=MetricsGateway)
    generator.metrics_gateway.get_all_metrics_by_user_id.return_value = test_metrics
    generator.metrics_gateway.get_all_metric_entries_by_user_id.return_value = test_metric_entries
    
    message = await generator.generate_message(test_user.id, "user-recurrent-checkin")
    
    assert message is not None
    assert isinstance(message, str)
    # Verify execution path
    assert generator.framework.execution_path == [
        "CheckRecentNotifications_0",
        "CheckRecentMetrics_0",
        "CheckRecentMetricsMessages_0",
        "AskForMetricEntryDescription_0"
    ]
    # Verify message content
    assert "why" in message.lower() or "rated" in message.lower() or "mood" in message.lower()

@pytest.mark.asyncio
async def test_has_metrics_with_description(
    test_user,
    test_plan,
    test_metrics,
    test_metric_entries_with_descriptions,
    test_recent_milestone_notification,
    test_activity_entries,
    test_milestone_update,
    test_readable_plan
):
    """Test scenario where user has metrics with descriptions"""
    # Create generator instance
    generator = RecurrentMessageGenerator()
    
    # Mock instance attributes
    generator.users_gateway = MagicMock(spec=UsersGateway)
    generator.users_gateway.get_user_by_id.return_value = test_user
    
    generator.plan_controller = MagicMock(spec=PlanController)
    generator.plan_controller.get_all_user_active_plans.return_value = [test_plan]
    
    generator.milestones_controller = MagicMock(spec=MilestonesController)
    generator.milestones_controller.get_readable_next_milestone.return_value = test_milestone_update
    
    generator.notification_manager = MagicMock(spec=NotificationManager)
    generator.notification_manager.get_last_notifications_sent_to_user.return_value = [test_recent_milestone_notification]
    
    generator.activities_gateway = MagicMock(spec=ActivitiesGateway)
    generator.activities_gateway.get_all_activity_entries_by_user_id.return_value = test_activity_entries

    generator.metrics_gateway = MagicMock(spec=MetricsGateway)
    generator.metrics_gateway.get_all_metrics_by_user_id.return_value = test_metrics
    generator.metrics_gateway.get_all_metric_entries_by_user_id.return_value = test_metric_entries_with_descriptions
    
    message = await generator.generate_message(test_user.id, "user-recurrent-checkin")
    
    assert message is not None
    assert isinstance(message, str)
    # Verify execution path
    assert generator.framework.execution_path == [
        "CheckRecentNotifications_0",
        "CheckRecentMetrics_0",
        "AnalyzeWeeklyProgress_0"
    ]
    # Verify message content
    assert any(word in message.lower() for word in ["week", "session", "progress"]) 

@pytest.mark.asyncio
async def test_has_metrics_no_description_but_recent_messages(
    test_user, 
    test_plan,
    test_metrics,
    test_metric_entries,
    test_recent_milestone_notification,
    test_activity_entries,
    test_milestone_update,
    test_readable_plan
):
    """Test scenario where user has metrics without descriptions but has recent metrics messages"""
    # Create generator instance
    generator = RecurrentMessageGenerator()
    
    # Mock instance attributes
    generator.users_gateway = MagicMock(spec=UsersGateway)
    generator.users_gateway.get_user_by_id.return_value = test_user
    
    generator.plan_controller = MagicMock(spec=PlanController)
    generator.plan_controller.get_all_user_active_plans.return_value = [test_plan]
    generator.plan_controller.get_readable_plan.return_value = test_readable_plan
    
    generator.milestones_controller = MagicMock(spec=MilestonesController)
    generator.milestones_controller.get_readable_next_milestone.return_value = test_milestone_update
    
    generator.notification_manager = MagicMock(spec=NotificationManager)
    # Add a recent metrics-related message
    metrics_notification = Notification.new(
        message="How are you feeling about your metrics? Can you tell me more about your ratings?",
        user_id="666666666666666666666666",
        type="info",
        created_at=(datetime.now(UTC) - timedelta(days=1)).isoformat()
    )
    generator.notification_manager.get_last_notifications_sent_to_user.return_value = [
        test_recent_milestone_notification,
        metrics_notification
    ]
    
    generator.activities_gateway = MagicMock(spec=ActivitiesGateway)
    generator.activities_gateway.get_all_activity_entries_by_user_id.return_value = test_activity_entries

    generator.metrics_gateway = MagicMock(spec=MetricsGateway)
    generator.metrics_gateway.get_all_metrics_by_user_id.return_value = test_metrics
    generator.metrics_gateway.get_all_metric_entries_by_user_id.return_value = test_metric_entries
    
    message = await generator.generate_message(test_user.id, "user-recurrent-checkin")
    
    assert message is not None
    assert isinstance(message, str)
    # Verify execution path
    assert generator.framework.execution_path == [
        "CheckRecentNotifications_0",
        "CheckRecentMetrics_0",
        "CheckRecentMetricsMessages_0",
        "AnalyzeWeeklyProgress_0"
    ]
    # Verify message content
    assert any(word in message.lower() for word in ["week", "session", "progress"]) 