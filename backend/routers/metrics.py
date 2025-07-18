from fastapi import APIRouter, Depends, Body, HTTPException
from typing import List
from auth.clerk import is_clerk_user
from entities.user import User
from entities.metric import Metric, MetricEntry
from gateways.metrics import MetricsGateway
from loguru import logger
import traceback
from datetime import datetime
from analytics.posthog import posthog

router = APIRouter()
metrics_gateway = MetricsGateway()


@router.get("/metrics", response_model=List[Metric])
async def get_metrics(user: User = Depends(is_clerk_user)):
    """Get all metrics for the current user"""
    metrics = metrics_gateway.get_all_metrics_by_user_id(user.id)
    posthog.capture(
        distinct_id=user.id,
        event="get-metrics",
        properties={
            "$set": {
                "metrics_count": len(metrics),
            }
        },
    )
    return metrics


@router.post("/metrics", response_model=Metric)
async def create_metric(
    metric_data: dict = Body(...), user: User = Depends(is_clerk_user)
):
    """Create a new metric"""
    try:
        # Check if metric with same name already exists
        existing_metrics = metrics_gateway.get_all_metrics_by_user_id(user.id)
        title_lower = metric_data["title"].lower()
        if any(metric.title.lower() == title_lower for metric in existing_metrics):
            raise HTTPException(
                status_code=409,
                detail=f"A metric with this name '{metric_data['title']}' already exists",
            )

        new_metric = Metric.new(
            user_id=user.id,
            title=metric_data["title"],
            emoji=metric_data["emoji"],
        )
        created_metric = metrics_gateway.create_metric(new_metric)
        return created_metric
    except Exception as e:
        logger.error(f"Error creating metric: {str(e)}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail="Failed to create metric")


@router.post("/log-metric", response_model=MetricEntry)
async def log_metric(
    metric_data: dict = Body(...), user: User = Depends(is_clerk_user)
):
    """Log a metric rating"""
    try:
        metric_entry = MetricEntry.new(
            user_id=user.id,
            metric_id=metric_data["metric_id"],
            rating=metric_data.get("rating", 0),
            date=metric_data.get("date"),
            description=metric_data.get("description"),
            skipped=metric_data.get("skipped", False),
            description_skipped=metric_data.get("description_skipped", False),
        )

        # Check if an entry already exists for this date
        existing_entry = metrics_gateway.get_metric_entry_by_metric_and_date(
            metric_id=metric_data["metric_id"], date=metric_entry.date
        )

        if existing_entry:
            # Update existing entry
            updates = {}
            if "rating" in metric_data:
                updates["rating"] = metric_data["rating"]
            if "description" in metric_data:
                updates["description"] = metric_data["description"]
            if "skipped" in metric_data:
                updates["skipped"] = metric_data["skipped"]
            if "description_skipped" in metric_data:
                updates["description_skipped"] = metric_data["description_skipped"]
            
            updated_entry = metrics_gateway.update_metric_entry(
                existing_entry.id, updates
            )
            return updated_entry

        # Create new entry
        created_entry = metrics_gateway.create_metric_entry(metric_entry)
        return created_entry

    except Exception as e:
        logger.error(f"Error logging metric: {str(e)}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail="Failed to log metric")


@router.post("/skip-metric", response_model=MetricEntry)
async def skip_metric(
    metric_data: dict = Body(...), user: User = Depends(is_clerk_user)
):
    """Skip a metric for today"""
    try:
        today = datetime.now().isoformat()
        metric_entry = MetricEntry.new(
            user_id=user.id,
            metric_id=metric_data["metric_id"],
            rating=0,  # Default rating for skipped metrics
            date=metric_data.get("date", today),
            skipped=True,
            description_skipped=metric_data.get("description_skipped", False),
        )

        # Check if an entry already exists for this date
        existing_entry = metrics_gateway.get_metric_entry_by_metric_and_date(
            metric_id=metric_data["metric_id"], date=metric_entry.date
        )

        if existing_entry:
            # Update existing entry to mark as skipped
            updated_entry = metrics_gateway.update_metric_entry(
                existing_entry.id, {
                    "skipped": True,
                    "description_skipped": metric_data.get("description_skipped", False)
                }
            )
            return updated_entry

        # Create new skipped entry
        created_entry = metrics_gateway.create_metric_entry(metric_entry)
        return created_entry

    except Exception as e:
        logger.error(f"Error skipping metric: {str(e)}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail="Failed to skip metric")


@router.get("/metric-entries", response_model=List[MetricEntry])
async def get_metric_entries(
    metric_id: str = None, user: User = Depends(is_clerk_user)
):
    """Get metric entries, optionally filtered by metric_id"""
    try:
        if metric_id:
            return metrics_gateway.get_metric_entries_by_metric_id(metric_id)
        metric_entries = metrics_gateway.get_all_metric_entries_by_user_id(user.id)
        posthog.capture(
            distinct_id=user.id,
            event="get-metric-entries",
            properties={
                "$set": {"metric_entries_count": len(metric_entries)},
            },
        )
        return metric_entries
    except Exception as e:
        logger.error(
            f"Error getting metric entries: {str(e)}\n{traceback.format_exc()}"
        )
        raise HTTPException(status_code=500, detail="Failed to get metric entries")


@router.delete("/metrics/{metric_id}")
async def delete_metric(metric_id: str, user: User = Depends(is_clerk_user)):
    """Delete a metric and all its entries"""
    try:
        # Verify ownership
        metric = metrics_gateway.get_metric_by_id(metric_id)
        if not metric:
            raise HTTPException(status_code=404, detail="Metric not found")

        if metric.user_id != user.id:
            raise HTTPException(
                status_code=403, detail="Not authorized to delete this metric"
            )

        # Delete metric and its entries
        metrics_gateway.delete_metric(metric_id)
        return {"message": "Metric deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting metric: {str(e)}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail="Failed to delete metric")


@router.post("/log-todays-note")
async def log_todays_note(
    note_data: dict = Body(...), user: User = Depends(is_clerk_user)
):
    """Add a note to all of today's metric entries"""
    try:
        note = note_data.get("note", "")
        today = datetime.now().date()
        
        # Get all metric entries for today
        all_entries = metrics_gateway.get_all_metric_entries_by_user_id(user.id)
        todays_entries = [
            entry for entry in all_entries 
            if datetime.fromisoformat(entry.date.replace('Z', '+00:00')).date() == today
        ]
        
        if not todays_entries:
            raise HTTPException(
                status_code=404, 
                detail="No metric entries found for today"
            )
        
        # Update all today's entries with the note
        updated_entries = []
        for entry in todays_entries:
            updated_entry = metrics_gateway.update_metric_entry(
                entry.id, {"description": note}
            )
            updated_entries.append(updated_entry)
        
        posthog.capture(
            distinct_id=user.id,
            event="log-todays-note",
            properties={
                "entries_updated": len(updated_entries),
                "note_length": len(note)
            },
        )
        
        return {
            "message": "Note added to today's entries successfully",
            "entries_updated": len(updated_entries)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error logging today's note: {str(e)}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail="Failed to log today's note")


@router.post("/skip-todays-note")
async def skip_todays_note(
    user: User = Depends(is_clerk_user)
):
    """Skip adding a note to today's metric entries"""
    try:
        today = datetime.now().date()
        
        # Get all metric entries for today
        all_entries = metrics_gateway.get_all_metric_entries_by_user_id(user.id)
        todays_entries = [
            entry for entry in all_entries 
            if datetime.fromisoformat(entry.date.replace('Z', '+00:00')).date() == today
        ]
        
        if not todays_entries:
            raise HTTPException(
                status_code=404, 
                detail="No metric entries found for today"
            )
        
        # Update all today's entries to mark description as skipped
        updated_entries = []
        for entry in todays_entries:
            updated_entry = metrics_gateway.update_metric_entry(
                entry.id, {"description_skipped": True}
            )
            updated_entries.append(updated_entry)
        
        posthog.capture(
            distinct_id=user.id,
            event="skip-todays-note",
            properties={
                "entries_updated": len(updated_entries),
            },
        )
        
        return {
            "message": "Today's note skipped successfully",
            "entries_updated": len(updated_entries)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error skipping today's note: {str(e)}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail="Failed to skip today's note")
