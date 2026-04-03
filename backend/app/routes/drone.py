"""
JATAYU GCS — Drone Control Routes
Mode changes, altitude commands
"""
import logging
from fastapi import APIRouter
from app.models import ModeRequest, AltitudeRequest

router = APIRouter()
log = logging.getLogger("gcs.drone")

# Storage for current state (will be replaced with MAVLink integration)
_current_mode = "UNKNOWN"

from app.mavlink_service import mav_service, ARDUPLANE_MODES

@router.post("/drone/mode")
async def set_mode(request: ModeRequest):
    """Send mode change command to the drone."""
    global _current_mode
    target_mode = request.mode.upper()
    
    if target_mode not in ARDUPLANE_MODES:
        return {"success": False, "message": f"Invalid ArduPlane mode: {target_mode}"}

    log.info(f"MODE CHANGE → {target_mode}")
    _current_mode = target_mode

    # Send via pymavlink using our new service
    success = mav_service.set_mode(target_mode)
    
    if success:
        return {"success": True, "message": f"Mode set to {target_mode}"}
    else:
        return {"success": False, "message": f"Failed to set mode {target_mode} via MAVLink"}


@router.post("/drone/altitude")
async def set_altitude(request: AltitudeRequest):
    """Change target altitude."""
    if request.altitude_m <= 0 or request.altitude_m > 500:
        return {"success": False, "message": "Altitude must be 1–500m"}

    log.info(f"ALTITUDE CHANGE → {request.altitude_m}m")

    # Send via MAVLink guided command
    success = mav_service.set_altitude(request.altitude_m)
    
    if success:
        return {"success": True, "message": f"Altitude set to {request.altitude_m}m"}
    else:
        return {"success": False, "message": f"Failed to set altitude {request.altitude_m}m via MAVLink"}
