import * as THREE from 'three';

// Aura de energía maldita: un caparazón alrededor del dedo con fresnel y ruido animado.
// uIntensity crece con los sellos retirados y con la energía filtrada.
export function createAuraMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uIntensity: { value: 0.15 },
      uColor: { value: new THREE.Color(0xc7352a) },
      uCore: { value: new THREE.Color(0x120404) },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uIntensity;
      varying vec3 vNormal;
      varying vec3 vView;
      varying vec3 vPos;

      void main() {
        vec3 p = position;
        float wave = sin(p.x * 3.0 - uTime * 2.2) * 0.5 + sin(p.x * 7.0 + p.y * 5.0 + uTime * 3.1) * 0.5;
        p += normal * (0.12 + 0.18 * uIntensity + wave * 0.05 * uIntensity);
        vec4 world = modelMatrix * vec4(p, 1.0);
        vNormal = normalize(mat3(modelMatrix) * normal);
        vView = normalize(cameraPosition - world.xyz);
        vPos = p;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uIntensity;
      uniform vec3 uColor;
      uniform vec3 uCore;
      varying vec3 vNormal;
      varying vec3 vView;
      varying vec3 vPos;

      float hash(vec3 p) {
        return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
      }

      float noise(vec3 p) {
        vec3 i = floor(p);
        vec3 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float n = mix(
          mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
          mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y),
          f.z);
        return n;
      }

      void main() {
        float fresnel = pow(1.0 - abs(dot(normalize(vNormal), vView)), 2.2);
        float flame = noise(vPos * 2.2 + vec3(0.0, -uTime * 1.4, uTime * 0.5));
        flame = smoothstep(0.35, 0.95, flame + fresnel * 0.4);
        vec3 color = mix(uCore, uColor, flame);
        float alpha = fresnel * flame * clamp(uIntensity, 0.0, 1.6);
        gl_FragColor = vec4(color * (0.6 + uIntensity), alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.FrontSide,
  });
}
