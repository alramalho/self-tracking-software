from pydantic import BaseModel, Field
from typing import Dict, Any, Optional
from datetime import datetime
from bson import ObjectId
from entities.activity import Activity, ActivityEntry
from entities.metric import Metric, MetricEntry

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
