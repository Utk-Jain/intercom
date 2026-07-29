import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text, Integer
from sqlalchemy.orm import relationship
from database.database import Base

def generate_uuid():
    return str(uuid.uuid4())

class Workspace(Base):
    __tablename__ = "workspaces"

    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String, nullable=False)
    custom_domain = Column(String, nullable=True)

    users = relationship("User", back_populates="workspace", cascade="all, delete-orphan")
    conversations = relationship("Conversation", back_populates="workspace", cascade="all, delete-orphan")
    categories = relationship("Category", back_populates="workspace", cascade="all, delete-orphan")
    articles = relationship("Article", back_populates="workspace", cascade="all, delete-orphan")
    invitations = relationship("Invitation", back_populates="workspace", cascade="all, delete-orphan")

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=generate_uuid)
    workspace_id = Column(String, ForeignKey("workspaces.id"), nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False, default="agent") # 'admin' or 'agent'

    workspace = relationship("Workspace", back_populates="users")
    assigned_conversations = relationship("Conversation", back_populates="assignee")

class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(String, primary_key=True, default=generate_uuid)
    workspace_id = Column(String, ForeignKey("workspaces.id"), nullable=False)
    channel = Column(String, nullable=False, default="chat") # 'chat' or 'email'
    status = Column(String, nullable=False, default="open") # 'open', 'snoozed', 'resolved'
    assignee_id = Column(String, ForeignKey("users.id"), nullable=True)
    visitor_id = Column(String, nullable=True)
    email_thread_id = Column(String, nullable=True)
    subject = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    workspace = relationship("Workspace", back_populates="conversations")
    assignee = relationship("User", back_populates="assigned_conversations")
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan", order_by="Message.created_at")

class Message(Base):
    __tablename__ = "messages"

    id = Column(String, primary_key=True, default=generate_uuid)
    conversation_id = Column(String, ForeignKey("conversations.id"), nullable=False)
    sender = Column(String, nullable=False) # 'customer' or 'agent'
    body = Column(Text, nullable=False)
    message_id = Column(String, nullable=True) # Gmail Message-ID header
    created_at = Column(DateTime, default=datetime.utcnow)

    conversation = relationship("Conversation", back_populates="messages")

class Category(Base):
    __tablename__ = "categories"

    id = Column(String, primary_key=True, default=generate_uuid)
    workspace_id = Column(String, ForeignKey("workspaces.id"), nullable=False)
    name = Column(String, nullable=False)

    workspace = relationship("Workspace", back_populates="categories")
    articles = relationship("Article", back_populates="category")

class Article(Base):
    __tablename__ = "articles"

    id = Column(String, primary_key=True, default=generate_uuid)
    workspace_id = Column(String, ForeignKey("workspaces.id"), nullable=False)
    category_id = Column(String, ForeignKey("categories.id"), nullable=True)
    title = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    published = Column(Boolean, default=False)
    visibility = Column(String, default="public", nullable=True)


    workspace = relationship("Workspace", back_populates="articles")
    category = relationship("Category", back_populates="articles")

class Invitation(Base):
    __tablename__ = "invitations"

    id = Column(String, primary_key=True, default=generate_uuid)
    workspace_id = Column(String, ForeignKey("workspaces.id"), nullable=False)
    email = Column(String, nullable=False)
    token = Column(String, unique=True, nullable=False)
    expires_at = Column(DateTime, nullable=False)

    workspace = relationship("Workspace", back_populates="invitations")
