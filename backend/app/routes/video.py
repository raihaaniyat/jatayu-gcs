"""
JATAYU GCS — Video Streaming & AI inference
"""
import cv2
import logging
import asyncio
import os
import glob
import time
import threading
from datetime import datetime
from fastapi import APIRouter, UploadFile, File
from fastapi.responses import StreamingResponse
from ultralytics import YOLO
from pydantic import BaseModel

router = APIRouter()
log = logging.getLogger("gcs.video")

# Global Video Source state
VIDEO_SOURCE = None  # None = placeholder/no-feed, int = camera index, str = path 
model = None
ACTIVE_DETECTIONS = []
SAVED_TRACK_IDS = set()

# Ensure temp video directory exists
VIDEO_DIR = os.path.join(os.getcwd(), "uploads")
REC_DIR = os.path.join(os.getcwd(), "recordings")
for d in [VIDEO_DIR, REC_DIR]:
    if not os.path.exists(d):
        os.makedirs(d)

# Recording State (controlled by recordings.py)
is_recording = False
record_writer = None

class SourceUpdate(BaseModel):
    source: str

@router.get("/video/status")
async def get_video_status():
    """Returns AI model state and available videos."""
    videos = [os.path.basename(f) for f in glob.glob(os.path.join(VIDEO_DIR, "*.mp4"))]
    return {
        "model_loaded": model is not None,
        "current_source": str(VIDEO_SOURCE) if VIDEO_SOURCE is not None else None,
        "available_videos": videos
    }

@router.post("/video/model/toggle")
async def toggle_model():
    """Loads or unloads the YOLO model."""
    global model
    if model is not None:
        model = None
        log.info("YOLO model unloaded.")
        return {"success": True, "message": "Model unloaded", "model_loaded": False}
    else:
        try:
            log.info("Loading YOLO model bestyolov8s.pt...")
            model = YOLO("bestyolov8s.pt")
            return {"success": True, "message": "Model loaded", "model_loaded": True}
        except Exception as e:
            log.error(f"Failed to load YOLO model: {e}")
            return {"success": False, "message": "Failed to load model", "model_loaded": False}

@router.post("/video/source")
async def set_video_source(req: SourceUpdate):
    """Change the video stream source (camera index or filename)."""
    global VIDEO_SOURCE
    src = req.source
    
    if src == "NONE":
        VIDEO_SOURCE = None
    elif src.isdigit():
        VIDEO_SOURCE = int(src)
    elif src.endswith(".mp4"):
        VIDEO_SOURCE = os.path.join(VIDEO_DIR, src)
    else:
        VIDEO_SOURCE = None

    log.info(f"Switched video source to: {VIDEO_SOURCE}")
    return {"success": True, "source": str(VIDEO_SOURCE)}

@router.post("/video/upload")
async def upload_video(file: UploadFile = File(...)):
    """Accepts an uploaded video, saves it, and sets it as the feed source."""
    global VIDEO_SOURCE
    
    filename = file.filename or "uploaded.mp4"
    save_path = os.path.join(VIDEO_DIR, filename)
    
    try:
        with open(save_path, "wb") as f:
            content = await file.read()
            f.write(content)
        
        VIDEO_SOURCE = save_path
        log.info(f"Video uploaded successfully and saved to {save_path}")
        return {"success": True, "message": "Video loaded into AI feed"}
    except Exception as e:
        log.error(f"Upload failed: {e}")
        return {"success": False, "message": str(e)}

@router.delete("/video/upload/{filename}")
async def delete_video(filename: str):
    """Deletes an uploaded video file."""
    global VIDEO_SOURCE
    
    # Basic security check
    if ".." in filename or "/" in filename or "\\" in filename:
        return {"success": False, "message": "Invalid filename"}
        
    file_path = os.path.join(VIDEO_DIR, filename)
    if os.path.exists(file_path):
        try:
            if VIDEO_SOURCE == file_path:
                VIDEO_SOURCE = None
            os.remove(file_path)
            log.info(f"Deleted video: {filename}")
            return {"success": True, "message": "Video deleted"}
        except Exception as e:
            log.error(f"Failed to delete video: {e}")
            return {"success": False, "message": str(e)}
    return {"success": False, "message": "File not found"}

global_frame = None

def run_video_loop():
    """Background thread that reads the active video source, resizes to 640px, runs YOLO, and saves MJPEG frames."""
    global VIDEO_SOURCE, model, is_recording, record_writer, global_frame
    cap = None
    last_source = -999 # force update
    
    while True:
        try:
            # Check if source changed or camera needs reopening
            if VIDEO_SOURCE != last_source or (cap is not None and not cap.isOpened()):
                if cap:
                    cap.release()
                
                if VIDEO_SOURCE is not None:
                    cap = cv2.VideoCapture(VIDEO_SOURCE)
                    if not cap.isOpened() and isinstance(VIDEO_SOURCE, int):
                        cap = cv2.VideoCapture(VIDEO_SOURCE, cv2.CAP_DSHOW)
                    last_source = VIDEO_SOURCE
                else:
                    last_source = VIDEO_SOURCE
                    cap = None
                    global_frame = None
            
            if not cap or not cap.isOpened():
                time.sleep(0.1)
                continue
                
            success, frame = cap.read()
            if not success:
                if isinstance(VIDEO_SOURCE, str):
                    cap.set(cv2.CAP_PROP_POS_FRAMES, 0) # Loop video
                    time.sleep(0.05)
                else:
                    time.sleep(0.1) # Wait for camera
                continue

            # ── OPTIMIZATION: RESIZE BEFORE AI ─────────────────────────────────────
            # Resizing to 640px width significantly boosts FPS and reduces latency
            h, w = frame.shape[:2]
            if w > 640:
                scale = 640 / w
                new_h = int(h * scale)
                frame = cv2.resize(frame, (640, new_h), interpolation=cv2.INTER_AREA)

            # ── AI INFERENCE ───────────────────────────────────────────────────────
            if model is not None:
                # Optimized params: low imgsz, persistent tracking, filtered for persons (0)
                results = model.track(
                    source=frame, 
                    persist=True, 
                    classes=[0], 
                    conf=0.35,      # Confidence threshold
                    iou=0.45,       # Intersection over Union (suppress duplicates)
                    imgsz=640,      # Explicitly set inference size
                    verbose=False
                )
                
                # Extract structured detections mapping with latest generic GPS
                current_detections = []
                if len(results) > 0 and results[0].boxes is not None:
                    from app.routes.telemetry import LATEST_TELEMETRY
                    from app.routes.targets import _read_db, _write_db
                    from app.models import Detection
                    
                    for box in results[0].boxes:
                        track_id = int(box.id[0].item()) if box.id is not None else 0
                        conf = float(box.conf[0].item())
                        xyxy = box.xyxy[0].tolist() 
                        
                        # Generate random severity based on confidence
                        severity = min(10, max(1, int(conf * 10) + 1))
                        
                        det = Detection(
                            id=f"TRK-{track_id}",
                            bbox=xyxy,
                            confidence=conf,
                            pose="unknown",
                            severity=severity,
                            gps_lat=LATEST_TELEMETRY.lat,  
                            gps_lon=LATEST_TELEMETRY.lon
                        )
                        current_detections.append(det)

                        # AUTO-SAVE NOVEL TARGETS
                        global SAVED_TRACK_IDS
                        if track_id != 0 and track_id not in SAVED_TRACK_IDS:
                            SAVED_TRACK_IDS.add(track_id)
                            db = _read_db()
                            target_id = f"TGT-{len(db) + 1:03d}"
                            entry = {
                                "id": target_id,
                                "track_id": det.id,
                                "timestamp": datetime.now().isoformat(),
                                "gps_lat": det.gps_lat,
                                "gps_lon": det.gps_lon,
                                "severity_index": det.severity,
                                "pose": det.pose,
                                "bbox": det.bbox,
                                "status": "CRITICAL" if det.severity >= 7 else "HIGH" if det.severity >= 4 else "detected",
                            }
                            db.append(entry)
                            _write_db(db)
                            log.info(f"Auto-saved new target: {target_id} from track {track_id}")
                
                global ACTIVE_DETECTIONS
                ACTIVE_DETECTIONS = current_detections
                
                # Draw professional labels (thinner lines, clearer fonts)
                frame = results[0].plot(line_width=2, font_size=10, labels=True, boxes=True)

            # ── RECORDING ENGINE ──────────────────────────────────────────────────
            if is_recording:
                if record_writer is None:
                    filename = f"mission_{datetime.now().strftime('%Y%m%d_%H%M%S')}.mp4"
                    save_path = os.path.join(REC_DIR, filename)
                    fourcc = cv2.VideoWriter_fourcc(*'mp4v') # h264 or mp4v
                    # We record at 640px based on our optimization
                    record_writer = cv2.VideoWriter(save_path, fourcc, 20.0, (640, frame.shape[0]))
                    log.info(f"Started writing recording: {filename}")
                
                record_writer.write(frame)
            elif record_writer is not None:
                record_writer.release()
                record_writer = None
                log.info("Stopped and released recording file.")

            # ── STREAMING COMPRESSION ──────────────────────────────────────────────
            ret, buffer = cv2.imencode('.jpg', frame, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
            if ret:
                global_frame = buffer.tobytes()
        except Exception as e:
            log.error(f"Video loop error: {e}")
            time.sleep(1)

# Start background video processing loop
threading.Thread(target=run_video_loop, daemon=True).start()

async def generate_frames():
    """Generator that just yields the latest global frame."""
    global global_frame
    while True:
        if global_frame is not None:
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + global_frame + b'\r\n')
        await asyncio.sleep(0.033) # Dispatch at ~30FPS


@router.get("/video/stream")
async def video_stream():
    """MJPEG streaming endpoint"""
    return StreamingResponse(
        generate_frames(),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )
