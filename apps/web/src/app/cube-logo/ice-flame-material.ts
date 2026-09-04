import * as THREE from "three";

const vertexShader = /* glsl */ `
  out vec3 vRayOrigin;
  out vec3 vRayDirection;

  void main() {
    vec4 worldCamera = vec4(cameraPosition, 1.0);
    vRayOrigin = (inverse(modelMatrix) * worldCamera).xyz;
    vRayDirection = position - vRayOrigin;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;

  in vec3 vRayOrigin;
  in vec3 vRayDirection;

  uniform float uTime;
  uniform float uSeed;
  uniform float uIntensity;
  uniform float uDark;

  out vec4 fragColor;

  vec2 intersectUnitBox(vec3 origin, vec3 direction) {
    vec3 safeDirection = direction;
    safeDirection.x = abs(direction.x) < 0.0001 ? 0.0001 : direction.x;
    safeDirection.y = abs(direction.y) < 0.0001 ? 0.0001 : direction.y;
    safeDirection.z = abs(direction.z) < 0.0001 ? 0.0001 : direction.z;
    vec3 inverseDirection = 1.0 / safeDirection;
    vec3 nearPlane = (-0.5 - origin) * inverseDirection;
    vec3 farPlane = (0.5 - origin) * inverseDirection;
    vec3 rayMin = min(nearPlane, farPlane);
    vec3 rayMax = max(nearPlane, farPlane);
    float nearHit = max(max(rayMin.x, rayMin.y), rayMin.z);
    float farHit = min(min(rayMax.x, rayMax.y), rayMax.z);
    return vec2(nearHit, farHit);
  }

  float softNoise(vec3 point) {
    float first = sin(point.x + sin(point.z * 0.83))
      * sin(point.y * 1.17 + cos(point.x * 0.61));
    float second = sin(point.z * 1.71 - point.y * 0.73)
      * cos(point.x * 1.39 + point.y * 0.47);
    return first * 0.64 + second * 0.36;
  }

  float flameDensity(vec3 point) {
    float height = clamp(point.y + 0.5, 0.0, 1.0);
    float time = uTime * 1.08 + uSeed;

    vec3 flowPoint = point;
    flowPoint.y -= uTime * 0.34;
    float broadNoise = softNoise(flowPoint * 5.1 + vec3(uSeed, 0.0, -uSeed));
    float detailNoise = softNoise(flowPoint * 9.2 + vec3(-uSeed * 0.7, time, uSeed * 0.43));

    vec2 sway = vec2(
      sin(height * 7.0 + time * 0.72),
      cos(height * 5.4 - time * 0.58)
    ) * (0.026 + height * 0.052);
    vec2 warped = point.xz - sway;
    warped += vec2(broadNoise, detailNoise) * (0.018 + height * 0.028);

    float taper = mix(0.31, 0.045, pow(height, 0.72));
    float body = 1.0 - smoothstep(taper * 0.56, taper, length(warped));

    float split = abs(warped.x + sin(height * 11.0 + time) * 0.025);
    float fork = smoothstep(0.018, 0.12, split) * smoothstep(0.48, 0.92, height);
    float rollingEdge = broadNoise * 0.22 + detailNoise * 0.1;
    float verticalWindow = smoothstep(0.015, 0.12, height)
      * (1.0 - smoothstep(0.79 + rollingEdge * 0.08, 1.0, height));

    return clamp(body * verticalWindow * mix(1.0, 0.52, fork) + rollingEdge * 0.12, 0.0, 1.0);
  }

  vec3 flameColor(float density, float height) {
    vec3 deepBlue = mix(vec3(0.025, 0.22, 0.76), vec3(0.035, 0.16, 0.58), uDark);
    vec3 iceBlue = mix(vec3(0.09, 0.68, 1.0), vec3(0.08, 0.58, 1.0), uDark);
    vec3 paleCyan = mix(vec3(0.66, 0.93, 1.0), vec3(0.54, 0.87, 1.0), uDark);
    vec3 warmWhite = mix(vec3(1.0, 0.94, 0.79), vec3(0.91, 0.95, 1.0), uDark);

    vec3 color = mix(deepBlue, iceBlue, smoothstep(0.12, 0.45, density));
    color = mix(color, paleCyan, smoothstep(0.42, 0.78, density));
    float hotCore = smoothstep(0.72, 1.0, density) * (1.0 - smoothstep(0.42, 0.78, height));
    return mix(color, warmWhite, hotCore * 0.72);
  }

  void main() {
    vec3 direction = normalize(vRayDirection);
    vec2 bounds = intersectUnitBox(vRayOrigin, direction);
    if (bounds.x > bounds.y || bounds.y < 0.0) discard;

    float rayStart = max(bounds.x, 0.0);
    float rayLength = bounds.y - rayStart;
    float stepLength = rayLength / 14.0;
    float jitter = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233)) + uSeed) * 43758.5453);
    float distanceAlongRay = rayStart + stepLength * jitter;

    vec3 accumulatedColor = vec3(0.0);
    float accumulatedAlpha = 0.0;

    for (int sampleIndex = 0; sampleIndex < 14; sampleIndex += 1) {
      if (distanceAlongRay > bounds.y || accumulatedAlpha > 0.93) break;
      vec3 point = vRayOrigin + direction * distanceAlongRay;
      float density = flameDensity(point);
      float height = clamp(point.y + 0.5, 0.0, 1.0);
      float sampleAlpha = density * density * 0.18 * uIntensity;
      vec3 sampleColor = flameColor(density, height);
      accumulatedColor += (1.0 - accumulatedAlpha) * sampleColor * sampleAlpha;
      accumulatedAlpha += (1.0 - accumulatedAlpha) * sampleAlpha;
      distanceAlongRay += stepLength;
    }

    if (accumulatedAlpha < 0.012) discard;
    float edgeSoftness = smoothstep(0.0, 0.16, accumulatedAlpha);
    fragColor = vec4(accumulatedColor * (1.18 + uDark * 0.08), accumulatedAlpha * edgeSoftness);
  }
`;

export function createIceFlameMaterial(seed: number, dark: boolean) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uSeed: { value: seed },
      uIntensity: { value: 0.92 },
      uDark: { value: dark ? 1 : 0 },
    },
    vertexShader,
    fragmentShader,
    glslVersion: THREE.GLSL3,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    transparent: false,
    depthWrite: false,
    depthTest: true,
    toneMapped: false,
  });
}

export function updateIceFlameMaterial(
  material: THREE.ShaderMaterial,
  time: number,
  intensity: number,
  dark: boolean,
) {
  const timeUniform = material.uniforms.uTime;
  const intensityUniform = material.uniforms.uIntensity;
  const darkUniform = material.uniforms.uDark;
  if (timeUniform) timeUniform.value = time;
  if (intensityUniform) intensityUniform.value = intensity;
  if (darkUniform) darkUniform.value = dark ? 1 : 0;
}
