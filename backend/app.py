import os
import asyncio
import logging
from contextlib import asynccontextmanager
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from database.database import init_db
from api.auth import router as auth_router
from api.users import router as users_router
from api.conversations import router as conversations_router
from api.knowledge_base import router as kb_router
from api.ai import router as ai_router
from api.settings import router as settings_router
from api.widget_api import router as widget_router
from api.webhooks import router as webhooks_router
from services.websocket_service import manager

from services.email_service import poll_gmail_imap_loop

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing database tables...")
    await init_db()
    email_task = asyncio.create_task(poll_gmail_imap_loop())
    logger.info("Application startup complete.")
    yield
    email_task.cancel()
    logger.info("Application shutdown.")


app = FastAPI(title="Minimal Intercom Clone API", lifespan=lifespan)

# Enable CORS for frontend and widget
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(auth_router)
app.include_router(users_router)
app.include_router(conversations_router)
app.include_router(kb_router)
app.include_router(ai_router)
app.include_router(settings_router)
app.include_router(widget_router)
app.include_router(webhooks_router)

# Mount static directory for widget files
widget_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "widget")
if os.path.exists(widget_dir):
    app.mount("/static", StaticFiles(directory=widget_dir), name="static")

# Mount frontend dist directory if present for 1-click single service deployment
frontend_dist = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend", "dist")
if os.path.exists(frontend_dist):
    from fastapi.responses import FileResponse
    app.mount("/assets", StaticFiles(directory=os.path.join(frontend_dist, "assets")), name="frontend_assets")
    
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_path = os.path.join(frontend_dist, full_path)
        if full_path and os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(frontend_dist, "index.html"))
else:
    @app.get("/")
    async def root():
        return {"message": "Minimal Intercom Clone API is running"}


@app.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    workspace_id: str = Query(None),
    visitor_id: str = Query(None),
    user_id: str = Query(None),
    conversation_id: str = Query(None)
):
    await manager.connect(websocket, workspace_id, visitor_id, user_id, conversation_id)
    try:
        while True:
            data_str = await websocket.receive_text()
            try:
                import json
                data = json.loads(data_str)
                msg_type = data.get("type")
                
                # Valid message types: chat_message, typing, read, presence
                if msg_type in ["chat_message", "typing", "read", "presence"]:
                    # Broadcast event to other connected clients
                    target_workspace = data.get("workspace_id") or workspace_id
                    await manager.broadcast_to_workspace(target_workspace, data)
            except Exception as parse_err:
                logger.error(f"Error handling websocket text frame: {parse_err}")
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket)
