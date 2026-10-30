"""Validate and render each GLSL preset in an offscreen macOS OpenGL context."""
import ctypes as C
from pathlib import Path
import subprocess
from build_project import HERE, wrap

G=C.CDLL('/System/Library/Frameworks/OpenGL.framework/OpenGL')
def fn(name, result, *args):
    f=getattr(G,name); f.restype=result; f.argtypes=list(args); return f
I=C.c_int; U=C.c_uint; P=C.c_void_p; F=C.c_float
choose=fn('CGLChoosePixelFormat',I,C.POINTER(I),C.POINTER(P),C.POINTER(I))
create=fn('CGLCreateContext',I,P,P,C.POINTER(P)); current=fn('CGLSetCurrentContext',I,P)
p=P(); n=I(); ctx=P(); attributes=(I*3)(73,96,0)
if choose(attributes,C.byref(p),C.byref(n)) or create(p,None,C.byref(ctx)):
    raise SystemExit('Offscreen GPU context unavailable; run with desktop GPU access.')
current(ctx)
shader=fn('glCreateShader',U,U); source=fn('glShaderSource',None,U,I,C.POINTER(C.c_char_p),P)
compile_=fn('glCompileShader',None,U); getshader=fn('glGetShaderiv',None,U,U,C.POINTER(I))
shaderlog=fn('glGetShaderInfoLog',None,U,I,P,C.c_char_p)
program=fn('glCreateProgram',U); attach=fn('glAttachShader',None,U,U); link=fn('glLinkProgram',None,U)
getprogram=fn('glGetProgramiv',None,U,U,C.POINTER(I)); programlog=fn('glGetProgramInfoLog',None,U,I,P,C.c_char_p)
use=fn('glUseProgram',None,U); location=fn('glGetUniformLocation',I,U,C.c_char_p)
one=fn('glUniform1f',None,I,F); two=fn('glUniform2f',None,I,F,F)

def compile_shader(text, kind):
    s=shader(kind); data=C.c_char_p(text.encode()); source(s,1,C.byref(data),None); compile_(s)
    ok=I(); getshader(s,0x8B81,C.byref(ok))
    if not ok.value:
        buf=C.create_string_buffer(8192); shaderlog(s,8192,None,buf); raise RuntimeError(buf.value.decode())
    return s

# Offscreen RGBA renderbuffer; no Cocoa window or first-thread event loop needed.
fbo=U(); rb=U()
fn('glGenFramebuffersEXT',None,I,C.POINTER(U))(1,C.byref(fbo))
fn('glBindFramebufferEXT',None,U,U)(0x8D40,fbo)
fn('glGenRenderbuffersEXT',None,I,C.POINTER(U))(1,C.byref(rb))
fn('glBindRenderbufferEXT',None,U,U)(0x8D41,rb)
fn('glRenderbufferStorageEXT',None,U,U,I,I)(0x8D41,0x8058,512,512)
fn('glFramebufferRenderbufferEXT',None,U,U,U,U)(0x8D40,0x8CE0,0x8D41,rb)
assert fn('glCheckFramebufferStatusEXT',U,U)(0x8D40)==0x8CD5
fn('glViewport',None,I,I,I,I)(0,0,512,512)
v=compile_shader('void main(){gl_Position=gl_Vertex;}',0x8B31)
try:
    for name in ['RGBlaserflower','PBwormhole','aurora','starfield','prism-tunnel','liquid-lattice']:
        if not (HERE/'shaders'/f'{name}.frag').exists():
            continue
        f=compile_shader(wrap((HERE/'shaders'/f'{name}.frag').read_text()),0x8B30)
        prog=program();attach(prog,v);attach(prog,f);link(prog)
        ok=I();getprogram(prog,0x8B82,C.byref(ok))
        if not ok.value:
            buf=C.create_string_buffer(8192);programlog(prog,8192,None,buf);raise RuntimeError(buf.value.decode())
        use(prog)
        for key,values in {'time':(6.,),'resolution':(512.,512.),'mouse':(.65,.5),'uEnergy':(.6,),
                           'uBrightness':(.85,),'uZoom':(1.,),'uReaction':(.55,)}.items():
            loc=location(prog,key.encode())
            if loc>=0:(one if len(values)==1 else two)(loc,*values)
        fn('glBegin',None,U)(0x0007)
        vertex=fn('glVertex2f',None,F,F)
        for x,y in [(-1,-1),(1,-1),(1,1),(-1,1)]:vertex(x,y)
        fn('glEnd',None)();fn('glFinish',None)()
        data=(C.c_ubyte*(512*512*4))();fn('glReadPixels',None,I,I,I,I,U,U,P)(0,0,512,512,0x1908,0x1401,data)
        assert max(data[0::4])>10, 'Unexpected black GPU frame'
        subprocess.run(['ffmpeg','-y','-loglevel','error','-f','rawvideo','-pixel_format','rgba',
                        '-video_size','512x512','-i','pipe:0','-vf','vflip','-frames:v','1',
                        str(HERE/f'preview-{name.lower()}.png')],input=bytes(data),check=True)
        print('Compiled, linked and rendered on GPU:',name,flush=True)
finally:
    current(None);fn('CGLDestroyContext',I,P)(ctx);fn('CGLDestroyPixelFormat',None,P)(p)
