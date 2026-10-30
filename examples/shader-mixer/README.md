<!-- Project-specific guide; see ../../README-PRAXIS-EXTENSIONS.md for contribution credits. -->
# Audio-reactive dome shader mixer

A local browser mixer with two GPU shader/video decks, audio-reactive controls,
automatic transitions, recording, and 4K dome or rectangular output. A separate
native PraxisLIVE project provides the original four-shader mixer. This is a
separate project from `audio-reactive-dome`; it preserves the earlier visual.

## Play now (local browser player)

```sh
python3 examples/shader-mixer/build_project.py
python3 examples/shader-mixer/serve.py
```

Open **http://127.0.0.1:8765**. The demo animation starts automatically. Demo
mode is a visual control pulse and makes no sound. Click **Play Thrillseeker**
to play the supplied 4:40 track, converted from your MP4 to 320 kbps stereo MP3.
The converted file is `player/audio/Thrillseeker.mp3`; it is local-only and is not
included in Git. A fresh checkout can use Load audio or the silent demo instead. Use **Load audio** to select
and play a music file, or **Microphone** for muted live-input analysis. Audio
files stay in your browser; the server serves local assets and the MCP command bridge on localhost.

The browser player uses the same wrapped shader sources, two GPU render targets,
manual/audio crossfade, blend modes, freeze, blackout, and per-deck controls.
It also has fullscreen and PNG snapshot buttons. It is independent of the native
PraxisCORE process. The `mixer_status`, `mixer_auto` and `mixer_next` MCP tools
control the browser through its localhost bridge.

All four wrapped shaders were compiled, linked and rendered on this Mac's GPU
using `check_gpu.py`. Browser interaction and microphone permissions were not
automated: Computer Use approval did not permit opening Chrome.

## Local-only assets and fresh checkouts

Craig Ellenwood directed and developed this extension project with implementation
assistance from OpenAI Codex; PraxisCORE and PraxisLIVE remain credited to their
upstream authors. See [Contribution README](../../README-PRAXIS-EXTENSIONS.md).

Imported shaders, generated shader payloads (`player/library.js`, `player/shaders.js`
and `video.pxr`), shader reports, previews and user-supplied audio are ignored by
Git but remain on disk. `build_project.py` generates a working library from the
four project-authored shaders when those optional packs are absent. Locally,
existing imports continue to work. Third-party authors retain credit and rights;
the repository does not grant permission to redistribute their shaders or music.

## Added shader library and video files

The current local browser player includes 185 standalone shaders from your Magic GLSL folder,
plus the four original presets (189 total). Search each deck's list by name.
`noise.glsl` is a shared helper, inlined into the shader that includes it.
Legacy animated global initializers are moved into a per-fragment initializer;
grouped uniforms and feedback textures are adapted for the player. Shader
programs compile on selection. A compile failure reports the error and preserves
the previous deck instead of stopping playback.

Choose **Load video** on either deck to select a local video file. It becomes that
deck's source and mixes with a shader or video on the other deck. The clip loops,
is muted, and has preview play/pause/seek controls. Freeze pauses it; speed changes
playback rate, and zoom/reaction affect its circular output. Video is center-cropped
to fill the dome circle. Choose a shader again to switch back. Files use browser
object URLs and are not uploaded to the server. Thrillseeker, another audio file,
or microphone input can continue driving the mix while video plays.

Video decoding depends on your browser's codec support. H.264 MP4 and WebM are
good starting points; a decode failure is shown in the audio/source status area.
The added library and video controls are browser-player features; the native
PraxisLIVE project retains its original four presets.

Validation: 189 shader programs plus the video and blend programs compiled and
linked on this Mac's offscreen desktop OpenGL GPU (191/191), and five shader
adaptation/asset regression tests passed. This does not verify every shader's
appearance, performance, or WebGL compatibility on every browser. Interactive
video upload/playback has not been browser-automated in this session.

## Noise modulation filter

Enable **Noise filter** below Master mix. It processes the mixed output, including
uploaded videos. Grain adds animated texture; Distortion warps the image with a
smooth noise field. Scale adjusts the field size, Motion speed animates it, and
Audio modulation increases grain and distortion with the smoothed audio level.

The filter is off initially. Turning it off bypasses all noise processing. Set
Motion speed to 0 for a stationary field; audio can still change its strength.
Set Audio modulation to 0 for a constant-strength effect. The dome remains
circular, master brightness scales grain, and Blackout suppresses the whole image.

`python3 examples/shader-mixer/check_noise_gpu.py` verifies actual GPU output pixels
for bypass, visible noise, audio modulation, the dome mask and blackout on macOS.

## Correct source-to-dome projection

The earlier hemisphere-XY mapping was replaced with explicit inverse projection.
Every output pixel defines `theta = radius × π/2` and a hemisphere ray. Select the
actual **Source projection** on each deck:

- **Flat / perspective plane** (default for your flat shaders and ordinary videos):
  looks up `ray.xy / ray.z`, scaled by horizontal field of view and source aspect.
  This produces the curved domemaster image needed to display a perspective panel
  without an arbitrary stretch. Use the horizontal FOV control to choose its
  angular coverage. Finite-FOV images leave uncovered portions of the dome black.
- **360° equirectangular:** longitude/latitude lookup for a complete 360 × 180°
  panorama. It can cover the full hemisphere. Selecting this for ordinary video
  does not make the video a real panorama; arbitrary shaders may have seams.
- **Already 180° fisheye:** preserves an existing equidistant domemaster's mapping;
  avoids applying a second perspective warp.

Yaw and camera tilt orient the source. Zero tilt places the source camera axis
at the zenith. The source calibration grid helps inspect curvature; its geometry
ignores audio-driven zoom. For calibration, disable noise, set Zoom to 1 and
Reaction to 0, then select a source FOV and orientation. A flat source cannot be
expanded to all 180° without stretching or inventing missing image information.

These are standard domemaster mappings, not a calibrated projector lens/mirror
warp. Ask the venue whether it accepts a **180° equidistant fulldome master** and
handles projector warp/blend itself. If feeding a projector directly, the
projector/lens or mirror geometry needs separate venue calibration. No physical
dome validation has been performed.

Geometry reference: [Paul Bourke: perspective and panorama to fisheye](https://www.paulbourke.net/dome/2fish/).
`check_projection_gpu.py` compares GPU pixels with independent perspective,
longitude/latitude and fisheye landmarks, including finite-FOV clipping.

## Output format

The player and native dome projects now target **4K / 60 fps**. Dome is
4096 × 4096; rectangular output is UHD 3840 × 2160. Program capture requests
60 fps, and browser recording requests 100 Mbps video plus 192 kbps audio.
The live FPS indicator and MCP status report the measured render rate separately
from the target. Sustained 4K60 depends on GPU, shader complexity, display/browser
scheduling and encoder support; recording cannot add missing rendered frames.
The A/B preview stays small to reduce readback overhead. GPU tests confirmed
allocation and pixel readback for all four full-size deck/feedback targets in
both formats. End-to-end browser 4K60 recording has not been benchmarked.


Select **Output format** at the top of the browser controls:

- **Dome:** 4096 × 4096, circular 180° fisheye output.
- **Rectangle 16:9:** 3840 × 2160, full-frame planar output without a circular mask.

Both modes support the shader library, uploaded videos, blends, audio response,
Auto and noise. The A/B preview, program popup, PNG snapshots and recording follow
the selected format. Video fills the selected frame using a centered aspect-ratio
crop. Stop recording before switching formats; the player preserves recording
resolution by blocking format changes while recording. The MCP mixer status
includes the selected format and actual pixel dimensions.

## Program output, preview and recording

In the browser player, the crossfader now reaches pure A and pure B in **every**
blend mode, even with audio crossfade modulation enabled. Audio modulation tapers
to zero at the endpoints. Blend effects peak at the center of the crossfader and
taper back to the isolated deck at either end.

Modes: Normal, Add, Screen, Difference, Multiply, Overlay, Soft light, Hard light,
Darken, Lighten, Exclusion, Color dodge and Color burn.

**Deck preview** has A/B buttons and shows that deck before the master blend and
noise filter. It updates at one sixth of the program frame rate to keep readback
cost down. **Pop out program** opens a separate, resizable output window containing
only the live mixed image and a fullscreen button. Allow a popup for localhost if
your browser blocks it. The control page must stay open; closing the popout does
not stop the mixer.

**Record program** records the program canvas at the selected resolution and up to 60 fps,
including blends, noise and blackout. It also includes the selected audio file or
microphone through the audio mixer; muted uploaded video clips remain silent.
Click **Stop recording** to download the result. WebM/VP9 or VP8 is preferred;
MP4 is used if that is the supported browser format. A timer shows recording
progress. Recordings are held in memory and stop at 1 GB for download. Stop and
save before closing the page. The popout is a silent mirror, avoiding duplicate
audio playback.

GPU pixel checks verify pure A/B endpoints in all 13 modes, and JavaScript checks
verify that audio modulation cannot move the endpoints. Actual browser recording
and popup behavior have not been interactively verified in this session.

## Auto performance and MCP

Enable **Auto** to alternate smoothly between decks. It first settles the current
mix onto one deck, then holds for the selected interval, changes the hidden
shader and fades to it. Settings: hold time (2–300 seconds), fade time (0.5–60
seconds), all/original shader pool, and optional blend-mode rotation. Video decks
are preserved. Moving the manual crossfader turns Auto off. **Next transition**
advances immediately and starts Auto if it was off.

The localhost server now bridges the browser player to `praxis-mcp/server.py`.
Reload the browser player and reconnect your MCP client to discover the new tools:

| Tool | Effect |
| --- | --- |
| `mixer_status` | Read connection, Auto settings, decks, frame count and recording state |
| `mixer_auto` | Start/stop Auto and update timing, pool or blend rotation |
| `mixer_next` | Advance to the next automatic transition |

```json
{"name":"mixer_auto","arguments":{"enabled":true,"hold_seconds":12,"fade_seconds":4,"pool":"all","rotate_blends":true}}
{"name":"mixer_auto","arguments":{"enabled":false}}
{"name":"mixer_next","arguments":{}}
{"name":"mixer_status","arguments":{}}
```

These tools control the **live browser player**, without launching Java. Keep one
control tab open. The MCP server waits for browser acknowledgment and reports an
error if no browser is connected; a timeout means the command's effect is unknown.
After a reload, the old tab's lease may take four seconds to expire. The server
binds to loopback, rejects cross-origin writes, and does not expose remote control
on the network. Set `PRAXIS_MIXER_URL=http://127.0.0.1:PORT` in the MCP server's
environment if you change the player server port.

Auto does not start audio, recording, microphone access, or popup windows. Choose
an audio source in the browser first when you want music-driven modulation.

Auto transition/stop/validation tests and bridge acknowledgment/timeout tests
pass. An isolated HTTP integration test verified the MCP bridge with a simulated
browser client; live browser automation was not performed.

## Native PraxisLIVE project

The graph and Java code compile, and the native GUI graph loaded in validation.
Native window playback is currently blocked on this Mac: LWJGL requires the
first-thread JVM option, and with that option the window event loop stalls.
Use the browser player for playback while that native runtime issue remains.


Open `project.pxp` in PraxisLIVE, Build, then Run. Or use the locally built
PraxisCORE distribution from the repository root:

```sh
python3 examples/shader-mixer/run.py
```

Try it without opening a microphone/audio device:

```sh
python3 examples/shader-mixer/run.py --demo
```

Requires Java 21, the built PraxisCORE distribution with `--machine` support,
and a local OpenGL-capable desktop. Native controls and the output window run
on the hosting computer. Use `--no-gui` to omit the control panel.

## Mixer panel

Each deck offers a shader selector, speed, zoom, audio reaction amount and freeze.
The master controls are crossfade (left = A, right = B), audio crossfade depth,
input sensitivity, brightness, demo pulse, blackout, and blend mode.

| Shader | Source / look |
| --- | --- |
| LaserFlower | Your shader pack; colorful symmetric light trails |
| Wormhole | Your shader pack; flowing tunnel patterns |
| Aurora | New; moving luminous radial ribbons |
| Stars | New; layered, twinkling starfield |

Set audio crossfade depth to **0** for an exact manual crossfade. With depth above
zero, the mix swings around the manual position according to input level. The browser player always isolates A at 0 and B at 1, in all blend modes.
The separate native project's compositor retains its original blend behavior.

Freeze stops that deck's animation clock; its audio pulse still responds. Set
its reaction amount to 0 as well for a fixed image. Blackout sets both decks'
brightness to zero while leaving their clocks running.

## Audio input

Input channel 1 feeds an RMS meter, then a muted gain and output sink. The meter
routes to `/video/control.energy`. Speaker monitoring is muted to avoid playing
the microphone back into the room. Keep `/audio/mute.level` at zero.

Choose `/audio`'s library, device and input-device in the IDE if defaults do not
match your interface. The Java host may need microphone permission. System music
requires routing into an installed loopback input. No audio device is opened
with `run.py --demo`; that mode generates a control pulse, not an audio track.

The controller uses a 40 ms attack and 300 ms release, applies sensitivity, then
routes the resulting envelope to both decks and the crossfader. It measures
loudness; this version does not perform frequency-band analysis or beat detection.

## Dome output

4096 × 4096 at 60 fps, black outside the circular image. Center = zenith; rim =
horizon. The shader wrapper reconstructs a 3D hemisphere ray from each equidistant
fisheye pixel, then applies the selected source projection. This is reprojection,
not just a circular mask. It does not turn a 2D source into a volumetric 3D scene. Projector
warp/blend is still specific to your venue. Change width/height before starting.

## Live/MCP controls

Load `video.pxr`, `audio.pxr`, and optionally `gui.pxr` into a fresh runtime, then
start the relevant roots. Use the MCP `control` tool, for example:

```json
{"name":"control","arguments":{"address":"/video/deck-a","control":"preset","values":["Wormhole"]}}
{"name":"control","arguments":{"address":"/video/control","control":"audio-mix","values":[0]}}
{"name":"control","arguments":{"address":"/video/control","control":"crossfade","values":[0.7]}}
{"name":"control","arguments":{"address":"/video/control","control":"blackout","values":[true]}}
```

Deck properties: `preset`, `speed`, `zoom`, `reaction`, `freeze`, `energy` and
`brightness`. The controller owns the last two while the video root is running.
Controller properties: `energy`, `sensitivity`, `crossfade`, `audio-mix`,
`brightness`, `blackout`, `demo`. Blend mode lives at `/video/mix.mode`.

## Edit and validate

Edit shader files, `deck.pxj` or `controller.pxj`, then regenerate:

```sh
python3 examples/shader-mixer/build_project.py
python3 examples/shader-mixer/validate.py
python3 examples/shader-mixer/check_gpu.py # macOS offscreen GPU check
# Optional: native window validation (currently stalls on this Mac)
python3 examples/shader-mixer/validate.py --gpu --gui
```

The first validation compiles the code and checks graph connections without
starting hardware. The GPU validation opens windows, cycles through all four
shaders, captures PNGs through the real video pipeline and checks live crossfade
routing. See `shaders/SOURCES.md` for pack attribution and wrapper details.
