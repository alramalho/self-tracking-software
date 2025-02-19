from typing import Dict, List, Optional, Union
from pydantic import BaseModel, Field
from datetime import datetime
from ai.assistant.flowchart_framework import FlowchartLLMFramework
from ai.assistant.flowchart_nodes import Node
from controllers.plan_controller import PlanController
from entities.plan import Plan
from entities.user import User
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

class PrioritizationAnalysis(BaseModel):
    priority: int = Field(..., description="The plan's priority or index")

class Activity(BaseModel):
    activity_name: str = Field(..., description="Name of the activity")
    emoji: str = Field(..., description="Emoji representing the activity")
    measure: str = Field(..., description="Unit of measurement for the activity")

class ActivityAnalysis(BaseModel):
    activities: List[Activity] = Field(..., description="List of activities with details")

class PlanTypeAnalysis(BaseModel):
    plan_type: str = Field(..., description="Type of plan: either 'times_per_week' or 'specific'")

class Session(BaseModel):
    date: str = Field(..., description="Session date in YYYY-MM-DD format")
    activity_name: str = Field(..., description="Activity name associated with the session")
    quantity: float = Field(..., description="Quantity for the session based on the activity's measure")

class SessionExtraction(BaseModel):
    sessions: List[Session] = Field(..., description="List of session objects for a specific plan")

class TimesPerWeekFrequencyExtraction(BaseModel):
    times_per_week_frequency: int = Field(..., description="Number of times per week for the activities")

class PlanGoalSuggestion(AssistantSuggestion):
    type: str = "plan_goal"
    
    @classmethod
    def from_goal_analysis(cls, goal_data: GoalAnalysis):
        return cls(
            data={
                "goal": goal_data.goal
            }
        )

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
                        "measure": activity.measure
                    }
                    for activity in activities_data.activities
                ]
            }
        )

class PlanTypeSuggestion(AssistantSuggestion):
    type: str = "plan_type"
    
    @classmethod
    def from_plan_type(cls, plan_type_data: PlanTypeAnalysis):
        return cls(
            data={
                "plan_type": plan_type_data.plan_type
            }
        )

class PlanSessionsSuggestion(AssistantSuggestion):
    type: str = "plan_sessions"
    
    @classmethod
    def from_sessions(cls, sessions_data: Union[SessionExtraction, TimesPerWeekFrequencyExtraction]):
        if isinstance(sessions_data, SessionExtraction):
            return cls(
                data={
                    "sessions": [
                        {
                            "date": session.date,
                            "activity_name": session.activity_name,
                            "quantity": session.quantity
                        }
                        for session in sessions_data.sessions
                    ]
                }
            )
        else:
            return cls(
                data={
                    "sessions": sessions_data.times_per_week_frequency
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
            '- "No" if the user is just having a general conversation or discussing something else.'
        ),
        connections={
            "Yes": "AnalyzeGoal",
            "No": "Converse"
        }
    ),
    
    "Converse": Node(
        text=(
            "Taking into account the conversation history flow (and system messages if present), "
            "converse with the user in succinct messages. Your message must fit the conversation flow "
            "but be aligned with your goal as assistant."
        ),
        temperature=1.0
    ),

    "AnalyzeGoal": Node(
        text=(
            "Analyze the conversation to determine if there already specified his goal. Goals should be concise\n\n"
            "Choose:\n"
            '- "NoGoalSpecified" if no goal was specified.\n'
            '- "ValidGoal" if the goal is clear, concise and outcome-driven. (e.g. \'read a book a month\' or \'i want to train four times a week\')\n'
            '- "InvalidGoal" if the goal is not clear or if the user has explictly requested to change it. '
        ),
        connections={
            "NoGoalSpecified": "AskAboutGoal",
            "InvalidGoal": "RefineGoal",
            "ValidGoal": "ExtractGoal"
        }
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
            "Extract and format the well-defined and concise goal from the conversation. (e.g. \'read a book a month\' or \'i want to train four times a week\')\n"
        ),
        output_schema=GoalAnalysis,
        connections={
            "default": "AnalyzeActivities"
        }
    ),
    
    "AnalyzeActivities": Node(
        text=(
            "Analyze the activities mentioned in the conversation history regarding the new plan . Choose:\n"
            '- "NoActivitiesSpecified" if no activities have been mentioned yet\n'
            '- "ValidActivities" if we have complete activities with all required details (measure and name / title)'
            '- "IncompleteActivities" if activities are mentioned but missing required details\n'
        ),
        connections={
            "NoActivitiesSpecified": "AskAboutActivities",
            "IncompleteActivities": "CompleteActivityDetails",
            "ValidActivities": "ExtractActivities"
        }
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
            "Focus on getting the measurement units and any other required information."
        ),
        temperature=1.0,
    ),

    "ExtractActivities": Node(
        text=(
            "Extract and format the list of the activities that the user mentioned in the conversation history as part of the new plan.\n"
        ),
        output_schema=ActivityAnalysis,
        connections={
            "default": "DeterminePlanType"
        }
    ),
    
    "DeterminePlanType": Node(
        text=(
            "Analyze how the user wants to structure their plan. Choose:\n"
            '- "NoPlanTypeSpecified" if no preference has been mentioned\n'
            '- "UnclearPreference" if they show mixed signals about specific dates vs weekly goals\n'
            '- "NeedsContextification" if their preference needs more context (e.g. "regularly")\n'
            '- "ValidPlanType" if we have a clear preference for either specific dates or weekly frequency'
        ),
        connections={
            "NoPlanTypeSpecified": "AskAboutPlanType",
            "UnclearPreference": "ClarifyPlanTypePreference",
            "NeedsContextification": "ContextifyPlanType",
            "ValidPlanType": "ExtractPlanType"
        }
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
        connections={
            "default": "HandlePlanType"
        }
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
            "TimesPerWeek": "AnalyzeTimesPerWeek"
        }
    ),

    "AnalyzeSessions": Node(
        text=(
            "Analyze the session information provided. Choose:\n"
            '- "NoSessionsSpecified" if no schedule information provided\n'
            '- "PartialSchedule" if some dates/frequencies are mentioned but incomplete\n'
            '- "UnrealisticSchedule" if the proposed schedule might be too ambitious\n'
            '- "ValidSessions" if we have a complete, realistic schedule'
        ),
        connections={
            "NoSessionsSpecified": "AskAboutSessions",
            "PartialSchedule": "CompleteScheduleDetails",
            "UnrealisticSchedule": "ReviseSchedule",
            "ValidSessions": "ExtractSessions"
        }
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
        connections={
            "default": "FinalizePlan"
        }
    ),

    "AnalyzeTimesPerWeek": Node(
        text=(
            "Analyze if the user has specified a clear weekly frequency target.\n\n"
            "Choose:\n"
            '- "ValidFrequency" if a clear number of times per week is specified.\n'
            '- "AmbiguousFrequency" if the frequency is unclear or not mentioned.'
        ),
        connections={
            "ValidFrequency": "ExtractTimesPerWeek",
            "AmbiguousFrequency": "RefineTimesPerWeek"
        }
    ),
    
    "RefineTimesPerWeek": Node(
        text=(
            "Ask the user to specify a clear number of times per week they want to perform the activities.\n"
            "Guide them to provide a specific integer."
        ),
        temperature=1.0,
        connections={
            "default": "AnalyzeTimesPerWeek"
        }
    ),

    "ExtractTimesPerWeek": Node(
        text=(
            "Extract and format the weekly frequency from the conversation.\n"
            "Must be a clear integer representing times per week."
        ),
        output_schema=TimesPerWeekFrequencyExtraction,
        connections={
            "default": "FinalizePlan"
        }
    ),
    
    "FinalizePlan": Node(
        text=(
            "Compile the final plan summary including:\n"
            "1. Goal\n"
            "2. Priority\n"
            "3. Activities (with details)\n"
            "4. Plan type\n"
            "5. Session details (if specific) or frequency (if times_per_week)\n\n"
            "Return this structured plan summary ready for implementation."
        )
    )
}

class PlanInCreation(BaseModel):
    goal: Optional[str] = Field(None, description="The goal of the plan")
    activities: Optional[List[Activity]] = Field(None, description="List of activities with details")
    plan_type: Optional[str] = Field(None, description="Type of plan: either 'times_per_week' or 'specific'")
    sessions: Optional[List[Session]] = Field(None, description="List of session objects for a specific plan")
    times_per_week_frequency: Optional[int] = Field(None, description="Number of times per week for the activities")

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

    async def get_response(self, user_input: str, message_id: str, emotions: List[Emotion] = []) -> Dict:

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
            "1. The goal of the plan "
            "2. The activities involved "
            "3. The type of plan (specific dates or times per week) "
            "4. The sessions/frequency "
            "Other aspects like emojis, finishing dates, or milestones are OUT OF SCOPE - "
            "the user will need to add those themselves after plan creation. "
            "Analyze the available context (especially the conversation history) to understand how to best continue the conversation given your goal. "
            "Be concise, but friendly. Remember, anything that you'd asked to extract must be solely based on the conversation history."
        )
        
        self.framework = FlowchartLLMFramework(plan_creation_flowchart, system_prompt)
        
        # Retrieve existing activities for context
        existing_activities = self.activities_gateway.get_all_activities_by_user_id(self.user.id)
        existing_plans = self.plan_controller.get_all_user_active_plans(self.user)

        context = {
            "current_datetime": datetime.now().strftime("%Y-%m-%d %H:%M"),
            "existing_activities": [
                {"title": activity.title, "emoji": activity.emoji, "measure": activity.measure}
                for activity in existing_activities
            ],
            "existing_plans": [self.plan_controller.get_readable_plan(plan) for plan in existing_plans],
            "conversation_history": self.memory.read_all_as_str(max_age_in_minutes=3*60)
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
                    suggestions.append(PlanActivitiesSuggestion.from_activity_analysis(value))
                    self.write_system_extraction_message("activities", {"activities": [
                        {
                            "activity_name": activity.activity_name,
                            "emoji": activity.emoji,
                            "measure": activity.measure
                        }
                        for activity in value.activities
                    ]})
                elif key.startswith("ExtractPlanType_"):
                    suggestions.append(PlanTypeSuggestion.from_plan_type(value))
                    self.write_system_extraction_message("plan_type", {"plan_type": value.plan_type})
                elif key.startswith("ExtractSessions_"):
                    suggestions.append(PlanSessionsSuggestion.from_sessions(value))
                    if isinstance(value, SessionExtraction):
                        self.write_system_extraction_message("sessions", {"sessions": [
                            {
                                "date": session.date,
                                "activity_name": session.activity_name,
                                "quantity": session.quantity
                            }
                            for session in value.sessions
                        ]})
                    else:
                        self.write_system_extraction_message("times_per_week", {"frequency": value.times_per_week_frequency})

            if suggestions:
                await self.send_websocket_message(
                    "suggestions",
                    {"suggestions": [s.dict() for s in suggestions]}
                )

            return plan_result
        except Exception as e:
            logger.error(f"Error generating plan: {str(e)}")
            raise Exception(f"Error generating plan: {str(e)}")
