import uuid
from datetime import datetime, timedelta
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database.database import get_db
from database.models import User, Invitation
from database.schemas import InviteRequest, InvitationResponse, UserResponse
from services.auth_service import get_current_user

router = APIRouter(prefix="", tags=["users"])

@router.post("/invite", response_model=InvitationResponse)
async def invite_member(payload: InviteRequest, current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only admins can invite team members")

    workspace_id = current_user.get("workspace_id")
    token = str(uuid.uuid4())
    expires_at = datetime.utcnow() + timedelta(days=7)

    invitation = Invitation(
        workspace_id=workspace_id,
        email=payload.email,
        token=token,
        expires_at=expires_at
    )
    db.add(invitation)
    await db.commit()
    await db.refresh(invitation)

    return InvitationResponse(
        id=invitation.id,
        email=invitation.email,
        token=invitation.token,
        expires_at=invitation.expires_at
    )

@router.get("/members", response_model=List[UserResponse])
async def get_members(current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    workspace_id = current_user.get("workspace_id")
    res = await db.execute(select(User).where(User.workspace_id == workspace_id))
    users = res.scalars().all()
    return [
        UserResponse(
            id=u.id,
            workspace_id=u.workspace_id,
            email=u.email,
            role=u.role
        )
        for u in users
    ]
