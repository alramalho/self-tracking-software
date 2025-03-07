from pydantic import BaseModel, Field
from typing import Dict, Any, Optional, List
from datetime import datetime
from bson import ObjectId
from entities.activity import Activity, ActivityEntry
from entities.metric import Metric, MetricEntry
from entities.plan import Plan
class AssistantSuggestion(BaseModel):
    id: str = Field(default_factory=lambda: str(ObjectId()))
    type: str
    data: Dict[str, Any]
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())

    async def to_websocket_message(self) -> Dict:
        return {
            "type": f"suggested_{self.type}",
            "data": self.data,
            "metadata": self.metadata
        }

class ActivitySuggestion(AssistantSuggestion):
    type: str = "activity"
    
    @classmethod
    def from_activity_entry(cls, activity_entry: ActivityEntry, activity: Activity):
        return cls(
            data={
                "activity": activity.dict(),
                "entry": {
                    "id": str(ObjectId()),
                    **activity_entry.dict()
                }
            }
        ) 
    

class MetricSuggestion(AssistantSuggestion):
    type: str = "metric"
    
    @classmethod
    def from_metric_entry(cls, metric_entry: MetricEntry, metric: Metric):
        return cls(
            data={
                "metric": metric.dict(),
                "entry": {
                    "id": str(ObjectId()),
                    **metric_entry.dict()
                }
            }
        )
    
# Plan suggestion classes - similar to those in plan_creation_assistant.py but simplified
class PlanDetailsSuggestion(AssistantSuggestion):
    type: str = "plan_details"

    @classmethod
    def from_plan_and_activities_data(cls, plan: Plan, activities: List[Activity]):
        return cls(
            data={
                "plan": plan.dict(),
                "activities": [activity.dict() for activity in activities]
            }
        )


