"""Adapt the user's Magic GLSL pack into a browser shader library."""
import json
from pathlib import Path
import re


def adapt_globals(source):
    # WebGL requires global initializers to be constant. Move legacy animated
    # initializers into a function called once per fragment, preserving order.
    mask = re.sub(r'/\*.*?\*/|//[^\n]*', lambda m: ''.join('\n' if c == '\n' else ' ' for c in m[0]), source, flags=re.S)
    replacements, assignments = [], []
    pattern = r'(?m)^[ \t]*(float|int|bool|vec[234]|mat[234])\s+([^;\n]+);'
    for match in re.finditer(pattern, mask):
        prefix = mask[:match.start()]
        if prefix.count('{') != prefix.count('}'):
            continue
        kind, declarations = match.groups()
        if '{' in declarations or '}' in declarations:
            continue  # Inline function definition, rather than a global variable.
        parts, start, depth = [], 0, 0
        for i, c in enumerate(declarations):
            if c in '([': depth += 1
            elif c in ')]': depth -= 1
            elif c == ',' and depth == 0:
                parts.append(declarations[start:i]); start = i + 1
        parts.append(declarations[start:])
        names = []
        for part in parts:
            name, sep, expr = part.partition('=')
            names.append(name.strip())
            if sep: assignments.append(name.strip() + ' = ' + expr.strip() + ';')
        if any('=' in p for p in parts):
            replacements.append((match.start(), match.end(), kind + ' ' + ', '.join(names) + ';'))
    for start, end, replacement in reversed(replacements):
        source = source[:start] + replacement + source[end:]
    return source, '\n'.join(assignments)


def build_library(here, wrap):
    entries = []
    for name, path in [('LaserFlower', 'RGBlaserflower.frag'), ('Wormhole', 'PBwormhole.frag'),
                       ('Aurora', 'aurora.frag'), ('Stars', 'starfield.frag'),
                       ('PrismTunnel', 'prism-tunnel.frag'), ('LiquidLattice', 'liquid-lattice.frag')]:
        if not (here/'shaders'/path).exists():
            continue
        entries.append(dict(name=name, group='Original', source='precision highp float;\n' + wrap((here/'shaders'/path).read_text())))
    original_count = len(entries)
    skipped = []
    for file in sorted((here/'shaders/magic').glob('*.glsl'), key=lambda p: p.name.lower()):
        text = file.read_text(errors='replace')
        text = re.sub(r'^\s*#include\s+"noise.glsl"\s*$',
                      lambda _: (here/'shaders/magic/noise.glsl').read_text(), text, flags=re.M)
        # Some legacy files declare several uniforms in a single statement.
        text = re.sub(r'uniform\s+(\w+)\s+([\w\s,]+);',
                      lambda m: '\n'.join('uniform ' + m[1] + ' ' + name.strip() + ';'
                                          for name in m[2].split(',')), text)
        if file.stem == 'octopus':
            text = text.replace('uniform vec4 mouse;', 'uniform vec2 mouse;')
        active = re.sub(r'/\*.*?\*/|//[^\n]*', '', text, flags=re.S)
        if not re.search(r'void\s+main\s*\(', active):
            skipped.append(dict(file=file.name, reason='Helper library without a main entry point'))
            continue
        text, init = adapt_globals(text)
        wrapped = wrap(text)
        wrapped = 'precision highp float;\nvoid initEffectGlobals();\n' + wrapped
        wrapped += '\nvoid initEffectGlobals() {\n' + init + '\n}\n'
        wrapped = wrapped.replace('else effectMain();', 'else { initEffectGlobals(); effectMain(); }')
        entries.append(dict(name=file.stem, group='Magic pack', source=wrapped))
    (here/'player/library.js').write_text('const SHADER_LIBRARY = ' + json.dumps(entries) + ';\n')
    (here/'shader-import-report.json').write_text(json.dumps(dict(imported=len(entries)-original_count, skipped=skipped), indent=2)+'\n')
    return entries
