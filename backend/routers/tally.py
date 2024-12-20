from fastapi import APIRouter, Request
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from gateways.aws.ses import SESGateway, get_email_template_string
from loguru import logger

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

@router.post("/webhook")
async def tally_webhook(payload: TallyWebhookPayload):
    try:
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

    except Exception as e:
        logger.error(f"Error processing Tally webhook: {e}")
        return {"status": "error", "message": str(e)}
