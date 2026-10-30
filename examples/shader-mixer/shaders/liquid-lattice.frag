// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Craig Ellenwood
// Original shader for this project, created with OpenAI Codex assistance.
// See LICENSE.project-shaders for the complete license.
uniform float time;
uniform vec2 resolution;
uniform vec2 mouse;

void main() {
    vec2 p = (gl_FragCoord.xy - resolution * 0.5) / min(resolution.x, resolution.y);
    float drift = time * 0.35;
    vec2 q = p * 7.0;
    q += vec2(sin(q.y * 0.7 + drift), cos(q.x * 0.8 - drift)) * 0.8;
    float a = sin(q.x + sin(q.y + drift) * 0.5);
    float b = sin(q.y + cos(q.x - drift) * 0.5);
    float grid = exp(-abs(a) * 24.0) + exp(-abs(b) * 24.0);
    float nodes = exp(-(a * a + b * b) * 80.0);
    float phase = q.x * 0.2 + q.y * 0.15 + drift;
    vec3 tint = 0.5 + 0.5 * cos(vec3(0.0, 2.0, 4.0) + phase);
    vec3 color = tint * grid * 0.6 + vec3(0.6, 0.85, 1.0) * nodes * 0.8;
    gl_FragColor = vec4(color + vec3(0.003, 0.006, 0.015), 1.0);
}
