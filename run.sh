#!/bin/bash

echo "🐼 Starting Red Pandas Backend..."

# Navigate to backend
cd backend

# Create venv if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate venv
source venv/bin/activate

# Install dependencies if requirements.txt exists
if [ -f "requirements.txt" ]; then
    echo "Installing dependencies..."
    pip install -r requirements.txt
fi

# Start the backend
echo "Starting server at http://localhost:8000"
echo "API Docs at http://localhost:8000/docs"
echo "Press Ctrl+C to stop"
uvicorn main:app --reload