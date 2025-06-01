from typing import Dict, List, Optional, Union, Any
from datetime import datetime
from pydantic import BaseModel, Field
from ai.assistant.base_assistant import BaseAssistant
from ai.assistant.flowchart_framework import FlowchartLLMFramework
from ai.assistant.flowchart_nodes import Node
from controllers.plan_controller import PlanController
from entities.user import User
from entities.activity import Activity
from ai.suggestions import PlanDetailsSuggestion
from loguru import logger   
from bson import errors as bson_errors
from entities.plan import (
    Plan,
    PlanMilestone,
    PlanMilestoneCriteria,
    PlanMilestoneCriteriaGroup,
    PlanSession,
)
from gateways.activities import ActivitiesGateway
from ai.assistant.memory import DatabaseMemory
from fastapi import WebSocket
from bson import ObjectId
from ai.suggestions import AssistantSuggestion


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
    measure: str = Field(..., description=(
        "The unit of measurement to measure the activity. Note this should be as atomic as possible "
        "(e.g. 'marathons' or 'books' wouldn't be valid, but 'pages' or 'minutes' would be valid). For example, for 'reading' the measure could be 'pages',"
        "for 'running' the measure could be 'kilometers' or 'gym' could 'minutes' or 'sessions'."
        "note that for example 'sessions per week' would not be valid, as it is not a unit of single activity measurement,"
        "but rather a frequency of the activity."
    ))


class ExtractedPlanDetails(BaseModel):
    """Schema for the simplified plan extraction."""

    goal: str = Field(..., description="The goal of the plan")
    emoji: str = Field(..., description="The emoji of the plan, based on the goal")
    activities: List[ExtractedActivity] = Field(
        ...,
        description="List of activities for the new plan. Can be existing (include ID) or new (no ID)",
    )
    plan_type: str = Field(
        ...,
        description="Either 'specific' for specific dates or 'times_per_week' for frequency-based plans",
    )
    times_per_week: Optional[int] = Field(
        ...,
        description="The number of times per week the plan should be done. Only include this if the plan_type is 'times_per_week'",
    )
    sessions: Optional[List[PlanSession]] = Field(
        ...,
        description="Either a list of specific sessions or number of times per week",
    )

# Define a simplified flowchart for plan creation extraction
plan_creation_simple_flowchart = {
    "PlanScanner": Node(
        text="Based on the conversation history, did the user mention details about creating a plan?",
        connections={"Yes": "ExtractPlanDetails", "No": "Converse"},
        temperature=0.7,
    ),
    "ExtractPlanDetails": Node(
        text=(
            "Extract plan details from the user's message, including goal, activities, plan type, "
            "sessions, milestones, and finishing date. For activities not already in the user's list, "
            "generate appropriate IDs and measurement units (careful, these should be as atomic as possible!). Update plan_steps to indicate which elements "
            "were found in the message."
        ),
        output_schema=ExtractedPlanDetails,
        connections={"default": "InformUserAboutExtractedPlan"},
    ),
    "InformUserAboutExtractedPlan": Node(
        text="Inform the user that you've extracted their plan details, which they need to review and accept or reject.",
    ),
    "Converse": Node(
        text="Taking into account the conversation history flow, converse with the user in succinct messages. Your message must fit the conversation flow.",
        temperature=1,
    ),
}


class PlanCreationAssistant(BaseAssistant):
    """
    Simplified version of the PlanCreationAssistant that focuses on extracting
    plan details from user messages with a streamlined flowchart.

    This follows the same pattern as ActivityExtractorAssistant in activity_extractor_simple.py
    compared to the full implementation in activity_extractor.py.
    """

    def __init__(
        self,
        user: User,
        memory: DatabaseMemory,
        websocket: WebSocket = None,
    ):
        super().__init__(user, memory, websocket)
        self.activities_gateway = ActivitiesGateway()
        self.plan_controller = PlanController()

    def get_system_prompt(self) -> str:
        """
        Get system prompt for the plan creation assistant.
        """
        return f"""You are an AI assistant specialized in creating structured plans. Your role is to help users define their goals, 
identify activities, and create structured plans with sessions, milestones, and timelines.

When presented with a conversation history, extract plan details including:
1. The overall goal of the plan
2. Activities the user wants to include (with appropriate emoji and measurement units).
3. Plan type (specific dates or times per week)
4. Sessions (only if the plan is on a specific schedule)
5. Milestones (if mentioned)
6. Finishing date (if mentioned)

Be precise and thoughtful in your interpretations. If information is missing, make reasonable inferences
based on the user's goal. Format your response according to the required schema.

Analyse the conversation history as a whole, and not just the last message.

Today is {datetime.now().strftime('%b %d, %Y')}.
"""

    def get_flowchart(self) -> Dict[str, Any]:
        """
        Return the simplified flowchart for plan creation.
        """
        return plan_creation_simple_flowchart

    def get_context(self) -> Dict[str, Any]:
        """
        Get context for the plan creation assistant.
        """
        context = super().get_context()

        # Add plan-specific context
        existing_activities = self.activities_gateway.get_all_activities_by_user_id(
            self.user.id
        )
        existing_plans = self.plan_controller.get_all_user_active_plans(self.user)

        context.update(
            {
                "previous_existing_activities": [
                    {
                        "id": activity.id,
                        "title": activity.title,
                        "emoji": activity.emoji,
                        "measure": activity.measure,
                    }
                    for activity in existing_activities
                ],
                "previous_existing_plans": [
                    self.plan_controller.get_readable_plan(plan)
                    for plan in existing_plans
                ],
            }
        )

        return context

    async def handle_suggestions(self, extracted: Dict) -> List[AssistantSuggestion]:
        """
        Process extracted data and return suggestions.
        This creates suggestion objects that will be sent to the frontend.
        """
        suggestions: List[AssistantSuggestion] = []

        # Look for ExtractPlanDetails nodes in the extracted data
        for key, value in extracted.items():
            if key.startswith("ExtractPlanDetails_"):
                plan_data = extracted[key]

                activities = [
                    self.activities_gateway.get_activity_by_id(activity.id)
                    if activity.id and ObjectId.is_valid(activity.id)
                    else Activity.new(
                        user_id=self.user.id,
                        title=activity.title,
                        emoji=activity.emoji,
                        measure=activity.measure,
                    )
                    for activity in plan_data.activities
                ]

                # Format activities list as string
                activities_str = "\n".join(
                    f"- {activity.emoji} {activity.title} ({activity.measure})"
                    for activity in plan_data.activities
                )

                # Create human-readable message
                extraction_message = (
                    f"📋 Extracted Plan Details:\n"
                    f"Goal: {plan_data.emoji} {plan_data.goal}\n"
                    f"\nActivities:\n{activities_str}\n"
                    f"\nSchedule: {plan_data.times_per_week} times per week"
                )

                # Log or send the message (depending on your implementation)
                self.write_system_extraction_message("plan", extraction_message)

                suggestions.append(
                    PlanDetailsSuggestion.from_plan_and_activities_data(
                        Plan.new(
                            user_id=self.user.id,
                            goal=plan_data.goal,
                            emoji=plan_data.emoji,
                            outline_type=plan_data.plan_type,
                            times_per_week=plan_data.times_per_week,
                            activity_ids=[activity.id for activity in activities],
                        ),
                        activities=activities,
                    )
                )

        return suggestions
