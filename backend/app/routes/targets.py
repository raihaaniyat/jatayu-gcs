"""
JATAYU GCS — Target Management Routes
Save, retrieve, and manage detected human targets
"""
import json
import logging
from pathlib import Path
from datetime import datetime
from fastapi import APIRouter
from app.models import SaveTargetRequest, SavedTarget, Detection

router = APIRouter()
log = logging.getLogger("gcs.targets")

BASE_DIR = Path(__file__).resolve().parent.parent.parent
DB_FILE = BASE_DIR / "detected_targets.json"


def _read_db() -> list[dict]:
    if not DB_FILE.exists():
        return []
    try:
        with open(DB_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data if isinstance(data, list) else []
    except (json.JSONDecodeError, OSError):
        return []


def _write_db(db: list[dict]):
    with open(DB_FILE, "w", encoding="utf-8") as f:
        json.dump(db, f, indent=4, ensure_ascii=False)


@router.get("/targets", response_model=list[SavedTarget])
async def get_targets():
    """List all saved targets."""
    db = _read_db()
    results = []
    for i, t in enumerate(db):
        results.append(SavedTarget(
            id=t.get("id", f"TGT-{i+1:03d}"),
            timestamp=t.get("timestamp", ""),
            gps_lat=t.get("gps_lat", t.get("lat", 0.0)),
            gps_lon=t.get("gps_lon", t.get("lon", 0.0)),
            severity=t.get("severity_index", t.get("severity", 5)),
            pose=t.get("pose", "unknown"),
            snapshot_path=t.get("snapshot_path"),
            bbox_image_path=t.get("bbox_image_path"),
            track_id=t.get("track_id", t.get("id", f"TGT-{i+1:03d}")),
            status=t.get("status", "detected"),
        ))
    return results


@router.get("/targets/{target_id}", response_model=SavedTarget)
async def get_target(target_id: str):
    """Get a single target by ID."""
    db = _read_db()
    for t in db:
        if t.get("id") == target_id or t.get("track_id") == target_id:
            return SavedTarget(
                id=t.get("id", target_id),
                timestamp=t.get("timestamp", ""),
                gps_lat=t.get("gps_lat", t.get("lat", 0.0)),
                gps_lon=t.get("gps_lon", t.get("lon", 0.0)),
                severity=t.get("severity_index", t.get("severity", 5)),
                pose=t.get("pose", "unknown"),
                snapshot_path=t.get("snapshot_path"),
                bbox_image_path=t.get("bbox_image_path"),
                track_id=t.get("track_id", target_id),
                status=t.get("status", "detected"),
            )
    return SavedTarget(id=target_id, timestamp="", gps_lat=0, gps_lon=0, severity=0, pose="", track_id=target_id)


@router.post("/targets/save", response_model=SavedTarget)
async def save_target(request: SaveTargetRequest):
    """Save a detected target to the database."""
    db = _read_db()
    target_id = f"TGT-{len(db) + 1:03d}"
    timestamp = datetime.now().isoformat()

    entry = {
        "id": target_id,
        "track_id": target_id,
        "timestamp": timestamp,
        "gps_lat": request.gps_lat,
        "gps_lon": request.gps_lon,
        "severity_index": request.severity,
        "pose": request.pose,
        "bbox": request.bbox,
        "status": "CRITICAL" if request.severity >= 7 else "HIGH" if request.severity >= 4 else "detected",
    }
    db.append(entry)
    _write_db(db)

    log.info(f"Target saved: {target_id} ({request.gps_lat:.6f}, {request.gps_lon:.6f}) sev={request.severity}")

    return SavedTarget(
        id=target_id,
        timestamp=timestamp,
        gps_lat=request.gps_lat,
        gps_lon=request.gps_lon,
        severity=request.severity,
        pose=request.pose,
        track_id=target_id,
        status=entry["status"],
    )


@router.get("/detections/active", response_model=list[Detection])
async def get_active_detections():
    """Get currently active detections (from YOLO pipeline)."""
    # TODO: Connect to actual YOLO pipeline
    # For now return empty — will be populated when vision pipeline runs
    return []


@router.get("/map/targets")
async def get_map_targets():
    """Get all targets formatted for map rendering."""
    db = _read_db()
    return [
        {
            "id": t.get("id", f"TGT-{i+1:03d}"),
            "gps_lat": t.get("gps_lat", t.get("lat", 0.0)),
            "gps_lon": t.get("gps_lon", t.get("lon", 0.0)),
            "severity": t.get("severity_index", t.get("severity", 5)),
            "status": t.get("status", "detected"),
            "pose": t.get("pose", "unknown"),
            "timestamp": t.get("timestamp", ""),
            "track_id": t.get("track_id", t.get("id", f"TGT-{i+1:03d}")),
        }
        for i, t in enumerate(db)
    ]


import math

def haversine(lat1, lon1, lat2, lon2):
    """Calculate the great-circle distance between two points in meters."""
    R = 6371000 # Radius of earth in meters
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    a = math.sin(delta_phi/2)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    return R * c

def calculate_slant_range(lat1, lon1, alt1, lat2, lon2, alt2):
    """Calculate 3D slant distance using horizontal Haversine and vertical difference."""
    horizontal_dist = haversine(lat1, lon1, lat2, lon2)
    vertical_dist = abs(alt1 - alt2)
    slant_dist = math.sqrt(horizontal_dist**2 + vertical_dist**2)
    return slant_dist

@router.get("/map/routes")
async def get_map_routes(
    op_lat: float = 26.2306, 
    op_lon: float = 78.2070, 
    op_alt: float = 0.0,
    drone_lat: float = None,
    drone_lon: float = None,
    drone_alt: float = 0.0
):
    """Calculate direct 3D aerial distances from operator to drone and targets."""
    routes = []
    
    # 1. Operator to Drone Route
    if drone_lat is not None and drone_lon is not None:
        dist = calculate_slant_range(op_lat, op_lon, op_alt, drone_lat, drone_lon, drone_alt)
        routes.append({
            "id": "route_op_to_drone",
            "type": "direct_aerial",
            "name": "Operator → Drone",
            "coordinates": [[op_lat, op_lon], [drone_lat, drone_lon]],
            "color": "#38bdf8", # Blue for drone
            "distance_m": dist
        })

    # 2. Operator to Targets Routes
    db = _read_db()
    for t in db:
        if t.get("gps_lat") and t.get("gps_lon"):
            dist = calculate_slant_range(op_lat, op_lon, op_alt, t["gps_lat"], t["gps_lon"], 0.0) # Targets on ground (alt 0)
            target_id = t.get("id", "Unknown")
            routes.append({
                "id": f"route_op_to_{target_id}",
                "type": "direct_aerial",
                "name": f"Operator → {target_id}",
                "coordinates": [[op_lat, op_lon], [t["gps_lat"], t["gps_lon"]]],
                "color": "#fbbf24", # Yellow/Amber for targets
                "distance_m": dist,
                "target_id": target_id
            })

    return routes
