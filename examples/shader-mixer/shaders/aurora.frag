uniform float time;
uniform vec2 resolution;
uniform vec2 mouse;
void main() {
    vec2 p = (gl_FragCoord.xy / resolution - 0.5) * 2.0;
    float a = atan(p.y, p.x);
    float r = length(p);
    float ribbons = 0.0;
    for (int i = 0; i < 5; i++) {
        float f = float(i);
        float wave = 0.22 + f * 0.14 + 0.09 * sin(a * 5.0 + time * 0.7 + f);
        ribbons += exp(-abs(r - wave) * 65.0) * (0.5 + 0.5 * sin(a * 3.0 - time + f));
    }
    vec3 tint = 0.5 + 0.5 * cos(vec3(0.0, 2.1, 4.2) + a + time * 0.15);
    gl_FragColor = vec4(tint * ribbons * 1.7 + vec3(0.005, 0.008, 0.025), 1.0);
}
