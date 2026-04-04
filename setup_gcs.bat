@echo off
TITLE JATAYU GCS - Setup
echo ========================================
echo   JATAYU GCS: System Setup Process
echo ========================================

:: Backend Setup
echo.
echo [1/2] Setting up Backend (Python)...
cd backend
python -m pip install -r requirements.txt
if %ERRORLEVEL% NEQ 0 (
    echo Error installing backend dependencies.
    pause
    exit /b %ERRORLEVEL%
)
cd ..

:: Frontend Setup
echo.
echo [2/2] Setting up Frontend (Node.js)...
cd frontend
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo Error installing frontend dependencies.
    pause
    exit /b %ERRORLEVEL%
)
cd ..

echo.
echo ========================================
echo   Setup Complete!
echo   Use start_gcs.bat to launch the system.
echo ========================================
pause
