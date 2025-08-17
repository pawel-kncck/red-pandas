#!/bin/bash

# Red Pandas Backend Startup Script
# This script ensures proper MongoDB authentication when running in the devcontainer

# Activate virtual environment
source .venv/bin/activate

# Export MongoDB URL with authentication
export MONGODB_URL="mongodb://admin:password@mongodb:27017/?authSource=admin"

# Start the FastAPI server
uvicorn main:app --reload --host 0.0.0.0 --port 8000