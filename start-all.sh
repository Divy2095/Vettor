#!/bin/bash
# Start all services concurrently
# This script starts Flask ML API, Express Server, and React Client

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ML_DIR="$PROJECT_DIR/ML_Preprocessor_scripts"
SERVER_DIR="$PROJECT_DIR/server"
CLIENT_DIR="$PROJECT_DIR/client"

# Colors
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}Starting all services...${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo ""

# Function to cleanup on exit
cleanup() {
    echo -e "${YELLOW}Shutting down all services...${NC}"
    kill $ML_PID $SERVER_PID $CLIENT_PID 2>/dev/null
    echo -e "${GREEN}All services stopped${NC}"
    exit 0
}

trap cleanup SIGINT SIGTERM

# Start Flask ML API Server
echo -e "${BLUE}[1/3] Starting Flask ML API Server (port 5000)...${NC}"
cd "$ML_DIR"
python ml_api_server.py > /tmp/ml_api.log 2>&1 &
ML_PID=$!
echo -e "${GREEN}✓ Flask server started (PID: $ML_PID)${NC}"
sleep 2

# Start Express Server
echo -e "${BLUE}[2/3] Starting Express Backend Server (port 5000)...${NC}"
cd "$SERVER_DIR"
npm run dev > /tmp/server.log 2>&1 &
SERVER_PID=$!
echo -e "${GREEN}✓ Express server started (PID: $SERVER_PID)${NC}"
sleep 2

# Start React Client
echo -e "${BLUE}[3/3] Starting React Frontend (port 5173)...${NC}"
cd "$CLIENT_DIR"
npm run dev > /tmp/client.log 2>&1 &
CLIENT_PID=$!
echo -e "${GREEN}✓ React client started (PID: $CLIENT_PID)${NC}"
sleep 2

echo ""
echo -e "${GREEN}════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}All services are running!${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${BLUE}Access the application at:${NC} http://localhost:5173"
echo ""
echo -e "${YELLOW}Service Status:${NC}"
echo -e "  Flask ML API:    http://localhost:5000/health"
echo -e "  Express Backend: http://localhost:5000/api"
echo -e "  React Frontend:  http://localhost:5173"
echo ""
echo -e "${YELLOW}Logs:${NC}"
echo -e "  Flask:   tail -f /tmp/ml_api.log"
echo -e "  Server:  tail -f /tmp/server.log"
echo -e "  Client:  tail -f /tmp/client.log"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"
echo ""

# Wait for all processes
wait
