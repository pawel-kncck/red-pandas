#!/bin/bash
set -e

echo "🚀 Starting Red Pandas services..."

# Start backend in background
cd /workspace/backend
source venv/bin/activate
nohup uvicorn main:app --reload --host 0.0.0.0 --port 8000 > /tmp/backend.log 2>&1 &

# Start frontend in background
cd /workspace/frontend
nohup npm run dev -- --host 0.0.0.0 > /tmp/frontend.log 2>&1 &

echo "✅ Services started!"
echo "📍 Backend: http://localhost:8000"
echo "📍 Frontend: http://localhost:5173"
echo "📍 API Docs: http://localhost:8000/docs"