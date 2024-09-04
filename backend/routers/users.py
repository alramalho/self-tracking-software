from fastapi import APIRouter, Depends
from typing import List
from pydantic import BaseModel
from auth.clerk import is_clerk_user
from entities.user import User
from gateways.activities import ActivitiesGateway
from gateways.moodreports import MoodsGateway

router = APIRouter(prefix="/api", dependencies=[Depends(is_clerk_user)])

activities_gateway = ActivitiesGateway()
moods_gateway = MoodsGateway()

class ActivityResponse(BaseModel):
    id: str
    title: str
    measure: str

class ActivityEntryResponse(BaseModel):
    id: str
    activity_id: str
    quantity: int
    date: str

class MoodReportResponse(BaseModel):
    id: str
    user_id: str
    date: str
    score: str

@router.get("/activities", response_model=List[ActivityResponse])
async def get_activities(user: User = Depends(is_clerk_user)):
    activities = activities_gateway.get_all_activities_by_user_id(user.id)
    return [
        ActivityResponse(id=a.id, title=a.title, measure=a.measure) for a in activities
    ]

@router.get("/activity-entries", response_model=List[ActivityEntryResponse])
async def get_activity_entries(user: User = Depends(is_clerk_user)):
    activities = activities_gateway.get_all_activities_by_user_id(user.id)
    all_entries = []
    for activity in activities:
        entries = activities_gateway.get_all_activity_entries_by_activity_id(
            activity.id
        )
        all_entries.extend(entries)
    return [
        ActivityEntryResponse(
            id=e.id, activity_id=e.activity_id, quantity=e.quantity, date=e.date
        )
        for e in all_entries
    ]

@router.get("/mood-reports", response_model=List[MoodReportResponse])
async def get_mood_reports(user: User = Depends(is_clerk_user)):
    mood_reports = moods_gateway.get_all_mood_reports_by_user_id(user.id)
    return [
        MoodReportResponse(id=m.id, user_id=m.user_id, date=m.date, score=m.score)
        for m in mood_reports
    ]

@router.get("/user-health")
async def health():
    return {"status": "ok"}