from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from database.database import get_db
from database.models import Conversation, Message, User, Workspace
from database.schemas import ConversationResponse, ConversationUpdate, MessageCreate, MessageResponse
from services.auth_service import get_current_user
from services.websocket_service import manager
from services.email_service import send_gmail_smtp_reply



router = APIRouter(prefix="/conversations", tags=["conversations"])

def build_conversation_response(conv: Conversation) -> ConversationResponse:
    latest_msg = None
    if conv.messages:
        last = conv.messages[-1]
        latest_msg = MessageResponse(
            id=last.id,
            conversation_id=last.conversation_id,
            sender=last.sender,
            body=last.body,
            message_id=last.message_id,
            created_at=last.created_at
        )

    assignee_email = conv.assignee.email if conv.assignee else None

    msgs_list = []
    if conv.messages:
        msgs_list = [
            MessageResponse(
                id=m.id,
                conversation_id=m.conversation_id,
                sender=m.sender,
                body=m.body,
                message_id=m.message_id,
                created_at=m.created_at
            )
            for m in conv.messages
        ]

    return ConversationResponse(
        id=conv.id,
        workspace_id=conv.workspace_id,
        channel=conv.channel,
        status=conv.status,
        assignee_id=conv.assignee_id,
        assignee_email=assignee_email,
        visitor_id=conv.visitor_id,
        email_thread_id=conv.email_thread_id,
        subject=conv.subject,
        created_at=conv.created_at,
        updated_at=conv.updated_at,
        latest_message=latest_msg,
        messages=msgs_list
    )


@router.get("", response_model=List[ConversationResponse])
async def list_conversations(
    channel: Optional[str] = Query(None), # 'chat' or 'email'
    status: Optional[str] = Query(None), # 'open', 'snoozed', 'resolved'
    assignee_id: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    workspace_id = current_user.get("workspace_id")
    query = select(Conversation).where(Conversation.workspace_id == workspace_id).options(
        selectinload(Conversation.messages),
        selectinload(Conversation.assignee)
    )

    if channel:
        query = query.where(Conversation.channel == channel)
    if status:
        query = query.where(Conversation.status == status)
    if assignee_id:
        query = query.where(Conversation.assignee_id == assignee_id)

    query = query.order_by(Conversation.updated_at.desc())
    res = await db.execute(query)
    conversations = res.scalars().all()
    return [build_conversation_response(c) for c in conversations]

@router.get("/{id}", response_model=ConversationResponse)
async def get_conversation(
    id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    workspace_id = current_user.get("workspace_id")
    res = await db.execute(
        select(Conversation).where(Conversation.id == id, Conversation.workspace_id == workspace_id).options(
            selectinload(Conversation.messages),
            selectinload(Conversation.assignee)
        )
    )
    conv = res.scalars().first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return build_conversation_response(conv)

@router.patch("/{id}", response_model=ConversationResponse)
async def update_conversation(
    id: str,
    payload: ConversationUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    workspace_id = current_user.get("workspace_id")
    res = await db.execute(
        select(Conversation).where(Conversation.id == id, Conversation.workspace_id == workspace_id).options(
            selectinload(Conversation.messages),
            selectinload(Conversation.assignee)
        )
    )
    conv = res.scalars().first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    if payload.status:
        # Both Admin and Agent can resolve/snooze/reopen
        conv.status = payload.status

    if payload.assignee_id is not None:
        # Assign conversation
        conv.assignee_id = payload.assignee_id if payload.assignee_id != "" else None

    conv.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(conv)

    resp = build_conversation_response(conv)
    # Broadcast update to ws clients
    await manager.broadcast_to_workspace(workspace_id, {
        "type": "conversation_updated",
        "conversation": resp.model_dump(mode="json")
    })
    return resp

@router.post("/{id}/messages", response_model=MessageResponse)
async def create_message(
    id: str,
    payload: MessageCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    workspace_id = current_user.get("workspace_id")
    res = await db.execute(
        select(Conversation).where(Conversation.id == id, Conversation.workspace_id == workspace_id).options(
            selectinload(Conversation.messages)
        )
    )
    conv = res.scalars().first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    sender = "agent"
    msg = Message(
        conversation_id=conv.id,
        sender=sender,
        body=payload.body
    )
    db.add(msg)
    conv.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(msg)

    # If email channel, send email reply
    if conv.channel == "email" and conv.email_thread_id:
        last_msg_id = None
        if conv.messages:
            for m in reversed(conv.messages):
                if m.message_id:
                    last_msg_id = m.message_id
                    break
        recipient = conv.visitor_id or "customer@example.com"
        await send_gmail_smtp_reply(
            recipient=recipient,
            subject=conv.subject or "Support Reply",
            body=payload.body,
            thread_id=conv.email_thread_id,
            last_message_id=last_msg_id
        )



    msg_resp = MessageResponse(
        id=msg.id,
        conversation_id=msg.conversation_id,
        sender=msg.sender,
        body=msg.body,
        message_id=msg.message_id,
        created_at=msg.created_at
    )

    # Broadcast via WS
    await manager.send_to_conversation(conv.id, conv.visitor_id, {
        "type": "chat_message",
        "message": msg_resp.model_dump(mode="json")
    })

    return msg_resp
