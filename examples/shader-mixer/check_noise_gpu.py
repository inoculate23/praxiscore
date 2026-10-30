"""Check noise bypass, modulation, dome masking and blackout with real GPU pixels."""
import ctypes as C
import re
from build_project import HERE, wrap

setup=(HERE/'check_gpu.py').read_text().split("v=compile_shader(")[0]
exec(compile(setup,str(HERE/'check_gpu.py'),'exec'))
vertex=compile_shader('varying vec2 uv;void main(){gl_Position=gl_Vertex;uv=gl_Vertex.xy*.5+.5;}',0x8B31)
text=re.search(r'const mixSource\s*=\s*`([^`]+)`',(HERE/'player/player.js').read_text())[1]
fragment=compile_shader(re.sub(r'precision\s+highp\s+float;', '', text),0x8B30)
prog=program();attach(prog,vertex);attach(prog,fragment);link(prog)
ok=I();getprogram(prog,0x8B82,C.byref(ok));assert ok.value
use(prog)
integer=fn('glUniform1i',None,I,I)
textures=(U*2)();fn('glGenTextures',None,I,C.POINTER(U))(2,textures)
for layer in range(2):
    fn('glActiveTexture',None,U)(0x84C0+layer)
    fn('glBindTexture',None,U,U)(0x0DE1,textures[layer])
    pixels=bytearray()
    for y in range(512):
        for x in range(512):
            inside=(x/511*2-1)**2+(y/511*2-1)**2<.985**2
            pixels.extend((((x//8+layer)%2)*180,((y//8+layer)%2)*180,80+layer*70,255) if inside else (0,0,0,255))
    data=(C.c_ubyte*len(pixels)).from_buffer(pixels)
    fn('glTexImage2D',None,U,I,I,I,I,I,U,U,P)(0x0DE1,0,0x1908,512,512,0,0x1908,0x1401,data)
    for attr,val in [(0x2801,0x2601),(0x2800,0x2601),(0x2802,0x812F),(0x2803,0x812F)]:
        fn('glTexParameteri',None,U,U,I)(0x0DE1,attr,val)
    integer(location(prog,('a' if layer==0 else 'b').encode()),layer)
for name,value in {'amount':.5,'noiseTime':2.,'noiseGrain':.25,'noiseWarp':.5,'noiseScale':12.,'noiseAudio':1.}.items():one(location(prog,name.encode()),value)
integer(location(prog,b'mode'),0)

def render(enabled,energy=0,blackout=0):
    integer(location(prog,b'noiseEnabled'),enabled);integer(location(prog,b'blackout'),blackout)
    one(location(prog,b'energy'),energy)
    fn('glBegin',None,U)(0x0007)
    for x,y in [(-1,-1),(1,-1),(1,1),(-1,1)]:fn('glVertex2f',None,F,F)(x,y)
    fn('glEnd',None)();fn('glFinish',None)()
    data=(C.c_ubyte*(512*512*4))();fn('glReadPixels',None,I,I,I,I,U,U,P)(0,0,512,512,0x1908,0x1401,data)
    return bytes(data)

try:
    # Every blend mode must reach exactly the same pure A and pure B frames.
    one(location(prog,b'amount'),0);expected_a=render(0)
    one(location(prog,b'amount'),1);expected_b=render(0)
    assert expected_a!=expected_b
    for mode in range(13):
        integer(location(prog,b'mode'),mode)
        one(location(prog,b'amount'),0);assert render(0)==expected_a, f'Mode {mode} leaks B at A endpoint'
        one(location(prog,b'amount'),1);assert render(0)==expected_b, f'Mode {mode} leaks A at B endpoint'
    integer(location(prog,b'mode'),0);one(location(prog,b'amount'),.5)
    print('GPU pixel checks passed: pure A/B endpoints in all 13 blend modes.',flush=True)
    bypass=render(0)
    assert bypass==render(0,1), 'Disabled noise must not respond to audio'
    noise=render(1)
    audio=render(1,1)
    assert noise!=bypass, 'Noise must change the output'
    assert audio!=noise, 'Audio must modulate noise'
    assert noise[:3]==b'\x00\x00\x00' and audio[:3]==b'\x00\x00\x00', 'Dome outside must remain black'
    black=render(1,1,1)
    assert not any(value for i,value in enumerate(black) if i%4!=3), 'Blackout must suppress grain too'
    print('GPU pixel checks passed: bypass, noise, audio modulation, dome mask, blackout.',flush=True)
    # A constant shader fills rectangle corners but must mask them in dome mode.
    frag=compile_shader(wrap('uniform vec2 resolution; uniform float time; uniform vec2 mouse; void main(){gl_FragColor=vec4(0.6,0.4,0.2,1.0);}'),0x8B30)
    prog=program();attach(prog,vertex);attach(prog,frag);link(prog);use(prog)
    for name,value in {'uBrightness':1.,'uZoom':1.,'uEnergy':0.,'uReaction':0.}.items():one(location(prog,name.encode()),value)
    two(location(prog,b'resolution'),512.,512.)
    integer(location(prog,b'uRect'),0);dome=render(0)
    integer(location(prog,b'uRect'),1);rectangle=render(0)
    assert dome[:3]==b'\x00\x00\x00'
    assert all(v>0 for v in rectangle[:3]), 'Rectangle corners must contain shader output'
    print('GPU pixel checks passed: dome mask and full-frame rectangular output.',flush=True)
finally:
    current(None);fn('CGLDestroyContext',I,P)(ctx);fn('CGLDestroyPixelFormat',None,P)(p)
