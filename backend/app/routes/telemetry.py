"""
JATAYU GCS — Telemetry Routes
Proxies telemetry from Mission Planner HTTP endpoint
"""
import logging
import requests
from fastapi import APIRouter
from app.config import get_settings
from app.models import TelemetryResponse, HealthResponse
from app.mavlink_service import mav_service, ARDUPLANE_MODES

# Reverse the mode map for translating IDs back to string names
MODE_MAP_INV = {v: k for k, v in ARDUPLANE_MODES.items()}

router = APIRouter()
log = logging.getLogger("gcs.telemetry")

LATEST_TELEMETRY = TelemetryResponse()

@router.get("/telemetry", response_model=TelemetryResponse)
async def get_telemetry():
    """Fetch live telemetry from Mission Planner HTTP endpoint."""
    settings = get_settings()
    try:
        resp = requests.get(settings.telemetry_url, timeout=settings.telemetry_timeout)
        if resp.status_code == 200:
            data = resp.json()

            # Parse MAVLink REST API format
            gps_raw = (data.get("GPS_RAW_INT") or {}).get("msg") or {}
            vfr_hud = (data.get("VFR_HUD") or {}).get("msg") or {}
            heartbeat = (data.get("HEARTBEAT") or {}).get("msg") or {}
            sys_status = (data.get("SYS_STATUS") or {}).get("msg") or {}

            lat = gps_raw.get("lat", 0) / 1e7
            lon = gps_raw.get("lon", 0) / 1e7
            alt_m = vfr_hud.get("alt", 0.0)
            hdg = vfr_hud.get("heading", 0.0)
            ground_speed = vfr_hud.get("groundspeed", 0.0)
            climb_rate = vfr_hud.get("climb", 0.0)

            # Try to decode mode from HEARTBEAT
            custom_mode = heartbeat.get("custom_mode", 0)
            mode = MODE_MAP_INV.get(custom_mode, f"MODE_{custom_mode}")

            # Battery percentage calculation
            battery = 0
            voltage = sys_status.get("voltage_battery", 0)
            battery_rem = sys_status.get("battery_remaining", -1)
            
            if battery_rem > 0:
                battery = battery_rem
            elif voltage > 0:
                v = voltage / 1000.0
                # Approximation for a 3S battery
                battery = max(0, min(100, int((v - 10.5) / (12.6 - 10.5) * 100)))

            satellites_visible = gps_raw.get("satellites_visible", 0)
            fix_type = gps_raw.get("fix_type", 0)

            global LATEST_TELEMETRY
            LATEST_TELEMETRY = TelemetryResponse(
                lat=lat, lon=lon, alt_m=alt_m, hdg=hdg,
                mode=mode, battery=battery, link="online",
                ground_speed=ground_speed, climb_rate=climb_rate,
                gps_sats=satellites_visible, gps_fix_type=fix_type
            )
            return LATEST_TELEMETRY
    except requests.exceptions.ConnectionError:
        log.debug("Telemetry server unreachable")
    except requests.exceptions.Timeout:
        log.debug("Telemetry request timed out")
    except Exception as exc:
        log.error(f"Telemetry error: {exc}")

    return TelemetryResponse(link="offline")


@router.get("/health", response_model=HealthResponse)
async def get_health():
    """System health check."""
    settings = get_settings()
    try:
        resp = requests.get(settings.telemetry_url, timeout=0.3)
        connected = resp.status_code == 200
    except Exception:
        connected = False

    return HealthResponse(
        status="ok" if mav_service.is_connected else "degraded",
        mavlink_connected=mav_service.is_connected,
        model_loaded=False,
        video_active=False,
        pipeline_running=connected,
    )
