# Docker Setup & Deployment Guide

## Overview

This guide explains how to build, run, and deploy ResumeIQ using Docker containers. All services are orchestrated with Docker Compose.

## Services Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                    Docker Compose Network                       │
│                    (resumeiq-network)                          │
├────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │   Frontend   │  │   Backend    │  │     ML       │           │
│  │  (Nginx)     │  │  (Node.js)   │  │  (Python)    │           │
│  │  Port: 80    │  │  Port: 3000  │  │  Internal    │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
│        │                  │                  │                   │
│        └──────────────────┼──────────────────┘                   │
│                           │                                      │
│                    ┌──────▼──────┐                              │
│                    │   MongoDB    │                              │
│                    │  Port: 27017 │                              │
│                    └──────────────┘                              │
│                                                                  │
│                    ┌──────────────┐                              │
│                    │    Redis     │ (Optional)                  │
│                    │  Port: 6379  │                              │
│                    └──────────────┘                              │
│                                                                  │
└────────────────────────────────────────────────────────────────┘
```

## Prerequisites

### System Requirements
- **Docker**: v20.10.0 or higher
- **Docker Compose**: v2.0.0 or higher
- **Disk Space**: 5GB minimum
- **RAM**: 4GB minimum (8GB recommended)

### Install Docker

#### On Ubuntu/Debian
```bash
# Update packages
sudo apt-get update

# Install Docker
sudo apt-get install -y docker.io docker-compose

# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Verify installation
docker --version
docker-compose --version
```

#### On macOS
```bash
# Install via Homebrew
brew install docker docker-compose

# Or download Docker Desktop from https://www.docker.com/products/docker-desktop

# Verify
docker --version
docker-compose --version
```

#### On Windows
1. Download Docker Desktop from https://www.docker.com/products/docker-desktop
2. Run installer
3. Restart computer
4. Verify in PowerShell:
   ```powershell
   docker --version
   docker-compose --version
   ```

## Quick Start

### 1. Clone Repository
```bash
git clone https://github.com/yourusername/resumeiq.git
cd resumeiq
```

### 2. Configure Environment
```bash
# Copy example environment file
cp server/.env.example server/.env

# Edit with your settings
nano server/.env
# Required:
# - MONGODB_URI=mongodb://admin:changeme@mongo:27017/resumeiq?authSource=admin
# - JWT_SECRET=your-super-secret-key
# - MAIL_USER=your-email@gmail.com
# - MAIL_PASS=your-app-password
```

### 3. Build Images
```bash
# Build all services
docker-compose build

# Or build specific service
docker-compose build backend
docker-compose build frontend
docker-compose build ml_pipeline
```

### 4. Start Services
```bash
# Start all services in detached mode
docker-compose up -d

# View logs
docker-compose logs -f

# Follow specific service logs
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f mongo
```

### 5. Verify Services
```bash
# Check service status
docker-compose ps

# Expected output:
# NAME                 STATUS          PORTS
# resumeiq-mongo       Up (healthy)    27017/tcp
# resumeiq-backend     Up (healthy)    3000/tcp
# resumeiq-frontend    Up (healthy)    80/tcp
# resumeiq-ml-pipeline Up (healthy)
```

### 6. Access Application
- **Frontend**: http://localhost
- **Backend API**: http://localhost:3000/api
- **MongoDB**: mongodb://admin:changeme@localhost:27017

### 7. Stop Services
```bash
# Stop all services
docker-compose stop

# Remove containers
docker-compose down

# Remove volumes (⚠️ deletes data)
docker-compose down -v
```

## Common Commands

### View Logs
```bash
# All services
docker-compose logs

# Follow logs (streaming)
docker-compose logs -f

# Last 100 lines
docker-compose logs --tail=100

# Specific service
docker-compose logs -f backend

# Specific service with timestamps
docker-compose logs -f --timestamps backend
```

### Rebuild Services
```bash
# Rebuild without cache
docker-compose build --no-cache

# Rebuild and restart
docker-compose up -d --build
```

### Execute Commands in Container
```bash
# Access backend shell
docker-compose exec backend sh

# Run npm command
docker-compose exec backend npm run build

# Access MongoDB CLI
docker-compose exec mongo mongosh

# Check Python version
docker-compose exec ml_pipeline python --version

# Run integration tests
docker-compose exec backend npm test
```

### Database Management
```bash
# Backup MongoDB
docker-compose exec mongo mongodump --archive=/backup/dump.archive

# Restore MongoDB
docker-compose exec mongo mongorestore --archive=/backup/dump.archive

# Connect to MongoDB
docker-compose exec mongo mongosh -u admin -p changeme
```

### Troubleshooting
```bash
# View service health
docker-compose ps

# Inspect service configuration
docker-compose config

# Validate compose file
docker-compose config --quiet

# Check resource usage
docker stats

# View network
docker network inspect resumeiq-network

# Prune unused resources
docker system prune -a
```

## Development Workflow

### Local Development with Hot Reload

```bash
# Start services
docker-compose up -d

# Backend changes auto-reload (volumes mounted)
nano server/src/app.js  # Changes auto-reload

# Frontend changes auto-rebuild (volumes mounted)
nano client/src/App.jsx  # Changes hot-reload

# View logs to verify
docker-compose logs -f backend
```

### Environment Variables

Create `.env.dev` for local development:
```bash
NODE_ENV=development
PORT=3000
MONGODB_URI=mongodb://admin:changeme@mongo:27017/resumeiq?authSource=admin
JWT_SECRET=dev-secret-key-only
JWT_EXPIRE=7d
MAIL_HOST=smtp.gmail.com
MAIL_USER=test@example.com
MAIL_PASS=test-password
DEBUG=true
```

Load with:
```bash
export $(cat .env.dev | xargs)
docker-compose up -d
```

## Production Deployment

### Pre-Production Checklist
- [ ] Change MONGODB_URI to MongoDB Atlas (not local)
- [ ] Generate strong JWT_SECRET with: `openssl rand -base64 32`
- [ ] Update MAIL_USER and MAIL_PASS for production email
- [ ] Set NODE_ENV=production in `.env.production`
- [ ] Enable Redis for caching: `docker-compose --profile production up`
- [ ] Setup SSL certificates for HTTPS
- [ ] Configure backup strategy
- [ ] Setup monitoring/logging

### Production Environment File (.env.production)
```bash
NODE_ENV=production
PORT=8080
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/resumeiq
JWT_SECRET=<generate-with-openssl>
JWT_EXPIRE=7d
MAIL_HOST=smtp.gmail.com
MAIL_USER=support@resumeiq.com
MAIL_PASS=<app-specific-password>
AWS_S3_BUCKET=resumeiq-prod
AWS_REGION=us-east-1
REDIS_URL=redis://redis:6379
```

### Start Production Services
```bash
# With Redis
docker-compose --profile production up -d

# View services
docker-compose ps
```

### Scale Services (Optional)
```bash
# Scale backend instances
docker-compose up -d --scale backend=3

# Scale with load balancer (use nginx-proxy or traefik)
```

## Docker Images

### Image Sizes
```bash
# After build
docker images | grep resumeiq
# Frontend: ~50MB (Node.js build + Nginx)
# Backend: ~200MB (Node.js + dependencies)
# ML Pipeline: ~800MB (Python + ML libraries)
# Total: ~1.05GB
```

### Image Details

#### Frontend
- Base: `node:18-alpine` + `nginx:alpine`
- Size: ~50MB
- Port: 80
- Proxy: `/api/*` → backend:3000

#### Backend
- Base: `node:18-alpine`
- Size: ~200MB
- Port: 3000
- Database: MongoDB via network

#### ML Pipeline
- Base: `python:3.9-slim`
- Size: ~800MB
- Models: spacy, sentence-transformers, FAISS
- Volume: Mounts from backend

#### MongoDB
- Base: Official `mongo:7.0` image
- Size: ~200MB
- Port: 27017
- Volume: mongo_data

### Push to Registry
```bash
# Tag images
docker tag resumeiq-backend myrepo/resumeiq-backend:1.0.0
docker tag resumeiq-frontend myrepo/resumeiq-frontend:1.0.0
docker tag resumeiq-ml-pipeline myrepo/resumeiq-ml-pipeline:1.0.0

# Login to registry
docker login

# Push images
docker push myrepo/resumeiq-backend:1.0.0
docker push myrepo/resumeiq-frontend:1.0.0
docker push myrepo/resumeiq-ml-pipeline:1.0.0
```

## Networking

All services communicate via the `resumeiq-network` bridge network.

### Service DNS Names
- `mongo:27017` - MongoDB connection from backend
- `backend:3000` - Backend API from frontend
- `frontend:80` - Frontend from browser
- `redis:6379` - Redis cache (optional)

### Port Mapping
```
Host → Container
80 → frontend (Nginx)
3000 → backend (Node.js)
27017 → mongo (MongoDB)
6379 → redis (Redis, optional)
```

### Cross-Service Communication
```javascript
// Backend connecting to MongoDB
const uri = "mongodb://admin:changeme@mongo:27017/resumeiq?authSource=admin";

// Frontend connecting to Backend
const apiUrl = "http://localhost:3000/api"; // From browser
// OR from within network
const apiUrl = "http://backend:3000/api";   // From container
```

## Volumes and Persistence

### Mounted Volumes
```yaml
volumes:
  mongo_data:          # MongoDB data persistence
  mongo_config:        # MongoDB config persistence
  redis_data:          # Redis data persistence
  ./server/src:        # Backend source (hot reload)
  ./server/uploads:    # Resume uploads
  ./ML_Preprocessor_scripts:  # ML pipeline code
```

### Backup Strategy
```bash
# Backup MongoDB data
docker run --rm \
  -v resumeiq_mongo_data:/data \
  -v $(pwd)/backups:/backups \
  mongo:7.0 \
  mongodump --archive=/backups/mongo-$(date +%Y%m%d).archive

# Restore from backup
docker run --rm \
  -v resumeiq_mongo_data:/data \
  -v $(pwd)/backups:/backups \
  mongo:7.0 \
  mongorestore --archive=/backups/mongo-20240501.archive
```

## Monitoring & Logging

### Docker Stats
```bash
# Real-time resource usage
docker stats

# Pretty format
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}"
```

### Log Management
```bash
# View logs with timestamps
docker-compose logs --timestamps

# Export logs to file
docker-compose logs > logs.txt

# Setup log rotation
# Edit docker-compose.yml:
# logging:
#   driver: "json-file"
#   options:
#     max-size: "10m"
#     max-file: "3"
```

### Health Checks
```bash
# View health status
docker inspect resumeiq-mongo --format='{{json .State.Health}}'

# All services health
docker-compose ps --format "table {{.Names}}\t{{.State}}"
```

## Troubleshooting

### Services won't start
```bash
# Check logs
docker-compose logs -f

# Remove containers and volumes
docker-compose down -v

# Rebuild
docker-compose build --no-cache

# Restart
docker-compose up -d
```

### Port already in use
```bash
# Find process using port
lsof -i :3000  # or :80, :27017

# Stop process
kill -9 <PID>

# Or change port in docker-compose.yml
ports:
  - "3001:3000"  # Host:Container
```

### MongoDB connection fails
```bash
# Check MongoDB logs
docker-compose logs mongo

# Verify connection string
docker-compose exec backend node -e "
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI).then(() => console.log('Connected')).catch(e => console.error(e));
"

# Test from MongoDB container
docker-compose exec mongo mongosh -u admin -p changeme --authenticationDatabase admin
```

### Out of disk space
```bash
# Clean up Docker
docker system prune -a

# Check volume sizes
du -sh /var/lib/docker/volumes/*/

# Remove specific volume
docker volume rm resumeiq_mongo_data
```

### Memory/CPU issues
```bash
# Increase Docker memory limit
# Edit Docker Desktop preferences or:
# ~/.config/docker/daemon.json:
{
  "memory": 4294967296,
  "cpus": 2.0
}

# Restart Docker
sudo systemctl restart docker
```

## Performance Optimization

### Build Optimization
```bash
# Use BuildKit for faster builds
DOCKER_BUILDKIT=1 docker-compose build

# Multi-stage builds (already in Dockerfile)
# Reduces final image size
```

### Runtime Optimization
```dockerfile
# Use Alpine Linux
FROM node:18-alpine
FROM python:3.9-slim

# Use .dockerignore
# Exclude node_modules, build artifacts, etc.

# Multi-stage builds
FROM node:18 AS build
RUN npm ci
RUN npm run build

FROM node:18-alpine
COPY --from=build /app/dist ./dist
```

### Caching Strategy
```bash
# Docker layer caching
# Changes invalidate only affected layers

# Copy package files first (cache npm install)
COPY package*.json ./
RUN npm ci

# Then copy source code
COPY . .
RUN npm run build
```

## CI/CD Integration

### GitHub Actions Example
```yaml
name: Build and Push Docker Images

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Build images
        run: docker-compose build
      
      - name: Push to registry
        run: |
          docker login -u ${{ secrets.DOCKER_USER }} -p ${{ secrets.DOCKER_PASS }}
          docker tag resumeiq-backend ${{ secrets.DOCKER_REPO }}/backend:latest
          docker push ${{ secrets.DOCKER_REPO }}/backend:latest
```

## Next Steps

1. ✅ Complete: Docker configuration
2. ⏳ TODO: Setup Kubernetes deployment (optional)
3. ⏳ TODO: Configure CI/CD pipeline
4. ⏳ TODO: Setup monitoring (Prometheus, Grafana)
5. ⏳ TODO: Production deployment to cloud

---

**Last Updated**: May 1, 2024  
**Version**: 1.0.0
