@echo off
cd backend
call .venv\Scripts\activate.bat
echo Starting PerfTracker at http://localhost:5020/PerfTracker ...
uvicorn app.main:app --host 0.0.0.0 --port 5020
