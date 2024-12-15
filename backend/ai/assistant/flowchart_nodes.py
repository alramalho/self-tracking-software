from enum import Enum
from typing import Dict, Any, Optional, List, Union, Type, Set
from pydantic import BaseModel, Field


class NodeType(str, Enum):
    BASIC = "basic"
    LOOP_START = "loop_start"
    LOOP_CONTINUE = "loop_continue"


class Node(BaseModel):
    type: NodeType = NodeType.BASIC
    text: str
    connections: Dict[str, str] = {}
    output_schema: Optional[Type[BaseModel]] = None
    temperature: float = 0.7
    needs: Optional[Set[str]] = None


class LoopStartNode(Node):
    type: NodeType = NodeType.LOOP_START
    iterator: str
    collection: str


class LoopContinueNode(Node):
    type: NodeType = NodeType.LOOP_CONTINUE


FlowchartNode = Union[Node, LoopStartNode, LoopContinueNode] 