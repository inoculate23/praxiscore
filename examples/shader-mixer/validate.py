"""Compile native graphs and optionally exercise the GPU and native controls."""
import argparse
import os
import base64
from pathlib import Path
import sys
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1] / 'praxis-mcp'))
from server import REPO, Runtime

# LWJGL on macOS must initialize GLFW on the first JVM thread.
if sys.platform == "darwin":
    options = os.environ.get("JAVA_OPTS", "")
    if "-XstartOnFirstThread" not in options:
        os.environ["JAVA_OPTS"] = options + " -XstartOnFirstThread"

p = argparse.ArgumentParser()
p.add_argument('--gpu', action='store_true')
p.add_argument('--gui', action='store_true')
options = p.parse_args()
r = Runtime([str(REPO / 'praxiscore-bin/target/praxiscore/bin/praxis'), '--machine'], 45)
try:
    for file in ['video.pxr', 'audio.pxr'] + (['gui.pxr'] if options.gui else []):
        r.evaluate((HERE / file).read_text())
        print('Compiled:', file, flush=True)
    for deck in ['deck-a', 'deck-b']:
        assert 'Stars' in r.evaluate('/video/' + deck + '.info')
    assert 'meter level send in' in r.evaluate('/audio.connections')
    assert 'deck-b out mix src' in r.evaluate('/video.connections')
    r.evaluate('/video/control.demo true')
    if options.gpu:
        r.evaluate('/video.start')
        if options.gui:
            r.evaluate('/gui.start')
        for preset in ['LaserFlower', 'Wormhole', 'Aurora', 'Stars']:
            r.evaluate('/video/deck-a.preset ' + preset)
            # The watch resolves only after real frames have rendered.
            data = r.evaluate('/video/mix.watch-in')
            png = base64.b64decode(data)
            assert png.startswith(b'\x89PNG\r\n\x1a\n')
            (HERE / ('preview-' + preset.lower() + '.png')).write_bytes(png)
            print('Rendered GPU preset:', preset, flush=True)
        r.evaluate('/video/control.audio-mix 0')
        r.evaluate('/video/control.crossfade 0.7')
        # Wait for a drawn frame before reading the controller's routed value.
        r.evaluate('/video/mix.watch-in')
        assert abs(float(r.evaluate('/video/mix.mix')) - 0.7) < 0.00001
        print('Live crossfade routing passed.', flush=True)
    print('Validation passed.', flush=True)
finally:
    r.close()
