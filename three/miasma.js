import * as THREE from 'three';

// Miasma: niebla de energía maldita a ras del piso de la bóveda.
// Capas horizontales con ruido fbm deformado (shader propio). La densidad depende de
// cuánto avanzó la inspección (uLevel, de 0 a 1) y las vetas rojas laten con uPulse.

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorld;
  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uLevel;
  uniform float uPulse;
  uniform float uLayer;
  varying vec2 vUv;
  varying vec3 vWorld;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * noise(p);
      p = p * 2.03 + vec2(1.7, 9.2);
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 p = vWorld.xz * 0.45 + uLayer * 3.1;
    float t = uTime * (0.06 + uLayer * 0.03);
    // El ruido se deforma con otro ruido: humo que se enrosca en lugar de manchas fijas.
    float w = fbm(p + vec2(t, -t * 0.7));
    float n = fbm(p * 1.4 + vec2(w, -w) * 1.8 + vec2(-t * 0.5, t * 0.3));
    // Más espeso hacia el fondo, donde está la puerta sellada.
    float back = smoothstep(5.0, -4.0, vWorld.z);
    float density = smoothstep(0.6 - uLevel * 0.3, 0.95, n + back * 0.22 * uLevel);
    vec2 edge = smoothstep(0.0, 0.14, vUv) * smoothstep(0.0, 0.14, 1.0 - vUv);
    float alpha = density * edge.x * edge.y * min(1.0, uLevel * 1.3) * (0.85 - uLayer * 0.25);
    // Humo rojizo con vetas encendidas que laten.
    float vein = smoothstep(0.7, 0.88, n) * (0.5 + uPulse * 0.9);
    vec3 color = mix(vec3(0.2, 0.045, 0.035), vec3(0.95, 0.16, 0.07), vein * uLevel);
    gl_FragColor = vec4(color, alpha);
  }
`;

export function createMiasma({ layers = 2, width = 11.6, depth = 9.6, center = [0, 1] } = {}) {
  const group = new THREE.Group();
  group.name = 'miasma';
  const shared = { uTime: { value: 0 }, uLevel: { value: 0 }, uPulse: { value: 0 } };
  const geometry = new THREE.PlaneGeometry(width, depth);
  for (let i = 0; i < layers; i += 1) {
    const material = new THREE.ShaderMaterial({
      uniforms: { ...shared, uLayer: { value: i } },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
    });
    const layer = new THREE.Mesh(geometry, material);
    layer.rotation.x = -Math.PI / 2;
    layer.position.set(center[0], 0.06 + i * 0.32, center[1]);
    layer.renderOrder = 2;
    layer.raycast = () => {};
    group.add(layer);
  }
  group.visible = false;

  return {
    group,
    update(time, level, pulse) {
      shared.uTime.value = time;
      shared.uLevel.value = level;
      shared.uPulse.value = pulse;
      // Sin corrupción no se dibuja: no cuesta nada al principio del recorrido.
      group.visible = level > 0.02;
    },
  };
}
