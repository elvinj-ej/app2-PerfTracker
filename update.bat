@echo off
setlocal

echo ============================================
echo  AOSE - update
echo ============================================

git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
    echo This folder isn't a git repository, so update.bat can't pull automatically.
    echo Download the latest ZIP from GitHub instead, extract it, and copy the files
    echo over this folder ^(keep backend\.env and backend\aose.db - or backend\perftracker.db
    echo if you haven't run setup.bat since the AOSE rename yet^), then run setup.bat yourself.
    exit /b 1
)

echo.
echo [1/3] Pulling latest changes...
git pull
if errorlevel 1 (
    echo git pull failed - check the message above ^(local edits, network, or auth^).
    exit /b 1
)

echo.
echo [2/3] Re-running setup (installs any new dependencies, applies any new
echo database migrations, rebuilds the frontend if it changed)...
call setup.bat

echo.
echo [3/3] Restarting the app...
for /f "tokens=5" %%p in ('netstat -aon ^| findstr :5020 ^| findstr LISTENING') do (
    echo Stopping the currently running instance ^(PID %%p^)...
    taskkill /F /PID %%p >nul 2>&1
)

start "AOSE" cmd /k start.bat

echo.
echo Update complete - AOSE is restarting in a new window at
echo http://localhost:5020/AOSE
