@echo off
setlocal EnableDelayedExpansion
cd backend
call .venv\Scripts\activate.bat
echo This will WIPE and reload the FY26-27 Ask catalog - any local changes you've made
echo (opt-ins, Outcomes, edits, new Asks) will be lost. Press Ctrl+C to cancel, or
pause
if exist perftracker.db (
    if not exist aose.db (
        ren perftracker.db aose.db
        echo Renamed backend\perftracker.db to backend\aose.db - the app is now named AOSE.
    )
)
if exist .env (
    findstr /C:"DATABASE_URL=sqlite:///./perftracker.db" .env >nul
    if not errorlevel 1 (
        powershell -NoProfile -Command "(Get-Content .env) -replace [regex]::Escape('DATABASE_URL=sqlite:///./perftracker.db'), 'DATABASE_URL=sqlite:///./aose.db' | Set-Content .env"
        echo Updated backend\.env: DATABASE_URL now points to aose.db instead of perftracker.db.
    )
)
if exist aose.db (
    if not exist backups mkdir backups
    for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"') do set BACKUP_TS=%%i
    copy aose.db "backups\aose-!BACKUP_TS!.db" >nul
    echo Backed up to backend\backups\aose-!BACKUP_TS!.db before wiping.
)
python scripts\seed_db.py
