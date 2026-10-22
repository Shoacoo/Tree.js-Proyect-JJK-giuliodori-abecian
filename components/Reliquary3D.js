'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { createAuraMaterial } from '@/three/auraShader';
import { createFinger } from '@/three/finger';
import { applyFingerModel, fitBandToProfile } from '@/three/fingerModel';
import { createLooseOfuda, createSealBand } from '@/three/ofuda';
import { CursedParticles } from '@/three/particles';
import { createScenery } from '@/three/scenery';

const HOLD_MS = 900; // mantener presionado para despegar con cuidado
const RIP_MIN_MS = 160; // soltar después de esto y antes de HOLD_MS arranca el sello
const MAX_PIXEL_RATIO = 2;

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
 * Relicario: escena Three.js del expediente.
 * React decide qué significa cada acción (useProgress); esta escena solo representa y anima.
 */
export default function Reliquary3D({
  caseData,
  sealState,
  leak,
  influence,
  reduceEffects,
  lamp,
  apiRef,
  onHover,
  onPeel,
  onHint,
}) {
  const mountRef = useRef(null);
  const live = useRef({});

  // Props que cambian seguido llegan a la escena por una ref, sin reconstruirla.
  useEffect(() => {
    live.current.sealState = sealState;
    live.current.leak = leak;
    live.current.influence = influence;
    live.current.reduceEffects = reduceEffects;
    live.current.lamp = lamp;
    live.current.onHover = onHover;
    live.current.onPeel = onPeel;
    live.current.onHint = onHint;
    live.current.sync?.();
  });

  useEffect(() => {
    const mount = mountRef.current;
    const liveState = live.current;
    const length = caseData.length;

    // Renderer, escena y cámara.
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.domElement.style.touchAction = 'none';
    renderer.domElement.setAttribute('aria-hidden', 'true');
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d0b09);
    scene.fog = new THREE.Fog(0x0d0b09, 34, 70);

    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 200);
    const target = new THREE.Vector3(0.3, -0.4, 1.2);
    const DEFAULT_DISTANCE = 19;
    const view = { distance: DEFAULT_DISTANCE, minDistance: 9, maxDistance: 34, elevation: 0.82 };
    const placeCamera = () => {
      camera.position.set(0, Math.sin(view.elevation) * view.distance, Math.cos(view.elevation) * view.distance);
      camera.position.add(target);
      camera.lookAt(target);
    };
    placeCamera();

    // Iluminación: luz cenital dura (3200 K), relleno muy bajo y la luz roja del aura.
    const ambient = new THREE.HemisphereLight(0x9a8a76, 0x0d0b09, 0.6);
    scene.add(ambient);
    const spot = new THREE.SpotLight(0xffd9a8, 900, 60, 0.42, 0.55, 1.5);
    spot.position.set(0.5, 24, 3);
    spot.target.position.set(0, -1, 0);
    spot.castShadow = true;
    spot.shadow.mapSize.set(1024, 1024);
    spot.shadow.bias = -0.0004;
    scene.add(spot, spot.target);
    const curseLight = new THREE.PointLight(0xc7352a, 0, 18, 1.8);
    curseLight.position.set(0, 1.5, 0);
    scene.add(curseLight);
    // Luz rasante de inspección: delata la tinta fresca.
    const rakingLight = new THREE.DirectionalLight(0xbfd4ff, 0);
    rakingLight.position.set(-18, 2, 2);
    scene.add(rakingLight);

    scene.add(createScenery(caseData.code));

    // Relicario: dedo, bandas, aura. Se rota con el puntero.
    const relic = new THREE.Group();
    relic.position.y = -0.3;
    scene.add(relic);
    const { group: finger, skin } = createFinger(length);
    relic.add(finger);

    const aura = new THREE.Mesh(skin.geometry, createAuraMaterial());
    aura.renderOrder = 2;
    relic.add(aura);

    const bands = new Map();
    caseData.seals.forEach((seal) => {
      const band = createSealBand(seal, length);
      band.userData.ink = seal.ink;
      relic.add(band);
      bands.set(seal.id, band);
    });
    applyFingerModel(finger, aura, length).then((profile) => {
      if (profile) bands.forEach((band) => fitBandToProfile(band, profile));
    });

    const particles = new CursedParticles(reduceEffects ? 220 : 700);
    particles.material.uniforms.uPixelRatio.value = renderer.getPixelRatio();
    scene.add(particles.points);

    const loose = new THREE.Group();
    scene.add(loose);

    // Animaciones de los sellos que se retiran.
    const peeling = new Map();
    let looseCount = 0;
    const sync = () => {
      const state = live.current.sealState ?? {};
      caseData.seals.forEach((seal) => {
        const band = bands.get(seal.id);
        const s = state[seal.id];
        if (s?.peeled && band.visible && !peeling.has(seal.id)) {
          peeling.set(seal.id, { start: performance.now(), ripped: s.ripped, duration: s.ripped ? 450 : 1300 });
          const origin = new THREE.Vector3();
          band.getWorldPosition(origin);
          particles.emit(origin, s.ripped ? 160 : 60, s.ripped ? 2.2 : 1);
        }
        if (!s?.peeled && !band.visible) {
          band.visible = true;
          band.material.opacity = 1;
        }
      });
    };
    liveState.sync = sync;

    // Raycasting y manejo del puntero.
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let hovered = null;
    let hold = null;
    let drag = null;

    const pickSeal = (event) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const candidates = [...bands.values()].filter((b) => b.visible && !peeling.has(b.userData.sealId));
      const hit = raycaster.intersectObjects(candidates, false)[0];
      return hit?.object.userData.sealId ?? null;
    };

    const setHovered = (id) => {
      if (id === hovered) return;
      hovered = id;
      renderer.domElement.style.cursor = id ? 'pointer' : 'grab';
      live.current.onHover?.(id);
    };

    const onPointerMove = (event) => {
      if (drag) {
        const dx = event.clientX - drag.x;
        const dy = event.clientY - drag.y;
        relic.rotation.x = THREE.MathUtils.clamp(drag.rx + dy * 0.01, -Math.PI, Math.PI);
        relic.rotation.y = THREE.MathUtils.clamp(drag.ry + dx * 0.006, -0.7, 0.7);
        return;
      }
      if (!hold) setHovered(pickSeal(event));
    };

    const onPointerDown = (event) => {
      renderer.domElement.setPointerCapture(event.pointerId);
      const id = pickSeal(event);
      if (id) {
        hold = { id, start: performance.now(), done: false };
        live.current.onHint?.('hold');
      } else {
        drag = { x: event.clientX, y: event.clientY, rx: relic.rotation.x, ry: relic.rotation.y };
        renderer.domElement.style.cursor = 'grabbing';
      }
    };

    const releaseHold = () => {
      if (!hold) return;
      const elapsed = performance.now() - hold.start;
      const band = bands.get(hold.id);
      band.material.emissiveIntensity = 0;
      band.position.y = band.userData.baseY;
      if (!hold.done) {
        if (elapsed >= RIP_MIN_MS) live.current.onPeel?.(hold.id, false);
        else live.current.onHint?.('tap');
      }
      hold = null;
    };

    const onPointerUp = (event) => {
      if (renderer.domElement.hasPointerCapture(event.pointerId)) {
        renderer.domElement.releasePointerCapture(event.pointerId);
      }
      releaseHold();
      drag = null;
      renderer.domElement.style.cursor = hovered ? 'pointer' : 'grab';
    };

    const onWheel = (event) => {
      event.preventDefault();
      view.distance = THREE.MathUtils.clamp(view.distance + event.deltaY * 0.01, view.minDistance, view.maxDistance);
      placeCamera();
    };

    const canvas = renderer.domElement;
    canvas.style.cursor = 'grab';
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('pointerleave', () => !hold && setHovered(null));
    canvas.addEventListener('wheel', onWheel, { passive: false });

    // Controles de cámara expuestos a los botones del DOM.
    if (apiRef) {
      apiRef.current = {
        zoomIn: () => {
          view.distance = Math.max(view.minDistance, view.distance - 3);
          placeCamera();
        },
        zoomOut: () => {
          view.distance = Math.min(view.maxDistance, view.distance + 3);
          placeCamera();
        },
        reset: () => {
          view.distance = DEFAULT_DISTANCE;
          relic.rotation.set(0, 0, 0);
          placeCamera();
        },
      };
    }

    // Adaptación del canvas al contenedor.
    const resize = () => {
      const { clientWidth, clientHeight } = mount;
      if (!clientWidth || !clientHeight) return;
      renderer.setSize(clientWidth, clientHeight, false);
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      camera.aspect = clientWidth / clientHeight;
      // En pantallas angostas se aleja la cámara para que entre el dedo completo.
      view.minDistance = camera.aspect < 1 ? 16 : 9;
      view.distance = Math.max(view.distance, camera.aspect < 1 ? 30 : 0);
      view.maxDistance = camera.aspect < 1 ? 44 : 34;
      placeCamera();
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();
    sync();

    // Bucle de animación.
    const timer = new THREE.Timer();
    let frame = 0;
    let ambientEmit = 0;
    const tmp = new THREE.Vector3();

    const tick = () => {
      frame = requestAnimationFrame(tick);
      timer.update();
      const dt = Math.min(timer.getDelta(), 0.05);
      const elapsed = timer.getElapsed();
      const reduce = live.current.reduceEffects;
      const state = live.current.sealState ?? {};
      const peeledCount = caseData.seals.filter((s) => state[s.id]?.peeled).length;
      const intensity = Math.min(1.6, 0.12 + (peeledCount / caseData.seals.length) * 0.55 + (live.current.leak ?? 0) * 0.16);

      if (!reduce) aura.material.uniforms.uTime.value += dt;
      aura.material.uniforms.uIntensity.value += (intensity - aura.material.uniforms.uIntensity.value) * Math.min(1, dt * 3);
      const flicker = reduce ? 1 : 0.8 + Math.sin(elapsed * 9) * 0.1 + Math.random() * 0.1;
      curseLight.intensity = intensity * 26 * flicker;
      rakingLight.intensity = live.current.lamp ? 2.2 : 0;
      // Con la luz rasante, la tinta fresca brilla apenas.
      bands.forEach((band) => {
        if (!hold || hold.id !== band.userData.sealId) {
          band.material.emissiveIntensity = live.current.lamp && band.userData.ink === 'fresca' ? 0.35 : 0;
          band.material.emissive.set(live.current.lamp ? 0x5b7bd6 : 0x9e1f17);
        }
      });

      // El tubo fluorescente parpadea más cuanto más avanza la influencia.
      const influenceLevel = live.current.influence ?? 0;
      if (!reduce && Math.random() < 0.004 + influenceLevel * 0.006) spot.intensity = 120;
      else spot.intensity += (900 - spot.intensity) * Math.min(1, dt * 8);

      // Mantener presionado: el sello se tensa y se despega con cuidado al completar.
      if (hold && !hold.done) {
        const band = bands.get(hold.id);
        const p = Math.min(1, (performance.now() - hold.start) / HOLD_MS);
        band.material.emissive.set(0x9e1f17);
        band.material.emissiveIntensity = p * 0.6;
        band.position.y = band.userData.baseY + p * 0.25 + (reduce ? 0 : (Math.random() - 0.5) * 0.03 * p);
        if (p >= 1) {
          hold.done = true;
          live.current.onPeel?.(hold.id, true);
        }
      }

      // Sellos que se van: suben, giran y se desvanecen; quedan planos sobre la mesa.
      peeling.forEach((anim, id) => {
        const band = bands.get(id);
        if (!band.visible) return;
        const p = Math.min(1, (performance.now() - anim.start) / anim.duration);
        const ease = 1 - (1 - p) ** 3;
        band.position.y = band.userData.baseY + ease * (anim.ripped ? 2.2 : 3.4);
        band.rotation.x = ease * (anim.ripped ? 4 : 1.6);
        band.rotation.z = anim.ripped ? ease * 0.8 : 0;
        band.scale.setScalar(1 + ease * 0.6);
        band.material.opacity = 1 - ease;
        if (p >= 1) {
          band.visible = false;
          const seal = caseData.seals.find((s) => s.id === id);
          loose.add(createLooseOfuda(seal, looseCount));
          looseCount += 1;
        }
      });

      // Emisión continua: más energía filtrada, más partículas.
      ambientEmit += dt * intensity * (reduce ? 6 : 28);
      while (ambientEmit > 1) {
        ambientEmit -= 1;
        tmp.set((Math.random() - 0.5) * length, 0.4, 0);
        relic.localToWorld(tmp);
        particles.emit(tmp, 1, 0.5);
      }
      particles.update(dt);

      // Respiración leve del relicario cuando no se lo está girando.
      if (!drag && !reduce) relic.position.y = -0.3 + Math.sin(elapsed * 1.3) * 0.02 * intensity;

      renderer.render(scene, camera);
    };
    tick();

    // Liberación de recursos al desmontar.
    return () => {
      cancelAnimationFrame(frame);
      timer.dispose();
      observer.disconnect();
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('wheel', onWheel);
      liveState.sync = null;
      if (apiRef) apiRef.current = null;
      finger.userData.disposed = true; // por si el modelo termina de cargar después de salir
      aura.geometry = new THREE.BufferGeometry(); // la geometría del dedo se libera una sola vez
      particles.dispose();
      disposeObject(scene);
      renderer.dispose();
      renderer.forceContextLoss();
      mount.removeChild(canvas);
    };
  }, [caseData, apiRef]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={mountRef} className="reliquary-canvas" />;
}
