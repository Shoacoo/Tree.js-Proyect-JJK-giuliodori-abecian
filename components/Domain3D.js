'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { PLATFORM_Y, createAltar, createBloodPool, createDomainSky, createShrine, createSkullField, createSukuna } from '@/three/domain';
import { LAYOUT, loadDomainModels } from '@/three/domainModels';
import { CursedParticles } from '@/three/particles';
import { glowTexture } from '@/three/proctex';
import { createRenderer } from '@/three/renderer';

// Recorrido de la cámara: quieta en la oscuridad y, con la luz, se acerca despacio.
// Con los modelos de Sketchfab el santuario es mucho más grande que el procedural, y al
// reír la cámara se le va encima a la cara (close).
const MODEL_CAMERA = {
  from: new THREE.Vector3(0, 6.5, 24),
  to: new THREE.Vector3(0, 3.7, 3.9),
  look: new THREE.Vector3(0, 3.45, LAYOUT.mouthZ),
  close: new THREE.Vector3(0, 4.32, -0.55),
  closeLook: new THREE.Vector3(0, 4.28, LAYOUT.mouthZ),
};
const PROCEDURAL_CAMERA = {
  from: new THREE.Vector3(0, 1.75, 9.8),
  to: new THREE.Vector3(0, 2.35, 3.6),
  look: new THREE.Vector3(0, PLATFORM_Y + 1.05, -0.2),
};
const PUSH_SECONDS = 8;

const ramp = (t, start, end) => THREE.MathUtils.smoothstep(t, start, end);

function disposeObject(root) {
  root.traverse((object) => {
    object.geometry?.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.filter(Boolean).forEach((material) => {
      Object.values(material).forEach((value) => {
        if (value?.isTexture) value.dispose();
      });
      material.dispose();
    });
  });
}

/**
 * Expansión de dominio de Sukuna. La fase la decide DomainExpansion:
 * dark (todo apagado), lit (se enciende el altar), laugh (la risa) y off (apagón).
 */
export default function Domain3D({ phase, reduceEffects }) {
  const mountRef = useRef(null);
  const live = useRef({ phase, reduceEffects, phaseAt: 0, litAt: null });

  useEffect(() => {
    const state = live.current;
    state.reduceEffects = reduceEffects;
    if (state.phase === phase) return;
    state.phase = phase;
    state.phaseAt = performance.now();
    if (phase === 'lit') state.litAt = state.phaseAt;
  }, [phase, reduceEffects]);

  useEffect(() => {
    const mount = mountRef.current;
    const state = live.current;
    state.phaseAt = performance.now();
    if (state.phase === 'lit') state.litAt = state.phaseAt;

    // Sin WebGL la expansión sigue igual con el texto y el sonido, sobre negro.
    const renderer = createRenderer({ antialias: true });
    if (!renderer) return undefined;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.setClearColor(0x000000, 1);
    renderer.domElement.setAttribute('aria-hidden', 'true');
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x040000, 0.045);
    const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 160);
    camera.position.copy(PROCEDURAL_CAMERA.from);

    const sky = createDomainSky();
    scene.add(sky);
    scene.add(createBloodPool());
    const altar = createAltar();
    scene.add(altar.group);

    // Luces: todas arrancan apagadas. Una cenital sobre Sukuna, roja desde el fondo de las
    // fauces, rojo en el ambiente y las velas del altar.
    const hemi = new THREE.HemisphereLight(0x5a0a06, 0x000000, 0);
    scene.add(hemi);
    const spot = new THREE.SpotLight(0xe8e4ff, 0, 16, 0.42, 0.7, 1.4);
    spot.castShadow = true;
    spot.shadow.mapSize.set(1024, 1024);
    spot.shadow.bias = -0.0004;
    scene.add(spot, spot.target);
    const rim = new THREE.PointLight(0xd0180c, 0, 6, 1.6);
    scene.add(rim);

    const particles = new CursedParticles(260);
    particles.material.uniforms.uPixelRatio.value = renderer.getPixelRatio();
    particles.material.uniforms.uSize.value = 9;
    scene.add(particles.points);

    // Elenco: los modelos de Sketchfab o, si no cargan, la versión procedural.
    let cast = null;
    let disposed = false;

    const applyModels = (models) => {
      altar.group.position.set(0, LAYOUT.altar.y, LAYOUT.altar.z);
      altar.group.scale.setScalar(LAYOUT.altar.scale);
      // Cenital estrecha desde arriba y adelante: entra por las fauces hasta Sukuna.
      spot.position.set(0, 7.2, 6.5);
      spot.target.position.set(0, LAYOUT.mouthFloor + 1.1, LAYOUT.mouthZ);
      spot.angle = 0.2;
      spot.distance = 22;
      rim.position.set(0, LAYOUT.throat.y + 0.2, LAYOUT.throat.z + 0.8);
      rim.distance = 9;
      // Resplandor del fondo de la garganta.
      const throat = new THREE.Mesh(
        new THREE.CircleGeometry(1.7, 40),
        new THREE.MeshBasicMaterial({ map: glowTexture('200,20,10'), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }),
      );
      throat.position.set(0, LAYOUT.throat.y, LAYOUT.throat.z);
      // Fuego rojo a los costados: deja ver los pilares y los cráneos.
      const sides = [-3.6, 3.6].map((x) => {
        const light = new THREE.PointLight(0xff3010, 0, 9, 1.8);
        light.position.set(x, 2.4, 1.8);
        return light;
      });
      scene.add(models.shrine, models.sukuna, throat, ...sides);
      cast = {
        camera: MODEL_CAMERA,
        shared: [models.shrine, models.sukuna],
        eyes: [],
        glows: models.glows,
        grin: null,
        throat: throat.material,
        sides,
        power: { spot: 200, rim: 16, candle: 3.4, sides: 8, ambient: 0.55 },
        headDown: 0.35,
        setHead: (angle, bob) => models.setHead(angle, bob / LAYOUT.sukunaScale),
        breathe: (amount) => models.breathe(amount * 2),
      };
    };

    const applyProcedural = () => {
      const shrine = createShrine();
      const sukuna = createSukuna();
      sukuna.group.position.set(0, PLATFORM_Y, -0.55);
      sukuna.group.scale.setScalar(1.3);
      altar.group.position.set(0, PLATFORM_Y, 0.42);
      spot.position.set(0, PLATFORM_Y + 5.4, -1.4);
      spot.target.position.set(0, PLATFORM_Y + 0.6, -0.2);
      rim.position.set(0, PLATFORM_Y + 1.2, -1.6);
      scene.add(shrine.group, createSkullField(), sukuna.group);
      cast = {
        camera: PROCEDURAL_CAMERA,
        shared: [],
        eyes: sukuna.eyes,
        glows: sukuna.glows,
        grin: sukuna.grin,
        throat: shrine.throat.material,
        sides: [],
        power: { spot: 95, rim: 7, candle: 2.2, sides: 0, ambient: 0.35 },
        headDown: 0.28,
        setHead: (angle, bob) => {
          sukuna.head.rotation.x = angle;
          sukuna.head.position.y = 1.12 + bob;
        },
        breathe: (amount) => {
          sukuna.body.scale.y = 1 + amount;
        },
      };
    };

    loadDomainModels().then((models) => {
      if (disposed) return;
      if (models) applyModels(models);
      else applyProcedural();
    });

    const resize = () => {
      const { clientWidth, clientHeight } = mount;
      if (!clientWidth || !clientHeight) return;
      renderer.setSize(clientWidth, clientHeight, false);
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      camera.aspect = clientWidth / clientHeight;
      // En vertical se abre el campo para que entren Sukuna y el altar.
      camera.fov = camera.aspect < 1 ? 62 : 42;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();

    const timer = new THREE.Timer();
    const tmp = new THREE.Vector3();
    const look = new THREE.Vector3();
    const flameSize = altar.flames.map((f) => f.glow.scale.x);
    let frame = 0;
    let emit = 0;
    let lastEyes = 0;

    const tick = () => {
      frame = requestAnimationFrame(tick);
      timer.update();
      const dt = Math.min(timer.getDelta(), 0.05);
      const elapsed = timer.getElapsed();
      const now = performance.now();
      const reduce = state.reduceEffects;
      const p = state.phase;
      const t = (now - state.phaseAt) / 1000;
      const sinceLit = state.litAt === null ? -1 : (now - state.litAt) / 1000;
      const on = p === 'lit' || p === 'laugh';
      const flicker = reduce ? 1 : 0.86 + Math.sin(elapsed * 23) * 0.05 + Math.random() * 0.09;

      let candle = 0;
      let spotLevel = 0;
      let rimLevel = 0;
      let ambient = 0;
      let eyes = 0;
      let grin = 0;
      let lift = 0;
      let bob = 0;
      let shake = 0;
      if (on) {
        candle = ramp(sinceLit, 0, 0.45) * flicker;
        // La luz de arriba tarda un instante y titila al prender.
        spotLevel = ramp(sinceLit, 0.25, 1.5);
        if (!reduce && sinceLit < 1.1 && Math.random() < 0.3) spotLevel *= 0.15;
        rimLevel = ramp(sinceLit, 0.8, 3.2);
        ambient = ramp(sinceLit, 0.4, 3);
        // Abre los ojos y levanta la cabeza para mirarte.
        eyes = ramp(sinceLit, 2.4, 3.3);
        lift = ramp(sinceLit, 2.4, 3.8);
      }
      if (p === 'laugh') {
        grin = ramp(t, 0, 0.25);
        eyes *= 1 + 0.9 * ramp(t, 0, 0.3);
        const fade = 1 - ramp(t, 1.4, 2.2);
        bob = reduce ? 0 : Math.abs(Math.sin(t * Math.PI * 3.4)) * 0.018 * fade;
        shake = reduce ? 0 : 0.012 * fade;
        if (!reduce) spotLevel *= 0.9 + Math.random() * 0.1;
      }
      if (p === 'off') {
        // Apagón: todo se corta de golpe; los ojos (y la sonrisa) quedan un instante más.
        eyes = t < 0.35 ? lastEyes : 0;
        grin = t < 0.35 ? 1 : 0;
      } else {
        lastEyes = eyes;
      }

      const power = cast?.power ?? { spot: 0, rim: 0, candle: 2.2, sides: 0, ambient: 0 };
      altar.light.intensity = candle * power.candle;
      altar.flames.forEach(({ core, glow }, i) => {
        core.material.opacity = Math.min(1, candle * 1.2);
        core.scale.y = 2.3 * (reduce ? 1 : 0.85 + Math.random() * 0.3);
        glow.material.opacity = candle * 0.85;
        glow.scale.setScalar(flameSize[i] * (reduce ? 1 : 0.9 + Math.random() * 0.2));
      });
      spot.intensity = spotLevel * power.spot;
      rim.intensity = rimLevel * power.rim;
      hemi.intensity = ambient * power.ambient;
      sky.material.uniforms.uLight.value = ambient;

      if (cast) {
        cast.throat.opacity = rimLevel * 0.45 * (reduce ? 1 : 0.85 + Math.sin(elapsed * 1.3) * 0.15);
        cast.sides.forEach((light, i) => {
          light.intensity = rimLevel * power.sides * (reduce ? 1 : 0.8 + Math.sin(elapsed * 9 + i * 2) * 0.1 + Math.random() * 0.1);
        });
        cast.eyes.forEach((m) => (m.opacity = Math.min(1, eyes)));
        cast.glows.forEach((m) => (m.opacity = Math.min(1, eyes) * (p === 'laugh' ? 1 : 0.7)));
        if (cast.grin) cast.grin.opacity = grin;
        // Cabeza gacha que se levanta; al reír se echa hacia atrás y se sacude.
        const tilt = p === 'laugh' ? 0.14 * ramp(t, 0, 0.4) * (1 - ramp(t, 1.8, 2.4)) : 0;
        cast.setHead(cast.headDown * (1 - lift) - tilt, bob);
        cast.breathe((reduce ? 0 : Math.sin(elapsed * 1.4) * 0.006) + bob * 0.4);
      }

      const path = cast?.camera ?? PROCEDURAL_CAMERA;
      const push = sinceLit < 0 ? 0 : ramp(sinceLit, 0, PUSH_SECONDS);
      camera.position.lerpVectors(path.from, path.to, push);
      look.copy(path.look);
      // La risa: la cámara se le acerca de golpe a la cara (con menos efectos, corte directo).
      if (path.close && (p === 'laugh' || p === 'off')) {
        const close = p === 'off' || reduce ? 1 : ramp(t, 0.05, 0.8);
        camera.position.lerp(path.close, close);
        look.lerp(path.closeLook, close);
      }
      if (shake) camera.position.add(tmp.set((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake, 0));
      camera.lookAt(look);

      // Brasas que suben de las velas mientras están encendidas.
      if (candle > 0.1) {
        emit += dt * (reduce ? 3 : 10);
        while (emit > 1) {
          emit -= 1;
          altar.flames[Math.floor(Math.random() * altar.flames.length)].glow.getWorldPosition(tmp);
          particles.emit(tmp, 1, 0.2);
        }
      }
      particles.points.visible = p !== 'off';
      particles.update(dt);

      renderer.render(scene, camera);
    };
    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      timer.dispose();
      observer.disconnect();
      // Los modelos quedan en caché para no volver a descargarlos: se sacan antes de liberar.
      cast?.shared.forEach((object) => scene.remove(object));
      particles.dispose();
      disposeObject(scene);
      renderer.dispose();
      renderer.forceContextLoss();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} className="domain-canvas" />;
}
