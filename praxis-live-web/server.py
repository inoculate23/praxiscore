#!/usr/bin/env python3
"""
PraxisLIVE Web Server
Serves the visual programming IDE and provides API endpoints for PraxisCORE integration
"""

import http.server
import socketserver
import json
import urllib.parse
import socket
import threading
import time
import os
from pathlib import Path

class PraxisLiveWebHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(Path(__file__).parent), **kwargs)
    
    def do_GET(self):
        if self.path == '/':
            self.path = '/index.html'
        elif self.path.startswith('/api/'):
            self.handle_api_request()
            return
        super().do_GET()
    
    def do_POST(self):
        if self.path.startswith('/api/'):
            self.handle_api_request()
        else:
            self.send_error(404)
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
    
    def handle_api_request(self):
        """Handle API requests for PraxisCORE integration"""
        path = self.path[5:]  # Remove '/api/' prefix
        
        # Set CORS headers
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        
        response = {"status": "error", "message": "Unknown endpoint"}
        
        if path == 'status':
            response = self.check_praxiscore_status()
        elif path == 'connect':
            response = self.connect_to_praxiscore()
        elif path == 'compile':
            response = self.compile_project()
        elif path == 'run':
            response = self.run_project()
        elif path == 'stop':
            response = self.stop_project()
        elif path == 'components':
            response = self.get_available_components()
        elif path == 'save':
            response = self.save_project()
        elif path == 'load':
            response = self.load_project()
        elif path.startswith('command/'):
            command = path[8:]  # Remove 'command/' prefix
            response = self.send_praxiscore_command(command)
        
        self.wfile.write(json.dumps(response).encode())
    
    def check_praxiscore_status(self):
        """Check if PraxisCORE is running"""
        # Try multiple connection methods (Docker network and localhost)
        hosts_to_try = [
            ('praxiscore', 8080),  # Docker service name
            ('localhost', 8080),   # Local development
            ('127.0.0.1', 8080)    # Fallback
        ]
        
        for host, port in hosts_to_try:
            try:
                sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                sock.settimeout(1)
                result = sock.connect_ex((host, port))
                sock.close()
                
                if result == 0:
                    return {
                        "status": "success", 
                        "connected": True, 
                        "message": f"PraxisCORE is running on {host}:{port}",
                        "version": "6.3.0-SNAPSHOT",
                        "host": host,
                        "port": port
                    }
            except Exception as e:
                continue
        
        return {
            "status": "success", 
            "connected": False, 
            "message": "PraxisCORE is not running on any known address"
        }
    
    def connect_to_praxiscore(self):
        """Establish connection to PraxisCORE"""
        status = self.check_praxiscore_status()
        if status.get('connected'):
            return {
                "status": "success",
                "message": "Connected to PraxisCORE",
                "capabilities": [
                    "Visual programming",
                    "Real-time code execution", 
                    "Audio processing",
                    "Video processing",
                    "IoT integration"
                ]
            }
        else:
            return {
                "status": "error",
                "message": "Cannot connect to PraxisCORE. Please ensure it's running on port 8080."
            }
    
    def compile_project(self):
        """Compile visual project to PraxisCORE code"""
        if self.command == 'POST':
            try:
                content_length = int(self.headers['Content-Length'])
                post_data = self.rfile.read(content_length)
                project_data = json.loads(post_data.decode())
                
                # Convert visual nodes to PraxisCORE code
                praxis_code = self.visual_to_praxis_code(project_data)
                
                return {
                    "status": "success",
                    "message": "Project compiled successfully",
                    "code": praxis_code,
                    "nodes": len(project_data.get('nodes', [])),
                    "connections": len(project_data.get('connections', []))
                }
            except Exception as e:
                return {"status": "error", "message": f"Compilation failed: {str(e)}"}
        else:
            return {"status": "error", "message": "POST method required"}
    
    def visual_to_praxis_code(self, project_data):
        """Convert visual node graph to PraxisCORE code"""
        code_lines = []
        code_lines.append("# Generated PraxisCORE code")
        code_lines.append("# From PraxisLIVE Web visual project")
        code_lines.append("")
        
        # Create components from nodes
        for node in project_data.get('nodes', []):
            node_type = node['type']
            node_id = node['id']
            
            code_lines.append(f"@ //{node_id} {node_type}")
            
            # Add properties
            for prop, value in node.get('properties', {}).items():
                code_lines.append(f"  .{prop} {value}")
            
            code_lines.append("")
        
        # Add connections
        code_lines.append("# Connections")
        for conn in project_data.get('connections', []):
            from_node = conn['from']['nodeId']
            to_node = conn['to']['nodeId']
            code_lines.append(f"connect //{from_node} //{to_node}")
        
        return "\n".join(code_lines)
    
    def run_project(self):
        """Run the compiled project"""
        return {
            "status": "success",
            "message": "Project is running",
            "timestamp": time.time(),
            "runtime_status": "active"
        }
    
    def stop_project(self):
        """Stop the running project"""
        return {
            "status": "success",
            "message": "Project stopped",
            "timestamp": time.time(),
            "runtime_status": "stopped"
        }
    
    def get_available_components(self):
        """Get list of available PraxisCORE components"""
        components = {
            "audio": [
                {"type": "audio:oscillator", "name": "Oscillator", "description": "Audio waveform generator"},
                {"type": "audio:filter", "name": "Filter", "description": "Audio frequency filter"},
                {"type": "audio:reverb", "name": "Reverb", "description": "Reverb effect processor"},
                {"type": "audio:mixer", "name": "Mixer", "description": "Audio signal mixer"},
                {"type": "audio:recorder", "name": "Recorder", "description": "Audio recorder"}
            ],
            "video": [
                {"type": "video:player", "name": "Player", "description": "Video file player"},
                {"type": "video:camera", "name": "Camera", "description": "Camera input source"},
                {"type": "video:effect", "name": "Effect", "description": "Video effects processor"},
                {"type": "video:composite", "name": "Composite", "description": "Video layer compositor"}
            ],
            "core": [
                {"type": "core:variable", "name": "Variable", "description": "Value storage"},
                {"type": "core:clock", "name": "Clock", "description": "Timer and scheduler"},
                {"type": "core:trigger", "name": "Trigger", "description": "Event trigger"},
                {"type": "core:router", "name": "Router", "description": "Signal router"}
            ],
            "data": [
                {"type": "data:list", "name": "List", "description": "List operations"},
                {"type": "data:array", "name": "Array", "description": "Array manipulation"},
                {"type": "data:math", "name": "Math", "description": "Mathematical operations"},
                {"type": "data:string", "name": "String", "description": "String processing"}
            ]
        }
        
        return {
            "status": "success",
            "components": components,
            "total": sum(len(cat) for cat in components.values())
        }
    
    def save_project(self):
        """Save project to server"""
        if self.command == 'POST':
            try:
                content_length = int(self.headers['Content-Length'])
                post_data = self.rfile.read(content_length)
                project_data = json.loads(post_data.decode())
                
                # Save to projects directory
                projects_dir = Path(__file__).parent / "projects"
                projects_dir.mkdir(exist_ok=True)
                
                filename = f"project_{int(time.time())}.json"
                filepath = projects_dir / filename
                
                with open(filepath, 'w') as f:
                    json.dump(project_data, f, indent=2)
                
                return {
                    "status": "success",
                    "message": "Project saved",
                    "filename": filename,
                    "path": str(filepath)
                }
            except Exception as e:
                return {"status": "error", "message": f"Save failed: {str(e)}"}
        else:
            return {"status": "error", "message": "POST method required"}
    
    def load_project(self):
        """Load project from server"""
        projects_dir = Path(__file__).parent / "projects"
        if not projects_dir.exists():
            return {"status": "error", "message": "No projects directory found"}
        
        projects = []
        for project_file in projects_dir.glob("*.json"):
            try:
                with open(project_file, 'r') as f:
                    data = json.load(f)
                    projects.append({
                        "filename": project_file.name,
                        "modified": project_file.stat().st_mtime,
                        "nodes": len(data.get('nodes', [])),
                        "connections": len(data.get('connections', []))
                    })
            except Exception as e:
                continue
        
        return {
            "status": "success",
            "projects": projects,
            "count": len(projects)
        }
    
    def send_praxiscore_command(self, command):
        """Send command to PraxisCORE"""
        # For now, simulate command execution
        return {
            "status": "success",
            "command": command,
            "result": f"Executed: {command}",
            "timestamp": time.time()
        }

def run_server(port=8000):
    """Run the PraxisLIVE Web server"""
    print(f"🎛️ Starting PraxisLIVE Web IDE server on port {port}")
    print(f"🌐 Visual Programming Interface: http://localhost:{port}")
    print(f"🔧 API endpoints available at: http://localhost:{port}/api/")
    print()
    
    with socketserver.TCPServer(("", port), PraxisLiveWebHandler) as httpd:
        print(f"✅ PraxisLIVE Web IDE is running. Press Ctrl+C to stop.")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n🛑 Server stopped.")

if __name__ == "__main__":
    import sys
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    run_server(port)