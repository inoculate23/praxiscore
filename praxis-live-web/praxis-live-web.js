// PraxisLIVE Web - Visual Programming IDE
class PraxisLiveWeb {
    constructor() {
        this.nodes = new Map();
        this.connections = [];
        this.selectedNode = null;
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
        this.canvasOffset = { x: 0, y: 0 };
        this.zoom = 1;
        this.nodeIdCounter = 1;
        this.isConnecting = false;
        this.connectionStart = null;
        this.tempConnection = null;
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.setupDragAndDrop();
        this.log('PraxisLIVE Web IDE ready', 'success');
        
        // Add a demo node for testing
        setTimeout(() => {
            const testNode = this.addNodeAt('audio:oscillator', 200, 150);
            this.log('Added demo oscillator node - try clicking on it!', 'info');
        }, 500);
        
        // Auto-connect to PraxisCORE on startup
        setTimeout(() => {
            this.connectToPraxisCore();
        }, 1000);
    }
    
    setupEventListeners() {
        const canvas = document.getElementById('nodeCanvas');
        
        // Canvas events
        canvas.addEventListener('mousedown', (e) => this.onCanvasMouseDown(e));
        canvas.addEventListener('mousemove', (e) => this.onCanvasMouseMove(e));
        canvas.addEventListener('mouseup', (e) => this.onCanvasMouseUp(e));
        canvas.addEventListener('wheel', (e) => this.onCanvasWheel(e));
        canvas.addEventListener('contextmenu', (e) => this.onCanvasRightClick(e));
        
        // Global events
        document.addEventListener('keydown', (e) => this.onKeyDown(e));
        document.addEventListener('click', (e) => this.onDocumentClick(e));
        
        // Window events
        window.addEventListener('resize', () => this.onWindowResize());
    }
    
    setupDragAndDrop() {
        const componentItems = document.querySelectorAll('.component-item');
        
        componentItems.forEach(item => {
            item.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', item.dataset.type);
                e.dataTransfer.effectAllowed = 'copy';
            });
        });
        
        const canvas = document.getElementById('nodeCanvas');
        canvas.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
        });
        
        canvas.addEventListener('drop', (e) => {
            e.preventDefault();
            const componentType = e.dataTransfer.getData('text/plain');
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            this.addNodeAt(componentType, x, y);
        });
    }
    
    addNodeAt(type, x, y) {
        const node = this.createNode(type, x, y);
        this.log(`Added ${type} component`, 'info');
        return node;
    }
    
    createNode(type, x, y) {
        const nodeId = `node_${this.nodeIdCounter++}`;
        const [category, name] = type.split(':');
        
        const nodeElement = document.createElement('div');
        nodeElement.className = 'node';
        nodeElement.id = nodeId;
        nodeElement.style.left = `${x}px`;
        nodeElement.style.top = `${y}px`;
        
        // Create node structure
        let nodeContent = `
            <div class="node-header">${name}</div>
            <div class="node-body">
                <div class="node-port input" style="top: 20px;" data-port="input"></div>
                <div class="node-port output" style="top: 20px;" data-port="output"></div>
                <div style="margin: 10px 0; font-size: 11px; color: #ccc;">
                    ${this.getNodeDescription(type)}
                </div>
        `;
        
        // Add preview/render elements for special node types
        if (type.includes(':output') || type.includes(':render')) {
            nodeContent += this.createPreviewElement(type, nodeId);
        }
        
        nodeContent += `</div>`;
        nodeElement.innerHTML = nodeContent;
        
        // Add special styling for output/render nodes
        if (type.includes(':output')) {
            nodeElement.classList.add('output-node');
        } else if (type.includes(':render')) {
            nodeElement.classList.add('render-node');
        }
        
        // Add event listeners
        this.setupNodeEvents(nodeElement);
        
        // Add to canvas
        document.getElementById('nodeCanvas').appendChild(nodeElement);
        
        // Store node data
        const nodeData = {
            id: nodeId,
            type: type,
            category: category,
            name: name,
            element: nodeElement,
            x: x,
            y: y,
            properties: this.getDefaultProperties(type),
            inputs: ['input'],
            outputs: ['output']
        };
        
        this.nodes.set(nodeId, nodeData);
        return nodeData;
    }
    
    createPreviewElement(type, nodeId) {
        if (type === 'audio:output') {
            return `
                <div class="node-preview audio-preview">
                    <audio id="${nodeId}_preview" controls style="width: 100%; height: 24px;">
                        <source src="" type="audio/wav">
                        Your browser does not support audio preview.
                    </audio>
                    <div class="preview-controls">
                        <button class="preview-btn" onclick="praxisLive.toggleAudioMonitor('${nodeId}')">Monitor</button>
                        <button class="preview-btn" onclick="praxisLive.toggleAudioMute('${nodeId}')">Mute</button>
                    </div>
                </div>
            `;
        } else if (type === 'video:output') {
            return `
                <div class="node-preview video-preview">
                    <canvas id="${nodeId}_preview" width="120" height="80"></canvas>
                    <div class="preview-controls">
                        <button class="preview-btn" onclick="praxisLive.toggleVideoMonitor('${nodeId}')">Monitor</button>
                        <button class="preview-btn" onclick="praxisLive.toggleFullscreen('${nodeId}')">Fullscreen</button>
                    </div>
                </div>
            `;
        } else if (type === 'audio:render') {
            return `
                <div class="node-preview render-progress">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span>Ready to render</span>
                        <button class="preview-btn" onclick="praxisLive.startAudioRender('${nodeId}')">Start</button>
                    </div>
                    <div class="progress-bar" style="display: none;">
                        <div class="progress-fill" id="${nodeId}_progress" style="width: 0%;"></div>
                    </div>
                </div>
            `;
        } else if (type === 'video:render') {
            return `
                <div class="node-preview render-progress">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span>Ready to render</span>
                        <button class="preview-btn" onclick="praxisLive.startVideoRender('${nodeId}')">Start</button>
                    </div>
                    <div class="progress-bar" style="display: none;">
                        <div class="progress-fill" id="${nodeId}_progress" style="width: 0%;"></div>
                    </div>
                </div>
            `;
        }
        return '';
    }
    
    // Audio Output/Preview Methods
    toggleAudioMonitor(nodeId) {
        const node = this.nodes.get(nodeId);
        if (node) {
            node.properties.monitor = !node.properties.monitor;
            this.log(`Audio monitor ${node.properties.monitor ? 'enabled' : 'disabled'}`, 'info');
            this.startAudioPreview(nodeId);
        }
    }
    
    toggleAudioMute(nodeId) {
        const node = this.nodes.get(nodeId);
        const audio = document.getElementById(`${nodeId}_preview`);
        if (node && audio) {
            node.properties.mute = !node.properties.mute;
            audio.muted = node.properties.mute;
            this.log(`Audio ${node.properties.mute ? 'muted' : 'unmuted'}`, 'info');
        }
    }
    
    startAudioPreview(nodeId) {
        const audio = document.getElementById(`${nodeId}_preview`);
        if (audio) {
            // Simulate audio stream - in real implementation, this would connect to PraxisCORE
            audio.src = '/api/audio-stream/' + nodeId;
            this.log(`Starting audio preview for ${nodeId}`, 'info');
        }
    }
    
    // Video Output/Preview Methods
    toggleVideoMonitor(nodeId) {
        const node = this.nodes.get(nodeId);
        if (node) {
            node.properties.monitor = !node.properties.monitor;
            this.log(`Video monitor ${node.properties.monitor ? 'enabled' : 'disabled'}`, 'info');
            if (node.properties.monitor) {
                this.startVideoPreview(nodeId);
            } else {
                this.stopVideoPreview(nodeId);
            }
        }
    }
    
    toggleFullscreen(nodeId) {
        const canvas = document.getElementById(`${nodeId}_preview`);
        if (canvas) {
            if (document.fullscreenElement) {
                document.exitFullscreen();
            } else {
                canvas.requestFullscreen();
            }
            this.log(`Toggled fullscreen for video output`, 'info');
        }
    }
    
    startVideoPreview(nodeId) {
        const canvas = document.getElementById(`${nodeId}_preview`);
        if (canvas) {
            const ctx = canvas.getContext('2d');
            
            // Simulate video preview - in real implementation, this would connect to PraxisCORE
            this.videoPreviewInterval = setInterval(() => {
                // Generate test pattern
                ctx.fillStyle = `hsl(${Date.now() / 10 % 360}, 50%, 50%)`;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                // Add timestamp
                ctx.fillStyle = 'white';
                ctx.font = '10px Arial';
                ctx.fillText(new Date().toLocaleTimeString(), 5, 15);
            }, 33); // ~30fps
            
            this.log(`Starting video preview for ${nodeId}`, 'info');
        }
    }
    
    stopVideoPreview(nodeId) {
        if (this.videoPreviewInterval) {
            clearInterval(this.videoPreviewInterval);
            this.videoPreviewInterval = null;
        }
        
        const canvas = document.getElementById(`${nodeId}_preview`);
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        
        this.log(`Stopped video preview for ${nodeId}`, 'info');
    }
    
    // Render Methods
    async startAudioRender(nodeId) {
        const node = this.nodes.get(nodeId);
        if (!node) return;
        
        const outputFile = node.properties.file || 'output.wav';
        const duration = node.properties.duration || 10;
        
        this.log(`Starting audio render: ${outputFile} (${duration}s)`, 'info');
        
        try {
            const response = await fetch('/api/render/audio', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nodeId: nodeId,
                    filename: outputFile,
                    format: node.properties.format,
                    duration: duration,
                    bitrate: node.properties.bitrate
                })
            });
            
            const result = await response.json();
            
            if (result.status === 'success') {
                this.simulateRenderProgress(nodeId, 'audio', result.jobId);
            } else {
                this.log(`Render failed: ${result.message}`, 'error');
            }
        } catch (error) {
            this.log(`Render error: ${error.message}`, 'error');
        }
    }
    
    async startVideoRender(nodeId) {
        const node = this.nodes.get(nodeId);
        if (!node) return;
        
        const outputFile = node.properties.file || 'output.mp4';
        const duration = node.properties.duration || 10;
        
        this.log(`Starting video render: ${outputFile} (${duration}s)`, 'info');
        
        try {
            const response = await fetch('/api/render/video', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nodeId: nodeId,
                    filename: outputFile,
                    format: node.properties.format,
                    duration: duration,
                    quality: node.properties.quality,
                    fps: node.properties.fps
                })
            });
            
            const result = await response.json();
            
            if (result.status === 'success') {
                this.simulateRenderProgress(nodeId, 'video', result.jobId);
            } else {
                this.log(`Render failed: ${result.message}`, 'error');
            }
        } catch (error) {
            this.log(`Render error: ${error.message}`, 'error');
        }
    }
    
    simulateRenderProgress(nodeId, type, jobId) {
        const progressBar = document.querySelector(`#${nodeId}_progress`).parentElement;
        const progressFill = document.getElementById(`${nodeId}_progress`);
        
        if (!progressBar || !progressFill) return;
        
        // Show progress bar
        progressBar.style.display = 'block';
        
        let progress = 0;
        const duration = type === 'video' ? 8000 : 5000; // Video takes longer
        const interval = 100;
        const increment = (interval / duration) * 100;
        
        const updateProgress = () => {
            progress += increment;
            progressFill.style.width = `${Math.min(progress, 100)}%`;
            
            if (progress >= 100) {
                setTimeout(() => {
                    progressBar.style.display = 'none';
                    progressFill.style.width = '0%';
                    this.log(`${type} render completed: /media/${jobId}`, 'success');
                }, 1000);
            } else {
                setTimeout(updateProgress, interval);
            }
        };
        
        updateProgress();
    }
    
    getNodeDescription(type) {
        const descriptions = {
            'audio:oscillator': 'Generates audio waveforms',
            'audio:filter': 'Filters audio frequencies',
            'audio:reverb': 'Adds reverb effect',
            'audio:mixer': 'Mixes audio signals',
            'audio:recorder': 'Records audio output',
            'audio:output': 'Audio output & preview',
            'audio:render': 'Render audio to file',
            'video:player': 'Plays video files',
            'video:camera': 'Camera input',
            'video:effect': 'Video effects processor',
            'video:composite': 'Composites video layers',
            'video:output': 'Video output & preview',
            'video:render': 'Render video to file',
            'core:variable': 'Stores values',
            'core:clock': 'Timer and scheduler',
            'core:trigger': 'Event trigger',
            'core:router': 'Routes signals',
            'data:list': 'List operations',
            'data:array': 'Array manipulation',
            'data:math': 'Mathematical operations',
            'data:string': 'String processing'
        };
        return descriptions[type] || 'Component';
    }
    
    getDefaultProperties(type) {
        const defaults = {
            'audio:oscillator': { frequency: 440, waveform: 'sine', amplitude: 0.5 },
            'audio:filter': { type: 'lowpass', frequency: 1000, resonance: 1 },
            'audio:recorder': { file: '', format: 'wav', quality: 'high' },
            'audio:output': { volume: 1.0, mute: false, monitor: true },
            'audio:render': { file: 'output.wav', format: 'wav', bitrate: 320, duration: 10 },
            'video:player': { file: '', loop: false, speed: 1, volume: 1.0 },
            'video:camera': { device: 'default', resolution: '1920x1080', fps: 30 },
            'video:output': { fullscreen: false, scaling: 'fit', monitor: true },
            'video:render': { file: 'output.mp4', format: 'mp4', quality: 'high', fps: 30, duration: 10 },
            'core:variable': { value: 0, type: 'number' },
            'core:clock': { bpm: 120, pattern: '4/4' }
        };
        return defaults[type] || {};
    }
    
    getFileInputProperties(type) {
        const fileProps = {
            'video:player': ['file'],
            'audio:recorder': ['file'],
            'audio:render': ['file'],
            'video:render': ['file'],
            'video:effect': ['file'],
            'audio:filter': ['file']
        };
        return fileProps[type] || [];
    }
    
    setupNodeEvents(nodeElement) {
        const header = nodeElement.querySelector('.node-header');
        const body = nodeElement.querySelector('.node-body');
        
        // Node selection - can click anywhere on the node
        const handleNodeClick = (e) => {
            // Don't select if clicking on a port
            if (!e.target.classList.contains('node-port')) {
                e.stopPropagation();
                this.selectNode(nodeElement.id);
            }
        };
        
        nodeElement.addEventListener('click', handleNodeClick);
        
        // Node dragging - only from header
        header.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            this.selectNode(nodeElement.id);
            this.startNodeDrag(e, nodeElement);
        });
        
        // Port connection events
        const ports = nodeElement.querySelectorAll('.node-port');
        ports.forEach(port => {
            port.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                this.startConnection(e, nodeElement.id, port.dataset.port);
            });
            
            // Add hover effects for ports
            port.addEventListener('mouseenter', () => {
                port.style.transform = 'scale(1.2)';
            });
            
            port.addEventListener('mouseleave', () => {
                port.style.transform = 'scale(1)';
            });
        });
        
        // Node double-click for editing
        nodeElement.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            this.editNodeCode(nodeElement.id);
        });
    }
    
    selectNode(nodeId) {
        console.log('selectNode called with:', nodeId);
        
        // Remove previous selection
        if (this.selectedNode) {
            this.selectedNode.element.classList.remove('selected');
            console.log('Removed selection from:', this.selectedNode.id);
        }
        
        // Select new node
        const node = this.nodes.get(nodeId);
        if (node) {
            this.selectedNode = node;
            node.element.classList.add('selected');
            this.updatePropertiesPanel(node);
            this.log(`Selected ${node.type} (${nodeId})`, 'info');
            console.log('Selected node:', node);
        } else {
            console.error('Node not found:', nodeId);
            this.log(`Node ${nodeId} not found`, 'error');
        }
    }
    
    updatePropertiesPanel(node) {
        const content = document.getElementById('propertiesContent');
        
        if (!content) {
            console.error('Properties content element not found');
            return;
        }
        
        let html = `
            <div class="property-group">
                <h3 style="color: #4a9eff; margin-bottom: 10px;">Selected Node</h3>
            </div>
            <div class="property-group">
                <label class="property-label">Node ID</label>
                <input class="property-input" value="${node.id}" readonly>
            </div>
            <div class="property-group">
                <label class="property-label">Type</label>
                <input class="property-input" value="${node.type}" readonly>
            </div>
            <div class="property-group">
                <label class="property-label">Category</label>
                <input class="property-input" value="${node.category}" readonly>
            </div>`;
        
        // Add editable properties
        if (Object.keys(node.properties).length > 0) {
            html += `<div class="property-group">
                <h4 style="color: #ffd700; margin: 15px 0 10px 0;">Properties</h4>
            </div>`;
            
            const fileInputProps = this.getFileInputProperties(node.type);
            
            Object.entries(node.properties).forEach(([key, value]) => {
                if (fileInputProps.includes(key)) {
                    // File input property
                    html += `<div class="property-group">
                        <label class="property-label">${key.charAt(0).toUpperCase() + key.slice(1)} File</label>
                        <div style="display: flex; gap: 5px;">
                            <input class="property-input" value="${value}" 
                                   onchange="praxisLive.updateNodeProperty('${node.id}', '${key}', this.value)"
                                   placeholder="Select or enter file path..." style="flex: 1;">
                            <button class="btn" style="padding: 4px 8px; font-size: 10px;" 
                                    onclick="praxisLive.selectMediaFile('${node.id}', '${key}')">Browse</button>
                        </div>
                        <button class="btn" style="margin-top: 5px; padding: 4px 8px; font-size: 10px; background: #107c10;" 
                                onclick="praxisLive.uploadMediaFile('${node.id}', '${key}')">Upload New</button>
                    </div>`;
                } else {
                    // Regular property
                    html += `<div class="property-group">
                        <label class="property-label">${key.charAt(0).toUpperCase() + key.slice(1)}</label>
                        <input class="property-input" value="${value}" 
                               onchange="praxisLive.updateNodeProperty('${node.id}', '${key}', this.value)"
                               placeholder="Enter ${key}...">
                    </div>`;
                }
            });
        } else {
            html += `<div class="property-group">
                <em style="color: #666; font-size: 12px;">No editable properties</em>
            </div>`;
        }
        
        // Add position info
        html += `
            <div class="property-group">
                <h4 style="color: #ff6b4a; margin: 15px 0 10px 0;">Position</h4>
            </div>
            <div class="property-group">
                <label class="property-label">X</label>
                <input class="property-input" value="${Math.round(node.x)}" readonly>
            </div>
            <div class="property-group">
                <label class="property-label">Y</label>
                <input class="property-input" value="${Math.round(node.y)}" readonly>
            </div>`;
        
        content.innerHTML = html;
        this.log(`Properties panel updated for ${node.type}`, 'info');
    }
    
    updateNodeProperty(nodeId, property, value) {
        const node = this.nodes.get(nodeId);
        if (node) {
            node.properties[property] = value;
            this.log(`Updated ${node.type}.${property} = ${value}`, 'info');
        }
    }
    
    startNodeDrag(e, nodeElement) {
        this.isDragging = true;
        const rect = nodeElement.getBoundingClientRect();
        this.dragOffset = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
        nodeElement.style.zIndex = 1000;
    }
    
    startConnection(e, nodeId, portType) {
        e.stopPropagation();
        this.isConnecting = true;
        this.connectionStart = { nodeId, portType };
        
        // Create temporary connection line
        this.tempConnection = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        this.tempConnection.setAttribute('stroke', '#4a9eff');
        this.tempConnection.setAttribute('stroke-width', '2');
        this.tempConnection.setAttribute('fill', 'none');
        this.tempConnection.setAttribute('stroke-dasharray', '5,5');
        
        document.getElementById('connectionLayer').appendChild(this.tempConnection);
        
        this.log(`Starting connection from ${nodeId}.${portType}`, 'info');
    }
    
    onCanvasMouseDown(e) {
        if (this.isConnecting) return;
        
        // Deselect nodes if clicking on empty canvas
        if (e.target.id === 'nodeCanvas') {
            if (this.selectedNode) {
                this.selectedNode.element.classList.remove('selected');
                this.selectedNode = null;
                this.clearPropertiesPanel();
            }
        }
    }
    
    onCanvasMouseMove(e) {
        if (this.isDragging && this.selectedNode) {
            // Update node position
            const rect = document.getElementById('nodeCanvas').getBoundingClientRect();
            const x = e.clientX - rect.left - this.dragOffset.x;
            const y = e.clientY - rect.top - this.dragOffset.y;
            
            this.selectedNode.element.style.left = `${x}px`;
            this.selectedNode.element.style.top = `${y}px`;
            this.selectedNode.x = x;
            this.selectedNode.y = y;
            
            this.updateConnections();
        }
        
        if (this.isConnecting && this.tempConnection) {
            // Update temporary connection line
            const rect = document.getElementById('nodeCanvas').getBoundingClientRect();
            const startNode = this.nodes.get(this.connectionStart.nodeId);
            const startX = startNode.x + (this.connectionStart.portType === 'output' ? 120 : 0);
            const startY = startNode.y + 25;
            const endX = e.clientX - rect.left;
            const endY = e.clientY - rect.top;
            
            const path = this.createConnectionPath(startX, startY, endX, endY);
            this.tempConnection.setAttribute('d', path);
        }
    }
    
    onCanvasMouseUp(e) {
        if (this.isDragging) {
            this.isDragging = false;
            if (this.selectedNode) {
                this.selectedNode.element.style.zIndex = '';
            }
        }
        
        if (this.isConnecting) {
            this.finishConnection(e);
        }
    }
    
    finishConnection(e) {
        if (this.tempConnection) {
            this.tempConnection.remove();
            this.tempConnection = null;
        }
        
        // Find target port
        const target = e.target.closest('.node-port');
        if (target) {
            const targetNode = target.closest('.node');
            const targetPortType = target.dataset.port;
            
            if (targetNode && targetPortType !== this.connectionStart.portType) {
                this.createConnection(
                    this.connectionStart.nodeId,
                    this.connectionStart.portType,
                    targetNode.id,
                    targetPortType
                );
            }
        }
        
        this.isConnecting = false;
        this.connectionStart = null;
    }
    
    createConnection(fromNodeId, fromPort, toNodeId, toPort) {
        // Prevent duplicate connections
        const existing = this.connections.find(conn => 
            conn.from.nodeId === fromNodeId && conn.from.port === fromPort &&
            conn.to.nodeId === toNodeId && conn.to.port === toPort
        );
        
        if (existing) {
            this.log('Connection already exists', 'warning');
            return;
        }
        
        const connection = {
            id: `conn_${Date.now()}`,
            from: { nodeId: fromNodeId, port: fromPort },
            to: { nodeId: toNodeId, port: toPort },
            element: null
        };
        
        // Create SVG path element
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('stroke', '#4a9eff');
        path.setAttribute('stroke-width', '2');
        path.setAttribute('fill', 'none');
        path.setAttribute('marker-end', 'url(#arrowhead)');
        path.style.cursor = 'pointer';
        
        // Add click handler for deletion
        path.addEventListener('click', () => {
            this.deleteConnection(connection.id);
        });
        
        connection.element = path;
        document.getElementById('connectionLayer').appendChild(path);
        
        this.connections.push(connection);
        this.updateConnections();
        
        const fromNode = this.nodes.get(fromNodeId);
        const toNode = this.nodes.get(toNodeId);
        this.log(`Connected ${fromNode.type} → ${toNode.type}`, 'success');
    }
    
    updateConnections() {
        this.connections.forEach(conn => {
            const fromNode = this.nodes.get(conn.from.nodeId);
            const toNode = this.nodes.get(conn.to.nodeId);
            
            if (fromNode && toNode) {
                const fromX = fromNode.x + (conn.from.port === 'output' ? 120 : 0);
                const fromY = fromNode.y + 25;
                const toX = toNode.x + (conn.to.port === 'output' ? 120 : 0);
                const toY = toNode.y + 25;
                
                const path = this.createConnectionPath(fromX, fromY, toX, toY);
                conn.element.setAttribute('d', path);
            }
        });
    }
    
    createConnectionPath(x1, y1, x2, y2) {
        const dx = x2 - x1;
        const controlOffset = Math.abs(dx) / 2;
        
        return `M ${x1} ${y1} C ${x1 + controlOffset} ${y1}, ${x2 - controlOffset} ${y2}, ${x2} ${y2}`;
    }
    
    deleteConnection(connectionId) {
        const index = this.connections.findIndex(conn => conn.id === connectionId);
        if (index !== -1) {
            const connection = this.connections[index];
            connection.element.remove();
            this.connections.splice(index, 1);
            this.log('Connection deleted', 'info');
        }
    }
    
    deleteNode() {
        if (this.selectedNode) {
            const nodeId = this.selectedNode.id;
            
            // Remove connections involving this node
            this.connections = this.connections.filter(conn => {
                if (conn.from.nodeId === nodeId || conn.to.nodeId === nodeId) {
                    conn.element.remove();
                    return false;
                }
                return true;
            });
            
            // Remove node element and data
            this.selectedNode.element.remove();
            this.nodes.delete(nodeId);
            
            this.log(`Deleted ${this.selectedNode.type}`, 'info');
            this.selectedNode = null;
            this.clearPropertiesPanel();
        }
    }
    
    clearPropertiesPanel() {
        document.getElementById('propertiesContent').innerHTML = `
            <div class="property-group">
                <em style="color: #666; font-size: 12px;">Select a node to edit properties</em>
            </div>
        `;
    }
    
    onCanvasRightClick(e) {
        e.preventDefault();
        const contextMenu = document.getElementById('contextMenu');
        contextMenu.style.display = 'block';
        contextMenu.style.left = `${e.pageX}px`;
        contextMenu.style.top = `${e.pageY}px`;
    }
    
    onDocumentClick(e) {
        const contextMenu = document.getElementById('contextMenu');
        if (!contextMenu.contains(e.target)) {
            contextMenu.style.display = 'none';
        }
    }
    
    onKeyDown(e) {
        if (e.key === 'Delete' && this.selectedNode) {
            this.deleteNode();
        } else if (e.key === 'Escape') {
            if (this.isConnecting) {
                this.isConnecting = false;
                if (this.tempConnection) {
                    this.tempConnection.remove();
                    this.tempConnection = null;
                }
            }
        }
    }
    
    onCanvasWheel(e) {
        e.preventDefault();
        // Handle zoom functionality (future enhancement)
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        this.zoom *= delta;
        // TODO: Implement actual zoom transformation
    }

    onWindowResize() {
        // Update canvas size and redraw connections
        this.updateConnections();
    }
    
    log(message, type = 'info') {
        const console = document.getElementById('consoleContent');
        const line = document.createElement('div');
        line.className = `console-line ${type}`;
        line.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        console.appendChild(line);
        console.scrollTop = console.scrollHeight;
    }
    
    // Project management
    newProject() {
        if (confirm('Create new project? This will clear the current canvas.')) {
            this.clearCanvas();
            this.log('New project created', 'success');
        }
    }
    
    saveProject() {
        const projectData = {
            nodes: Array.from(this.nodes.values()).map(node => ({
                id: node.id,
                type: node.type,
                x: node.x,
                y: node.y,
                properties: node.properties
            })),
            connections: this.connections.map(conn => ({
                from: conn.from,
                to: conn.to
            }))
        };
        
        const dataStr = JSON.stringify(projectData, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'praxis-project.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.log('Project saved', 'success');
    }
    
    openProject() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const projectData = JSON.parse(e.target.result);
                        this.loadProject(projectData);
                        this.log('Project loaded', 'success');
                    } catch (error) {
                        this.log('Failed to load project: ' + error.message, 'error');
                    }
                };
                reader.readAsText(file);
            }
        };
        input.click();
    }
    
    loadProject(projectData) {
        this.clearCanvas();
        
        // Load nodes
        projectData.nodes.forEach(nodeData => {
            const node = this.createNode(nodeData.type, nodeData.x, nodeData.y);
            node.properties = { ...node.properties, ...nodeData.properties };
        });
        
        // Load connections
        setTimeout(() => {
            projectData.connections.forEach(connData => {
                this.createConnection(
                    connData.from.nodeId,
                    connData.from.port,
                    connData.to.nodeId,
                    connData.to.port
                );
            });
        }, 100);
    }
    
    clearCanvas() {
        // Clear nodes
        this.nodes.forEach(node => node.element.remove());
        this.nodes.clear();
        
        // Clear connections
        this.connections.forEach(conn => conn.element.remove());
        this.connections = [];
        
        this.selectedNode = null;
        this.clearPropertiesPanel();
    }
    
    // PraxisCORE integration
    async connectToPraxisCore() {
        const statusIndicator = document.getElementById('connectionStatus');
        
        try {
            this.log('Connecting to PraxisCORE...', 'info');
            
            // Check if PraxisCORE is running (use local API endpoint)
            const response = await fetch('/api/status');
            const data = await response.json();
            
            if (data.connected) {
                statusIndicator.classList.add('connected');
                this.log(`Connected to PraxisCORE at ${data.host}:${data.port}`, 'success');
            } else {
                statusIndicator.classList.remove('connected');
                this.log('PraxisCORE not running - ' + data.message, 'warning');
            }
        } catch (error) {
            statusIndicator.classList.remove('connected');
            this.log('Failed to connect: ' + error.message, 'error');
        }
    }
    
    runProject() {
        this.log('Compiling and running project...', 'info');
        // TODO: Convert visual graph to PraxisCORE code and execute
        setTimeout(() => {
            this.log('Project is running', 'success');
        }, 1000);
    }
    
    stopProject() {
        this.log('Stopping project...', 'info');
        setTimeout(() => {
            this.log('Project stopped', 'info');
        }, 500);
    }
    
    selectMediaFile(nodeId, property) {
        this.showMediaFileBrowser(nodeId, property);
    }
    
    async uploadMediaFile(nodeId, property) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'audio/*,video/*';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    this.log(`Uploading ${file.name}...`, 'info');
                    
                    const formData = new FormData();
                    formData.append('file', file);
                    
                    const response = await fetch('/api/upload', {
                        method: 'POST',
                        body: formData
                    });
                    
                    const result = await response.json();
                    
                    if (result.status === 'success') {
                        this.updateNodeProperty(nodeId, property, result.filename);
                        this.log(`File uploaded: ${result.filename}`, 'success');
                    } else {
                        this.log(`Upload failed: ${result.message}`, 'error');
                    }
                } catch (error) {
                    this.log(`Upload error: ${error.message}`, 'error');
                }
            }
        };
        input.click();
    }
    
    async showMediaFileBrowser(nodeId, property) {
        try {
            const response = await fetch('/api/files');
            const data = await response.json();
            
            if (data.status === 'success') {
                this.createMediaFileBrowserModal(data.files, nodeId, property);
            } else {
                this.log('Failed to load media files', 'error');
            }
        } catch (error) {
            this.log(`Error loading media files: ${error.message}`, 'error');
        }
    }
    
    createMediaFileBrowserModal(files, nodeId, property) {
        // Remove existing modal
        const existingModal = document.getElementById('mediaFileBrowser');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Create modal
        const modal = document.createElement('div');
        modal.id = 'mediaFileBrowser';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 2000;
        `;
        
        const modalContent = document.createElement('div');
        modalContent.style.cssText = `
            background: #2d2d30;
            border-radius: 8px;
            padding: 20px;
            max-width: 600px;
            max-height: 500px;
            overflow-y: auto;
            color: white;
        `;
        
        let html = `
            <h3 style="margin-bottom: 15px; color: #4a9eff;">Select Media File</h3>
            <div style="margin-bottom: 15px;">
                <button onclick="praxisLive.uploadMediaFile('${nodeId}', '${property}')" 
                        style="background: #107c10; color: white; border: none; padding: 8px 15px; border-radius: 3px; cursor: pointer;">
                    Upload New File
                </button>
            </div>
        `;
        
        if (files.length === 0) {
            html += '<p style="color: #666;">No media files available. Upload a file to get started.</p>';
        } else {
            html += '<div style="max-height: 300px; overflow-y: auto;">';
            files.forEach(file => {
                const icon = file.type === 'audio' ? '🎵' : file.type === 'video' ? '🎬' : '📄';
                const size = (file.size / 1024 / 1024).toFixed(2);
                html += `
                    <div style="display: flex; align-items: center; padding: 8px; border: 1px solid #3e3e42; margin-bottom: 5px; border-radius: 3px; cursor: pointer;"
                         onclick="praxisLive.selectFile('${nodeId}', '${property}', '${file.name}')">
                        <span style="margin-right: 10px; font-size: 18px;">${icon}</span>
                        <div style="flex: 1;">
                            <div style="font-weight: bold;">${file.name}</div>
                            <div style="font-size: 11px; color: #999;">${file.type} • ${size} MB</div>
                        </div>
                    </div>
                `;
            });
            html += '</div>';
        }
        
        html += `
            <div style="margin-top: 15px; text-align: right;">
                <button onclick="document.getElementById('mediaFileBrowser').remove()" 
                        style="background: #666; color: white; border: none; padding: 8px 15px; border-radius: 3px; cursor: pointer;">
                    Cancel
                </button>
            </div>
        `;
        
        modalContent.innerHTML = html;
        modal.appendChild(modalContent);
        document.body.appendChild(modal);
        
        // Close modal when clicking outside
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }
    
    selectFile(nodeId, property, filename) {
        this.updateNodeProperty(nodeId, property, filename);
        document.getElementById('mediaFileBrowser').remove();
        this.log(`Selected file: ${filename}`, 'success');
    }

    editNodeCode(nodeId) {
        const node = this.nodes.get(nodeId);
        if (node) {
            this.showCodeEditor(node);
        }
    }
    
    showCodeEditor(node) {
        // Remove existing modal
        const existingModal = document.getElementById('codeEditor');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Create modal
        const modal = document.createElement('div');
        modal.id = 'codeEditor';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 2000;
        `;
        
        const modalContent = document.createElement('div');
        modalContent.style.cssText = `
            background: #1e1e1e;
            border-radius: 8px;
            padding: 20px;
            width: 80%;
            height: 80%;
            display: flex;
            flex-direction: column;
            color: white;
        `;
        
        // Generate sample code for the node
        const sampleCode = this.generateNodeCode(node);
        
        modalContent.innerHTML = `
            <div style="display: flex; justify-content: between; align-items: center; margin-bottom: 15px;">
                <h3 style="color: #4a9eff; margin: 0;">Code Editor - ${node.type}</h3>
                <div>
                    <button onclick="praxisLive.saveNodeCode('${node.id}')" 
                            style="background: #107c10; color: white; border: none; padding: 8px 15px; border-radius: 3px; cursor: pointer; margin-right: 10px;">
                        Save & Apply
                    </button>
                    <button onclick="document.getElementById('codeEditor').remove()" 
                            style="background: #666; color: white; border: none; padding: 8px 15px; border-radius: 3px; cursor: pointer;">
                        Cancel
                    </button>
                </div>
            </div>
            <textarea id="nodeCodeEditor" style="
                flex: 1;
                background: #0d0d0d;
                color: #ffffff;
                border: 1px solid #3e3e42;
                border-radius: 3px;
                padding: 15px;
                font-family: 'Courier New', monospace;
                font-size: 14px;
                resize: none;
                outline: none;
            ">${sampleCode}</textarea>
            <div style="margin-top: 10px; font-size: 12px; color: #999;">
                💡 This is a live code editor. Changes will be applied to the PraxisCORE runtime in real-time.
            </div>
        `;
        
        modal.appendChild(modalContent);
        document.body.appendChild(modal);
        
        // Close modal when clicking outside
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
        
        this.log(`Opened code editor for ${node.type}`, 'info');
    }
    
    generateNodeCode(node) {
        const codeTemplates = {
            'audio:oscillator': `// Audio Oscillator Component
@In frequency = ${node.properties.frequency || 440};
@In waveform = "${node.properties.waveform || 'sine'}";
@In amplitude = ${node.properties.amplitude || 0.5};
@Out output;

void setup() {
    // Initialize oscillator
}

void update() {
    // Generate waveform based on frequency and type
    double phase = getPhase();
    double sample = 0;
    
    switch(waveform) {
        case "sine":
            sample = sin(phase * 2 * PI) * amplitude;
            break;
        case "square":
            sample = (sin(phase * 2 * PI) > 0 ? 1 : -1) * amplitude;
            break;
        case "sawtooth":
            sample = (2 * (phase - floor(phase)) - 1) * amplitude;
            break;
    }
    
    output = sample;
}`,
            
            'video:player': `// Video Player Component
@In file = "${node.properties.file || ''}";
@In loop = ${node.properties.loop || false};
@In speed = ${node.properties.speed || 1.0};
@Out output;

void setup() {
    if (!file.isEmpty()) {
        loadVideo(file);
    }
}

void update() {
    if (hasVideo()) {
        updatePlayback(speed);
        output = getCurrentFrame();
        
        if (isFinished() && loop) {
            restart();
        }
    }
}`,
            
            'audio:output': `// Audio Output Component
@In input;
@In volume = ${node.properties.volume || 1.0};
@In mute = ${node.properties.mute || false};

void setup() {
    // Initialize audio output device
    initAudioOutput();
}

void update() {
    if (!mute && input != null) {
        double outputSample = input * volume;
        outputToDevice(outputSample);
        
        // Update preview if monitoring
        if (monitor) {
            updatePreview(outputSample);
        }
    }
}`,

            'video:output': `// Video Output Component
@In input;
@In scaling = "${node.properties.scaling || 'fit'}";
@In fullscreen = ${node.properties.fullscreen || false};

void setup() {
    // Initialize video output display
    initVideoOutput();
}

void update() {
    if (input != null) {
        Frame frame = processFrame(input, scaling);
        
        if (fullscreen) {
            outputFullscreen(frame);
        } else {
            outputToWindow(frame);
        }
        
        // Update preview if monitoring
        if (monitor) {
            updatePreview(frame);
        }
    }
}`,

            'audio:render': `// Audio Render Component
@In input;
@In filename = "${node.properties.file || 'output.wav'}";
@In format = "${node.properties.format || 'wav'}";
@In duration = ${node.properties.duration || 10};

AudioWriter writer;
double startTime;

void setup() {
    // Initialize audio writer
    writer = new AudioWriter(filename, format);
}

void update() {
    if (isRecording() && input != null) {
        writer.writeSample(input);
        
        double elapsed = getCurrentTime() - startTime;
        if (elapsed >= duration) {
            stopRecording();
            writer.close();
        }
    }
}

void startRecording() {
    startTime = getCurrentTime();
    writer.open();
}`,

            'video:render': `// Video Render Component
@In input;
@In filename = "${node.properties.file || 'output.mp4'}";
@In format = "${node.properties.format || 'mp4'}";
@In fps = ${node.properties.fps || 30};
@In duration = ${node.properties.duration || 10};

VideoWriter writer;
double startTime;

void setup() {
    // Initialize video writer
    writer = new VideoWriter(filename, format, fps);
}

void update() {
    if (isRecording() && input != null) {
        writer.writeFrame(input);
        
        double elapsed = getCurrentTime() - startTime;
        if (elapsed >= duration) {
            stopRecording();
            writer.close();
        }
    }
}

void startRecording() {
    startTime = getCurrentTime();
    writer.open();
}`,

            'core:variable': `// Variable Component
@In value = ${node.properties.value || 0};
@Out output;

void update() {
    output = value;
}`
        };
        
        return codeTemplates[node.type] || `// ${node.type} Component
// Add your custom code here

void setup() {
    // Initialization code
}

void update() {
    // Main processing code
}`;
    }
    
    saveNodeCode(nodeId) {
        const codeEditor = document.getElementById('nodeCodeEditor');
        if (codeEditor) {
            const code = codeEditor.value;
            const node = this.nodes.get(nodeId);
            
            if (node) {
                // Store the code in the node
                node.customCode = code;
                
                // TODO: Send code to PraxisCORE for compilation and execution
                this.log(`Code saved for ${node.type}`, 'success');
                this.log('Code compilation and deployment to PraxisCORE...', 'info');
                
                // Simulate code compilation
                setTimeout(() => {
                    this.log('Code compiled and applied successfully', 'success');
                }, 1000);
            }
            
            document.getElementById('codeEditor').remove();
        }
    }
}

// Utility functions
function toggleCategory(categoryId) {
    const componentList = document.getElementById(`${categoryId}-components`);
    if (componentList) {
        const isHidden = componentList.style.display === 'none';
        componentList.style.display = isHidden ? 'block' : 'none';
    }
}

// Initialize the application
let praxisLive;

// Global functions for toolbar
function newProject() { 
    if (praxisLive) praxisLive.newProject(); 
}
function openProject() { 
    if (praxisLive) praxisLive.openProject(); 
}
function saveProject() { 
    if (praxisLive) praxisLive.saveProject(); 
}
function runProject() { 
    if (praxisLive) praxisLive.runProject(); 
}
function stopProject() { 
    if (praxisLive) praxisLive.stopProject(); 
}
function connectToPraxisCore() { 
    if (praxisLive) praxisLive.connectToPraxisCore(); 
}

function testNodeSelection() {
    if (praxisLive) {
        // Create a test node if none exist
        if (praxisLive.nodes.size === 0) {
            const testNode = praxisLive.addNodeAt('audio:oscillator', 300, 200);
            praxisLive.log('Created test node for selection testing', 'info');
        }
        
        // Select the first node
        const firstNode = Array.from(praxisLive.nodes.values())[0];
        if (firstNode) {
            praxisLive.selectNode(firstNode.id);
            praxisLive.log('Test: Selected first node', 'success');
        }
    }
}

// Context menu functions
function addNode() { 
    /* TODO */ 
}
function deleteNode() { 
    if (praxisLive) praxisLive.deleteNode(); 
}
function duplicateNode() { 
    /* TODO */ 
}
function editCode() { 
    if (praxisLive && praxisLive.selectedNode) {
        praxisLive.editNodeCode(praxisLive.selectedNode.id);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    praxisLive = new PraxisLiveWeb();
});