from pydantic import BaseModel, Field
from typing import List, Tuple, Dict, Any, Literal
from ai.assistant.memory import Memory
from entities.message import Message, Emotion
from entities.user import User
from entities.activity import Activity
from datetime import datetime
import re
from loguru import logger
from entities.plan import Plan
from datetime import timedelta
from .flowchart_framework import FlowchartLLMFramework
from gateways.activities import ActivitiesGateway
from ai.assistant.activity_extractor import ActivityExtractorAssistant
from controllers.plan_controller import PlanController, PlanSession
from .flowchart_nodes import (
    Node,
    LoopStartNode,
    LoopContinueNode,
    NodeType,
)

activities_gateway = ActivitiesGateway()
plan_controller = PlanController()



class PlanNameSchema(BaseModel):
    current_plan: str = Field(..., description="The name of the plan")

class PlanAnalysisSchema(BaseModel):
    plan_name: str = Field(..., description="The name of the plan to analyse")
    plan_analysis: str = Field(
        ..., description="A note outlining the analysis of the plan"
    )
    plan_adjustment: str = Field(
        ...,
        description="A note denoting the adjustment needed for the plan (or the lack of it)",
    )


class AllPlanNamesSchema(BaseModel):
    plan_names: List[str] = Field(..., description="All plan names")


class SuggestedChanges(BaseModel):
    analysis: str = Field(..., description="Analysis of the plan's current status and why changes are needed")
    plan_name: str = Field(..., description="The name of the plan")
    plan_type: Literal["specific", "times_per_week"] = Field(..., description="The type of the plan in question.")
    next_week_sessions: List[PlanSession] = Field(
        ..., description="[only for 'specific' plans] The sessions to be added to the plan for the upcoming week"
    )
    next_week_times_per_week: int = Field(
        ..., description="[only for 'times_per_week' plans] The new number of sessions per week"
    )

class ExtractedPlanSessions(BaseModel):
    plan_id: str = Field(..., description="The ID of the plan these sessions belong to")
    sessions: List[PlanSession] = Field(
        ..., description="The sessions to be added to the plan for the upcoming week"
    )

class ExtractedTimesPerWeek(BaseModel):
    plan_id: str = Field(..., description="The ID of the plan these sessions belong to")
    old_times_per_week: int = Field(
        ..., description="The old number of sessions per week"
    )
    new_times_per_week: int = Field(
        ..., description="The new number of sessions per week"
    )

class EnrichedPlanSessions(ExtractedPlanSessions):
    old_sessions: List[PlanSession] = Field(
        ...,
        description="The sessions to be removed from the plan for the upcoming week",
    )



# first_message_flowchart = {
#     "FirstTimeEver": Node(
#         text="Based on the conversation history, is this the first time ever talking to the user?",
#         connections={"Yes": "Introduce", "No": "FirstTimeToday"},
#     ),
#     "Introduce": Node(
#         text="Introduce yourself, telling what you can do for the user.",
#         connections={},  # Empty connections indicate an end node
#     ),
#     "FirstTimeToday": Node(
#         text="Based on the conversation history, is this the first time talking today?",
#         connections={"Yes": "Greet", "No": "End"},
#     ),
#     "Greet": Node(
#         text="Greet the user, and tell him you'd like to talk a bit about each of his plans.",
#     ),
#     "End": Node(  # this should never be reached
#         text="Conclude the conversation appropriately based on the entire interaction. "
#     ),
# }

class LetsGoToActivityExtractor(BaseModel):
    irrelevant_number: str = Field(..., description="Return here a number between 1 and 10.")

every_message_flowchart = {
    "CheckMessageIntent": Node(
        text="What is the primary intent of the user's last message? Choose one: 'plan_management' if about adjusting/planning next week's activities, 'activity_logging' if about recording past activities, 'other_request' if it's an unrelated request/question, or 'general_conversation' if none of the above.",
        connections={
            "plan_management": "ExtractPlanName",
            "activity_logging": "ExitToActivityExtractor",
            "other_request": "HandleRequest",
            "general_conversation": "ExtractPlanNames"
        }
    ),
    "ExitToActivityExtractor": Node(
        text="Just return the phrase 'exit to activity extractor'.",
    ),
    "HandleRequest": Node(
        text="Address the user's specific request or question, keeping in mind your goals and purpose.",
    ),
    "HandleConversation": Node(
        text="Engage in general conversation while gently steering towards discussing their plans if appropriate.",
    ),
    "ExtractPlanName": Node(
        text="Extract the plan name which the user is talking about.",
        connections={"default": "CheckPlanRelevance"},
        output_schema=PlanNameSchema,
    ),
    "ExtractPlanNames": Node(
        text="Extract all plan names from the users plan list.",
        connections={"default": "StartPlanLoop"},
        output_schema=AllPlanNamesSchema,
    ),
    "StartPlanLoop": LoopStartNode(
        text="",
        iterator="current_plan",
        collection="plan_names",
        connections={"default": "CheckPlanRelevance"},
        needs=["ExtractPlanNames"],
        end_node="NextPlan",
    ),
    "CheckPlanRelevance": Node(
        text="""Review the conversation history to determine if plan '${current_plan}' needs discussion. Check if:
        1. We have already discussed this plan recently
        2. We have already suggested and finalized changes for this plan
        
        Respond with 'Discuss' only if the plan has not been fully addressed yet.""",
        connections={"Discuss": "AnalyzePlanStatus", "Skip": "NextPlan"},
    ),
    "AnalyzePlanStatus": Node(
        text="""Analyze the current status of plan '${current_plan}' and determine if changes should be either "Made" or "Suggested".
        You should make changes only when the user has agreed to or suggested them, otherwise you should suggest them yourself first.""",
        connections={"MakeChanges": "MakeChanges", "SuggestChanges": "SuggestChanges"},
    ),
    "SuggestChanges": Node(
        text="""Analyze the current status of plan '${current_plan}' and determine what changes should be suggested.
        In order to suggest effective changeschanges, you should:
        1. understand what are the user's expressed difficulties, challenges, or what went well during the past week in the plan.
        For this you should look both into the plan's past week outlook and to the logged activity history, to make a correct assessment on what the user is needing to change.
        2. understand what are the user's intentions for the upcoming week, so that your suggestion has increased probability of being actually carried through.
        """,
    ),
    "MakeChanges": Node(
        text="""Analyze the current status of plan '${current_plan}' and determine if changes are needed. Consider:
        1. Recent activity completion rate
        2. User's explicit mentions about next week's intentions
        3. Any difficulties or challenges mentioned
        
        And suggest specific changes for plan '${current_plan}'. If it's a 'specific' type plan, suggest next week's sessions. If it's a 'times per week' type, suggest the new number of sessions per week.""",
        temperature=1,
        output_schema=SuggestedChanges,
        connections={"default": "InformUserAboutChanges"},
    ),
    "InformUserAboutChanges": Node(
        text="Inform the user about the suggested changes for plan '${current_plan}', which he now needs to accept or reject.",
        needs=["MakeChanges"],
    ),
    "NextPlan": LoopContinueNode(
        text="",
        connections={"HasMore": "StartPlanLoop", "Complete": "Conclude"},
        needs=["StartPlanLoop"],
    ),
    "Conclude": Node(
        text="There are no (more) plans to discuss. Converse with the user, and inform him of this, if you did not already.",
        temperature=1,
    ),
}


class WeekAnalyserAssistant(object):
    def __init__(
        self,
        user: User,
        user_activities: List[Activity],
        user_plans: List[Plan],
        memory: Memory,
    ):
        self.name = "Jarvis"
        self.memory = memory
        self.user = user
        self.user_activities = user_activities
        self.user_plans = user_plans

        system_prompt = f"""You are {self.name}, an AI assistant helping the adapt their plans for the following week. 
        Respond to the user in the same language that he talks to you in.
        No matter what, make sure your answer never jumps the conversation and has the user's last message into account.
        You can also help the user extract past activities, if it is needed, even though is not your primary objective.
        """

        self.framework = FlowchartLLMFramework(
            every_message_flowchart,
            system_prompt,
            lookahead_depth=3,
        )


    async def get_response(
        self, user_input: str, message_id: str = None, emotions: List[Emotion] = []
    ) -> Tuple[str, EnrichedPlanSessions | ExtractedTimesPerWeek | None]:
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


        # For days since last Sunday (inclusive)
        lookback_days = max(
            6, datetime.now().isoweekday() % 7
        )  # Sunday=0, Monday=1, ..., Saturday=6, max 6 is for debugging during mid

        # For days until next Saturday (inclusive)
        lookahead_days = max(
            6, (6 - datetime.now().isoweekday() % 7)
        )  # Days remaining until Saturday

        prompt = f"""
        --- Here's the user's plan list of {len(self.user_plans)} plans:
        {plan_controller.get_readable_plans_and_sessions(self.user.id, past_day_limit=lookback_days, future_day_limit=lookahead_days, plans=self.user_plans)}

        --- Now here's the activities that the user has done during the past {lookback_days} days:
        {activities_gateway.get_readable_recent_activity_entries(self.user.id, past_day_limit=lookback_days)}
                               
        --- Now here's your actual conversation history with the user:
        {self.memory.read_all_as_str(max_words=750, max_age_in_minutes=12*60)}

        {f"<system note>Take special attention to any user present emotions, if present.</system note>" if emotions else ""}

        --- Only output the message to be sent to the user.
        """
        result, extracted = await self.framework.run(prompt)

        jarvis_prefix = re.match(r"^Jarvis\s*\([^)]*\)\s*:\s*", result)
        if jarvis_prefix:
            result = result[len(jarvis_prefix.group(0)) :]
        elif result.startswith(f"{self.name}:"):
            result = result[len(f"{self.name}:") :]

        logger.info(f"FRAMEWORK RESULT: {result}")
        logger.info(f"EXTRACTED: {extracted}")

        # Create a mapping of plan names to IDs TODO: this assumes that the plan present plan name is unique
        plan_name_to_id = {plan.goal: plan.id for plan in self.user_plans}
        
        if "exit to activity extractor" in result.lower():
            assistant = ActivityExtractorAssistant(
                memory=self.memory,
                user=self.user,
                user_activities=self.user_activities,
            )
            return await assistant.get_response(user_input, message_id, emotions)
        

        self.memory.write(
                Message.new(
                    result,
                    sender_name=self.name,
                    sender_id="0",
                    recipient_name=self.user.name,
                    recipient_id=self.user.id,
                )
            )

        for key in extracted:
            if key.startswith("MakeChanges_"):
                if extracted[key].plan_type == "specific":
                    plan_id = plan_name_to_id[extracted[key].plan_name]
                    plan = plan_controller.get_plan(plan_id=plan_id)
                    old_sessions = [
                        s
                        for s in plan.sessions
                        if datetime.strptime(s.date, "%Y-%m-%d").date() >= datetime.now().date()
                        and datetime.strptime(s.date, "%Y-%m-%d").date()
                        <= datetime.now().date() + timedelta(days=lookahead_days)
                    ]

                    # Aggregate sessions from all SuggestedChanges nodes
                    return result, EnrichedPlanSessions(
                        plan_id=plan_id,
                        sessions=extracted[key].next_week_sessions,
                        old_sessions=old_sessions,
                    )
                elif extracted[key].plan_type == "times_per_week":
                    plan_id = plan_name_to_id[extracted[key].plan_name]
                    plan = [p for p in self.user_plans if p.id == plan_id][0]
                    return result, ExtractedTimesPerWeek(
                        plan_id=plan_id,
                        old_times_per_week=plan.times_per_week,
                        new_times_per_week=extracted[key].next_week_times_per_week,
                    )
                else:
                    raise ValueError(f"Unknown plan type: {extracted[key].plan_type}")
            else:
                continue

        return result, None

