@echo off
TITLE JATAYU GCS - Launchpad
echo ========================================
echo   JATAYU GCS: Starting System...
echo ========================================

:: Start Backend
echo Launching Backend (FastAPI)...
start "GCS Backend" cmd /k "cd backend && python run.py"

:: Start Frontend
echo Launching Frontend (Vite)...
start "GCS Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo ========================================
echo   Both services are starting!
echo   - Backend: http://localhost:8080
echo   - Frontend: http://localhost:5173
echo ========================================
pause
