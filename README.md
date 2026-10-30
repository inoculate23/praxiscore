# PraxisCORE v6

PraxisCORE is a modular JVM runtime for cyberphysical programming, supporting
real-time coding of real-time systems. It is the heart of [PraxisLIVE][praxislive].
With a distributed forest-of-actors architecture, runtime code changes and
comprehensive introspection, PraxisCORE brings aspects of Erlang, Smalltalk and
Extempore into the Java world ... a powerful platform for media processing, data
visualisation, sensors, robotics, IoT, and lots more!

For further information, help and support see https://www.praxislive.org and
https://www.praxislive.org/core/

PraxisCORE is an open-source project originally developed by
[Neil C Smith][neilcsmith], and supported by [Codelerity Ltd][codelerity].

## Credits and contributions

**PraxisCORE / PraxisLIVE:** upstream software originally developed by
[Neil C Smith][neilcsmith] and supported by [Codelerity Ltd][codelerity]. Their
runtime, architecture, APIs and existing components remain credited to the
upstream project.

**This extension project:** directed and developed by **Craig Ellenwood**, with
implementation assistance from **OpenAI Codex**. Our additions include the local
audio-reactive shader/video mixer, dome projection adaptations, performance
controls, recording workflow, Auto mode, MCP browser bridge, native example
projects, runtime machine-I/O transport, tests and documentation.

See [What we built on PraxisCORE](README-PRAXIS-EXTENSIONS.md) for the contribution
breakdown and the distinction between upstream features and our additions.
Imported third-party shaders remain the work of their original authors.

## Audio-reactive shader mixer

This checkout includes a local browser mixer, native PraxisLIVE projects, and an
MCP server for live audio/video control.

### Start the browser mixer

From the repository root:

```sh
python3 examples/shader-mixer/build_project.py
python3 examples/shader-mixer/serve.py
```

The first command generates local assets from the available shader sources.

Open **http://127.0.0.1:8765** in a WebGL-capable browser. Python 3.10 or newer is
required; no Python packages, Java build, or internet connection are needed for
the local player. Demo mode animates the visuals without making sound. Click
**Play Thrillseeker** (if you supplied the local track), **Load audio**, or
**Microphone** to choose an audio source.

### Features

| Feature | Browser mixer |
| --- | --- |
| Two independent decks | Select and control A and B separately |
| Shader library | Aurora, Stars, PrismTunnel and LiquidLattice included; the current local library has 191 presets when optional imported packs are present |
| Local video files | Load a video on either deck; looping, playback/seek controls, freeze and speed |
| Audio response | Smoothed RMS loudness drives motion, pulse, crossfade and noise |
| Audio sources | Optional local Thrillseeker MP3, local audio files, microphone, or silent demo pulse |
| Crossfader | Manual or audio-modulated; endpoints fully isolate A or B |
| Blend modes | Normal, Add, Screen, Difference, Multiply, Overlay, Soft light, Hard light, Darken, Lighten, Exclusion, Color dodge and Color burn |
| Deck controls | Shader, speed, zoom, reaction amount and freeze |
| Noise filter | Grain, distortion, scale, motion speed and audio modulation |
| Auto mode | Hidden-deck shader changes, timed holds/fades, shader pools and optional blend rotation |
| A/B preview | Small switchable preview before the master blend and noise filter |
| Program window | Separate live output window with fullscreen |
| Recording | Record the mixed program and selected audio; stop to download WebM or supported MP4 |
| Frame export | Save the program as a PNG snapshot |
| Master controls | Brightness and blackout |
| MCP bridge | Inspect the browser mixer, configure Auto, and advance transitions |

Video and audio files selected in the browser stay local through browser object
URLs. Uploaded video clips are muted; the selected audio track or microphone
drives the mix. Microphone monitoring is muted, although selected microphone
audio is included when recording. Browser microphone access requires permission.

### MIT-licensed shader additions

Two original effects are included with explicit MIT licenses:

- **PrismTunnel:** animated prismatic tunnel rings and spokes.
- **LiquidLattice:** a fluid luminous lattice with bright intersections.

Both were created for Craig Ellenwood's project with OpenAI Codex assistance.
They are included in fresh-checkout builds and work with the browser and native
mixer. Their [MIT license](examples/shader-mixer/shaders/LICENSE.project-shaders)
permits use, modification and redistribution subject to its notice requirements.
This grant does not cover the excluded third-party shader collections.

### Output formats and dome projection

| Format | Resolution | Frame-rate target |
| --- | --- | --- |
| Dome | 4096 × 4096 | 60 fps |
| Rectangle 16:9 | 3840 × 2160 | 60 fps |

The selected format applies to the program, pop-out window, snapshots and
recordings. The FPS indicator reports actual performance separately from the
60 fps target. Performance depends on GPU, shader complexity, browser scheduling
and encoder support. Browser 4K60 recording has not been benchmarked end to end.

Dome mode uses inverse mapping from an equidistant 180° fisheye output into the
selected source projection. Each deck offers:

- **Flat / perspective plane:** maps ordinary videos and flat shaders using
  horizontal field of view and source aspect ratio. Uncovered dome regions are
  black instead of stretched.
- **360° equirectangular:** maps a complete 360 × 180° panorama using longitude
  and latitude.
- **Already 180° fisheye:** preserves existing domemaster footage without a
  second perspective warp.

Yaw, tilt and a source calibration grid help align the image. These mappings do
not include a venue-specific projector lens/mirror warp or edge blending. A
physical planetarium test is still required. Flat images do not contain the full
hemisphere of information present in a genuine fulldome scene.

### Recording and program output

Click **Record program**, then **Stop recording** to download the result. Capture
requests 60 fps and recording requests 100 Mbps video plus 192 kbps audio; the
browser determines the actual supported encoding. The recording includes blend,
noise and blackout effects, without the control panel or A/B preview.

Stop recording before switching output formats or closing the page. Recordings
are buffered in memory and stop at 1 GB for download. The program pop-out is a
silent mirror to avoid duplicate audio playback. Keep the main control page open.
Actual browser recording and pop-out behavior have not been interactively
verified in this environment.

### MCP control

Run the MCP server through a compatible MCP client's stdio configuration:

```sh
python3 praxis-mcp/server.py
```

Keep the browser mixer server running and one mixer control tab open. The browser
bridge tools work independently of Java:

| Tool | Purpose |
| --- | --- |
| `mixer_status` | Read connection, decks, Auto settings, resolution, FPS and recording state |
| `mixer_auto` | Start/stop Auto and change hold time, fade time, shader pool or blend rotation |
| `mixer_next` | Advance to the next automatic transition |

Example MCP tool call:

```json
{
  "name": "mixer_auto",
  "arguments": {
    "enabled": true,
    "hold_seconds": 12,
    "fade_seconds": 4,
    "pool": "all",
    "rotate_blends": true
  }
}
```

Commands wait for browser acknowledgment. Moving the manual crossfader turns
Auto off. Auto preserves uploaded video decks and does not start audio,
recording, microphone access or popup windows.

The MCP server also provides native-runtime tools for creating/removing
components, inspecting graphs, connecting/disconnecting ports, changing controls
and live code, starting/stopping pipelines, and evaluating PCL scripts. Those
tools own a dedicated PraxisCORE process and do not attach to the desktop IDE.
See [MCP setup and tools](praxis-mcp/README.md) for client configuration.

### Native PraxisLIVE projects

| Project | Contents |
| --- | --- |
| [Shader mixer](examples/shader-mixer/project.pxp) | Original four-shader, two-deck mixer with native controls and live audio analysis |
| [Audio-reactive dome](examples/audio-reactive-dome/project.pxp) | Neon dome lattice and particles driven by live input level |

Open the project folder with **File → Open Project** in PraxisLIVE. Both native
projects target 4096 × 4096 at 60 fps. The expanded shader library, uploaded-video
controls, added blend modes, noise filter, recording, browser Auto bridge and
selectable rectangular output are browser-player features.

Native code and graph loading have been checked, but the standalone native
OpenGL window stalled during testing on this Mac. Use the browser player for the
full mixer while that native startup issue remains unresolved.

### Local assets excluded from Git

Imported shader packs and user-supplied audio are retained locally but ignored by
Git. Generated files containing imported shader code—`player/library.js`,
`player/shaders.js` and the native mixer `video.pxr`—are also ignored, along with
local shader reports and preview images. Ignoring only the source shader folder
would leave copies embedded in those generated files.

A fresh checkout rebuilds with the project-authored **Aurora**, **Stars**, **PrismTunnel** and **LiquidLattice** shaders.
Optional local packs can be added and rebuilt separately. Their availability is
not a blanket license to redistribute them. No license for third-party shaders
or music is granted by this repository.

### Documentation and checks

- [Complete mixer guide](examples/shader-mixer/README.md)
- [Dome project guide and video preview](examples/audio-reactive-dome/README.md)
- [MCP setup and lifecycle](praxis-mcp/README.md)
- [Shader source attribution](examples/shader-mixer/shaders/SOURCES.md)

```sh
python3 examples/shader-mixer/test_library.py
python3 examples/shader-mixer/test_bridge.py
node examples/shader-mixer/test_auto.js
node examples/shader-mixer/test_crossfade.js
python3 -m unittest discover -s praxis-mcp/tests -v
```

Optional macOS GPU checks are documented in the mixer guide. GPU validation has
covered shader compilation/linking, 4K target allocation, crossfade endpoint
isolation, noise/blackout behavior, and projection coordinate landmarks. Physical
dome alignment, all shaders' visual performance, and browser media behavior still
need venue/device testing.

## Requirements and build

PraxisCORE v6 requires Java 21 or above.

The build uses Maven via the Maven Wrapper. To build, execute `./mvnw package`. The
fully built runtime will be found at `praxiscore-bin/target/praxiscore` and
`praxiscore-bin/target/praxiscore-bin-VERSION-bin.zip`.

To run the test suite, execute
`./praxiscore-bin/target/praxiscore/bin/praxis -f ./testsuite/`.

## License

PraxisCORE is licensed under the terms of the GNU Lesser General Public License v3.
This means that the core runtime, or a selection of its modules, may be used as a
library and included in your own projects without requiring you to share your own
code under the same license.

Some modules have different but compatible licenses.

[neilcsmith]: https://www.neilcsmith.net
[codelerity]: https://www.codelerity.com
[praxislive]: https://www.praxislive.org
