// Equidistant 180-degree domemaster -> source image inverse mapping.
// Dome rays: +Z zenith, +Y front horizon, +X right horizon.
uniform int uProjection; // 0 perspective plane, 1 full 360x180 equirectangular, 2 180 fisheye
uniform float uSourceFov; // horizontal perspective FOV in degrees
uniform float uSourceAspect;
uniform float uYaw;
uniform float uTilt;
uniform bool uGrid;
vec2 sourceUV(vec2 pixel, vec2 outputSize, bool rectangular, float zoom) {
    if (rectangular) return (pixel / outputSize - 0.5) / zoom + 0.5;
    vec2 p = (2.0 * pixel - outputSize) / min(outputSize.x, outputSize.y);
    float radius = length(p);
    if (radius > 1.0) return vec2(-10.0);
    float theta = radius * 1.57079632679;
    vec3 ray = vec3(p * (sin(theta) / max(radius, 0.000001)), cos(theta));
    float yaw = uYaw * 0.01745329252;
    float tilt = uTilt * 0.01745329252;
    ray.xy = mat2(cos(yaw), -sin(yaw), sin(yaw), cos(yaw)) * ray.xy;
    ray.yz = mat2(cos(tilt), sin(tilt), -sin(tilt), cos(tilt)) * ray.yz;
    if (uProjection == 1) {
        return vec2(fract(atan(ray.x, ray.y) / 6.28318530718 + 0.5),
                    0.5 + asin(clamp(ray.z, -1.0, 1.0)) / 3.14159265359);
    }
    if (uProjection == 2) {
        float angle = acos(clamp(ray.z, -1.0, 1.0));
        if (angle > 1.57079632679) return vec2(-10.0);
        return 0.5 + normalize(ray.xy + vec2(0.00000001)) * (angle / 3.14159265359);
    }
    if (ray.z <= 0.00001) return vec2(-10.0);
    float fov = uSourceFov > 0.0 ? uSourceFov : 150.0;
    float aspect = uSourceAspect > 0.0 ? uSourceAspect : 1.0;
    float halfWidth = tan(fov * 0.00872664626) * zoom;
    vec2 plane = ray.xy / ray.z;
    return 0.5 + plane / vec2(2.0 * halfWidth, 2.0 * halfWidth / aspect);
}
bool validUV(vec2 uv) { return all(greaterThanEqual(uv, vec2(0.0))) && all(lessThanEqual(uv, vec2(1.0))); }
vec3 calibrationGrid(vec2 uv) {
    vec2 cell = abs(fract(uv * 12.0 + 0.5) - 0.5);
    float line = 1.0 - step(0.012, min(cell.x, cell.y));
    vec3 color = mix(vec3(0.025), vec3(0.7), line);
    if (abs(uv.x - 0.5) < 0.003) color = vec3(1.0, 0.15, 0.15);
    if (abs(uv.y - 0.5) < 0.003) color = vec3(0.15, 1.0, 0.15);
    return color;
}
