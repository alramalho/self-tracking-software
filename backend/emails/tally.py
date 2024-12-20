from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from gateways.aws.ses import SESGateway, get_email_template_string
from loguru import logger
import hmac
import hashlib
import base64
import json
from constants import TALLY_SIGNING_SECRET

router = APIRouter(prefix="/tally")
ses = SESGateway()

class TallyField(BaseModel):
    key: str
    label: str
    type: str
    value: Any
    options: Optional[List[Dict[str, str]]] = None

class TallyFormData(BaseModel):
    responseId: str
    submissionId: str
    respondentId: str
    formId: str
    formName: str
    createdAt: str
    fields: List[TallyField]

class TallyWebhookPayload(BaseModel):
    eventId: str
    eventType: str
    createdAt: str
    data: TallyFormData

def verify_tally_signature(payload: bytes, signature: str) -> bool:
    """Verify the Tally webhook signature."""
    if not TALLY_SIGNING_SECRET:
        logger.error("TALLY_SIGNING_SECRET not configured")
        return False
    
    try:
        # Calculate expected signature
        calculated_signature = base64.b64encode(
            hmac.new(
                TALLY_SIGNING_SECRET.encode('utf-8'),
                payload,
                hashlib.sha256
            ).digest()
        ).decode('utf-8')
        
        # Compare signatures using hmac.compare_digest to prevent timing attacks
        return hmac.compare_digest(calculated_signature, signature)
    except Exception as e:
        logger.error(f"Error verifying Tally signature: {e}")
        return False

@router.post("/webhook")
async def tally_webhook(request: Request):
    try:
        # Get the Tally signature from headers
        signature = request.headers.get('tally-signature')
        if not signature:
            raise HTTPException(status_code=401, detail="Missing Tally signature")

        # Get raw payload bytes for signature verification
        payload_bytes = await request.body()
        
        # Verify signature
        if not verify_tally_signature(payload_bytes, signature):
            raise HTTPException(status_code=401, detail="Invalid signature")

        # Parse payload
        payload = TallyWebhookPayload.parse_raw(payload_bytes)

        if payload.eventType != "FORM_RESPONSE":
            return {"status": "ignored", "message": "Not a form response event"}

        # Create email content
        header = "New Tally Form Submission! 📝"
        content = f"""
        <p>Someone just filled out the form "{payload.data.formName}"!</p>
        <p>Response details:</p>
        <ul>
            <li>Submission ID: {payload.data.submissionId}</li>
            <li>Form ID: {payload.data.formId}</li>
            <li>Submitted at: {payload.data.createdAt}</li>
        </ul>
        <div style="margin-top: 20px;">
            <a href="https://tally.so/forms/{payload.data.formId}/responses" 
               style="background-color: #0066cc; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                View Response in Tally
            </a>
        </div>
        """

        # Get email template and send
        html_body = get_email_template_string(header, content)
        ses.send_email(
            to="alexandre.ramalho.1998@gmail.com",
            subject="New Tally Form Submission",
            html_body=html_body
        )

        return {"status": "success", "message": "Webhook processed successfully"}

    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Error processing Tally webhook: {e}")
        raise HTTPException(status_code=500, detail=str(e))