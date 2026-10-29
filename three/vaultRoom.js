import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { font } from './fonts';
import { createOfudaTexture } from './ofuda';
import { ceilingTextures, concreteTextures, floorTextures, paintedMetalTextures, paperCanvas, rng } from './proctex';

// Sala de Catalogación del Depósito B3. Unidades en metros.
// El jugador mira hacia -Z: estanterías contra la pared del fondo, la puerta de la bóveda
// entre ellas, mesa al centro y terminal a la derecha de la mesa.
export const ROOM = { width: 12, depth: 10, height: 3.2, back: -4 };

function mesh(geometry, material, { cast = false, receive = true } = {}) {
  const m = new THREE.Mesh(geometry, material);
  m.castShadow = cast;
  m.receiveShadow = receive;
  return m;
}

// Une varias geometrías ya ubicadas en una sola malla (menos llamadas de dibujo).
function merged(parts, material, options) {
  const geometries = parts.map(([geometry, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0]) => {
    const g = geometry.clone();
    g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1)));
    return g;
  });
  return mesh(mergeGeometries(geometries), material, options);
}

// Ofudas pegados en la pared: tres variantes reutilizadas.
let wallOfudaMaterials = null;
function wallOfudas() {
  if (!wallOfudaMaterials) {
    wallOfudaMaterials = ['封印', '禁', '急急如律令'].map(
      (text) => new THREE.MeshStandardMaterial({ map: createOfudaTexture({ text }), alphaTest: 0.5, roughness: 0.95, side: THREE.DoubleSide }),
    );
  }
  return wallOfudaMaterials;
}

function addWallOfuda(group, x, y, z, { ry = 0, tilt = 0, scale = 1, variant = 0, torn = false } = {}) {
  const h = 0.36 * scale * (torn ? 0.6 : 1);
  const geometry = new THREE.PlaneGeometry(0.09 * scale, h, 1, 4);
  // Papel un poco ondulado y despegado en la punta.
  const pos = geometry.attributes.position;
  for (let i = 0; i < pos.count; i += 1) {
    const t = (pos.getY(i) + h / 2) / h;
    pos.setZ(i, Math.sin(t * Math.PI) * 0.004 + (1 - t) ** 3 * 0.02);
  }
  geometry.computeVertexNormals();
  if (torn) {
    const uv = geometry.attributes.uv;
    for (let i = 0; i < uv.count; i += 1) uv.setY(i, 0.4 + uv.getY(i) * 0.6);
  }
  const m = mesh(geometry, wallOfudas()[variant % 3]);
  m.position.set(x, y, z);
  m.rotation.set(0, ry, tilt);
  group.add(m);
  return m;
}

// Cuerda sagrada (shimenawa) con tiras de papel en zigzag (shide).
function createShimenawa(width, sag) {
  const group = new THREE.Group();
  const curve = new THREE.CatmullRomCurve3(
    Array.from({ length: 9 }, (_, i) => {
      const t = i / 8;
      return new THREE.Vector3((t - 0.5) * width, -Math.sin(t * Math.PI) * sag, 0);
    }),
  );
  const rope = paperCanvas(301, 512, 64, { tint: [176, 150, 98], age: 0.7 });
  rope.ctx.strokeStyle = 'rgba(70,52,25,0.75)';
  rope.ctx.lineWidth = 7;
  for (let x = -64; x < 576; x += 22) {
    rope.ctx.beginPath();
    rope.ctx.moveTo(x, 0);
    rope.ctx.lineTo(x + 40, 64);
    rope.ctx.stroke();
  }
  const ropeTexture = rope.toTexture();
  ropeTexture.repeat.set(6, 1);
  group.add(mesh(new THREE.TubeGeometry(curve, 64, 0.045, 10), new THREE.MeshStandardMaterial({ map: ropeTexture, roughness: 1 }), { cast: true }));

  // Shide: zigzag de papel blanco.
  const shape = new THREE.Shape();
  const s = 0.05;
  shape.moveTo(0, 0);
  shape.lineTo(s, 0);
  shape.lineTo(s, -s * 1.4);
  shape.lineTo(s * 1.9, -s * 1.4);
  shape.lineTo(s * 1.9, -s * 2.9);
  shape.lineTo(s * 2.8, -s * 2.9);
  shape.lineTo(s * 2.8, -s * 4.6);
  shape.lineTo(s * 1.9, -s * 4.6);
  shape.lineTo(s * 1.9, -s * 3.3);
  shape.lineTo(s * 0.9, -s * 3.3);
  shape.lineTo(s * 0.9, -s * 1.8);
  shape.lineTo(0, -s * 1.8);
  shape.closePath();
  const paper = new THREE.MeshStandardMaterial({ color: 0xe9e3d2, roughness: 0.9, side: THREE.DoubleSide });
  const shideGeometry = new THREE.ShapeGeometry(shape);
  [0.18, 0.4, 0.62, 0.84].forEach((t, i) => {
    const p = curve.getPoint(t);
    const shide = mesh(shideGeometry, paper);
    shide.position.set(p.x - 0.07, p.y - 0.03, 0.03);
    shide.rotation.y = (i % 2 ? 1 : -1) * 0.25;
    group.add(shide);
  });
  return group;
}

// Puerta circular de la bóveda, sellada con ofudas: lo que hay detrás no se inspecciona.
function createVaultDoor() {
  const group = new THREE.Group();
  group.name = 'vault-door';
  const steel = paintedMetalTextures(71, { color: [58, 60, 58] });
  const steelMat = new THREE.MeshStandardMaterial({ ...steel, color: 0xffffff, metalness: 0.75, roughness: 0.6, bumpScale: 0.6 });
  const darkSteel = new THREE.MeshStandardMaterial({ color: 0x24231f, metalness: 0.8, roughness: 0.45 });
  const brass = new THREE.MeshStandardMaterial({ color: 0x8a6a35, metalness: 0.9, roughness: 0.38 });

  const R = 1.0;
  // Marco empotrado en la pared.
  const frame = mesh(new THREE.TorusGeometry(R + 0.06, 0.09, 16, 64), darkSteel, { cast: true });
  group.add(frame);
  const recess = mesh(new THREE.CircleGeometry(R + 0.05, 64), new THREE.MeshStandardMaterial({ color: 0x0e0d0b, roughness: 1 }));
  recess.position.z = -0.02;
  group.add(recess);
  // Hoja de la puerta: disco grueso con un anillo escalonado.
  const disk = mesh(new THREE.CylinderGeometry(R - 0.02, R - 0.02, 0.16, 72), steelMat, { cast: true });
  disk.rotation.x = Math.PI / 2;
  disk.position.z = 0.05;
  group.add(disk);
  const step = mesh(new THREE.CylinderGeometry(R * 0.72, R * 0.76, 0.05, 72), steelMat);
  step.rotation.x = Math.PI / 2;
  step.position.z = 0.15;
  group.add(step);

  // Pernos alrededor del borde.
  const bolt = new THREE.CylinderGeometry(0.022, 0.026, 0.03, 10);
  const boltParts = [];
  for (let i = 0; i < 24; i += 1) {
    const a = (i / 24) * Math.PI * 2;
    boltParts.push([bolt, Math.cos(a) * (R - 0.1), Math.sin(a) * (R - 0.1), 0.14, Math.PI / 2, 0, 0]);
  }
  for (let i = 0; i < 16; i += 1) {
    const a = (i / 16) * Math.PI * 2;
    boltParts.push([bolt, Math.cos(a) * R * 0.62, Math.sin(a) * R * 0.62, 0.18, Math.PI / 2, 0, 0]);
  }
  group.add(merged(boltParts, darkSteel));

  // Bisagras.
  [-0.45, 0.45].forEach((y) => {
    const hinge = mesh(new THREE.BoxGeometry(0.22, 0.2, 0.2), darkSteel, { cast: true });
    hinge.position.set(-R - 0.02, y, 0.08);
    group.add(hinge);
    const pin = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.32, 12), brass);
    pin.position.set(-R - 0.1, y, 0.17);
    group.add(pin);
  });

  // Volante de apertura (trabado).
  const wheel = new THREE.Group();
  wheel.position.set(0, 0, 0.24);
  wheel.add(mesh(new THREE.TorusGeometry(0.26, 0.022, 12, 48), brass, { cast: true }));
  for (let i = 0; i < 3; i += 1) {
    const spoke = mesh(new THREE.BoxGeometry(0.52, 0.028, 0.028), brass);
    spoke.rotation.z = (i / 3) * Math.PI;
    wheel.add(spoke);
  }
  const hub = mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.09, 24), darkSteel);
  hub.rotation.x = Math.PI / 2;
  wheel.add(hub);
  wheel.rotation.z = 0.3;
  group.add(wheel);

  // Cadena y candado cruzando el volante.
  const chainMat = new THREE.MeshStandardMaterial({ color: 0x3b3833, metalness: 0.85, roughness: 0.5 });
  const link = new THREE.TorusGeometry(0.03, 0.008, 6, 12);
  const linkParts = [];
  for (let i = 0; i < 18; i += 1) {
    const t = i / 17;
    linkParts.push([link, -0.55 + t * 1.1, 0.18 - Math.sin(t * Math.PI) * 0.12 + (t - 0.5) * -0.3, 0.3, 0, i % 2 ? Math.PI / 2 : 0, 0.4]);
  }
  group.add(merged(linkParts, chainMat));
  const lock = mesh(new THREE.BoxGeometry(0.09, 0.11, 0.04), brass, { cast: true });
  lock.position.set(0.02, 0.02, 0.33);
  group.add(lock);

  // Ofudas en cruz sobre la hoja.
  const strip = (text, angle, len) => {
    const tex = createOfudaTexture({ text });
    const m = mesh(new THREE.PlaneGeometry(0.13, len), new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.5, roughness: 0.95, side: THREE.DoubleSide }));
    m.rotation.z = angle;
    m.position.z = 0.205;
    return m;
  };
  group.add(strip('封印封印', 0.62, 1.9), strip('禁忌禁忌', -0.62, 1.9));
  const center = strip('封', 0, 0.42);
  center.position.z = 0.21;
  center.scale.set(1.6, 1, 1);
  group.add(center);

  // Placa de advertencia.
  const plate = paperCanvas(83, 512, 160, { tint: [196, 164, 52], age: 0.6 });
  plate.ctx.fillStyle = '#17140f';
  plate.ctx.fillRect(0, 0, 512, 22);
  plate.ctx.fillRect(0, 138, 512, 22);
  plate.ctx.font = font('sans', 64, 700);
  plate.ctx.textAlign = 'center';
  plate.ctx.fillText('立入禁止', 256, 92);
  plate.ctx.font = font('mono', 20, 600);
  plate.ctx.fillText('PROHIBIDO EL PASO · NIVEL ESPECIAL', 256, 128);
  const sign = mesh(new THREE.PlaneGeometry(0.5, 0.16), new THREE.MeshStandardMaterial({ map: plate.toTexture(), roughness: 0.7, metalness: 0.3 }));
  sign.position.set(0, -0.52, 0.18);
  group.add(sign);

  return group;
}

// Caño con soportes a lo largo del techo.
function addPipe(group, material, from, to, radius) {
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const length = a.distanceTo(b);
  const pipe = mesh(new THREE.CylinderGeometry(radius, radius, length, 16), material, { cast: false });
  pipe.position.copy(a).lerp(b, 0.5);
  pipe.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  group.add(pipe);
  // Uniones cada 1,5 m.
  const joints = Math.floor(length / 1.5);
  for (let i = 1; i <= joints; i += 1) {
    const joint = mesh(new THREE.CylinderGeometry(radius * 1.35, radius * 1.35, 0.06, 16), material);
    joint.position.copy(a).lerp(b, i / (joints + 1));
    joint.quaternion.copy(pipe.quaternion);
    group.add(joint);
  }
}

// Artefacto de tubos fluorescentes: carcasa, difusor y dos tubos.
function createFixture(broken = false) {
  const group = new THREE.Group();
  const housing = mesh(new THREE.BoxGeometry(1.5, 0.07, 0.26), new THREE.MeshStandardMaterial({ color: 0xb8b3a4, roughness: 0.55, metalness: 0.4 }));
  group.add(housing);
  const tubes = [];
  [-0.06, 0.06].forEach((z, i) => {
    const dead = broken && i === 1;
    const tube = mesh(
      new THREE.CylinderGeometry(0.016, 0.016, 1.4, 12),
      new THREE.MeshStandardMaterial({ color: dead ? 0x6e6b62 : 0xf2f0e4, emissive: 0xeef0e0, emissiveIntensity: dead ? 0 : 2.2, roughness: 0.3 }),
    );
    tube.rotation.z = Math.PI / 2;
    tube.position.set(0, -0.05, z);
    group.add(tube);
    // Extremo ennegrecido de un tubo gastado.
    if (dead) {
      const end = mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.12, 12), new THREE.MeshStandardMaterial({ color: 0x1c1a16 }));
      end.rotation.z = Math.PI / 2;
      end.position.set(0.62, -0.05, z);
      group.add(end);
    } else tubes.push(tube);
  });
  // Rejilla de aluminio.
  const louver = new THREE.BoxGeometry(0.012, 0.03, 0.24);
  const parts = [];
  for (let i = 0; i < 12; i += 1) parts.push([louver, -0.66 + i * 0.12, -0.07, 0]);
  group.add(merged(parts, new THREE.MeshStandardMaterial({ color: 0xa9a598, metalness: 0.6, roughness: 0.4 })));
  return { group, tubes };
}

// Tablero de corcho con avisos y fotos: protocolo, turnos y un emblema que nadie debería ver.
function createNoticeBoard(seed) {
  const group = new THREE.Group();
  const r = rng(seed);
  const cork = paperCanvas(seed, 512, 384, { tint: [128, 92, 58], age: 0.8 });
  for (let i = 0; i < 2500; i += 1) {
    cork.ctx.fillStyle = `rgba(${40 + r() * 60},${25 + r() * 30},10,${0.2 + r() * 0.3})`;
    cork.ctx.fillRect(r() * 512, r() * 384, 2, 2);
  }
  group.add(mesh(new THREE.BoxGeometry(1.0, 0.75, 0.02), new THREE.MeshStandardMaterial({ map: cork.toTexture(), roughness: 1 })));
  const frame = new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 0.7 });
  [[0, 0.385, 1.04, 0.03], [0, -0.385, 1.04, 0.03], [-0.51, 0, 0.03, 0.8], [0.51, 0, 0.03, 0.8]].forEach(([x, y, w, h]) => {
    const f = mesh(new THREE.BoxGeometry(w, h, 0.035), frame);
    f.position.set(x, y, 0.005);
    group.add(f);
  });

  const notes = [
    {
      w: 0.3, h: 0.4, x: -0.3, y: 0.08, rot: 0.03,
      draw: (ctx, W) => {
        ctx.fillStyle = '#17140f';
        ctx.font = font('mono', 22, 600);
        ctx.fillText('PROTOCOLO DE INSPECCIÓN', 20, 40);
        ctx.font = font('mono', 16, 400);
        ['1. Retirar el objeto de su caja.', '2. Trasladarlo a la mesa B3-M1.', '3. Retirar los sellos en orden', '   inverso al de colocación.', '4. Registrar residuos y detalles.', '5. Archivar. No conversar con', '   el objeto.'].forEach((line, i) => ctx.fillText(line, 20, 84 + i * 30));
        ctx.fillStyle = '#9e1f17';
        ctx.fillRect(20, 320, W - 40, 3);
        ctx.font = font('mono', 15, 600);
        ctx.fillText('ANTE CUALQUIER ANOMALÍA: NO AVISAR', 20, 352);
        ctx.fillText('POR RADIO. SUBIR AL NIVEL 1.', 20, 376);
      },
    },
    {
      w: 0.26, h: 0.2, x: 0.18, y: 0.2, rot: -0.05,
      draw: (ctx, W) => {
        // Calendario de marzo de 2018, con el 15 marcado.
        ctx.fillStyle = '#9e1f17';
        ctx.fillRect(0, 0, W, 54);
        ctx.fillStyle = '#f0e8d8';
        ctx.font = font('mono', 30, 600);
        ctx.fillText('MARZO 2018 · 3月', 18, 38);
        ctx.fillStyle = '#17140f';
        ctx.font = font('mono', 18, 500);
        const cw = (W - 30) / 7;
        for (let d = 1; d <= 31; d += 1) {
          const idx = d + 3; // el 1 de marzo de 2018 fue jueves
          const cx = 15 + (idx % 7) * cw;
          const cy = 84 + Math.floor(idx / 7) * 34;
          ctx.fillText(String(d), cx + 8, cy);
          if (d === 15) {
            ctx.strokeStyle = '#9e1f17';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(cx + 18, cy - 6, 17, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
      },
    },
    {
      w: 0.16, h: 0.16, x: 0.36, y: -0.12, rot: 0.12,
      draw: (ctx, W, H) => {
        // Foto vieja: un emblema de tres hojas, medio tachado.
        ctx.fillStyle = '#2a2520';
        ctx.fillRect(10, 10, W - 20, H - 40);
        ctx.fillStyle = '#b9ae96';
        ctx.translate(W / 2, H / 2 - 12);
        for (let i = 0; i < 3; i += 1) {
          ctx.rotate((Math.PI * 2) / 3);
          ctx.beginPath();
          ctx.ellipse(0, -38, 20, 38, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.strokeStyle = 'rgba(20,16,12,0.85)';
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.moveTo(30, 40);
        ctx.lineTo(W - 30, H - 70);
        ctx.stroke();
        ctx.fillStyle = '#17140f';
        ctx.font = font('mono', 16, 500);
        ctx.fillText('¿B3-11?', 20, H - 14);
      },
    },
    {
      w: 0.22, h: 0.15, x: 0.08, y: -0.2, rot: 0.02,
      draw: (ctx) => {
        ctx.fillStyle = '#17140f';
        ctx.font = font('mono', 18, 600);
        ctx.fillText('TURNO NOCTURNO B3', 16, 34);
        ctx.font = font('mono', 15, 400);
        ['LUN  V. N.° 0391  (baja)', 'MAR  —', 'MIÉ  —', 'JUE  V. N.° 0417', 'VIE  —'].forEach((line, i) => ctx.fillText(line, 16, 66 + i * 24));
        ctx.strokeStyle = '#17140f';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(16, 61);
        ctx.lineTo(250, 61);
        ctx.stroke();
      },
    },
  ];
  notes.forEach((n, i) => {
    const pw = Math.round(n.w * 1400);
    const ph = Math.round(n.h * 1400);
    const paper = paperCanvas(seed + i * 13, pw, ph, { age: 0.4 + r() * 0.5 });
    n.draw(paper.ctx, pw, ph);
    const note = mesh(new THREE.PlaneGeometry(n.w, n.h), new THREE.MeshStandardMaterial({ map: paper.toTexture(), roughness: 0.95 }));
    note.position.set(n.x, n.y, 0.012 + i * 0.001);
    note.rotation.z = n.rot;
    group.add(note);
    const pin = mesh(new THREE.SphereGeometry(0.011, 10, 6), new THREE.MeshStandardMaterial({ color: i % 2 ? 0x9e1f17 : 0x2c4a7a, roughness: 0.4 }));
    pin.position.set(n.x, n.y + n.h / 2 - 0.02, 0.02);
    group.add(pin);
  });
  return group;
}

// Reloj de pared detenido a las 23:47.
function createClock() {
  const group = new THREE.Group();
  const face = paperCanvas(97, 256, 256, { tint: [228, 222, 204], age: 0.3 });
  const ctx = face.ctx;
  ctx.translate(128, 128);
  ctx.fillStyle = '#17140f';
  for (let i = 0; i < 60; i += 1) {
    const a = (i / 60) * Math.PI * 2;
    const len = i % 5 === 0 ? 16 : 6;
    ctx.save();
    ctx.rotate(a);
    ctx.fillRect(-1.5, -118, 3, len);
    ctx.restore();
  }
  ctx.font = font('mono', 22, 600);
  ctx.textAlign = 'center';
  ctx.fillText('SEIKŌ', 0, -50);
  const hand = (angle, len, width) => {
    ctx.save();
    ctx.rotate(angle);
    ctx.fillRect(-width / 2, -len, width, len + 12);
    ctx.restore();
  };
  hand(((23 % 12) + 47 / 60) / 12 * Math.PI * 2, 62, 7);
  hand((47 / 60) * Math.PI * 2, 96, 4);
  ctx.fillStyle = '#9e1f17';
  hand((12 / 60) * Math.PI * 2, 104, 2);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const faceMesh = mesh(new THREE.CircleGeometry(0.15, 48), new THREE.MeshStandardMaterial({ map: face.toTexture(), roughness: 0.6 }));
  faceMesh.position.z = 0.025;
  group.add(faceMesh);
  const rim = mesh(new THREE.TorusGeometry(0.155, 0.018, 10, 48), new THREE.MeshStandardMaterial({ color: 0x1d1b18, roughness: 0.5, metalness: 0.4 }));
  rim.position.z = 0.025;
  group.add(rim);
  const glass = mesh(new THREE.CircleGeometry(0.15, 48), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.08, roughness: 0.05, metalness: 0.2 }));
  glass.position.z = 0.04;
  group.add(glass);
  return group;
}

// Extintor rojo con su chapa.
function createExtinguisher() {
  const group = new THREE.Group();
  const red = new THREE.MeshStandardMaterial({ color: 0x8e1712, roughness: 0.35, metalness: 0.2 });
  const profile = [
    [0, 0], [0.075, 0], [0.08, 0.02], [0.08, 0.42], [0.07, 0.47], [0.04, 0.5], [0.02, 0.52], [0, 0.52],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  group.add(mesh(new THREE.LatheGeometry(profile, 32), red, { cast: true }));
  const head = mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.06, 12), new THREE.MeshStandardMaterial({ color: 0x1b1a18, metalness: 0.7, roughness: 0.4 }));
  head.position.y = 0.55;
  group.add(head);
  const hose = mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0.02, 0.55, 0.02), new THREE.Vector3(0.09, 0.45, 0.06), new THREE.Vector3(0.1, 0.25, 0.06)]), 16, 0.008, 6),
    new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 }),
  );
  group.add(hose);
  const label = paperCanvas(61, 128, 192, { tint: [232, 226, 210], age: 0.2 });
  label.ctx.fillStyle = '#17140f';
  label.ctx.font = font('sans', 34, 700);
  label.ctx.fillText('消火器', 14, 60);
  label.ctx.font = font('mono', 14, 500);
  label.ctx.fillText('ABC 3.5kg', 14, 100);
  const tag = mesh(new THREE.PlaneGeometry(0.08, 0.12), new THREE.MeshStandardMaterial({ map: label.toTexture(), roughness: 0.8 }));
  tag.position.set(0, 0.24, 0.081);
  group.add(tag);
  return group;
}

// Rejilla de ventilación con polvo.
function createVent() {
  const group = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0x3e3c36, metalness: 0.6, roughness: 0.6 });
  group.add(mesh(new THREE.BoxGeometry(0.6, 0.35, 0.03), new THREE.MeshStandardMaterial({ color: 0x0a0908, roughness: 1 })));
  const slat = new THREE.BoxGeometry(0.56, 0.012, 0.04);
  const parts = [];
  for (let i = 0; i < 10; i += 1) parts.push([slat, 0, -0.15 + i * 0.033, 0.02, -0.6, 0, 0]);
  group.add(merged(parts, metal));
  return group;
}

// Escalera de tijera junto a la estantería izquierda.
function createLadder() {
  const group = new THREE.Group();
  const alu = new THREE.MeshStandardMaterial({ color: 0x8d8a80, metalness: 0.7, roughness: 0.45 });
  const rail = new THREE.BoxGeometry(0.04, 1.6, 0.025);
  const stepG = new THREE.BoxGeometry(0.42, 0.025, 0.1);
  const parts = [];
  [-0.22, 0.22].forEach((x) => {
    parts.push([rail, x, 0.78, 0.18, -0.2, 0, 0]);
    parts.push([rail, x, 0.78, -0.18, 0.2, 0, 0]);
  });
  for (let i = 0; i < 4; i += 1) parts.push([stepG, 0, 0.35 + i * 0.36, 0.17 - i * 0.07, 0, 0, 0]);
  group.add(merged(parts, alu, { cast: true }));
  return group;
}

// Calcomanía del piso: rectángulo punteado amarillo alrededor de la mesa.
function createFloorMarking() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 640;
  const ctx = c.getContext('2d');
  ctx.strokeStyle = 'rgba(196,160,40,0.85)';
  ctx.lineWidth = 16;
  ctx.setLineDash([60, 34]);
  ctx.strokeRect(20, 20, 984, 600);
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(196,160,40,0.85)';
  ctx.font = font('mono', 34, 600);
  ctx.fillText('ÁREA DE INSPECCIÓN · 検査区域', 60, 600);
  // Desgaste de la pintura.
  for (let i = 0; i < 1400; i += 1) {
    ctx.clearRect(Math.random() * 1024, Math.random() * 640, 2 + Math.random() * 8, 2 + Math.random() * 5);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  const m = mesh(new THREE.PlaneGeometry(2.9, 1.8), new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  m.rotation.x = -Math.PI / 2;
  m.position.set(0, 0.002, 0.05);
  return m;
}

// Papeles sueltos y una rejilla de desagüe en el piso.
function addFloorClutter(group) {
  const r = rng(404);
  for (let i = 0; i < 5; i += 1) {
    const paper = paperCanvas(500 + i, 128, 180, { age: 0.8 });
    paper.ctx.fillStyle = 'rgba(23,20,15,0.6)';
    for (let l = 0; l < 9; l += 1) paper.ctx.fillRect(12, 20 + l * 16, 60 + r() * 50, 2);
    const sheet = mesh(new THREE.PlaneGeometry(0.21, 0.297), new THREE.MeshStandardMaterial({ map: paper.toTexture(), roughness: 1 }));
    sheet.rotation.set(-Math.PI / 2, 0, r() * Math.PI);
    const spots = [[-1.6, -2.6], [1.7, -2.9], [-0.9, 1.6], [3.6, -1.2], [-3.9, -1.9]];
    sheet.position.set(spots[i][0], 0.003 + i * 0.0005, spots[i][1]);
    group.add(sheet);
  }
  const drain = mesh(new THREE.CircleGeometry(0.12, 32), new THREE.MeshStandardMaterial({ color: 0x1a1916, metalness: 0.7, roughness: 0.6 }));
  drain.rotation.x = -Math.PI / 2;
  drain.position.set(-1.25, 0.003, 1.1);
  group.add(drain);
  const bar = new THREE.BoxGeometry(0.2, 0.004, 0.012);
  const bars = [];
  for (let i = 0; i < 7; i += 1) bars.push([bar, 0, 0.004, -0.09 + i * 0.03]);
  const grate = merged(bars, new THREE.MeshStandardMaterial({ color: 0x2b2924, metalness: 0.8, roughness: 0.5 }));
  grate.position.set(-1.25, 0, 1.1);
  group.add(grate);
}

export function createRoom() {
  const group = new THREE.Group();

  // Piso de baldosas vinílicas de 50 cm.
  const floorTex = floorTextures(5, { repeat: [3, 2.5], tiles: 4 });
  const floor = mesh(new THREE.PlaneGeometry(ROOM.width, ROOM.depth), new THREE.MeshStandardMaterial({ ...floorTex, color: 0xffffff, roughness: 1, bumpScale: 1.2 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = 0.5;
  group.add(floor);
  group.add(createFloorMarking());

  // Paredes de concreto: el fondo con más humedad que los laterales.
  const backTex = concreteTextures(17, { repeat: [3, 0.8] });
  const sideTex = concreteTextures(29, { repeat: [2.5, 0.8], base: [48, 45, 40] });
  const backMat = new THREE.MeshStandardMaterial({ ...backTex, color: 0xffffff, bumpScale: 2.5 });
  const sideMat = new THREE.MeshStandardMaterial({ ...sideTex, color: 0xffffff, bumpScale: 2.5 });
  const walls = [
    [ROOM.width, ROOM.height, 0, ROOM.height / 2, ROOM.back, 0, backMat],
    [ROOM.depth, ROOM.height, -ROOM.width / 2, ROOM.height / 2, 0.5, Math.PI / 2, sideMat],
    [ROOM.depth, ROOM.height, ROOM.width / 2, ROOM.height / 2, 0.5, -Math.PI / 2, sideMat],
    [ROOM.width, ROOM.height, 0, ROOM.height / 2, 5.5, Math.PI, sideMat],
  ];
  walls.forEach(([w, h, x, y, z, ry, material]) => {
    const wall = mesh(new THREE.PlaneGeometry(w, h), material);
    wall.position.set(x, y, z);
    wall.rotation.y = ry;
    group.add(wall);
  });

  // Zócalo y franja pintada a media altura (como en los pasillos del colegio).
  const trim = new THREE.MeshStandardMaterial({ color: 0x1c1915, roughness: 0.7 });
  const stripe = new THREE.MeshStandardMaterial({ color: 0x5b2a1e, roughness: 0.8 });
  const base = mesh(new THREE.BoxGeometry(ROOM.width, 0.14, 0.03), trim);
  base.position.set(0, 0.07, ROOM.back + 0.015);
  const band = mesh(new THREE.BoxGeometry(ROOM.width, 0.05, 0.01), stripe);
  band.position.set(0, 1.05, ROOM.back + 0.006);
  group.add(base, band);
  [-1, 1].forEach((side) => {
    const b = mesh(new THREE.BoxGeometry(0.03, 0.14, ROOM.depth), trim);
    b.position.set((side * ROOM.width) / 2 - side * 0.015, 0.07, 0.5);
    const s = mesh(new THREE.BoxGeometry(0.01, 0.05, ROOM.depth), stripe);
    s.position.set((side * ROOM.width) / 2 - side * 0.006, 1.05, 0.5);
    group.add(b, s);
  });

  // Cielorraso de placas manchadas.
  const ceilTex = ceilingTextures(37, { repeat: [3, 2.5] });
  const ceiling = mesh(new THREE.PlaneGeometry(ROOM.width, ROOM.depth), new THREE.MeshStandardMaterial({ ...ceilTex, roughness: 1 }));
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, ROOM.height, 0.5);
  group.add(ceiling);

  // Caños y bandeja de cables.
  const pipeTex = paintedMetalTextures(53, { color: [92, 86, 70], repeat: [1, 6] });
  const pipeMat = new THREE.MeshStandardMaterial({ ...pipeTex, color: 0xffffff, metalness: 0.6, roughness: 0.6 });
  addPipe(group, pipeMat, [-6, 2.98, ROOM.back + 0.22], [6, 2.98, ROOM.back + 0.22], 0.06);
  addPipe(group, pipeMat, [-6, 2.86, ROOM.back + 0.4], [6, 2.86, ROOM.back + 0.4], 0.04);
  addPipe(group, pipeMat, [5.7, 0, ROOM.back + 0.22], [5.7, 2.98, ROOM.back + 0.22], 0.05);
  addPipe(group, pipeMat, [-5.75, 2.9, -3.6], [-5.75, 2.9, 5], 0.045);
  const tray = mesh(new THREE.BoxGeometry(0.3, 0.05, ROOM.depth), new THREE.MeshStandardMaterial({ color: 0x4a4740, metalness: 0.6, roughness: 0.5 }));
  tray.position.set(1.6, 3.05, 0.5);
  group.add(tray);
  // Válvula roja en el caño vertical.
  const valve = new THREE.Group();
  valve.add(mesh(new THREE.TorusGeometry(0.09, 0.012, 8, 32), new THREE.MeshStandardMaterial({ color: 0x8e1712, roughness: 0.5, metalness: 0.4 })));
  for (let i = 0; i < 4; i += 1) {
    const spoke = mesh(new THREE.BoxGeometry(0.18, 0.012, 0.012), new THREE.MeshStandardMaterial({ color: 0x8e1712 }));
    spoke.rotation.z = (i * Math.PI) / 4;
    valve.add(spoke);
  }
  valve.position.set(5.7, 1.3, ROOM.back + 0.33);
  group.add(valve);

  // Puerta sellada de la bóveda entre las estanterías.
  const door = createVaultDoor();
  door.position.set(0, 1.22, ROOM.back + 0.02);
  group.add(door);
  const rope = createShimenawa(2.5, 0.16);
  rope.position.set(0, 2.42, ROOM.back + 0.2);
  group.add(rope);

  // Cartel de la bóveda.
  const signPaper = paperCanvas(23, 768, 256, { tint: [214, 203, 176], age: 0.6 });
  signPaper.ctx.fillStyle = '#17140f';
  signPaper.ctx.font = font('sans', 120, 700);
  signPaper.ctx.textAlign = 'center';
  signPaper.ctx.textBaseline = 'middle';
  signPaper.ctx.fillText('保管庫 B3', 384, 112);
  signPaper.ctx.font = font('mono', 30, 600);
  signPaper.ctx.fillText('DEPÓSITO DE OBJETOS MALDITOS · NIVEL -3', 384, 212);
  const sign = mesh(new THREE.BoxGeometry(1.2, 0.4, 0.02), [
    trim, trim, trim, trim,
    new THREE.MeshStandardMaterial({ map: signPaper.toTexture(), roughness: 0.7, metalness: 0.15 }),
    trim,
  ]);
  sign.position.set(0, 2.78, ROOM.back + 0.03);
  group.add(sign);

  // Ofudas en la pared: alrededor de la puerta y en las esquinas.
  const r = rng(909);
  [
    [-1.45, 1.9], [-1.6, 1.3], [-1.38, 0.7], [1.45, 1.85], [1.62, 1.2], [1.4, 0.55],
    [-1.25, 2.4], [1.28, 2.35], [-4.6, 2.1], [4.7, 2.2], [-4.55, 1.4], [4.6, 0.9],
  ].forEach(([x, y], i) => {
    addWallOfuda(group, x, y, ROOM.back + 0.012, { tilt: (r() - 0.5) * 0.25, scale: 0.9 + r() * 0.5, variant: i, torn: r() > 0.8 });
  });

  // Extintor y rejilla de ventilación.
  const ext = createExtinguisher();
  ext.position.set(-1.85, 0.6, ROOM.back + 0.1);
  group.add(ext);
  const extSign = paperCanvas(71, 128, 128, { tint: [150, 24, 18], age: 0.2 });
  extSign.ctx.fillStyle = '#f0e8d8';
  extSign.ctx.font = font('sans', 42, 700);
  extSign.ctx.textAlign = 'center';
  extSign.ctx.fillText('消火器', 64, 78);
  const extPlate = mesh(new THREE.PlaneGeometry(0.16, 0.16), new THREE.MeshStandardMaterial({ map: extSign.toTexture(), roughness: 0.6 }));
  extPlate.position.set(-1.85, 1.42, ROOM.back + 0.012);
  group.add(extPlate);
  const vent = createVent();
  vent.position.set(1.85, 2.5, ROOM.back + 0.02);
  group.add(vent);
  const vent2 = createVent();
  vent2.position.set(-ROOM.width / 2 + 0.02, 2.4, -1.5);
  vent2.rotation.y = Math.PI / 2;
  group.add(vent2);

  // Luz de emergencia verde sobre una salida lateral.
  const exitPaper = paperCanvas(73, 256, 96, { tint: [40, 140, 80], age: 0.1 });
  exitPaper.ctx.fillStyle = '#f2f7ee';
  exitPaper.ctx.font = font('sans', 44, 700);
  exitPaper.ctx.fillText('非常口  →', 26, 64);
  const exitSign = mesh(
    new THREE.BoxGeometry(0.02, 0.15, 0.4),
    new THREE.MeshStandardMaterial({ color: 0x1c7a45, emissive: 0x2bd36f, emissiveIntensity: 0.6, emissiveMap: exitPaper.toTexture(), map: exitPaper.toTexture() }),
  );
  exitSign.position.set(-ROOM.width / 2 + 0.03, 2.45, 1.8);
  group.add(exitSign);
  const exitDoor = mesh(new THREE.BoxGeometry(0.06, 2.1, 1.0), new THREE.MeshStandardMaterial({ ...paintedMetalTextures(79, { color: [70, 74, 70] }), color: 0xffffff, metalness: 0.5, roughness: 0.6, emissive: 0x2bd36f, emissiveIntensity: 0 }));
  exitDoor.position.set(-ROOM.width / 2 + 0.03, 1.05, 1.8);
  // La salida cierra la sesión del operador (Vault pide confirmación).
  exitDoor.userData.type = 'exit';
  group.add(exitDoor);

  // Escalera junto a la estantería izquierda.
  const ladder = createLadder();
  ladder.position.set(-1.75, 0, -3.1);
  ladder.rotation.y = 0.5;
  group.add(ladder);

  addFloorClutter(group);

  // Tubos fluorescentes: el principal (con luz) y uno al frente, medio quemado.
  const main = createFixture(false);
  main.group.position.set(0, 3.1, -1.6);
  group.add(main.group);
  const front = createFixture(true);
  front.group.position.set(0, 3.1, 1.9);
  group.add(front.group);
  const shelfFixtures = [-3.1, 3.1].map((x) => {
    const f = createFixture(false);
    f.group.position.set(x, 3.1, -2.6);
    f.group.scale.set(0.8, 1, 1);
    group.add(f.group);
    return f;
  });

  return {
    group,
    tubes: [...main.tubes, ...shelfFixtures.flatMap((f) => f.tubes)],
    flickerTubes: front.tubes,
    exitDoor,
  };
}

export { createNoticeBoard, createClock, mesh, merged };
