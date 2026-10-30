"""Thread-safe command/acknowledgment bridge to the live browser mixer."""
import math
import threading
import time
import uuid

DEFAULTS = dict(enabled=False, hold_seconds=12, fade_seconds=4, pool='all', rotate_blends=False)


def validate_auto(args):
    if not isinstance(args, dict) or set(args)-set(DEFAULTS):
        raise ValueError('Unknown Auto setting')
    for key, value in args.items():
        if key in ('enabled', 'rotate_blends') and not isinstance(value, bool):
            raise ValueError(key + ' must be boolean')
        if key == 'pool' and value not in ('original', 'all'):
            raise ValueError('pool must be original or all')
        if key in ('hold_seconds', 'fade_seconds'):
            lo, hi = (2, 300) if key == 'hold_seconds' else (0.5, 60)
            if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or not lo <= value <= hi:
                raise ValueError(f'{key} must be between {lo} and {hi}')
    return args


class MixerBridge:
    def __init__(self):
        self.condition = threading.Condition()
        self.client = None
        self.last_seen = 0
        self.state = {}
        self.pending = {}

    def status(self):
        with self.condition:
            return dict(connected=time.monotonic()-self.last_seen < 4,
                        browser=self.state, pending=len(self.pending))

    def sync(self, data):
        if not isinstance(data, dict) or not isinstance(data.get('client_id'), str) or len(data['client_id'])>100:
            raise ValueError('Invalid browser client')
        if not isinstance(data.get('state'), dict) or not isinstance(data.get('acks', []), list):
            raise ValueError('Invalid browser state or acknowledgments')
        with self.condition:
            now = time.monotonic()
            if self.client not in (None, data['client_id']) and now-self.last_seen<4:
                raise ValueError('Another mixer tab is active. Use one control tab.')
            self.client, self.last_seen, self.state = data['client_id'], now, data['state']
            for ack in data.get('acks', []):
                if isinstance(ack, dict) and ack.get('id') in self.pending:
                    self.pending[ack['id']]['result'] = ack
            self.condition.notify_all()
            return dict(commands=[dict(id=key, action=value['action'], args=value['args'])
                                  for key, value in self.pending.items() if 'result' not in value])

    def command(self, data, timeout=6):
        if not isinstance(data, dict) or data.get('action') not in ('auto', 'next'):
            raise ValueError('Unknown mixer command')
        args = data.get('args', {})
        if data['action']=='auto': validate_auto(args)
        elif args != {}: raise ValueError('next accepts no arguments')
        with self.condition:
            if time.monotonic()-self.last_seen>=4:
                raise ValueError('No live mixer browser connected. Open or reload http://127.0.0.1:8765 first.')
            key = uuid.uuid4().hex
            item = self.pending[key] = dict(action=data['action'], args=args)
            try:
                if not self.condition.wait_for(lambda: 'result' in item, timeout):
                    raise ValueError('Browser did not acknowledge the command; its effect is unknown. Check mixer_status.')
                result=item['result']
                if not result.get('ok'): raise ValueError(result.get('error', 'Browser rejected command'))
                return result.get('state', {})
            finally:
                self.pending.pop(key, None)
