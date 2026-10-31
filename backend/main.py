import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from backend.config import settings
from backend.database.session import init_db
from backend.api.routes import router, get_orchestrator
from backend.api.websocket import ws_manager

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("omnivault.main")

background_task = None

async def websocket_event_forwarder(event: dict):
    """Forward orchestrator events to all connected WebSocket clients."""
    await ws_manager.broadcast(event)

@asynccontextmanager
async def lifespan(app: FastAPI):
    global background_task
    logger.info("Initializing OmniVault AI Backend Services...")
    # Initialize DB tables
    await init_db()
    logger.info("Database schema initialized.")

    # Wire up orchestrator event broadcasting to WebSockets
    orch = get_orchestrator()
    orch.subscribe_events(websocket_event_forwarder)

    # Start autonomous trading intelligence loop (runs every 15 seconds)
    orch.start_autonomous_loop(interval_seconds=15)
    logger.info("Autonomous Trading Intelligence continuous cycle started in PAPER mode.")

    yield

    # Shutdown
    orch.stop_autonomous_loop()
    logger.info("OmniVault AI Backend Services gracefully stopped.")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Autonomous Multi-Agent DEX Trading System on HashKey Chain",
    lifespan=lifespan,
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow development frontends
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount REST API
app.include_router(router)

# WebSocket Endpoint
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        while True:
            # Keep connection open and receive any client ping
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text('{"type": "pong"}')
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception as e:
        logger.warning(f"WebSocket client error: {e}")
        ws_manager.disconnect(websocket)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host=settings.HOST, port=settings.PORT, reload=True)
