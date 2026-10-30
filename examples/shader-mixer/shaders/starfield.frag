uniform float time;
uniform vec2 resolution;
uniform vec2 mouse;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
    vec2 p = (gl_FragCoord.xy / resolution - 0.5) * 2.0;
    vec3 c = vec3(0.002, 0.003, 0.012);
    for (int layer = 0; layer < 3; layer++) {
        float f = float(layer);
        vec2 q = p * (18.0 + f * 12.0) + vec2(time * (0.1 + f * 0.07), f * 11.0);
        vec2 cell = floor(q);
        vec2 pos = fract(q) - 0.5;
        vec2 offset = vec2(hash(cell), hash(cell + 13.2)) * 0.5 - 0.25;
        float star = exp(-length(pos - offset) * (90.0 - f * 15.0));
        star *= step(0.65, hash(cell + 81.0)) * (0.65 + 0.35 * sin(time * 2.0 + hash(cell) * 30.0));
        c += star * vec3(0.4 + f * 0.3, 0.6, 1.0) * 2.2;
    }
    gl_FragColor = vec4(c, 1.0);
}
