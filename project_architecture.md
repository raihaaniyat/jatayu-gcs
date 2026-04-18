# JATAYU GCS: System Architecture & Technical Explanation

JATAYU GCS is an advanced, AI-powered Ground Control Station (GCS) designed for aerial search and rescue, surveillance, and tactical target tracking operations. The platform merges autonomous drone control with real-time video intelligence into a seamless operator kiosk.

## Core Utility & Use Cases

1. **AI Object Detection & Pose Estimation**: Identifying human subjects in mission-critical environments (disaster zones, security perimeters). The system uses bounding boxes and skeletal tracking to classify the target’s posture (e.g., `standing`, `unknown`) to assess risk or need for extraction.
2. **Real-time Tactical Mapping**: Automatically capturing the geographic footprint of detected targets and mapping them against the operator’s origin or the drone’s current position.
3. **Payload / Drop Control**: Enabling remote payload deployment (medic kits, rescue tubes, markers) over prioritized targets.
4. **Mission Intelligence Archiving**: Saving crucial footage seamlessly and locally in the background without needing cloud intervention, vital for debriefing and after-action reporting.

---

## Technology Stack Rationale

### 1. Frontend: React + Vite + Zustand + TypeScript
- **Why React?** Component-driven scaling makes building complex, multi-view dashboards—like combining a map, a video feed, and a drone telemetry HUD—far more manageable than raw JavaScript.
- **Why Vite?** For lightning-fast HMR (Hot Module Replacement) and optimized bundling. Ground control software requires robust memory management and low-latency rendering, which Vite streamlines natively.
- **Why Zustand?** Overly complex state management tools like Redux are overkill for the tight, real-time polling loops of a GCS. Zustand offers a reactive, atomic, and extremely slim state machine perfectly parallel to our frequent telemetry polling intervals.
- **Why TypeScript?** Strict typing ensures zero runtime crashes during rapid telemetry data mapping or unhandled properties when receiving drone states.

### 2. Styling: Vanilla CSS & Custom Utility Classes
- **Why Vanilla CSS instead of Tailwind?** The project specifically employs an "Accessible Industrial Kiosk" design aesthetic—which heavily relies on dense data cards, custom glassmorphism overlays, and rigid metric UI elements. Vanilla CSS handles tight spatial boundaries and unique design tokens (`--gcs-accent`, `--gcs-surface`) significantly better than verbose utility classes.

### 3. Backend: FastAPI (Python)
- **Why FastAPI?** Traditional backend servers (Node/Express, Django) cannot safely or performantly run synchronous OpenCV computer vision loops in the background alongside HTTP serving. FastAPI's native `asyncio` base effortlessly bridges high-speed MJPEG byte-stream generators (video routing) with standard REST paths.

### 4. Computer Vision: Ultralytics YOLOv8 (yolo26n-pose) + OpenCV
- **Why Ultralytics YOLO?** It is currently the industry standard for state-of-the-art edge-detectable AI. Our specific model (`yolo26n-pose`) offers sub-30ms inference speeds while simultaneously returning bounding boxes, confidence, *and* keypoints for skeletal structural logic.
- **Why OpenCV?** Direct buffer manipulation. Rather than using WebRTC (which requires heavy turn/stun server negotiation and aggressive browser codecs), OpenCV handles lightweight camera capturing, box-drawing, WebM (VP8) mission recording, and JPEG fragmentation, serving those frames natively via standard HTTP multipart replacing.

### 5. Datastore: JSON (detected_targets.json)
- **Why Flat-File JSON?** A true SQL database (PostgreSQL/SQLite) would add unnecessary I/O overhead for a system tracking temporary geographic waypoints. Keeping targets in a synchronized JSON file ensures instantaneous reads, easy external script dumping, and total atomic local persistence.

---

## Technical Workflows

### The Video AI Pipeline
1. The **Video processing loop** (`backend/app/routes/video.py`) operates in a persistent daemon thread that grabs the latest camera frame or video uploaded by the operator.
2. The frame is fed linearly into the YOLO model. The model computes coordinates for bounding boxes and skeleton keypoint matrices.
3. Native logic computes bounding box dimensions and skeletal proportions to ascertain whether a figure is `standing` or `unknown`. A severity metric is mapped purely based on detection confidence bounds.
4. Telemetry coordinates are injected straight into the localized AI packet, giving a geographic footprint.
5. Frames are stamped with telemetry, overlaid with bounding lines, exported via `cv2.VideoWriter` to the active WebM mission recording, and simultaneously blasted via MJPEG stream to `MissionControlPage.tsx`.

### The Tactical Telemetry Fallback Loop
When a drone falls offline (Simulators powered down), `models.py` natively drops standard MITS Gwalior coordinates (`lat: 26.2306, lon: 78.2070`). Meanwhile, the Frontend (`OverviewPage.tsx`) overrides these empty defaults using the `navigator.geolocation` API, pulling the local operator's exact browser location dynamically to ensure map pinning functions seamlessly around the actual mission ground zero.
