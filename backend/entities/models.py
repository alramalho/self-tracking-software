from tortoise import fields, models
from typing import Optional, List, Literal
from datetime import datetime


class User(models.Model):
    # Primary key (using _id to match existing PostgreSQL schema)
    _id = fields.CharField(pk=True, max_length=255)  # MongoDB ObjectId format
    
    # Basic info
    name = fields.CharField(max_length=255, null=True)
    picture = fields.CharField(max_length=512, null=True)
    username = fields.CharField(max_length=255, null=True, unique=True)
    timezone = fields.CharField(max_length=50, null=True)
    clerk_id = fields.CharField(max_length=255, null=True, unique=True)
    language = fields.CharField(max_length=50, default="English")
    email = fields.CharField(max_length=255, unique=True)
    
    # Timestamps and status
    created_at = fields.CharField(max_length=255)  # Store as string to match MongoDB format
    deleted = fields.BooleanField(default=False)
    deleted_at = fields.CharField(max_length=255, null=True)
    
    # PWA related
    is_pwa_installed = fields.BooleanField(default=False)
    is_pwa_notifications_enabled = fields.BooleanField(default=False)
    pwa_subscription_endpoint = fields.CharField(max_length=512, null=True)
    pwa_subscription_key = fields.CharField(max_length=512, null=True)
    pwa_subscription_auth_token = fields.CharField(max_length=512, null=True)
    
    # Relations (stored as string arrays to match MongoDB format)
    plan_ids = fields.JSONField(default=list)  # TODO: Replace with proper relation after migration
    friend_ids = fields.JSONField(default=list)  # TODO: Replace with proper relation after migration
    plan_invitations = fields.JSONField(default=list)  # TODO: Replace with proper relation after migration
    referred_user_ids = fields.JSONField(default=list)  # TODO: Replace with proper relation after migration
    unactivated_email_sent_at = fields.DatetimeField(null=True)

    class Meta:
        table = "users"

    def __str__(self):
        return f"{self.name} ({self.email})"


class PlanSession(models.Model):
    # Primary key (using _id to match existing PostgreSQL schema)
    _id = fields.CharField(pk=True, max_length=255)  # MongoDB ObjectId format
    
    # Basic info
    date = fields.CharField(max_length=255)  # Store as string to match MongoDB format
    activity_id = fields.CharField(max_length=255)  # TODO: Replace with proper relation after migration
    descriptive_guide = fields.TextField()
    quantity = fields.IntField()
    plan_id = fields.CharField(max_length=255)  # TODO: Replace with proper relation after migration

    class Meta:
        table = "plan_sessions"


class Plan(models.Model):
    # Primary key (using _id to match existing PostgreSQL schema)
    _id = fields.CharField(pk=True, max_length=255)  # MongoDB ObjectId format
    
    # Basic info
    user_id = fields.CharField(max_length=255)  # TODO: Replace with proper relation after migration
    plan_group_id = fields.CharField(max_length=255, null=True)  # TODO: Replace with proper relation after migration
    goal = fields.TextField()
    emoji = fields.CharField(max_length=10, null=True)
    finishing_date = fields.CharField(max_length=255, null=True)  # Store as string to match MongoDB format
    
    # Timestamps
    created_at = fields.CharField(max_length=255)  # Store as string to match MongoDB format
    deleted_at = fields.CharField(max_length=255, null=True)
    
    # Additional fields
    duration_type = fields.CharField(max_length=20, null=True)  # "habit" | "lifestyle" | "custom"
    outline_type = fields.CharField(max_length=20, default="specific")  # "specific" | "times_per_week"
    times_per_week = fields.IntField(null=True)
    notes = fields.TextField(null=True)

    class Meta:
        table = "plans"

    def __str__(self):
        return f"Plan {self._id}: {self.goal}"


class Activity(models.Model):
    # Primary key (using _id to match existing PostgreSQL schema)
    _id = fields.CharField(pk=True, max_length=255)  # MongoDB ObjectId format
    
    # Basic info
    user_id = fields.CharField(max_length=255)  # TODO: Replace with proper relation after migration
    invitee_ids = fields.JSONField(default=list)  # TODO: Replace with proper relation after migration
    title = fields.CharField(max_length=255)
    measure = fields.CharField(max_length=50)  # e.g. 'minutes', 'kilometers', 'times'
    emoji = fields.CharField(max_length=10)
    
    # Timestamps
    created_at = fields.CharField(max_length=255)  # Store as string to match MongoDB format
    deleted_at = fields.CharField(max_length=255, null=True)

    class Meta:
        table = "activities"

    def __str__(self):
        return f"{self.emoji} {self.title} (measured in {self.measure})"


class ActivityEntry(models.Model):
    # Primary key (using _id to match existing PostgreSQL schema)
    _id = fields.CharField(pk=True, max_length=255)  # MongoDB ObjectId format
    
    # Basic info
    activity_id = fields.CharField(max_length=255)  # TODO: Replace with proper relation after migration
    user_id = fields.CharField(max_length=255, null=True)  # TODO: Replace with proper relation after migration
    quantity = fields.IntField()
    date = fields.CharField(max_length=10)  # YYYY-MM-DD format
    
    # Image info (stored as JSON to match MongoDB format)
    image = fields.JSONField(null=True)  # Optional[ImageInfo]
    
    # Reactions (stored as JSON to match MongoDB format)
    reactions = fields.JSONField(default=dict)  # dict[str, List[str]] TODO: Consider creating a separate reactions table
    
    # Timestamps
    created_at = fields.CharField(max_length=255)  # Store as string to match MongoDB format
    deleted_at = fields.CharField(max_length=255, null=True)

    class Meta:
        table = "activity_entries"

    def __str__(self):
        return f"Entry for activity {self.activity_id} on {self.date}"


class Notification(models.Model):
    # Primary key (using _id to match existing PostgreSQL schema)
    _id = fields.CharField(pk=True, max_length=255)  # MongoDB ObjectId format
    
    # Basic info
    user_id = fields.CharField(max_length=255)  # TODO: Replace with proper relation after migration
    message = fields.TextField()
    
    # Timestamps (all stored as strings to match MongoDB format)
    created_at = fields.CharField(max_length=255)
    sent_at = fields.CharField(max_length=255, null=True)
    processed_at = fields.CharField(max_length=255, null=True)
    opened_at = fields.CharField(max_length=255, null=True)
    concluded_at = fields.CharField(max_length=255, null=True)
    scheduled_for = fields.CharField(max_length=255, null=True)
    
    # Additional fields
    recurrence = fields.CharField(max_length=10, null=True)  # "daily" | "weekly"
    aws_cronjob_id = fields.CharField(max_length=255, null=True)
    prompt_tag = fields.CharField(max_length=255, null=True)
    status = fields.CharField(max_length=20, default="pending")  # "pending" | "processed" | "opened" | "concluded"
    type = fields.CharField(max_length=20, default="info")  # "friend_request" | "plan_invitation" | "engagement" | "info"
    related_id = fields.CharField(max_length=255, null=True)  # For storing friend request or plan invitation IDs
    related_data = fields.JSONField(null=True)

    class Meta:
        table = "notifications"

    def __str__(self):
        return f"Notification for user {self.user_id}: {self.message[:50]}..." 


class Message(models.Model):
    # Primary key (using _id to match existing PostgreSQL schema)
    _id = fields.CharField(pk=True, max_length=255)  # MongoDB ObjectId format
    
    # Basic info
    sender_name = fields.CharField(max_length=255)
    sender_id = fields.CharField(max_length=255)  # TODO: Replace with proper relation after migration
    recipient_name = fields.CharField(max_length=255)
    recipient_id = fields.CharField(max_length=255)  # TODO: Replace with proper relation after migration
    text = fields.TextField()
    
    # Timestamps
    created_at = fields.CharField(max_length=255)  # Store as string to match MongoDB format
    
    # Emotions (stored as JSON to match MongoDB format)
    emotions = fields.JSONField(default=list)  # List[Emotion]

    class Meta:
        table = "messages"

    def __str__(self):
        return f"{self.sender_name}: {self.text[:50]}..."


class PlanGroupMember(models.Model):
    # Primary key (using _id to match existing PostgreSQL schema)
    _id = fields.CharField(pk=True, max_length=255)  # MongoDB ObjectId format
    
    # Basic info
    user_id = fields.CharField(max_length=255)  # TODO: Replace with proper relation after migration
    username = fields.CharField(max_length=255)
    name = fields.CharField(max_length=255)
    picture = fields.CharField(max_length=512, null=True)
    plan_group_id = fields.CharField(max_length=255)  # TODO: Replace with proper relation after migration

    class Meta:
        table = "plan_group_members"

    def __str__(self):
        return f"{self.name} ({self.username})"


class PlanGroup(models.Model):
    # Primary key (using _id to match existing PostgreSQL schema)
    _id = fields.CharField(pk=True, max_length=255)  # MongoDB ObjectId format
    
    # Relations (stored as JSON to match MongoDB format)
    plan_ids = fields.JSONField(default=list)  # TODO: Replace with proper relation after migration

    class Meta:
        table = "plan_groups"

    def __str__(self):
        return f"Plan Group {self._id}"


class FriendRequest(models.Model):
    # Primary key (using _id to match existing PostgreSQL schema)
    _id = fields.CharField(pk=True, max_length=255)  # MongoDB ObjectId format
    
    # Basic info
    sender_id = fields.CharField(max_length=255)  # TODO: Replace with proper relation after migration
    recipient_id = fields.CharField(max_length=255)  # TODO: Replace with proper relation after migration
    status = fields.CharField(max_length=20)  # "pending" | "accepted" | "rejected"
    
    # Timestamps
    created_at = fields.CharField(max_length=255)  # Store as string to match MongoDB format
    updated_at = fields.CharField(max_length=255, null=True)

    class Meta:
        table = "friend_requests"

    def __str__(self):
        return f"Friend request from {self.sender_id} to {self.recipient_id}"


class PlanInvitation(models.Model):
    # Primary key (using _id to match existing PostgreSQL schema)
    _id = fields.CharField(pk=True, max_length=255)  # MongoDB ObjectId format
    
    # Basic info
    plan_id = fields.CharField(max_length=255)  # TODO: Replace with proper relation after migration
    sender_id = fields.CharField(max_length=255)  # TODO: Replace with proper relation after migration
    recipient_id = fields.CharField(max_length=255)  # TODO: Replace with proper relation after migration
    status = fields.CharField(max_length=20)  # "pending" | "accepted" | "rejected"
    
    # Timestamps
    created_at = fields.CharField(max_length=255)  # Store as string to match MongoDB format
    updated_at = fields.CharField(max_length=255, null=True)

    class Meta:
        table = "plan_invitations"

    def __str__(self):
        return f"Plan invitation for plan {self.plan_id} from {self.sender_id} to {self.recipient_id}" 