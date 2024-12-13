from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional, Set
from pydantic import create_model
from ai.llm import ask_text, ask_schema
from loguru import logger
from constants import LLM_MODEL
import json
import re
from pydantic.fields import FieldInfo
from .flowchart_nodes import FlowchartNode, NodeType, LoopStartNode


class FlowchartLLMFramework:
    def __init__(self, flowchart: Dict[str, FlowchartNode], system_prompt: str):
        self.flowchart = flowchart
        self.system_prompt = system_prompt + "\nYou are a conversationalist agent, so your messages to the user must always be linked to the conversation threads. Nevertheless, your primary is wrapped within the <focus> tag, so that's what you should focus on in your reasoning. "
        self.start_node = next(
            node_id
            for node_id, node in flowchart.items()
            if not any(
                node_id in n.connections.values() for n in flowchart.values()
            )
        )
        self.extracted = {}
        self.visited_nodes = []
        self.decisions = {}
        self.reasoning = {}
        self.loop_states = {}
        self.loop_vars = {}

    def handle_loop_node(self, node_id: str, node: FlowchartNode) -> str:
        if node.type == NodeType.LOOP_START:
            iterator_name = node.iterator
            collection_var = node.collection.replace("${", "").replace("}", "")
            
            if iterator_name not in self.loop_states:
                collection = getattr(self.extracted[self.visited_nodes[-2]], collection_var)
                self.loop_states[iterator_name] = {
                    "collection": collection,
                    "current_index": 0,
                    "processed": set()
                }
                self.loop_vars[iterator_name] = collection[0]
            
            return node.connections["default"]

        elif node.type == NodeType.LOOP_CONTINUE:
            iterator_name = next(
                n.iterator 
                for n in self.flowchart.values() 
                if isinstance(n, LoopStartNode)
            )
            
            loop_state = self.loop_states[iterator_name]
            loop_state["current_index"] += 1
            
            if loop_state["current_index"] < len(loop_state["collection"]):
                self.loop_vars[iterator_name] = loop_state["collection"][loop_state["current_index"]]
                return node.connections["HasMore"]
            else:
                return node.connections["Complete"]

    def replace_loop_vars(self, text: str) -> str:
        for var_name, value in self.loop_vars.items():
            text = text.replace(f"${{{var_name}}}", str(value))
        return text

    def llm_function(
        self,
        node_text: str,
        context: Dict[str, Any],
        current_node_id: str,
        options: Optional[List[str]] = None,
        schema: Optional[BaseModel] = None,
    ) -> str:
        try:
            node_text = self.replace_loop_vars(node_text)

            required_vars = re.findall(r"\$\{([^}]+)\}", node_text)

            if required_vars:
                last_node = (
                    self.visited_nodes[-2] if len(self.visited_nodes) > 1 else None
                )
                if last_node and last_node in self.extracted:
                    last_output = self.extracted[last_node]

                    for var in required_vars:
                        if hasattr(last_output, var):
                            value = getattr(last_output, var)
                            node_text = node_text.replace(f"${{{var}}}", str(value))
                        else:
                            raise ValueError(
                                f"Previous node '{last_node}' output schema does not contain required variable '{var}'. "
                                f"Available fields: {[f for f in last_output.__fields__]}"
                            )
                else:
                    raise ValueError(
                        f"No extracted data found from previous node '{last_node}' for variables: {required_vars}"
                    )

            full_prompt = f"<instruction>'{node_text}'</instruction>\nContext:{context['initial_input']}\n<instruction again>{node_text}</instruction again>"

            node = self.flowchart[current_node_id]
            temperature = node.temperature

            if options:
                base_schema = None
                if schema:
                    model_extension = ask_schema(
                        text=full_prompt,
                        system=self.system_prompt,
                        pymodel=schema,
                        model=LLM_MODEL,
                    )
                    base_schema = model_extension.__class__

                extension_fields = {
                    "reasoning": (
                        str,
                        Field(
                            ...,
                            description="Your step by step reasoning analysing the instruction within <instruction> and how to address it. ",
                        ),
                    ),
                    "decision": (
                        str,
                        Field(..., description=f"Choose one of: {', '.join(options)}"),
                    ),
                }

                DecisionSchema = create_model(
                    "DecisionSchema",
                    __base__=base_schema if base_schema else BaseModel,
                    **extension_fields
                )
                result = ask_schema(
                    text=full_prompt,
                    system=self.system_prompt,
                    pymodel=DecisionSchema,
                    model=LLM_MODEL,
                )
                self.decisions[current_node_id] = result.decision
                self.reasoning[current_node_id] = result.reasoning
                self.extracted[current_node_id] = result
                return result.decision
            else:
                if schema:
                    result = ask_schema(
                        text=full_prompt,
                        system=self.system_prompt,
                        pymodel=schema,
                        model=LLM_MODEL,
                    )
                    return result
                else:
                    result = ask_text(
                        text=full_prompt,
                        system=self.system_prompt,
                        model=LLM_MODEL,
                        temperature=temperature,
                    )
                    return result
        except Exception as e:
            logger.error(f"Error in LLM function: {e}")
            raise

    def run(self, input_string: str):
        current_node_id = self.start_node
        context = {"initial_input": input_string}
        self.visited_nodes = []
        self.decisions = {}
        traversal = []

        while True:
            current_node = self.flowchart[current_node_id]
            self.visited_nodes.append(current_node_id)

            if current_node.type in [NodeType.LOOP_START, NodeType.LOOP_CONTINUE]:
                current_node_id = self.handle_loop_node(current_node_id, current_node)
                continue

            node_entry = {
                "node": current_node_id,
                "text": current_node.text,
                "options": list(current_node.connections.keys()),
                "reasoning": None,
                "decision": None,
                "next_node": None,
                "extracted": None,
            }

            node_prompt = current_node.text
            for prev_node, data in self.extracted.items():
                if (
                    hasattr(data, "__class__") 
                    and hasattr(data.__class__, "__name__")
                    and not data.__class__.__name__.startswith("DecisionSchema")
                ):
                    model_name = data.__class__.__name__
                    data_dict = data.dict() if hasattr(data, "dict") else str(data)
                    node_prompt += f"\n\nContext: {model_name}: {data_dict}"

            if not current_node.connections:  # End node
                result = self.llm_function(
                    node_text=node_prompt,
                    context=context,
                    current_node_id=current_node_id,
                    options=list(current_node.connections.keys()),
                    schema=current_node.output_schema,
                )
                node_entry = {k: v for k, v in node_entry.items() if v is not None}
                traversal.append(node_entry)
                logger.log(
                    "AI_FRAMEWORK",
                    f"Input: {input_string}\n\nTraversal: {json.dumps({'traversal': traversal}, indent=2)}",
                )
                assert type(result) == str, f"End node '{current_node_id}' must return a string"
                return result, self.extracted

            connections = current_node.connections
            if len(connections) > 1:  # Decision node
                options = list(connections.keys())
                decision = self.llm_function(
                    node_text=node_prompt,
                    context=context,
                    current_node_id=current_node_id,
                    options=options,
                    schema=current_node.output_schema,
                )
                next_node = connections.get(decision, list(connections.values())[0])

                node_entry["decision"] = decision
                node_entry["reasoning"] = self.reasoning.get(current_node_id)
                node_entry["next_node"] = next_node
                traversal.append(node_entry)

                current_node_id = next_node
            else:  # Transition node
                if current_node.output_schema:
                    extracted_data = self.llm_function(
                        node_text=node_prompt,
                        context=context,
                        current_node_id=current_node_id,
                        schema=current_node.output_schema,
                    )
                    self.extracted[current_node_id] = extracted_data

                    node_entry["extracted"] = (
                        extracted_data.dict()
                        if hasattr(extracted_data, "dict")
                        else extracted_data
                    )

                next_node = list(connections.values())[0]
                node_entry["next_node"] = next_node
                traversal.append(node_entry)

                current_node_id = next_node
