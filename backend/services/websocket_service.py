import json
import logging
from typing import Dict, List, Set
from fastapi import WebSocket

logger = logging.getLogger(__name__)

class ConnectionManager:
    def __init__(self):
        # Active connections: list of websockets with metadata
        # { websocket: {"workspace_id": str, "visitor_id": str, "user_id": str, "conversation_id": str} }
        self.active_connections: Dict[WebSocket, dict] = {}

    async def connect(self, websocket: WebSocket, workspace_id: str = None, visitor_id: str = None, user_id: str = None, conversation_id: str = None):
        await websocket.accept()
        self.active_connections[websocket] = {
            "workspace_id": workspace_id,
            "visitor_id": visitor_id,
            "user_id": user_id,
            "conversation_id": conversation_id
        }
        logger.info(f"WebSocket connected: visitor={visitor_id}, user={user_id}, workspace={workspace_id}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            meta = self.active_connections.pop(websocket)
            logger.info(f"WebSocket disconnected: {meta}")

    async def broadcast_to_workspace(self, workspace_id: str, message: dict):
        data = json.dumps(message)
        to_remove = []
        for ws, meta in self.active_connections.items():
            if meta.get("workspace_id") == workspace_id or meta.get("visitor_id"):
                try:
                    await ws.send_text(data)
                except Exception as e:
                    logger.error(f"Error sending message to ws: {e}")
                    to_remove.append(ws)
        for ws in to_remove:
            self.disconnect(ws)

    async def send_to_conversation(self, conversation_id: str, visitor_id: str, message: dict):
        data = json.dumps(message)
        to_remove = []
        for ws, meta in self.active_connections.items():
            # Send to anyone listening on this conversation, or visitor with visitor_id, or agents in the same workspace
            if (meta.get("conversation_id") == conversation_id or 
                meta.get("visitor_id") == visitor_id or 
                meta.get("user_id") is not None):
                try:
                    await ws.send_text(data)
                except Exception as e:
                    logger.error(f"Error sending message: {e}")
                    to_remove.append(ws)
        for ws in to_remove:
            self.disconnect(ws)

manager = ConnectionManager()
