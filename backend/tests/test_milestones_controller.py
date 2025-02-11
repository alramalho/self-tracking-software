from shared.logger import create_logger
create_logger()
from datetime import datetime, timedelta, UTC
from entities.plan import Plan, PlanMilestone, PlanMilestoneCriteria, PlanMilestoneCriteriaGroup
from entities.activity import ActivityEntry
from controllers.milestones_controller import MilestonesController

class TestMilestonesController:
    def setup_method(self):
        self.controller = MilestonesController()
        self.user_id = "test_user"
        self.base_date = datetime.now(UTC)
        
    def create_activity_entry(self, activity_id: str, quantity: int, date_offset_days: int = 0) -> ActivityEntry:
        """Helper to create activity entries"""
        entry_date = self.base_date + timedelta(days=date_offset_days)
        return ActivityEntry.new(
            id="test_entry",
            user_id=self.user_id,
            activity_id=activity_id,
            quantity=quantity,
            date=entry_date.isoformat(),
        )

    def test_simple_milestone_progress(self, mocker):
        """Test progress calculation for a simple milestone with one criterion"""
        # Mock the activities gateway
        mock_gateway = mocker.patch.object(self.controller, 'activities_gateway')
        mock_gateway.get_all_activity_entries_by_user_id.return_value = [
            self.create_activity_entry("reading", 50)
        ]

        # Create a simple milestone
        milestone = PlanMilestone(
            description="Reading Goal",
            date=(self.base_date + timedelta(days=7)).isoformat(),
            criteria=[
                PlanMilestoneCriteria(
                    activity_id="reading",
                    quantity=100
                )
            ]
        )

        plan = Plan.new(
            id="test_plan",
            user_id=self.user_id,
            goal="Read more books",
            emoji="📚",
            finishing_date=(self.base_date + timedelta(days=30)).isoformat(),
            milestones=[milestone],
            sessions=[],
            activity_ids=[]
        )

        result = self.controller.calculate_plan_milestones_progress(plan)
        assert result.next_milestone is not None
        assert result.next_milestone.progress == 50
        assert not result.next_milestone.is_completed

    def test_and_group_milestone_progress(self, mocker):
        """Test progress calculation for a milestone with AND group"""
        mock_gateway = mocker.patch.object(self.controller, 'activities_gateway')
        mock_gateway.get_all_activity_entries_by_user_id.return_value = [
            self.create_activity_entry("reading", 60),
            self.create_activity_entry("writing", 5)
        ]

        milestone = PlanMilestone(
            description="Combined Goal",
            date=(self.base_date + timedelta(days=7)).isoformat(),
            criteria=[
                PlanMilestoneCriteriaGroup(
                    junction="AND",
                    criteria=[
                        PlanMilestoneCriteria(activity_id="reading", quantity=100),
                        PlanMilestoneCriteria(activity_id="writing", quantity=10)
                    ]
                )
            ]
        )

        plan = Plan.new(
            id="test_plan",
            user_id=self.user_id,
            goal="Read and write more",
            emoji="📝",
            finishing_date=(self.base_date + timedelta(days=30)).isoformat(),
            milestones=[milestone],
            sessions=[],
            activity_ids=[]
        )

        result = self.controller.calculate_plan_milestones_progress(plan)
        assert result.next_milestone is not None
        assert result.next_milestone.progress == 50  # Both at 50%
        assert not result.next_milestone.is_completed

    def test_or_group_milestone_progress(self, mocker):
        """Test progress calculation for a milestone with OR group"""
        mock_gateway = mocker.patch.object(self.controller, 'activities_gateway')
        mock_gateway.get_all_activity_entries_by_user_id.return_value = [
            self.create_activity_entry("reading", 80),
            self.create_activity_entry("writing", 2)
        ]

        milestone = PlanMilestone(
            description="Alternative Goal",
            date=(self.base_date + timedelta(days=7)).isoformat(),
            criteria=[
                PlanMilestoneCriteriaGroup(
                    junction="OR",
                    criteria=[
                        PlanMilestoneCriteria(activity_id="reading", quantity=100),
                        PlanMilestoneCriteria(activity_id="writing", quantity=10)
                    ]
                )
            ]
        )

        plan = Plan.new(
            id="test_plan",
            user_id=self.user_id,
            goal="Improve communication skills",
            emoji="💭",
            finishing_date=(self.base_date + timedelta(days=30)).isoformat(),
            milestones=[milestone],
            sessions=[],
            activity_ids=[]
        )

        result = self.controller.calculate_plan_milestones_progress(plan)
        assert result.next_milestone is not None
        assert result.next_milestone.progress == 80  # Takes max progress (reading at 80%)
        assert not result.next_milestone.is_completed

    def test_nested_groups_milestone_progress(self, mocker):
        """Test progress calculation for a milestone with nested AND/OR groups"""
        mock_gateway = mocker.patch.object(self.controller, 'activities_gateway')
        mock_gateway.get_all_activity_entries_by_user_id.return_value = [
            self.create_activity_entry("reading", 80),
            self.create_activity_entry("writing", 2),
            self.create_activity_entry("exercise", 30)
        ]

        milestone = PlanMilestone(
            description="Complex Goal",
            date=(self.base_date + timedelta(days=7)).isoformat(),
            criteria=[
                PlanMilestoneCriteriaGroup(
                    junction="AND",
                    criteria=[
                        PlanMilestoneCriteriaGroup(
                            junction="OR",
                            criteria=[
                                PlanMilestoneCriteria(activity_id="reading", quantity=100),
                                PlanMilestoneCriteria(activity_id="writing", quantity=10)
                            ]
                        ),
                        PlanMilestoneCriteria(activity_id="exercise", quantity=100)
                    ]
                )
            ]
        )

        plan = Plan.new(
            id="test_plan",
            user_id=self.user_id,
            goal="Mind and body improvement",
            emoji="🎯",
            finishing_date=(self.base_date + timedelta(days=30)).isoformat(),
            milestones=[milestone],
            sessions=[],
            activity_ids=[]
        )

        result = self.controller.calculate_plan_milestones_progress(plan)
        assert result.next_milestone is not None
        assert result.next_milestone.progress == 30  # Min between OR group (80%) and exercise (30%)
        assert not result.next_milestone.is_completed

    def test_completed_milestone(self, mocker):
        """Test progress calculation for a completed milestone"""
        mock_gateway = mocker.patch.object(self.controller, 'activities_gateway')
        mock_gateway.get_all_activity_entries_by_user_id.return_value = [
            self.create_activity_entry("reading", 100)
        ]

        milestone = PlanMilestone(
            description="Reading Goal",
            date=(self.base_date + timedelta(days=7)).isoformat(),
            criteria=[
                PlanMilestoneCriteria(
                    activity_id="reading",
                    quantity=100
                )
            ]
        )

        plan = Plan.new(
            id="test_plan",
            user_id=self.user_id,
            goal="Complete reading challenge",
            emoji="📚",
            finishing_date=(self.base_date + timedelta(days=30)).isoformat(),
            milestones=[milestone],
            sessions=[],
            activity_ids=[]
        )

        result = self.controller.calculate_plan_milestones_progress(plan)
        assert result.next_milestone is not None
        assert result.next_milestone.progress == 100
        assert result.next_milestone.is_completed

    def test_readable_milestone_format(self, mocker):
        """Test the readable format of milestone progress"""
        mock_gateway = mocker.patch.object(self.controller, 'activities_gateway')
        mock_gateway.get_all_activity_entries_by_user_id.return_value = [
            self.create_activity_entry("reading", 50),
            self.create_activity_entry("writing", 5)
        ]

        milestone = PlanMilestone(
            description="Combined Goal",
            date=(self.base_date + timedelta(days=7)).isoformat(),
            criteria=[
                PlanMilestoneCriteriaGroup(
                    junction="AND",
                    criteria=[
                        PlanMilestoneCriteria(activity_id="reading", quantity=100),
                        PlanMilestoneCriteria(activity_id="writing", quantity=10)
                    ]
                )
            ]
        )

        plan = Plan.new(
            id="test_plan",
            user_id=self.user_id,
            goal="Master communication",
            emoji="✍️",
            finishing_date=(self.base_date + timedelta(days=30)).isoformat(),
            milestones=[milestone],
            sessions=[],
            activity_ids=[]
        )

        result = self.controller.get_readable_next_milestone(plan)
        assert "Combined Goal" in result
        assert "50" in result  # Progress percentage
        assert "100" in result  # Target quantity
        assert "AND" in result  # Junction type 