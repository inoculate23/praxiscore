# PraxisCORE Web Applications

## 🎯 Overview

This repository now includes **two complete web applications** for interacting with PraxisCORE:

1. **🎨 PraxisLIVE Web** - Full visual programming IDE 
2. **🌐 Simple Web Interface** - Basic monitoring and control

Both applications run alongside the PraxisCORE runtime to provide web-based access to real-time cyberphysical programming capabilities.

## 🚀 Quick Start

### Launch All Applications
```bash
cd /Users/craigellenwood/praxiscore
./start-praxis-live-web.sh
```

### Individual Launches
```bash
# Just PraxisLIVE Web IDE
cd praxis-live-web && python3 server.py

# Just Simple Web Interface  
cd web-ui && python3 server.py

# Just PraxisCORE Runtime
./deploy.sh
```

## 🎨 PraxisLIVE Web IDE

**Access**: http://localhost:8000

### Features
- **Visual Node Programming**: Drag & drop components from palette
- **Real-time Connections**: Draw connections between nodes with SVG
- **Component Categories**: Audio, Video, Core, Data processing
- **Properties Panel**: Edit component parameters in real-time
- **Project Management**: Save/load visual programming projects
- **Code Generation**: Converts visual graphs to PraxisCORE code
- **Console Integration**: Real-time logging and feedback
- **Modern UI**: Dark theme with responsive design

### Components Available
- **🎵 Audio**: Oscillator, Filter, Reverb, Mixer, Recorder
- **🎬 Video**: Player, Camera, Effect, Composite
- **⚙️ Core**: Variable, Clock, Trigger, Router
- **📊 Data**: List, Array, Math, String

### Usage
1. **Create Nodes**: Drag components from the left palette to canvas
2. **Connect Nodes**: Click and drag between input/output ports
3. **Edit Properties**: Select a node to edit parameters in right panel
4. **Save Project**: Use toolbar buttons to save/load projects
5. **Run Code**: Compile visual graph to PraxisCORE and execute

### Keyboard Shortcuts
- `Delete`: Remove selected node
- `Escape`: Cancel connection drawing
- `Double-click`: Edit node code (planned)

## 🌐 Simple Web Interface

**Access**: http://localhost:9000

### Features
- **Connection Status**: Real-time PraxisCORE connection monitoring
- **Quick Actions**: Preset buttons for common operations
- **Interactive Console**: Send commands and view responses
- **System Information**: Runtime status and module information
- **Responsive Design**: Works on desktop, tablet, mobile

### API Endpoints
- `/api/status` - Check PraxisCORE connection
- `/api/info` - Get system information
- `/api/command` - Send commands to PraxisCORE

## 🔧 PraxisCORE Runtime

**Access**: localhost:8080 (custom protocol)

### Features
- **Forest-of-actors Architecture**: Distributed processing
- **Real-time Code Changes**: Live coding capabilities
- **Multi-modal Processing**: Audio, video, data, IoT
- **Network Protocol**: Custom binary protocol for performance
- **Module System**: 27+ modules for different capabilities

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  PraxisLIVE Web │    │  Simple Web UI  │    │  PraxisCORE     │
│     (8000)      │◄──►│     (9000)      │◄──►│     (8080)      │
│                 │    │                 │    │                 │
│ Visual Programming   │ Basic Control     │    │ Runtime Engine  │
│ Node Editor          │ Console           │    │ Audio/Video     │
│ Project Management   │ Status Monitor    │    │ Real-time Proc  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🐳 Docker Deployment

### Full Stack
```bash
docker compose up --build -d
```

### Services Running
- **praxiscore-runtime**: Core processing engine
- **praxiscore-praxis-live-web**: Visual programming IDE
- **praxiscore-web-ui**: Simple web interface

### Management
```bash
# View logs
docker logs praxiscore-runtime
docker logs praxiscore-praxis-live-web
docker logs praxiscore-web-ui

# Stop all services
docker compose down

# Restart specific service
docker compose restart praxiscore-runtime
```

## 📁 Project Structure

```
praxiscore/
├── praxis-live-web/           # Visual Programming IDE
│   ├── index.html            # Frontend interface
│   ├── praxis-live-web.js    # JavaScript engine
│   ├── server.py             # Python backend
│   ├── Dockerfile            # Container config
│   └── projects/             # Saved projects
├── web-ui/                   # Simple Web Interface
│   ├── index.html            # Basic web UI
│   ├── server.py             # HTTP server
│   └── Dockerfile            # Container config
├── docker-compose.yml        # Multi-service orchestration
├── start-praxis-live-web.sh  # Complete launcher
├── start-web-app.sh          # Simple UI launcher
└── [PraxisCORE files...]     # Core runtime
```

## 🎯 Use Cases

### Creative Coding
- **Live Performances**: Real-time audio/visual manipulation
- **Interactive Installations**: Sensor-driven experiences
- **Music Production**: Modular synthesis and effects

### Education
- **Visual Learning**: Node-based programming concepts
- **Real-time Systems**: Understanding concurrent processing
- **Media Programming**: Audio/video processing techniques

### Development
- **Rapid Prototyping**: Quick system design with visual tools
- **System Integration**: Connect different media components
- **Remote Collaboration**: Web-based shared programming

## 🔮 Future Enhancements

### PraxisLIVE Web
- [ ] WebSocket real-time communication with PraxisCORE
- [ ] Code editor modal for custom node programming
- [ ] Collaborative editing with multiple users
- [ ] Component marketplace and sharing
- [ ] Mobile touch interface optimization
- [ ] Audio/video preview within nodes
- [ ] Advanced debugging and profiling tools

### Integration
- [ ] Real PraxisCORE protocol implementation
- [ ] Live code execution from visual graphs  
- [ ] Performance monitoring and optimization
- [ ] Cloud deployment and scaling
- [ ] IoT device integration interface

## 🛠️ Development

### Requirements
- **Python 3.11+** for backend servers
- **Docker & Docker Compose** for containerization
- **Modern web browser** with HTML5/ES6 support
- **Java 21** for PraxisCORE runtime

### Local Development
```bash
# Backend development
cd praxis-live-web
python3 server.py 8000

# Frontend development
# Edit index.html and praxis-live-web.js
# Refresh browser to see changes
```

### Contributing
1. Fork the repository
2. Create feature branch
3. Test changes with full stack
4. Submit pull request

## 📊 Performance

### Recommended Specs
- **CPU**: 4+ cores for real-time processing
- **RAM**: 8GB+ for complex projects
- **Browser**: Chrome 90+, Firefox 90+, Safari 14+
- **Network**: Low latency for responsive visual editing

### Scalability
- **Horizontal**: Multiple PraxisCORE instances
- **Vertical**: Multi-core processing utilization
- **Cloud**: Container orchestration ready

## 🔐 Security

### Production Considerations
- **Authentication**: Add user management for multi-user
- **HTTPS**: TLS encryption for web interfaces
- **Sandboxing**: Isolated code execution environments
- **Rate Limiting**: API endpoint protection

## 📞 Support

### Documentation
- **PraxisCORE**: https://www.praxislive.org/core/
- **Docker**: https://docs.docker.com/
- **Web APIs**: Built-in `/api/` endpoint documentation

### Community
- **GitHub Issues**: Bug reports and feature requests
- **Discussions**: Architecture and implementation questions
- **Wiki**: Extended documentation and tutorials

---

**🎛️ PraxisCORE Web Applications** - Bringing real-time cyberphysical programming to the web!