#!/bin/bash
set -e

echo "🐼 Setting up Red Pandas development environment..."

# Backend setup
echo "📦 Setting up backend..."
cd /workspace/backend
python -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    cp .env.example .env
    echo "⚠️  Created .env file - please update with your OPENAI_API_KEY"
fi

# Frontend setup
echo "📦 Setting up frontend..."
cd /workspace/frontend
npm install

echo "✅ Development environment ready!"