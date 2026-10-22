'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { CASES, HIDDEN_BOX, VAULT_BOXES, getCaseByBox } from '@/data/cases';
import { CursedParticles } from '@/three/particles';
import { glowTexture } from '@/three/proctex';
import { SCREEN, createRoom, createShelf, createTable, createTableRelic, createTerminal, drawTerminalScreen } from '@/three/vault';

const MAX_PIXEL_RATIO = 2;

// Puntos de vista de la sala: posición de la cámara, punto al que mira y cuánto se puede girar.
export const VIEWS = {
  overview: { position: [0, 1.62, 3.6], target: [0, 1.2, -1.2], yaw: 0.75, pitch: 0.3 },
  left: { position: [-3.1, 1.72, -1.15], target: [-3.1, 1.42, -3.55], yaw: 0.4, pitch: 0.35 },
  right: { position: [3.1, 1.72, -1.15], target: [3.1, 1.42, -3.55], yaw: 0.4, pitch: 0.35 },
  table: { position: [0, 1.55, 0.75], target: [0, 0.9, -0.02], yaw: 0.6, pitch: 0.2 },
  terminal: { position: [1.86, 1.12, 0.5], target: [2.46, 1.05, 0.3], yaw: 0.35, pitch: 0.2 },
};

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
 * Bóveda del Depósito B3: escena Three.js de la sala.
 * Representa estanterías, cajas, mesa y terminal. Lo que significa cada acción
 * (qué dedo se puede llevar, a dónde se navega) lo decide el componente Vault.
 */
export default function VaultRoom3D({
  view,
  boxStatus,
  openBox,
  tableCaseId,
  sealStates,
  influence,
  signedIn,
  operator,
  reduceEffects,
  screenData,
  onNavigate,
  onBoxClick,
  onActivate,
  onHover,
}) {
  const mountRef = useRef(null);
  const live = useRef({});

  useEffect(() => {
    Object.assign(live.current, { view, boxStatus, openBox, influence, signedIn, operator, reduceEffects, screenData, onNavigate, onBoxClick, onActivate, onHover });
    live.current.sync?.();
  });

  useEffect(() => {
    live.current.setTable?.(tableCaseId, sealStates);
  }, [tableCaseId, sealStates]);

  useEffect(() => {
    const mount = mountRef.current;
    const liveState = live.current;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.domElement.style.touchAction = 'none';
    renderer.domElement.setAttribute('aria-hidden', 'true');
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d0b09);
    scene.fog = new THREE.Fog(0x0d0b09, 6, 14);

    const camera = new THREE.PerspectiveCamera(55, 1, 0.05, 40);

    // Luces: relleno muy bajo, fluorescente frío, lámpara de la mesa y la luz roja de los dedos.
    scene.add(new THREE.HemisphereLight(0x8d8270, 0x1a1612, 1.1));
    const fluorescent = new THREE.PointLight(0xe8ecdd, 16, 11, 1.4);
    fluorescent.position.set(0, 2.95, -1.6);
    fluorescent.castShadow = true;
    fluorescent.shadow.mapSize.set(512, 512);
    scene.add(fluorescent);
    // Luces bajas sobre cada estantería para leer las etiquetas.
    [-3.1, 3.1].forEach((x) => {
      const shelfLight = new THREE.SpotLight(0xf2e6cc, 9, 5, 0.6, 0.6, 1.5);
      shelfLight.position.set(x, 3.0, -2.2);
      shelfLight.target.position.set(x, 1.1, -3.6);
      scene.add(shelfLight, shelfLight.target);
    });
    const curseLight = new THREE.PointLight(0xc7352a, 0, 6, 2);
    curseLight.position.set(0, 1.6, -3);
    scene.add(curseLight);

    const { group: roomGroup, tubes, flickerTubes } = createRoom();
    scene.add(roomGroup);

    const shelves = {
      left: createShelf('left', VAULT_BOXES.left, getCaseByBox, HIDDEN_BOX),
      right: createShelf('right', VAULT_BOXES.right, getCaseByBox, HIDDEN_BOX),
    };
    scene.add(shelves.left.group, shelves.right.group);
    const boxes = [...shelves.left.boxes, ...shelves.right.boxes];
    const boxByCode = new Map(boxes.map((b) => [b.userData.code, b]));

    const table = createTable();
    scene.add(table.group);
    const terminal = createTerminal();
    scene.add(terminal.group);

    // Polvo suspendido que se ve en el cono de la lámpara.
    const dustCount = reduceEffects ? 120 : 420;
    const dustPositions = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i += 1) {
      dustPositions[i * 3] = (Math.random() - 0.5) * 3.2;
      dustPositions[i * 3 + 1] = 0.9 + Math.random() * 1.6;
      dustPositions[i * 3 + 2] = (Math.random() - 0.5) * 3.2 - 0.6;
    }
    const dustGeometry = new THREE.BufferGeometry();
    dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
    const dust = new THREE.Points(
      dustGeometry,
      new THREE.PointsMaterial({ map: glowTexture('255,240,210'), size: 0.014, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    scene.add(dust);

    const particles = new CursedParticles(reduceEffects ? 150 : 500);
    particles.material.uniforms.uPixelRatio.value = renderer.getPixelRatio();
    particles.material.uniforms.uSize.value = 7;
    scene.add(particles.points);

    // Relicario sobre la mesa (el dedo elegido).
    let tableRelic = null;
    liveState.setTable = (caseId, states) => {
      if (tableRelic) {
        table.slot.remove(tableRelic);
        disposeObject(tableRelic);
        tableRelic = null;
      }
      const data = CASES.find((c) => c.id === caseId);
      if (!data) return;
      tableRelic = createTableRelic(data, states?.[caseId]?.seals);
      table.slot.add(tableRelic);
    };
    liveState.setTable(tableCaseId, sealStates);

    // Cámara con transiciones suaves entre vistas y giro limitado con el puntero.
    const camPos = new THREE.Vector3(...VIEWS.overview.position);
    const camTarget = new THREE.Vector3(...VIEWS.overview.target);
    const goalPos = camPos.clone();
    const goalTarget = camTarget.clone();
    const look = { yaw: 0, pitch: 0, goalYaw: 0, goalPitch: 0 };
    let currentView = 'overview';
    const lookDir = new THREE.Vector3();
    const tmp = new THREE.Vector3();

    const applyView = (name) => {
      const v = VIEWS[name] ?? VIEWS.overview;
      goalPos.set(...v.position);
      goalTarget.set(...v.target);
      if (name !== currentView) {
        look.goalYaw = 0;
        look.goalPitch = 0;
      }
      currentView = name;
    };

    // Estado de las cajas: visibilidad de la B3-11, apertura, brillo de los dedos.
    const sync = () => {
      const status = liveState.boxStatus ?? {};
      boxes.forEach((box) => {
        const code = box.userData.code;
        const s = status[code];
        if (box.userData.hidden) {
          const revealed = s === 'revealed';
          box.visible = revealed;
          if (shelves.left.outline) shelves.left.outline.visible = !revealed;
        }
        box.userData.target = liveState.openBox === code ? 1 : 0;
        box.userData.status = s;
      });
      applyView(liveState.view);
    };
    liveState.sync = sync;
    sync();

    // Raycasting.
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const targets = [];
    boxes.forEach((box) => targets.push(box.userData.hit));
    targets.push(...shelves.left.group.children.filter((c) => c.userData.type === 'shelf'));
    targets.push(...shelves.right.group.children.filter((c) => c.userData.type === 'shelf'));
    table.group.traverse((c) => c.userData.type === 'table' && targets.push(c));
    terminal.group.traverse((c) => c.userData.type === 'terminal' && targets.push(c));

    const pick = (event) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(targets, false).filter((h) => {
        let o = h.object;
        while (o) {
          if (!o.visible) return false;
          o = o.parent;
        }
        return true;
      });
      // Las cajas tienen prioridad sobre la estantería que las contiene.
      return hits.find((h) => h.object.userData.type === 'box')?.object.userData ?? hits[0]?.object.userData ?? null;
    };

    // Pantalla de la terminal: menú propio, con zonas clickeables.
    const screenState = { tab: liveState.signedIn ? 'lot' : 'session', hover: null, hotspots: [] };
    const screenRay = new THREE.Raycaster();
    const screenPick = (event) => {
      if (currentView !== 'terminal') return null;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      screenRay.setFromCamera(pointer, camera);
      const hit = screenRay.intersectObject(terminal.screen, false)[0];
      if (!hit?.uv) return null;
      const x = hit.uv.x * SCREEN.width;
      const y = (1 - hit.uv.y) * SCREEN.height;
      return screenState.hotspots.find((h) => x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h)?.action ?? 'screen';
    };

    let hovered = null;
    let drag = null;
    const hoverKey = (h) => (h ? `${h.type}:${h.code ?? h.side ?? ''}` : null);

    const onPointerMove = (event) => {
      if (drag) {
        const dx = event.clientX - drag.x;
        const dy = event.clientY - drag.y;
        if (Math.hypot(dx, dy) > 4) drag.moved = true;
        const v = VIEWS[currentView];
        look.goalYaw = THREE.MathUtils.clamp(drag.yaw - dx * 0.004, -v.yaw, v.yaw);
        look.goalPitch = THREE.MathUtils.clamp(drag.pitch + dy * 0.003, -v.pitch, v.pitch);
        return;
      }
      const screenAction = screenPick(event);
      const screenHover = screenAction && screenAction !== 'screen' ? screenAction : null;
      if (screenHover !== screenState.hover) {
        screenState.hover = screenHover;
        redrawScreen();
      }
      const hit = pick(event);
      if (hoverKey(hit) !== hoverKey(hovered)) {
        hovered = hit;
        liveState.onHover?.(hit);
      }
      renderer.domElement.style.cursor = screenHover ? 'pointer' : screenAction ? 'default' : hit ? 'pointer' : 'grab';
    };

    const onPointerDown = (event) => {
      renderer.domElement.setPointerCapture(event.pointerId);
      drag = { x: event.clientX, y: event.clientY, yaw: look.goalYaw, pitch: look.goalPitch, moved: false };
    };

    const onPointerUp = (event) => {
      if (renderer.domElement.hasPointerCapture(event.pointerId)) renderer.domElement.releasePointerCapture(event.pointerId);
      const wasDrag = drag?.moved;
      drag = null;
      if (wasDrag) return;
      const screenAction = screenPick(event);
      if (screenAction) {
        if (screenAction.startsWith('tab:')) {
          screenState.tab = screenAction.slice(4);
          redrawScreen();
        } else if (screenAction !== 'screen') liveState.onActivate?.(screenAction);
        return;
      }
      const hit = pick(event);
      if (!hit) return;
      // Desde lejos, un click acerca la cámara; de cerca, interactúa.
      if (hit.type === 'shelf' || (hit.type === 'box' && currentView !== 'left' && currentView !== 'right')) {
        const side = hit.side ?? boxByCode.get(hit.code)?.userData.side;
        liveState.onNavigate?.(side);
      } else if (hit.type === 'box') {
        const box = boxByCode.get(hit.code);
        if (box.userData.side !== currentView) liveState.onNavigate?.(box.userData.side);
        else liveState.onBoxClick?.(hit.code);
      } else if (hit.type === 'table') {
        if (currentView === 'table') liveState.onActivate?.('table');
        else liveState.onNavigate?.('table');
      } else if (hit.type === 'terminal' && currentView !== 'terminal') {
        // De cerca se usa el menú de la pantalla.
        liveState.onNavigate?.('terminal');
      }
    };

    const canvas = renderer.domElement;
    canvas.style.cursor = 'grab';
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);

    const resize = () => {
      const { clientWidth, clientHeight } = mount;
      if (!clientWidth || !clientHeight) return;
      renderer.setSize(clientWidth, clientHeight, false);
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      camera.aspect = clientWidth / clientHeight;
      // En vertical se abre el campo visual para que entren las estanterías.
      camera.fov = camera.aspect < 1 ? 72 : 55;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();

    // Pantalla de la terminal.
    const screenCtx = terminal.canvas.getContext('2d');
    let screenTimer = 0;
    let cursorOn = true;
    let screenTime = 0;
    let lastSignedIn = liveState.signedIn;
    function redrawScreen() {
      if (liveState.signedIn !== lastSignedIn) {
        // Al identificarse, la terminal pasa sola al listado del lote.
        lastSignedIn = liveState.signedIn;
        screenState.tab = lastSignedIn ? 'lot' : 'session';
      }
      const data = liveState.screenData ?? {};
      screenState.hotspots = drawTerminalScreen(screenCtx, terminal.canvas.width, terminal.canvas.height, {
        signedIn: liveState.signedIn,
        operator: liveState.operator,
        cursor: cursorOn,
        influence: liveState.influence ?? 0,
        tab: screenState.tab,
        hover: screenState.hover,
        time: screenTime,
        cases: data.cases ?? [],
        hiddenStatus: data.hiddenStatus ?? null,
        log: data.log ?? [],
        leak: data.leak ?? 0,
        memory: data.memory ?? 0,
        memoryTotal: data.memoryTotal ?? 9,
        persistence: data.persistence ?? 'local',
      });
      terminal.screenTexture.needsUpdate = true;
    }
    redrawScreen();

    const timer = new THREE.Timer();
    let frame = 0;
    let emit = 0;

    const tick = () => {
      frame = requestAnimationFrame(tick);
      timer.update();
      const rawDt = Math.min(timer.getDelta(), 0.25);
      const dt = Math.min(rawDt, 0.05);
      const elapsed = timer.getElapsed();
      const reduce = liveState.reduceEffects;
      const influenceLevel = liveState.influence ?? 0;

      // Cámara.
      const k = 1 - Math.exp(-rawDt * (reduce ? 12 : 3.2));
      camPos.lerp(goalPos, k);
      camTarget.lerp(goalTarget, k);
      look.yaw += (look.goalYaw - look.yaw) * Math.min(1, rawDt * 8);
      look.pitch += (look.goalPitch - look.pitch) * Math.min(1, rawDt * 8);
      camera.position.copy(camPos);
      lookDir.subVectors(camTarget, camPos);
      lookDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), look.yaw);
      tmp.copy(camPos).add(lookDir);
      tmp.y += look.pitch * lookDir.length() * -1;
      if (!reduce) tmp.y += Math.sin(elapsed * 0.9) * 0.004;
      camera.lookAt(tmp);

      // Fluorescente que parpadea más con la influencia.
      if (!reduce && Math.random() < 0.003 + influenceLevel * 0.008) {
        fluorescent.intensity = 0.8;
        tubes.forEach((t) => (t.material.emissiveIntensity = 0.2));
      } else {
        fluorescent.intensity += (16 - fluorescent.intensity) * Math.min(1, dt * 10);
        tubes.forEach((t) => (t.material.emissiveIntensity += (2.2 - t.material.emissiveIntensity) * Math.min(1, dt * 10)));
      }
      // El tubo del frente está por quemarse: zumba y titila.
      flickerTubes.forEach((t) => {
        t.material.emissiveIntensity = reduce ? 0.8 : Math.random() < 0.08 ? 0.05 : 0.6 + Math.sin(elapsed * 40) * 0.25;
      });
      if (!reduce) {
        table.beam.material.opacity = 0.085 + Math.sin(elapsed * 1.3) * 0.01;
        terminal.towerLed.material.emissiveIntensity = Math.random() < 0.15 ? 3 : 0.4;
        const dp = dust.geometry.attributes.position;
        for (let i = 0; i < dustCount; i += 1) {
          let y = dp.getY(i) + dt * 0.02 * (0.5 + ((i * 7) % 5) / 5);
          if (y > 2.6) y = 0.9;
          dp.setY(i, y);
          dp.setX(i, dp.getX(i) + Math.sin(elapsed * 0.3 + i) * dt * 0.01);
        }
        dp.needsUpdate = true;
      }
      curseLight.intensity = influenceLevel * 0.9 * (reduce ? 1 : 0.85 + Math.random() * 0.15);

      // Cajas: se deslizan hacia afuera y se abre la tapa.
      boxes.forEach((box) => {
        const u = box.userData;
        u.open += (u.target - u.open) * Math.min(1, rawDt * (reduce ? 20 : 5));
        u.body.position.z = u.open * 0.34;
        u.lid.rotation.x = -u.open * 1.95;
        const hoveredBox = hovered?.type === 'box' && hovered.code === u.code;
        u.body.position.y = hoveredBox && u.open < 0.05 ? 0.012 : 0;
        // Brillo de la caja: luz que se filtra por la rendija, grietas encendidas y halo.
        if (u.glow) {
          const base = { pending: 1.1, revealed: 1.6, locked: 0.75, archived: 0.3 }[u.status] ?? 0.5;
          const pulse = reduce ? 1 : 0.75 + Math.sin(elapsed * 2.2 + u.code.length) * 0.18 + Math.sin(elapsed * 7.3) * 0.07;
          const hoverBoost = hovered?.type === 'box' && hovered.code === u.code ? 1.35 : 1;
          const g = base * pulse * hoverBoost;
          u.glow.light.intensity = g * (1.4 + u.open * 2.6) * (1 + influenceLevel * 0.25);
          u.glow.seamMat.opacity = Math.min(1, g * 0.85 * (1 - u.open * 0.6));
          u.glow.halo.material.opacity = Math.min(0.9, g * 0.38);
          u.glow.wood.emissiveIntensity = g * 0.9;
          if (u.glow.ofuda) u.glow.ofuda.emissiveIntensity = g * 0.25;
        }
        // Brillo del dedo según el estado del expediente.
        const content = u.body.children.find((c) => c.userData?.aura);
        if (content) {
          const glow = { pending: 0.8, locked: 0.25, archived: 0.08, revealed: 1.3 }[u.status] ?? 0.2;
          const uniforms = content.userData.aura.material.uniforms;
          uniforms.uIntensity.value = glow * (0.4 + u.open);
          if (!reduce) uniforms.uTime.value = elapsed;
          // Al abrir, el dedo se eleva sobre el borde para que se vea desde el pasillo.
          if (content.userData.restY === undefined) content.userData.restY = content.position.y;
          content.position.y = content.userData.restY + u.open * 0.3;
          content.rotation.x = u.open * 0.5;
          content.rotation.y = 0.25 + (reduce ? 0 : u.open * elapsed * 0.6);
        }
      });

      if (tableRelic) {
        const uniforms = tableRelic.userData.aura.material.uniforms;
        uniforms.uIntensity.value = 0.3 + influenceLevel * 0.15;
        if (!reduce) uniforms.uTime.value = elapsed;
        if (!reduce) tableRelic.rotation.y = Math.sin(elapsed * 0.3) * 0.08;
      }

      // Energía que se escapa de las cajas con dedos.
      emit += dt * (reduce ? 1.5 : 6) * (1 + influenceLevel);
      while (emit > 1) {
        emit -= 1;
        const candidates = boxes.filter((b) => b.visible && (b.userData.status === 'pending' || b.userData.status === 'revealed'));
        const source = candidates[Math.floor(Math.random() * candidates.length)];
        if (!source) break;
        source.userData.body.getWorldPosition(tmp);
        tmp.y += 0.12;
        particles.emit(tmp, 1, 0.12);
      }
      particles.update(dt);

      screenTime += rawDt;
      screenTimer += rawDt;
      if (screenTimer > 0.25) {
        screenTimer = 0;
        cursorOn = Math.floor(screenTime / 0.5) % 2 === 0;
        redrawScreen();
      }

      renderer.render(scene, camera);
    };
    tick();

    return () => {
      cancelAnimationFrame(frame);
      timer.dispose();
      observer.disconnect();
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      liveState.sync = null;
      liveState.setTable = null;
      particles.dispose();
      disposeObject(scene);
      renderer.dispose();
      renderer.forceContextLoss();
      mount.removeChild(canvas);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={mountRef} className="vault-canvas" />;
}
