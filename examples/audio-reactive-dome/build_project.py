"""Regenerate the native PraxisLIVE project from the editable visual code."""
from pathlib import Path
import sys
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1] / 'praxis-mcp'))
from server import literal

video = '''@ /video root:video {
  .width 4096
  .height 4096
  .fps 60
  @ ./dome video:custom {
    .code CODE
    .sensitivity 8
    .speed 0.35
    .brightness 0.8
  }
  @ ./output video:output { .title "Audio Reactive Dome | 180 degree fisheye" }
  ~ ./dome!out ./output!in
}
'''.replace('CODE', literal((HERE / 'dome.pxj').read_text()))
(HERE / 'video.pxr').write_text(video)
(HERE / 'audio.pxr').write_text('''@ /audio root:audio {
  @ ./input audio:input { .channels 1 }
  @ ./meter audio:analysis:level
  @ ./mute audio:gain { .level 0 }
  @ ./output audio:output { .channels 2 }
  @ ./send core:routing:send { .address /video/dome.energy }
  ~ ./input!out-1 ./meter!in
  ~ ./meter!out ./mute!in
  ~ ./mute!out ./output!in-1
  ~ ./meter!level ./send!in
}
''')
(HERE / 'project.pxp').write_text('''# <<<BUILD>>>
include [file "video.pxr"]
include [file "audio.pxr"]

# <<<RUN>>>
include [file "config/autostart"]
''')
(HERE / 'config/autostart').write_text('/video.start\n/audio.start\n')
print('Generated native PraxisLIVE project:', HERE / 'project.pxp')
