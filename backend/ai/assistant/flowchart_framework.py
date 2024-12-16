from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional, Set
from pydantic import create_model
from ai.llm import ask_text_async, ask_schema_async
from loguru import logger
from constants import LLM_MODEL
import json
import re
from typing import Tuple
import asyncio
from .flowchart_nodes import FlowchartNode, NodeType, LoopStartNode
import time


class FlowchartLLMFramework:
    def __init__(
        self,
        flowchart: Dict[str, FlowchartNode],
        system_prompt: str,
        lookahead_depth: int = 6,
    ):
        self.flowchart = flowchart
        self.system_prompt = (
            system_prompt
            + "\nYou are a conversationalist agent, so your messages to the user must always be linked to the conversation threads. Nevertheless, your primary is wrapped within the <focus> tag, so that's what you should focus on in your reasoning. "
        )
        self.start_node = next(
            node_id
            for node_id, node in flowchart.items()
            if not any(node_id in n.connections.values() for n in flowchart.values())
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
        self.loop_visit_count = {}
        self.lookahead_depth = lookahead_depth
        self.loop_nodes = self.get_loop_nodes()  # Pre-compute loop nodes
        self.node_durations = {}
        self.processing_nodes = set()
        self.processing_nodes_lock = asyncio.Lock()
        self.node_tasks = {}  # Add this to track tasks by node instance ID

    def handle_loop_node(self, node: FlowchartNode) -> str:
        if node.type == NodeType.LOOP_START:
            iterator_name = node.iterator
            collection_var = node.collection.replace("${", "").replace("}", "")

            if iterator_name not in self.loop_states:
                previous_node = self.execution_path[-2]
                collection = getattr(self.extracted[previous_node], collection_var)
                self.loop_states[iterator_name] = {
                    "collection": collection,
                    "current_index": 0,
                    "processed": set(),
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
                self.loop_vars[iterator_name] = loop_state["collection"][
                    loop_state["current_index"]
                ]
                self.completed_nodes = {
                    node_id
                    for node_id in self.completed_nodes
                    if node_id.rsplit("_", 1)[0] not in self.loop_nodes
                }
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
    ) -> Tuple[Optional[BaseModel], str, str]: # return optinal output schema / next node / output text (needs rfeactor #TODO)
        try:
            start_time = time.time()
            node_instance_id = self.get_node_instance_id(current_node_id)
            node_text = self.replace_loop_vars(node_text)
            required_vars = re.findall(r"\$\{([^}]+)\}", node_text)

            if required_vars:
                # Find the last node instance that provided the required variable
                for var in required_vars:
                    var_found = False
                    for prev_instance_id in reversed(self.execution_path):
                        if prev_instance_id in self.extracted:
                            last_output = self.extracted[prev_instance_id]
                            if hasattr(last_output, var):
                                value = getattr(last_output, var)
                                node_text = node_text.replace(f"${{{var}}}", str(value))
                                var_found = True
                                break
                    if not var_found:
                        raise ValueError(
                            f"No extracted data found from previous nodes for variable '{var}'"
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
                    **extension_fields,
                )
                result = await ask_schema_async(
                    text=full_prompt,
                    system=self.system_prompt,
                    pymodel=DecisionSchema,
                    model=LLM_MODEL,
                )
                duration_ms = int((time.time() - start_time) * 1000)
                self.node_durations[node_instance_id] = duration_ms
                self.decisions[node_instance_id] = result.decision
                self.reasoning[node_instance_id] = result.reasoning
                self.extracted[node_instance_id] = result
                return None, result.decision, None
            else:
                if schema:
                    schema = await ask_schema_async(
                        text=full_prompt,
                        system=self.system_prompt,
                        pymodel=schema,
                        model=LLM_MODEL,
                    )
                    duration_ms = int((time.time() - start_time) * 1000)
                    self.node_durations[node_instance_id] = duration_ms
                    return schema, None, None # if output schema is provided, the return is the result of the schema
                else:
                    result = await ask_text_async(
                        text=full_prompt,
                        system=self.system_prompt,
                        model=LLM_MODEL,
                        temperature=temperature,
                    )
                    duration_ms = int((time.time() - start_time) * 1000)
                    self.node_durations[node_instance_id] = duration_ms
                    return None, None,result # if an end node, the return is the actual output message of the system
        except Exception as e:
            logger.error(f"Error in LLM function: {e}")
            raise

    async def can_currently_process_node(self, node: FlowchartNode) -> bool:
        # Check if node has any uncomputed variable dependencies
        node_text = node.text
        required_vars = re.findall(r"\$\{([^}]+)\}", node_text)

        if any(var not in self.loop_vars for var in required_vars):
            return False

        # Check if node has any explicit dependencies
        if hasattr(node, "needs") and node.needs:
            node_instance_id = self.get_node_instance_id(node.needs)
            if node_instance_id not in self.completed_nodes:
                return False

        return True

    async def get_processable_nodes(
        self, current_node_id: str, depth: int = 1
    ) -> List[str]:
        """Find nodes that can be processed ahead of time."""
        if depth <= 0:
            return []

        loop_lookahead = 0
        processable = []
        visited = set()
        queue = [(current_node_id, depth)]

        while queue:
            node_id, remaining_depth = queue.pop(0)
            node_instance_id = (
                f"{node_id}_{self.get_current_loop_iteration(node_id) + loop_lookahead}"
            )

            if node_instance_id in visited:
                continue

            node = self.flowchart[node_id]

            # Check node state under lock
            async with self.processing_nodes_lock:
                if (
                    await self.can_currently_process_node(node)
                ):
                    processable.append(node_instance_id)

            iterator_name = next(
                n.iterator
                for n in self.flowchart.values()
                if isinstance(n, LoopStartNode)
            )
            if node.type == NodeType.LOOP_CONTINUE and iterator_name in self.loop_states:
                loop_state = self.loop_states[iterator_name]

                # Check if there are more items to process in the collection
                if (
                    loop_state["current_index"] + loop_lookahead + 1
                    < len(loop_state["collection"])
                ):
                    queue.append((node.connections["HasMore"], remaining_depth - 1))
                    loop_lookahead += 1
                else:
                    queue.append((node.connections["Complete"], remaining_depth - 1))
                continue

            # Add connected nodes to queue if we still have depth
            if remaining_depth > 1:
                for next_node in node.connections.values():
                    next_instance_id = self.get_node_instance_id(next_node)
                    if next_instance_id not in self.visited_nodes:
                        queue.append((next_node, remaining_depth - 1))

        logger.debug(
            f"Found processable nodes for {self.get_node_instance_id(current_node_id)}: {processable}"
        )
        return processable

    def get_current_loop_iteration(self, node_id: str) -> int:
        """Generate a unique ID for this instance of the node, including its iteration count."""
        # Check if node is part of a loop
        if node_id in self.loop_nodes:
            # Get the iterator name from the loop start node
            iterator_name = next(
                n.iterator
                for n in self.flowchart.values()
                if isinstance(n, LoopStartNode)
            )
            # Use the loop's current index as iteration count
            if iterator_name in self.loop_states:
                iteration = self.loop_states[iterator_name]["current_index"]
            else:
                iteration = 0
        else:
            # For nodes outside loops, use 0 as iteration count
            iteration = 0

        return iteration

    def get_node_instance_id(self, node_id: str) -> str:
        """Generate a unique ID for this instance of the node, including its iteration count."""
        return f"{node_id}_{self.get_current_loop_iteration(node_id)}"

    async def process_node(self, node_id: str, context: Dict[str, Any]) -> Any:
        node_instance_id = self.get_node_instance_id(node_id)

        async with self.processing_nodes_lock:
            # Fast path - if already processing or completed, return immediately
            if node_instance_id in self.processing_nodes:
                if node_instance_id == "CheckUserWantsToDiscussPlan_0":
                    print("dd")
                logger.debug(f"Node '{node_instance_id}' is already processing")

            if node_instance_id in self.completed_nodes:
                logger.debug(f"Node '{node_instance_id}' is already completed")
                return self.node_results.get(node_instance_id)
            # Mark as processing before starting
            self.processing_nodes.add(node_instance_id)

        node = self.flowchart[node_id]
        start_time = time.time()
        logger.debug(f"Processing node instance: '{node_instance_id}'")

        try:
            if node.type in [NodeType.LOOP_START, NodeType.LOOP_CONTINUE]:
                result = self.handle_loop_node(node)
            else:
                node_prompt = node.text
                for prev_node, data in self.extracted.items():
                    if (
                        hasattr(data, "__class__")
                        and hasattr(data.__class__, "__name__")
                        and not data.__class__.__name__.startswith("DecisionSchema")
                    ):
                        model_name = data.__class__.__name__
                        data_dict = (
                            data.dict() if hasattr(data, "dict") else str(data)
                        )
                        node_prompt += f"\n\nContext: {model_name}: {data_dict}"

                connections = node.connections
                if len(connections) == 0:
                    _, _, output_text = await self.llm_function(
                            node_text=node_prompt,
                            context=context,
                            current_node_id=node_id,
                            schema=node.output_schema,
                        )
                    result = output_text
                elif len(connections) > 1:  # Decision node, result is the decision
                    options = list(connections.keys())
                    _, decision, _ = await self.llm_function(
                        node_text=node_prompt,
                        context=context,
                        current_node_id=node_id,
                        options=options,
                        schema=node.output_schema,
                    )
                    result = connections[decision]
                    
                else:  # Transition or end node, result is the next node
                    if node.output_schema:
                        schema_result, _, _ = await self.llm_function(
                            node_text=node_prompt,
                            context=context,
                            current_node_id=node_id,
                            schema=node.output_schema,
                        )
                        self.extracted[node_instance_id] = schema_result
                    result = connections["default"]

            # Store results and mark as completed
            self.node_results[node_instance_id] = result
            self.completed_nodes.add(node_instance_id)
            duration_ms = int((time.time() - start_time) * 1000)
            logger.debug(
                f"Finished processing node '{node_instance_id}' in {duration_ms}ms"
            )

            return result
        except Exception as e:
            logger.error(f"Error processing node '{node_instance_id}': {e}")
            raise

    def get_loop_nodes(self) -> List[str]:
        """Get all nodes that are part of any loop by checking for iterator variable usage."""
        loop_nodes = set()
        loop_iterator = None

        # First find the LOOP_START node to get the iterator name
        for node_id, node in self.flowchart.items():
            if node.type == NodeType.LOOP_START:
                loop_iterator = node.iterator
                loop_nodes.add(node_id)
                break

        if not loop_iterator:
            return []

        # Check all nodes for usage of the iterator variable
        iterator_pattern = f"${{{loop_iterator}}}"
        for node_id, node in self.flowchart.items():
            # Add nodes that use the iterator variable
            if hasattr(node, "text") and iterator_pattern in node.text:
                loop_nodes.add(node_id)
            # Always include LOOP_CONTINUE nodes
            if node.type == NodeType.LOOP_CONTINUE:
                loop_nodes.add(node_id)

        return list(loop_nodes)

    async def run(self, input_string: str):
        self.loop_visit_count = {}
        current_node_id = self.start_node
        context = {"initial_input": input_string}
        self.visited_nodes = []
        self.completed_nodes = set()
        self.execution_path = []
        self.node_results = {}
        self.extracted = {}
        self.decisions = {}
        self.node_durations = {}
        traversal = []

        while True:
            current_instance_id = self.get_node_instance_id(current_node_id)
            current_node = self.flowchart[current_node_id]
            logger.info(f"Processing current node: {current_instance_id}")

            if current_instance_id not in self.execution_path:
                self.execution_path.append(current_instance_id)

            # Start processing current node if not already processing/completed
            if current_instance_id in self.processing_nodes:
                logger.debug(f"Node '{current_instance_id}' is already processing")
            else:
                task = asyncio.create_task(self.process_node(current_node_id, context))
                self.node_tasks[current_instance_id] = task

            # Get and start processing lookahead nodes
            lookahead_nodes = await self.get_processable_nodes(
                current_node_id, self.lookahead_depth
            )
            for node_instance_id in lookahead_nodes:
                if node_instance_id != current_instance_id:  # Skip current node
                    node_id = node_instance_id.rsplit("_", 1)[0]
                    task = asyncio.create_task(self.process_node(node_id, context))
                    self.node_tasks[node_instance_id] = task

            # Prune unreachable nodes
            async with self.processing_nodes_lock:
                processing_nodes = set(self.processing_nodes)
                for node_instance_id in processing_nodes:
                    if node_instance_id not in lookahead_nodes:
                        # Node is processing but not in lookahead - it's unreachable
                        if node_instance_id in self.node_tasks:
                            task = self.node_tasks[node_instance_id]
                            if not task.done():
                                logger.debug(f"Cancelling unreachable node task: {node_instance_id}")
                                task.cancel()
                                try:
                                    await task
                                except asyncio.CancelledError:
                                    logger.debug(f"Successfully cancelled task for node: {node_instance_id}")
                                except Exception as e:
                                    logger.error(f"Error while cancelling task for node {node_instance_id}: {e}")
                            self.node_tasks.pop(node_instance_id, None)
                            self.processing_nodes.remove(node_instance_id)

            # Wait for current node to complete
            if current_instance_id not in self.completed_nodes:
                try:
                    logger.debug(f"Waiting for node '{current_instance_id}' to complete")
                    if current_instance_id not in self.node_tasks:
                        raise ValueError(f"No task found for node '{current_instance_id}'")
                    current_task = self.node_tasks[current_instance_id]
                    await asyncio.wait_for(current_task, timeout=20)
                except asyncio.TimeoutError:
                    logger.warning(f"Node '{current_instance_id}' timed out")
                except Exception as e:
                    logger.error(f"Error processing node '{current_instance_id}': {e}")
                    raise

            # Record node traversal
            node_entry = {
                "node": current_instance_id,
                "text": current_node.text,
                "options": list(current_node.connections.keys()),
                "reasoning": self.reasoning.get(current_instance_id),
                "decision": self.decisions.get(current_instance_id),
                "next_node": None,
                "duration_ms": self.node_durations.get(current_instance_id),
                "extracted": (
                    self.extracted[current_instance_id].dict()
                    if current_instance_id in self.extracted
                    and hasattr(self.extracted[current_instance_id], "dict")
                    else None
                ),
            }

            # If this is an end node, return
            if not current_node.connections:
                traversal.append(node_entry)
                logger.log(
                    "AI_FRAMEWORK",
                    f"Input: {input_string}\n\nTraversal: {json.dumps({'traversal': traversal}, indent=2)}",
                )
                result = self.node_results[current_instance_id]
                assert isinstance(
                    result, str
                ), f"End node '{current_instance_id}' must return a string"
                return result, self.extracted
                
            assert current_instance_id in self.completed_nodes, f"Node '{current_instance_id}' not found in completed_nodes"
            assert current_instance_id in self.node_results, f"Node '{current_instance_id}' not found in node_results"
            
            next_node = self.node_results[current_instance_id]

            node_entry["next_node"] = next_node
            traversal.append(node_entry)
            current_node_id = next_node
