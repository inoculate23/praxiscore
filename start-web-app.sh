#!/bin/bash

# PraxisCORE Web Application Launcher
echo "🚀 Starting PraxisCORE Web Application..."
echo "======================================"

# Stop any existing containers
echo "🧹 Cleaning up existing containers..."
docker compose down 2>/dev/null || true

# Build and start the application
echo "🔨 Building and starting services..."
docker compose up --build -d

# Wait for services to start
echo "⏳ Waiting for services to start..."
sleep 5

# Check status
echo "📊 Service Status:"
docker ps --filter name=praxiscore

echo ""
echo "✅ PraxisCORE Web Application is ready!"
echo ""
echo "🌐 Web Interface: http://localhost:9000"
echo "🔧 PraxisCORE API: http://localhost:8080"
echo ""
echo "📱 Open your browser and navigate to: http://localhost:9000"
echo ""
echo "🛑 To stop the application, run:"
echo "   docker compose down"
echo ""
echo "📋 Useful commands:"
echo "   docker logs praxiscore-runtime     # View PraxisCORE logs"
echo "   docker logs praxiscore-web-ui      # View Web UI logs"
echo "   docker compose restart             # Restart all services"

# Try to open the web interface
if command -v open >/dev/null 2>&1; then
    echo "🌐 Opening web interface in your browser..."
    open http://localhost:9000
elif command -v xdg-open >/dev/null 2>&1; then
    echo "🌐 Opening web interface in your browser..."
    xdg-open http://localhost:9000
else
    echo "🌐 Please manually open http://localhost:9000 in your browser"
fi