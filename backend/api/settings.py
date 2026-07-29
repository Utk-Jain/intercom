from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database.database import get_db
from database.models import Workspace
from database.schemas import CustomDomainUpdate, WorkspaceResponse
from services.auth_service import get_current_user

router = APIRouter(prefix="/workspace", tags=["settings"])

@router.get("", response_model=WorkspaceResponse)
async def get_workspace_settings(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    workspace_id = current_user.get("workspace_id")
    res = await db.execute(select(Workspace).where(Workspace.id == workspace_id))
    workspace = res.scalars().first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    return WorkspaceResponse(
        id=workspace.id,
        name=workspace.name,
        custom_domain=workspace.custom_domain,
        status="Pending Verification" if workspace.custom_domain else "Unconfigured"
    )

@router.patch("/domain", response_model=WorkspaceResponse)
async def update_custom_domain(
    payload: CustomDomainUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    workspace_id = current_user.get("workspace_id")
    res = await db.execute(select(Workspace).where(Workspace.id == workspace_id))
    workspace = res.scalars().first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    workspace.custom_domain = payload.custom_domain.strip().lower()
    await db.commit()
    await db.refresh(workspace)

    return WorkspaceResponse(
        id=workspace.id,
        name=workspace.name,
        custom_domain=workspace.custom_domain,
        status="Pending Verification"
    )
