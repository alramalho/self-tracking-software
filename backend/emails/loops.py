import requests
from typing import Optional, List, Dict, TypedDict, Union
from constants import LOOPS_API_KEY
from shared.logger import logger

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


def _make_loops_request(method: str, endpoint: str, payload: Optional[dict] = None) -> LoopsResponse:
    url = f"https://app.loops.so/api/v1/{endpoint}"
    
    headers = {
        "Authorization": f"Bearer {LOOPS_API_KEY}",
        "Content-Type": "application/json"
    }

    try:
        logger.log("LOOPS", f"{method} {endpoint}")
        response = requests.request(method=method, url=url, headers=headers, json=payload)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        logger.error(f"Loops API error: {method} {endpoint} failed - {str(e)}")
        if hasattr(e, 'response') and e.response is not None:
            logger.error(f"Response status: {e.response.status_code}")
            logger.error(f"Response body: {e.response.text}")
        
        # Return appropriate error responses based on the operation
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
    properties: Optional[Dict[str, Union[str, int, float, bool]]] = None
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
    if properties:
        payload.update(properties)
        
    return payload


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
    return _make_loops_request("POST", "contacts/create", payload)  # type: ignore


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
    return _make_loops_request("PUT", "contacts/update", payload)  # type: ignore


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
        
    contacts = find_loops_contacts()
    existing_contact = next((c for c in contacts if c["email"] == email), None)
    
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


def find_loops_contacts() -> List[LoopsContact]:
    logger.log("LOOPS", "Finding all contacts")
    return _make_loops_request("GET", "contacts/find")  # type: ignore


def delete_loops_contact(email: str, user_id: Optional[str] = None) -> LoopsDeleteResponse:
    logger.log("LOOPS", f"Attempting to delete contact {email}")
    contacts = find_loops_contacts()
    existing_contact = next((c for c in contacts if c["email"] == email), None)
    
    if not existing_contact:
        logger.log("LOOPS", f"Contact {email} not found, skipping delete")
        return {"success": True, "message": "Contact not found"}
        
    logger.log("LOOPS", f"Deleting contact {email}")
    payload = {"email": email}
    if user_id:
        payload["userId"] = user_id
    return _make_loops_request("POST", "contacts/delete", payload)  # type: ignore
