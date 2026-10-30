"""Compare GPU reprojection pixels against independent ray-mapping landmarks."""
import ctypes as C
import math
from build_project import HERE,wrap
setup=(HERE/'check_gpu.py').read_text().split('v=compile_shader(')[0]
exec(compile(setup,str(HERE/'check_gpu.py'),'exec'))
v=compile_shader('void main(){gl_Position=gl_Vertex;}',0x8B31)
f=compile_shader(wrap('uniform vec2 resolution; void main(){gl_FragColor=vec4(gl_FragCoord.xy/resolution,0.2,1.0);}'),0x8B30)
pid=program();attach(pid,v);attach(pid,f);link(pid);ok=I();getprogram(pid,0x8B82,C.byref(ok));assert ok.value
use(pid);integer=fn('glUniform1i',None,I,I)
for key,value in {'uBrightness':1.,'uZoom':1.,'uSourceAspect':1.,'uSourceFov':90.}.items():one(location(pid,key.encode()),value)
two(location(pid,b'resolution'),512.,512.)

def render(mode,x,y):
    integer(location(pid,b'uProjection'),mode)
    fn('glBegin',None,U)(0x0007)
    for a,b in [(-1,-1),(1,-1),(1,1),(-1,1)]:fn('glVertex2f',None,F,F)(a,b)
    fn('glEnd',None)();fn('glFinish',None)()
    pixel=(C.c_ubyte*4)();fn('glReadPixels',None,I,I,I,I,U,U,P)(x,y,1,1,0x1908,0x1401,pixel)
    return list(pixel)

def expected(mode,x,y):
    px,py=(2*(x+.5)-512)/512,(2*(y+.5)-512)/512
    r=math.hypot(px,py);theta=r*math.pi/2
    ray=(px*math.sin(theta)/r,py*math.sin(theta)/r,math.cos(theta))
    if mode==0:return (.5+ray[0]/ray[2]/2,.5+ray[1]/ray[2]/2)
    if mode==1:return ((math.atan2(ray[0],ray[1])/(2*math.pi)+.5)%1,.5+math.asin(ray[2])/math.pi)
    return ((x+.5)/512,(y+.5)/512)

try:
    for mode in range(3):
        for x,y in [(256,256),(352,256),(256,352)]:
            uv=expected(mode,x,y);pixel=render(mode,x,y)
            for i in range(2):assert abs(pixel[i]/255-uv[i]/(1+uv[i]))<.009,(mode,x,y,uv,pixel)
    assert render(0,448,256)[:3]==[0,0,0], 'Perspective 90-degree source must clip outside its FOV'
    assert render(1,448,256)[0]>0, '360 panorama must cover the horizonward region'
    print('GPU projection landmarks passed: perspective tangent, panorama longitude/latitude, fisheye identity and FOV clipping.',flush=True)
finally:
    current(None);fn('CGLDestroyContext',I,P)(ctx);fn('CGLDestroyPixelFormat',None,P)(p)
