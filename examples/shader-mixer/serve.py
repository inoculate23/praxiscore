"""Serve the local GPU mixer and its MCP command bridge on loopback only."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
from mixer_bridge import MixerBridge

bridge = MixerBridge()


class PlayerHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def json_response(self, data, status=200):
        content=json.dumps(data).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def do_GET(self):
        hosts={f'127.0.0.1:{self.server.server_port}',f'localhost:{self.server.server_port}'}
        if self.headers.get('Host') not in hosts:
            self.json_response(dict(error='Invalid localhost host'),403); return
        if self.path=='/api/mixer/status':
            self.json_response(bridge.status())
        else:
            super().do_GET()

    def do_POST(self):
        # No cross-origin control from websites; Python MCP requests have no Origin.
        hosts={f'127.0.0.1:{self.server.server_port}',f'localhost:{self.server.server_port}'}
        origin=self.headers.get('Origin')
        if self.headers.get('Host') not in hosts or (origin and origin not in {'http://'+h for h in hosts}):
            self.json_response(dict(error='Cross-origin mixer control is forbidden'),403); return
        try:
            size=int(self.headers.get('Content-Length',0))
            if not 0<size<=65536 or self.headers.get_content_type()!='application/json':
                raise ValueError('Expected application/json, at most 64 KB')
            data=json.loads(self.rfile.read(size))
            if self.path=='/api/mixer/sync': result=bridge.sync(data)
            elif self.path=='/api/mixer/command': result=bridge.command(data)
            else:
                self.json_response(dict(error='Not found'),404); return
            self.json_response(result)
        except (ValueError, TypeError) as error:
            self.json_response(dict(error=str(error)),400)

    def log_message(self, fmt, *args):
        if self.path!='/api/mixer/sync': super().log_message(fmt,*args)


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--port',type=int,default=8765)
    args=p.parse_args()
    handler=partial(PlayerHandler,directory=str(Path(__file__).resolve().parent/'player'))
    try: server=ThreadingHTTPServer(('127.0.0.1',args.port),handler)
    except OSError as exc: p.exit(1,f'Could not start player: {exc}\n')
    print(f'Open http://127.0.0.1:{args.port} — mixer + MCP bridge ready.',flush=True)
    try: server.serve_forever()
    except KeyboardInterrupt: pass
    finally: server.server_close()


if __name__=='__main__': main()
