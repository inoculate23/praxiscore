#!/usr/bin/env python3
"""Dependency-free MCP stdio server for a dedicated PraxisCORE runtime."""
import argparse
import base64
import json
import math
from pathlib import Path
import queue
import re
import subprocess
import sys
import threading

REPO = Path(__file__).resolve().parent.parent


def token(value, pattern):
    if not isinstance(value, str) or not re.fullmatch(pattern, value):
        raise ValueError(f"Invalid address or identifier: {value!r}")
    return value


def address(value):
    return token(value, r"(?:/[A-Za-z_][A-Za-z_0-9-]*)+")


def identifier(value):
    return token(value, r"[A-Za-z_][A-Za-z_0-9-]*")


def literal(value):
    if isinstance(value, bool):
        return str(value).lower()
    if isinstance(value, (float, int)) and not isinstance(value, bool):
        if not math.isfinite(value):
            raise ValueError("Control numbers must be finite")
        return str(value)
    if not isinstance(value, str):
        raise ValueError("Control values must be strings, numbers or booleans")
    # PCL quoted-string syntax, including its command and variable substitutions.
    escaped = ''.join({'\\': '\\\\', '"': '\\"', '$': '\\$', '[': '\\[',
                       ']': '\\]', '\n': '\\n', '\r': '\\r', '\t': '\\t'}.get(c, c)
                      for c in value)
    return '"' + escaped + '"'


class Runtime:
    def __init__(self, command, timeout=30):
        self.command, self.timeout = command, timeout
        self.process = None
        self.responses = queue.Queue()

    def _read(self, stream):
        for line in stream:
            line = line.rstrip('\n')
            if line == 'PRAXIS_READY' or line.startswith(('PRAXIS_OK ', 'PRAXIS_ERROR ')):
                self.responses.put(line)
            else:
                print(line, file=sys.stderr)
        self.responses.put(None)

    def start(self):
        if self.process is not None:
            if self.process.poll() is None:
                return
            raise RuntimeError('Runtime exited; restart the MCP server to create a new session')
        self.process = subprocess.Popen(self.command, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                        stderr=None, text=True, encoding='utf-8', bufsize=1)
        threading.Thread(target=self._read, args=(self.process.stdout,), daemon=True).start()
        try:
            if self.responses.get(timeout=self.timeout) != 'PRAXIS_READY':
                raise RuntimeError('Runtime exited before --machine became ready')
        except queue.Empty:
            self.close()
            raise RuntimeError('Runtime startup timed out; build the runtime with --machine support')

    def evaluate(self, script):
        if not isinstance(script, str) or not script.strip():
            raise ValueError('script must be a nonempty string')
        self.start()
        self.process.stdin.write(base64.b64encode(script.encode()).decode() + '\n')
        self.process.stdin.flush()
        try:
            line = self.responses.get(timeout=self.timeout)
        except queue.Empty:
            self.close()
            raise RuntimeError('Script timed out; runtime stopped to prevent mismatched replies. '
                               'Changes may have been applied; restart the MCP server.')
        if line is None:
            raise RuntimeError('PraxisCORE exited during script execution')
        kind, payload = line.split(' ', 1)
        result = base64.b64decode(payload).decode()
        if kind != 'PRAXIS_OK':
            raise RuntimeError(result)
        return result

    def close(self):
        if self.process and self.process.poll() is None:
            self.process.terminate()
            try:
                self.process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.process.kill()
                self.process.wait()


def tool(name, description, properties, required=()):
    return dict(name=name, description=description, inputSchema=dict(
        type='object', properties=properties, required=list(required), additionalProperties=False))


S = {'type': 'string'}
VALUE = {'type': ['string', 'number', 'boolean']}
TOOLS = [
    tool('mixer_status', 'Read live browser mixer state, Auto settings, decks and recording status. Does not launch Java.', {}),
    tool('mixer_auto', 'Configure Auto mode in the connected browser mixer. Commands require browser acknowledgment. '
         'Open http://127.0.0.1:8765 first. Unspecified settings are preserved.',
         {'enabled': {'type':'boolean'}, 'hold_seconds': {'type':'number','minimum':2,'maximum':300},
          'fade_seconds': {'type':'number','minimum':0.5,'maximum':60},
          'pool': {'enum':['all','original']}, 'rotate_blends': {'type':'boolean'}}),
    tool('mixer_next', 'Start Auto if stopped and advance to the next transition in the browser mixer.', {}),
    tool('runtime_status', 'Check the dedicated runtime process without starting it.', {}),
    tool('evaluate_script', 'Execute PCL, including multiline graph definitions and custom audio/video code. '
         'Scripts have the runtime user’s permissions. Failures may leave partial changes.', {'script': S}, ['script']),
    tool('create_component', 'Create an audio/video root or child, e.g. root:audio, root:video, audio:osc, video:player.',
         {'address': S, 'type': S}, ['address', 'type']),
    tool('remove_component', 'Remove a component or entire root graph.', {'address': S}, ['address']),
    tool('inspect_component', 'Read component info, children or connections. Info describes controls and ports.',
         {'address': S, 'query': {'enum': ['info', 'children', 'connections']}}, ['address']),
    tool('control', 'Read, set or invoke a control. Omit values to read/trigger; use [value] to set. '
         'Supports live code via the code control and media via resource controls.',
         {'address': S, 'control': S, 'values': {'type': 'array', 'items': VALUE}}, ['address', 'control']),
    tool('connect_ports', 'Connect sibling audio/video/data ports, e.g. /audio/osc!out to /audio/output!in-1.',
         {'source': S, 'target': S, 'disconnect': {'type': 'boolean'}}, ['source', 'target']),
    tool('pipeline', 'Start or stop an audio/video root pipeline. Starting audio can produce sound.',
         {'address': S, 'action': {'enum': ['start', 'stop']}}, ['address', 'action']),
    tool('component_catalog', 'List built-in component types from this checkout. Use info for actual controls.',
         {'prefix': S}),
]


def execute(runtime, name, args):
    if not isinstance(name, str):
        raise ValueError('tool name must be a string')
    definition = next((t for t in TOOLS if t['name'] == name), None)
    if definition is None:
        raise ValueError('Unknown tool: ' + name)
    if not isinstance(args, dict):
        raise ValueError('arguments must be an object')
    schema = definition['inputSchema']
    if set(args) - set(schema['properties']) or set(schema['required']) - set(args):
        raise ValueError('Unexpected or missing arguments')
    for key, value in args.items():
        spec = schema['properties'][key]
        if 'enum' in spec and value not in spec['enum']:
            raise ValueError('Invalid ' + key)
        if spec.get('type') == 'string' and not isinstance(value, str):
            raise ValueError(key + ' must be a string')
        if spec.get('type') == 'boolean' and not isinstance(value, bool):
            raise ValueError(key + ' must be a boolean')
        if spec.get('type') == 'number':
            if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
                raise ValueError(key + ' must be a finite number')
            if value < spec.get('minimum', -math.inf) or value > spec.get('maximum', math.inf):
                raise ValueError(key + ' is outside the supported range')
        if spec.get('type') == 'array' and not isinstance(value, list):
            raise ValueError(key + ' must be an array')
    if name in ('mixer_status', 'mixer_auto', 'mixer_next'):
        from browser_mixer import execute as browser_execute
        return browser_execute(name, args)
    if name == 'runtime_status':
        return {'running': runtime.process is not None and runtime.process.poll() is None,
                'command': runtime.command}
    if name == 'component_catalog':
        types = set()
        for path in REPO.glob('praxiscore-*/src/main/java/**/*.java'):
            if path.name.endswith(('Components.java', 'FactoryProvider.java')):
                types.update(re.findall(r'add(?:Root)?\(\s*"([a-z][a-z0-9:-]+)"', path.read_text()))
        return sorted(t for t in types if t.startswith(args.get('prefix', '')))
    if name == 'evaluate_script':
        return runtime.evaluate(args['script'])
    if name == 'connect_ports':
        def port(v):
            parts = v.split('!')
            if len(parts) != 2:
                raise ValueError('Expected /component!port')
            return address(parts[0]) + '!' + identifier(parts[1])
        script = ('!~' if args.get('disconnect', False) else '~') + ' ' + port(args['source']) + ' ' + port(args['target'])
    else:
        path = address(args['address'])
        if name == 'create_component':
            script = '@ ' + path + ' ' + token(args['type'], r'[a-z][a-z0-9]*(?::[a-z0-9-]+)+')
        elif name == 'remove_component':
            script = '!@ ' + path
        elif name == 'inspect_component':
            script = path + '.' + args.get('query', 'info')
        elif name == 'pipeline':
            if path.count('/') != 1:
                raise ValueError('pipeline address must be a root')
            script = path + '.' + args['action']
        else:
            script = path + '.' + identifier(args['control'])
            for value in args.get('values', []):
                script += ' ' + literal(value)
    return runtime.evaluate(script)


def handle(runtime, request):
    if not isinstance(request, dict) or request.get('jsonrpc') != '2.0' or not isinstance(request.get('method'), str):
        return {'jsonrpc': '2.0', 'id': None, 'error': {'code': -32600, 'message': 'Invalid Request'}}
    if 'id' not in request:
        return None
    response = {'jsonrpc': '2.0', 'id': request['id']}
    method, params = request['method'], request.get('params', {})
    if not isinstance(params, dict):
        response['error'] = {'code': -32602, 'message': 'params must be an object'}
        return response
    if method == 'initialize':
        supported = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05']
        version = params.get('protocolVersion')
        response['result'] = {'protocolVersion': version if version in supported else supported[0],
                              'serverInfo': {'name': 'praxis-live', 'version': '0.1.0'},
                              'capabilities': {'tools': {}},
                              'instructions': 'mixer_* tools control the live browser shader mixer through its localhost bridge. '
                              'Other tools control a dedicated PraxisCORE runtime, separate from the desktop IDE. '
                              'Inspect controls before use. New roots remain stopped until pipeline start.'}
    elif method == 'ping':
        response['result'] = {}
    elif method == 'tools/list':
        response['result'] = {'tools': TOOLS}
    elif method == 'tools/call':
        try:
            result = execute(runtime, params.get('name', ''), params.get('arguments', {}))
            response['result'] = {'content': [{'type': 'text', 'text': json.dumps(result, ensure_ascii=False)}]}
        except (ValueError, RuntimeError, OSError) as exc:
            response['result'] = {'isError': True, 'content': [{'type': 'text', 'text': str(exc)}]}
    else:
        response['error'] = {'code': -32601, 'message': 'Method not found'}
    return response


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--runtime', default=str(REPO / 'praxiscore-bin/target/praxiscore/bin/praxis'))
    parser.add_argument('--timeout', type=float, default=30)
    options = parser.parse_args()
    if options.timeout <= 0 or not math.isfinite(options.timeout):
        parser.error('--timeout must be finite and positive')
    runtime = Runtime([options.runtime, '--machine'], options.timeout)
    try:
        for line in sys.stdin:
            try:
                request = json.loads(line)
                response = handle(runtime, request)
            except (json.JSONDecodeError, UnicodeError):
                response = {'jsonrpc': '2.0', 'id': None, 'error': {'code': -32700, 'message': 'Parse error'}}
            if response is not None:
                print(json.dumps(response, ensure_ascii=False), flush=True)
    finally:
        runtime.close()


if __name__ == '__main__':
    main()
