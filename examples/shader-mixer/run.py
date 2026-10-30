"""Launch two shader decks, native mixer controls and optional live input."""
import argparse
import os
from pathlib import Path
import sys
import threading
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1] / 'praxis-mcp'))
from server import REPO, Runtime

# LWJGL on macOS must initialize GLFW on the first JVM thread.
if sys.platform == "darwin":
    options = os.environ.get("JAVA_OPTS", "")
    if "-XstartOnFirstThread" not in options:
        os.environ["JAVA_OPTS"] = options + " -XstartOnFirstThread"

p = argparse.ArgumentParser(description=__doc__)
p.add_argument('--demo', action='store_true', help='Use a generated control pulse without opening an audio device')
p.add_argument('--no-gui', action='store_true', help='Control through component properties instead of a native panel')
args = p.parse_args()
r = Runtime([str(REPO / 'praxiscore-bin/target/praxiscore/bin/praxis'), '--machine'], 45)
try:
    for name in ['video.pxr', 'audio.pxr'] + ([] if args.no_gui else ['gui.pxr']):
        r.evaluate((HERE / name).read_text())
    r.evaluate('/video/control.demo ' + ('true' if args.demo else 'false'))
    r.evaluate('/video.start')
    if not args.no_gui:
        r.evaluate('/gui.start')
    if not args.demo:
        r.evaluate('/audio.start')
    print('Shader mixer running. Ctrl-C stops all owned pipelines.', flush=True)
    while r.process.poll() is None:
        threading.Event().wait(1)
except KeyboardInterrupt:
    pass
finally:
    r.close()
