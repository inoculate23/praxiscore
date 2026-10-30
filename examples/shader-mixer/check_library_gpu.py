"""Compile/link every imported shader on macOS and save a compatibility report."""
import ctypes as C
import json
import re
from pathlib import Path
from build_project import HERE

# Reuse the offscreen context and shader API setup without its four-frame runner.
setup = (HERE / 'check_gpu.py').read_text().split('# Offscreen RGBA renderbuffer;')[0]
exec(compile(setup, str(HERE / 'check_gpu.py'), 'exec'))
vertex = compile_shader('attribute vec2 position; varying vec2 uv; void main(){uv=position*.5+.5;gl_Position=vec4(position,0.,1.);}', 0x8B31)
library_text = (HERE/'player/library.js').read_text().removeprefix('const SHADER_LIBRARY = ').strip().removesuffix(';')
entries=json.loads(library_text)
player = (HERE/'player/player.js').read_text()
for name in ['videoSource', 'mixSource']:
    entries.append(dict(name=name, source=re.search(r'const ' + name + r'\s*=\s*`([^`]+)`', player)[1].replace('${DOME_PROJECTION}',(HERE/'projection.glsl').read_text())))
report=[]
try:
    for entry in entries:
        try:
            text = re.sub(r'precision\s+(?:highp|mediump|lowp)\s+float\s*;', '', entry['source'])
            fragment=compile_shader(text,0x8B30)
            prog=program();attach(prog,vertex);attach(prog,fragment);link(prog)
            ok=I();getprogram(prog,0x8B82,C.byref(ok))
            if not ok.value:
                buf=C.create_string_buffer(8192);programlog(prog,8192,None,buf);raise RuntimeError(buf.value.decode())
            fn('glDeleteProgram',None,U)(prog);fn('glDeleteShader',None,U)(fragment)
            report.append(dict(name=entry['name'],compiled=True))
        except RuntimeError as error:
            report.append(dict(name=entry['name'],compiled=False,error=str(error)))
    (HERE/'shader-gpu-report.json').write_text(json.dumps(report,indent=2)+'\n')
    print('Desktop GPU compiled/linked:',sum(r['compiled'] for r in report),'/',len(report),flush=True)
    for result in report:
        if not result['compiled']: print(result['name'],result['error'].splitlines()[0],flush=True)
finally:
    current(None);fn('CGLDestroyContext',I,P)(ctx);fn('CGLDestroyPixelFormat',None,P)(p)
