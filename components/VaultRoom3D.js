'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { CASES, HIDDEN_BOX, VAULT_BOXES, getCaseByBox } from '@/data/cases';
import { CursedParticles } from '@/three/particles';
import { loadFingerModel } from '@/three/fingerModel';
import { createMiasma } from '@/three/miasma';
import { createLooseOfuda } from '@/three/ofuda';
import { bakeStatic, pruneSmallCasters } from '@/three/optimize';
import { glowTexture } from '@/three/proctex';
import { QUALITY_PRESETS, createFrameMonitor, isSoftwareRenderer } from '@/three/quality';
import { createRenderer } from '@/three/renderer';
import {
  RELIC_SCALE,
  SCREEN,
  TRAY_FLOOR,
  createRoom,
  createShelf,
  createTable,
  createTableRelic,
  createTerminal,
  drawTerminalScreen,
  placeLooseOfuda,
} from '@/three/vault';
import { fingerShapeKey, lowestPoint, sampleFingerPoints } from '@/three/finger';

// Puntos de vista de la sala: posición de la cámara, punto al que mira y cuánto se puede girar.
// En "inspect" la cámara queda sobre la bandeja y arrastrar gira el dedo, no la mirada.
export const VIEWS = {
  overview: { position: [0, 1.62, 3.6], target: [0, 1.2, -1.2], yaw: 0.75, pitch: 0.3 },
  left: { position: [-3.1, 1.72, -1.15], target: [-3.1, 1.42, -3.55], yaw: 0.4, pitch: 0.35 },
  right: { position: [3.1, 1.72, -1.15], target: [3.1, 1.42, -3.55], yaw: 0.4, pitch: 0.35 },
  table: { position: [0, 1.55, 0.75], target: [0, 0.9, -0.02], yaw: 0.6, pitch: 0.2 },
  inspect: { position: [0, 1.17, 0.27], target: [0, 0.93, -0.01], yaw: 0, pitch: 0 },
  // De frente a la pantalla del CRT y a unos 42 cm: el texto del menú se lee bien. Corrida
  // un poco a la derecha para que la tarjeta de la esquina no tape la pantalla.
  terminal: { position: [2.061, 1.065, 0.48], target: [2.468, 1.05, 0.377], yaw: 0.22, pitch: 0.14 },
};

const HOLD_MS = 900; // mantener presionado para despegar un sello con cuidado
const RIP_MIN_MS = 160; // soltar después de esto y antes de HOLD_MS lo arranca
const ZOOM = { min: 0.5, max: 1.7, step: 0.18 };

// Atmósfera de la sala sin corrupción y con la energía de Sukuna despierta del todo.
const CLEAN = { fog: new THREE.Color(0x0d0b09), sky: new THREE.Color(0x8d8270), ground: new THREE.Color(0x1a1612), tube: new THREE.Color(0xe8ecdd) };
const CURSED = { fog: new THREE.Color(0x1c0605), sky: new THREE.Color(0x6a3a30), ground: new THREE.Color(0x3a0806), tube: new THREE.Color(0xffb49c) };

// Última corrupción dibujada. Sobrevive a un remontaje de la escena (cambio de calidad)
// para que la transición no vuelva a empezar.
let lastDread = null;

// Latido: dos golpes cortos y una pausa, unas 68 veces por minuto. Devuelve de 0 a 1.
function heartbeat(t) {
  const p = (t * 1.13) % 1;
  return Math.min(1, Math.exp(-((p - 0.08) ** 2) / 0.0012) + 0.6 * Math.exp(-((p - 0.27) ** 2) / 0.0016));
}

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
  lamp = false,
  apiRef,
  onPeel,
  onHint,
  influence,
  corruption = null,
  corruptionFrom = null,
  signedIn,
  operator,
  reduceEffects,
  quality = 'alta',
  onSlow,
  screenData,
  onNavigate,
  onBoxClick,
  onActivate,
  onHover,
  onUnavailable,
}) {
  const mountRef = useRef(null);
  const veilRef = useRef(null);
  const live = useRef({});

  useEffect(() => {
    Object.assign(live.current, { view, boxStatus, openBox, sealStates, lamp, influence, corruption, corruptionFrom, signedIn, operator, reduceEffects, screenData, onNavigate, onBoxClick, onActivate, onHover, onSlow, onPeel, onHint, onUnavailable });
    live.current.sync?.();
  });

  // El dedo de la mesa se arma de nuevo solo al cambiar de dedo; los sellos que se retiran
  // después se animan en sync().
  useEffect(() => {
    live.current.setTable?.(tableCaseId);
  }, [tableCaseId]);

  useEffect(() => {
    const mount = mountRef.current;
    const veil = veilRef.current;
    const liveState = live.current;

    // La calidad se elige al montar; si cambia, Vault vuelve a montar la escena.
    const preset = QUALITY_PRESETS[quality] ?? QUALITY_PRESETS.alta;
    // Si la GPU pierde el contexto, en "auto" la próxima escena arranca en calidad baja.
    const renderer = createRenderer({ antialias: preset.antialias, onLost: () => liveState.onSlow?.() });
    if (!renderer) {
      liveState.onUnavailable?.();
      return undefined;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, preset.pixelRatio));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = preset.shadows;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.domElement.style.touchAction = 'none';
    renderer.domElement.setAttribute('aria-hidden', 'true');
    // Antes del velo, para que el velo quede por encima del canvas.
    mount.prepend(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = CLEAN.fog.clone();
    scene.fog = new THREE.Fog(CLEAN.fog.clone(), 6, 14);

    const camera = new THREE.PerspectiveCamera(55, 1, 0.05, 40);

    // Luces: relleno muy bajo, fluorescente frío, lámpara de la mesa y la luz roja de los dedos.
    const ambient = new THREE.HemisphereLight(CLEAN.sky, CLEAN.ground, 1.1);
    scene.add(ambient);
    const fluorescent = new THREE.PointLight(0xe8ecdd, 16, 11, 1.4);
    fluorescent.position.set(0, 2.95, -1.6);
    fluorescent.castShadow = true;
    fluorescent.shadow.mapSize.set(512, 512);
    // La sala no se mueve: la sombra del tubo (6 pasadas, una por cara del cubo) se calcula
    // solo cuando algo cambia, no en cada cuadro.
    fluorescent.shadow.autoUpdate = false;
    scene.add(fluorescent);
    // Luces bajas sobre cada estantería para leer las etiquetas.
    const shelfLights = [-3.1, 3.1].map((x) => {
      const shelfLight = new THREE.SpotLight(0xf2e6cc, 9, 5, 0.6, 0.6, 1.5);
      shelfLight.position.set(x, 3.0, -2.2);
      shelfLight.target.position.set(x, 1.1, -3.6);
      scene.add(shelfLight, shelfLight.target);
      return shelfLight;
    });
    const curseLight = new THREE.PointLight(0xc7352a, 0, 6, 2);
    curseLight.position.set(0, 1.6, -3);
    scene.add(curseLight);
    // Una sola luz roja para las cajas con dedos: se ubica en la que está abierta o señalada.
    // (Antes había una por caja: cada luz suma costo en todos los píxeles de la escena.)
    const boxLight = new THREE.PointLight(0xff3a22, 0, 1.8, 2);
    scene.add(boxLight);

    const { group: roomGroup, tubes, flickerTubes, exitDoor } = createRoom();
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
    table.lamp.shadow.autoUpdate = false;
    const terminal = createTerminal();
    scene.add(terminal.group);
    if (!preset.extraLights) terminal.glow.removeFromParent();

    // Menos llamadas de dibujo: se unen las piezas fijas que comparten material y se apagan
    // las sombras de las piezas chicas.
    pruneSmallCasters(scene);
    bakeStatic(roomGroup, [...tubes, ...flickerTubes, exitDoor]);
    bakeStatic(shelves.left.group, [...shelves.left.boxes, shelves.left.outline]);
    bakeStatic(shelves.right.group, [...shelves.right.boxes, shelves.right.outline]);
    // Las libretas y la planilla se vuelven a escribir: no se unen con el resto.
    bakeStatic(table.group, [table.slot, table.beam, table.lamp, table.lamp.target, table.notebook.group, table.clipboard.group, table.archive.group]);
    bakeStatic(terminal.group, [terminal.screen, terminal.towerLed]);

    // Sombras: se recalculan solo cuando algo se mueve.
    let shadowsDirty = true;
    const markShadows = () => {
      shadowsDirty = true;
    };
    loadFingerModel().then(markShadows);

    // Polvo suspendido que se ve en el cono de la lámpara.
    const dustCount = reduceEffects ? Math.min(120, preset.dust) : preset.dust;
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

    const particles = new CursedParticles(reduceEffects ? Math.min(150, preset.particles) : preset.particles);
    particles.material.uniforms.uPixelRatio.value = renderer.getPixelRatio();
    particles.material.uniforms.uSize.value = 7;
    scene.add(particles.points);

    // Niebla roja a ras del piso: aparece y se espesa a medida que avanza la inspección.
    const miasma = createMiasma({ layers: preset.miasma ?? 1 });
    scene.add(miasma.group);
    // Corrupción que se ve ahora: sigue al valor real despacio, así al volver de un
    // expediente la sala se enturbia delante del usuario.
    let dread = null;
    let veilShown = -1;
    const doorSeam = new THREE.Vector3();

    // Relicario sobre la mesa: el dedo elegido, sus sellos y, detrás de la bandeja, los
    // ofudas que ya se retiraron.
    let tableRelic = null;
    let tableCase = null;
    let tableBands = new Map();
    const peeling = new Map();
    const loose = new THREE.Group();
    loose.scale.setScalar(RELIC_SCALE);
    table.slot.add(loose);
    const spin = { x: 0, y: 0, goalX: 0, goalY: 0 };
    // Puntos del dedo para apoyarlo sobre la bandeja; se vuelven a tomar si cambia su forma.
    let relicPoints = new Float32Array(0);
    let relicKey = '';
    let hold = null;
    const sealPos = new THREE.Vector3();
    const addLoose = (seal) => loose.add(placeLooseOfuda(createLooseOfuda(seal, 0), loose.children.length));

    liveState.setTable = (caseId) => {
      if (tableRelic) {
        table.slot.remove(tableRelic);
        disposeObject(tableRelic);
        tableRelic = null;
      }
      [...loose.children].forEach((ofuda) => {
        loose.remove(ofuda);
        disposeObject(ofuda);
      });
      tableBands = new Map();
      peeling.clear();
      hold = null;
      Object.assign(spin, { x: 0, y: 0, goalX: 0, goalY: 0 });
      relicPoints = new Float32Array(0);
      relicKey = '';
      tableCase = CASES.find((c) => c.id === caseId) ?? null;
      table.notebook.redraw(tableCase);
      if (!tableCase) return;
      tableRelic = createTableRelic(tableCase);
      tableBands = tableRelic.userData.bands;
      const states = liveState.sealStates?.[tableCase.id]?.seals ?? {};
      tableCase.seals.forEach((seal) => {
        if (!states[seal.id]?.peeled) return;
        tableBands.get(seal.id).visible = false;
        addLoose(seal);
      });
      table.slot.add(tableRelic);
      markShadows();
      loadFingerModel().then(() => setTimeout(markShadows, 0));
    };
    liveState.setTable(tableCaseId);

    // Sellos retirados después de armar la mesa: se despegan con una animación.
    // También se actualizan la planilla y las carpetas archivadas.
    const syncTable = () => {
      const all = liveState.sealStates ?? {};
      const states = all[tableCase?.id]?.seals ?? {};
      table.clipboard.redraw(tableCase, states, liveState.operator);
      table.archive.redraw(CASES.filter((c) => all[c.id]?.archived).map((c) => c.code));
      if (!tableCase) return;
      let rebuild = false;
      tableCase.seals.forEach((seal) => {
        const band = tableBands.get(seal.id);
        const s = states[seal.id];
        if (s?.peeled && band.visible && !peeling.has(seal.id)) {
          peeling.set(seal.id, { start: performance.now(), ripped: s.ripped, duration: s.ripped ? 450 : 1300 });
          band.getWorldPosition(sealPos);
          particles.emit(sealPos, s.ripped ? 40 : 14, s.ripped ? 0.45 : 0.2);
        }
        // Se reinició el recorrido: el dedo vuelve con todos sus sellos.
        if (!s?.peeled && !band.visible) rebuild = true;
      });
      if (rebuild) liveState.setTable(tableCase.id);
    };

    // Cámara con transiciones suaves entre vistas y giro limitado con el puntero.
    const camPos = new THREE.Vector3(...VIEWS.overview.position);
    const camTarget = new THREE.Vector3(...VIEWS.overview.target);
    const goalPos = camPos.clone();
    const goalTarget = camTarget.clone();
    const look = { yaw: 0, pitch: 0, goalYaw: 0, goalPitch: 0 };
    let currentView = 'overview';
    const lookDir = new THREE.Vector3();
    const tmp = new THREE.Vector3();

    let zoom = 1;
    // Corrimiento lateral para mirar un sello de cerca (lupa).
    let focusX = 0;

    const applyView = (name) => {
      const v = VIEWS[name] ?? VIEWS.overview;
      if (name !== currentView) {
        look.goalYaw = 0;
        look.goalPitch = 0;
        zoom = 1;
        focusX = 0;
      }
      goalPos.set(...v.position);
      goalTarget.set(...v.target);
      if (name === 'inspect') {
        // En pantallas verticales la cámara se aleja para que entre el dedo entero; en
        // horizontales se corre a la derecha para dejar el dedo libre del panel lateral.
        const portrait = camera.aspect < 1;
        const reach = zoom * (portrait ? 1.9 : 1.2);
        goalPos.sub(goalTarget).multiplyScalar(reach).add(goalTarget);
        const shift = focusX + (portrait ? 0 : 0.11 * zoom);
        goalPos.x += shift;
        goalTarget.x += shift;
        // En vertical el panel ocupa la parte de abajo: la cámara mira más abajo y el dedo sube.
        if (portrait) goalTarget.y -= 0.14 * zoom;
      }
      // En vertical la pantalla de la terminal no entraría de ancho: la cámara se aleja, y mira
      // un poco más arriba para que la pantalla quede por debajo del panel de arriba.
      if (name === 'terminal' && camera.aspect < 1) {
        goalPos.sub(goalTarget).multiplyScalar(1.75).add(goalTarget);
        goalTarget.y += 0.06;
      }
      currentView = name;
    };

    const zoomBy = (delta) => {
      zoom = THREE.MathUtils.clamp(zoom + delta, ZOOM.min, ZOOM.max);
      if (zoom >= 1) focusX = 0;
      applyView(currentView);
    };
    const focusSeal = (sealId) => {
      const band = tableBands.get(sealId);
      if (!band?.visible) return;
      band.getWorldPosition(sealPos);
      focusX = sealPos.x - VIEWS.inspect.target[0];
    };
    if (apiRef) {
      apiRef.current = {
        zoomIn: () => zoomBy(-ZOOM.step),
        zoomOut: () => zoomBy(ZOOM.step),
        reset: () => {
          zoom = 1;
          focusX = 0;
          spin.goalX = 0;
          spin.goalY = 0;
          applyView(currentView);
        },
        // Lupa: centra la cámara en un sello y la acerca.
        focus: (sealId) => {
          focusSeal(sealId);
          zoom = Math.min(zoom, 0.55);
          applyView(currentView);
        },
      };
    }

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
        // El modelo detallado del dedo se carga al abrir la caja por primera vez.
        if (box.userData.target === 1) {
          const content = box.userData.body.children.find((c) => c.userData?.loadModel);
          content?.userData.loadModel()?.then(markShadows);
        }
      });
      markShadows();
      syncTable();
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
    table.group.traverse((c) => (c.userData.type === 'table' || c.userData.type === 'notebook') && targets.push(c));
    terminal.group.traverse((c) => c.userData.type === 'terminal' && targets.push(c));
    targets.push(exitDoor);

    const pick = (event) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      // De cerca, los sellos que siguen en el dedo se pueden tocar.
      if (currentView === 'inspect' && tableRelic) {
        const bands = [...tableBands.values()].filter((b) => b.visible && !peeling.has(b.userData.sealId));
        const band = raycaster.intersectObjects(bands, false)[0];
        if (band) return { type: 'seal', sealId: band.object.userData.sealId };
      }
      const hits = raycaster.intersectObjects(targets, false).filter((h) => {
        let o = h.object;
        while (o) {
          if (!o.visible) return false;
          o = o.parent;
        }
        return true;
      });
      // Las cajas tienen prioridad sobre la estantería que las contiene, y las libretas sobre la mesa.
      const first = (type) => hits.find((h) => h.object.userData.type === type)?.object.userData;
      return first('box') ?? first('notebook') ?? hits[0]?.object.userData ?? null;
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
    const hoverKey = (h) => (h ? `${h.type}:${h.code ?? h.side ?? h.sealId ?? ''}` : null);

    const onPointerMove = (event) => {
      if (drag) {
        const dx = event.clientX - drag.x;
        const dy = event.clientY - drag.y;
        if (Math.hypot(dx, dy) > 4) drag.moved = true;
        // En la mesa de inspección se gira el dedo para ver el otro lado de los sellos.
        if (currentView === 'inspect') {
          spin.goalX = THREE.MathUtils.clamp(drag.spinX + dy * 0.01, -Math.PI, Math.PI);
          // De costado gira poco: más, y las puntas chocarían con el borde de la bandeja.
          spin.goalY = THREE.MathUtils.clamp(drag.spinY + dx * 0.006, -0.45, 0.45);
          return;
        }
        const v = VIEWS[currentView];
        look.goalYaw = THREE.MathUtils.clamp(drag.yaw - dx * 0.004, -v.yaw, v.yaw);
        look.goalPitch = THREE.MathUtils.clamp(drag.pitch + dy * 0.003, -v.pitch, v.pitch);
        return;
      }
      if (hold) return;
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
      // Mantener presionado un sello empieza a despegarlo.
      const hit = currentView === 'inspect' ? pick(event) : null;
      if (hit?.type === 'seal') {
        hold = { id: hit.sealId, start: performance.now(), done: false };
        liveState.onHint?.('hold');
        return;
      }
      drag = { x: event.clientX, y: event.clientY, yaw: look.goalYaw, pitch: look.goalPitch, spinX: spin.goalX, spinY: spin.goalY, moved: false };
    };

    // Soltar antes de tiempo arranca el sello; si se cancela el gesto, no pasa nada.
    const releaseHold = (cancelled = false) => {
      const band = tableBands.get(hold.id);
      if (band) {
        band.material.emissiveIntensity = 0;
        band.position.y = band.userData.baseY;
      }
      if (!hold.done && !cancelled) {
        // Se mide el tiempo real: con pocos cuadros por segundo el bucle puede no haberlo marcado.
        const held = performance.now() - hold.start;
        if (held >= HOLD_MS) liveState.onPeel?.(hold.id, true);
        else if (held >= RIP_MIN_MS) liveState.onPeel?.(hold.id, false);
        else liveState.onHint?.('tap');
      }
      hold = null;
    };

    const onPointerCancel = (event) => {
      if (renderer.domElement.hasPointerCapture(event.pointerId)) renderer.domElement.releasePointerCapture(event.pointerId);
      if (hold) releaseHold(true);
      drag = null;
    };

    const onWheel = (event) => {
      if (currentView !== 'inspect') return;
      event.preventDefault();
      // Acercar con la rueda sobre un sello lo pone en el centro.
      if (event.deltaY < 0 && hovered?.type === 'seal') focusSeal(hovered.sealId);
      zoomBy(Math.sign(event.deltaY) * ZOOM.step);
    };

    const onPointerUp = (event) => {
      if (renderer.domElement.hasPointerCapture(event.pointerId)) renderer.domElement.releasePointerCapture(event.pointerId);
      if (hold) {
        releaseHold();
        return;
      }
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
      } else if (hit.type === 'notebook') {
        liveState.onActivate?.(`notebook:${hit.side}`);
      } else if (hit.type === 'table') {
        if (currentView === 'table') liveState.onActivate?.('table');
        else if (currentView !== 'inspect') liveState.onNavigate?.('table');
      } else if (hit.type === 'terminal' && currentView !== 'terminal') {
        // De cerca se usa el menú de la pantalla.
        liveState.onNavigate?.('terminal');
      } else if (hit.type === 'exit') {
        liveState.onActivate?.('exit');
      }
    };

    const canvas = renderer.domElement;
    canvas.style.cursor = 'grab';
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerCancel);
    canvas.addEventListener('wheel', onWheel, { passive: false });

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
      applyView(currentView);
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
    let doorEmit = 0;
    let lampShadowTimer = 0;
    // Modo automático: si la PC no llega a ~30 cuadros por segundo, Vault baja la calidad.
    const monitor =
      quality === 'alta' && liveState.onSlow ? createFrameMonitor(() => liveState.onSlow?.()) : () => {};
    if (quality === 'alta' && isSoftwareRenderer(renderer)) setTimeout(() => liveState.onSlow?.(), 0);


    const tick = () => {
      frame = requestAnimationFrame(tick);
      timer.update();
      const rawDt = Math.min(timer.getDelta(), 0.25);
      const dt = Math.min(rawDt, 0.05);
      const elapsed = timer.getElapsed();
      const reduce = liveState.reduceEffects;
      const goal = liveState.corruption;
      if (goal !== null && goal !== undefined) {
        if (dread === null) dread = lastDread ?? liveState.corruptionFrom ?? goal;
        dread += (goal - dread) * Math.min(1, rawDt * (reduce ? 3 : 0.4));
      }
      const c = dread ?? 0;
      const beat = reduce ? 0 : heartbeat(elapsed) * c;

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
      // Con la sala corrompida la mirada se vuelve pesada: un vaivén lento que crece.
      if (!reduce) {
        tmp.y += Math.sin(elapsed * 0.9) * (0.004 + c * 0.012);
        tmp.x += Math.sin(elapsed * 0.37) * c * 0.018;
      }
      camera.lookAt(tmp);

      // Atmósfera: la niebla se cierra y se tiñe de rojo, la luz baja y se ensucia.
      scene.fog.color.lerpColors(CLEAN.fog, CURSED.fog, c);
      scene.background.copy(scene.fog.color);
      scene.fog.near = 6 - c * 3;
      scene.fog.far = 14 - c * 4;
      ambient.color.lerpColors(CLEAN.sky, CURSED.sky, c);
      ambient.groundColor.lerpColors(CLEAN.ground, CURSED.ground, c);
      ambient.intensity = 1.1 - c * 0.45 + beat * 0.08;
      fluorescent.color.lerpColors(CLEAN.tube, CURSED.tube, c * 0.7);
      shelfLights.forEach((light) => (light.intensity = 9 - c * 4));
      renderer.toneMappingExposure = 1.15 - c * 0.2;

      // Fluorescente que parpadea más y alumbra menos a medida que despierta la energía.
      if (!reduce && Math.random() < 0.003 + c * 0.03) {
        fluorescent.intensity = 0.8;
        tubes.forEach((t) => (t.material.emissiveIntensity = 0.2));
      } else {
        const tubeLevel = 16 - c * 7;
        fluorescent.intensity += (tubeLevel - fluorescent.intensity) * Math.min(1, dt * 10);
        tubes.forEach((t) => (t.material.emissiveIntensity += (2.2 - c * 0.9 - t.material.emissiveIntensity) * Math.min(1, dt * 10)));
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
      // Luz roja que sale de la puerta sellada y late como un corazón.
      curseLight.intensity = c * 3 * (reduce ? 1 : 0.85 + Math.random() * 0.15) * (1 + beat * 0.9);
      curseLight.distance = 6 + c * 4;
      miasma.update(reduce ? 0 : elapsed, c, beat);
      const veilOpacity = c * (0.85 + beat * 0.15);
      if (veil && Math.abs(veilOpacity - veilShown) > 0.004) {
        veilShown = veilOpacity;
        veil.style.opacity = veilOpacity.toFixed(3);
      }
      // La salida se ilumina de verde al señalarla.
      const exitGlow = hovered?.type === 'exit' ? 0.35 : 0;
      exitDoor.material.emissiveIntensity += (exitGlow - exitDoor.material.emissiveIntensity) * Math.min(1, rawDt * 10);

      // Cajas: se deslizan hacia afuera y se abre la tapa.
      let glowBox = null;
      let glowLevel = 0;
      let boxesMoving = false;
      boxes.forEach((box) => {
        const u = box.userData;
        if (Math.abs(u.target - u.open) > 0.001) boxesMoving = true;
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
          const level = g * (1.4 + u.open * 2.6) * (1 + c * 0.5 + beat * 0.3);
          // La luz compartida va a la caja más abierta; si no hay, a la señalada y, si tampoco,
          // a la que espera inspección (así la sala sigue indicando por dónde seguir).
          const waiting = u.status === 'pending' || u.status === 'revealed' ? 0.5 : 0;
          const weight = u.open * 10 + (hoverBoost > 1 ? 1 : 0) + waiting;
          if (box.visible && weight > 0 && (!glowBox || weight > glowBox.weight)) {
            glowBox = { box, weight };
            glowLevel = level;
          }
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

      if (glowBox) {
        glowBox.box.userData.body.getWorldPosition(boxLight.position);
        boxLight.position.y += 0.02;
        boxLight.position.z += 0.05;
        boxLight.intensity = glowLevel;
      } else {
        boxLight.intensity = 0;
      }
      if (boxesMoving) markShadows();

      if (tableRelic) {
        const uniforms = tableRelic.userData.aura.material.uniforms;
        const peeledCount = tableCase.seals.filter((s) => !tableBands.get(s.id).visible || peeling.has(s.id)).length;
        uniforms.uIntensity.value = 0.3 + c * 0.45 + (peeledCount / tableCase.seals.length) * 0.5;
        if (!reduce) uniforms.uTime.value = elapsed;
        // Giro con el puntero en la vista de inspección, más un vaivén leve.
        spin.x += (spin.goalX - spin.x) * Math.min(1, rawDt * 10);
        spin.y += (spin.goalY - spin.y) * Math.min(1, rawDt * 10);
        tableRelic.rotation.x = spin.x;
        tableRelic.rotation.y = spin.y + (reduce ? 0 : Math.sin(elapsed * 0.3) * 0.08);
        // Apoyado sobre la bandeja: al girarlo rueda sobre el terciopelo y nunca lo atraviesa.
        // Se busca su punto más bajo con la rotación de este cuadro y se lo deja tocando el piso.
        const { finger } = tableRelic.userData;
        const shapeKey = fingerShapeKey(finger);
        if (shapeKey !== relicKey) {
          relicKey = shapeKey;
          relicPoints = sampleFingerPoints(finger, tableRelic);
        }
        tableRelic.position.y = 0;
        tableRelic.updateMatrix();
        const lowest = lowestPoint(relicPoints, tableRelic.matrix);
        if (lowest !== Infinity) tableRelic.position.y = TRAY_FLOOR - lowest;
        const spinning = Math.abs(spin.goalX - spin.x) + Math.abs(spin.goalY - spin.y) > 0.001;
        if (!reduce || spinning || hold || peeling.size) {
          // El movimiento es lento: la sombra de la lámpara se actualiza 8 veces por segundo.
          lampShadowTimer += rawDt;
          if (lampShadowTimer > 0.125) {
            lampShadowTimer = 0;
            table.lamp.shadow.needsUpdate = true;
          }
        }

        // Con la luz rasante, la tinta fresca brilla apenas (delata el último sello colocado).
        tableBands.forEach((band) => {
          if (hold?.id === band.userData.sealId) return;
          band.material.emissive.set(liveState.lamp ? 0x5b7bd6 : 0x9e1f17);
          band.material.emissiveIntensity = liveState.lamp && band.userData.ink === 'fresca' ? 0.35 : 0;
        });

        // Mantener presionado: el sello se tensa y se despega con cuidado al completar.
        if (hold && !hold.done) {
          const band = tableBands.get(hold.id);
          const p = Math.min(1, (performance.now() - hold.start) / HOLD_MS);
          band.material.emissive.set(0x9e1f17);
          band.material.emissiveIntensity = p * 0.6;
          band.position.y = band.userData.baseY + p * 0.25 + (reduce ? 0 : (Math.random() - 0.5) * 0.03 * p);
          if (p >= 1) {
            hold.done = true;
            liveState.onPeel?.(hold.id, true);
          }
        }

        // Sellos que se van: suben, giran, se desvanecen y quedan planos detrás de la bandeja.
        peeling.forEach((anim, id) => {
          const band = tableBands.get(id);
          if (!band.visible) return;
          const p = Math.min(1, (performance.now() - anim.start) / anim.duration);
          const ease = 1 - (1 - p) ** 3;
          band.position.y = band.userData.baseY + ease * (anim.ripped ? 2.2 : 3.4);
          band.rotation.x = ease * (anim.ripped ? 4 : 1.6);
          band.rotation.z = anim.ripped ? ease * 0.8 : 0;
          band.scale.set(1 + ease * 0.6, 1 + ease * 0.6, 0.86 * (1 + ease * 0.6));
          band.material.opacity = 1 - ease;
          if (p >= 1) {
            band.visible = false;
            addLoose(tableCase.seals.find((s) => s.id === id));
            markShadows();
          }
        });
      }
      if (shadowsDirty) {
        shadowsDirty = false;
        fluorescent.shadow.needsUpdate = true;
        table.lamp.shadow.needsUpdate = true;
      }

      // Energía que se escapa de las cajas con dedos.
      emit += dt * (reduce ? 1.5 : 6) * (1 + c * 2.5);
      // Pasada la mitad del recorrido, la energía se filtra también por el borde de la puerta sellada.
      if (c > 0.35) doorEmit += dt * (reduce ? 1 : 7) * ((c - 0.35) / 0.65);
      while (doorEmit > 1) {
        doorEmit -= 1;
        const angle = Math.random() * Math.PI * 2;
        doorSeam.set(Math.cos(angle) * 1.05, 1.22 + Math.sin(angle) * 1.05, -3.8);
        particles.emit(doorSeam, 1, 0.1);
      }
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

      // La pantalla (1024x768) se vuelve a subir a la GPU solo cuando parpadea el cursor,
      // y de lejos con menos frecuencia.
      screenTime += rawDt;
      screenTimer += rawDt;
      const screenPeriod = currentView === 'terminal' ? 0.5 : 1;
      if (screenTimer > screenPeriod) {
        screenTimer = 0;
        cursorOn = Math.floor(screenTime / screenPeriod) % 2 === 0;
        redrawScreen();
      }

      renderer.render(scene, camera);
      monitor(rawDt);
    };
    tick();

    return () => {
      if (dread !== null) lastDread = dread;
      cancelAnimationFrame(frame);
      timer.dispose();
      observer.disconnect();
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerCancel);
      canvas.removeEventListener('wheel', onWheel);
      liveState.sync = null;
      liveState.setTable = null;
      if (apiRef) apiRef.current = null;
      particles.dispose();
      disposeObject(scene);
      renderer.dispose();
      renderer.forceContextLoss();
      mount.removeChild(canvas);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={mountRef} className="vault-canvas">
      <div ref={veilRef} className="vault-canvas__veil" aria-hidden="true" />
    </div>
  );
}
