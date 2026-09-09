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
if exist aose.db (
    if not exist backups mkdir backups
    for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"') do set BACKUP_TS=%%i
    copy aose.db "backups\aose-!BACKUP_TS!.db" >nul
    echo Backed up to backend\backups\aose-!BACKUP_TS!.db before wiping.
)
python scripts\seed_db.py
