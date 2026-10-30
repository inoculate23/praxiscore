# Audio Reactive Dome

A live 180° equidistant fisheye visual for PraxisLIVE: cyan latitude rings,
violet meridians, and drifting stars respond to the RMS level of live audio.
The center is the zenith, the circumference is the horizon, and the outside is
black. The circular output still needs your venue's projector warp/blend setup.

## Watch the preview

Open `preview.mp4`: a 12-second, 768 × 768, 30 fps video with an original generated
pulse-and-pad soundtrack. Its audio level drives the same `dome.pxj` drawing code
through an offline Java2D adapter. This is a rendered demonstration; it is not a
capture of the live audio device. `preview.png` is a still from that video.

## Run live

Open `project.pxp` in PraxisLIVE and use Build / Run. Alternatively, from the
repository root, after building PraxisCORE:

```sh
python3 examples/audio-reactive-dome/run.py
```

The live project renders at 4096 × 4096 / 60 fps and uses audio input channel 1.
Select the audio library, output device, and input device on `/audio` if the
system defaults are unsuitable. On macOS, allow the hosting Java process to use
the microphone. To react to system music instead, select a loopback audio device
that is already installed and route the music into its channel 1.

Audio is measured and then muted before reaching the output, so the input is
not played through speakers. Keep `/audio/mute.level` at zero for live mic use.
The muted sink is connected so the audio engine pulls and measures input buffers.

## Change the look

Controls on `/video/dome`:

| Control | Default | Effect |
| --- | --- | --- |
| `energy` | 0 | Raw input RMS, automatically updated from audio |
| `sensitivity` | 8 | Input gain for the visual response, range 0.1–30 |
| `speed` | 0.35 | Motion speed, range 0–3 |
| `brightness` | 0.8 | Overall brightness, range 0–1 |

The visual has a 45 ms attack and 300 ms release. It responds to loudness, with
continuous quiet motion; it does not separate frequency bands or detect beats.
Set root width/height before starting if you need a higher square resolution.

Edit `dome.pxj`, then run `python3 examples/audio-reactive-dome/build_project.py`
to regenerate `video.pxr`. The code can also be pasted into the live component's
code editor or set through the MCP `control` tool.

## Control through MCP

Use `evaluate_script` to load the contents of `video.pxr`, then `audio.pxr`.
These files create stopped pipelines. Start `/video` and `/audio` with the
`pipeline` tool. Example live control:

```json
{"name":"control","arguments":{"address":"/video/dome","control":"sensitivity","values":[12]}}
```

Use a fresh runtime without existing `/audio` and `/video` roots. To try a fixed
visual response without a microphone, leave `/audio` stopped and set
`/video/dome.energy` to `0.08`, then start only `/video`.

## Regenerate the video

```sh
python3 examples/audio-reactive-dome/render_preview.py
```

Requires Java 21 and ffmpeg; no Python packages. The renderer synthesizes audio,
measures each frame's RMS, and sends raw Java2D frames to ffmpeg. Temporary audio
and class files are removed automatically.

Validated: live code compilation in PraxisCORE, native audio/video connections,
control readback, and offline preview rendering. Live audio hardware and a
physical dome projector have not been tested here.
