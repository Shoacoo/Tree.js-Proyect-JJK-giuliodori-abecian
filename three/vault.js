import * as THREE from 'three';
import { createAuraMaterial } from './auraShader';
import { createFinger } from './finger';
import { createSealBand } from './ofuda';

// Sala de Catalogación del Depósito B3. Unidades en metros.
// El jugador mira hacia -Z: estanterías contra la pared del fondo, mesa al centro,
// terminal a la derecha de la mesa.

export const ROOM = { width: 12, depth: 10, height: 3.2, back: -4 };

function canvasTexture(width, height, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d'), width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function noiseTexture(base, spread, repeat) {
  const texture = canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i += 1) {
      const v = Math.random() * spread;
      ctx.fillStyle = `rgba(${v}, ${v * 0.9}, ${v * 0.8}, ${Math.random() * 0.12})`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 4, 1 + Math.random() * 4);
    }
    // Manchas de humedad.
    for (let i = 0; i < 10; i += 1) {
      const g = ctx.createRadialGradient(Math.random() * w, Math.random() * h, 0, Math.random() * w, Math.random() * h, 60 + Math.random() * 120);
      g.addColorStop(0, 'rgba(0,0,0,0.12)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
  });
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  return texture;
}

export function createRoom() {
  const group = new THREE.Group();
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM.width, ROOM.depth),
    new THREE.MeshStandardMaterial({ map: noiseTexture('#26211c', 90, 4), roughness: 0.95 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = 0.5;
  floor.receiveShadow = true;
  group.add(floor);

  const wallMaterial = new THREE.MeshStandardMaterial({ map: noiseTexture('#1d1915', 60, 3), roughness: 1 });
  const walls = [
    [ROOM.width, ROOM.height, 0, ROOM.height / 2, ROOM.back, 0],
    [ROOM.depth, ROOM.height, -ROOM.width / 2, ROOM.height / 2, 0.5, Math.PI / 2],
    [ROOM.depth, ROOM.height, ROOM.width / 2, ROOM.height / 2, 0.5, -Math.PI / 2],
    [ROOM.width, ROOM.height, 0, ROOM.height / 2, 5.5, Math.PI],
  ];
  walls.forEach(([w, h, x, y, z, ry]) => {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wallMaterial);
    wall.position.set(x, y, z);
    wall.rotation.y = ry;
    wall.receiveShadow = true;
    group.add(wall);
  });
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.width, ROOM.depth), new THREE.MeshStandardMaterial({ color: 0x15120f, roughness: 1 }));
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, ROOM.height, 0.5);
  group.add(ceiling);

  // Cartel de la bóveda.
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(1.1, 0.38),
    new THREE.MeshStandardMaterial({
      map: canvasTexture(512, 176, (ctx, w, h) => {
        ctx.fillStyle = '#d6cbb0';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#17140f';
        ctx.font = '700 92px "Zen Kaku Gothic New", serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('保管庫 B3', w / 2, h / 2 + 6);
      }),
      roughness: 0.8,
    }),
  );
  sign.position.set(0, 2.72, ROOM.back + 0.01);
  group.add(sign);

  // Tubo fluorescente.
  const tube = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.025, 1.4, 12),
    new THREE.MeshStandardMaterial({ color: 0xedebdd, emissive: 0xedebdd, emissiveIntensity: 2.2 }),
  );
  tube.rotation.z = Math.PI / 2;
  tube.position.set(0, 3.08, -1.6);
  tube.name = 'tube';
  const housing = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.05, 0.14), new THREE.MeshStandardMaterial({ color: 0x2a2620 }));
  housing.position.set(0, 3.15, -1.6);
  group.add(tube, housing);

  return { group, tube };
}

// Placa de cartón con el código de la caja.
function labelTexture(code) {
  return canvasTexture(256, 112, (ctx, w, h) => {
    ctx.fillStyle = '#d6cbb0';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#2a1f16';
    ctx.lineWidth = 4;
    ctx.strokeRect(4, 4, w - 8, h - 8);
    ctx.fillStyle = '#17140f';
    ctx.font = '600 54px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(code, w / 2, h / 2 + 3);
  });
}

const BOX = { w: 0.5, h: 0.36, d: 0.42, wall: 0.018 };

// Caja de madera con tapa que se abre hacia atrás.
function createBox(code, woodMaterial, content) {
  const box = new THREE.Group();
  box.name = `box:${code}`;
  const body = new THREE.Group();
  box.add(body);
  const parts = [
    [BOX.w, BOX.wall, BOX.d, 0, -BOX.h / 2 + BOX.wall / 2, 0],
    [BOX.w, BOX.h, BOX.wall, 0, 0, BOX.d / 2 - BOX.wall / 2],
    [BOX.w, BOX.h, BOX.wall, 0, 0, -BOX.d / 2 + BOX.wall / 2],
    [BOX.wall, BOX.h, BOX.d, BOX.w / 2 - BOX.wall / 2, 0, 0],
    [BOX.wall, BOX.h, BOX.d, -BOX.w / 2 + BOX.wall / 2, 0, 0],
  ];
  parts.forEach(([w, h, d, x, y, z]) => {
    const part = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), woodMaterial);
    part.position.set(x, y, z);
    part.castShadow = true;
    part.receiveShadow = true;
    body.add(part);
  });
  const label = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.096), new THREE.MeshStandardMaterial({ map: labelTexture(code), roughness: 0.9 }));
  label.position.set(0, 0, BOX.d / 2 + 0.001);
  body.add(label);

  // Tapa con bisagra en el borde trasero.
  const lid = new THREE.Group();
  lid.position.set(0, BOX.h / 2, -BOX.d / 2);
  const lidMesh = new THREE.Mesh(new THREE.BoxGeometry(BOX.w + 0.01, BOX.wall * 1.4, BOX.d + 0.01), woodMaterial);
  lidMesh.position.z = BOX.d / 2;
  lidMesh.castShadow = true;
  lid.add(lidMesh);
  // Ofuda que sella la tapa.
  const strip = new THREE.Mesh(
    new THREE.PlaneGeometry(0.06, BOX.d + 0.02),
    new THREE.MeshStandardMaterial({ color: 0xe3d4a6, roughness: 0.9, side: THREE.DoubleSide }),
  );
  strip.rotation.x = -Math.PI / 2;
  strip.position.set(0, BOX.wall * 0.75, BOX.d / 2);
  lid.add(strip);
  body.add(lid);

  if (content) {
    content.position.y = -BOX.h / 2 + 0.06;
    body.add(content);
  }

  box.userData = { type: 'box', code, body, lid, open: 0, target: 0 };
  // Malla invisible para el raycasting: toda la caja responde al puntero.
  const hit = new THREE.Mesh(new THREE.BoxGeometry(BOX.w, BOX.h, BOX.d), new THREE.MeshBasicMaterial({ visible: false }));
  hit.userData = { type: 'box', code };
  body.add(hit);
  box.userData.hit = hit;
  return box;
}

// Paquete envuelto en tela: objetos sellados que no son parte del lote.
function createBundle() {
  const bundle = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.12, 0.22),
    new THREE.MeshStandardMaterial({ color: 0x5b4636, roughness: 1 }),
  );
  return bundle;
}

// Dedo en miniatura dentro de su caja, con aura propia.
function createBoxedFinger(caseData) {
  const group = new THREE.Group();
  const { group: finger, skin } = createFinger(caseData.length);
  group.add(finger);
  const aura = new THREE.Mesh(skin.geometry, createAuraMaterial());
  group.add(aura);
  group.scale.setScalar(0.022);
  group.rotation.y = 0.25;
  group.userData = { aura };
  return group;
}

// Estantería de tres niveles contra la pared del fondo.
export function createShelf(side, codes, caseByBox, hiddenBox) {
  const group = new THREE.Group();
  group.name = `shelf:${side}`;
  const x = side === 'left' ? -3.1 : 3.1;
  const z = ROOM.back + 0.45;
  group.position.set(x, 0, z);

  const frame = new THREE.MeshStandardMaterial({ color: 0x2e2821, roughness: 0.8, metalness: 0.2 });
  const board = new THREE.MeshStandardMaterial({ color: 0x3a3229, roughness: 0.85 });
  const width = 1.8;
  const levels = [0.55, 1.25, 1.95];
  [-width / 2, width / 2].forEach((px) => {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.5, 0.55), frame);
    post.position.set(px, 1.25, 0);
    post.castShadow = true;
    group.add(post);
  });
  levels.forEach((y) => {
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(width, 0.04, 0.55), board);
    shelf.position.set(0, y - 0.02, 0);
    shelf.receiveShadow = true;
    shelf.castShadow = true;
    group.add(shelf);
  });
  // Superficie clickeable para acercarse a la estantería.
  const hit = new THREE.Mesh(new THREE.BoxGeometry(width, 2.5, 0.6), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.set(0, 1.25, 0);
  hit.userData = { type: 'shelf', side };
  group.add(hit);

  const wood = new THREE.MeshStandardMaterial({ color: 0x4e3b2a, roughness: 0.8 });
  const boxes = [];
  codes.forEach((code, i) => {
    const col = i % 3;
    const row = 2 - Math.floor(i / 3);
    const px = (col - 1) * 0.58;
    const py = levels[row] + BOX.h / 2;
    const caseData = caseByBox(code);
    let box;
    if (code === hiddenBox) {
      // La B3-11 figura vacía: la caja existe, pero está escondida al fondo.
      box = createBox(code, new THREE.MeshStandardMaterial({ color: 0x2a1a14, roughness: 0.9 }), createBoxedFinger({ length: 11 }));
      box.position.set(px, py, 0);
      box.visible = false;
      box.userData.hidden = true;
    } else {
      box = createBox(code, wood, caseData ? createBoxedFinger(caseData) : createBundle());
      box.position.set(px, py, 0);
    }
    box.userData.restZ = box.position.z;
    box.userData.side = side;
    box.userData.caseId = caseData?.id ?? null;
    group.add(box);
    boxes.push(box);
  });

  // Marco punteado donde "no hay nada": la B3-11.
  const outline = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(BOX.w, BOX.h, BOX.d)),
    new THREE.LineDashedMaterial({ color: 0x5a5046, dashSize: 0.04, gapSize: 0.03 }),
  );
  const hiddenIndex = codes.indexOf(hiddenBox);
  if (hiddenIndex >= 0) {
    outline.position.set(((hiddenIndex % 3) - 1) * 0.58, levels[2 - Math.floor(hiddenIndex / 3)] + BOX.h / 2, 0);
    outline.computeLineDistances();
    outline.name = 'hidden-outline';
    group.add(outline);
  }

  return { group, boxes, outline: hiddenIndex >= 0 ? outline : null };
}

// Mesa de inspección con bandeja, lámpara colgante y el dedo elegido.
export function createTable() {
  const group = new THREE.Group();
  group.name = 'table';
  const wood = new THREE.MeshStandardMaterial({ color: 0x2c241b, roughness: 0.75 });
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.06, 1.0), wood);
  top.position.y = 0.86;
  top.castShadow = true;
  top.receiveShadow = true;
  group.add(top);
  [[-0.85, -0.42], [0.85, -0.42], [-0.85, 0.42], [0.85, 0.42]].forEach(([x, z]) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.83, 0.06), wood);
    leg.position.set(x, 0.415, z);
    leg.castShadow = true;
    group.add(leg);
  });
  const tray = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.03, 0.22),
    new THREE.MeshStandardMaterial({ color: 0x4a1514, roughness: 1 }),
  );
  tray.position.set(0, 0.905, 0);
  tray.receiveShadow = true;
  group.add(tray);
  const trayRim = new THREE.Mesh(
    new THREE.BoxGeometry(0.46, 0.025, 0.26),
    new THREE.MeshStandardMaterial({ color: 0x3b2c1e, roughness: 0.8 }),
  );
  trayRim.position.set(0, 0.89, 0);
  group.add(trayRim);

  const hit = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.5, 1.0), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.y = 0.95;
  hit.userData = { type: 'table' };
  group.add(hit);

  // Lámpara colgante: la luz cenital dura del prototipo.
  const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 1.1, 6), new THREE.MeshStandardMaterial({ color: 0x111111 }));
  cable.position.y = 2.65;
  const shade = new THREE.Mesh(
    new THREE.ConeGeometry(0.22, 0.2, 24, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x3a342c, roughness: 0.6, metalness: 0.4, side: THREE.DoubleSide }),
  );
  shade.position.y = 2.0;
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 8), new THREE.MeshStandardMaterial({ emissive: 0xfff0d0, emissiveIntensity: 3, color: 0xffffff }));
  bulb.position.y = 1.93;
  group.add(cable, shade, bulb);

  const lamp = new THREE.SpotLight(0xffd9a8, 22, 5, 0.55, 0.45, 1.4);
  lamp.position.set(0, 1.92, 0);
  lamp.target.position.set(0, 0.86, 0);
  lamp.castShadow = true;
  lamp.shadow.mapSize.set(1024, 1024);
  lamp.shadow.bias = -0.0005;
  group.add(lamp, lamp.target);

  const slot = new THREE.Group();
  slot.position.set(0, 0.935, 0);
  slot.name = 'table-slot';
  group.add(slot);

  return { group, slot, lamp };
}

// Relicario sobre la mesa: el dedo elegido con sus sellos, en escala real.
export function createTableRelic(caseData, sealState) {
  const group = new THREE.Group();
  const { group: finger, skin } = createFinger(caseData.length);
  group.add(finger);
  caseData.seals.forEach((seal) => {
    if (!sealState?.[seal.id]?.peeled) group.add(createSealBand(seal, caseData.length));
  });
  const aura = new THREE.Mesh(skin.geometry, createAuraMaterial());
  group.add(aura);
  group.scale.setScalar(0.03);
  group.position.y = 0.025;
  group.userData = { aura };
  return group;
}

// Pantalla de la terminal B3-T02, dibujada en canvas y actualizada en cada parpadeo.
export function drawTerminalScreen(ctx, w, h, { signedIn, operator, cursor, influence }) {
  ctx.fillStyle = '#d8d0b8';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#17140f';
  ctx.fillRect(0, 0, w, 54);
  ctx.fillStyle = '#e7e0cd';
  ctx.font = '700 26px "Zen Kaku Gothic New", sans-serif';
  ctx.fillText('呪術高専', 20, 36);
  ctx.font = '500 18px "IBM Plex Mono", monospace';
  ctx.fillText('SISTEMA DE EXPEDIENTES · DEPÓSITO B3', 150, 34);
  ctx.fillStyle = '#17140f';
  ctx.font = '600 34px "IBM Plex Mono", monospace';
  ctx.fillText('TERMINAL B3-T02', 24, 120);
  ctx.font = '400 22px "IBM Plex Mono", monospace';
  ctx.fillStyle = '#4a453c';
  ctx.fillText(signedIn ? `Sesión: ${operator}` : 'Sin sesión', 24, 164);
  ctx.fillStyle = '#17140f';
  ctx.fillRect(24, 196, w - 48, 3);
  ctx.font = '500 28px "IBM Plex Mono", monospace';
  ctx.fillText(signedIn ? '> Abrir índice de expedientes' : '> Identificarse', 24, 250);
  if (cursor) ctx.fillRect(24 + ctx.measureText(signedIn ? '> Abrir índice de expedientes' : '> Identificarse').width + 8, 226, 16, 30);
  ctx.font = '400 18px "IBM Plex Mono", monospace';
  ctx.fillStyle = '#4a453c';
  ctx.fillText('Toda sesión queda registrada.', 24, h - 30);
  if (influence >= 2) {
    ctx.fillStyle = 'rgba(158, 31, 23, 0.85)';
    ctx.font = '400 30px "Yuji Syuku", serif';
    ctx.fillText(influence >= 3 ? 'ya son tuyos' : 'ya casi', w - 220, h - 70);
  }
  // Líneas de barrido.
  ctx.fillStyle = 'rgba(0,0,0,0.05)';
  for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 1);
}

export function createTerminal() {
  const group = new THREE.Group();
  group.name = 'terminal';
  // A la derecha de la mesa, mirando hacia ella.
  group.position.set(2.45, 0, 0.35);
  group.rotation.y = -Math.PI / 2 + 0.25;

  const wood = new THREE.MeshStandardMaterial({ color: 0x2c241b, roughness: 0.75 });
  const desk = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 0.7), wood);
  desk.position.y = 0.76;
  desk.castShadow = true;
  desk.receiveShadow = true;
  group.add(desk);
  [[-0.55, -0.3], [0.55, -0.3], [-0.55, 0.3], [0.55, 0.3]].forEach(([x, z]) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.74, 0.05), wood);
    leg.position.set(x, 0.37, z);
    group.add(leg);
  });

  const plastic = new THREE.MeshStandardMaterial({ color: 0x2b2722, roughness: 0.6 });
  const monitor = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.42, 0.4), plastic);
  monitor.position.set(0, 1.07, -0.08);
  monitor.castShadow = true;
  group.add(monitor);
  const stand = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, 0.18), plastic);
  stand.position.set(0, 0.82, -0.08);
  group.add(stand);
  const keyboard = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.025, 0.16), new THREE.MeshStandardMaterial({ color: 0x3a342c, roughness: 0.7 }));
  keyboard.position.set(0, 0.8, 0.2);
  keyboard.rotation.x = 0.06;
  group.add(keyboard);

  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 480;
  const screenTexture = new THREE.CanvasTexture(canvas);
  screenTexture.colorSpace = THREE.SRGBColorSpace;
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.48, 0.36),
    new THREE.MeshStandardMaterial({ map: screenTexture, emissive: 0xffffff, emissiveMap: screenTexture, emissiveIntensity: 0.55, roughness: 0.3 }),
  );
  screen.position.set(0, 1.08, 0.121);
  screen.userData = { type: 'terminal' };
  group.add(screen);

  const glow = new THREE.PointLight(0xe7e0cd, 0.6, 2.2, 2);
  glow.position.set(0, 1.08, 0.45);
  group.add(glow);

  const hit = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 0.7), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.y = 1.0;
  hit.userData = { type: 'terminal' };
  group.add(hit);

  return { group, screen, canvas, screenTexture };
}
