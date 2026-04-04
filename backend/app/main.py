"""
JATAYU GCS — FastAPI Application
Main app with all routes, CORS, and lifecycle
"""
from __future__ import annotations
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes import telemetry, drone, targets, recordings, payload, actions, video

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s", datefmt="%H:%M:%S")
log = logging.getLogger("gcs")
from contextlib import asynccontextmanager
from app.mavlink_service import mav_service

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    log.info("Starting MAVLink service background connection...")
    mav_service.start()
    yield
    # Shutdown
    log.info("Stopping MAVLink service...")
    mav_service.stop()

from fastapi import WebSocket, WebSocketDisconnect

def create_app() -> FastAPI:
    app = FastAPI(
        title="JATAYU GCS Backend",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.websocket("/ws")
    async def websocket_endpoint(websocket: WebSocket):
        await websocket.accept()
        log.info("WebSocket connection established with client")
        try:
            while True:
                # In a real scenario, this would wait for events to push
                # For now, we just keep the connection alive
                data = await websocket.receive_text()
                await websocket.send_json({"type": "status", "payload": {"status": "connected"}})
        except WebSocketDisconnect:
            log.info("WebSocket client disconnected")

    # Mount all route modules
    app.include_router(telemetry.router, prefix="/api", tags=["Telemetry"])
    app.include_router(drone.router, prefix="/api", tags=["Drone Control"])
    app.include_router(targets.router, prefix="/api", tags=["Targets"])
    app.include_router(recordings.router, prefix="/api", tags=["Recordings"])
    app.include_router(payload.router, prefix="/api", tags=["Payload"])
    app.include_router(actions.router, prefix="/api", tags=["Actions"])
    app.include_router(video.router, prefix="/api", tags=["Video"])

    @app.get("/")
    async def root():
        return {"service": "JATAYU GCS Backend", "version": "1.0.0", "status": "running"}

    log.info("=" * 50)
    log.info("  JATAYU GCS BACKEND")
    log.info("  http://localhost:8080/docs")
    log.info("=" * 50)

    return app


app = create_app()
