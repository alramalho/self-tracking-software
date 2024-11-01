from typing import Dict, Any, Optional, Union, List
from pydantic import BaseModel, create_model, Field
from ai.llm import ask_text, ask_schema
from constants import LLM_MODEL
from loguru import logger

class FlowchartLLMFramework:
    def __init__(self, flowchart: Dict[str, Dict[str, Any]], system_prompt: str):
        self.flowchart = flowchart
        self.system_prompt = system_prompt
        self.start_node = next(node_id for node_id, node in flowchart.items() if not any(node_id in n.get('connections', {}).values() for n in flowchart.values()))

    def llm_function(self, node_text: str, context: Dict[str, Any], options: Optional[List[str]] = None) -> str:
        try:
            # Combine node text with initial input for a more comprehensive prompt
            full_prompt = f"{node_text}\n\nInitial conversation context:\n{context['initial_input']}"
            
            if options:
                # Decision node
                DecisionSchema = create_model('DecisionSchema', decision=(str, Field(..., description=f"Choose one of: {', '.join(options)}")))
                result = ask_schema(full_prompt, self.system_prompt, DecisionSchema, LLM_MODEL)
                return result.decision
            else:
                # Non-decision node
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

            if not current_node.get('connections'):  # End node
                return self.llm_function(current_node['text'], context)
            
            connections = current_node.get('connections', {})
            if len(connections) > 1:  # Decision node
                options = list(connections.keys())
                decision = self.llm_function(current_node['text'], context, options)
                logger.info(f"Decision: {decision}")
                current_node_id = connections.get(decision, list(connections.values())[0])
            else:  # Transition node
                current_node_id = list(connections.values())[0]

# Define the flowchart as a Python dict
flowchart = {
    "Start": {
        "text": "Start Conversation",
        "connections": {"default": "FirstTimeEver"}
    },
    "FirstTimeEver": {
        "text": "Based on the conversation history, is this the first time ever talking to the user?",
        "connections": {"Yes": "Introduce", "No": "FirstTimeToday"}
    },
    "Introduce": {
        "text": "Introduce yourself and goals to the user",
        "connections": {"default": "WaitFeedback"}
    },
    "WaitFeedback": {
        "text": "Acknowledge any user feedback and prepare to continue the conversation",
        "connections": {"default": "FirstTimeToday"}
    },
    "FirstTimeToday": {
        "text": "Based on the conversation history, is this the first time talking today?",
        "connections": {"Yes": "Greet", "No": "ExploreMood"}
    },
    "Greet": {
        "text": "Greet the user appropriately",
        "connections": {"default": "AskDayGoing"}
    },
    "AskDayGoing": {
        "text": "Ask how the user's day is going",
        "connections": {"default": "ExploreMood"}
    },
    "ExploreMood": {
        "text": "Explore the user's mood and happiness based on the conversation",
        "connections": {"default": "End"}
    },
    "End": {
        "text": "Conclude the conversation appropriately based on the entire interaction"
    }
}

def main():
    system_prompt = """You are an AI assistant helping with a conversation flow. 
    Follow the instructions carefully and provide appropriate responses.
    Always consider the entire conversation history when making decisions or responses.
    Respond in the same language as the initial input.
    
    """
    
    framework = FlowchartLLMFramework(flowchart, system_prompt)
    result = framework.run("""
    Here's the conversation history:
    ... (older than 90 minutes messages omitted) ...
    Torotoro (1 days ago): Legal! Então, eu adicionei a informação de que você fumou uma ganja hoje. Como você está se sentindo em geral, Alex?
    Alex (1 days ago): Estou-me sentindo muito bem. Obrigado. Um 10 em 10.
    Torotoro (1 days ago): Que bom saber que você está se sentindo tão bem, Alex! Eu registrei que sua felicidade está em 10. E o que mais você fez hoje? Alguma atividade interessante?
    Alex (1 days ago): Não, nada de especial.
    
    Next assistant message (without the 'Torotoro' prefix):
    """)
    print(f"Final result: {result}")

if __name__ == "__main__":
    main()