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
        self.loop_states_lock = asyncio.Lock()

    async def handle_loop_node(self, node: FlowchartNode) -> str:
        if node.type == NodeType.LOOP_START:
            iterator_name = node.iterator
            collection_var = node.collection.replace("${", "").replace("}", "")

            async with self.loop_states_lock:
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

            async with self.loop_states_lock:
                loop_state = self.loop_states[iterator_name]
                loop_state["current_index"] += 1

                if loop_state["current_index"] < len(loop_state["collection"]):
                    self.loop_vars[iterator_name] = loop_state["collection"][
                        loop_state["current_index"]
                    ]
                    return node.connections["HasMore"]
                else:
                    return node.connections["Complete"]

    def replace_loop_vars(self, node_instance_id: str, text: str) -> str:
        """Replace loop variables with their values for the specific node instance."""
        node_id, iteration = node_instance_id.rsplit("_", 1)
        iteration = int(iteration)

        # Get the iterator name from the loop start node
        iterator_name = next(
            (n.iterator for n in self.flowchart.values() if isinstance(n, LoopStartNode)),
            None
        )
        
        if iterator_name and node_id in self.loop_nodes:
            if iterator_name in self.loop_states:
                loop_state = self.loop_states[iterator_name]
                collection = loop_state["collection"]
                
                # Use the iteration number to get the correct value
                if iteration < len(collection):
                    value = collection[iteration]
                    text = text.replace(f"${{{iterator_name}}}", str(value))

        return text

    async def llm_function(
        self,
        node_instance_id: str,
        context: Dict[str, Any],
    ) -> Tuple[Optional[BaseModel], str, str]:
        try:
            current_node_id = node_instance_id.rsplit("_", 1)[0]
            node = self.flowchart[current_node_id]
            node_text = self.replace_loop_vars(node_instance_id, node.text)
            options = list(node.connections.keys())

            full_prompt = f"<instruction>'{node_text}'</instruction>\nContext:{context['initial_input']}\n<instruction again>{node_text}</instruction again>"
            
            temperature = node.temperature

            if len(options) > 1:
                # If we have a schema, use it as the base, otherwise use BaseModel
                base_schema = node.output_schema if node.output_schema else BaseModel

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
                    __base__=base_schema,
                    **extension_fields,
                )
                result = await ask_schema_async(
                    text=full_prompt,
                    system=self.system_prompt,
                    pymodel=DecisionSchema,
                    model=LLM_MODEL,
                )
                self.decisions[node_instance_id] = result.decision
                self.reasoning[node_instance_id] = result.reasoning
                self.extracted[node_instance_id] = result
                return None, result.decision, None
            else:
                if node.output_schema:
                    schema = await ask_schema_async(
                        text=full_prompt,
                        system=self.system_prompt,
                        pymodel=node.output_schema,
                        model=LLM_MODEL,
                    )
                    self.extracted[node_instance_id] = schema
                    return schema, None, None # if output schema is provided, the return is the result of the schema
                else:
                    result = await ask_text_async(
                        text=full_prompt,
                        system=self.system_prompt,
                        model=LLM_MODEL,
                        temperature=temperature,
                    )
                    return None, None, result # if an end node, the return is the actual output message of the system
        except Exception as e:
            logger.error(f"Error in LLM function: {e}")
            raise

    async def can_currently_process_node(self, node_instance_id: str) -> bool:
        node_id = node_instance_id.rsplit("_", 1)[0]
        node = self.flowchart[node_id]
        # Check if node has any uncomputed variable dependencies
        node_text = node.text
        required_vars = re.findall(r"\$\{([^}]+)\}", node_text)

        if any(var not in self.loop_vars for var in required_vars):
            return False

        # Check if node has any explicit dependencies
        if hasattr(node, "needs") and node.needs:
            if node_instance_id not in self.completed_nodes:
                return False

        return True
    
    async def has_started_processing(self, node_instance_id: str) -> bool:
        async with self.processing_nodes_lock:
            # Fast path - if already processing or completed, return immediately
            if node_instance_id in self.processing_nodes:
                logger.debug(f"Node '{node_instance_id}' is already processing")
                return True

            if node_instance_id in self.completed_nodes:
                logger.debug(f"Node '{node_instance_id}' is already completed")
                return True
            
            return False

    async def get_or_start_node_task(self, node_instance_id: str, context: Dict[str, Any]) -> asyncio.Task:
        task = None
        if await self.has_started_processing(node_instance_id):
            task = self.node_tasks.get(node_instance_id)
        else:
            task = asyncio.create_task(self.process_node(node_instance_id, context)) 
            self.node_tasks[node_instance_id] = task

        return task

    async def get_processable_nodes(
        self, current_node_id: str, depth: int = 1
    ) -> List[str]:
        """Find nodes that can be processed ahead of time."""
        if depth <= 0:
            return []

        processable = []
        visited = set()
        # Queue now contains: (node_id, depth, loop_lookahead)
        queue = [(current_node_id, depth, 0)]

        while queue:
            node_id, remaining_depth, branch_loop_lookahead = queue.pop(0)
            node_instance_id = (
                f"{node_id}_{self.get_current_loop_iteration(node_id) + branch_loop_lookahead}"
            )

            if node_instance_id in visited:
                continue

            visited.add(node_instance_id)
            node = self.flowchart[node_id]

            # Check node state under lock
            async with self.processing_nodes_lock:
                if await self.can_currently_process_node(node_instance_id):
                    processable.append(node_instance_id)

            # If we've reached max depth, don't add more nodes to queue
            if remaining_depth <= 1:
                continue

            iterator_name = next(
                (n.iterator for n in self.flowchart.values() if isinstance(n, LoopStartNode)),
                None
            )

            # Handle loop continue nodes
            if node.type == NodeType.LOOP_CONTINUE and iterator_name:
                async with self.loop_states_lock:
                    if iterator_name in self.loop_states:
                        loop_state = self.loop_states[iterator_name]
                        
                        # Check if there are more items to process in the collection
                        if (
                            loop_state["current_index"] + branch_loop_lookahead + 1
                            < len(loop_state["collection"])
                        ):
                            queue.append((
                                node.connections["HasMore"], 
                                remaining_depth - 1,
                                branch_loop_lookahead + 1
                            ))
                            queue.append((
                                node.connections["Complete"],
                                remaining_depth - 1,
                                branch_loop_lookahead
                            ))
                        else:
                            queue.append((
                                node.connections["Complete"],
                                remaining_depth - 1,
                                branch_loop_lookahead
                            ))
                continue

            # Add connected nodes to queue, maintaining the branch's lookahead
            for next_node in node.connections.values():
                next_instance_id = f"{next_node}_{self.get_current_loop_iteration(next_node) + branch_loop_lookahead}"
                if next_instance_id not in visited:
                    queue.append((next_node, remaining_depth - 1, branch_loop_lookahead))

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

    async def process_node(self, node_instance_id: str, context: Dict[str, Any]) -> Any:
        node_id = node_instance_id.rsplit("_", 1)[0]
    
        async with self.processing_nodes_lock:
            self.processing_nodes.add(node_instance_id)
            logger.debug(f"Processing node instance: '{node_instance_id}'")

        node = self.flowchart[node_id]
        start_time = time.time()

        try:
            if node.type in [NodeType.LOOP_START, NodeType.LOOP_CONTINUE]:
                result = await self.handle_loop_node(node)
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

                if node_instance_id == "CheckPlanDiscussed_1":
                    print(f"bepp")

                connections = node.connections
                if len(connections) == 0:
                    _, _, output_text = await self.llm_function(
                        node_instance_id=node_instance_id,
                        context=context,
                    )
                    result = output_text
                elif len(connections) > 1:  # Decision node, result is the decision
                    _, decision, _ = await self.llm_function(
                        node_instance_id=node_instance_id,
                        context=context,
                    )
                    result = connections[decision]
                    if node_instance_id == "CheckPlanDiscussed_1":
                        print(f"bepp")
                    
                else:  # Transition or end node, result is the next node
                    if node.output_schema:
                        schema_result, _, _ = await self.llm_function(
                            node_instance_id=node_instance_id,
                            context=context,
                        )
                        self.extracted[node_instance_id] = schema_result
                    result = connections["default"]

            # Store results and mark as completed
            if node_instance_id == "CheckPlanDiscussed_1":
                print(f"bepp")
            self.node_results[node_instance_id] = result
            self.completed_nodes.add(node_instance_id)

            duration_ms = int((time.time() - start_time) * 1000)
            self.node_durations[node_instance_id] = duration_ms


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

            if current_instance_id == "CheckPlanDiscussed_1":
                print(f"bepp")

            if current_instance_id not in self.execution_path:
                self.execution_path.append(current_instance_id)

            # Get and start processing current node
            await self.get_or_start_node_task(current_instance_id, context)
                  
            # Get and start processingm lookahead nodes
            lookahead_nodes = await self.get_processable_nodes(
                current_node_id, self.lookahead_depth
            )
            for node_instance_id in lookahead_nodes:
                if node_instance_id != current_instance_id:
                    await self.get_or_start_node_task(node_instance_id, context)

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
                    f"Input: {input_string}\n\nTraversal: {json.dumps({'traversal': traversal}, indent=2)}. Execution path: {self.execution_path}",
                )
                result = self.node_results[current_instance_id]
                assert isinstance(
                    result, str
                ), f"End node '{current_instance_id}' must return a string"

                filtered_extracted = {
                    node_id: self.extracted[node_id]
                    for node_id in self.extracted 
                    if node_id in self.execution_path
                }
                return result, filtered_extracted
            
            assert current_instance_id in self.completed_nodes, f"Node '{current_instance_id}' not found in completed_nodes"
            assert current_instance_id in self.node_results, f"Node '{current_instance_id}' not found in node_results"
            
            next_node = self.node_results[current_instance_id]

            if current_instance_id == "CheckPlanDiscussed_1":
                print(f"bepp")

            node_entry["next_node"] = next_node
            traversal.append(node_entry)
            current_node_id = next_node
