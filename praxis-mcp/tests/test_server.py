import io
import json
from pathlib import Path
import subprocess
import sys
import unittest
from unittest.mock import Mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from server import REPO, Runtime, execute, handle, literal


class ProtocolTests(unittest.TestCase):
    def setUp(self):
        self.runtime = Mock()
        self.runtime.evaluate.return_value = 'ok'

    def test_negotiation_and_discovery(self):
        response = handle(self.runtime, {'jsonrpc': '2.0', 'id': 1, 'method': 'initialize',
                                        'params': {'protocolVersion': '2025-06-18'}})
        self.assertEqual(response['result']['protocolVersion'], '2025-06-18')
        listing = handle(self.runtime, {'jsonrpc': '2.0', 'id': 2, 'method': 'tools/list'})
        self.assertEqual(len(listing['result']['tools']), 12)
        self.assertIsNone(handle(self.runtime, {'jsonrpc': '2.0', 'method': 'notifications/initialized'}))

    def test_control_validation_prevents_script_injection(self):
        for args in [dict(address='/a; !@ /b', control='x'),
                     dict(address='/a', control='x\n!@ /b'),
                     dict(address='/a', control='x', values='bad'),
                     dict(address='/a', control='x', values=[{}])]:
            with self.assertRaises(ValueError):
                execute(self.runtime, 'control', args)
        self.runtime.evaluate.assert_not_called()

    def test_port_and_pipeline_validation(self):
        execute(self.runtime, 'connect_ports', {'source': '/a/x!out', 'target': '/a/y!in'})
        self.runtime.evaluate.assert_called_with('~ /a/x!out /a/y!in')
        with self.assertRaises(ValueError):
            execute(self.runtime, 'pipeline', {'address': '/a', 'action': 'delete'})
        with self.assertRaises(ValueError):
            execute(self.runtime, 'connect_ports', {'source': '/a!x', 'target': '/b!y', 'disconnect': 'false'})

    def test_tool_errors(self):
        self.runtime.evaluate.side_effect = RuntimeError('compile failed')
        result = handle(self.runtime, {'jsonrpc': '2.0', 'id': 3, 'method': 'tools/call',
                                      'params': {'name': 'evaluate_script', 'arguments': {'script': 'bad'}}})
        self.assertTrue(result['result']['isError'])
        self.assertIn('compile failed', result['result']['content'][0]['text'])

    def test_catalog(self):
        types = execute(self.runtime, 'component_catalog', {'prefix': 'audio:'})
        self.assertIn('audio:osc', types)
        self.assertTrue(all(t.startswith('audio:') for t in types))

    def test_stdio(self):
        requests = '\n'.join([json.dumps({'jsonrpc': '2.0', 'id': 1, 'method': 'tools/list'}),
                               'bad json', '[]']) + '\n'
        result = subprocess.run([sys.executable, str(REPO / 'praxis-mcp/server.py')],
                                input=requests, capture_output=True, text=True, check=True)
        messages = [json.loads(line) for line in result.stdout.splitlines()]
        self.assertIn('tools', messages[0]['result'])
        self.assertEqual(messages[1]['error']['code'], -32700)
        self.assertEqual(messages[2]['error']['code'], -32600)


@unittest.skipUnless((REPO / 'praxiscore-bin/target/praxiscore/bin/praxis').exists(), 'Build runtime first')
class RuntimeIntegrationTests(unittest.TestCase):
    def setUp(self):
        self.runtime = Runtime([str(REPO / 'praxiscore-bin/target/praxiscore/bin/praxis'), '--machine'])

    def tearDown(self):
        self.runtime.close()
        if self.runtime.process:
            self.runtime.process.stdin.close()
            self.runtime.process.stdout.close()

    def test_audio_video_graph_and_errors(self):
        self.runtime.evaluate('''@ /audio root:audio {
            @ ./osc audio:osc { .frequency 220; .level 0.05 }
            @ ./output audio:output
            ~ ./osc!out ./output!in-1
        }
        @ /video root:video {
            @ ./noise video:source:noise
            @ ./output video:output
            ~ ./noise!out ./output!in
        }''')
        self.assertEqual(execute(self.runtime, 'control', {'address': '/audio/osc', 'control': 'frequency'}), '220')
        self.assertIn('osc', execute(self.runtime, 'inspect_component', {'address': '/audio', 'query': 'children'}))
        self.assertIn('out', self.runtime.evaluate('/video/noise.info'))
        self.assertIn('osc', self.runtime.evaluate('/audio.connections'))
        execute(self.runtime, 'connect_ports', {'source': '/audio/osc!out', 'target': '/audio/output!in-1', 'disconnect': True})
        execute(self.runtime, 'pipeline', {'address': '/audio', 'action': 'stop'})
        execute(self.runtime, 'pipeline', {'address': '/video', 'action': 'stop'})
        with self.assertRaises(RuntimeError):
            self.runtime.evaluate('/audio/nonexistent.info')
        # A failed command must not poison the next response.
        self.assertEqual(self.runtime.evaluate('/audio/osc.frequency'), '220')
        execute(self.runtime, 'remove_component', {'address': '/video/noise'})
        self.assertNotIn('noise', self.runtime.evaluate('/video.children'))

    def test_literal_roundtrip(self):
        self.runtime.evaluate('@ /video root:video { @ ./output video:output }')
        value = 'Title "quoted" $variable [not-a-command] \\ path\nnext line'
        execute(self.runtime, 'control', {'address': '/video/output', 'control': 'title', 'values': [value]})
        self.assertEqual(self.runtime.evaluate('/video/output.title'), value)

    def test_timeout_stops_runtime(self):
        code = "import time; print('PRAXIS_READY', flush=True); time.sleep(60)"
        self.runtime = Runtime([sys.executable, '-u', '-c', code], timeout=0.1)
        with self.assertRaisesRegex(RuntimeError, 'timed out'):
            self.runtime.evaluate('ignored')
        self.assertIsNotNone(self.runtime.process.poll())


if __name__ == '__main__':
    unittest.main()
