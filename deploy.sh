#!/bin/bash

# PraxisCORE Deployment Script
set -e

echo "🚀 PraxisCORE Deployment Script"
echo "==============================="

# Configuration
IMAGE_NAME="praxiscore"
TAG="${1:-latest}"
CONTAINER_NAME="praxiscore-runtime"
PORT="${2:-8080}"

echo "📋 Configuration:"
echo "   Image: $IMAGE_NAME:$TAG"
echo "   Container: $CONTAINER_NAME"
echo "   Port: $PORT"
echo ""

# Build the application first
echo "🔨 Building PraxisCORE application..."
./mvnw clean package -DskipTests
echo "✅ Application build completed"
echo ""

# Build Docker image
echo "🐳 Building Docker image..."
docker build -t $IMAGE_NAME:$TAG .
echo "✅ Docker image built successfully"
echo ""

# Stop and remove existing container if it exists
echo "🧹 Cleaning up existing container..."
docker stop $CONTAINER_NAME 2>/dev/null || true
docker rm $CONTAINER_NAME 2>/dev/null || true
echo "✅ Cleanup completed"
echo ""

# Run the container
echo "🚀 Starting PraxisCORE container..."
docker run -d \
    --name $CONTAINER_NAME \
    -p $PORT:8080 \
    -v $(pwd)/data:/opt/praxiscore/data \
    $IMAGE_NAME:$TAG

echo "✅ PraxisCORE is now running!"
echo ""
echo "📡 Access Information:"
echo "   Local URL: http://localhost:$PORT"
echo "   Container: $CONTAINER_NAME"
echo ""
echo "🔧 Useful commands:"
echo "   View logs: docker logs $CONTAINER_NAME"
echo "   Stop: docker stop $CONTAINER_NAME"
echo "   Shell access: docker exec -it $CONTAINER_NAME /bin/bash"
echo ""

# Wait a moment and show container status
sleep 2
echo "📊 Container Status:"
docker ps --filter name=$CONTAINER_NAME