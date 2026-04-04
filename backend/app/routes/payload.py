"""
JATAYU GCS — Payload Drop Routes
Servo-based payload release control through ArduPilot
"""
import logging
from datetime import datetime
from fastapi import APIRouter
from app.models import PayloadDropRequest, PayloadDropEvent, PayloadStatus
from app.mavlink_service import mav_service

router = APIRouter()
log = logging.getLogger("gcs.payload")

# In-memory state
_payload_history: list[dict] = []
_payload_status = {
    "ready": True,
    "servo_connected": True,
    "last_drop_time": None,
    "payload_count": 3,
}


@router.get("/payload/status", response_model=PayloadStatus)
async def get_payload_status():
    """Current payload system status."""
    return PayloadStatus(**_payload_status)


@router.post("/payload/drop", response_model=PayloadDropEvent)
async def drop_payload(request: PayloadDropRequest):
    """Trigger payload drop via servo actuation."""
    event_id = f"DROP-{len(_payload_history) + 1:03d}"
    timestamp = datetime.now().isoformat()

    log.warning(f"PAYLOAD DROP COMMAND → target={request.target_id} ({request.gps_lat:.6f}, {request.gps_lon:.6f})")

    success = mav_service.cmd_set_servo_11_max()

    event = {
        "id": event_id,
        "target_id": request.target_id,
        "gps_lat": request.gps_lat,
        "gps_lon": request.gps_lon,
        "drop_mode": request.drop_mode,
        "status": "drop_completed" if success else "drop_failed",
        "timestamp": timestamp,
        "ack_timestamp": timestamp,
    }
    _payload_history.append(event)

    if success:
        _payload_status["last_drop_time"] = timestamp
        _payload_status["payload_count"] = max(0, _payload_status["payload_count"] - 1)

    if success:
        log.info(f"Payload drop completed: {event_id}")
    else:
        log.error(f"Payload drop failed: {event_id}")
        
    return PayloadDropEvent(**event)


@router.get("/payload/history", response_model=list[PayloadDropEvent])
async def get_payload_history():
    """Payload drop event history."""
    return [PayloadDropEvent(**e) for e in _payload_history]
