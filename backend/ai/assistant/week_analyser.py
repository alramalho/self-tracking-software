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


class OptionalPlanNameSchema(BaseModel):
    plan_name: str | None = Field(None, description="The name of the plan (if exists)")


class PlanNameSchema(BaseModel):
    plan_name: str = Field(..., description="The name of the plan")


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



first_message_flowchart = {
    "FirstTimeEver": Node(
        text="Based on the conversation history, is this the first time ever talking to the user?",
        connections={"Yes": "Introduce", "No": "FirstTimeToday"},
    ),
    "Introduce": Node(
        text="Introduce yourself, telling what you can do for the user.",
        connections={},  # Empty connections indicate an end node
    ),
    "FirstTimeToday": Node(
        text="Based on the conversation history, is this the first time talking today?",
        connections={"Yes": "Greet", "No": "End"},
    ),
    "Greet": Node(
        text="Greet the user, and tell him you'd like to talk a bit about each of his plans.",
    ),
    "End": Node(  # this should never be reached
        text="Conclude the conversation appropriately based on the entire interaction. "
    ),
}

class LetsGoToActivityExtractor(BaseModel):
    irrelevant_number: str = Field(..., description="Return here a number between 1 and 10.")

every_message_flowchart = {
    "HasRequest": Node(
        text="Was the last user message a request, question or instruction that is not related to the plans?",
        connections={"Yes": "Answer", "No": "CheckActivityManagement"},
    ),
    "CheckActivityManagement": Node(
        text="Is the user asking you to manage any of their activities?",
        connections={"Yes": "ExitToActivityExtractor", "No": "Answer"},
    ),
    "ExitToActivityExtractor": Node(
        text="Just return the phrase 'exit to activity extractor'.",
    ),
    "Answer": Node(
        text="Address the user's request on last message, having in mind your goals and purpose.",
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
        connections={"default": "CheckPlanDiscussed"},
        needs=["ExtractPlanNames"],
    ),
    "CheckPlanDiscussed": Node(
        text="Based exclusively on the conversation history, did you explicitly or implicitly ask the user if he wants to discuss the plan '${current_plan}'?",
        connections={"Yes": "CheckUserWantsToDiscussPlan", "No": "AskToDiscussPlan"},
    ),
    "AskToDiscussPlan": Node(
        text="Ask the user if they would like to discuss the plan '${current_plan}', making a bridge to the conversation and giving an overview on how the plan is doing by the outlook of recent user activity.",
        temperature=1,
    ),
    "CheckUserWantsToDiscussPlan": Node(
        text="Based exclusively on the conversation history, has the user accepted to discuss the plan '${current_plan}'?",
        connections={"Yes": "CheckUserMentionedNextWeekPlans", "No": "NextPlan"},
    ),
    "CheckUserMentionedNextWeekPlans": Node(
        text="Did the user explictly mention in the conversation history which upcoming week's sessions for plan ${current_plan}' he is intending on doing? Note that a mention that no adjustments are needed is also an explicit mention and should be answered with 'Yes'",
        connections={"Yes": "ShouldSuggestChanges", "No": "AskNextWeekPlans"},
    ),
    "AskNextWeekPlans": Node(
        text="Remind the user of his upcoming week planned sessions for '${current_plan}' and ask what's his plans about it / if he plans on doing them all.",
        temperature=1,
    ),
    "ShouldSuggestChanges": Node(
        text="Based on recent conversation history & user's intentions regarding the plan '${current_plan}', should you suggest any change to '${current_plan}' upcoming week's sessions? You must start your reasoning with \"Based on the conversation history for plan '${current_plan}' ...\".",
        connections={"Yes": "SuggestChanges", "No": "NextPlan"},
    ),
    "SuggestChanges": Node(
        text="Analyse the plan '${current_plan}'. If of the 'specific' type you can only suggest next week's sessions. If of the 'times per week' type you can only suggest the new number of sessions per week.",
        temperature=1,
        output_schema=SuggestedChanges,
        connections={"default": "InformTheUsreAboutTheChanges"},
    ),
    "InformTheUsreAboutTheChanges": Node(
        text="Inform the user that you've generated sessions replacing next week's ones for plan '${current_plan}', which now he needs to accept or reject.",
        needs=["SuggestChanges"],
    ),
    "NextPlan": LoopContinueNode(
        text="",
        connections={"HasMore": "StartPlanLoop", "Complete": "Conclude"},
        needs=["StartPlanLoop"], # this shouldnt be needed
    ),
    "Conclude": Node(
        text="Congratulate the user for making this far in the conversation, wrap up the conversation with a summary of what was discussed and what actions were decided and tell him you'll see him next week!",
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

    async def get_response(
        self, user_input: str, message_id: str = None, emotions: List[Emotion] = []
    ) -> Tuple[str, EnrichedPlanSessions | ExtractedTimesPerWeek | None]:
        is_first_message_in_more_than_a_day = (
            len(self.memory.read_all(max_words=1000, max_age_in_minutes=1440)) == 0
        )
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

        system_prompt = f"""You are {self.name}, an AI assistant helping the adapt their plans for the following week. 
        Respond to the user in the same language that he talks to you in.
        No matter what, make sure your answer never jumps the conversation and has the user's last message into account.
        You can also help the user extract past activities, if it is needed, even though is not your primary objective.
        """

        if is_first_message_in_more_than_a_day:
            flowchart = first_message_flowchart
        else:
            flowchart = every_message_flowchart

        framework = FlowchartLLMFramework(
            flowchart,
            system_prompt,
            lookahead_depth=6,
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
        {plan_controller.get_readable_plans_and_sessions(self.user.id, past_day_limit=lookback_days, future_day_limit=lookahead_days)}

        --- Now here's the activities that the user has done during the past {lookback_days} days:
        {activities_gateway.get_readable_recent_activity_entries(self.user.id, past_day_limit=lookback_days)}
                               
        --- Now here's your actual conversation history with the user:
        {self.memory.read_all_as_str(max_words=750, max_age_in_minutes=12*60)}

        {f"<system note>Take special attention to any user present emotions, if present.</system note>" if emotions else ""}

        --- Only output the message to be sent to the user.
        """
        result, extracted = await framework.run(prompt)

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
        elif "SuggestChanges" in extracted:
            self.memory.write(
                Message.new(
                    result,
                    sender_name=self.name,
                    sender_id="0",
                    recipient_name=self.user.name,
                    recipient_id=self.user.id,
                )
            )
            if extracted["`SuggestedChanges`"].plan_type == "specific":
                plan_id = plan_name_to_id[extracted["SuggestedChanges"].plan_name]
                plan = plan_controller.get_plan(plan_id=plan_id)
                old_sessions = [
                    s
                    for s in plan.sessions
                    if datetime.strptime(s.date, "%Y-%m-%d").date() >= datetime.now().date()
                    and datetime.strptime(s.date, "%Y-%m-%d").date()
                    <= datetime.now().date() + timedelta(days=lookahead_days)
                ]

                # Aggregate sessions from all SuggestedChanges nodes
                all_sessions = []
                for key in extracted:
                    if key.startswith("SuggestedChanges_"):
                        all_sessions.extend(extracted[key].next_week_sessions)

                return result, EnrichedPlanSessions(
                    plan_id=plan_id,
                    sessions=all_sessions,
                    old_sessions=old_sessions,
                )
            elif extracted["SuggestedChanges"].plan_type == "times_per_week":
                plan_id = plan_name_to_id[extracted["SuggestedChanges"].plan_name]
                plan = plan_controller.get_plan(plan_id=plan_id)
                return result, ExtractedTimesPerWeek(
                    plan_id=plan_id,
                    old_times_per_week=plan.times_per_week,
                    new_times_per_week=extracted["SuggestedChanges"].next_week_times_per_week,
                )
            else:
                return result, None
        else:
            return result, None

