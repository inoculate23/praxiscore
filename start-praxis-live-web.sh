#!/bin/bash

# PraxisLIVE Web - Visual Programming IDE Launcher
echo "🎛️ Starting PraxisLIVE Web - Visual Programming IDE..."
echo "=================================================="

# Stop any existing containers
echo "🧹 Cleaning up existing containers..."
docker compose down 2>/dev/null || true

# Build and start all services
echo "🔨 Building and starting services..."
docker compose up --build -d

# Wait for services to start
echo "⏳ Waiting for services to start..."
sleep 8

# Check status
echo "📊 Service Status:"
docker ps --filter name=praxiscore

echo ""
echo "✅ PraxisLIVE Web Application Suite is ready!"
echo ""
echo "🎨 PraxisLIVE Web IDE: http://localhost:8000"
echo "🌐 Simple Web Interface: http://localhost:9000" 
echo "🔧 PraxisCORE Runtime: localhost:8080"
echo ""
echo "🎯 Main Features:"
echo "   • Visual node-based programming"
echo "   • Real-time audio/video processing"
echo "   • Component drag & drop"
echo "   • Project save/load"
echo "   • Live connection to PraxisCORE"
echo ""
echo "📱 Open your browser and navigate to: http://localhost:8000"
echo ""
echo "🛑 To stop all services:"
echo "   docker compose down"
echo ""
echo "📋 Useful commands:"
echo "   docker logs praxiscore-runtime              # PraxisCORE logs"
echo "   docker logs praxiscore-praxis-live-web      # Visual IDE logs"
echo "   docker logs praxiscore-web-ui               # Simple UI logs"
echo "   docker compose restart                      # Restart all"

# Try to open the PraxisLIVE Web IDE
if command -v open >/dev/null 2>&1; then
    echo ""
    echo "🎨 Opening PraxisLIVE Web IDE in your browser..."
    open http://localhost:8000
elif command -v xdg-open >/dev/null 2>&1; then
    echo ""
    echo "🎨 Opening PraxisLIVE Web IDE in your browser..."
    xdg-open http://localhost:8000
else
    echo ""
    echo "🎨 Please manually open http://localhost:8000 in your browser"
fi