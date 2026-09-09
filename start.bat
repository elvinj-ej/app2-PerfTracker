@echo off
cd backend
call .venv\Scripts\activate.bat
echo Starting AOSE at http://localhost:5020/AOSE ...
uvicorn app.main:app --host 0.0.0.0 --port 5020
