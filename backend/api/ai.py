from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from database.database import get_db
from database.models import Conversation
from services.auth_service import get_current_user
from services.ai_service import generate_conversation_summary

router = APIRouter(prefix="", tags=["ai"])

class SummaryRequest(BaseModel):
    conversation_id: str

class SummaryResponse(BaseModel):
    conversation_id: str
    summary: str

@router.post("/summary", response_model=SummaryResponse)
async def summarize_conversation(
    payload: SummaryRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    workspace_id = current_user.get("workspace_id")
    res = await db.execute(
        select(Conversation)
        .where(Conversation.id == payload.conversation_id, Conversation.workspace_id == workspace_id)
        .options(selectinload(Conversation.messages))
    )
    conv = res.scalars().first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    messages_list = [
        {"sender": m.sender, "body": m.body} for m in conv.messages
    ]

    summary_text = await generate_conversation_summary(messages_list)

    return SummaryResponse(
        conversation_id=conv.id,
        summary=summary_text
    )
