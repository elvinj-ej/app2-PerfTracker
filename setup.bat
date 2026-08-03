@echo off
setlocal

echo ============================================
echo  PerfTracker - one-time setup
echo ============================================

where python >nul 2>&1
if errorlevel 1 (
    echo Python was not found on PATH. Install Python 3.11+ from https://www.python.org/downloads/ and re-run this script.
    exit /b 1
)

echo.
echo [1/4] Creating Python virtual environment...
cd backend
if not exist .venv (
    python -m venv .venv
)
call .venv\Scripts\activate.bat

echo.
echo [2/4] Installing backend dependencies...
pip install --quiet -r requirements.txt

if not exist .env (
    copy .env.example .env >nul
    echo Created backend\.env - edit it to set ANTHROPIC_API_KEY if you want AI task breakdowns.
)

echo.
echo [3/4] Running database migrations (SQLite file: backend\perftracker.db)...
alembic upgrade head
cd ..

where node >nul 2>&1
if errorlevel 1 (
    echo.
    echo Node.js was not found - skipping frontend build.
    echo If backend\static already contains a prebuilt frontend, that is fine, it will be served as-is.
    echo Otherwise install Node.js from https://nodejs.org and re-run this script.
    goto :done
)

echo.
echo [4/4] Building the frontend...
cd frontend
call npm install
call npm run build
cd ..

if exist backend\static rmdir /s /q backend\static
xcopy /e /i /y frontend\dist backend\static >nul

:done
echo.
echo Setup complete. Run start.bat to launch the app.
