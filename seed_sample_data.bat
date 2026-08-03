@echo off
cd backend
call .venv\Scripts\activate.bat
echo This will WIPE and reload sample demo data. Press Ctrl+C to cancel, or
pause
python scripts\seed_db.py
