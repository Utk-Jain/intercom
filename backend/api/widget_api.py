from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from sqlalchemy.orm import selectinload
from database.database import get_db
from database.models import Conversation, Message, Workspace, Article
from database.schemas import MessageResponse
from services.websocket_service import manager

router = APIRouter(prefix="/widget", tags=["widget"])

class WidgetInitRequest(BaseModel):
    visitor_id: str
    workspace_id: Optional[str] = None

class WidgetMessageRequest(BaseModel):
    visitor_id: str
    body: str
    workspace_id: Optional[str] = None

@router.post("/init")
async def init_widget_session(payload: WidgetInitRequest, db: AsyncSession = Depends(get_db)):
    workspace = None
    if payload.workspace_id:
        ws_res = await db.execute(select(Workspace).where(Workspace.id == payload.workspace_id))
        workspace = ws_res.scalars().first()

    if not workspace:
        ws_res = await db.execute(select(Workspace).order_by(Workspace.id.desc()))


        workspace = ws_res.scalars().first()


    if not workspace:
        workspace = Workspace(name="Default Workspace")
        db.add(workspace)
        await db.commit()
        await db.refresh(workspace)

    # Check for existing open conversation for this visitor
    conv_res = await db.execute(
        select(Conversation)
        .where(Conversation.visitor_id == payload.visitor_id, Conversation.workspace_id == workspace.id, Conversation.channel == "chat")
        .order_by(Conversation.created_at.desc())
        .options(selectinload(Conversation.messages))
    )
    conv = conv_res.scalars().first()

    if not conv or conv.status == "resolved":
        conv = Conversation(
            workspace_id=workspace.id,
            channel="chat",
            status="open",
            visitor_id=payload.visitor_id,
            subject=f"Chat from {payload.visitor_id[:8]}"
        )
        db.add(conv)
        await db.commit()
        
        # Re-fetch with eager loaded messages
        conv_res = await db.execute(
            select(Conversation).where(Conversation.id == conv.id).options(selectinload(Conversation.messages))
        )
        conv = conv_res.scalars().first()

    return {
        "workspace_id": workspace.id,
        "workspace_name": workspace.name,
        "conversation_id": conv.id,
        "status": conv.status,
        "messages": [
            {
                "id": m.id,
                "conversation_id": m.conversation_id,
                "sender": m.sender,
                "body": m.body,
                "created_at": m.created_at.isoformat()
            }
            for m in (conv.messages or [])
        ]
    }

@router.post("/message")
async def send_widget_message(payload: WidgetMessageRequest, db: AsyncSession = Depends(get_db)):
    workspace = None
    if payload.workspace_id:
        ws_res = await db.execute(select(Workspace).where(Workspace.id == payload.workspace_id))
        workspace = ws_res.scalars().first()

    if not workspace:
        ws_res = await db.execute(select(Workspace).order_by(Workspace.id.desc()))


        workspace = ws_res.scalars().first()


    # Find active conversation for visitor
    conv_res = await db.execute(
        select(Conversation)
        .where(Conversation.visitor_id == payload.visitor_id, Conversation.workspace_id == workspace.id, Conversation.channel == "chat")
        .order_by(Conversation.created_at.desc())
    )
    conv = conv_res.scalars().first()

    if not conv or conv.status == "resolved":
        conv = Conversation(
            workspace_id=workspace.id,
            channel="chat",
            status="open",
            visitor_id=payload.visitor_id,
            subject=f"Chat from {payload.visitor_id[:8]}"
        )
        db.add(conv)
        await db.flush()

    msg = Message(
        conversation_id=conv.id,
        sender="customer",
        body=payload.body
    )
    db.add(msg)
    conv.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(msg)

    msg_data = {
        "id": msg.id,
        "conversation_id": msg.conversation_id,
        "sender": msg.sender,
        "body": msg.body,
        "created_at": msg.created_at.isoformat()
    }

    # Notify dashboard agents via WS
    await manager.broadcast_to_workspace(conv.workspace_id, {
        "type": "chat_message",
        "conversation_id": conv.id,
        "message": msg_data
    })

    return msg_data

@router.get("/articles")
async def search_widget_articles(q: str = Query(""), db: AsyncSession = Depends(get_db)):
    if not q or len(q.strip()) == 0:
        return []

    pattern = f"%{q.strip()}%"
    res = await db.execute(
        select(Article)
        .where(Article.published == True, or_(Article.title.ilike(pattern), Article.content.ilike(pattern)))
        .limit(5)
    )
    articles = res.scalars().all()
    return [
        {
            "id": a.id,
            "title": a.title,
            "content": a.content[:150] + "..." if len(a.content) > 150 else a.content
        }
        for a in articles
    ]
