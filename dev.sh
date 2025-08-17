#!/bin/bash

# Red Pandas Docker Development Environment
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_color() {
    echo -e "${2}${1}${NC}"
}

# Function to check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        print_color "❌ Docker is not running. Please start Docker first." "$RED"
        exit 1
    fi
    print_color "✅ Docker is running" "$GREEN"
}

# Function to check .env file
check_env() {
    if [ ! -f "backend/.env" ]; then
        print_color "⚠️  No .env file found. Creating from example..." "$YELLOW"
        if [ -f "backend/.env.example" ]; then
            cp backend/.env.example backend/.env
            print_color "📝 Created backend/.env - Please add your OPENAI_API_KEY" "$YELLOW"
        else
            print_color "❌ No .env.example found!" "$RED"
            exit 1
        fi
    else
        print_color "✅ .env file exists" "$GREEN"
    fi
}

# Main script
case "$1" in
    start)
        print_color "🐼 Starting Red Pandas Development Environment..." "$GREEN"
        check_docker
        check_env
        
        print_color "🚀 Building and starting containers..." "$YELLOW"
        docker-compose up --build
        ;;
        
    stop)
        print_color "🛑 Stopping Red Pandas..." "$YELLOW"
        docker-compose down
        ;;
        
    restart)
        print_color "🔄 Restarting Red Pandas..." "$YELLOW"
        docker-compose restart
        ;;
        
    logs)
        service=${2:-}
        if [ -z "$service" ]; then
            docker-compose logs -f
        else
            docker-compose logs -f $service
        fi
        ;;
        
    shell)
        service=${2:-backend}
        print_color "🐚 Opening shell in $service container..." "$YELLOW"
        docker-compose exec $service sh
        ;;
        
    clean)
        print_color "🧹 Cleaning up..." "$YELLOW"
        docker-compose down -v
        print_color "✅ Cleaned up volumes and containers" "$GREEN"
        ;;
        
    rebuild)
        print_color "🔨 Rebuilding containers..." "$YELLOW"
        docker-compose build --no-cache
        docker-compose up
        ;;
        
    status)
        print_color "📊 Container Status:" "$GREEN"
        docker-compose ps
        ;;
        
    test)
        print_color "🧪 Running backend tests..." "$YELLOW"
        docker-compose exec backend pytest
        ;;
        
    *)
        echo "Red Pandas Docker Development Environment"
        echo ""
        echo "Usage: ./dev.sh [command] [options]"
        echo ""
        echo "Commands:"
        echo "  start       - Start all services"
        echo "  stop        - Stop all services"
        echo "  restart     - Restart all services"
        echo "  logs [svc]  - Show logs (optionally for specific service)"
        echo "  shell [svc] - Open shell in container (default: backend)"
        echo "  clean       - Remove containers and volumes"
        echo "  rebuild     - Rebuild containers from scratch"
        echo "  status      - Show container status"
        echo "  test        - Run backend tests"
        echo ""
        echo "Services: mongodb, backend, frontend"
        echo ""
        echo "Examples:"
        echo "  ./dev.sh start           # Start development environment"
        echo "  ./dev.sh logs backend    # Show backend logs"
        echo "  ./dev.sh shell frontend  # Open shell in frontend container"
        ;;
esac