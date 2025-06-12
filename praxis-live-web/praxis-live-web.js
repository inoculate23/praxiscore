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
        nodeElement.innerHTML = `
            <div class="node-header">${name}</div>
            <div class="node-body">
                <div class="node-port input" style="top: 20px;" data-port="input"></div>
                <div class="node-port output" style="top: 20px;" data-port="output"></div>
                <div style="margin: 10px 0; font-size: 11px; color: #ccc;">
                    ${this.getNodeDescription(type)}
                </div>
            </div>
        `;
        
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
    
    getNodeDescription(type) {
        const descriptions = {
            'audio:oscillator': 'Generates audio waveforms',
            'audio:filter': 'Filters audio frequencies',
            'audio:reverb': 'Adds reverb effect',
            'audio:mixer': 'Mixes audio signals',
            'audio:recorder': 'Records audio output',
            'video:player': 'Plays video files',
            'video:camera': 'Camera input',
            'video:effect': 'Video effects processor',
            'video:composite': 'Composites video layers',
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
            'video:player': { file: '', loop: false, speed: 1 },
            'core:variable': { value: 0, type: 'number' },
            'core:clock': { bpm: 120, pattern: '4/4' }
        };
        return defaults[type] || {};
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
            
            Object.entries(node.properties).forEach(([key, value]) => {
                html += `<div class="property-group">
                    <label class="property-label">${key.charAt(0).toUpperCase() + key.slice(1)}</label>
                    <input class="property-input" value="${value}" 
                           onchange="praxisLive.updateNodeProperty('${node.id}', '${key}', this.value)"
                           placeholder="Enter ${key}...">
                </div>`;
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
    
    editNodeCode(nodeId) {
        const node = this.nodes.get(nodeId);
        if (node) {
            this.log(`Opening code editor for ${node.type}`, 'info');
            // TODO: Open code editor modal
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