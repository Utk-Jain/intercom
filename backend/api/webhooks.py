from fastapi import APIRouter, Request, Response
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/webhooks", tags=["webhooks"])

@router.post("/resend")
async def resend_inbound_webhook(request: Request):
    """
    Optional Resend Webhook endpoint (Gmail IMAP polling is active).
    """
    try:
        payload = await request.json()
        logger.info(f"Received webhook payload: {payload}")
        return {"status": "success"}
    except Exception as e:
        return Response(content=f"Webhook error: {str(e)}", status_code=400)
