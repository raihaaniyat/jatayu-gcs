git init

# 1. Backend Core Setup
git add backend/requirements.txt backend/run.py backend/app/__init__.py backend/app/main.py backend/app/config backend/app/models
git commit -m "feat(backend): Initial FastAPI setup, models, and config"

# 2. Frontend Core Setup
git add frontend/package.json frontend/package-lock.json frontend/vite.config.ts frontend/index.html frontend/tsconfig.json frontend/tsconfig.node.json frontend/src/main.tsx frontend/src/App.tsx frontend/src/index.css frontend/src/types
git commit -m "feat(frontend): Initial React + Vite setup, Tailwind config, and global types"

# 3. Backend MAVLink Integration
git add backend/app/mavlink_service.py backend/app/routes/telemetry.py backend/app/routes/drone.py
git commit -m "feat(backend): Implement MAVLink TCP proxy, telemetry parser, and drone command endpoints"

# 4. Frontend Mission UI & Services
git add frontend/src/components frontend/src/pages/OverviewPage.tsx frontend/src/pages/MissionControlPage.tsx frontend/src/pages/SettingsPage.tsx frontend/src/store frontend/src/services frontend/src/config
git commit -m "feat(frontend): Mission Control dashboard, Zustand store, WebSocket services, and settings"

# 5. Backend Routing & Intelligence
git add backend/app/routes/targets.py backend/app/routes/recordings.py backend/app/routes/payload.py
git commit -m "feat(backend): Target tracking API, Haversine 3D slant-routing engine, and payload endpoints"

# 6. Frontend Tactical Map & Intelligence
git add frontend/src/pages/TacticalMapPage.tsx frontend/src/pages/RecordingsPage.tsx frontend/src/pages/SavedTargetsPage.tsx frontend/src/pages/PayloadDropPage.tsx
git commit -m "feat(frontend): Tactical Live Map drawing, Geodesic routing lines, and target logging cards"

# 7. Remaining Files and Config
git add .
git commit -m "chore: Apply .gitignore rules, cleanups, and final synchronizations"

git branch -M main
git remote add origin https://github.com/raihaaniyat/jatayu-gcs.git
git push -u origin main
