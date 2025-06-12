#!/usr/bin/env python3
"""
Simple HTTP server for PraxisCORE Web Interface
Serves the web UI and provides basic API endpoints
"""

import http.server
import socketserver
import json
import urllib.parse
import socket
import threading
import time
from pathlib import Path

class PraxisCOREWebHandler(http.server.SimpleHTTPRequestHandler):
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
    
    def handle_api_request(self):
        """Handle API requests to interface with PraxisCORE"""
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
        elif path == 'command':
            response = self.send_praxiscore_command()
        elif path == 'info':
            response = {"status": "success", "data": {
                "version": "6.3.0-SNAPSHOT",
                "runtime": "Java 21.0.7",
                "modules": 27,
                "uptime": "5 minutes"
            }}
        
        self.wfile.write(json.dumps(response).encode())
    
    def check_praxiscore_status(self):
        """Check if PraxisCORE is running"""
        try:
            # Try to connect to PraxisCORE port
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(1)
            result = sock.connect_ex(('localhost', 8080))
            sock.close()
            
            if result == 0:
                return {"status": "success", "connected": True, "message": "PraxisCORE is running"}
            else:
                return {"status": "success", "connected": False, "message": "PraxisCORE is not running"}
        except Exception as e:
            return {"status": "error", "connected": False, "message": f"Connection check failed: {str(e)}"}
    
    def connect_to_praxiscore(self):
        """Attempt to connect to PraxisCORE"""
        # For now, just check if it's running
        return self.check_praxiscore_status()
    
    def send_praxiscore_command(self):
        """Send a command to PraxisCORE"""
        if self.command == 'POST':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            try:
                data = json.loads(post_data.decode())
                command = data.get('command', '')
                
                # For now, simulate command execution
                return {
                    "status": "success", 
                    "command": command,
                    "result": f"Simulated execution of: {command}",
                    "timestamp": time.time()
                }
            except json.JSONDecodeError:
                return {"status": "error", "message": "Invalid JSON in request body"}
        else:
            return {"status": "error", "message": "POST method required for commands"}

def run_server(port=9000):
    """Run the web server"""
    print(f"🌐 Starting PraxisCORE Web Interface server on port {port}")
    print(f"📡 Access the interface at: http://localhost:{port}")
    print(f"🔧 API endpoints available at: http://localhost:{port}/api/")
    print()
    
    with socketserver.TCPServer(("", port), PraxisCOREWebHandler) as httpd:
        print(f"✅ Server running. Press Ctrl+C to stop.")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n🛑 Server stopped.")

if __name__ == "__main__":
    import sys
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 9000
    run_server(port)