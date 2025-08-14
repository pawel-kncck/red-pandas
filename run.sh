#!/bin/bash

# Red Pandas Backend Startup Script

set -e  # Exit on error

echo "🐼 Starting Red Pandas Backend..."
echo "================================"

# Navigate to backend directory
cd backend

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "🔄 Activating virtual environment..."
source venv/bin/activate

# Upgrade pip
echo "⬆️ Upgrading pip..."
pip install --upgrade pip --quiet

# Install dependencies
echo "📚 Installing dependencies..."
pip install -r requirements.txt --quiet

# Check for .env file
if [ ! -f ".env" ]; then
    echo "⚠️ Warning: .env file not found!"
    echo "Creating .env from .env.example..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "✅ Created .env file. Please update it with your configuration."
        echo "   Required: OPENAI_API_KEY"
        echo "   Optional: MONGODB_URL (defaults to localhost:27017)"
    else
        echo "❌ Error: .env.example not found. Please create a .env file with:"
        echo "   OPENAI_API_KEY=your_api_key_here"
        echo "   MONGODB_URL=mongodb://localhost:27017"
        echo "   DATABASE_NAME=red_pandas_db"
        exit 1
    fi
fi

# Check MongoDB connection
echo "🔍 Checking MongoDB connection..."
python -c "
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

async def check_mongo():
    try:
        client = AsyncIOMotorClient(os.getenv('MONGODB_URL', 'mongodb://localhost:27017'))
        await client.admin.command('ping')
        print('✅ MongoDB is running')
        return True
    except Exception as e:
        print(f'❌ MongoDB connection failed: {e}')
        print('Please ensure MongoDB is running:')
        print('  - For local MongoDB: mongod')
        print('  - For Docker: docker run -d -p 27017:27017 mongo')
        return False

asyncio.run(check_mongo())
" || {
    echo "Failed to connect to MongoDB. Exiting..."
    exit 1
}

# Start the FastAPI server
echo ""
echo "🚀 Starting FastAPI server..."
echo "================================"
echo "📍 API: http://localhost:8000"
echo "📚 Docs: http://localhost:8000/docs"
echo "🔄 Redoc: http://localhost:8000/redoc"
echo "================================"
echo "Press Ctrl+C to stop the server"
echo ""

# Run the server
uvicorn main:app --reload --host 0.0.0.0 --port 8000