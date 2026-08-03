@echo off
cd backend
call .venv\Scripts\activate.bat
echo Starting PerfTracker at http://localhost:8000 ...
uvicorn app.main:app --host 0.0.0.0 --port 8000
