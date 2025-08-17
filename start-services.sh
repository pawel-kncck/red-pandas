#!/bin/bash

# Red Pandas DevContainer Services Manager
# This script manages backend and frontend services within the DevContainer environment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_color() {
    echo -e "${2}${1}${NC}"
}

# Function to check if a process is running
is_running() {
    pgrep -f "$1" > /dev/null 2>&1
}

# Function to stop a service
stop_service() {
    local service_name=$1
    local process_pattern=$2
    
    if is_running "$process_pattern"; then
        print_color "⏹️  Stopping $service_name..." "$YELLOW"
        pkill -f "$process_pattern" 2>/dev/null || true
        sleep 2
        print_color "✅ $service_name stopped" "$GREEN"
    else
        print_color "ℹ️  $service_name is not running" "$BLUE"
    fi
}

# Function to start backend
start_backend() {
    print_color "🚀 Starting backend service..." "$YELLOW"
    
    cd /workspace/backend
    
    # Activate virtual environment if it exists
    # Using .venv instead of venv due to volume mount permissions
    if [ -d ".venv" ]; then
        source .venv/bin/activate
    else
        print_color "⚠️  Virtual environment not found, creating..." "$YELLOW"
        python3 -m venv .venv
        source .venv/bin/activate
        pip install --upgrade pip
        pip install -r requirements.txt
    fi
    
    # Check if .env file exists
    if [ ! -f ".env" ]; then
        if [ -f ".env.example" ]; then
            cp .env.example .env
            print_color "⚠️  Created .env file - please update with your OPENAI_API_KEY" "$YELLOW"
        else
            print_color "❌ No .env file found and no .env.example to copy!" "$RED"
            return 1
        fi
    fi
    
    # Start backend in background
    nohup uvicorn main:app --reload --host 0.0.0.0 --port 8000 > /tmp/backend.log 2>&1 &
    
    # Wait a moment for the service to start
    sleep 3
    
    # Check if backend started successfully
    if is_running "uvicorn main:app"; then
        print_color "✅ Backend started successfully" "$GREEN"
        print_color "   📍 API: http://localhost:8000" "$GREEN"
        print_color "   📍 Docs: http://localhost:8000/docs" "$GREEN"
        print_color "   📄 Logs: /tmp/backend.log" "$GREEN"
    else
        print_color "❌ Failed to start backend" "$RED"
        print_color "   Check logs: tail -f /tmp/backend.log" "$RED"
        return 1
    fi
}

# Function to start frontend
start_frontend() {
    print_color "🚀 Starting frontend service..." "$YELLOW"
    
    cd /workspace/frontend
    
    # Check if node_modules exists
    if [ ! -d "node_modules" ]; then
        print_color "📦 Installing frontend dependencies..." "$YELLOW"
        npm install
    fi
    
    # Start frontend in background
    nohup npm run dev -- --host 0.0.0.0 > /tmp/frontend.log 2>&1 &
    
    # Wait a moment for the service to start
    sleep 5
    
    # Check if frontend started successfully
    if is_running "npm run dev"; then
        print_color "✅ Frontend started successfully" "$GREEN"
        print_color "   📍 URL: http://localhost:5173" "$GREEN"
        print_color "   📄 Logs: /tmp/frontend.log" "$GREEN"
    else
        print_color "❌ Failed to start frontend" "$RED"
        print_color "   Check logs: tail -f /tmp/frontend.log" "$RED"
        return 1
    fi
}

# Function to check MongoDB connection
check_mongodb() {
    print_color "🔍 Checking MongoDB connection..." "$YELLOW"
    
    # Try to connect to MongoDB (using the DevContainer setup with authentication)
    # MongoDB is configured with auth in docker-compose.yml
    if python3 -c "from pymongo import MongoClient; client = MongoClient('mongodb://admin:password@mongodb:27017/'); client.server_info()" 2>/dev/null; then
        print_color "✅ MongoDB is accessible (internal)" "$GREEN"
    elif python3 -c "from pymongo import MongoClient; client = MongoClient('mongodb://admin:password@localhost:27017/'); client.server_info()" 2>/dev/null; then
        print_color "✅ MongoDB is accessible on localhost:27017" "$GREEN"
    elif python3 -c "from pymongo import MongoClient; client = MongoClient('mongodb://admin:password@localhost:27018/'); client.server_info()" 2>/dev/null; then
        print_color "✅ MongoDB is accessible on localhost:27018" "$GREEN"
    else
        print_color "⚠️  MongoDB connection failed - it may not be running or requires different credentials" "$YELLOW"
        print_color "   Continuing anyway - backend will handle MongoDB connection" "$YELLOW"
        # Don't return error since backend has its own MongoDB config
    fi
}

# Function to show service status
show_status() {
    print_color "\n📊 Service Status:" "$BLUE"
    echo "─────────────────────────────"
    
    if is_running "uvicorn main:app"; then
        print_color "✅ Backend:  Running" "$GREEN"
        print_color "   http://localhost:8000" "$NC"
    else
        print_color "❌ Backend:  Not running" "$RED"
    fi
    
    if is_running "npm run dev"; then
        print_color "✅ Frontend: Running" "$GREEN"
        print_color "   http://localhost:5173" "$NC"
    else
        print_color "❌ Frontend: Not running" "$RED"
    fi
    
    echo "─────────────────────────────"
}

# Function to tail logs
tail_logs() {
    print_color "\n📄 Tailing service logs (Ctrl+C to stop)..." "$BLUE"
    print_color "Backend logs:" "$YELLOW"
    tail -n 5 /tmp/backend.log 2>/dev/null || echo "No backend logs yet"
    print_color "\nFrontend logs:" "$YELLOW"
    tail -n 5 /tmp/frontend.log 2>/dev/null || echo "No frontend logs yet"
    print_color "\n📍 For continuous logs, use:" "$BLUE"
    echo "   Backend:  tail -f /tmp/backend.log"
    echo "   Frontend: tail -f /tmp/frontend.log"
}

# Main script logic
case "${1:-start}" in
    start)
        print_color "🐼 Starting Red Pandas Services (DevContainer)" "$GREEN"
        print_color "═══════════════════════════════════════════════" "$GREEN"
        
        # Check MongoDB first
        check_mongodb
        
        # Check if services are already running
        if is_running "uvicorn main:app" || is_running "npm run dev"; then
            print_color "\n⚠️  Some services are already running" "$YELLOW"
            show_status
            print_color "\nUse './start-services.sh restart' to restart all services" "$YELLOW"
            exit 0
        fi
        
        # Start services
        start_backend
        start_frontend
        
        # Show final status
        show_status
        
        print_color "\n✨ All services started successfully!" "$GREEN"
        print_color "Use './start-services.sh status' to check service status" "$BLUE"
        print_color "Use './start-services.sh logs' to view logs" "$BLUE"
        ;;
        
    stop)
        print_color "🛑 Stopping Red Pandas Services" "$YELLOW"
        stop_service "Backend" "uvicorn main:app"
        stop_service "Frontend" "npm run dev"
        print_color "✅ All services stopped" "$GREEN"
        ;;
        
    restart)
        print_color "🔄 Restarting Red Pandas Services" "$YELLOW"
        $0 stop
        sleep 2
        $0 start
        ;;
        
    status)
        show_status
        ;;
        
    logs)
        tail_logs
        ;;
        
    help|--help|-h)
        echo "Red Pandas DevContainer Services Manager"
        echo ""
        echo "Usage: ./start-services.sh [command]"
        echo ""
        echo "Commands:"
        echo "  start    - Start all services (default)"
        echo "  stop     - Stop all services"
        echo "  restart  - Restart all services"
        echo "  status   - Show service status"
        echo "  logs     - Show recent logs"
        echo "  help     - Show this help message"
        echo ""
        echo "Examples:"
        echo "  ./start-services.sh         # Start all services"
        echo "  ./start-services.sh restart # Restart all services"
        echo "  ./start-services.sh status  # Check what's running"
        ;;
        
    *)
        print_color "❌ Unknown command: $1" "$RED"
        echo "Use './start-services.sh help' for usage information"
        exit 1
        ;;
esac