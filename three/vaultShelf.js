import * as THREE from 'three';
import { createAuraMaterial } from './auraShader';
import { createFinger } from './finger';
import { applyFingerModel } from './fingerModel';
import { font } from './fonts';
import { createOfudaTexture } from './ofuda';
import { boxWoodTextures, glowTexture, paintedMetalTextures, paperCanvas, plankTextures, rng } from './proctex';
import { ROOM, merged, mesh } from './vaultRoom';

export const BOX = { w: 0.5, h: 0.36, d: 0.42, wall: 0.018 };

function seedOf(code) {
  return [...code].reduce((acc, ch) => acc * 31 + ch.charCodeAt(0), 7) % 100000;
}

// Etiqueta de papel con el código, el lote y un sello rojo. Los dedos llevan "特級" (grado especial).
function labelTexture(code, seed, special) {
  const paper = paperCanvas(seed, 384, 176, { tint: [222, 212, 184], age: 0.5 + (seed % 7) / 14 });
  const { ctx, r } = paper;
  ctx.strokeStyle = 'rgba(42,31,22,0.85)';
  ctx.lineWidth = 4;
  ctx.strokeRect(8, 8, 368, 160);
  ctx.fillStyle = '#17140f';
  ctx.font = font('mono', 64, 600);
  ctx.textBaseline = 'middle';
  ctx.fillText(code, 26, 70);
  ctx.font = font('mono', 18, 500);
  ctx.fillStyle = 'rgba(23,20,15,0.8)';
  ctx.fillText(special ? 'LOTE 2018-B3 · OBJ. ESPECIAL' : `REG. ${1990 + Math.floor(r() * 25)} · VARIOS`, 26, 124);
  ctx.fillText(special ? 'NO ABRIR SIN ORDEN' : `INV. ${String(Math.floor(r() * 9000) + 1000)}`, 26, 150);
  // Sello hanko.
  ctx.save();
  ctx.translate(318, 72);
  ctx.rotate((r() - 0.5) * 0.5);
  ctx.strokeStyle = special ? 'rgba(170,30,22,0.9)' : 'rgba(170,30,22,0.55)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(0, 0, 38, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = ctx.strokeStyle;
  ctx.font = font('sans', special ? 30 : 36, 700);
  ctx.textAlign = 'center';
  ctx.fillText(special ? '特級' : '済', 0, 2);
  ctx.restore();
  return paper.toTexture();
}

// Grietas incandescentes: mapa emisivo para las cajas que guardan un dedo.
function cracksTexture(seed) {
  const r = rng(seed);
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, 512, 512);
  ctx.lineCap = 'round';
  for (let i = 0; i < 9; i += 1) {
    let x = r() * 512;
    let y = r() < 0.6 ? r() * 60 : r() * 512;
    let a = Math.PI / 2 + (r() - 0.5);
    const steps = 8 + r() * 18;
    for (let s = 0; s < steps; s += 1) {
      const nx = x + Math.cos(a) * 12;
      const ny = y + Math.sin(a) * 12;
      ctx.strokeStyle = `rgba(255,${60 + r() * 50},30,${0.9 - s / steps / 1.5})`;
      ctx.lineWidth = 3.2 - (s / steps) * 2.4;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(nx, ny);
      ctx.stroke();
      x = nx;
      y = ny;
      a += (r() - 0.5) * 0.9;
    }
  }
  // Resplandor en la junta de la tapa (arriba de cada cara).
  const g = ctx.createLinearGradient(0, 0, 0, 70);
  g.addColorStop(0, 'rgba(255,80,40,0.9)');
  g.addColorStop(1, 'rgba(255,80,40,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 70);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Franja luminosa para la rendija entre la caja y la tapa.
let seamTexture = null;
function getSeamTexture() {
  if (seamTexture) return seamTexture;
  const c = document.createElement('canvas');
  c.width = 8;
  c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 64);
  g.addColorStop(0, 'rgba(255,120,80,1)');
  g.addColorStop(0.3, 'rgba(255,50,30,0.7)');
  g.addColorStop(1, 'rgba(255,30,20,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 8, 64);
  seamTexture = new THREE.CanvasTexture(c);
  seamTexture.colorSpace = THREE.SRGBColorSpace;
  return seamTexture;
}

const CORD_COLORS = [0x4b2a5a, 0x6b1d1a, 0x27324f, 0x5a4a2a, 0x3a3a3a];
const ironMaterial = new THREE.MeshStandardMaterial({ color: 0x2b2722, metalness: 0.75, roughness: 0.55 });

/**
 * Caja de reliquias (kiri-bako) con tapa a bisagra, herrajes, cordón y etiqueta.
 * Cada caja tiene su propia textura: tono, manchas, rayones y desgaste distintos.
 */
function createBox(code, content, { special = false, hidden = false } = {}) {
  const seed = seedOf(code);
  const r = rng(seed);
  const box = new THREE.Group();
  box.name = `box:${code}`;
  const body = new THREE.Group();
  box.add(body);

  const cursed = special || hidden;
  const woodTex = boxWoodTextures(seed, { tone: hidden ? 2.2 : r() * 1.4, cursed });
  const wood = new THREE.MeshStandardMaterial({
    ...woodTex,
    color: 0xffffff,
    roughness: 1,
    bumpScale: 0.9,
  });
  if (cursed) {
    wood.emissive = new THREE.Color(0xff3020);
    wood.emissiveMap = cracksTexture(seed);
    wood.emissiveIntensity = 0;
  }

  const { w, h, d, wall } = BOX;
  body.add(
    merged(
      [
        [new THREE.BoxGeometry(w, wall, d), 0, -h / 2 + wall / 2, 0],
        [new THREE.BoxGeometry(w, h, wall), 0, 0, d / 2 - wall / 2],
        [new THREE.BoxGeometry(w, h, wall), 0, 0, -d / 2 + wall / 2],
        [new THREE.BoxGeometry(wall, h, d - wall * 2), w / 2 - wall / 2, 0, 0],
        [new THREE.BoxGeometry(wall, h, d - wall * 2), -w / 2 + wall / 2, 0, 0],
      ],
      wood,
      { cast: true },
    ),
  );

  // Herrajes de hierro en las esquinas y patas cortas.
  const plate = new THREE.BoxGeometry(0.05, 0.05, 0.004);
  const side = new THREE.BoxGeometry(0.004, 0.05, 0.05);
  const fittings = [];
  [-1, 1].forEach((sx) =>
    [-1, 1].forEach((sy) => {
      const y = sy * (h / 2 - 0.025);
      fittings.push([plate, sx * (w / 2 - 0.025), y, d / 2 + 0.002]);
      fittings.push([side, sx * (w / 2 + 0.002), y, d / 2 - 0.025]);
      fittings.push([plate, sx * (w / 2 - 0.025), y, -d / 2 - 0.002]);
      fittings.push([side, sx * (w / 2 + 0.002), y, -d / 2 + 0.025]);
    }),
  );
  [-1, 1].forEach((sx) => [-1, 1].forEach((sz) => fittings.push([new THREE.BoxGeometry(0.04, 0.012, 0.04), sx * (w / 2 - 0.04), -h / 2 - 0.006, sz * (d / 2 - 0.04)])));
  // Argolla del frente.
  fittings.push([new THREE.TorusGeometry(0.018, 0.004, 6, 16), 0, h / 2 - 0.05, d / 2 + 0.006]);
  body.add(merged(fittings, ironMaterial));

  // Etiqueta pegada al frente, a veces torcida.
  const label = mesh(new THREE.PlaneGeometry(0.2, 0.092), new THREE.MeshStandardMaterial({ map: hidden ? paperCanvas(seed, 64, 32, { age: 1 }).toTexture() : labelTexture(code, seed, special), roughness: 0.95 }));
  label.position.set((r() - 0.5) * 0.04, -0.03 + (r() - 0.5) * 0.02, d / 2 + 0.0012);
  label.rotation.z = (r() - 0.5) * 0.06;
  body.add(label);

  // Paño de seda en el fondo (donde descansa el objeto).
  const cloth = new THREE.PlaneGeometry(w - wall * 2.2, d - wall * 2.2, 10, 10);
  const cpos = cloth.attributes.position;
  for (let i = 0; i < cpos.count; i += 1) cpos.setZ(i, Math.sin(cpos.getX(i) * 40 + seed) * Math.cos(cpos.getY(i) * 33) * 0.006);
  cloth.computeVertexNormals();
  const clothMesh = mesh(cloth, new THREE.MeshStandardMaterial({ color: special || hidden ? 0x3b1d48 : 0x2d2a3a, roughness: 0.45, metalness: 0.05 }));
  clothMesh.rotation.x = -Math.PI / 2;
  clothMesh.position.y = -h / 2 + wall + 0.004;
  body.add(clothMesh);

  // Tapa a bisagra, con faldón que calza sobre la caja.
  const lid = new THREE.Group();
  lid.position.set(0, h / 2, -d / 2);
  const lw = w + 0.016;
  const ld = d + 0.016;
  lid.add(
    merged(
      [
        [new THREE.BoxGeometry(lw, 0.024, ld), 0, 0.012, ld / 2 - 0.008],
        [new THREE.BoxGeometry(lw, 0.04, 0.008), 0, -0.008, ld - 0.012],
        [new THREE.BoxGeometry(lw, 0.04, 0.008), 0, -0.008, -0.004],
        [new THREE.BoxGeometry(0.008, 0.04, ld), lw / 2 - 0.004, -0.008, ld / 2 - 0.008],
        [new THREE.BoxGeometry(0.008, 0.04, ld), -lw / 2 + 0.004, -0.008, ld / 2 - 0.008],
      ],
      wood,
      { cast: true },
    ),
  );
  // Cordón (sanada-himo) cruzado sobre la tapa, con nudo.
  const cordMat = new THREE.MeshStandardMaterial({ color: hidden ? 0x121010 : CORD_COLORS[seed % CORD_COLORS.length], roughness: 0.85 });
  const cz = ld / 2 - 0.008;
  const cordParts = [
    [new THREE.BoxGeometry(lw + 0.004, 0.006, 0.014), 0, 0.027, cz],
    [new THREE.BoxGeometry(0.014, 0.006, ld + 0.004), 0, 0.027, cz],
    [new THREE.BoxGeometry(0.014, 0.044, 0.006), 0, -0.006, ld - 0.006],
    [new THREE.BoxGeometry(0.006, 0.044, 0.014), lw / 2 + 0.001, -0.006, cz],
    [new THREE.BoxGeometry(0.006, 0.044, 0.014), -lw / 2 - 0.001, -0.006, cz],
    [new THREE.TorusGeometry(0.018, 0.007, 8, 16), 0, 0.034, cz, Math.PI / 2, 0, 0],
    [new THREE.TorusGeometry(0.014, 0.006, 8, 16), 0.026, 0.032, cz + 0.01, Math.PI / 2, 0, 0.6],
    [new THREE.TorusGeometry(0.014, 0.006, 8, 16), -0.026, 0.032, cz - 0.01, Math.PI / 2, 0, -0.6],
  ];
  lid.add(merged(cordParts, cordMat));

  let ofudaMat = null;
  if (special || hidden) {
    // Ofuda que sella la tapa y baja por el frente.
    const ofuda = createOfudaTexture({ text: hidden ? '禁忌' : '封印', vertical: true });
    ofudaMat = new THREE.MeshStandardMaterial({ map: ofuda, roughness: 0.9, side: THREE.DoubleSide, emissive: 0x9e1f17, emissiveIntensity: 0 });
    const top = mesh(new THREE.PlaneGeometry(0.075, ld * 0.7), ofudaMat);
    top.rotation.x = -Math.PI / 2;
    top.position.set(0.09, 0.0255, cz);
    lid.add(top);
    const front = mesh(new THREE.PlaneGeometry(0.075, 0.05), ofudaMat);
    front.position.set(0.09, -0.004, ld - 0.0075);
    lid.add(front);
    // Tarjeta colgante con el número de expediente.
    const tagPaper = paperCanvas(seed + 3, 96, 160, { tint: [196, 170, 120], age: 0.6 });
    tagPaper.ctx.fillStyle = '#17140f';
    tagPaper.ctx.font = font('mono', 22, 600);
    tagPaper.ctx.fillText(hidden ? '—' : 'EXP', 18, 70);
    tagPaper.ctx.fillText(hidden ? '' : code.replace('B3-', '#'), 18, 104);
    tagPaper.ctx.beginPath();
    tagPaper.ctx.arc(48, 22, 8, 0, Math.PI * 2);
    tagPaper.ctx.fillStyle = '#3a2a1c';
    tagPaper.ctx.fill();
    const tag = mesh(new THREE.PlaneGeometry(0.045, 0.075), new THREE.MeshStandardMaterial({ map: tagPaper.toTexture(), roughness: 0.95, side: THREE.DoubleSide }));
    tag.position.set(-0.16, -0.06, ld - 0.002);
    tag.rotation.z = 0.12;
    lid.add(tag);
    const string = mesh(new THREE.CylinderGeometry(0.0012, 0.0012, 0.05, 4), cordMat);
    string.position.set(-0.155, -0.012, ld - 0.002);
    string.rotation.z = 0.12;
    lid.add(string);
  } else if (r() > 0.4) {
    // Ofuda viejo, descolorido.
    const faded = mesh(
      new THREE.PlaneGeometry(0.06, ld * 0.5),
      new THREE.MeshStandardMaterial({ map: createOfudaTexture({ text: '封', vertical: true }), roughness: 1, transparent: true, opacity: 0.55, side: THREE.DoubleSide }),
    );
    faded.rotation.set(-Math.PI / 2, 0, (r() - 0.5) * 0.6);
    faded.position.set((r() - 0.5) * 0.2, 0.0252, cz);
    lid.add(faded);
  }
  body.add(lid);

  // Brillo del dedo: luz interior, rendija luminosa y halo.
  let glow = null;
  if (cursed) {
    const light = new THREE.PointLight(0xff3a22, 0, 1.8, 2);
    light.position.set(0, 0.02, 0.05);
    body.add(light);
    const seamMat = new THREE.MeshBasicMaterial({
      map: getSeamTexture(),
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const seamH = 0.05;
    const seams = [
      [w + 0.01, 0, d / 2 + 0.006, 0],
      [w + 0.01, 0, -d / 2 - 0.006, Math.PI],
      [d + 0.01, w / 2 + 0.006, 0, Math.PI / 2],
      [d + 0.01, -w / 2 - 0.006, 0, -Math.PI / 2],
    ];
    seams.forEach(([len, x, z, ry]) => {
      const seam = mesh(new THREE.PlaneGeometry(len, seamH), seamMat);
      seam.position.set(x, h / 2 - seamH / 2 - 0.018, z);
      seam.rotation.y = ry;
      seam.renderOrder = 3;
      body.add(seam);
    });
    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: glowTexture('255,70,40'), color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    halo.scale.set(1.1, 0.7, 1);
    halo.position.set(0, h / 2 - 0.02, d / 2 + 0.05);
    halo.renderOrder = 4;
    body.add(halo);
    glow = { light, seamMat, halo, wood, ofuda: ofudaMat };
  }

  if (content) {
    content.position.y = -h / 2 + 0.06;
    body.add(content);
  }

  box.userData = { type: 'box', code, body, lid, open: 0, target: 0, glow };
  // Malla invisible para el raycasting: toda la caja responde al puntero.
  const hit = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ visible: false }));
  hit.userData = { type: 'box', code };
  body.add(hit);
  box.userData.hit = hit;
  return box;
}

// Objetos que no son del lote: paquetes de tela, rollos, frascos.
function createMiscContent(seed) {
  const r = rng(seed);
  const group = new THREE.Group();
  const kind = Math.floor(r() * 3);
  if (kind === 0) {
    const cloth = mesh(new THREE.SphereGeometry(0.12, 16, 10), new THREE.MeshStandardMaterial({ color: [0x5b4636, 0x3e4a3a, 0x4a3a4a][seed % 3], roughness: 1 }));
    cloth.scale.set(1.3, 0.5, 0.9);
    cloth.position.y = 0.02;
    group.add(cloth);
    const knot = mesh(new THREE.SphereGeometry(0.03, 10, 8), cloth.material);
    knot.position.set(0, 0.08, 0);
    group.add(knot);
  } else if (kind === 1) {
    const scroll = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.34, 16), new THREE.MeshStandardMaterial({ color: 0xcfc2a0, roughness: 0.9 }));
    scroll.rotation.z = Math.PI / 2;
    scroll.position.y = 0.02;
    group.add(scroll);
    [-0.18, 0.18].forEach((x) => {
      const end = mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.03, 12), new THREE.MeshStandardMaterial({ color: 0x2a1a12, roughness: 0.5 }));
      end.rotation.z = Math.PI / 2;
      end.position.set(x, 0.02, 0);
      group.add(end);
    });
  } else {
    const jar = mesh(
      new THREE.LatheGeometry([[0, 0], [0.06, 0], [0.07, 0.04], [0.065, 0.12], [0.04, 0.15], [0.042, 0.17], [0, 0.17]].map(([x, y]) => new THREE.Vector2(x, y)), 20),
      new THREE.MeshStandardMaterial({ color: 0x3e3226, roughness: 0.35, metalness: 0.1 }),
    );
    jar.position.y = -0.04;
    group.add(jar);
  }
  return group;
}

// Dedo en miniatura dentro de su caja, con aura propia.
function createBoxedFinger(caseData) {
  const group = new THREE.Group();
  const { group: finger, skin } = createFinger(caseData.length);
  group.add(finger);
  const aura = new THREE.Mesh(skin.geometry, createAuraMaterial());
  group.add(aura);
  applyFingerModel(finger, aura, caseData.length);
  group.scale.setScalar(0.022);
  group.rotation.y = 0.25;
  group.userData = { aura };
  return group;
}

// Caja de cartón de archivo (nivel inferior): cinta, marcador y abolladuras.
function createCarton(seed, w, h, d) {
  const r = rng(seed);
  const paper = paperCanvas(seed, 384, 256, { tint: [150 + r() * 20, 112 + r() * 15, 70], age: 0.8 });
  const { ctx } = paper;
  ctx.fillStyle = 'rgba(200,180,120,0.55)';
  ctx.fillRect(0, 0, 384, 26);
  ctx.fillStyle = 'rgba(20,16,12,0.85)';
  ctx.font = font('brush', 44);
  ctx.fillText(['記録 1998', '書類 03', '旧台帳', '写し'][seed % 4], 30, 140);
  ctx.font = font('mono', 22, 500);
  ctx.fillText(`ARCH-${String(seed % 997).padStart(3, '0')}`, 30, 200);
  const mat = new THREE.MeshStandardMaterial({ map: paper.toTexture(), roughness: 1 });
  const g = new THREE.BoxGeometry(w, h, d, 3, 3, 3);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i += 1) pos.setY(i, pos.getY(i) + (pos.getY(i) > 0 ? (r() - 0.5) * 0.012 : 0));
  g.computeVertexNormals();
  return mesh(g, mat, { cast: true });
}

// Hilera de biblioratos y libros de registro.
function createBinders(seed, count) {
  const r = rng(seed);
  const group = new THREE.Group();
  const coverMat = new THREE.MeshStandardMaterial({ color: 0x2a2520, roughness: 0.9 });
  const pagesMat = new THREE.MeshStandardMaterial({ color: 0xd8d0bc, roughness: 1 });
  let x = 0;
  for (let i = 0; i < count; i += 1) {
    const t = 0.05 + r() * 0.04;
    const hgt = 0.28 + r() * 0.06;
    const spine = paperCanvas(seed + i, 64, 256, { tint: [[90, 30, 26], [40, 52, 70], [70, 66, 52], [30, 30, 28]][Math.floor(r() * 4)], age: 0.7 });
    spine.ctx.fillStyle = '#d6cbb0';
    spine.ctx.fillRect(8, 30, 48, 90);
    spine.ctx.fillStyle = '#17140f';
    spine.ctx.font = font('mono', 15, 600);
    spine.ctx.save();
    spine.ctx.translate(38, 112);
    spine.ctx.rotate(-Math.PI / 2);
    spine.ctx.fillText(`${1995 + Math.floor(r() * 22)}`, 0, 0);
    spine.ctx.restore();
    const spineMat = new THREE.MeshStandardMaterial({ map: spine.toTexture(), roughness: 0.8 });
    const b = mesh(new THREE.BoxGeometry(t, hgt, 0.24), [coverMat, coverMat, pagesMat, pagesMat, spineMat, coverMat], { cast: true });
    const lean = i === count - 1 ? -0.25 : 0;
    b.position.set(x + t / 2 + (lean ? 0.06 : 0), hgt / 2 - (lean ? 0.01 : 0), 0);
    b.rotation.z = lean;
    group.add(b);
    x += t + 0.004;
  }
  return group;
}

// Rollos (makimono) apilados.
function createScrolls(seed, count) {
  const r = rng(seed);
  const group = new THREE.Group();
  const paper = new THREE.MeshStandardMaterial({ color: 0xcdbf9c, roughness: 0.9 });
  const silk = [0x4b2a5a, 0x6b1d1a, 0x27324f];
  for (let i = 0; i < count; i += 1) {
    const len = 0.32 + r() * 0.2;
    const roll = mesh(new THREE.CylinderGeometry(0.03, 0.03, len, 14), r() > 0.5 ? paper : new THREE.MeshStandardMaterial({ color: silk[i % 3], roughness: 0.6 }), { cast: true });
    roll.rotation.set(0, (r() - 0.5) * 0.4, Math.PI / 2);
    roll.position.set((r() - 0.5) * 0.08, 0.03 + (i % 2) * 0.052 + Math.floor(i / 3) * 0.05, -0.08 + (i % 3) * 0.07);
    group.add(roll);
  }
  return group;
}

// Estantería industrial de tres niveles contra la pared del fondo.
export function createShelf(side, codes, caseByBox, hiddenBox) {
  const group = new THREE.Group();
  group.name = `shelf:${side}`;
  const sideSeed = side === 'left' ? 1 : 2;
  const x = side === 'left' ? -3.1 : 3.1;
  const z = ROOM.back + 0.45;
  group.position.set(x, 0, z);

  const width = 1.8;
  const depth = 0.55;
  const levels = [0.55, 1.25, 1.95];
  const metal = paintedMetalTextures(100 + sideSeed, { color: side === 'left' ? [64, 72, 64] : [60, 66, 74], repeat: [1, 5], slots: true });
  const frameMat = new THREE.MeshStandardMaterial({ ...metal, color: 0xffffff, roughness: 1, metalness: 1, bumpScale: 1.5 });
  const lipTex = paintedMetalTextures(120 + sideSeed, { color: side === 'left' ? [64, 72, 64] : [60, 66, 74], repeat: [4, 1] });
  const lipMat = new THREE.MeshStandardMaterial({ ...lipTex, color: 0xffffff, roughness: 1, metalness: 1 });
  const plank = plankTextures(140 + sideSeed, { repeat: [1, 1] });
  const boardMat = new THREE.MeshStandardMaterial({ ...plank, color: 0xffffff, roughness: 0.95, bumpScale: 1 });

  // Parantes en L (dos chapas por esquina).
  const posts = [];
  [-1, 1].forEach((sx) =>
    [-1, 1].forEach((sz) => {
      const px = sx * (width / 2);
      const pz = sz * (depth / 2);
      posts.push([new THREE.BoxGeometry(0.05, 2.5, 0.005), px - sx * 0.025, 1.25, pz]);
      posts.push([new THREE.BoxGeometry(0.005, 2.5, 0.05), px, 1.25, pz - sz * 0.025]);
    }),
  );
  // Cruces de refuerzo atrás y a los costados.
  const diag = Math.hypot(width, 1.4);
  const angle = Math.atan2(1.4, width);
  [0.85, 2.0].forEach((cy) => {
    posts.push([new THREE.BoxGeometry(diag * 0.98, 0.025, 0.004), 0, cy, -depth / 2, 0, 0, angle]);
    posts.push([new THREE.BoxGeometry(diag * 0.98, 0.025, 0.004), 0, cy, -depth / 2, 0, 0, -angle]);
  });
  const sideDiag = Math.hypot(depth, 0.7);
  [-1, 1].forEach((sx) => {
    [0.9, 1.6, 2.25].forEach((cy, i) => {
      posts.push([new THREE.BoxGeometry(0.004, 0.02, sideDiag), sx * (width / 2), cy, 0, (i % 2 ? 1 : -1) * Math.atan2(0.7, depth), 0, 0]);
    });
  });
  // Pies con regatones.
  [-1, 1].forEach((sx) => [-1, 1].forEach((sz) => posts.push([new THREE.BoxGeometry(0.07, 0.015, 0.07), sx * (width / 2 - 0.01), 0.0075, sz * (depth / 2 - 0.01)])));
  group.add(merged(posts, frameMat, { cast: true }));

  // Niveles: tablón de madera sobre bandeja de chapa con labio al frente.
  const allLevels = [0.08, ...levels, 2.5];
  const lips = [];
  const boltParts = [];
  const bolt = new THREE.CylinderGeometry(0.007, 0.007, 0.01, 8);
  allLevels.forEach((y) => {
    const board = mesh(new THREE.BoxGeometry(width - 0.02, 0.03, depth - 0.02), boardMat, { cast: true });
    board.position.set(0, y - 0.015, 0);
    group.add(board);
    lips.push([new THREE.BoxGeometry(width, 0.045, 0.004), 0, y - 0.02, depth / 2 + 0.002]);
    lips.push([new THREE.BoxGeometry(width, 0.045, 0.004), 0, y - 0.02, -depth / 2 - 0.002]);
    [-1, 1].forEach((sx) =>
      [-1, 1].forEach((sz) => {
        boltParts.push([bolt, sx * (width / 2 - 0.012), y - 0.012, sz * (depth / 2 + 0.006), Math.PI / 2, 0, 0]);
        boltParts.push([bolt, sx * (width / 2 - 0.035), y - 0.028, sz * (depth / 2 + 0.006), Math.PI / 2, 0, 0]);
      }),
    );
  });
  group.add(merged(lips, lipMat));
  group.add(merged(boltParts, ironMaterial));

  // Portaetiquetas en el labio de cada nivel con cajas.
  levels.forEach((y, row) => {
    const rowCodes = codes.slice((2 - row) * 3, (2 - row) * 3 + 3);
    if (!rowCodes.length) return;
    const strip = paperCanvas(200 + row + sideSeed * 10, 512, 48, { tint: [228, 222, 204], age: 0.3 });
    strip.ctx.fillStyle = '#17140f';
    strip.ctx.font = font('mono', 26, 600);
    strip.ctx.fillText(`${rowCodes[0]} — ${rowCodes[rowCodes.length - 1]}`, 16, 33);
    strip.ctx.fillStyle = '#9e1f17';
    strip.ctx.fillRect(470, 10, 28, 28);
    const holder = mesh(new THREE.PlaneGeometry(0.36, 0.034), new THREE.MeshStandardMaterial({ map: strip.toTexture(), roughness: 0.6, metalness: 0.1 }));
    holder.position.set(-0.6, y - 0.02, depth / 2 + 0.005);
    group.add(holder);
  });

  // Hoja de inventario en una funda plástica, colgada del parante.
  const inv = paperCanvas(300 + sideSeed, 256, 360, { age: 0.5 });
  inv.ctx.fillStyle = '#17140f';
  inv.ctx.font = font('mono', 20, 600);
  inv.ctx.fillText(`INVENTARIO · ${side === 'left' ? 'EST. IZQ.' : 'EST. DER.'}`, 14, 34);
  inv.ctx.font = font('mono', 15, 400);
  codes.forEach((code, i) => {
    const y = 70 + i * 28;
    inv.ctx.fillStyle = 'rgba(23,20,15,0.85)';
    inv.ctx.fillText(code, 14, y);
    inv.ctx.fillText(code === hiddenBox ? '(vacío)' : caseByBox(code) ? 'LOTE 2018-B3' : 'varios', 100, y);
    inv.ctx.fillRect(14, y + 7, 228, 1);
  });
  if (codes.includes(hiddenBox)) {
    // Una línea tachada a mano.
    inv.ctx.strokeStyle = 'rgba(158,31,23,0.8)';
    inv.ctx.lineWidth = 3;
    const y = 70 + codes.indexOf(hiddenBox) * 28 - 5;
    inv.ctx.beginPath();
    inv.ctx.moveTo(10, y);
    inv.ctx.lineTo(240, y + 3);
    inv.ctx.stroke();
  }
  const sheet = mesh(new THREE.PlaneGeometry(0.15, 0.21), new THREE.MeshStandardMaterial({ map: inv.toTexture(), roughness: 0.25, metalness: 0.05 }));
  const sx = side === 'left' ? width / 2 + 0.006 : -width / 2 - 0.006;
  sheet.position.set(sx, 1.55, depth / 2 - 0.12);
  sheet.rotation.y = side === 'left' ? Math.PI / 2 : -Math.PI / 2;
  sheet.rotation.z = 0.04;
  group.add(sheet);

  // Superficie clickeable para acercarse a la estantería.
  const hit = new THREE.Mesh(new THREE.BoxGeometry(width, 2.5, 0.6), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.set(0, 1.25, 0);
  hit.userData = { type: 'shelf', side };
  group.add(hit);

  // Cajas.
  const boxes = [];
  codes.forEach((code, i) => {
    const col = i % 3;
    const row = 2 - Math.floor(i / 3);
    const px = (col - 1) * 0.58 + (rng(seedOf(code))() - 0.5) * 0.03;
    const py = levels[row] + BOX.h / 2 + 0.006;
    const caseData = caseByBox(code);
    let box;
    if (code === hiddenBox) {
      // La B3-11 figura vacía: la caja existe, pero no aparece hasta que se archivan los tres dedos.
      box = createBox(code, createBoxedFinger({ length: 11 }), { hidden: true });
      box.visible = false;
      box.userData.hidden = true;
    } else {
      box = createBox(code, caseData ? createBoxedFinger(caseData) : createMiscContent(seedOf(code)), { special: Boolean(caseData) });
    }
    box.position.set(px, py, 0);
    box.rotation.y = (rng(seedOf(code) + 1)() - 0.5) * 0.04;
    box.userData.restZ = box.position.z;
    box.userData.side = side;
    box.userData.caseId = caseData?.id ?? null;
    group.add(box);
    boxes.push(box);
  });

  // Relleno: niveles sin cajas, el piso de la estantería y el techo.
  const usedRows = new Set(codes.map((_, i) => 2 - Math.floor(i / 3)));
  levels.forEach((y, row) => {
    if (usedRows.has(row)) return;
    const binders = createBinders(400 + row + sideSeed * 7, 9);
    binders.position.set(-0.82, y, -0.05);
    group.add(binders);
    const scrolls = createScrolls(500 + row + sideSeed, 5);
    scrolls.position.set(0.55, y, 0);
    group.add(scrolls);
  });
  [-0.55, 0.05, 0.62].forEach((cx, i) => {
    const carton = createCarton(600 + i + sideSeed * 5, 0.5, 0.34 + (i % 2) * 0.06, 0.42);
    carton.position.set(cx, 0.08 + (0.34 + (i % 2) * 0.06) / 2, 0.02);
    carton.rotation.y = (i - 1) * 0.05;
    group.add(carton);
  });
  const topScrolls = createScrolls(700 + sideSeed, 6);
  topScrolls.position.set(-0.4, 2.5, 0);
  group.add(topScrolls);
  const topCarton = createCarton(720 + sideSeed, 0.45, 0.26, 0.38);
  topCarton.position.set(0.45, 2.5 + 0.13, 0);
  topCarton.rotation.y = 0.1;
  group.add(topCarton);

  // Marco punteado donde "no hay nada": la B3-11.
  const outline = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(BOX.w, BOX.h, BOX.d)),
    new THREE.LineDashedMaterial({ color: 0x6a6056, dashSize: 0.04, gapSize: 0.03 }),
  );
  const hiddenIndex = codes.indexOf(hiddenBox);
  if (hiddenIndex >= 0) {
    outline.position.set(((hiddenIndex % 3) - 1) * 0.58, levels[2 - Math.floor(hiddenIndex / 3)] + BOX.h / 2, 0);
    outline.computeLineDistances();
    outline.name = 'hidden-outline';
    group.add(outline);
    // Marca limpia en el polvo: algo estuvo apoyado ahí hace poco.
    const mark = mesh(new THREE.PlaneGeometry(BOX.w * 0.95, BOX.d * 0.9), new THREE.MeshStandardMaterial({ color: 0x1a120c, roughness: 0.7, transparent: true, opacity: 0.55 }));
    mark.rotation.x = -Math.PI / 2;
    mark.position.set(outline.position.x, levels[2 - Math.floor(hiddenIndex / 3)] + 0.002, 0);
    group.add(mark);
  }

  return { group, boxes, outline: hiddenIndex >= 0 ? outline : null };
}
