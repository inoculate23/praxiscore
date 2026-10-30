"""Verify the full 4K GPU target allocation used by the two-deck player."""
import ctypes as C
from build_project import HERE
setup=(HERE/'check_gpu.py').read_text().split('# Offscreen RGBA renderbuffer;')[0]
exec(compile(setup,str(HERE/'check_gpu.py'),'exec'))
get=fn('glGetIntegerv',None,U,C.POINTER(I));maximum=I();get(0x0D33,C.byref(maximum))
assert maximum.value>=4096,f'Max texture size is {maximum.value}'
fb=U();fn('glGenFramebuffersEXT',None,I,C.POINTER(U))(1,C.byref(fb));fn('glBindFramebufferEXT',None,U,U)(0x8D40,fb)
textures=(U*4)();fn('glGenTextures',None,I,C.POINTER(U))(4,textures)
try:
    for width,height in [(4096,4096),(3840,2160)]:
        for texture in textures:
            fn('glBindTexture',None,U,U)(0x0DE1,texture)
            fn('glTexImage2D',None,U,I,I,I,I,I,U,U,P)(0x0DE1,0,0x1908,width,height,0,0x1908,0x1401,None)
            fn('glTexParameteri',None,U,U,I)(0x0DE1,0x2801,0x2601)
            fn('glFramebufferTexture2DEXT',None,U,U,U,U,I)(0x8D40,0x8CE0,0x0DE1,texture,0)
            assert fn('glCheckFramebufferStatusEXT',U,U)(0x8D40)==0x8CD5
        fn('glViewport',None,I,I,I,I)(0,0,width,height)
        fn('glClearColor',None,F,F,F,F)(.2,.4,.6,1.)
        fn('glClear',None,U)(0x4000);fn('glFinish',None)()
        pixel=(C.c_ubyte*4)();fn('glReadPixels',None,I,I,I,I,U,U,P)(width-1,height-1,1,1,0x1908,0x1401,pixel)
        assert pixel[0]>0 and pixel[2]>0
        assert fn('glGetError',U)()==0
        print(f'4K GPU allocation/readback passed: four {width} x {height} deck/feedback targets.',flush=True)
finally:
    current(None);fn('CGLDestroyContext',I,P)(ctx);fn('CGLDestroyPixelFormat',None,P)(p)
