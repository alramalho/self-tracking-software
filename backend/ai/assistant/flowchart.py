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

first_message_flowchart = {
    "FirstTimeEver": {
        "text": "Based on the conversation history, is this the first time ever talking to the user?",
        "connections": {"Yes": "Introduce", "No": "FirstTimeToday"},
    },
    "Introduce": {
        "text": "Introduce yourself, say that you're Jarvis, you're happy to meet the user and you're here to talk to them about their recent activities and automatically track them.",
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
        "text": "Did the user mention he did any of the existent activities?",
        "connections": {"Yes": "CheckActivityMeasurement", "No": "Converse"},
    },
    "CheckActivityMeasurement": {
        "text": "Do you have the date of when the activity was done and the measure (for how long, how much pages, etc)?",
        "connections": {"Yes": "ExtractActivity", "No": "AskForMoreInformation"},
    },
    "AskForMoreInformation": {
        "text": "Ask the user for the missing information about the activity (date and quantity)",
        "connections": {"default": "CheckActivityMeasurement"},
    },
    "ExtractActivity": {
        "text": "Extract the activity from the user's message",
        "schema": ExtractedActivityEntryList,
        "connections": {"default": "InformTheUserAboutTheActivity"},
    },
    "InformTheUserAboutTheActivity": {
        "text": "Inform the user that you've logged the activity",
        "connections": {"default": "Converse"},
    },
    "Converse": {
        "text": "Let the user lead an engaging and challenging conversation with you. ",
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

    def llm_function(
        self,
        node_text: str,
        context: Dict[str, Any],
        options: Optional[List[str]] = None,
        schema: Optional[BaseModel] = None,
    ) -> str:
        try:
            # Combine node text with initial input for a more comprehensive prompt
            full_prompt = f"{node_text}\n\nInitial conversation context:\n{context['initial_input']}"

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
                return result.decision
            else:
                # Non-decision node
                if schema:
                    result = ask_schema(
                        full_prompt, self.system_prompt, schema, LLM_MODEL
                    )
                    return result
                else:
                    return ask_text(full_prompt, self.system_prompt, LLM_MODEL)
        except Exception as e:
            logger.error(f"Error in LLM function: {e}")
            raise

    def run(self, input_string: str):
        current_node_id = self.start_node
        context = {"initial_input": input_string}

        while True:
            current_node = self.flowchart[current_node_id]
            logger.info(f"Current node: {current_node_id}")

            if not current_node.get("connections"):  # End node
                return self.llm_function(current_node["text"], context), self.extracted

            connections = current_node.get("connections", {})
            if len(connections) > 1:  # Decision node
                options = list(connections.keys())
                decision = self.llm_function(current_node["text"], context, options)
                logger.info(f"Decision: {decision}")
                current_node_id = connections.get(
                    decision, list(connections.values())[0]
                )
            else:  # Transition node
                if current_node.get("schema"):
                    self.extracted[current_node_id] = self.llm_function(
                        current_node["text"],
                        context,
                        schema=current_node.get("schema", None),
                    )
                current_node_id = list(connections.values())[0]


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

    def get_response(self, user_input: str) -> Tuple[str, List[ExtractedActivityEntry]]:
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
            )
        )

        system_prompt = f"""You are {self.name}, an AI assistant helping with a conversation flow. 
        Follow the instructions carefully and provide appropriate responses.
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
        
        Here's the user's activities:
        {"\n- ".join([str(a) for a in self.user_activities])}

        Here's user's last week activity:
        {self.recent_activities_string}
                               
        Here's your past conversation with the user:
        {self.memory.read_all_as_str(max_words=1000, max_age_in_minutes=24*60)}

        
        Only output message to be sent to the user.
        """
        )

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
