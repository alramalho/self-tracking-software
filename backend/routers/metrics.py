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
                status_code=400, detail="A metric with this name already exists"
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
            rating=metric_data["rating"],
            date=metric_data.get("date"),
        )

        # Check if an entry already exists for this date
        existing_entry = metrics_gateway.get_metric_entry_by_metric_and_date(
            metric_id=metric_data["metric_id"], date=metric_entry.date
        )

        if existing_entry:
            # Update existing entry
            updated_entry = metrics_gateway.update_metric_entry(
                existing_entry.id, {"rating": metric_data["rating"]}
            )
            return updated_entry

        # Create new entry
        created_entry = metrics_gateway.create_metric_entry(metric_entry)
        return created_entry

    except Exception as e:
        logger.error(f"Error logging metric: {str(e)}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail="Failed to log metric")


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
