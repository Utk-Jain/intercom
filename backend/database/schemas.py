from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime

# Auth & User Schemas
class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    workspace_name: str

class InviteSignupRequest(BaseModel):
    email: EmailStr
    password: str
    token: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    workspace_id: str
    workspace_name: str
    email: str
    role: str

class UserResponse(BaseModel):
    id: str
    workspace_id: str
    email: str
    role: str

class InviteRequest(BaseModel):
    email: EmailStr

class InvitationResponse(BaseModel):
    id: str
    email: str
    token: str
    expires_at: datetime

# Message & Conversation Schemas
class MessageCreate(BaseModel):
    body: str

class MessageResponse(BaseModel):
    id: str
    conversation_id: str
    sender: str
    body: str
    message_id: Optional[str] = None
    created_at: datetime

class ConversationResponse(BaseModel):
    id: str
    workspace_id: str
    channel: str
    status: str
    assignee_id: Optional[str] = None
    assignee_email: Optional[str] = None
    visitor_id: Optional[str] = None
    email_thread_id: Optional[str] = None
    subject: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    latest_message: Optional[MessageResponse] = None
    messages: List[MessageResponse] = []


class ConversationUpdate(BaseModel):
    status: Optional[str] = None # 'open', 'snoozed', 'resolved'
    assignee_id: Optional[str] = None

# Knowledge Base Schemas
class CategoryCreate(BaseModel):
    name: str

class CategoryResponse(BaseModel):
    id: str
    workspace_id: str
    name: str

class ArticleCreate(BaseModel):
    title: str
    content: str
    category_id: Optional[str] = None
    published: bool = False

class ArticleUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    category_id: Optional[str] = None
    published: Optional[bool] = None

class ArticleResponse(BaseModel):
    id: str
    workspace_id: str
    category_id: Optional[str] = None
    category_name: Optional[str] = None
    title: str
    content: str
    published: bool

# Settings
class CustomDomainUpdate(BaseModel):
    custom_domain: str

class WorkspaceResponse(BaseModel):
    id: str
    name: str
    custom_domain: Optional[str] = None
    status: str = "Pending Verification"
