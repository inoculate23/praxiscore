import threading
import time
import unittest
from mixer_bridge import MixerBridge


class BridgeTests(unittest.TestCase):
    def test_no_browser_is_an_error(self):
        with self.assertRaisesRegex(ValueError,'No live mixer'):
            MixerBridge().command(dict(action='auto',args=dict(enabled=True)))

    def test_command_requires_browser_acknowledgment(self):
        bridge=MixerBridge();bridge.sync(dict(client_id='test',state={},acks=[]))
        result=[]
        thread=threading.Thread(target=lambda:result.append(bridge.command(dict(action='auto',args=dict(enabled=True)),1)))
        thread.start()
        for _ in range(100):
            reply=bridge.sync(dict(client_id='test',state={},acks=[]))
            if reply['commands']:break
            time.sleep(.001)
        command=reply['commands'][0]
        self.assertTrue(thread.is_alive())
        bridge.sync(dict(client_id='test',state={'auto':{'enabled':True}},acks=[dict(id=command['id'],ok=True,state={'auto':{'enabled':True}})]))
        thread.join(1);self.assertEqual(result,[{'auto':{'enabled':True}}])
        self.assertEqual(bridge.status()['pending'],0)

    def test_validation_and_second_tab(self):
        bridge=MixerBridge();bridge.sync(dict(client_id='first',state={}))
        for args in [dict(enabled='true'),dict(fade_seconds=0),dict(hold_seconds=float('nan')),dict(pool='bad')]:
            with self.assertRaises(ValueError):bridge.command(dict(action='auto',args=args))
        with self.assertRaisesRegex(ValueError,'Another mixer tab'):
            bridge.sync(dict(client_id='second',state={}))

    def test_timeout_does_not_report_success(self):
        bridge=MixerBridge();bridge.sync(dict(client_id='test',state={}))
        with self.assertRaisesRegex(ValueError,'effect is unknown'):
            bridge.command(dict(action='next'),.01)
        self.assertEqual(bridge.status()['pending'],0)


if __name__=='__main__':unittest.main()
