from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional, Set
from pydantic import create_model
from ai.llm import ask_text, ask_schema
from loguru import logger
from constants import LLM_MODEL
import json
import re
import asyncio
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from typing import Optional, Dict, Any, Tuple
from .flowchart_nodes import FlowchartNode, NodeType, LoopStartNode

@dataclass
class SpeculativeResult:
    result: Any
    extracted_data: Any
    next_node: str
    confidence: float = 1.0

class FlowchartLLMFramework:
    def __init__(self, flowchart: Dict[str, FlowchartNode], system_prompt: str, lookahead_depth: int = 2):
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
        self.lookahead_depth = lookahead_depth
        self.speculative_cache: Dict[Tuple[str, str], SpeculativeResult] = {}
        self.executor = ThreadPoolExecutor(max_workers=4)

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

    async def speculative_execute(self, node_id: str, context: Dict[str, Any], depth: int = 0) -> Optional[SpeculativeResult]:
        if depth >= self.lookahead_depth:
            return None

        node = self.flowchart[node_id]
        
        # Don't speculate on loop nodes
        if node.type in [NodeType.LOOP_START, NodeType.LOOP_CONTINUE]:
            return None

        cache_key = (node_id, str(context))
        if cache_key in self.speculative_cache:
            return self.speculative_cache[cache_key]

        try:
            # For decision nodes, speculatively execute all paths
            if len(node.connections) > 1:
                futures = []
                for option in node.connections.keys():
                    next_node = node.connections[option]
                    futures.append(self.speculative_execute(next_node, context, depth + 1))
                
                results = await asyncio.gather(*futures)
                # Store all possible paths in cache
                for option, result in zip(node.connections.keys(), results):
                    if result:
                        self.speculative_cache[(node_id, str(context))] = result

            # For transition nodes, speculatively execute the next node
            elif node.connections:
                next_node = list(node.connections.values())[0]
                result = await self.speculative_execute(next_node, context, depth + 1)
                if result:
                    self.speculative_cache[(node_id, str(context))] = result

            # Execute current node
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                self.executor,
                self.llm_function,
                node.text,
                context,
                node_id,
                list(node.connections.keys()) if len(node.connections) > 1 else None,
                node.output_schema
            )

            spec_result = SpeculativeResult(
                result=result,
                extracted_data=result if node.output_schema else None,
                next_node=node.connections.get(result, list(node.connections.values())[0]) if node.connections else None
            )
            
            self.speculative_cache[cache_key] = spec_result
            return spec_result

        except Exception as e:
            logger.error(f"Error in speculative execution for node {node_id}: {e}")
            return None

    async def run(self, input_string: str):
        current_node_id = self.start_node
        context = {"initial_input": input_string}
        self.visited_nodes = []
        self.decisions = {}
        traversal = []

        # Start speculative execution
        asyncio.create_task(self.speculative_execute(self.start_node, context))

        while True:
            current_node = self.flowchart[current_node_id]
            self.visited_nodes.append(current_node_id)

            if current_node.type in [NodeType.LOOP_START, NodeType.LOOP_CONTINUE]:
                current_node_id = self.handle_loop_node(current_node_id, current_node)
                continue

            cache_key = (current_node_id, str(context))
            cached_result = self.speculative_cache.get(cache_key)

            if cached_result:
                # Use cached result
                result = cached_result.result
                if cached_result.extracted_data:
                    self.extracted[current_node_id] = cached_result.extracted_data
                
                if not current_node.connections:  # End node
                    return result, self.extracted
                
                current_node_id = cached_result.next_node
                
                # Start speculative execution for future nodes
                asyncio.create_task(self.speculative_execute(current_node_id, context))
                
            else:
                # Fall back to normal execution if no cached result
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
