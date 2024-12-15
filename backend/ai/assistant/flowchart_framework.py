from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional, Set
from pydantic import create_model
from ai.llm import ask_text_async, ask_schema_async
from loguru import logger
from constants import LLM_MODEL
import json
import re
import asyncio
from pydantic.fields import FieldInfo
from .flowchart_nodes import FlowchartNode, NodeType, LoopStartNode


class FlowchartLLMFramework:
    def __init__(self, flowchart: Dict[str, FlowchartNode], system_prompt: str, lookahead_depth: int = 6):
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
        self.node_results = {}
        self.execution_path = []
        self.visited_nodes = []
        self.completed_nodes = set()
        self.decisions = {}
        self.reasoning = {}
        self.loop_states = {}
        self.loop_vars = {}
        self.lookahead_depth = lookahead_depth

    def handle_loop_node(self, node_id: str, node: FlowchartNode) -> str:
        if node.type == NodeType.LOOP_START:
            iterator_name = node.iterator
            collection_var = node.collection.replace("${", "").replace("}", "")
            
            if iterator_name not in self.loop_states:
                previous_node = self.execution_path[-2]
                collection = getattr(self.extracted[previous_node], collection_var)
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

    async def llm_function(
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
                    self.execution_path[-1] if self.execution_path else None
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
                    model_extension = await ask_schema_async(
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
                result = await ask_schema_async(
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
                    result = await ask_schema_async(
                        text=full_prompt,
                        system=self.system_prompt,
                        pymodel=schema,
                        model=LLM_MODEL,
                    )
                    return result
                else:
                    result = await ask_text_async(
                        text=full_prompt,
                        system=self.system_prompt,
                        model=LLM_MODEL,
                        temperature=temperature,
                    )
                    return result
        except Exception as e:
            logger.error(f"Error in LLM function: {e}")
            raise

    async def can_process_node(self, node_id: str, node: FlowchartNode) -> bool:
        """Check if a node can be processed based on its dependencies."""
        # Skip if already completed or being processed
        if node_id in self.completed_nodes or node_id in self.visited_nodes:
            return False

        # Don't pre-process loop nodes - they must be processed in sequence
        if node.type in [NodeType.LOOP_START, NodeType.LOOP_CONTINUE]:
            # Only allow processing if this is the current node in execution path
            return node_id == self.execution_path[-1] if self.execution_path else False

        # Check if node has any uncomputed variable dependencies
        node_text = node.text
        required_vars = re.findall(r"\$\{([^}]+)\}", node_text)
        
        for var in required_vars:
            # For loop variables, check if they're available
            if var in self.loop_vars:
                continue
                
            # For other variables, check if any previous node provides this variable
            var_found = False
            for prev_node_id, output in self.extracted.items():
                if hasattr(output, var):
                    # Verify the providing node has been processed
                    if prev_node_id in self.visited_nodes:
                        var_found = True
                        break
            
            if not var_found:
                return False

        # Check if node has any explicit dependencies
        if hasattr(node, 'needs') and node.needs:
            if node.needs not in self.visited_nodes:
                return False

        return True

    async def get_processable_nodes(self, current_node_id: str, depth: int = 1) -> List[str]:
        """Find nodes that can be processed ahead of time."""
        if depth <= 0:
            return []

        processable = []
        visited = set()
        queue = [(current_node_id, depth)]

        while queue:
            node_id, remaining_depth = queue.pop(0)
            if node_id in visited:
                continue

            visited.add(node_id)
            node = self.flowchart[node_id]

            # If node can be processed, add it to the list
            if await self.can_process_node(node_id, node):
                processable.append(node_id)

            # Add connected nodes to queue if we still have depth
            if remaining_depth > 1:
                for next_node in node.connections.values():
                    if next_node not in self.visited_nodes:  # Only add unvisited nodes
                        queue.append((next_node, remaining_depth - 1))

        logger.debug(f"Found processable nodes for {current_node_id}: {processable}")
        return processable

    async def process_node(self, node_id: str, context: Dict[str, Any]) -> Any:
        """Process a single node and return its result."""
        # If node is already completed, return its cached result
        if node_id in self.completed_nodes:
            logger.info(f"Reusing completed node: {node_id}")
            return self.node_results.get(node_id)

        node = self.flowchart[node_id]
        logger.info(f"Processing node: {node_id}")
        
        # Add to visited nodes BEFORE processing
        self.visited_nodes.append(node_id)

        try:
            if node.type in [NodeType.LOOP_START, NodeType.LOOP_CONTINUE]:
                result = self.handle_loop_node(node_id, node)
            else:
                node_prompt = node.text
                for prev_node, data in self.extracted.items():
                    if (
                        hasattr(data, "__class__") 
                        and hasattr(data.__class__, "__name__")
                        and not data.__class__.__name__.startswith("DecisionSchema")
                    ):
                        model_name = data.__class__.__name__
                        data_dict = data.dict() if hasattr(data, "dict") else str(data)
                        node_prompt += f"\n\nContext: {model_name}: {data_dict}"

                connections = node.connections
                if len(connections) > 1:  # Decision node
                    options = list(connections.keys())
                    result = await self.llm_function(
                        node_text=node_prompt,
                        context=context,
                        current_node_id=node_id,
                        options=options,
                        schema=node.output_schema,
                    )
                else:  # Transition or end node
                    if node.output_schema or not connections:  # Process both schema nodes and end nodes
                        result = await self.llm_function(
                            node_text=node_prompt,
                            context=context,
                            current_node_id=node_id,
                            schema=node.output_schema,
                        )
                    else:
                        result = None

            # Store ALL results, even None
            self.node_results[node_id] = result
            # Store only schema/structured outputs in extracted
            if result is not None and hasattr(result, '__class__'):
                self.extracted[node_id] = result

            # Mark node as completed after successful processing
            self.completed_nodes.add(node_id)
            return result

        except Exception as e:
            # Remove from visited nodes if processing failed
            if node_id in self.visited_nodes:
                self.visited_nodes.remove(node_id)
            raise

    async def run(self, input_string: str):
        current_node_id = self.start_node
        context = {"initial_input": input_string}
        self.visited_nodes = []
        self.completed_nodes = set()
        self.execution_path = []
        self.node_results = {}
        self.extracted = {}
        self.decisions = {}
        traversal = []
        background_tasks = set()  # Track background tasks

        while True:
            # Add current node to execution path BEFORE processing anything
            if current_node_id not in self.execution_path:
                self.execution_path.append(current_node_id)

            # Get nodes that can be processed in parallel
            processable_nodes = await self.get_processable_nodes(current_node_id, self.lookahead_depth)
            logger.info(f"Processing nodes in parallel: {processable_nodes}")

            # Start processing all nodes
            for node_id in processable_nodes:
                if node_id != current_node_id:  # Process non-current nodes in background
                    task = asyncio.create_task(self.process_node(node_id, context))
                    background_tasks.add(task)
                    task.add_done_callback(background_tasks.discard)

            # Process current node and wait for it if it hasn't been processed yet
            if current_node_id not in self.completed_nodes:
                result = await self.process_node(current_node_id, context)
                if result is not None:
                    self.node_results[current_node_id] = result
                    if isinstance(result, str) and len(self.flowchart[current_node_id].connections) > 1:
                        self.decisions[current_node_id] = result

            # Record node traversal
            current_node = self.flowchart[current_node_id]
            node_entry = {
                "node": current_node_id,
                "text": current_node.text,
                "options": list(current_node.connections.keys()),
                "reasoning": self.reasoning.get(current_node_id),
                "decision": self.decisions.get(current_node_id),
                "next_node": None,
                "extracted": (
                    self.extracted[current_node_id].dict()
                    if current_node_id in self.extracted 
                    and hasattr(self.extracted[current_node_id], "dict")
                    else None
                ),
            }

            # If this is an end node, wait for background tasks and return
            if not current_node.connections:
                # Optionally wait for background tasks to complete
                if background_tasks:
                    logger.info("Waiting for background tasks to complete...")
                    await asyncio.gather(*background_tasks)
                
                traversal.append(node_entry)
                logger.log(
                    "AI_FRAMEWORK",
                    f"Input: {input_string}\n\nTraversal: {json.dumps({'traversal': traversal}, indent=2)}",
                )
                result = self.node_results.get(current_node_id, None)
                assert isinstance(result, str), f"End node '{current_node_id}' must return a string"
                return result, self.extracted

            # Handle node transitions
            connections = current_node.connections
            if len(connections) > 1:  # Decision node
                decision = self.decisions[current_node_id]
                next_node = connections.get(decision, list(connections.values())[0])
            else:  # Transition node
                next_node = list(connections.values())[0]

            node_entry["next_node"] = next_node
            traversal.append(node_entry)
            current_node_id = next_node
