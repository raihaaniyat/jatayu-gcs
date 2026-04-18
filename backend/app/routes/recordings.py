"""
JATAYU GCS — Recordings Routes
Start/stop recording and list saved recordings
"""
import logging
import os
import glob
from datetime import datetime
from fastapi import APIRouter
from app.models import Recording
from app.routes import video  # Import to control recording state

router = APIRouter()
log = logging.getLogger("gcs.recordings")

REC_DIR = os.path.join(os.getcwd(), "recordings")
if not os.path.exists(REC_DIR):
    os.makedirs(REC_DIR)


@router.post("/recordings/start")
async def start_recording():
    """Start video recording."""
    if video.is_recording:
        return {"success": False, "message": "Already recording"}

    video.is_recording = True
    log.info("Recording trigger received from UI.")
    return {"success": True, "recording_id": "REC-LIVE"}


@router.post("/recordings/stop")
async def stop_recording():
    """Stop video recording."""
    if not video.is_recording:
        return {"success": False, "message": "Not recording"}

    video.is_recording = False
    log.info("Stop recording trigger received from UI.")
    return {"success": True}


@router.get("/recordings", response_model=list[Recording])
async def get_recordings():
    """List all recordings from disk."""
    files = glob.glob(os.path.join(REC_DIR, "*.webm"))
    recs = []
    for f in files:
        fname = os.path.basename(f)
        try:
            stat = os.stat(f)
            recs.append({
                "id": fname,
                "filename": fname,
                "timestamp": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                "duration_s": 0, # Could be calculated but keeping it simple
                "size_bytes": stat.st_size,
                "status": "completed"
            })
        except:
            pass
    return [Recording(**r) for r in recs]
