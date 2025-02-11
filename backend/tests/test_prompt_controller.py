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

@pytest.mark.asyncio
async def test_no_plans_no_messages(test_user):
    """Test scenario where user has no plans and no messages"""
    # Mock dependencies
    users_gateway = MagicMock(spec=UsersGateway)
    users_gateway.get_user_by_id.return_value = test_user
    
    plan_controller = MagicMock(spec=PlanController)
    plan_controller.get_all_user_active_plans.return_value = []
    
    notification_manager = MagicMock(spec=NotificationManager)
    notification_manager.get_last_notifications_sent_to_user.return_value = []
    
    with patch('gateways.users.UsersGateway', return_value=users_gateway), \
         patch('controllers.plan_controller.PlanController', return_value=plan_controller), \
         patch('services.notification_manager.NotificationManager', return_value=notification_manager):
        
        generator = RecurrentMessageGenerator()
        message = await generator.generate_message(test_user.id, "user-recurrent-checkin")
        
        assert message is not None
        assert isinstance(message, str)

@pytest.mark.asyncio
async def test_has_plans_no_milestones_no_messages(test_user, test_plan, test_activities):
    """Test scenario where user has plans but no milestones and no recent milestone messages"""
    # Remove milestones from test plan
    test_plan.milestones = []
    
    # Mock dependencies
    users_gateway = MagicMock(spec=UsersGateway)
    users_gateway.get_user_by_id.return_value = test_user
    
    plan_controller = MagicMock(spec=PlanController)
    plan_controller.get_all_user_active_plans.return_value = [test_plan]
    plan_controller.get_readable_plan.return_value = "Test Plan with Running and Reading activities"
    
    milestones_controller = MagicMock(spec=MilestonesController)
    milestones_controller.get_readable_next_milestone.return_value = None
    
    notification_manager = MagicMock(spec=NotificationManager)
    notification_manager.get_last_notifications_sent_to_user.return_value = []
    
    activities_gateway = MagicMock(spec=ActivitiesGateway)
    activities_gateway.get_all_activity_entries_by_user_id.return_value = []
    
    with patch('gateways.users.UsersGateway', return_value=users_gateway), \
         patch('controllers.plan_controller.PlanController', return_value=plan_controller), \
         patch('controllers.milestones_controller.MilestonesController', return_value=milestones_controller), \
         patch('services.notification_manager.NotificationManager', return_value=notification_manager), \
         patch('gateways.activities.ActivitiesGateway', return_value=activities_gateway):
        
        generator = RecurrentMessageGenerator()
        message = await generator.generate_message(test_user.id, "user-recurrent-checkin")
        
        assert message is not None
        assert isinstance(message, str)
        # Should finish on HandleMilestoneUpdate node
        assert "milestone" in message.lower()

@pytest.mark.asyncio
async def test_has_plans_has_milestones_no_messages(test_user, test_plan, test_activities):
    """Test scenario where user has plans with milestones but no recent milestone messages"""
    # Mock dependencies
    users_gateway = MagicMock(spec=UsersGateway)
    users_gateway.get_user_by_id.return_value = test_user
    
    plan_controller = MagicMock(spec=PlanController)
    plan_controller.get_all_user_active_plans.return_value = [test_plan]
    plan_controller.get_readable_plan.return_value = "Test Plan with Running and Reading activities"
    
    milestones_controller = MagicMock(spec=MilestonesController)
    milestones_controller.get_readable_next_milestone.return_value = "Complete 3 more activities to reach First Milestone"
    
    notification_manager = MagicMock(spec=NotificationManager)
    notification_manager.get_last_notifications_sent_to_user.return_value = []
    
    activities_gateway = MagicMock(spec=ActivitiesGateway)
    activities_gateway.get_all_activity_entries_by_user_id.return_value = []
    
    with patch('gateways.users.UsersGateway', return_value=users_gateway), \
         patch('controllers.plan_controller.PlanController', return_value=plan_controller), \
         patch('controllers.milestones_controller.MilestonesController', return_value=milestones_controller), \
         patch('services.notification_manager.NotificationManager', return_value=notification_manager), \
         patch('gateways.activities.ActivitiesGateway', return_value=activities_gateway):
        
        generator = RecurrentMessageGenerator()
        message = await generator.generate_message(test_user.id, "user-recurrent-checkin")
        
        assert message is not None
        assert isinstance(message, str)
        # Should finish on HandleMilestoneUpdate node
        assert "milestone" in message.lower()

@pytest.mark.asyncio
async def test_has_plans_has_milestones_has_messages(test_user, test_plan, test_activities):
    """Test scenario where user has plans, milestones, and recent milestone messages"""
    # Create a recent milestone notification
    recent_notification = MagicMock()
    recent_notification.message = "You're making great progress on your milestone!"
    recent_notification.created_at = (datetime.now(UTC) - timedelta(days=1)).isoformat()
    
    # Mock dependencies
    users_gateway = MagicMock(spec=UsersGateway)
    users_gateway.get_user_by_id.return_value = test_user
    
    plan_controller = MagicMock(spec=PlanController)
    plan_controller.get_all_user_active_plans.return_value = [test_plan]
    plan_controller.get_readable_plan.return_value = "Test Plan with Running and Reading activities"
    
    milestones_controller = MagicMock(spec=MilestonesController)
    milestones_controller.get_readable_next_milestone.return_value = "Complete 3 more activities to reach First Milestone"
    
    notification_manager = MagicMock(spec=NotificationManager)
    notification_manager.get_last_notifications_sent_to_user.return_value = [recent_notification]
    
    activities_gateway = MagicMock(spec=ActivitiesGateway)
    activities_gateway.get_all_activity_entries_by_user_id.return_value = []
    
    with patch('gateways.users.UsersGateway', return_value=users_gateway), \
         patch('controllers.plan_controller.PlanController', return_value=plan_controller), \
         patch('controllers.milestones_controller.MilestonesController', return_value=milestones_controller), \
         patch('services.notification_manager.NotificationManager', return_value=notification_manager), \
         patch('gateways.activities.ActivitiesGateway', return_value=activities_gateway):
        
        generator = RecurrentMessageGenerator()
        message = await generator.generate_message(test_user.id, "user-recurrent-checkin")
        
        assert message is not None
        assert isinstance(message, str)
        # Should finish on AnalyzeWeeklyProgress node
        assert any(word in message.lower() for word in ["week", "session", "progress"]) 