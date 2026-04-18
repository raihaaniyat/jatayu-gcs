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

try:
    from pygrabber.dshow_graph import FilterGraph
except ImportError:
    FilterGraph = None

try:
    import pythoncom
except ImportError:
    pythoncom = None

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


def detect_cameras():
    """Detect available cameras using pygrabber for names, with DirectShow fallback.
    Ported from the proven Flask FOD detection script."""
    cameras = []

    # Try pygrabber first for friendly device names
    if FilterGraph and pythoncom:
        try:
            pythoncom.CoInitialize()
            graph = FilterGraph()
            devices = graph.get_input_devices()
            for i, name in enumerate(devices):
                cameras.append({"index": i, "name": name})

            if cameras:
                log.info(f"Pygrabber detected {len(cameras)} camera(s): {[c['name'] for c in cameras]}")
                return cameras
        except Exception as e:
            log.warning(f"Pygrabber detection failed: {e}")
        finally:
            try:
                pythoncom.CoUninitialize()
            except Exception:
                pass

    # Fallback to legacy detection via DirectShow probing
    log.info("Falling back to legacy camera detection (DirectShow probe)...")
    prioritized_backends = [cv2.CAP_DSHOW]

    for i in range(5):
        detected = False
        for backend in prioritized_backends:
            try:
                cap = cv2.VideoCapture(i, backend)
                if cap.isOpened():
                    backend_name = "DirectShow" if backend == cv2.CAP_DSHOW else "Unknown"
                    cameras.append({"index": i, "name": f"Camera {i} ({backend_name})"})
                    cap.release()
                    detected = True
                    break
            except Exception:
                continue

        if not detected:
            try:
                cap = cv2.VideoCapture(i, cv2.CAP_ANY)
                if cap.isOpened():
                    cameras.append({"index": i, "name": f"Camera {i} (Standard)"})
                    cap.release()
            except Exception:
                pass

    if not cameras:
        cameras = [{"index": 0, "name": "Default Camera"}]

    log.info(f"Legacy detection found {len(cameras)} camera(s)")
    return cameras


@router.get("/video/cameras")
async def get_cameras():
    """Returns a list of detected camera devices with index and friendly name."""
    cams = detect_cameras()
    return cams

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
            log.info("Loading YOLO model yolo26n-pose.pt...")
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
    """Background thread that reads the active video source, resizes to 640px, runs YOLO, and saves MJPEG frames.
    Camera opening logic ported from the proven Flask FOD script — tries DirectShow first for speed."""
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
                    if isinstance(VIDEO_SOURCE, int):
                        # Camera index — try DirectShow first (much faster on Windows)
                        log.info(f"Opening camera {VIDEO_SOURCE} with DirectShow...")
                        cap = cv2.VideoCapture(VIDEO_SOURCE, cv2.CAP_DSHOW)
                        backend_used = "DirectShow"
                        
                        if not cap.isOpened():
                            log.info(f"DirectShow failed, trying default backend for camera {VIDEO_SOURCE}...")
                            cap = cv2.VideoCapture(VIDEO_SOURCE)
                            backend_used = "Default"
                        
                        if cap.isOpened():
                            # Set resolution and FPS like the working Flask script
                            cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
                            cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
                            cap.set(cv2.CAP_PROP_FPS, 30)
                            log.info(f"Camera {VIDEO_SOURCE} opened successfully using {backend_used}")
                        else:
                            log.error(f"Failed to open camera {VIDEO_SOURCE} with any backend")
                    else:
                        # File path — try default then FFMPEG
                        cap = cv2.VideoCapture(VIDEO_SOURCE)
                        if not cap.isOpened():
                            cap = cv2.VideoCapture(VIDEO_SOURCE, cv2.CAP_FFMPEG)
                    
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
                # Optimized params: low imgsz, persistent tracking, filtered for persons
                results = model.track(
                    source=frame, 
                    persist=True, 
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
                    
                    for i, box in enumerate(results[0].boxes):
                        track_id = int(box.id[0].item()) if box.id is not None else 0
                        conf = float(box.conf[0].item())
                        xyxy = box.xyxy[0].tolist() 
                        
                        # Determine pose mapping — only standing or unknown
                        bbox_h = xyxy[3] - xyxy[1]
                        bbox_w = xyxy[2] - xyxy[0]
                        pose_val = "unknown"
                        
                        # Standing = tall bounding box
                        if bbox_h > bbox_w * 1.2:
                            pose_val = "standing"
                            
                        # Refine with keypoints if available
                        if pose_val == "standing" and results[0].keypoints is not None and len(results[0].keypoints.xy) > i:
                            kpts = results[0].keypoints.xy[i]
                            if len(kpts) > 14:
                                s_y = (float(kpts[5][1]) + float(kpts[6][1])) / 2
                                h_y = (float(kpts[11][1]) + float(kpts[12][1])) / 2
                                k_y = (float(kpts[13][1]) + float(kpts[14][1])) / 2
                                if s_y > 0 and h_y > s_y and k_y > 0:
                                    if (k_y - h_y) < (h_y - s_y) * 0.5:
                                        pose_val = "unknown"

                        # Generate random severity based on confidence
                        severity = min(10, max(1, int(conf * 10) + 1))
                        
                        det = Detection(
                            id=f"TRK-{track_id}",
                            bbox=xyxy,
                            confidence=conf,
                            pose=pose_val,
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
                
                # Draw extremely minimal lines (hide big labels, thin boxes)
                frame = results[0].plot(line_width=1, labels=False, boxes=True, kpt_radius=2)
                
                # Drop custom light pose text 
                for det in current_detections:
                    if det.bbox:
                        x1, y1 = int(det.bbox[0]), int(det.bbox[1])
                        cv2.putText(frame, det.pose.upper(), (x1, max(15, y1 - 8)), 
                                    cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 255, 0), 1)

            # ── RECORDING ENGINE ──────────────────────────────────────────────────
            if is_recording:
                if record_writer is None:
                    filename = f"mission_{datetime.now().strftime('%Y%m%d_%H%M%S')}.webm"
                    save_path = os.path.join(REC_DIR, filename)
                    fourcc = cv2.VideoWriter_fourcc(*'VP80') # webm encoded
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
