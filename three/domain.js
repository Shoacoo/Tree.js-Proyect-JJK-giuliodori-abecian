import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createFinger } from './finger';
import { glowTexture } from './proctex';

// Expansión de dominio de Sukuna (伏魔御廚子): un santuario sobre una montaña de cráneos,
// en medio de un charco de sangre, con un altar de velas y Sukuna sentado esperando.
// Todo es geometría procedural; el que mira está frente a la escalinata (+Z).

export const PLATFORM_Y = 1.45; // altura del piso del santuario
const FRONT_Z = 0.1; // pilares del frente
const BACK_Z = -2.5; // pilares del fondo
const PLATFORM = { front: 0.7, back: -2.7 };

const lacquer = () => new THREE.MeshStandardMaterial({ color: 0x4a0a08, roughness: 0.45, metalness: 0.1 });
const charred = () => new THREE.MeshStandardMaterial({ color: 0x150c0a, roughness: 0.9 });
const ivory = () => new THREE.MeshStandardMaterial({ color: 0xcdbf9f, roughness: 0.55 });

function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mesh(geometry, material, { cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(geometry, material);
  m.castShadow = cast;
  m.receiveShadow = receive;
  return m;
}

// Color por vértice: permite un cráneo con cuencas oscuras en un solo InstancedMesh.
function paint(geometry, hex) {
  const c = new THREE.Color(hex);
  const colors = new Float32Array(geometry.attributes.position.count * 3);
  for (let i = 0; i < colors.length; i += 3) {
    colors[i] = c.r;
    colors[i + 1] = c.g;
    colors[i + 2] = c.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

// Cráneo: bóveda, cara, mandíbula, cuencas y nariz. El frente mira a +Z.
function skullGeometry() {
  const bone = 0xd6caae;
  const hole = 0x060302;
  const cranium = paint(new THREE.SphereGeometry(0.16, 14, 10), bone);
  cranium.scale(1, 0.92, 1.12);
  const face = paint(new THREE.SphereGeometry(0.11, 12, 8), bone);
  face.scale(1, 0.85, 0.8);
  face.translate(0, -0.06, 0.08);
  const jaw = paint(new THREE.BoxGeometry(0.13, 0.05, 0.08), bone);
  jaw.translate(0, -0.14, 0.07);
  const sockets = [-0.05, 0.05].map((x) => {
    const s = paint(new THREE.SphereGeometry(0.04, 10, 8), hole);
    s.translate(x, -0.02, 0.146);
    return s;
  });
  const nose = paint(new THREE.ConeGeometry(0.02, 0.045, 6), hole);
  nose.rotateX(Math.PI);
  nose.translate(0, -0.075, 0.158);
  return mergeGeometries([cranium, face, jaw, ...sockets, nose], false);
}

// Altura de la montaña de cráneos según la distancia al centro del santuario.
function mound(r) {
  return PLATFORM_Y * Math.max(0, 1 - (r / 3.7) ** 2) ** 0.75;
}

/** Montaña de cráneos bajo el santuario y algunos sueltos en el charco. */
export function createSkullField(count = 380) {
  const rand = seeded(404);
  const geometry = skullGeometry();
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 });
  const field = new THREE.InstancedMesh(geometry, material, count);
  field.castShadow = true;
  field.receiveShadow = true;
  const dummy = new THREE.Object3D();
  const tint = new THREE.Color();
  const center = new THREE.Vector2(0, -1.0);
  let placed = 0;
  let guard = 0;
  while (placed < count && guard < count * 6) {
    guard += 1;
    const scattered = placed > count * 0.88;
    let x;
    let y;
    let z;
    let a;
    if (scattered) {
      // Sueltos en el charco, medio hundidos.
      x = (rand() - 0.5) * 9;
      z = 1.2 + rand() * 4.5;
      y = 0.03;
      a = Math.atan2(z - center.y, x);
      if (Math.abs(x) < 0.9 && z < 3.2) continue;
    } else {
      a = rand() * Math.PI * 2;
      const r = Math.sqrt(rand()) * 3.6;
      x = center.x + Math.cos(a) * r;
      z = center.y + Math.sin(a) * r;
      y = mound(r) + (rand() - 0.6) * 0.18;
      // No se ven bajo el piso del santuario ni sobre la escalinata.
      if (Math.abs(x) < 1.75 && z > PLATFORM.back - 0.1 && z < PLATFORM.front - 0.1 && y > PLATFORM_Y - 0.5) continue;
      if (Math.abs(x) < 0.95 && z > PLATFORM.front - 0.2) continue;
    }
    dummy.position.set(x, y, z);
    dummy.lookAt(x + Math.cos(a) * 2, y + (rand() - 0.25) * 1.5, z + Math.sin(a) * 2);
    dummy.rotateZ((rand() - 0.5) * 0.9);
    dummy.scale.setScalar(0.8 + rand() * 0.6);
    dummy.updateMatrix();
    field.setMatrixAt(placed, dummy.matrix);
    tint.setScalar(0.55 + rand() * 0.45);
    field.setColorAt(placed, tint);
    placed += 1;
  }
  field.count = placed;
  return field;
}

// Techo a cuatro aguas con los aleros curvados hacia arriba.
function hipRoof(width, depth, height, curl, segments = 18) {
  const geometry = new THREE.PlaneGeometry(2, 2, segments, segments);
  geometry.rotateX(-Math.PI / 2);
  const p = geometry.attributes.position;
  for (let i = 0; i < p.count; i += 1) {
    const x = p.getX(i);
    const z = p.getZ(i);
    const m = Math.max(Math.abs(x), Math.abs(z));
    const flare = 1 + 0.1 * m ** 3;
    p.setXYZ(i, (x * width * flare) / 2, height * (1 - m) + curl * m ** 4, (z * depth * flare) / 2);
  }
  geometry.computeVertexNormals();
  return geometry;
}

// Tiras de papel en zigzag (shide) que cuelgan de la soga sagrada.
function shideTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#efe8d6';
  ctx.beginPath();
  const steps = 4;
  for (let i = 0; i <= steps; i += 1) {
    const y = (i / steps) * 250;
    const x = i % 2 ? 34 : 8;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  for (let i = steps; i >= 0; i -= 1) {
    const y = (i / steps) * 250 + 4;
    const x = (i % 2 ? 34 : 8) + 22;
    ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** El santuario: piso, escalinata, pilares, fauces con colmillos, techos y soga sagrada. */
export function createShrine() {
  const group = new THREE.Group();
  group.name = 'malevolent-shrine';
  const wood = lacquer();
  const dark = charred();
  const teeth = ivory();
  const depth = PLATFORM.front - PLATFORM.back;
  const midZ = (PLATFORM.front + PLATFORM.back) / 2;

  // Piso y la masa oscura que lo sostiene entre los cráneos.
  const floor = mesh(new THREE.BoxGeometry(3.7, 0.3, depth), dark);
  floor.position.set(0, PLATFORM_Y - 0.15, midZ);
  group.add(floor);
  const base = mesh(new THREE.BoxGeometry(3.3, PLATFORM_Y - 0.2, depth - 0.3), dark, { cast: false });
  base.position.set(0, (PLATFORM_Y - 0.2) / 2, midZ);
  group.add(base);

  // Escalinata hasta el charco.
  const steps = 6;
  for (let i = 0; i < steps; i += 1) {
    const top = PLATFORM_Y - (i + 1) * (PLATFORM_Y / (steps + 0.5));
    const step = mesh(new THREE.BoxGeometry(1.6, Math.max(0.05, top), 0.42), dark);
    step.position.set(0, Math.max(0.05, top) / 2, PLATFORM.front + 0.21 + i * 0.42);
    group.add(step);
  }

  // Pilares y vigas.
  const height = 2.5;
  [FRONT_Z, BACK_Z].forEach((z) => {
    [-1.5, 1.5].forEach((x) => {
      const pillar = mesh(new THREE.CylinderGeometry(0.11, 0.13, height, 16), wood);
      pillar.position.set(x, PLATFORM_Y + height / 2, z);
      group.add(pillar);
    });
    const beam = mesh(new THREE.BoxGeometry(3.5, 0.24, 0.24), wood);
    beam.position.set(0, PLATFORM_Y + height, z);
    group.add(beam);
  });
  [-1.5, 1.5].forEach((x) => {
    const side = mesh(new THREE.BoxGeometry(0.24, 0.24, FRONT_Z - BACK_Z), wood);
    side.position.set(x, PLATFORM_Y + height, (FRONT_Z + BACK_Z) / 2);
    group.add(side);
    const wall = mesh(new THREE.BoxGeometry(0.08, height, FRONT_Z - BACK_Z - 0.3), dark);
    wall.position.set(x * 0.98, PLATFORM_Y + height / 2, (FRONT_Z + BACK_Z) / 2 - 0.1);
    group.add(wall);
  });
  const backWall = mesh(new THREE.BoxGeometry(3, height, 0.1), new THREE.MeshStandardMaterial({ color: 0x060202, roughness: 1 }));
  backWall.position.set(0, PLATFORM_Y + height / 2, BACK_Z + 0.05);
  group.add(backWall);

  // Garganta: un resplandor rojo al fondo de las fauces.
  const throat = new THREE.Mesh(
    new THREE.CircleGeometry(0.95, 40),
    new THREE.MeshBasicMaterial({ map: glowTexture('200,20,10'), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  throat.position.set(0, PLATFORM_Y + 1.1, BACK_Z + 0.12);
  group.add(throat);

  // Fauces: colmillos que bajan de la viga y suben por detrás de Sukuna.
  const rand = seeded(7);
  const fangs = [];
  for (let i = 0; i < 13; i += 1) {
    const x = -1.32 + (i / 12) * 2.64;
    const len = 0.24 + (i % 2 ? 0.08 : 0.24) + rand() * 0.1;
    const cone = new THREE.ConeGeometry(0.075, len, 8);
    cone.rotateX(Math.PI);
    cone.translate(x, PLATFORM_Y + height - 0.12 - len / 2, FRONT_Z + 0.02);
    fangs.push(cone);
  }
  for (let i = 0; i < 11; i += 1) {
    const x = -1.25 + (i / 10) * 2.5;
    const len = 0.2 + (i % 2 ? 0.06 : 0.2) + rand() * 0.08;
    const cone = new THREE.ConeGeometry(0.07, len, 8);
    cone.translate(x, PLATFORM_Y + len / 2, -1.35);
    fangs.push(cone);
  }
  group.add(mesh(mergeGeometries(fangs, false), teeth));

  // Techos: dos alas curvadas y un remate.
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x170908, roughness: 0.7, side: THREE.DoubleSide });
  const roofZ = (FRONT_Z + BACK_Z) / 2;
  const lower = mesh(hipRoof(4.8, 4.0, 0.85, 0.5), roofMat);
  lower.position.set(0, PLATFORM_Y + height + 0.12, roofZ);
  group.add(lower);
  const drum = mesh(new THREE.BoxGeometry(2.1, 0.4, 1.6), wood);
  drum.position.set(0, PLATFORM_Y + height + 0.95, roofZ);
  group.add(drum);
  const upper = mesh(hipRoof(3.0, 2.4, 0.6, 0.35), roofMat);
  upper.position.set(0, PLATFORM_Y + height + 1.15, roofZ);
  group.add(upper);
  const finial = mesh(new THREE.ConeGeometry(0.08, 0.5, 8), teeth);
  finial.position.set(0, PLATFORM_Y + height + 2.0, roofZ);
  group.add(finial);

  // Soga sagrada entre los pilares del frente, con sus tiras de papel.
  const ropeY = PLATFORM_Y + height - 0.45;
  const sag = (x) => ropeY - 0.32 * (1 - (x / 1.5) ** 2);
  const curve = new THREE.CatmullRomCurve3(Array.from({ length: 9 }, (_, i) => {
    const x = -1.5 + (i / 8) * 3;
    return new THREE.Vector3(x, sag(x), FRONT_Z + 0.16);
  }));
  group.add(mesh(new THREE.TubeGeometry(curve, 48, 0.065, 8), new THREE.MeshStandardMaterial({ color: 0x9c8450, roughness: 0.95 })));
  const paper = new THREE.MeshStandardMaterial({ map: shideTexture(), transparent: true, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9 });
  [-0.95, -0.32, 0.32, 0.95].forEach((x) => {
    const strip = mesh(new THREE.PlaneGeometry(0.13, 0.5), paper);
    strip.position.set(x, sag(x) - 0.3, FRONT_Z + 0.2);
    group.add(strip);
  });

  return { group, throat };
}

function limb(from, to, radius, material) {
  const dir = new THREE.Vector3().subVectors(to, from);
  const length = dir.length();
  const m = mesh(new THREE.CapsuleGeometry(radius, Math.max(0.01, length - radius * 2), 4, 12), material);
  m.position.copy(from).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return m;
}

// Cara: piel clara con las marcas negras bajo los ojos y en la frente.
// En una esfera de Three.js el frente (+Z) cae en u = 0,25.
function faceTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#c4a08a';
  ctx.fillRect(0, 0, 512, 256);
  const fx = 128;
  ctx.fillStyle = '#140a0a';
  [-1, 1].forEach((s) => {
    [0, 13].forEach((dy) => ctx.fillRect(fx + s * 30 - 15, 134 + dy, 30, 5));
    // Cejas afiladas.
    ctx.beginPath();
    ctx.moveTo(fx + s * 10, 104);
    ctx.lineTo(fx + s * 46, 96);
    ctx.lineTo(fx + s * 44, 102);
    ctx.closePath();
    ctx.fill();
  });
  ctx.fillRect(fx - 4, 62, 8, 30);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Pecho: piel con bandas negras curvas, como las marcas de Sukuna.
function chestTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#c4a08a';
  ctx.fillRect(0, 0, 512, 256);
  ctx.strokeStyle = '#140a0a';
  ctx.lineCap = 'round';
  ctx.lineWidth = 9;
  const fx = 128;
  [-1, 1].forEach((s) => {
    [96, 128, 160].forEach((y) => {
      ctx.beginPath();
      ctx.moveTo(fx + s * 8, y);
      ctx.quadraticCurveTo(fx + s * 40, y - 18, fx + s * 70, y + 6);
      ctx.stroke();
    });
  });
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(fx, 60);
  ctx.lineTo(fx, 200);
  ctx.stroke();
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Sukuna sentado con las piernas cruzadas, kimono claro y bufanda oscura.
 * Cuatro ojos que se encienden y una sonrisa que aparece cuando ríe.
 */
export function createSukuna() {
  const group = new THREE.Group();
  group.name = 'sukuna';
  const robe = new THREE.MeshStandardMaterial({ color: 0x6f665a, roughness: 0.95 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1a1214, roughness: 0.7 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xc4a08a, roughness: 0.6 });
  const ink = new THREE.MeshStandardMaterial({ color: 0x0e0809, roughness: 0.6 });
  const tattooed = new THREE.MeshStandardMaterial({ map: chestTexture(), roughness: 0.6 });

  const lap = mesh(new THREE.SphereGeometry(0.5, 24, 12), robe);
  lap.scale.set(1.35, 0.42, 0.95);
  lap.position.y = 0.17;
  group.add(lap);
  [-1, 1].forEach((s) => {
    const knee = mesh(new THREE.SphereGeometry(0.17, 16, 10), robe);
    knee.scale.set(1, 0.8, 1.25);
    knee.position.set(s * 0.48, 0.2, 0.2);
    group.add(knee);
  });

  const body = new THREE.Group();
  group.add(body);
  const torso = mesh(new THREE.CapsuleGeometry(0.24, 0.42, 6, 16), robe);
  torso.position.y = 0.7;
  torso.scale.set(1.15, 1, 0.78);
  body.add(torso);
  // Kimono abierto en el pecho: piel con las marcas negras.
  const chest = mesh(new THREE.SphereGeometry(0.2, 20, 14), tattooed);
  chest.scale.set(0.72, 1.1, 0.42);
  chest.position.set(0, 0.8, 0.12);
  body.add(chest);
  const sash = mesh(new THREE.TorusGeometry(0.265, 0.05, 8, 28), dark);
  sash.rotation.x = Math.PI / 2;
  sash.scale.set(1.15, 0.8, 1);
  sash.position.y = 0.47;
  body.add(sash);
  const scarf = mesh(new THREE.TorusGeometry(0.13, 0.06, 8, 20), dark);
  scarf.rotation.x = Math.PI / 2;
  scarf.position.y = 1.0;
  body.add(scarf);

  // Brazos apoyados en las rodillas, con las bandas tatuadas en los antebrazos.
  [-1, 1].forEach((s) => {
    const shoulder = new THREE.Vector3(s * 0.31, 0.9, 0);
    const elbow = new THREE.Vector3(s * 0.52, 0.52, 0.2);
    const hand = new THREE.Vector3(s * 0.4, 0.32, 0.42);
    body.add(limb(shoulder, elbow, 0.105, robe));
    body.add(limb(elbow, hand, 0.052, skin));
    [0.35, 0.6].forEach((k) => {
      const band = mesh(new THREE.TorusGeometry(0.054, 0.008, 6, 16), ink);
      band.position.lerpVectors(elbow, hand, k);
      band.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3().subVectors(hand, elbow).normalize());
      body.add(band);
    });
    const fist = mesh(new THREE.SphereGeometry(0.065, 12, 8), skin);
    fist.position.copy(hand);
    body.add(fist);
  });

  const head = new THREE.Group();
  head.position.y = 1.12;
  body.add(head);
  const neck = mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.12, 12), skin);
  neck.position.y = -0.06;
  head.add(neck);
  const skull = mesh(new THREE.SphereGeometry(0.13, 32, 20), new THREE.MeshStandardMaterial({ map: faceTexture(), roughness: 0.6 }));
  skull.position.y = 0.08;
  skull.scale.set(0.95, 1.08, 1);
  head.add(skull);

  // Pelo en punta, hacia arriba y atrás.
  const rand = seeded(23);
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x9c5a66, roughness: 0.8 });
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < 16; i += 1) {
    const dir = new THREE.Vector3(rand() - 0.5, 0.45 + rand() * 0.6, -0.15 - rand() * 0.7).normalize();
    const spike = mesh(new THREE.ConeGeometry(0.04, 0.13 + rand() * 0.06, 6), hairMat);
    spike.position.copy(dir).multiplyScalar(0.12).add(new THREE.Vector3(0, 0.1, 0));
    spike.quaternion.setFromUnitVectors(up, dir);
    head.add(spike);
  }

  // Cuatro ojos: dos en su lugar y dos más abajo, sobre las marcas.
  const eyes = [];
  const glows = [];
  const glowMap = glowTexture('255,40,20');
  [
    [-0.043, 0.098, 0.118],
    [0.043, 0.098, 0.118],
    [-0.06, 0.058, 0.108],
    [0.06, 0.058, 0.108],
  ].forEach(([x, y, z], i) => {
    const material = new THREE.MeshBasicMaterial({ color: 0xff2a14, transparent: true, opacity: 0, toneMapped: false });
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.016, 10, 8), material);
    eye.scale.set(1.6, i < 2 ? 0.6 : 0.5, 0.5);
    eye.position.set(x, y, z);
    head.add(eye);
    eyes.push(material);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowMap, color: 0xff3a20, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    glow.scale.setScalar(i < 2 ? 0.08 : 0.06);
    glow.position.set(x, y, z + 0.01);
    head.add(glow);
    glows.push(glow.material);
  });

  // Sonrisa: un arco de dientes que se enciende cuando ríe.
  const arc = Math.PI * 0.8;
  const grinGeometry = new THREE.TorusGeometry(0.05, 0.01, 6, 24, arc);
  const grinMat = new THREE.MeshBasicMaterial({ color: 0xfff0e4, transparent: true, opacity: 0, toneMapped: false });
  const grin = new THREE.Mesh(grinGeometry, grinMat);
  grin.rotation.z = Math.PI + (Math.PI - arc) / 2;
  grin.position.set(0, 0.035, 0.118);
  grin.scale.set(1.15, 0.7, 1);
  head.add(grin);

  return { group, body, head, eyes, glows, grin: grinMat };
}

/** Altar: mesa laqueada, paño rojo, dos velas y un dedo como ofrenda. */
export function createAltar() {
  const group = new THREE.Group();
  group.name = 'altar';
  const table = mesh(new THREE.BoxGeometry(1.1, 0.32, 0.46), new THREE.MeshStandardMaterial({ color: 0x1c0705, roughness: 0.35 }));
  table.position.y = 0.16;
  group.add(table);
  const cloth = mesh(new THREE.PlaneGeometry(0.86, 0.36), new THREE.MeshStandardMaterial({ color: 0x6a0b08, roughness: 0.9 }));
  cloth.rotation.x = -Math.PI / 2;
  cloth.position.y = 0.322;
  group.add(cloth);

  const flames = [];
  const glowMap = glowTexture('255,150,60');
  [-0.4, 0.4].forEach((x) => {
    const candle = mesh(new THREE.CylinderGeometry(0.034, 0.038, 0.22, 14), new THREE.MeshStandardMaterial({ color: 0xe6dcc6, roughness: 0.6 }));
    candle.position.set(x, 0.43, 0);
    group.add(candle);
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.017, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffd08a, transparent: true, opacity: 0 }));
    core.scale.set(1, 2.3, 1);
    core.position.set(x, 0.575, 0);
    group.add(core);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowMap, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.scale.setScalar(0.34);
    glow.position.set(x, 0.58, 0);
    group.add(glow);
    flames.push({ core, glow });
  });

  // La ofrenda: el dedo que sale de la bóveda.
  const { group: finger } = createFinger(11, { steps: 60, radial: 24 });
  finger.scale.setScalar(0.012);
  finger.rotation.set(0, 0.25, 0);
  finger.position.set(-0.07, 0.345, 0.02);
  group.add(finger);

  const light = new THREE.PointLight(0xff8a3a, 0, 5, 2);
  light.position.set(0, 0.65, 0.1);
  group.add(light);
  return { group, flames, light };
}

/** Charco de sangre que cubre el suelo del dominio. */
export function createBloodPool() {
  const pool = mesh(new THREE.CircleGeometry(30, 72), new THREE.MeshStandardMaterial({ color: 0x1e0303, roughness: 0.1, metalness: 0.65 }), { cast: false });
  pool.rotation.x = -Math.PI / 2;
  return pool;
}

/** Cielo del dominio: rojo oscuro en el horizonte, negro arriba. uLight lo enciende. */
export function createDomainSky() {
  const material = new THREE.ShaderMaterial({
    uniforms: { uLight: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uLight;
      varying vec3 vDir;
      void main() {
        float h = vDir.y;
        vec3 color = mix(vec3(0.32, 0.02, 0.015), vec3(0.0), smoothstep(-0.05, 0.45, h));
        gl_FragColor = vec4(color * uLight, 1.0);
      }
    `,
    side: THREE.BackSide,
    depthWrite: false,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(45, 32, 16), material);
  sky.renderOrder = -1;
  return sky;
}

export { FRONT_Z };
