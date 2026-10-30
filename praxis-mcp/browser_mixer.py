"""MCP operations for the browser shader mixer's acknowledged localhost bridge."""
import json
import os
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen


def request(path, payload=None):
    base=os.environ.get('PRAXIS_MIXER_URL','http://127.0.0.1:8765').rstrip('/')
    parsed=urlparse(base)
    if parsed.scheme!='http' or parsed.hostname not in ('127.0.0.1','localhost') or parsed.path or parsed.username:
        raise ValueError('PRAXIS_MIXER_URL must be an HTTP localhost origin')
    data=None if payload is None else json.dumps(payload,allow_nan=False).encode()
    req=Request(base+path,data=data,headers={'Content-Type':'application/json'})
    try:
        with urlopen(req,timeout=8) as response:return json.load(response)
    except HTTPError as error:
        try: message=json.load(error).get('error',str(error))
        except (ValueError,AttributeError): message=str(error)
        raise RuntimeError(message) from error
    except (URLError,TimeoutError) as error:
        raise RuntimeError('Mixer bridge unavailable. Start examples/shader-mixer/serve.py and open the mixer. '+str(error)) from error


def execute(name,args):
    if name=='mixer_status': return request('/api/mixer/status')
    return request('/api/mixer/command',dict(action='auto' if name=='mixer_auto' else 'next',args=args))
