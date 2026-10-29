import * as THREE from 'three';
import { fingerAxisY, fingerRadius } from './finger';
import { font } from './fonts';

// Papel según el estado: el intacto es parejo y claro; el dañado, sucio y oscurecido.
const PAPER = { Intacto: '#e4d6b0', Fisurado: '#d6c496', Dañado: '#c4aa76' };
const INK = { fresca: 'rgba(14, 11, 8, 0.96)', seca: 'rgba(52, 38, 24, 0.8)' };

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

// Papel con fibras y manchas de humedad.
function paper(ctx, rand, w, h, condition) {
  ctx.fillStyle = PAPER[condition] ?? PAPER.Intacto;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < (w * h) / 70; i += 1) {
    ctx.fillStyle = `rgba(120, 96, 60, ${rand() * 0.08})`;
    ctx.fillRect(rand() * w, rand() * h, 1 + rand() * 3, 1);
  }
  stains(ctx, rand, w, h, 4, Math.max(w, h) * 0.12, 'rgba(150, 110, 50, 0.12)');
  if (condition === 'Fisurado') stains(ctx, rand, w, h, 10, 26, 'rgba(120, 78, 30, 0.22)');
  if (condition === 'Dañado') stains(ctx, rand, w, h, 7, 60, 'rgba(70, 40, 14, 0.38)');
}

// Daño según el estado, a lo largo del papel (long) y a lo ancho (short).
function damage(ctx, rand, long, short, condition) {
  if (condition === 'Fisurado') {
    drawCracks(ctx, rand, long, short, 7);
    fray(ctx, rand, long, short, 34, 5);
  }
  if (condition === 'Dañado') {
    drawCracks(ctx, rand, long, short, 4);
    // Dos desgarros opuestos: se ven de cualquier lado del dedo.
    drawTear(ctx, rand, long * (0.28 + rand() * 0.06), short, 12);
    drawTear(ctx, rand, long * (0.76 + rand() * 0.06), short, 9);
    for (let i = 0; i < 4; i += 1) drawBite(ctx, rand, long * (0.1 + i * 0.24 + rand() * 0.08), i % 2 ? short : 0, 12 + rand() * 10);
    fray(ctx, rand, long, short, 40, 7);
  }
}

// Símbolos de las tiras, como en el anime: trazos rectos y gruesos que parecen un circuito.
// No son kanji ni se leen; cada uno es una combinación de barras, cajas, anillos y escalones.
const PARTS = ['bar', 'bar', 'hbar', 'box', 'bracket', 'ring', 'dot', 'step', 'step'];

function makeSigil(rand) {
  const count = 4 + Math.floor(rand() * 3);
  return Array.from({ length: count }, () => ({ kind: PARTS[Math.floor(rand() * PARTS.length)], a: rand(), b: rand(), c: rand() }));
}

function drawSigil(ctx, sigil, x, y, w, h) {
  const left = x - w / 2;
  const top = y - h / 2;
  sigil.forEach(({ kind, a, b, c }) => {
    ctx.beginPath();
    if (kind === 'bar') {
      const px = left + w * (0.1 + a * 0.8);
      ctx.moveTo(px, top + h * b * 0.3);
      ctx.lineTo(px, top + h * (0.7 + c * 0.3));
    } else if (kind === 'hbar') {
      const py = top + h * (0.1 + a * 0.8);
      ctx.moveTo(left + w * b * 0.3, py);
      ctx.lineTo(left + w * (0.7 + c * 0.3), py);
    } else if (kind === 'box') {
      const bw = w * (0.25 + a * 0.3);
      const bh = h * (0.2 + b * 0.3);
      ctx.rect(left + (w - bw) * c, top + (h - bh) * a, bw, bh);
    } else if (kind === 'bracket') {
      const side = a < 0.5 ? 1 : -1;
      const px = left + w * (side > 0 ? 0.15 : 0.85);
      const py0 = top + h * 0.1;
      const py1 = top + h * 0.9;
      const reach = w * (0.3 + b * 0.3) * side;
      ctx.moveTo(px + reach, py0);
      ctx.lineTo(px, py0);
      ctx.lineTo(px, py1);
      ctx.lineTo(px + reach, py1);
    } else if (kind === 'ring') {
      ctx.arc(left + w * (0.3 + a * 0.4), top + h * (0.3 + b * 0.4), Math.min(w, h) * (0.1 + c * 0.08), 0, Math.PI * 2);
    } else if (kind === 'dot') {
      const size = Math.min(w, h) * 0.14;
      ctx.fillRect(left + w * (0.15 + a * 0.6), top + h * (0.15 + b * 0.6), size, size);
      return;
    } else {
      // Escalón: una pista que sube y dobla, como en un circuito.
      const py0 = top + h * (0.15 + a * 0.3);
      const py1 = top + h * (0.55 + b * 0.3);
      const px = left + w * (0.3 + c * 0.4);
      ctx.moveTo(left, py0);
      ctx.lineTo(px, py0);
      ctx.lineTo(px, py1);
      ctx.lineTo(left + w, py1);
    }
    ctx.stroke();
  });
}

// Una tira de papel en coordenadas locales (x a lo largo, y a lo ancho, centrada en 0).
function makeStrip(rand, length, width) {
  const cell = width * 0.56;
  const glyphs = [];
  for (let x = -length / 2 + cell; x < length / 2; x += cell * (1.08 + rand() * 0.3)) {
    glyphs.push({ x, w: cell * (0.55 + rand() * 0.35), sigil: makeSigil(rand) });
  }
  return { length, width, glyphs, tone: (rand() - 0.5) * 0.08 };
}

function drawStripShape(ctx, strip, ink, { base, shadow = true } = {}) {
  const { length, width, glyphs, tone } = strip;
  const half = width / 2;
  if (shadow) {
    // Sombra suave de la tira sobre la de abajo, solo de un lado.
    const g = ctx.createLinearGradient(0, half, 0, half + 9);
    g.addColorStop(0, 'rgba(50, 32, 14, 0.4)');
    g.addColorStop(1, 'rgba(50, 32, 14, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(-length / 2, half, length, 9);
  }
  // Cada tira es un papel aparte: tapa lo que hay abajo.
  if (base) {
    ctx.fillStyle = base;
    ctx.fillRect(-length / 2, -half, length, width);
  }
  ctx.fillStyle = tone > 0 ? `rgba(255, 250, 232, ${tone * 2.5})` : `rgba(110, 80, 40, ${-tone * 2})`;
  ctx.fillRect(-length / 2, -half, length, width);
  // Un filete fino junto a cada borde.
  ctx.strokeStyle = ink;
  ctx.lineWidth = Math.max(1.5, width * 0.022);
  [-half + width * 0.1, half - width * 0.1].forEach((y) => {
    ctx.beginPath();
    ctx.moveTo(-length / 2, y);
    ctx.lineTo(length / 2, y);
    ctx.stroke();
  });
  ctx.lineWidth = Math.max(2.5, width * 0.07);
  ctx.lineCap = 'square';
  ctx.lineJoin = 'miter';
  ctx.fillStyle = ink;
  glyphs.forEach(({ x, w, sigil }) => drawSigil(ctx, sigil, x, 0, w, width * 0.6));
  // Canto del papel.
  ctx.strokeStyle = 'rgba(70, 48, 24, 0.55)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-length / 2, half);
  ctx.lineTo(length / 2, half);
  ctx.stroke();
}

/**
 * Envoltura de un tramo del dedo: tiras de papel cruzadas en diagonal, con símbolos en tinta.
 * El ancho del canvas da la vuelta al dedo (se repite sin costura); el alto va a lo largo.
 */
export function drawWrap({ condition = 'Intacto', fresh = false, seed = Math.random(), aspect = 0.8 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = Math.round(Math.min(1024, Math.max(160, 512 * aspect)));
  const ctx = canvas.getContext('2d');
  const rand = seeded(seed);
  const { width: w, height: h } = canvas;
  const ink = fresh ? INK.fresca : INK.seca;
  paper(ctx, rand, w, h, condition);

  // Dos capas: tiras en una diagonal y, encima, algunas cruzadas en la otra.
  const base = PAPER[condition] ?? PAPER.Intacto;
  const layers = [
    { angle: -0.42 + (rand() - 0.5) * 0.1, width: 118, gap: 0.94, keep: 1 },
    { angle: 0.62 + (rand() - 0.5) * 0.1, width: 104, gap: 3.4, keep: 0.6 },
  ];
  layers.forEach(({ angle, width, gap, keep }) => {
    const reach = Math.hypot(w, h) * 1.2;
    const nx = -Math.sin(angle);
    const ny = Math.cos(angle);
    for (let d = -reach / 2; d < reach / 2; d += width * gap) {
      if (rand() > keep) continue;
      const strip = makeStrip(rand, reach * 1.4, width * (0.9 + rand() * 0.2));
      // Se dibuja tres veces, corrida una vuelta, para que no haya costura alrededor del dedo.
      [-w, 0, w].forEach((shift) => {
        ctx.save();
        ctx.translate(w / 2 + nx * d + shift, h / 2 + ny * d);
        ctx.rotate(angle);
        drawStripShape(ctx, strip, ink, { base });
        ctx.restore();
      });
    }
  });

  // Canto del tramo: más oscuro, para que se lea dónde empieza el sello siguiente.
  [0, h].forEach((edge) => {
    const g = ctx.createLinearGradient(0, edge, 0, edge ? edge - 14 : 14);
    g.addColorStop(0, 'rgba(50, 30, 12, 0.45)');
    g.addColorStop(1, 'rgba(50, 30, 12, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, edge ? edge - 14 : 0, w, 14);
  });
  damage(ctx, rand, w, h, condition);
  return canvas;
}

/** Una tira suelta, desplegada: la imagen de la planilla y el papel que queda en la mesa. */
export function drawStrip({ condition = 'Intacto', fresh = false, seed = Math.random(), vertical = false } = {}) {
  const flat = document.createElement('canvas');
  flat.width = 512;
  flat.height = 128;
  const ctx = flat.getContext('2d');
  const rand = seeded(seed);
  paper(ctx, rand, 512, 128, condition);
  ctx.save();
  ctx.translate(256, 64);
  drawStripShape(ctx, makeStrip(rand, 520, 128), fresh ? INK.fresca : INK.seca, { shadow: false });
  ctx.restore();
  damage(ctx, rand, 512, 128, condition);
  if (!vertical) return flat;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 512;
  const out = canvas.getContext('2d');
  out.translate(128, 0);
  out.rotate(Math.PI / 2);
  out.drawImage(flat, 0, 0);
  return canvas;
}

// Canto roto de un papel viejo: muescas irregulares en los cuatro lados.
function tornEdges(ctx, rand, w, h, depth) {
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  const side = (length, point) => {
    ctx.beginPath();
    let along = 0;
    point(0, 0);
    while (along < length) {
      along += 6 + rand() * 18;
      point(Math.min(along, length), rand() * depth * (rand() < 0.15 ? 2.2 : 1));
    }
    point(length, 0);
    ctx.closePath();
    ctx.fill();
  };
  side(w, (a, d) => ctx.lineTo(a, d));
  side(w, (a, d) => ctx.lineTo(a, h - d));
  side(h, (a, d) => ctx.lineTo(d, a));
  side(h, (a, d) => ctx.lineTo(w - d, a));
  ctx.restore();
}

/**
 * Ofuda de papel, como uno real: papel envejecido con el canto roto y caracteres a pincel.
 * Se usa en las tapas de las cajas, las paredes y la mesa.
 */
export function drawOfuda({ text = '封印', condition = 'Intacto', seed = Math.random(), torn = true } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const rand = seeded(seed);
  const { width: w, height: h } = canvas;
  paper(ctx, rand, w, h, condition);
  stains(ctx, rand, w, h, 6, 50, 'rgba(120, 80, 30, 0.2)');
  // Bordes tostados.
  const burn = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, h * 0.62);
  burn.addColorStop(0, 'rgba(0,0,0,0)');
  burn.addColorStop(1, 'rgba(92, 58, 22, 0.55)');
  ctx.fillStyle = burn;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = 'rgba(16, 11, 7, 0.92)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const chars = [...text];
  const step = (h - 70) / chars.length;
  ctx.font = font('brush', Math.min(84, step * 0.92), 400);
  chars.forEach((ch, i) => {
    ctx.save();
    ctx.translate(w / 2 + (rand() - 0.5) * 4, 36 + step * (i + 0.5));
    ctx.rotate((rand() - 0.5) * 0.08);
    ctx.fillText(ch, 0, 0);
    ctx.restore();
  });
  ctx.save();
  ctx.setTransform(0, 1, 1, 0, 0, 0);
  damage(ctx, rand, h, w, condition);
  ctx.restore();
  if (torn) tornEdges(ctx, rand, w, h, 7);
  return canvas;
}

function toTexture(canvas) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export function createOfudaTexture(options = {}) {
  return toTexture(drawOfuda(options));
}

/** Imagen del sello desplegado, para la planilla (misma semilla que en 3D). */
export function ofudaImage(seal) {
  return drawStrip({ fresh: seal.ink === 'fresca', condition: seal.condition, seed: sealSeed(seal) }).toDataURL('image/png');
}

// ---------------------------------------------------------------------------------------
// Envoltura del dedo. Los sellos se reparten el largo del dedo en tramos contiguos que,
// juntos, lo cubren entero. Cada tramo se retira por separado.

export const WRAP_RING = 64; // puntos alrededor del dedo
const SLANT = 0.32; // inclinación del borde entre tramos (cm): el corte va en diagonal
const OVERLAP = 0.12; // cada tramo pisa un poco al siguiente (cm)
const LAYER_GAP = 0.03; // los tramos impares van un poco más afuera para no pelearse con los pares
const STEP = 0.22; // separación entre anillos a lo largo del dedo (cm)

/** Tramo del dedo que envuelve cada sello, según el orden de los sellos a lo largo del dedo. */
export function sealSpan(seal, seals, length) {
  const sorted = [...seals].sort((a, b) => a.x - b.x);
  const i = sorted.findIndex((s) => s.id === seal.id);
  const first = i === 0;
  const last = i === sorted.length - 1;
  const x0 = first ? -length / 2 + length * 0.02 : (sorted[i - 1].x + seal.x) / 2;
  const x1 = last ? length / 2 - length * 0.012 : (seal.x + sorted[i + 1].x) / 2;
  return {
    start: { x: x0 - (first ? 0 : OVERLAP / 2), slant: first ? 0 : SLANT, phase: i * 1.7 },
    end: { x: x1 + (last ? 0 : OVERLAP / 2), slant: last ? 0 : SLANT, phase: (i + 1) * 1.7 },
    gap: (i % 2) * LAYER_GAP,
  };
}

const edgeX = (edge, angle) => edge.x + edge.slant * Math.sin(angle + edge.phase);

/**
 * Tubo de papel entre los dos bordes del tramo. sample(x, a, gap) devuelve [y, z] de la
 * superficie a lo largo x, en el punto a (0..WRAP_RING) alrededor del dedo.
 * La geometría queda centrada en su punto medio, que se devuelve para ubicar la malla.
 */
export function buildWrapGeometry(span, sample) {
  const mid = (span.start.x + span.end.x) / 2;
  const rows = Math.max(4, Math.ceil((span.end.x - span.start.x) / STEP));
  const [cy, cz] = sample(mid, -1, span.gap);
  const positions = [];
  const uvs = [];
  for (let r = 0; r <= rows; r += 1) {
    const s = r / rows;
    for (let a = 0; a <= WRAP_RING; a += 1) {
      const angle = (a / WRAP_RING) * Math.PI * 2;
      const x = edgeX(span.start, angle) * (1 - s) + edgeX(span.end, angle) * s;
      const [y, z] = sample(x, a % WRAP_RING, span.gap);
      positions.push(x - mid, y - cy, z - cz);
      uvs.push(a / WRAP_RING, 1 - s);
    }
  }
  const indices = [];
  const n = WRAP_RING + 1;
  for (let r = 0; r < rows; r += 1) {
    for (let a = 0; a < WRAP_RING; a += 1) {
      const i = r * n + a;
      indices.push(i, i + n, i + 1, i + 1, i + n, i + n + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return { geometry, center: [mid, cy, cz] };
}

// Superficie del dedo procedural: radio del perfil, un poco aplastado.
function proceduralSample(length) {
  return (x, a, gap) => {
    const t = (x + length / 2) / length;
    const axis = fingerAxisY(x, length);
    if (a < 0) return [axis, 0];
    const angle = (a / WRAP_RING) * Math.PI * 2;
    const r = fingerRadius(t) + 0.05 + gap;
    return [axis + Math.sin(angle) * r, Math.cos(angle) * r * 0.86];
  };
}

// Mismo largo del tramo que alrededor: así los símbolos no se estiran.
function wrapAspect(span, length) {
  const mid = (span.start.x + span.end.x) / 2;
  const circumference = Math.PI * 2 * (fingerRadius((mid + length / 2) / length) + 0.05) * 0.93;
  return (span.end.x - span.start.x) / Math.max(0.5, circumference);
}

/** Tramo de la envoltura del dedo que corresponde a un sello. */
export function createSealBand(seal, length, seals = [seal]) {
  const span = sealSpan(seal, seals, length);
  const { geometry, center } = buildWrapGeometry(span, proceduralSample(length));
  const material = new THREE.MeshStandardMaterial({
    map: toTexture(drawWrap({ fresh: seal.ink === 'fresca', condition: seal.condition, seed: sealSeed(seal), aspect: wrapAspect(span, length) })),
    roughness: 0.85,
    side: THREE.DoubleSide,
    transparent: true,
    // Los desgarros son agujeros reales: se ve el dedo por debajo.
    alphaTest: 0.05,
    emissive: new THREE.Color(0x9e1f17),
    emissiveIntensity: 0,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...center);
  mesh.castShadow = true;
  mesh.name = `seal:${seal.id}`;
  mesh.userData = { sealId: seal.id, baseY: center[1], span };
  return mesh;
}

// Tira que queda sobre la mesa después de retirarla, todavía curvada.
export function createLooseOfuda(seal, index) {
  const geometry = new THREE.PlaneGeometry(1.1, 4.2, 1, 12);
  const material = new THREE.MeshStandardMaterial({
    map: toTexture(drawStrip({ vertical: true, fresh: seal.ink === 'fresca', condition: seal.condition, seed: sealSeed(seal) })),
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
