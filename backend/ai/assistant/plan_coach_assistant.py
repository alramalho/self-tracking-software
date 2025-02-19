import json
from pydantic import BaseModel, Field
from typing import List, Tuple, Dict, Any, Literal, Optional, Union
from ai.assistant.memory import Memory
from entities.message import Message, Emotion
from entities.user import User
from entities.activity import Activity
from entities.plan import Plan, PlanSession, PlanMilestone, PlanMilestoneCriteriaGroup
from datetime import datetime, timedelta
from loguru import logger
from pydantic_ai import Agent, RunContext
from controllers.plan_controller import PlanController
from gateways.activities import ActivitiesGateway
from controllers.milestones_controller import MilestonesController

class PlanCoachAgent:
    def __init__(
        self,
        user: User,
        memory: Memory,
    ):
        self.name = "Jarvis"
        self.memory = memory
        self.user = user
        self.plan_controller = PlanController()
        self.activities_gateway = ActivitiesGateway()
        self.milestones_controller = MilestonesController()

    async def suggest_new_plan_milestones(self, ctx: RunContext[dict], new_milestones: List[PlanMilestone]) -> dict:
        """Suggest changes to the plan if needed based on user's progress and feedback.
        Returns the milestones with activity names and emojis added to the criteria.
        
        """
        logger.info(f"Suggesting new plan milestones: {new_milestones}")
        
        # Create a mapping of activity IDs to their titles and emojis for quick lookup
        activities = self.activities_gateway.get_all_activities_by_user_id(self.user.id)
        activity_map = {
            activity.id: {"title": activity.title, "emoji": activity.emoji}
            for activity in activities
        }

        def process_criterion(criterion):
            if isinstance(criterion, PlanMilestoneCriteriaGroup):
                return {
                    "junction": criterion.junction,
                    "criteria": [process_criterion(c) for c in criterion.criteria]
                }
            else:  # PlanMilestoneCriteria
                activity_info = activity_map.get(criterion.activity_id, {"title": "Unknown Activity", "emoji": "❓"})
                return {
                    **criterion.dict(),
                    "activity_name": activity_info["title"],
                    "activity_emoji": activity_info["emoji"]
                }

        enhanced_milestones = []
        for milestone in new_milestones:
            milestone_dict = milestone.dict()
            if milestone.criteria:
                milestone_dict["criteria"] = [
                    process_criterion(criterion)
                    for criterion in milestone.criteria
                ]
            enhanced_milestones.append(milestone_dict)

        print(f"SUGGESTED MILESTONES: \n{enhanced_milestones}")
        return {"suggested milestones": enhanced_milestones}

    async def get_response(
        self, user_input: str, message_id: str = None, emotions: List[Emotion] = []
    ) -> Tuple[str, Optional[Plan]]:
        """Process user input and return a coaching response and optionally an adjusted plan."""
        
        # Write user message to memory
        self.memory.write(
            Message.new(
                id=message_id,
                text=user_input,
                sender_name=self.user.name,
                sender_id=self.user.id,
                recipient_name=self.name,
                recipient_id="0",
                emotions=emotions,
            )
        )


        user_active_plans = self.plan_controller.get_all_user_active_plans(self.user)
        user_most_important_plan = user_active_plans[0] if len(user_active_plans) > 0 else None
        plan_activity_entry_history = []
        for activity_id in user_most_important_plan.activity_ids:
            plan_activity_entry_history.extend(self.activities_gateway.get_all_activity_entries_by_activity_id(activity_id))

        plan_activity_entry_history = sorted(plan_activity_entry_history, key=lambda x: x.date, reverse=True)
        user_activitiy_history = "\n".join([self.activities_gateway.get_readable_activity_entry(entry) for entry in plan_activity_entry_history])
        user_milestones = user_most_important_plan.milestones
        user_milestones_history = self.milestones_controller.get_readable_next_milestone(user_most_important_plan)

        # Create context for the agent
        context = {
            "most important plan": [user_most_important_plan.dict()] if user_most_important_plan else "user has no active plans",
            "plan next milestone": user_milestones_history, 
            "user": self.user.dict()    ,
            "plan activity history": user_activitiy_history,
            "conversation history": self.memory.read_all_as_str(max_words=1000, max_age_in_minutes=3*60),
            "message": user_input,
            "emotions": [emotion.dict() for emotion in emotions],
            "today's date": datetime.now().strftime("%Y-%m-%d")
        }
        
        agent = Agent(
            # 'mistral:mistral-small-latest',
            'openai:gpt-4o-mini',
            deps_type=dict,
            result_type=str,
            system_prompt=(
                f'You are {self.name}, an AI coach helping users stay improve consistency with their plans. '
                'Analyze the plan and user context and conversation history to determine if changes are needed.'
                'Your analysis should be driven by the user own set plan milestones, which the goal is serving as longer term targets (longer than weeks) to motivate the user.'
                'Your focus should be on the user improving their consistency, and not exactly completely fullfilling or maxxing the milestone or plan. Improving >> Perfection.'
                'You are only analyzing the first plan in the user\'s list, which he/she identified as the most important one. '
                'If changes are needed, use the suggest_new_plan_milestones tool to propose milestones modifications (subject to user\'s approval). '
                'Your output should be a message to the user. '
                'Your responses should be empathetic, focusing on helping users '
                'achieve their goals while maintaining realistic expectations.'
                'Context about the user: ' + str(json.dumps(context, indent=2))
            ),
            tools=[self.suggest_new_plan_milestones]
        )


        

        # Run the agent
        result = await agent.run(user_input, deps=context)
        
        # Extract the response message and any plan changes
        response_message = result.data  # This will contain the agent's explanation

        # Write assistant's response to memory
        self.memory.write(
            Message.new(
                text=response_message,
                sender_name=self.name,
                sender_id="0",
                recipient_name=self.user.name,
                recipient_id=self.user.id,
            )
        )

        return response_message, None 