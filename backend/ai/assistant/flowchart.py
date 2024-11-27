from pydantic import BaseModel, Field
from typing import List, Tuple, Dict, Any, Optional
from ai.assistant.memory import Memory
from entities.message import Message
from entities.user import User
from ai.llm import ask_text, ask_schema
from loguru import logger
from entities.activity import Activity
from pydantic import create_model
from constants import LLM_MODEL
from entities.message import Emotion
from datetime import datetime
import re
import json


first_message_flowchart = {
    "FirstTimeEver": {
        "text": "Based on the conversation history, is this the first time ever talking to the user?",
        "connections": {"Yes": "Introduce", "No": "FirstTimeToday"},
    },
    "Introduce": {
        "text": "Introduce yourself, say that you're Jarvis, you're happy to meet the user and you're here to talk to them about their recent activities and automatically track them. Then ask what they've been up to recently and how they're doing.",
    },
    "FirstTimeToday": {
        "text": "Based on the conversation history, is this the first time talking today?",
        "connections": {"Yes": "Greet", "No": "End"},
    },
    "Greet": {
        "text": "Greet the user, asking what's he has been up to since you last talked X days ago (use the conversation history to determine how many days)",
    },
    "End": {  # this should never be reached
        "text": "Conclude the conversation appropriately based on the entire interaction. "
    },
}


class ExtractedActivityEntry(BaseModel):
    activity_id: str = Field(..., description="The id of the activity that was logged")
    date: str = Field(
        ..., description="The date of when the activity was done. YYYY-MM-DD"
    )
    measure: str = Field(
        ..., description="The measure of the activity (minutes, kilometers, pages, etc)"
    )
    quantity: int = Field(
        ...,
        description="The quantity of the activity (how many minutes were spent reading / how many kilometers were ran / etc)",
    )


class ExtractedActivityEntryList(BaseModel):
    activities: List[ExtractedActivityEntry] = Field(
        ..., description="A list of activities that were logged"
    )


every_message_flowchart = {
    "ActivityScanner": {
        "text": "Did the user mention he did any of the existent activities in his exchanged messages with you?",
        "connections": {"Yes": "CheckActivityMeasurement", "No": "Converse"},
    },
    "CheckActivityMeasurement": {
        "text": "Did the user mention the date of when the activity was done and the measure (for how long, how much pages, etc) in his exchanged messages with you?",
        "connections": {"Yes": "ExtractActivity", "No": "AskForMoreInformation"},
    },
    "AskForMoreInformation": {
        "text": "Ask the user for the missing information about the activity (either date and / or measure, whatever is missing)",
    },
    "ExtractActivity": {
        "text": f"Extract new activities from the user's message. New activites are activites that are not on the recent activities list. Today is {datetime.now().strftime('%b %d, %Y')}",
        "schema": ExtractedActivityEntryList,
        "connections": {"default": "InformTheUserAboutTheActivity"},
    },
    "InformTheUserAboutTheActivity": {
        "text": "Inform the user that you've logged the activity",
    },
    "Converse": {
        "text": "Let the user lead an engaging and challenging conversation with you. Don't ask generic 'how can I help you?' questions, but rather ask how they're doing and what they've been up to.",
    },
}


class FlowchartLLMFramework:
    def __init__(self, flowchart: Dict[str, Dict[str, Any]], system_prompt: str):
        self.flowchart = flowchart
        self.system_prompt = system_prompt
        self.start_node = next(
            node_id
            for node_id, node in flowchart.items()
            if not any(
                node_id in n.get("connections", {}).values() for n in flowchart.values()
            )
        )
        self.extracted = {}
        self.visited_nodes = []
        self.decisions = {}
        self.reasoning = {}

    def llm_function(
        self,
        node_text: str,
        context: Dict[str, Any],
        current_node_id: str,
        options: Optional[List[str]] = None,
        schema: Optional[BaseModel] = None,
    ) -> str:
        try:
            # Combine node text with initial input for a more comprehensive prompt
            full_prompt = f"<focus>'{node_text}'</focus>\n Context\n{context['initial_input']}\n"

            if options:
                # Decision node
                if schema:
                    raise ValueError("Schema not supported for decision nodes")

                DecisionSchema = create_model(
                    "DecisionSchema",
                    reasoning=(
                        str,
                        Field(
                            ...,
                            description="Your step by step reasoning for the decision.",
                        ),
                    ),
                    decision=(
                        str,
                        Field(..., description=f"Choose one of: {', '.join(options)}"),
                    ),
                )
                result = ask_schema(
                    full_prompt, self.system_prompt, DecisionSchema, LLM_MODEL
                )
                self.decisions[current_node_id] = result.decision
                self.reasoning[current_node_id] = result.reasoning
                return result.decision
            else:
                # Non-decision node
                if schema:
                    result = ask_schema(
                        full_prompt, self.system_prompt, schema, LLM_MODEL
                    )
                    return result
                else:
                    result = ask_text(full_prompt, self.system_prompt, LLM_MODEL)
                    return result
        except Exception as e:
            logger.error(f"Error in LLM function: {e}")
            raise

    def run(self, input_string: str):
        current_node_id = self.start_node
        # Initialize context with input string
        context = {"initial_input": input_string}
        self.visited_nodes = []
        self.decisions = {}
        traversal = []

        while True:
            current_node = self.flowchart[current_node_id]
            self.visited_nodes.append(current_node_id)
            
            node_entry = {
                "node": current_node_id,
                "text": current_node["text"],
                "options": list(current_node.get("connections", {}).keys()),
                "reasoning": None,
                "decision": None,
                "next_node": None,
                "extracted": None
            }

            # Build the full prompt by combining node text with any schema data from context
            node_prompt = current_node["text"]
            for prev_node, data in self.extracted.items():
                if hasattr(data, "__class__") and hasattr(data.__class__, "__name__"):
                    model_name = data.__class__.__name__
                    data_dict = data.dict() if hasattr(data, "dict") else str(data)
                    node_prompt += f"\n\nContext: {model_name}: {data_dict}"

            if not current_node.get("connections"):  # End node
                result = self.llm_function(node_prompt, context, current_node_id)
                node_entry = {k: v for k, v in node_entry.items() if v is not None}
                traversal.append(node_entry)
                logger.log(
                    "AI_FRAMEWORK",
                    f"Input: {input_string}\n\nTraversal: {json.dumps({'traversal': traversal}, indent=2)}"
                )
                return result, self.extracted

            connections = current_node.get("connections", {})
            if len(connections) > 1:  # Decision node
                options = list(connections.keys())
                decision = self.llm_function(node_prompt, context, current_node_id, options)
                next_node = connections.get(decision, list(connections.values())[0])
                
                node_entry["decision"] = decision
                node_entry["reasoning"] = self.reasoning.get(current_node_id)
                node_entry["next_node"] = next_node
                traversal.append(node_entry)
                
                current_node_id = next_node
            else:  # Transition node
                if current_node.get("schema"):
                    extracted_data = self.llm_function(
                        node_prompt,
                        context,
                        current_node_id,
                        schema=current_node.get("schema", None),
                    )
                    self.extracted[current_node_id] = extracted_data
                    
                    node_entry["extracted"] = extracted_data.dict() if hasattr(extracted_data, "dict") else extracted_data
                
                next_node = list(connections.values())[0]
                node_entry["next_node"] = next_node
                traversal.append(node_entry)
                
                current_node_id = next_node


class Assistant(object):
    def __init__(
        self,
        user: User,
        user_activities: List[Activity],
        recent_activities_string: str,
        memory: Memory,
    ):
        self.name = "Jarvis"
        self.memory = memory
        self.user = user
        self.user_activities = user_activities
        self.recent_activities_string = recent_activities_string

    def get_response(self, user_input: str, emotions: List[Emotion] = []) -> Tuple[str, List[ExtractedActivityEntry]]:
        is_first_message_in_more_than_a_day = (
            len(self.memory.read_all(max_words=1000, max_age_in_minutes=1440)) == 0
        )

        self.memory.write(
            Message.new(
                user_input,
                sender_name=self.user.name,
                sender_id=self.user.id,
                recipient_name=self.name,
                recipient_id="0",
                emotions=emotions,
            )
        )

        system_prompt = f"""You are {self.name}, an AI assistant helping the user track their activities. 
        Follow the instruction wrapped in <focus> tags carefully and provide appropriate responses.
        That instruction does not come from the user, but you must address it.
        Always consider the entire conversation history when making decisions or responses.
        Respond in the same language as the initial input.
        """

        if is_first_message_in_more_than_a_day:
            flowchart = first_message_flowchart
        else:
            flowchart = every_message_flowchart

        framework = FlowchartLLMFramework(flowchart, system_prompt)

        result, extracted = framework.run(
            f"""
        
        Here's the user's all the existent activities user is trying to track:
        {"\n- ".join([str(a) for a in self.user_activities])}

        Here's user's most recently logged activities:
        {self.recent_activities_string}
                               
        Now here's your actual conversation history with the user:
        {self.memory.read_all_as_str(max_words=1000, max_age_in_minutes=3*60)}

        
        Only output message to be sent to the user.
        """
        )
        
        jarvis_prefix = re.match(r"^Jarvis\s*\([^)]*\)\s*:\s*", result)
        if jarvis_prefix:
            result = result[len(jarvis_prefix.group(0)):]
        elif result.startswith(f"{self.name}:"):
            result = result[len(f"{self.name}:"):]

        self.memory.write(
            Message.new(
                result,
                sender_name=self.name,
                sender_id="0",
                recipient_name=self.user.name,
                recipient_id=self.user.id,
            )
        )

        logger.info(f"FRAMEWORK RESULT: {result}")
        logger.info(f"EXTRACTED: {extracted}")

        return result, (
            extracted["ExtractActivity"].activities
            if "ExtractActivity" in extracted
            else []
        )
