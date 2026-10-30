# Shader sources

`RGBlaserflower.frag` and `PBwormhole.frag` are unchanged local copies from the
user-supplied `GLSLShader_ExpansionPack_Beta3/GLSLShader_ExpansionPack` directory.
LaserFlower's source credits `@paulofalcao`; that credit is preserved. The inspected
pack directory contained no top-level README or license file. These local project
copies do not establish permission for public redistribution.

`aurora.frag` and `starfield.frag` were written for this mixer.

`build_project.py` wraps each source for PraxisLIVE: entry point/output names,
hemisphere sampling, an antialiased circular mask, tone mapping, audio pulse and
brightness. The wrapper also guards the wormhole's center-distance division.
The source files remain editable and the generated native project is standalone;
it has no dependency on the external SSD.

## Magic pack

`magic/*.glsl` are unchanged copies of all 186 files in the user-supplied folder
`/Users/craigellenwood/Documents/comfy/workfllws/Magic-Add-ons/GLSLShader/GLSL/shaders`.
Original author comments are retained. The generated browser library adapts 185
standalone programs and inlines the remaining noise helper. These files are kept
locally for this project; their presence does not establish redistribution rights.
The source library is independent of the original Documents folder after import.

## Repository exclusions and original work

The imported `.frag` files and `magic/` directory remain locally available but
are ignored by Git, together with generated files embedding their source.
`aurora.frag` and `starfield.frag` are the project-authored effects included in the
repository. This extension project is directed and developed by Craig Ellenwood
with implementation assistance from OpenAI Codex. It does not claim authorship
of the imported shader compositions.

## Explicitly MIT-licensed project shaders

- **PrismTunnel** (`prism-tunnel.frag`): moving polygonal tunnel rings and spokes.
- **LiquidLattice** (`liquid-lattice.frag`): flowing, luminous grid with bright nodes.

Both were newly authored for Craig Ellenwood's project with OpenAI Codex
assistance; neither was copied from the imported packs. Each file includes an
SPDX MIT identifier and points to `LICENSE.project-shaders`, which contains the
complete license. These two files and their license are included in Git candidates.
They support the player's audio response, mixing and dome/rectangular projection.
The MIT grant applies to these named shader files only.
