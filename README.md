# JATAYU GCS — Ground Control Station

This is the Mission Control Center for the JATAYU VTOL Drone.

## Quick Start (Windows)
We have provided automation scripts to simplify the setup and launch process:

1. **Setup**: Run `setup_gcs.bat`. This will install all Python backend and Node.js frontend dependencies.
2. **Launch**: Run `start_gcs.bat`. This will open two separate terminal windows for the Backend and Frontend.

---

## Detailed Process

### 1. Backend Service (FastAPI)
The backend handles MAVLink telemetry, target processing, and WebSocket communication.

- **Directory**: `gcs/backend`
- **Installation**: `pip install -r requirements.txt`
- **Execution**: `python run.py`
- **Default Port**: `8080`
- **MAVLink Info**: It connects to ArduPilot SITL at `tcp:127.0.0.1:5760` by default.

### 2. Frontend Application (React + Vite)
The frontend provides the mission dashboard and tactical map.

- **Directory**: `gcs/frontend`
- **Installation**: `npm install`
- **Execution**: `npm run dev`
- **Default Port**: `5173` (Vite Default)

## Configuration
- **Backend Configuration**: Located in `backend/app/config.py`. You can override settings using environment variables with the `GCS_` prefix (e.g., `GCS_PORT=9000`).
- **Telemetry Source**: Ensure your SITL or MAVProxy instance is running at `127.0.0.1:5760`.
