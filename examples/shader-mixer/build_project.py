"""Generate a portable PraxisLIVE project with embedded GPU shader sources."""
import json
import hashlib
from pathlib import Path
import re
import sys
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1] / 'praxis-mcp'))
from server import literal


def wrap(source):
    active = re.sub(r'/\*.*?\*/|//[^\n]*', '', source, flags=re.S)
    for kind, name in [('vec2', 'mouse'), ('vec2', 'resolution'), ('float', 'time')]:
        if not re.search(r'uniform\s+' + kind + r'\s+' + name + r'\s*;', active):
            source = f'uniform {kind} {name};\n' + source
    source = re.sub(r'\bgl_FragColor\b', 'effectColor', source)
    source = re.sub(r'\bgl_FragCoord\b', 'domeCoord()', source)
    source = re.sub(r'\bvoid\s+main\s*\(', 'void effectMain(', source)
    # The legacy wormhole divides by its distance from a moving center.
    source = source.replace('q=f/r;', 'q=f/max(r,0.0001);')
    source = source.replace('float halfpi = asin(1.0);', 'const float halfpi = 1.57079632679;')
    return '''#define PROCESSING_COLOR_SHADER
uniform float uEnergy;
uniform float uBrightness;
uniform float uZoom;
uniform float uReaction;
uniform bool uRect;
vec4 effectColor;
vec4 domeCoord();
''' + source + '''
__PROJECTION__
vec4 domeCoord() {
    float zoom = max(0.1, uZoom * (uGrid ? 1.0 : (1.0 + uEnergy * uReaction * 0.25)));
    return vec4(sourceUV(gl_FragCoord.xy, resolution, uRect, zoom) * resolution, 0.0, 1.0);
}
void main() {
    vec2 p = (2.0 * gl_FragCoord.xy - resolution.xy) / min(resolution.x, resolution.y);
    float r = length(p);
    if ((!uRect && r >= 1.0) || uBrightness <= 0.0) { gl_FragColor = vec4(0.0,0.0,0.0,1.0); return; }
    vec2 uv = sourceUV(gl_FragCoord.xy, resolution, uRect, max(0.1, uZoom * (uGrid ? 1.0 : (1.0 + uEnergy * uReaction * 0.25))));
    if (!validUV(uv)) { gl_FragColor = vec4(0.0,0.0,0.0,1.0); return; }
    effectColor = vec4(0.0);
    if (uGrid) effectColor = vec4(calibrationGrid(uv), 1.0);
    else effectMain();
    vec3 c = max(effectColor.rgb, vec3(0.0));
    c = c / (vec3(1.0) + c);
    c *= uBrightness * (uGrid ? 1.0 : (1.0 + uEnergy * uReaction * 0.7));
    if (!uRect) c *= 1.0 - smoothstep(0.985, 1.0, r);
    gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}
'''.replace('__PROJECTION__', (HERE / 'projection.glsl').read_text())


def main():
    filenames = ['RGBlaserflower.frag', 'PBwormhole.frag', 'aurora.frag', 'starfield.frag', 'prism-tunnel.frag', 'liquid-lattice.frag']
    sources = [wrap((HERE / 'shaders' / (name if (HERE/'shaders'/name).exists() else ('aurora.frag' if i==0 else 'starfield.frag'))).read_text()) for i,name in enumerate(filenames)]
    (HERE / 'player/shaders.js').write_text('const SHADERS = ' + json.dumps(['precision highp float;\n' + source for source in sources]) + ';\n')
    (HERE / 'player/projection.js').write_text('const DOME_PROJECTION = ' + json.dumps((HERE / 'projection.glsl').read_text()) + ';\n')
    from shader_library import build_library
    build_library(HERE, wrap)
    # Browsers may retain a previous generated shader after the project changes.
    page = HERE / 'player/index.html'
    html = page.read_text()
    for name in ['shaders.js', 'library.js', 'projection.js', 'auto-mode.js', 'player.js']:
        version = hashlib.sha256((HERE / 'player' / name).read_bytes()).hexdigest()[:12]
        html = re.sub(r'src="' + re.escape(name) + r'(?:\?[^\"]*)?"',
                      f'src="{name}?v={version}"', html)
    page.write_text(html)
    code = (HERE / 'deck.pxj').read_text().replace('SHADER_SOURCES', 'new String[]{' +
                        ',\n'.join(json.dumps(s) for s in sources) + '}')
    # Preserve local imported presets, but make a fresh checkout work without them.
    imported = [(HERE/'shaders'/name).exists() for name in filenames[:2]]
    available = ([name for name,present in zip(['LaserFlower','Wormhole'],imported) if present] + ['Aurora','Stars','PrismTunnel','LiquidLattice'])
    code = code.replace('allowed={"LaserFlower", "Wormhole", "Aurora", "Stars"}, def="LaserFlower"',
                        'allowed={' + ','.join(json.dumps(name) for name in available) + '}, def=' + json.dumps(available[0]))
    video = '@ /video root:video {\n .renderer OpenGL\n .width 4096\n .height 4096\n .fps 60\n'
    for deck, preset in [('deck-a', available[0]), ('deck-b', 'Aurora' if imported[0] else 'Stars')]:
        video += f' @ ./{deck} video:gl:p2d {{\n .code {literal(code)}\n .preset {preset}\n .speed 0.4\n .zoom 1\n .reaction 0.55\n }}\n'
    video += ' @ ./control core:custom {\n .code ' + literal((HERE / 'controller.pxj').read_text()) + '\n .crossfade 0.5\n .audio-mix 0.25\n .sensitivity 8\n .brightness 0.75\n }\n'
    video += ''' @ ./mix video:composite { .mix 0.5 }
 @ ./output video:output { .title "Audio Reactive Dome | Shader Mixer" }
 ~ ./deck-a!out ./mix!in
 ~ ./deck-b!out ./mix!src
 ~ ./mix!out ./output!in
}
'''
    (HERE / 'video.pxr').write_text(video)
    audio = (HERE.parent / 'audio-reactive-dome/audio.pxr').read_text().replace('/video/dome.energy', '/video/control.energy')
    (HERE / 'audio.pxr').write_text(audio)
    gui = '@ /gui root:gui {\n'
    def control(name, kind, label, binding, layout):
        return f' @ ./{name} gui:{kind} {{ .label {literal(label)}; .binding {binding}; .layout {literal(layout)} }}\n'
    for col, deck in enumerate(['deck-a', 'deck-b']):
        label = 'Deck A' if col == 0 else 'Deck B'
        for row, (prop, kind) in enumerate([('preset', 'combobox'), ('speed', 'h-slider'), ('zoom', 'h-slider'),
                                           ('reaction', 'h-slider'), ('freeze', 'togglebutton')]):
            gui += control(deck + '-' + prop, kind, label + ' / ' + prop, '/video/' + deck + '.' + prop,
                           f'cell {col} {row}, growx, width 280:340:, height 44!')
    master = [('crossfade', 'h-slider', 'Crossfade A -> B'), ('audio-mix', 'h-slider', 'Audio crossfade depth'),
              ('sensitivity', 'h-slider', 'Audio sensitivity'), ('brightness', 'h-slider', 'Master brightness'),
              ('demo', 'togglebutton', 'Demo pulse (no microphone)'), ('blackout', 'togglebutton', 'BLACKOUT')]
    for row, (prop, kind, label) in enumerate(master, 6):
        gui += control(prop, kind, label, '/video/control.' + prop, f'cell 0 {row} 2 1, growx, height 42!')
    gui += control('blend', 'combobox', 'Blend mode', '/video/mix.mode', 'cell 0 12 2 1, growx, height 42!')
    gui += '}\n'
    (HERE / 'gui.pxr').write_text(gui)
    (HERE / 'project.pxp').write_text('''# <<<BUILD>>>
include [file "video.pxr"]
include [file "audio.pxr"]
include [file "gui.pxr"]

# <<<RUN>>>
include [file "config/autostart"]
''')
    (HERE / 'config/autostart').write_text('/video.start\n/audio.start\n/gui.start\n')
    print('Generated', HERE / 'project.pxp')


if __name__ == '__main__':
    main()
