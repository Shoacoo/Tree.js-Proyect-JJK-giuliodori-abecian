import * as THREE from 'three';

// Sistema de partículas de energía maldita: brasas rojas y humo negro que suben del dedo.
export class CursedParticles {
  constructor(max = 700) {
    this.max = max;
    this.cursor = 0;
    this.velocities = new Float32Array(max * 3);
    const positions = new Float32Array(max * 3);
    const life = new Float32Array(max);
    const seed = new Float32Array(max);
    for (let i = 0; i < max; i += 1) seed[i] = Math.random();

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.geometry.setAttribute('life', new THREE.BufferAttribute(life, 1));
    this.geometry.setAttribute('seed', new THREE.BufferAttribute(seed, 1));

    this.material = new THREE.ShaderMaterial({
      uniforms: { uPixelRatio: { value: 1 }, uSize: { value: 26 } },
      vertexShader: /* glsl */ `
        attribute float life;
        attribute float seed;
        uniform float uPixelRatio;
        uniform float uSize;
        varying float vLife;
        varying float vSeed;
        void main() {
          vLife = life;
          vSeed = seed;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = uSize * uPixelRatio * (0.4 + life) * (0.5 + seed) / -mv.z;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        varying float vLife;
        varying float vSeed;
        void main() {
          if (vLife <= 0.0) discard;
          float d = length(gl_PointCoord - 0.5);
          float alpha = smoothstep(0.5, 0.0, d) * vLife;
          vec3 ember = mix(vec3(0.35, 0.02, 0.02), vec3(1.0, 0.32, 0.22), vLife);
          vec3 smoke = vec3(0.04, 0.01, 0.01);
          vec3 color = vSeed > 0.55 ? smoke : ember;
          gl_FragColor = vec4(color, alpha * (vSeed > 0.55 ? 0.55 : 0.9));
        }
      `,
      transparent: true,
      depthWrite: false,
    });

    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    this.points.name = 'cursed-particles';
  }

  emit(origin, count = 40, speed = 1) {
    const positions = this.geometry.attributes.position.array;
    const life = this.geometry.attributes.life.array;
    for (let n = 0; n < count; n += 1) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % this.max;
      positions[i * 3] = origin.x + (Math.random() - 0.5) * 0.8;
      positions[i * 3 + 1] = origin.y + (Math.random() - 0.5) * 0.6;
      positions[i * 3 + 2] = origin.z + (Math.random() - 0.5) * 0.8;
      this.velocities[i * 3] = (Math.random() - 0.5) * 1.6 * speed;
      this.velocities[i * 3 + 1] = (0.8 + Math.random() * 2.2) * speed;
      this.velocities[i * 3 + 2] = (Math.random() - 0.5) * 1.6 * speed;
      life[i] = 1;
    }
  }

  update(dt) {
    const positions = this.geometry.attributes.position.array;
    const life = this.geometry.attributes.life.array;
    for (let i = 0; i < this.max; i += 1) {
      if (life[i] <= 0) continue;
      life[i] = Math.max(0, life[i] - dt * 0.55);
      positions[i * 3] += this.velocities[i * 3] * dt;
      positions[i * 3 + 1] += this.velocities[i * 3 + 1] * dt;
      positions[i * 3 + 2] += this.velocities[i * 3 + 2] * dt;
      this.velocities[i * 3] *= 0.985;
      this.velocities[i * 3 + 2] *= 0.985;
    }
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.life.needsUpdate = true;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}
