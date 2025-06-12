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
import cgi
import tempfile
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
        elif self.path.startswith('/media/'):
            self.serve_media_file()
            return
        super().do_GET()
    
    def serve_media_file(self):
        """Serve media files"""
        try:
            # Get the filename from the path
            filename = self.path[7:]  # Remove '/media/' prefix
            media_dir = Path(__file__).parent / "media"
            file_path = media_dir / filename
            
            if not file_path.exists() or not file_path.is_file():
                self.send_error(404, "Media file not found")
                return
            
            # Determine content type
            file_ext = file_path.suffix.lower()
            content_types = {
                '.mp3': 'audio/mpeg',
                '.wav': 'audio/wav',
                '.ogg': 'audio/ogg',
                '.m4a': 'audio/mp4',
                '.mp4': 'video/mp4',
                '.avi': 'video/x-msvideo',
                '.mov': 'video/quicktime',
                '.mkv': 'video/x-matroska',
                '.webm': 'video/webm'
            }
            
            content_type = content_types.get(file_ext, 'application/octet-stream')
            
            # Send the file
            self.send_response(200)
            self.send_header('Content-Type', content_type)
            self.send_header('Content-Length', str(file_path.stat().st_size))
            self.send_header('Accept-Ranges', 'bytes')
            self.end_headers()
            
            with open(file_path, 'rb') as f:
                self.wfile.write(f.read())
                
        except Exception as e:
            self.send_error(500, f"Error serving media file: {str(e)}")
    
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
        elif path == 'upload':
            response = self.handle_file_upload()
        elif path == 'files':
            response = self.list_media_files()
        elif path.startswith('render/'):
            render_type = path[7:]  # Remove 'render/' prefix
            response = self.handle_render_request(render_type)
        elif path.startswith('audio-stream/'):
            node_id = path[13:]  # Remove 'audio-stream/' prefix
            response = self.get_audio_stream(node_id)
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
                {"type": "audio:recorder", "name": "Recorder", "description": "Audio recorder"},
                {"type": "audio:output", "name": "Output", "description": "Audio output and preview"},
                {"type": "audio:render", "name": "Render", "description": "Render audio to file"}
            ],
            "video": [
                {"type": "video:player", "name": "Player", "description": "Video file player"},
                {"type": "video:camera", "name": "Camera", "description": "Camera input source"},
                {"type": "video:effect", "name": "Effect", "description": "Video effects processor"},
                {"type": "video:composite", "name": "Composite", "description": "Video layer compositor"},
                {"type": "video:output", "name": "Output", "description": "Video output and preview"},
                {"type": "video:render", "name": "Render", "description": "Render video to file"}
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
    
    def handle_file_upload(self):
        """Handle media file uploads"""
        if self.command == 'POST':
            try:
                # Create media directory if it doesn't exist
                media_dir = Path(__file__).parent / "media"
                media_dir.mkdir(exist_ok=True)
                
                # Parse the multipart form data
                content_type = self.headers['Content-Type']
                if not content_type.startswith('multipart/form-data'):
                    return {"status": "error", "message": "Expected multipart/form-data"}
                
                # Get content length
                content_length = int(self.headers['Content-Length'])
                
                # Parse the form data
                form_data = cgi.FieldStorage(
                    fp=self.rfile,
                    headers=self.headers,
                    environ={'REQUEST_METHOD': 'POST'}
                )
                
                if 'file' not in form_data:
                    return {"status": "error", "message": "No file provided"}
                
                file_item = form_data['file']
                if not file_item.filename:
                    return {"status": "error", "message": "No file selected"}
                
                # Check file type
                allowed_extensions = {'.mp3', '.wav', '.ogg', '.m4a', '.mp4', '.avi', '.mov', '.mkv', '.webm'}
                file_ext = Path(file_item.filename).suffix.lower()
                
                if file_ext not in allowed_extensions:
                    return {"status": "error", "message": f"Unsupported file type: {file_ext}"}
                
                # Save the file
                safe_filename = "".join(c for c in file_item.filename if c.isalnum() or c in '.-_')
                file_path = media_dir / safe_filename
                
                with open(file_path, 'wb') as f:
                    f.write(file_item.file.read())
                
                return {
                    "status": "success",
                    "message": "File uploaded successfully",
                    "filename": safe_filename,
                    "path": str(file_path),
                    "size": file_path.stat().st_size,
                    "type": "audio" if file_ext in {'.mp3', '.wav', '.ogg', '.m4a'} else "video"
                }
                
            except Exception as e:
                return {"status": "error", "message": f"Upload failed: {str(e)}"}
        else:
            return {"status": "error", "message": "POST method required for file upload"}
    
    def list_media_files(self):
        """List available media files"""
        media_dir = Path(__file__).parent / "media"
        if not media_dir.exists():
            return {"status": "success", "files": [], "count": 0}
        
        files = []
        for file_path in media_dir.iterdir():
            if file_path.is_file():
                file_ext = file_path.suffix.lower()
                file_type = "audio" if file_ext in {'.mp3', '.wav', '.ogg', '.m4a'} else \
                           "video" if file_ext in {'.mp4', '.avi', '.mov', '.mkv', '.webm'} else "other"
                
                files.append({
                    "name": file_path.name,
                    "size": file_path.stat().st_size,
                    "type": file_type,
                    "modified": file_path.stat().st_mtime,
                    "path": f"/media/{file_path.name}"
                })
        
        return {
            "status": "success",
            "files": sorted(files, key=lambda x: x['modified'], reverse=True),
            "count": len(files)
        }

    def handle_render_request(self, render_type):
        """Handle audio/video render requests"""
        if self.command == 'POST':
            try:
                content_length = int(self.headers['Content-Length'])
                post_data = self.rfile.read(content_length)
                render_data = json.loads(post_data.decode())
                
                node_id = render_data.get('nodeId')
                filename = render_data.get('filename', f'output_{int(time.time())}.wav')
                duration = render_data.get('duration', 10)
                
                # Create renders directory
                renders_dir = Path(__file__).parent / "media"
                renders_dir.mkdir(exist_ok=True)
                
                # Generate unique job ID
                job_id = f"{render_type}_{node_id}_{int(time.time())}"
                
                if render_type == 'audio':
                    # Simulate audio render process
                    output_path = renders_dir / filename
                    
                    # In real implementation, this would:
                    # 1. Get the audio chain from PraxisCORE
                    # 2. Process the audio for specified duration
                    # 3. Save to the output file
                    
                    # For now, create a placeholder file
                    with open(output_path, 'wb') as f:
                        # Write minimal WAV header for demo
                        f.write(b'RIFF\x24\x08\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x02\x00')
                        f.write(b'\x44\xac\x00\x00\x10\xb1\x02\x00\x04\x00\x10\x00data\x00\x08\x00\x00')
                        # Write some audio data (silence)
                        f.write(b'\x00' * (44100 * 2 * 2 * duration))  # 44.1kHz, 16-bit, stereo
                    
                    return {
                        "status": "success",
                        "message": f"Audio render started: {filename}",
                        "jobId": job_id,
                        "outputPath": str(output_path),
                        "duration": duration
                    }
                    
                elif render_type == 'video':
                    # Simulate video render process
                    format_ext = render_data.get('format', 'mp4')
                    if not filename.endswith(f'.{format_ext}'):
                        filename = f"{filename.rsplit('.', 1)[0]}.{format_ext}"
                    
                    output_path = renders_dir / filename
                    
                    # In real implementation, this would:
                    # 1. Get the video chain from PraxisCORE
                    # 2. Process the video for specified duration
                    # 3. Encode and save to the output file
                    
                    # For now, create a placeholder file
                    with open(output_path, 'wb') as f:
                        f.write(b'Placeholder video file')
                    
                    return {
                        "status": "success",
                        "message": f"Video render started: {filename}",
                        "jobId": job_id,
                        "outputPath": str(output_path),
                        "duration": duration,
                        "fps": render_data.get('fps', 30)
                    }
                
                return {"status": "error", "message": f"Unknown render type: {render_type}"}
                
            except Exception as e:
                return {"status": "error", "message": f"Render failed: {str(e)}"}
        else:
            return {"status": "error", "message": "POST method required for render"}
    
    def get_audio_stream(self, node_id):
        """Get audio stream for preview"""
        # In real implementation, this would stream live audio from PraxisCORE
        # For now, return a placeholder response
        return {
            "status": "success",
            "message": f"Audio stream for node {node_id}",
            "streamUrl": f"/media/stream_{node_id}.wav",
            "format": "wav",
            "sampleRate": 44100,
            "channels": 2
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