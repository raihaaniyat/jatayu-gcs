"""
JATAYU GCS — Recordings Routes
Start/stop recording and list saved recordings
"""
import logging
from datetime import datetime
from fastapi import APIRouter
from app.models import Recording

router = APIRouter()
log = logging.getLogger("gcs.recordings")

# In-memory state (will be replaced with actual recording logic)
_recordings: list[dict] = []
_is_recording = False
_current_recording_id = None


@router.post("/recordings/start")
async def start_recording():
    """Start video recording."""
    global _is_recording, _current_recording_id
    if _is_recording:
        return {"success": False, "message": "Already recording"}

    _current_recording_id = f"REC-{len(_recordings) + 1:03d}"
    _is_recording = True

    _recordings.append({
        "id": _current_recording_id,
        "filename": f"mission_{datetime.now().strftime('%Y%m%d_%H%M%S')}.mp4",
        "timestamp": datetime.now().isoformat(),
        "duration_s": 0.0,
        "size_bytes": 0,
        "status": "recording",
    })

    log.info(f"Recording started: {_current_recording_id}")
    return {"success": True, "recording_id": _current_recording_id}


@router.post("/recordings/stop")
async def stop_recording():
    """Stop video recording."""
    global _is_recording, _current_recording_id
    if not _is_recording:
        return {"success": False, "message": "Not recording"}

    # Update the recording entry
    for rec in _recordings:
        if rec["id"] == _current_recording_id:
            rec["status"] = "completed"
            rec["duration_s"] = 60.0  # placeholder
            rec["size_bytes"] = 15_000_000  # placeholder

    log.info(f"Recording stopped: {_current_recording_id}")
    _is_recording = False
    _current_recording_id = None
    return {"success": True}


@router.get("/recordings", response_model=list[Recording])
async def get_recordings():
    """List all recordings."""
    return [Recording(**r) for r in _recordings]
