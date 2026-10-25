import * as THREE from 'three';
import { fingerAxisY, fingerRadius } from './finger';

const RED = '#9e1f17';
const INK = '#17140f';
const FONT = '"Zen Kaku Gothic New", "Hiragino Mincho ProN", "Noto Serif JP", serif';

// Papel según el estado: el intacto es parejo y claro; el dañado, sucio y oscurecido.
const PAPER = { Intacto: '#e8d9ab', Fisurado: '#d9c792', Dañado: '#c9b07c' };

// Generador con semilla: el mismo sello se ve igual en la mesa, en el relicario y en la
// vista previa de la planilla.
function seeded(seed) {
  let h = 2166136261;
  for (const ch of String(seed)) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function sealSeed(seal) {
  return `${seal.id}:${seal.x}:${seal.inscription}`;
}

// Recorrido irregular que cruza el papel de un borde al otro (u: a lo largo, v: a lo ancho).
function crossPath(rand, u0, short, jitter, reach = 1) {
  const points = [];
  const steps = 9;
  let u = u0;
  for (let i = 0; i <= steps; i += 1) {
    points.push([u, (i / steps) * short * reach]);
    u += (rand() - 0.5) * jitter;
  }
  return points;
}

function strokePath(ctx, points) {
  ctx.beginPath();
  points.forEach(([u, v], i) => (i ? ctx.lineTo(u, v) : ctx.moveTo(u, v)));
  ctx.stroke();
}

// Grietas finas: línea oscura con un filo claro al lado, como papel quebrado.
function drawCracks(ctx, rand, long, short, count, scale = 1) {
  for (let i = 0; i < count; i += 1) {
    const fromTop = rand() < 0.5;
    const u0 = ((i + rand() * 0.8) / count) * long;
    let path = crossPath(rand, u0, short, 18 * scale, 0.55 + rand() * 0.45);
    if (!fromTop) path = path.map(([u, v]) => [u, short - v]);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(255, 246, 220, 0.75)';
    ctx.lineWidth = 2.2 * scale;
    strokePath(ctx, path.map(([u, v]) => [u + 2 * scale, v]));
    ctx.strokeStyle = 'rgba(46, 24, 10, 0.95)';
    ctx.lineWidth = 3.4 * scale;
    strokePath(ctx, path);
    // Ramas cortas.
    const branches = 1 + Math.floor(rand() * 2);
    for (let b = 0; b < branches; b += 1) {
      const start = path[2 + Math.floor(rand() * (path.length - 4))];
      const dir = rand() < 0.5 ? -1 : 1;
      ctx.lineWidth = 2 * scale;
      strokePath(ctx, [start, [start[0] + dir * (10 + rand() * 16) * scale, start[1] + (rand() - 0.3) * 18 * scale], [start[0] + dir * (20 + rand() * 22) * scale, start[1] + (rand() - 0.2) * 24 * scale]]);
    }
  }
}

// Bordes deshilachados: muescas chicas que se comen el canto del papel.
function fray(ctx, rand, long, short, count, size) {
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < count; i += 1) {
    const u = rand() * long;
    const edge = rand() < 0.5 ? 0 : short;
    const s = size * (0.4 + rand());
    ctx.beginPath();
    ctx.moveTo(u - s, edge);
    ctx.lineTo(u + (rand() - 0.5) * s, edge + (edge ? -1 : 1) * s * (0.8 + rand()));
    ctx.lineTo(u + s, edge);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

// Desgarro quemado de lado a lado: borde chamuscado, brasa y hueco.
function drawTear(ctx, rand, u0, short, width) {
  const left = crossPath(rand, u0, short, 26);
  const right = left.map(([u, v]) => [u + width * (0.6 + rand() * 0.8), v]);
  const shape = [...left, ...right.reverse()];
  const trace = () => {
    ctx.beginPath();
    shape.forEach(([u, v], i) => (i ? ctx.lineTo(u, v) : ctx.moveTo(u, v)));
    ctx.closePath();
  };
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(28, 14, 6, 0.55)';
  ctx.lineWidth = 22;
  trace();
  ctx.stroke();
  ctx.strokeStyle = 'rgba(16, 8, 4, 0.9)';
  ctx.lineWidth = 9;
  trace();
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255, 92, 34, 0.95)';
  ctx.lineWidth = 3;
  trace();
  ctx.stroke();
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  trace();
  ctx.fill();
  ctx.restore();
}

// Pedazo que falta en un borde, con el contorno chamuscado.
function drawBite(ctx, rand, u, edge, size) {
  const points = [];
  for (let i = 0; i <= 10; i += 1) {
    const a = (i / 10) * Math.PI;
    const r = size * (0.7 + rand() * 0.5);
    points.push([u + Math.cos(a) * r, edge + (edge ? -1 : 1) * Math.sin(a) * r * 0.8]);
  }
  const trace = () => {
    ctx.beginPath();
    points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
  };
  ctx.strokeStyle = 'rgba(22, 10, 4, 0.8)';
  ctx.lineWidth = 10;
  trace();
  ctx.stroke();
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  trace();
  ctx.fill();
  ctx.restore();
}

function stains(ctx, rand, w, h, count, maxR, color) {
  for (let i = 0; i < count; i += 1) {
    const x = rand() * w;
    const y = rand() * h;
    const r = maxR * (0.3 + rand() * 0.7);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

/**
 * Papel ofuda dibujado en canvas: borde rojo, kanji en tinta y sello.
 * El estado (Intacto, Fisurado, Dañado) se ve en el papel: grietas, bordes comidos, quemaduras.
 */
export function drawOfuda({ text = '封', fresh = false, vertical = false, condition = 'Intacto', seed = Math.random() } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = vertical ? 128 : 512;
  canvas.height = vertical ? 512 : 128;
  const ctx = canvas.getContext('2d');
  const rand = seeded(seed);
  const { width: w, height: h } = canvas;
  const long = Math.max(w, h);
  const short = Math.min(w, h);
  const damaged = condition === 'Dañado';
  const cracked = condition === 'Fisurado';

  ctx.fillStyle = PAPER[condition] ?? PAPER.Intacto;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 900; i += 1) {
    ctx.fillStyle = `rgba(120, 96, 60, ${rand() * 0.08})`;
    ctx.fillRect(rand() * w, rand() * h, 1 + rand() * 3, 1);
  }
  if (cracked) stains(ctx, rand, w, h, 10, 26, 'rgba(120, 78, 30, 0.22)');
  if (damaged) stains(ctx, rand, w, h, 7, 60, 'rgba(70, 40, 14, 0.38)');

  // Borde rojo: entero si está intacto, cortado si está fisurado, casi perdido si está dañado.
  ctx.strokeStyle = damaged ? 'rgba(120, 30, 20, 0.55)' : RED;
  ctx.lineWidth = 6;
  if (condition === 'Intacto') {
    ctx.strokeRect(10, 10, w - 20, h - 20);
  } else {
    const gap = damaged ? 0.45 : 0.18;
    ctx.setLineDash(Array.from({ length: 12 }, () => (rand() < gap ? 4 + rand() * 30 : 20 + rand() * 60)));
    ctx.strokeRect(10, 10, w - 20, h - 20);
    ctx.setLineDash([]);
  }

  ctx.fillStyle = fresh ? '#0b0907' : 'rgba(23, 20, 15, 0.82)';
  if (cracked) ctx.globalAlpha = 0.8;
  if (damaged) {
    ctx.globalAlpha = 0.55;
    ctx.shadowColor = 'rgba(23, 20, 15, 0.8)';
    ctx.shadowBlur = 6;
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (vertical) {
    const chars = [...text];
    const step = (h - 80) / chars.length;
    ctx.font = `700 ${Math.min(72, step * 0.9)}px ${FONT}`;
    chars.forEach((ch, i) => ctx.fillText(ch, w / 2, 40 + step * (i + 0.5)));
  } else {
    // La banda rodea el dedo: el kanji se repite para que se vea desde cualquier ángulo.
    ctx.font = `700 76px ${FONT}`;
    const label = text.length > 1 ? '封' : text;
    [0.25, 0.75].forEach((x) => ctx.fillText(label, w * x, h / 2 + 4));
    ctx.font = `500 22px ${FONT}`;
    ctx.fillStyle = INK;
    if (text.length > 1) ctx.fillText(text, w * 0.5, h / 2);
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
  ctx.fillStyle = RED;
  ctx.fillRect(w - 46, h - 46, 26, 26);

  // El daño se dibuja a lo largo del papel (u) y a lo ancho (v), sea horizontal o vertical.
  ctx.save();
  if (vertical) ctx.setTransform(0, 1, 1, 0, 0, 0);
  if (cracked) {
    drawCracks(ctx, rand, long, short, 7);
    fray(ctx, rand, long, short, 34, 5);
  }
  if (damaged) {
    drawCracks(ctx, rand, long, short, 4);
    // Dos desgarros opuestos: se ven de cualquier lado de la banda.
    drawTear(ctx, rand, long * (0.28 + rand() * 0.06), short, 12);
    drawTear(ctx, rand, long * (0.76 + rand() * 0.06), short, 9);
    for (let i = 0; i < 4; i += 1) drawBite(ctx, rand, long * (0.1 + i * 0.24 + rand() * 0.08), i % 2 ? short : 0, 12 + rand() * 10);
    fray(ctx, rand, long, short, 40, 7);
  }
  ctx.restore();
  return canvas;
}

export function createOfudaTexture(options = {}) {
  const texture = new THREE.CanvasTexture(drawOfuda(options));
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/** Imagen del sello desplegado, para la planilla (misma semilla que en 3D). */
export function ofudaImage(seal) {
  return drawOfuda({ text: seal.inscription, fresh: seal.ink === 'fresca', condition: seal.condition, seed: sealSeed(seal) }).toDataURL('image/png');
}

// Banda de papel que envuelve el dedo en la posición x (cm).
export function createSealBand(seal, length) {
  const t = (seal.x + length / 2) / length;
  const radius = fingerRadius(t) + 0.05;
  const width = 1.15;
  const geometry = new THREE.CylinderGeometry(radius, radius * 0.98, width, 64, 1, true);
  geometry.rotateZ(Math.PI / 2);

  const material = new THREE.MeshStandardMaterial({
    map: createOfudaTexture({ text: seal.inscription, fresh: seal.ink === 'fresca', condition: seal.condition, seed: sealSeed(seal) }),
    roughness: 0.85,
    side: THREE.DoubleSide,
    transparent: true,
    // Los desgarros son agujeros reales: se ve el dedo por debajo.
    alphaTest: 0.05,
    emissive: new THREE.Color(0x9e1f17),
    emissiveIntensity: 0,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(seal.x, fingerAxisY(seal.x, length), 0);
  mesh.scale.set(1, 1, 0.86); // sigue el aplastamiento del dedo
  mesh.castShadow = true;
  mesh.name = `seal:${seal.id}`;
  mesh.userData = { sealId: seal.id, baseY: mesh.position.y, radius };
  return mesh;
}

// Ofuda plano que queda sobre la mesa después de retirarlo.
export function createLooseOfuda(seal, index) {
  const geometry = new THREE.PlaneGeometry(1.1, 4.2, 1, 12);
  const material = new THREE.MeshStandardMaterial({
    map: createOfudaTexture({ text: seal.inscription, vertical: true, fresh: seal.ink === 'fresca', condition: seal.condition, seed: sealSeed(seal) }),
    roughness: 0.9,
    side: THREE.DoubleSide,
    transparent: true,
    alphaTest: 0.05,
  });
  // Curva el papel como si conservara la forma del dedo.
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i += 1) {
    const y = position.getY(i);
    position.setZ(i, Math.cos(y * 0.6) * 0.25);
  }
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  // Se apilan a la izquierda de la bandeja, fuera del encuadre principal.
  mesh.rotation.z = 1.35 + (index % 2 ? 0.12 : -0.08);
  mesh.position.set(-10.6 + (index % 2) * 0.3, -1.5 + index * 0.012, -2.6 + index * 1.5);
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  return mesh;
}
