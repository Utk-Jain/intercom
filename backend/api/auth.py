from datetime import datetime, timedelta
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database.database import get_db
from database.models import User, Workspace, Invitation, Category, Article

from database.schemas import SignupRequest, InviteSignupRequest, LoginRequest, TokenResponse
from services.auth_service import hash_password, verify_password, create_access_token

router = APIRouter(prefix="", tags=["auth"])

@router.post("/signup", response_model=TokenResponse)
async def signup(payload: SignupRequest, db: AsyncSession = Depends(get_db)):
    # Check if user already exists
    existing = await db.execute(select(User).where(User.email == payload.email))
    if existing.scalars().first():
        raise HTTPException(status_code=400, detail="Email already registered")

    # Create workspace
    workspace = Workspace(name=payload.workspace_name)
    db.add(workspace)
    await db.flush()

    # Seed default KB categories and articles for workspace
    cat1 = Category(workspace_id=workspace.id, name="Account & Billing")
    cat2 = Category(workspace_id=workspace.id, name="Getting Started")
    db.add_all([cat1, cat2])
    await db.flush()

    db.add_all([
        Article(
            workspace_id=workspace.id,
            category_id=cat1.id,
            title="How to update payment methods",
            content="To update your credit card or billing details, navigate to Settings -> Billing -> Payment Methods, click Edit, enter your card details, and click Save.",
            published=True
        ),
        Article(
            workspace_id=workspace.id,
            category_id=cat2.id,
            title="How to reset your password",
            content="Click 'Forgot Password' on the login screen, enter your registered email address, and check your inbox for a secure reset link.",
            published=True
        ),
        Article(
            workspace_id=workspace.id,
            category_id=cat2.id,
            title="Setting up email integration",
            content="Our system connects directly to Gmail IMAP and SMTP. Ensure SUPPORT_EMAIL and GMAIL_APP_PASSWORD are set in your environment variables.",
            published=True
        )
    ])

    # Create admin user
    user = User(
        workspace_id=workspace.id,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role="admin"
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)


    token = create_access_token({
        "sub": user.id,
        "workspace_id": workspace.id,
        "email": user.email,
        "role": user.role
    })

    return TokenResponse(
        access_token=token,
        user_id=user.id,
        workspace_id=workspace.id,
        workspace_name=workspace.name,
        email=user.email,
        role=user.role
    )

@router.post("/signup/invite", response_model=TokenResponse)
async def signup_invite(payload: InviteSignupRequest, db: AsyncSession = Depends(get_db)):
    inv_res = await db.execute(select(Invitation).where(Invitation.token == payload.token))
    invite = inv_res.scalars().first()
    if not invite or invite.expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Invalid or expired invitation token")

    existing = await db.execute(select(User).where(User.email == payload.email))
    if existing.scalars().first():
        raise HTTPException(status_code=400, detail="User with this email already exists")

    ws_res = await db.execute(select(Workspace).where(Workspace.id == invite.workspace_id))
    workspace = ws_res.scalars().first()

    user = User(
        workspace_id=invite.workspace_id,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role="agent"
    )
    db.add(user)
    await db.delete(invite)
    await db.commit()
    await db.refresh(user)

    token = create_access_token({
        "sub": user.id,
        "workspace_id": user.workspace_id,
        "email": user.email,
        "role": user.role
    })

    return TokenResponse(
        access_token=token,
        user_id=user.id,
        workspace_id=user.workspace_id,
        workspace_name=workspace.name if workspace else "Workspace",
        email=user.email,
        role=user.role
    )

@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(User).where(User.email == payload.email))
    user = res.scalars().first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=400, detail="Invalid email or password")

    ws_res = await db.execute(select(Workspace).where(Workspace.id == user.workspace_id))
    workspace = ws_res.scalars().first()

    token = create_access_token({
        "sub": user.id,
        "workspace_id": user.workspace_id,
        "email": user.email,
        "role": user.role
    })

    return TokenResponse(
        access_token=token,
        user_id=user.id,
        workspace_id=user.workspace_id,
        workspace_name=workspace.name if workspace else "Workspace",
        email=user.email,
        role=user.role
    )

@router.post("/logout")
async def logout():
    return {"message": "Successfully logged out"}
