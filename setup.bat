@echo off
setlocal EnableDelayedExpansion

echo ============================================
echo  AOSE - one-time setup
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
) else (
    REM An existing .env is never overwritten, so a pre-AOSE-rename .env still has the
    REM old DATABASE_URL/URL_PREFIX values baked in verbatim - renaming the .db file on
    REM disk alone doesn't help if .env still points at the old filename (SQLite would
    REM silently create a fresh, empty perftracker.db instead of erroring, which looks
    REM exactly like "all my data disappeared"). Only rewrites these two exact old
    REM default lines if found as-is, so a deliberately customized value is left alone.
    findstr /C:"DATABASE_URL=sqlite:///./perftracker.db" .env >nul
    if not errorlevel 1 (
        powershell -NoProfile -Command "(Get-Content .env) -replace [regex]::Escape('DATABASE_URL=sqlite:///./perftracker.db'), 'DATABASE_URL=sqlite:///./aose.db' | Set-Content .env"
        echo Updated backend\.env: DATABASE_URL now points to aose.db instead of perftracker.db.
    )
    findstr /C:"URL_PREFIX=/PerfTracker" .env >nul
    if not errorlevel 1 (
        powershell -NoProfile -Command "(Get-Content .env) -replace [regex]::Escape('URL_PREFIX=/PerfTracker'), 'URL_PREFIX=/AOSE' | Set-Content .env"
        echo Updated backend\.env: URL_PREFIX now /AOSE instead of /PerfTracker.
    )
)

echo.
echo [3/4] Backing up the database before migrating (in case a future migration
echo ever needs undoing) and running database migrations (SQLite file:
echo backend\aose.db)...
if exist perftracker.db (
    if not exist aose.db (
        ren perftracker.db aose.db
        echo Renamed backend\perftracker.db to backend\aose.db - the app is now named AOSE.
    ) else (
        echo Note: backend\perftracker.db still exists but is no longer used - backend\aose.db is now the live database.
    )
)
if exist aose.db (
    if not exist backups mkdir backups
    for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"') do set BACKUP_TS=%%i
    copy aose.db "backups\aose-!BACKUP_TS!.db" >nul
    echo Backed up to backend\backups\aose-!BACKUP_TS!.db
)
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
