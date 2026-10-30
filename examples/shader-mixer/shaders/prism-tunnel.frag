// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Craig Ellenwood
// Original shader for this project, created with OpenAI Codex assistance.
// See LICENSE.project-shaders for the complete license.
uniform float time;
uniform vec2 resolution;
uniform vec2 mouse;

void main() {
    vec2 p = (gl_FragCoord.xy - resolution * 0.5) / min(resolution.x, resolution.y);
    float radius = max(length(p), 0.012);
    float angle = atan(p.y, p.x);
    float travel = -log(radius) * 2.4 - time * 0.65;
    float twist = angle * 8.0 + sin(travel * 1.1 + time * 0.3) * 0.8;
    float rings = exp(-abs(sin(travel * 3.14159265)) * 24.0);
    float spokes = exp(-abs(sin(twist)) * 35.0);
    float facets = 0.5 + 0.5 * sin(twist + travel * 1.5);
    vec3 tint = 0.5 + 0.5 * cos(vec3(0.2, 2.3, 4.4) + travel * 0.7 + angle);
    float fade = smoothstep(0.012, 0.06, radius);
    vec3 color = (tint * (rings * 1.3 + spokes * 0.7) + tint * facets * 0.08) * fade;
    gl_FragColor = vec4(color, 1.0);
}
