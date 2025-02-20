from typing import Dict, List, Optional, Union, Literal
from pydantic import BaseModel, Field
from datetime import datetime
from ai.assistant.flowchart_framework import FlowchartLLMFramework
from ai.assistant.flowchart_nodes import Node
from controllers.plan_controller import PlanController
from entities.plan import (
    Plan,
    PlanMilestone,
    PlanMilestoneCriteria,
    PlanMilestoneCriteriaGroup,
)
from entities.user import User
from bson import ObjectId
from fastapi import WebSocket
from ai.assistant.memory import DatabaseMemory
from entities.message import Message, Emotion
from ai.suggestions import AssistantSuggestion
from loguru import logger

# -------------------------------
# Pydantic Models for Output Schemas
# -------------------------------


class GoalAnalysis(BaseModel):
    goal: str = Field(..., description="The goal of the plan")
    emoji: str = Field(
        ...,
        description="Emoji representing the goal (does not need user input, you might suggest this based on goal)",
    )


class PrioritizationAnalysis(BaseModel):
    priority: int = Field(..., description="The plan's priority or index")


class Activity(BaseModel):
    activity_name: str = Field(..., description="Name of the activity")
    emoji: str = Field(..., description="Emoji representing the activity")
    measure: str = Field(..., description="Unit of measurement for the activity")


class ActivityAnalysis(BaseModel):
    activities: List[Activity] = Field(
        ..., description="List of activities with details"
    )


class PlanTypeAnalysis(BaseModel):
    plan_type: str = Field(
        ..., description="Type of plan: either 'times_per_week' or 'specific'"
    )


class Session(BaseModel):
    date: str = Field(..., description="Session date in YYYY-MM-DD format")
    activity_name: str = Field(
        ..., description="Activity name associated with the session"
    )
    activity_id: str = Field(
        ..., description="Activity id associated with the session"
    )
    quantity: float = Field(
        ..., description="Quantity for the session based on the activity's measure"
    )


class SessionExtraction(BaseModel):
    sessions: List[Session] = Field(
        ..., description="List of session objects for a specific plan"
    )


class TimesPerWeekFrequencyExtraction(BaseModel):
    times_per_week_frequency: int = Field(
        ..., description="Number of times per week for the activities"
    )


class MilestoneAnalysis(BaseModel):
    milestones: List[PlanMilestone] = Field(
        ..., description="List of milestones for the plan"
    )


class PlanMilestoneSuggestion(AssistantSuggestion):
    type: str = "plan_milestones"

    @classmethod
    def from_milestone_analysis(cls, milestone_data: MilestoneAnalysis):
        return cls(
            data={
                "milestones": [
                    {
                        "description": milestone.description,
                        "date": milestone.date,
                        "criteria": milestone.criteria,
                        "progress": milestone.progress,
                    }
                    for milestone in milestone_data.milestones
                ]
            }
        )


class PlanGoalSuggestion(AssistantSuggestion):
    type: str = "plan_goal"

    @classmethod
    def from_goal_analysis(cls, goal_data: GoalAnalysis):
        return cls(data={"goal": goal_data.goal})


class PlanActivitiesSuggestion(AssistantSuggestion):
    type: str = "plan_activities"

    @classmethod
    def from_activity_analysis(cls, activities_data: ActivityAnalysis):
        return cls(
            data={
                "activities": [
                    {
                        "activity_name": activity.activity_name,
                        "emoji": activity.emoji,
                        "measure": activity.measure,
                    }
                    for activity in activities_data.activities
                ]
            }
        )


class PlanTypeSuggestion(AssistantSuggestion):
    type: str = "plan_type"

    @classmethod
    def from_plan_type(cls, plan_type_data: PlanTypeAnalysis):
        return cls(data={"plan_type": plan_type_data.plan_type})


class PlanSessionsSuggestion(AssistantSuggestion):
    type: str = "plan_sessions"

    @classmethod
    def from_sessions(
        cls, sessions_data: Union[SessionExtraction, TimesPerWeekFrequencyExtraction]
    ):
        if isinstance(sessions_data, SessionExtraction):
            return cls(
                data={
                    "sessions": [
                        {
                            "date": session.date,
                            "activity_id": session.activity_id,
                            "activity_name": session.activity_name,
                            "quantity": session.quantity,
                        }
                        for session in sessions_data.sessions
                    ]
                }
            )
        else:
            return cls(data={"sessions": sessions_data.times_per_week_frequency})


class FinishingDateAnalysis(BaseModel):
    finishing_date: str = Field(
        ..., description="The finishing date in YYYY-MM-DD format"
    )
    explanation: Optional[str] = Field(
        None, description="Optional explanation for the chosen date"
    )


class PlanFinishingDateSuggestion(AssistantSuggestion):
    type: str = "plan_finishing_date"

    @classmethod
    def from_finishing_date_analysis(cls, finishing_date_data: FinishingDateAnalysis):
        return cls(
            data={
                "finishing_date": finishing_date_data.finishing_date,
                "explanation": finishing_date_data.explanation,
            }
        )


# -------------------------------
# Flowchart Graph Definition
# -------------------------------

plan_creation_flowchart = {
    "PlanCreationScanner": Node(
        text=(
            "Based on the conversation history, did the user explicitly express interest in creating a new plan or goal?\n\n"
            "Choose:\n"
            '- "Yes" if the user has clearly indicated they want to create a new plan.\n'
            '- "No_GeneralConversation" if the user is just having a general conversation or discussing something else.\n'
            '- "No_UserRejected" if the user has recently rejected your plan suggestion.'
        ),
        connections={
            "Yes": "AnalyzeGoal",
            "No_GeneralConversation": "Converse",
            "No_UserRejected": "AskWhyRejected",
        },
    ),
    "Converse": Node(
        text=(
            "Taking into account the conversation history flow (and 'System' messages if present), "
            "converse with the user in succinct messages. Your message must fit the conversation flow "
            "but be aligned with your goal as assistant."
        ),
        temperature=1.0,
    ),
    "AskWhyRejected": Node(
        text=(
            "Ask the user why they rejected the plan and what could be changed to make it more appealing."
        ),
        temperature=1.0,
    ),
    "AnalyzeGoal": Node(
        text=(
            "Analyze the conversation to determine the state of the goal of the new plan in the conversation history. Goals should be concise\n\n"
            "Choose:\n"
            "- \"AlreadyExtractedGoal\" if there is a 'System' message that says that the goal was already extracted and the user did not invalidate the extraction. Else, pick one of the following:\n"
            '- "NoGoalSpecified" if no goal was specified.\n'
            "- \"ValidGoal\" if the goal clear, concise and outcome-driven. (e.g. 'read a book a month' or 'i want to train four times a week')\n"
            '- "InvalidGoal" if the goal is not clear or if the user has explictly requested to change it. '
        ),
        connections={
            "AlreadyExtractedGoal": "AnalyzeFinishingDateHistory",
            "NoGoalSpecified": "AskAboutGoal",
            "InvalidGoal": "RefineGoal",
            "ValidGoal": "ExtractGoal",
        },
    ),
    "AskAboutGoal": Node(
        text=(
            "Request the user to specify his goal. "
            "The goal should be clear, concise and outcome-driven."
        ),
        temperature=1.0,
    ),
    "RefineGoal": Node(
        text=(
            "Request additional details from the user to clarify the goal. "
            "The goal should be clear, concise and outcome-driven."
        ),
        temperature=1.0,
    ),
    "ExtractGoal": Node(
        text=(
            "Extract and format the well-defined and concise goal from the conversation. (e.g. 'read a book a month' or 'i want to train four times a week')\n"
        ),
        output_schema=GoalAnalysis,
        connections={"default": "AnalyzeFinishingDateHistory"},
    ),
    "AnalyzeFinishingDateHistory": Node(
        text=(
            "Analyze the conversation history to analyze the state of the finishing date of the new plan. Choose:\n"
            "- \"AlreadyExtractedFinishingDate\" if there is a 'System' message that says that the finishing date was already extracted and the user did not invalidate the extraction. Else, pick one of the following:\n"
            '- "NeverDiscussed" if finishing date has never been mentioned\n'
            '- "ValidDate" if a clear finishing date was specified and explicitly agreed or suggested by the user\n'
            '- "ExplicitlyDeclined" if user has explicitly stated they don\'t want to set an end date\n'
            '- "UnclearDate" if a date was mentioned but needs clarification'
        ),
        connections={
            "AlreadyExtractedFinishingDate": "AnalyzeActivities",
            "NeverDiscussed": "SuggestFinishingDate",
            "ValidDate": "ExtractFinishingDate",
            "ExplicitlyDeclined": "AnalyzeActivities",
            "UnclearDate": "ClarifyFinishingDate",
        },
    ),
    "SuggestFinishingDate": Node(
        text=(
            "Based on the extracted goal, suggest a potential finishing date.\n"
            "Consider:\n"
            "1. The nature of the goal (e.g., habit formation vs specific achievement)\n"
            "2. Typical timeframes for similar goals\n"
            "3. Any time constraints mentioned by the user\n"
            "Make it clear that setting a finishing date is optional but can help with motivation and planning."
        ),
        temperature=1.0,
    ),
    "ClarifyFinishingDate": Node(
        text=(
            "Ask the user to clarify the finishing date mentioned in the conversation.\n"
            "Guide them to specify a clear date and explain why that date might be suitable."
        ),
        temperature=1.0,
    ),
    "ExtractFinishingDate": Node(
        text=(
            "Extract and format the finishing date from the conversation.\n"
            "Include:\n"
            "1. The date in YYYY-MM-DD format\n"
            "2. Any explanation or reasoning provided for choosing this date"
        ),
        output_schema=FinishingDateAnalysis,
        connections={"default": "AnalyzeActivities"},
    ),
    "AnalyzeActivities": Node(
        text=(
            "Analyze the activities mentioned in the conversation history regarding the new plan and it's state in the conversation history. Choose:\n"
            "- \"AlreadyExtractedActivitiesAndNotInvalidated\" if there is a 'System' message that says that the activities were already extracted and the user did not invalidate the extraction.\n"
            "- \"AlreadyExtractedActivitiesAndInvalidated\" if there is a 'System' message that says that the activities were already extracted and the user asked to refine the extraction.\n"
            '- "NoActivitiesSpecified" if no activities have been mentioned yet\n'
            '- "IncompleteActivities" if activities were mentioned but the way to measure it or the title were not mentioned at all.'
            '- "ValidActivities" if we have complete activities with all required details\n'
            'Note that the plan only needs to have minimum one activity.'
        ),
        connections={
            "AlreadyExtractedActivitiesAndNotInvalidated": "AnalyzeMilestonesHistory",
            "AlreadyExtractedActivitiesAndInvalidated": "ExtractActivities",
            "NoActivitiesSpecified": "AskAboutActivities",
            "IncompleteActivities": "CompleteActivityDetails",
            "ValidActivities": "ExtractActivities",
        },
    ),
    "AskAboutActivities": Node(
        text=(
            "Ask the user what activities they want to include in their plan.\n"
            "Guide them to specify both the activity names and how they want to measure them."
        ),
        temperature=1.0,
    ),
    "CompleteActivityDetails": Node(
        text=(
            "Ask the user to provide the missing details for the mentioned activities.\n"
            "Required details are just measure and title, emoji can and should be inferred by you."
        ),
        temperature=1.0,
    ),
    "ExtractActivities": Node(
        text=(
            "Extract and format the list of the activities that the user mentioned in the conversation history as part of the new plan.\n"
        ),
        output_schema=ActivityAnalysis,
        connections={"default": "AnalyzeMilestonesHistory"},
    ),
    "AnalyzeMilestonesHistory": Node(
        text=(
            "Analyze the conversation history to analyze the state of the milestones of the new plan. Choose:\n"
            "- \"AlreadyExtractedMilestonesAndNotInvalidated\" if there is a 'System' message that says that the milestones were already extracted and the user did not invalidate the extraction.\n"
            "- \"AlreadyExtractedMilestonesAndInvalidated\" if there is a 'System' message that says that the milestones were already extracted and the user asked to refine the extraction.\n"
            '- "NeverDiscussed" if milestones have never been mentioned in the conversation\n'
            '- "ValidMilestones" if clear milestones were already specified and explicitly agreed or suggested by the user\n'
            '- "ExplicitlyDeclined" if user has explicitly stated they don\'t want milestones\n'
            '- "UnclearMilestones" if milestones were discussed but need clarification'
        ),
        connections={
            "AlreadyExtractedMilestonesAndNotInvalidated": "DeterminePlanType",
            "AlreadyExtractedMilestonesAndInvalidated": "ExtractMilestones",
            "NeverDiscussed": "SuggestMilestones",
            "ValidMilestones": "ExtractMilestones",
            "ExplicitlyDeclined": "DeterminePlanType",
            "UnclearMilestones": "ClarifyMilestones",
        },
    ),
    "SuggestMilestones": Node(
        text=(
            "Based on the extracted goal and activities (if already defined), suggest the user to set milestones to help track progress.\n"
            "Make it clear that milestones are optional but helpful for tracking progress.\n"
            "For each milestone, explain that it can either:\n"
            "1. Be tracked automatically based on activity criteria (e.g. a milestone of reading 500 pages would be automatically tracked by activities 'reading' measured in 'pages')\n"
            "2. Be tracked manually if it can't be measured by activities (e.g. 'Feel more energetic')\n"
            "Suggest both types if appropriate for the goal. If you want to provide examples, provide one at maximum."
        ),
        temperature=1.0,
    ),
    "ClarifyMilestones": Node(
        text=(
            "Ask the user to clarify the milestones mentioned in the conversation.\n"
            "For each milestone that needs clarification, ask:\n"
            "1. What's the specific target date?\n"
            "2. Should progress be tracked automatically through activities or manually?\n"
            "3. If automatic, which activities contribute and what quantities are needed?\n"
            "Guide them to specify clear, measurable milestones."
        ),
        temperature=1.0,
    ),
    "ExtractMilestones": Node(
        text=(
            "Extract and format the milestones from the conversation.\n"
            "Each milestone should include:\n"
            "1. A clear description\n"
            "2. A target date (in YYYY-MM-DD format)\n"
            "3. Either:\n"
            "   - Specific activity criteria for automatic tracking (structured with AND/OR logic)\n"
            "   - No criteria for manual tracking (progress will be set manually)\n"
            "Note: For automatic tracking, make sure to properly structure criteria using PlanMilestoneCriteria and PlanMilestoneCriteriaGroup."
        ),
        output_schema=MilestoneAnalysis,
        connections={"default": "DeterminePlanType"},
    ),
    "DeterminePlanType": Node(
        text=(
            "Analyze how the user wants to structure their plan (plan type) and it's state in the conversation history. Choose:\n"
            "- \"AlreadyExtractedPlanTypeAndNotInvalidated\" if there is a 'System' message that says that the plan type was already extracted and the user did not invalidate the extraction.\n"
            "- \"AlreadyExtractedPlanTypeAndInvalidated\" if there is a 'System' message that says that the plan type was already extracted and the user asked to refine the extraction.\n"
            '- "NoPlanTypeSpecified" if no preference has been mentioned\n'
            '- "UnclearPreference" if they show mixed signals about specific dates vs weekly goals\n'
            '- "NeedsContextification" if their preference needs more context (e.g. "regularly")\n'
            '- "ValidPlanType" if we have a clear preference for either specific dates or weekly frequency'
        ),
        connections={
            "AlreadyExtractedPlanTypeAndNotInvalidated": "AnalyzeSessions",
            "AlreadyExtractedPlanTypeAndInvalidated": "ExtractPlanType",
            "NoPlanTypeSpecified": "AskAboutPlanType",
            "UnclearPreference": "ClarifyPlanTypePreference",
            "NeedsContextification": "ContextifyPlanType",
            "ValidPlanType": "ExtractPlanType",
        },
    ),
    "AskAboutPlanType": Node(
        text=(
            "Ask the user how they want to structure their plan, explaining the options:\n"
            "1. Specific dates for each session\n"
            "2. A weekly frequency target"
        ),
        temperature=1.0,
    ),
    "ClarifyPlanTypePreference": Node(
        text=(
            "Help the user choose between specific dates and weekly frequency.\n"
            "Point out their mixed signals and guide them to pick one approach."
        ),
        temperature=1.0,
    ),
    "ContextifyPlanType": Node(
        text=(
            "Ask the user to clarify what they mean by their plan structure preference.\n"
            "Help them understand the difference between specific dates and weekly frequency."
        ),
        temperature=1.0,
    ),
    "ExtractPlanType": Node(
        text=(
            "Extract and format the plan type preference from the conversation.\n"
            "Must be either 'specific' for exact dates or 'times_per_week' for frequency-based."
        ),
        output_schema=PlanTypeAnalysis,
        connections={"default": "HandlePlanType"},
    ),
    "HandlePlanType": Node(
        text=(
            "Based on the extracted plan type, choose the appropriate next step:\n"
            "- For 'specific' plans, we need exact session dates\n"
            "- For 'times_per_week' plans, we need the weekly frequency\n\n"
            "Choose:\n"
            '- "Specific" to proceed with specific dates\n'
            '- "TimesPerWeek" to proceed with weekly frequency'
        ),
        connections={
            "Specific": "AnalyzeSessions",
            "TimesPerWeek": "AnalyzeTimesPerWeek",
        },
    ),
    "AnalyzeSessions": Node(
        text=(
            "Analyze the session information provided and it's state in the conversation history. Choose:\n"
            "- \"AlreadyExtractedSessionsAndNotInvalidated\" if there is a 'System' message that says that the sessions were already extracted and the user did not invalidate the extraction.\n"
            "- \"AlreadyExtractedSessionsAndInvalidated\" if there is a 'System' message that says that the sessions were already extracted and the user asked to refine the extraction.\n"
            '- "NoSessionsSpecified" if no schedule information provided\n'
            '- "PartialSchedule" if some dates/frequencies are mentioned but incomplete\n'
            '- "UnrealisticSchedule" if the proposed schedule might be too ambitious\n'
            '- "ValidSessions" if we have a complete, realistic schedule'
        ),
        connections={
            "AlreadyExtractedSessionsAndNotInvalidated": "AnalyzeTimesPerWeek",
            "AlreadyExtractedSessionsAndInvalidated": "ExtractSessions",
            "NoSessionsSpecified": "AskAboutSessions",
            "PartialSchedule": "CompleteScheduleDetails",
            "UnrealisticSchedule": "ReviseSchedule",
            "ValidSessions": "ExtractSessions",
        },
    ),
    "AskAboutSessions": Node(
        text=(
            "Ask the user to specify their preferred schedule.\n"
            "Guide them to provide specific dates and quantities for each activity."
        ),
        temperature=1.0,
    ),
    "CompleteScheduleDetails": Node(
        text=(
            "Ask the user to fill in the missing schedule details.\n"
            "Focus on getting complete information for dates and quantities."
        ),
        temperature=1.0,
    ),
    "ReviseSchedule": Node(
        text=(
            "Express concern about the schedule's ambition level.\n"
            "Help the user create a more realistic schedule that they can maintain."
        ),
        temperature=1.0,
    ),
    "ExtractSessions": Node(
        text=(
            "Extract and format the complete list of sessions from the conversation.\n"
            "Only include sessions with valid dates, existing activities, and clear quantities."
        ),
        output_schema=SessionExtraction,
        connections={"default": "FinalizePlan"},
    ),
    "AnalyzeTimesPerWeek": Node(
        text=(
            "Analyze if the user has specified a clear weekly frequency target and it's state in the conversation history. Choose:\n"
            "- \"AlreadyExtractedTimesPerWeekAndNotInvalidated\" if there is a 'System' message that says that the times per week were already extracted and the user did not invalidate the extraction.\n"
            "- \"AlreadyExtractedTimesPerWeekAndInvalidated\" if there is a 'System' message that says that the times per week were already extracted and the user asked to refine the extraction.\n"
            '- "NoTimesPerWeekSpecified" if no frequency has been mentioned yet\n'
            '- "ValidFrequency" if a clear number of times per week is specified.\n'
            '- "AmbiguousFrequency" if the frequency is unclear or not mentioned.'
        ),
        connections={
            "AlreadyExtractedTimesPerWeekAndNotInvalidated": "FinalizePlan",
            "AlreadyExtractedTimesPerWeekAndInvalidated": "ExtractTimesPerWeek",
            "NoTimesPerWeekSpecified": "RefineTimesPerWeek",
            "ValidFrequency": "ExtractTimesPerWeek",
            "AmbiguousFrequency": "RefineTimesPerWeek",
        },
    ),
    "RefineTimesPerWeek": Node(
        text=(
            "Ask the user to specify a clear number of times per week they want to perform the activities.\n"
            "If it has been mentioned already, ask for clarification on the frequency.\n"
            "Guide them to provide a specific integer."
        ),
        temperature=1.0,
    ),
    "ExtractTimesPerWeek": Node(
        text=(
            "Extract and format the weekly frequency from the conversation.\n"
            "Must be a clear integer representing times per week."
        ),
        output_schema=TimesPerWeekFrequencyExtraction,
        connections={"default": "FinalizePlan"},
    ),
    "FinalizePlan": Node(
        text=(
            "Compile the final plan summary and send it to the user for double-checking."
        )
    ),
}


class PlanInCreation(BaseModel):
    goal: Optional[str] = Field(None, description="The goal of the plan")
    activities: Optional[List[Activity]] = Field(
        None, description="List of activities with details"
    )
    plan_type: Optional[str] = Field(
        None, description="Type of plan: either 'times_per_week' or 'specific'"
    )
    sessions: Optional[List[Session]] = Field(
        None, description="List of session objects for a specific plan"
    )
    times_per_week_frequency: Optional[int] = Field(
        None, description="Number of times per week for the activities"
    )


class PlanCreationAssistant:
    def __init__(self, user: User, memory: DatabaseMemory, websocket: WebSocket):
        self.framework = None
        self.user = user
        self.memory = memory
        self.websocket = websocket
        # Import the ActivitiesGateway from your gateways module
        from gateways.activities import ActivitiesGateway

        self.activities_gateway = ActivitiesGateway()
        self.plan_controller = PlanController()
        self.name = "Jarvis"

    async def send_websocket_message(self, message_type: str, data: dict):
        if self.websocket:
            await self.websocket.send_json({"type": message_type, **data})

    def write_system_extraction_message(self, extraction_type: str, data: dict):
        """Write a system message about an extraction that occurred."""
        message = f"Extracted {extraction_type}: {str(data)}"
        self.memory.write(
            Message.new(
                text=message,
                sender_name="System",
                sender_id="-1",
                recipient_name=self.user.name,
                recipient_id=self.user.id,
                emotions=[],
            )
        )

    async def get_response(
        self, user_input: str, message_id: str, emotions: List[Emotion] = []
    ) -> Dict:

        self.memory.write(
            Message.new(
                text=user_input,
                sender_name=self.user.name,
                sender_id=self.user.id,
                recipient_name=self.name,
                recipient_id="0",
                emotions=emotions,
            )
        )

        system_prompt = (
            "You are an AI plan creation assistant helping the user create a new plan. "
            "You can help define the following aspects of a plan: "
            "1. The goal of the plan (and the emoji representing it)"
            "2. The project milestones (if any / optional)"
            "3. The project finishing date (if known / optional)"
            "4. The activities involved "
            "5. The type of plan (specific dates or times per week) "
            "6. The sessions/frequency "
            "Analyze the available context (especially the conversation history) to understand how to best continue the conversation given your goal. "
            "Write in prose and concise messages. Be friendly, and make smooth transitions between steps if you want to ask something. Remember, anything that you'd asked to extract must be solely based on the conversation history."
        )

        self.framework = FlowchartLLMFramework(plan_creation_flowchart, system_prompt)

        # Retrieve existing activities for context
        existing_activities = self.activities_gateway.get_all_activities_by_user_id(
            self.user.id
        )
        existing_plans = self.plan_controller.get_all_user_active_plans(self.user)

        context = {
            "current_datetime": datetime.now().strftime("%Y-%m-%d %H:%M"),
            "existing_activities": [
                {
                    "title": activity.title,
                    "emoji": activity.emoji,
                    "measure": activity.measure,
                }
                for activity in existing_activities
            ],
            "existing_plans": [
                self.plan_controller.get_readable_plan(plan) for plan in existing_plans
            ],
            "conversation_history": self.memory.read_all_as_str(
                max_age_in_minutes=3 * 60
            ),
        }

        try:
            plan_result, extracted = await self.framework.run(context)

            self.memory.write(
                Message.new(
                    text=plan_result,
                    sender_name=self.name,
                    sender_id="0",
                    recipient_name=self.user.name,
                    recipient_id=self.user.id,
                )
            )
            suggestions: List[AssistantSuggestion] = []

            # Check each node's output and send corresponding suggestions
            for key, value in extracted.items():
                if key.startswith("ExtractGoal_"):
                    suggestions.append(PlanGoalSuggestion.from_goal_analysis(value))
                    self.write_system_extraction_message("goal", {"goal": value.goal})
                elif key.startswith("ExtractActivities_"):
                    suggestions.append(
                        PlanActivitiesSuggestion.from_activity_analysis(value)
                    )
                    self.write_system_extraction_message(
                        "activities",
                        {
                            "activities": [
                                {
                                    "activity_name": activity.activity_name,
                                    "activity_id": str(ObjectId()),
                                    "emoji": activity.emoji,
                                    "measure": activity.measure,
                                }
                                for activity in value.activities
                            ]
                        },
                    )
                elif key.startswith("ExtractMilestones_"):
                    suggestions.append(
                        PlanMilestoneSuggestion.from_milestone_analysis(value)
                    )
                    self.write_system_extraction_message(
                        "milestones",
                        {
                            "milestones": [
                                {
                                    "description": milestone.description,
                                    "date": milestone.date,
                                    "criteria": milestone.criteria,
                                    "progress": milestone.progress,
                                }
                                for milestone in value.milestones
                            ]
                        },
                    )
                elif key.startswith("ExtractPlanType_"):
                    suggestions.append(PlanTypeSuggestion.from_plan_type(value))
                    self.write_system_extraction_message(
                        "plan_type", {"plan_type": value.plan_type}
                    )
                elif key.startswith("ExtractSessions_"):
                    suggestions.append(PlanSessionsSuggestion.from_sessions(value))
                    if isinstance(value, SessionExtraction):
                        self.write_system_extraction_message(
                            "sessions",
                            {
                                "sessions": [
                                    {
                                        "date": session.date,
                                        "activity_name": session.activity_name,
                                        "activity_id": session.activity_id,
                                        "quantity": session.quantity,
                                    }
                                    for session in value.sessions
                                ]
                            },
                        )
                    else:
                        self.write_system_extraction_message(
                            "times_per_week",
                            {"frequency": value.times_per_week_frequency},
                        )
                elif key.startswith("ExtractFinishingDate_"):
                    suggestions.append(
                        PlanFinishingDateSuggestion.from_finishing_date_analysis(value)
                    )
                    self.write_system_extraction_message(
                        "finishing_date",
                        {
                            "finishing_date": value.finishing_date,
                            "explanation": value.explanation,
                        },
                    )

            if suggestions:
                await self.send_websocket_message(
                    "suggestions", {"suggestions": [s.dict() for s in suggestions]}
                )

            return plan_result
        except Exception as e:
            logger.error(f"Error generating plan: {str(e)}")
            raise Exception(f"Error generating plan: {str(e)}")
