#!/bin/bash
# Quick Start Script for Resume-based AI Interview Question Finder
# This script sets up and starts all components of the application

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ML_DIR="$PROJECT_DIR/ML_Preprocessor_scripts"
SERVER_DIR="$PROJECT_DIR/server"
CLIENT_DIR="$PROJECT_DIR/client"

echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Resume-based AI Interview Question Finder${NC}"
echo -e "${BLUE}Quick Start Script${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo ""

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to wait for service
wait_for_service() {
    local host=$1
    local port=$2
    local service=$3
    local max_attempts=30
    local attempt=0

    echo -e "${YELLOW}Waiting for $service to be ready...${NC}"
    
    while [ $attempt -lt $max_attempts ]; do
        if nc -z $host $port 2>/dev/null; then
            echo -e "${GREEN}✓ $service is ready!${NC}"
            return 0
        fi
        attempt=$((attempt + 1))
        sleep 1
    done
    
    echo -e "${RED}✗ $service failed to start${NC}"
    return 1
}

# Check prerequisites
echo -e "${BLUE}[1/5] Checking prerequisites...${NC}"

if ! command_exists python3; then
    echo -e "${RED}✗ Python 3 not found. Please install Python 3.9+${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Python 3 found: $(python3 --version)${NC}"

if ! command_exists node; then
    echo -e "${RED}✗ Node.js not found. Please install Node.js 18+${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Node.js found: $(node --version)${NC}"

if ! command_exists npm; then
    echo -e "${RED}✗ npm not found. Please install npm${NC}"
    exit 1
fi
echo -e "${GREEN}✓ npm found: $(npm --version)${NC}"

# Install Python dependencies
echo ""
echo -e "${BLUE}[2/5] Installing Python dependencies...${NC}"
cd "$ML_DIR"
if [ ! -f "requirements.txt" ]; then
    echo -e "${RED}✗ requirements.txt not found in $ML_DIR${NC}"
    exit 1
fi

pip install --upgrade pip > /dev/null 2>&1
pip install -q -r requirements.txt

echo -e "${GREEN}✓ Python dependencies installed${NC}"

# Verify ML data files
echo ""
echo -e "${BLUE}[3/5] Verifying ML data files...${NC}"

if [ ! -f "$ML_DIR/data/questions.json" ]; then
    echo -e "${RED}✗ questions.json not found. Cannot proceed.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ questions.json found${NC}"

if [ ! -f "$ML_DIR/data/questions.index" ]; then
    echo -e "${RED}✗ questions.index not found. Attempting to rebuild...${NC}"
    python3 "$ML_DIR/scripts/build_index.py" || {
        echo -e "${RED}✗ Failed to build FAISS index${NC}"
        exit 1
    }
fi
echo -e "${GREEN}✓ FAISS index found${NC}"

# Install Node.js dependencies
echo ""
echo -e "${BLUE}[4/5] Installing Node.js dependencies...${NC}"

# Server dependencies
echo -e "${YELLOW}Installing server dependencies...${NC}"
cd "$SERVER_DIR"
npm install > /dev/null 2>&1
echo -e "${GREEN}✓ Server dependencies installed${NC}"

# Client dependencies
echo -e "${YELLOW}Installing client dependencies...${NC}"
cd "$CLIENT_DIR"
npm install > /dev/null 2>&1
echo -e "${GREEN}✓ Client dependencies installed${NC}"

# Summary
echo ""
echo -e "${BLUE}[5/5] Setup Complete!${NC}"
echo ""
echo -e "${GREEN}════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}Ready to start the application!${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════════${NC}"
echo ""

# Display startup instructions
cat << EOF
To start the application, open three terminals and run:

${YELLOW}Terminal 1 - Flask ML API Server:${NC}
  cd $ML_DIR
  python ml_api_server.py

${YELLOW}Terminal 2 - Node.js Backend Server:${NC}
  cd $SERVER_DIR
  npm run dev

${YELLOW}Terminal 3 - React Frontend:${NC}
  cd $CLIENT_DIR
  npm run dev

Then open: ${BLUE}http://localhost:5173${NC}

${YELLOW}OR${NC} run all services in one command:

  ./scripts/start-all.sh

For troubleshooting, see: ${BLUE}ML_INTEGRATION_GUIDE.md${NC}
EOF

echo ""
