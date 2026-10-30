"""Launch the live dome using the locally built PraxisCORE runtime."""
from pathlib import Path
import sys
import threading

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1] / 'praxis-mcp'))
from server import REPO, Runtime

runtime = Runtime([str(REPO / 'praxiscore-bin/target/praxiscore/bin/praxis'), '--machine'])
try:
    runtime.evaluate((HERE / 'video.pxr').read_text())
    runtime.evaluate((HERE / 'audio.pxr').read_text())
    runtime.evaluate('/video.start')
    runtime.evaluate('/audio.start')
    print('Dome running with live audio input. Press Ctrl-C to stop.', flush=True)
    while runtime.process.poll() is None:
        threading.Event().wait(1)
except KeyboardInterrupt:
    pass
finally:
    runtime.close()
