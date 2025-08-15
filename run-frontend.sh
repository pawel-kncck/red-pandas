#!/bin/bash

# Script to run the Red Pandas frontend

echo "🐼 Starting Red Pandas Frontend..."
echo "================================"

# Navigate to frontend directory
cd frontend

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Start the development server
echo "Starting frontend on http://localhost:5173"
npm run dev

# The script will keep running until you press Ctrl+C