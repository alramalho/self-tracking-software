import requests
from typing import Optional, List, Dict, TypedDict, Union, Any, NamedTuple
from constants import LOOPS_API_KEY, ENVIRONMENT
from shared.logger import logger
from entities.user import User
from typing import Tuple
from gateways.users import UsersGateway
from gateways.activities import ActivitiesGateway


class LoopsContact(TypedDict, total=False):
    id: str
    email: str
    firstName: str
    lastName: str
    source: str
    subscribed: bool
    userGroup: str
    userId: str
    mailingLists: Dict[str, bool]
    custom_properties: Dict[str, Union[str, int, float, bool]]


class LoopsContactResponse(TypedDict):
    success: bool
    id: str


class LoopsDeleteResponse(TypedDict):
    success: bool
    message: str


LoopsResponse = Union[LoopsContactResponse, LoopsDeleteResponse, List[LoopsContact]]


class ContactDiff(NamedTuple):
    """Represents differences between User and Loops contact"""
    user: User
    existing_data: Dict[str, Any]
    needs_update: bool


def _make_loops_request(
    method: str, 
    endpoint: str, 
    payload: Optional[dict] = None,
    params: Optional[dict] = None
) -> LoopsResponse:
    
    if not LOOPS_API_KEY:
        logger.error("LOOPS", "LOOPS_API_KEY is not set")
        return {"success": False, "id": "", "message": "LOOPS_API_KEY is not set"}
    
    url = f"https://app.loops.so/api/v1/{endpoint}"
    headers = {
        "Authorization": f"Bearer {LOOPS_API_KEY}",
        "Content-Type": "application/json"
    }

    try:
        logger.log("LOOPS", f"{method} {endpoint}")
        response = requests.request(
            method=method, 
            url=url, 
            headers=headers, 
            json=payload,
            params=params
        )
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        logger.error(f"Loops API error: {method} {endpoint} failed - {str(e)}")
        if hasattr(e, 'response') and e.response is not None:
            logger.error(f"Response status: {e.response.status_code}")
            logger.error(f"Response body: {e.response.text}")
        
        if endpoint == "contacts/find":
            return []
        elif endpoint == "contacts/delete":
            return {"success": False, "message": f"Failed to delete: {str(e)}"}
        else:
            return {"success": False, "id": "", "message": f"Operation failed: {str(e)}"}  # type: ignore


def _build_contact_payload(
    email: str,
    first_name: Optional[str] = None,
    last_name: Optional[str] = None,
    source: Optional[str] = None,
    subscribed: bool = True,
    user_group: Optional[str] = None,
    user_id: Optional[str] = None,
    mailing_lists: Optional[Dict[str, bool]] = None,
    custom_properties: Optional[Dict[str, Union[str, int, float, bool]]] = None
) -> dict:
    payload = {
        "email": email,
        "subscribed": subscribed
    }
    
    if first_name:
        payload["firstName"] = first_name
    if last_name:
        payload["lastName"] = last_name
    if source:
        payload["source"] = source
    if user_group:
        payload["userGroup"] = user_group
    if user_id:
        payload["userId"] = user_id
    if mailing_lists:
        payload["mailingLists"] = mailing_lists
    if custom_properties:
        payload.update(custom_properties)
        
    return payload


def find_loops_contact(email: Optional[str] = None, user_id: Optional[str] = None) -> Optional[LoopsContact]:
    if not email and not user_id:
        raise ValueError("Either email or user_id must be provided")
    if email and user_id:
        raise ValueError("Only one of email or user_id should be provided")
        
    params = {}
    if email:
        params["email"] = email
    if user_id:
        params["userId"] = user_id
        
    logger.log("LOOPS", f"Finding contact with params: {params}")
    response = _make_loops_request("GET", "contacts/find", params=params)
    contacts = response if isinstance(response, list) else []  # type: ignore
    return contacts[0] if contacts else None


def create_loops_contact(
    email: str,
    first_name: Optional[str] = None,
    last_name: Optional[str] = None,
    source: Optional[str] = None,
    subscribed: bool = True,
    user_group: Optional[str] = None,
    user_id: Optional[str] = None,
    mailing_lists: Optional[Dict[str, bool]] = None,
    custom_properties: Optional[Dict[str, Union[str, int, float, bool]]] = None
) -> LoopsContactResponse:
    logger.log("LOOPS", f"Creating contact {email}")
    payload = _build_contact_payload(
        email, first_name, last_name, source, 
        subscribed, user_group, user_id, mailing_lists,
        custom_properties
    )
    return _make_loops_request("POST", "contacts/create", payload=payload)  # type: ignore


def update_loops_contact(
    email: str,
    first_name: Optional[str] = None,
    last_name: Optional[str] = None,
    source: Optional[str] = None,
    subscribed: bool = True,
    user_group: Optional[str] = None,
    user_id: Optional[str] = None,
    mailing_lists: Optional[Dict[str, bool]] = None,
    custom_properties: Optional[Dict[str, Union[str, int, float, bool]]] = None
) -> LoopsContactResponse:
    logger.log("LOOPS", f"Updating contact {email}")
    payload = _build_contact_payload(
        email, first_name, last_name, source,
        subscribed, user_group, user_id, mailing_lists,
        custom_properties
    )
    return _make_loops_request("PUT", "contacts/update", payload=payload)  # type: ignore


def upsert_loops_contact(
    email: str,
    first_name: Optional[str] = None,
    last_name: Optional[str] = None,
    source: Optional[str] = None,
    subscribed: bool = True,
    user_group: Optional[str] = None,
    user_id: Optional[str] = None,
    mailing_lists: Optional[Dict[str, bool]] = None,
    custom_properties: Optional[Dict[str, Union[str, int, float, bool]]] = None
) -> LoopsContactResponse:
    logger.log("LOOPS", f"Upserting contact {email}")
    if custom_properties:
        logger.log("LOOPS", f"With custom properties: {custom_properties}")
        
    existing_contact = find_loops_contact(email=email)
    
    if existing_contact:
        logger.log("LOOPS", f"Contact {email} exists, updating")
        return update_loops_contact(
            email, first_name, last_name, source,
            subscribed, user_group, user_id, mailing_lists,
            custom_properties
        )
    
    logger.log("LOOPS", f"Contact {email} not found, creating")
    return create_loops_contact(
        email, first_name, last_name, source,
        subscribed, user_group, user_id, mailing_lists,
        custom_properties
    )


def delete_loops_contact(email: str, user_id: Optional[str] = None) -> LoopsDeleteResponse:
    logger.log("LOOPS", f"Attempting to delete contact {email}")
    existing_contact = find_loops_contact(email=email)
    
    if not existing_contact:
        logger.log("LOOPS", f"Contact {email} not found, skipping delete")
        return {"success": True, "message": "Contact not found"}
        
    logger.log("LOOPS", f"Deleting contact {email}")
    payload = {"email": email}
    if user_id:
        payload["userId"] = user_id
    return _make_loops_request("POST", "contacts/delete", payload=payload)  # type: ignore


def send_loops_event(
    email: str,
    event_name: str,
    user_id: Optional[str] = None,
    event_properties: Optional[Dict[str, Union[str, int, float, bool]]] = None,
    mailing_lists: Optional[Dict[str, bool]] = None
) -> Dict[str, bool]:
    """
    Send an event to Loops.so
    
    Args:
        email: User's email address
        event_name: Name of the event
        user_id: Optional user ID
        event_properties: Optional dictionary of event properties
        mailing_lists: Optional dictionary of mailing list subscriptions
        
    Returns:
        Response from Loops API with success status
    """
    logger.log("LOOPS", f"Sending event {event_name} for {email}")
    if event_properties:
        logger.log("LOOPS", f"With properties: {event_properties}")
        
    payload = {
        "email": email,
        "eventName": event_name
    }
    
    if user_id:
        payload["userId"] = user_id
    if event_properties:
        payload["eventProperties"] = event_properties
    if mailing_lists:
        payload["mailingLists"] = mailing_lists
        
    return _make_loops_request("POST", "events/send", payload=payload)  # type: ignore


def get_user_properties(user: User) -> Dict[str, Any]:
    """Extract relevant user properties for Loops"""
    activities_gateway = ActivitiesGateway()
    user_activities = activities_gateway.get_all_activities_by_user_id(user.id)
    user_activity_entries = activities_gateway.get_all_activity_entries_by_user_id(user.id)

    user_activity_count = len(user_activities)
    user_activity_entry_count = len(user_activity_entries)
    
    return {
        "username": user.username,
        "friendCount": len(user.friend_ids),
        "activityCount": user_activity_count,
        "activityEntryCount": user_activity_entry_count,
        "planCount": len(user.plan_ids),
        "referralCount": len(user.referred_user_ids),
        "deletedAt": user.deleted_at or "",
        "isDeleted": user.deleted,
    }


def compare_contact_data(user: User, loops_contact: Dict[str, Any]) -> Tuple[bool, List[str]]:
    """Compare user data with existing Loops contact data"""
    user_props = get_user_properties(user)

    
    differences = []
    for key, value in user_props.items():
        if str(value) != str(loops_contact.get(key, '')):
            differences.append(f"{key}: {loops_contact.get(key, '')} -> {value}")
            
    if len(differences) == 0:
        return False, []
    return True, differences


def sync_users_to_loops(dry_run: bool = True) -> Dict[str, Any]:
    """
    Sync all users to Loops.so
    Returns summary of operations performed
    """
    if ENVIRONMENT not in ["production"]:
        raise ValueError(f"Invalid environment for Loops sync: {ENVIRONMENT}")
        
    users_gateway = UsersGateway()
    users = users_gateway.get_all_users()
    
    stats = {
        "total_users": len(users),
        "created": 0,
        "updated": 0,
        "skipped": 0,
        "errors": 0,
        "details": []
    }

    logger.info(f"Starting Loops sync for {len(users)} users")
    
    for user in users:
        try:
            if not user.email:
                stats["skipped"] += 1
                stats["details"].append(f"Skipped user {user.id}: No email")
                continue
                
            existing_contact = find_loops_contact(email=user.email)
            
            if existing_contact:
                needs_update, differences = compare_contact_data(user, existing_contact)
                if not needs_update:
                    stats["skipped"] += 1
                    stats["details"].append(f"Skipped user {user.email}: No changes needed")
                    continue
                elif dry_run:
                    stats["updated"] += 1
                    stats["details"].append(f"Would update user {user.email}: {differences}")
                    continue
            
            if not dry_run:
                result = upsert_loops_contact(
                    email=user.email,
                    first_name=user.name,
                    user_id=user.id,
                    source="tracking.so",
                    custom_properties=get_user_properties(user)
                )
                
                if result.get("success", False):
                    if existing_contact:
                        stats["updated"] += 1
                        stats["details"].append(f"Updated user {user.email}")
                    else:
                        stats["created"] += 1
                        stats["details"].append(f"Created user {user.email}")
                else:
                    stats["errors"] += 1
                    stats["details"].append(f"Error processing user {user.email}: {result.get('message', 'Unknown error')}")
            
        except Exception as e:
            stats["errors"] += 1
            stats["details"].append(f"Error processing user {user.email}: {str(e)}")
            logger.error(f"Failed to sync user {user.email}: {e}")
    
    return stats
