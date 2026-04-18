"""
JATAYU GCS — Pydantic Data Models
All request/response models for the API
"""
from __future__ import annotations
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class TelemetryResponse(BaseModel):
    lat: float = 26.25104
    lon: float = 78.17124
    alt_m: float = 0.0
    hdg: float = 0.0
    mode: str = "UNKNOWN"
    battery: Optional[float] = None
    link: str = "offline"
    ground_speed: Optional[float] = None
    climb_rate: Optional[float] = None
    gps_sats: int = 0
    gps_fix_type: int = 0


class ModeRequest(BaseModel):
    mode: str


class AltitudeRequest(BaseModel):
    altitude_m: float


class Detection(BaseModel):
    id: str
    bbox: list[float]  # [x1, y1, x2, y2]
    confidence: float
    pose: str = "unknown"
    severity: int = 5
    gps_lat: float = 0.0
    gps_lon: float = 0.0


class SaveTargetRequest(BaseModel):
    severity: int
    pose: str
    bbox: list[float]
    gps_lat: float
    gps_lon: float


class SavedTarget(BaseModel):
    id: str
    timestamp: str
    gps_lat: float
    gps_lon: float
    severity: int
    pose: str
    snapshot_path: Optional[str] = None
    bbox_image_path: Optional[str] = None
    track_id: str = ""
    status: str = "detected"


class Recording(BaseModel):
    id: str
    filename: str
    timestamp: str
    duration_s: float = 0.0
    size_bytes: int = 0
    status: str = "completed"


class PayloadDropRequest(BaseModel):
    target_id: str
    gps_lat: float
    gps_lon: float
    drop_mode: str = "SERVO"


class PayloadStatus(BaseModel):
    ready: bool = False
    servo_connected: bool = False
    last_drop_time: Optional[str] = None
    payload_count: int = 0


class PayloadDropEvent(BaseModel):
    id: str
    target_id: str
    gps_lat: float
    gps_lon: float
    drop_mode: str = "SERVO"
    status: str = "idle"
    timestamp: str = ""
    ack_timestamp: Optional[str] = None
    error: Optional[str] = None


class ActionLogEntry(BaseModel):
    id: str = ""
    timestamp: str
    action_type: str
    context: str
    status: str = "success"
    details: Optional[str] = None


class RouteGeometry(BaseModel):
    target_id: str
    route_type: str = "straight"
    coordinates: list[list[float]] = []
    distance_m: float = 0.0
    estimated_time_s: Optional[float] = None


class HealthResponse(BaseModel):
    status: str = "ok"
    mavlink_connected: bool = False
    model_loaded: bool = False
    video_active: bool = False
    pipeline_running: bool = False
    cluster_count: int = 0
