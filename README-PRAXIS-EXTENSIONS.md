# What we built on PraxisCORE

This document describes the additions in Craig Ellenwood's audio-reactive visual
performance project. It distinguishes our work from the existing PraxisCORE and
PraxisLIVE platform.

## Credits

- **Upstream platform:** PraxisCORE and PraxisLIVE, originally developed by
  **Neil C Smith**, with support from **Codelerity Ltd** and upstream contributors.
  The JVM runtime, actor architecture, PCL language, component system, live-code
  infrastructure, native media processing and desktop IDE are upstream work.
- **Extension project:** **Craig Ellenwood** — project direction, creative
  requirements, interaction design, media choices, testing and integration;
  development with implementation assistance from **OpenAI Codex**.
- **Third-party visuals:** imported shader effects belong to their respective
  authors. Porting, wrapping or adapting a shader does not make it our original
  composition or establish redistribution rights.

The upstream license and notices remain in place. This contribution summary does
not replace those licenses or grant rights to third-party content.

## Browser performance mixer

We built a local WebGL mixer that runs independently of the Java runtime:

- Two shader/video decks with per-deck speed, zoom, reaction and freeze.
- Project-authored Aurora, Stars, PrismTunnel and LiquidLattice shader effects. The two new effects have explicit MIT licenses.
- An adapter for optional local GLSL collections: entry-point conversion,
  uniform normalization, animated-global initialization, shared includes,
  feedback textures, lazy compilation and searchable preset selection.
- Local audio and video file loading, live microphone analysis, and silent demo
  input. Selected browser files are not uploaded to the server.
- Smoothed RMS audio response for visual motion, pulse, noise and crossfading.
- A crossfader that fully isolates either deck at its endpoints, including when
  audio modulation is enabled.
- Thirteen blend modes, including Screen, Overlay and Soft light.
- A noise filter with grain, smooth distortion, scale, motion and audio modulation.
- Master brightness and blackout.
- A/B preview, fullscreen, a separate program-output window and PNG snapshots.
- Program recording with selected audio, browser-supported encoding, a timer and
  download on stop.
- Auto performance: prepare the hidden deck, hold, crossfade, optionally rotate
  blend modes, and preserve uploaded videos.

### Output and projection

We added selectable 4096 × 4096 dome and 3840 × 2160 rectangular output, targeting
60 fps. Program capture, preview proportions, snapshots and recording follow the
selected format. Actual render FPS is reported separately from the target.

Dome reprojection reconstructs an equidistant hemisphere ray for each pixel, then
maps it into a perspective plane, a 360° equirectangular panorama or an existing
180° fisheye source. Controls include source field of view, yaw, tilt and a source
calibration grid. Flat sources leave uncovered regions black rather than inventing
full-hemisphere content. This is not a venue-specific lens/mirror warp or projector
edge-blending system.

## MCP and local control bridge

We implemented a dependency-free Python stdio MCP server, with two control paths:

| Path | What we added |
| --- | --- |
| Browser mixer | `mixer_status`, `mixer_auto`, `mixer_next`; localhost command queue, browser acknowledgment, client lease, duplicate-command handling and validation |
| Dedicated PraxisCORE runtime | Tools for PCL execution, graph construction, inspection, wiring, live controls/code and pipeline start/stop |

The browser bridge binds to loopback and rejects cross-origin writes. It reports
an error when no browser is connected and does not claim success before an
acknowledgment. The runtime tools manage their own Java process; they do not
attach to an open desktop IDE project.

### Runtime change

We added `--machine` to the PraxisCORE launcher and implemented
`MachineTerminalIO.java`. It exchanges base64-framed UTF-8 scripts and replies,
bypassing the human terminal interface while retaining the existing interactive
mode. The script engine and audio/video component implementations are upstream.

## Native example projects

- **Audio-reactive dome:** a neon hemispherical lattice and particles, live input
  RMS routing, muted monitoring, and a generated demonstration video.
- **Native shader mixer:** two OpenGL decks, a native mixer panel, control routing
  and muted live-input analysis. Optional local imported shaders can be included
  when generating it; a clean checkout uses the four project effects.

The browser's expanded library, video-upload controls, new blend modes, noise,
recording, Auto/MCP browser controls and rectangular-output selector are not all
ported into the native project. The two implementations are not feature-identical.

## Source layout

| Location | Contribution |
| --- | --- |
| `examples/shader-mixer/player/` | Browser renderer, UI, Auto state machine and program window |
| `examples/shader-mixer/projection.glsl` | Source-to-dome reprojection and calibration grid |
| `examples/shader-mixer/serve.py`, `mixer_bridge.py` | Local hosting and acknowledged browser-control bridge |
| `examples/shader-mixer/build_project.py`, `shader_library.py` | Local asset generation and shader adaptation |
| `examples/audio-reactive-dome/` | Native dome example, generator and preview renderer |
| `praxis-mcp/` | MCP stdio server, browser bridge client and runtime process adapter |
| `praxiscore-launcher/.../Launcher.java`, `MachineTerminalIO.java` | Machine-readable runtime launch/I/O support |

## Local-only third-party assets

The `.gitignore` rules exclude imported Magic/Expansion Pack shader sources,
generated browser/native payloads containing them, associated local reports and
preview images, and user-supplied music. The files are preserved on disk.

None of these imported shader assets were tracked when the exclusions were added.
No history rewrite or asset deletion was needed. Gitignore does not remove files
that have already been committed; check the index before any future publication.

A fresh checkout can generate the browser library and native mixer using the two
project-authored shader files. Optional packs remain a local import and require
their own license review before redistribution. Shader credits are documented in
[the source notes](examples/shader-mixer/shaders/SOURCES.md).

## Start from a fresh checkout

```sh
python3 examples/shader-mixer/build_project.py
python3 examples/shader-mixer/serve.py
```

Open http://127.0.0.1:8765. Use Demo, Load audio, Microphone or Load video. The
locally converted Thrillseeker track is not included in Git.

For MCP setup and Java build instructions, see [MCP README](praxis-mcp/README.md).
For full controls, see [Mixer README](examples/shader-mixer/README.md).

## Validation and limits

Checks cover the Auto state machine, crossfade endpoints, shader adaptation,
asset references, MCP framing, bridge acknowledgment/timeouts and runtime graph
operations. macOS GPU checks cover shader compilation/linking, 4K allocations,
blend endpoint pixels, noise/blackout and reprojection coordinate landmarks.
The HTTP/MCP integration check used a simulated browser client.

The planetarium installation has not been physically calibrated or tested.
Browser recording, pop-out behavior and sustained 4K60 playback have not been
benchmarked end to end. Native standalone OpenGL startup stalled on the test Mac.
These limitations are documented rather than treated as completed validation.
