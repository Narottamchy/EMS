#!/bin/bash

# Email Campaign Management System - Quick Start Script
# This script helps you get started quickly

set -e

echo "🚀 Email Campaign Management System v3.0"
echo "========================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command_exists node; then
    echo -e "${RED}❌ Node.js is not installed${NC}"
    echo "Please install Node.js 18+ from https://nodejs.org"
    exit 1
fi

if ! command_exists npm; then
    echo -e "${RED}❌ npm is not installed${NC}"
    exit 1
fi

if ! command_exists mongod; then
    echo -e "${YELLOW}⚠️  MongoDB is not installed${NC}"
    echo "Please install MongoDB 6+ or use Docker"
fi

if ! command_exists redis-server; then
    echo -e "${YELLOW}⚠️  Redis is not installed${NC}"
    echo "Please install Redis 7+ or use Docker"
fi

echo -e "${GREEN}✅ Prerequisites check complete${NC}"
echo ""

# Ask user for deployment method
echo "How would you like to run the system?"
echo "1) Local development (requires MongoDB and Redis installed)"
echo "2) Docker Compose (recommended)"
echo ""
read -p "Enter your choice (1 or 2): " choice

if [ "$choice" = "2" ]; then
    # Docker Compose deployment
    echo ""
    echo "🐳 Starting with Docker Compose..."
    
    if ! command_exists docker; then
        echo -e "${RED}❌ Docker is not installed${NC}"
        echo "Please install Docker from https://docker.com"
        exit 1
    fi
    
    if ! command_exists docker-compose; then
        echo -e "${RED}❌ Docker Compose is not installed${NC}"
        echo "Please install Docker Compose"
        exit 1
    fi
    
    # Check if .env exists
    if [ ! -f "backend/.env" ]; then
        echo -e "${YELLOW}⚠️  backend/.env not found${NC}"
        echo "Creating from .env.example..."
        cp backend/.env.example backend/.env
        echo -e "${GREEN}✅ Created backend/.env${NC}"
        echo -e "${YELLOW}⚠️  Please edit backend/.env with your AWS credentials${NC}"
        read -p "Press Enter when ready to continue..."
    fi
    
    echo ""
    echo "Building and starting containers..."
    docker-compose up -d --build
    
    echo ""
    echo -e "${GREEN}✅ System started successfully!${NC}"
    echo ""
    echo "📊 Access the application:"
    echo "   Frontend: http://localhost:3000"
    echo "   Backend:  http://localhost:5000"
    echo ""
    echo "🔐 Default login:"
    echo "   Email:    admin@example.com"
    echo "   Password: changeme123"
    echo ""
    echo "📝 View logs:"
    echo "   docker-compose logs -f"
    echo ""
    echo "🛑 Stop the system:"
    echo "   docker-compose down"
    
elif [ "$choice" = "1" ]; then
    # Local development
    echo ""
    echo "💻 Starting local development..."
    
    # Check MongoDB
    if ! pgrep -x "mongod" > /dev/null; then
        echo -e "${YELLOW}⚠️  MongoDB is not running${NC}"
        echo "Starting MongoDB..."
        if command_exists brew; then
            brew services start mongodb-community@6.0
        else
            echo "Please start MongoDB manually"
            exit 1
        fi
    fi
    
    # Check Redis
    if ! pgrep -x "redis-server" > /dev/null; then
        echo -e "${YELLOW}⚠️  Redis is not running${NC}"
        echo "Starting Redis..."
        if command_exists brew; then
            brew services start redis
        else
            echo "Please start Redis manually"
            exit 1
        fi
    fi
    
    # Backend setup
    echo ""
    echo "📦 Setting up backend..."
    cd backend
    
    if [ ! -f ".env" ]; then
        echo "Creating .env file..."
        cp .env.example .env
        echo -e "${GREEN}✅ Created .env${NC}"
        echo -e "${YELLOW}⚠️  Please edit backend/.env with your configuration${NC}"
        read -p "Press Enter when ready to continue..."
    fi
    
    if [ ! -d "node_modules" ]; then
        echo "Installing backend dependencies..."
        npm install
    fi
    
    echo "Starting backend..."
    npm start &
    BACKEND_PID=$!
    
    cd ..
    
    # Frontend setup
    echo ""
    echo "📦 Setting up frontend..."
    cd frontend
    
    if [ ! -d "node_modules" ]; then
        echo "Installing frontend dependencies..."
        npm install
    fi
    
    echo "Starting frontend..."
    npm run dev &
    FRONTEND_PID=$!
    
    cd ..
    
    # Wait a bit for servers to start
    sleep 5
    
    echo ""
    echo -e "${GREEN}✅ System started successfully!${NC}"
    echo ""
    echo "📊 Access the application:"
    echo "   Frontend: http://localhost:5173"
    echo "   Backend:  http://localhost:5000"
    echo ""
    echo "🔐 Default login:"
    echo "   Email:    admin@example.com"
    echo "   Password: changeme123"
    echo ""
    echo "🛑 Stop the system:"
    echo "   Press Ctrl+C"
    echo ""
    
    # Trap Ctrl+C to cleanup
    trap "echo ''; echo 'Stopping servers...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT
    
    # Wait for user to stop
    wait
    
else
    echo -e "${RED}Invalid choice${NC}"
    exit 1
fi
