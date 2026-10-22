import * as THREE from 'three';

// Texturas procedurales de la bóveda: todo se dibuja en canvas al cargar la escena,
// sin imágenes externas. Cada generador acepta una semilla para que dos objetos
// del mismo tipo nunca queden iguales (manchas, rayones y desgaste distintos).

export function rng(seed = 1) {
  let a = Math.floor(seed * 9973) >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// Ruido de valor periódico (se repite sin costuras) y fbm.
function makeNoise(seed) {
  const r = rng(seed);
  const table = new Float32Array(4096);
  for (let i = 0; i < table.length; i += 1) table[i] = r();
  const lattice = (x, y, periodX, periodY) => {
    const px = ((x % periodX) + periodX) % periodX;
    const py = ((y % periodY) + periodY) % periodY;
    return table[(px * 73 + py * 151 + ((px * py) % 97)) & 4095];
  };
  const smooth = (t) => t * t * (3 - 2 * t);
  const noise = (x, y, px, py) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const u = smooth(x - xi);
    const v = smooth(y - yi);
    const a = lattice(xi, yi, px, py);
    const b = lattice(xi + 1, yi, px, py);
    const c = lattice(xi, yi + 1, px, py);
    const d = lattice(xi + 1, yi + 1, px, py);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  // u, v en [0, 1); scale = celdas por lado en la primera octava.
  return (u, v, scale = 4, octaves = 5, sx = 1, sy = 1) => {
    let sum = 0;
    let amp = 0.5;
    let norm = 0;
    let freq = scale;
    for (let o = 0; o < octaves; o += 1) {
      const fx = Math.max(1, Math.round(freq * sx));
      const fy = Math.max(1, Math.round(freq * sy));
      sum += amp * noise(u * fx, v * fy, fx, fy);
      norm += amp;
      amp *= 0.5;
      freq *= 2;
    }
    return sum / norm;
  };
}

// Campos de ruido compartidos (se calculan una sola vez y se reutilizan con desplazamientos).
const fields = {};
function field(name, size, fill) {
  if (fields[name]) return fields[name];
  const c = canvas(size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const v = Math.max(0, Math.min(255, Math.round(fill(x / size, y / size) * 255)));
      const i = (y * size + x) * 4;
      img.data[i] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  fields[name] = c;
  return c;
}

const noiseA = makeNoise(11);
const noiseB = makeNoise(47);

// Veta de madera recta (kiri / cedro): líneas verticales onduladas y fibras finas.
function grainField() {
  return field('grain', 512, (u, v) => {
    const warp = noiseA(u, v, 3, 4, 1, 1) * 1.6;
    const ring = 0.5 + 0.5 * Math.sin((u * 8 + warp) * Math.PI * 2);
    const fibers = noiseB(u, v, 48, 2, 4, 0.25);
    return 0.5 + ring ** 2 * 0.22 + fibers * 0.28;
  });
}

// Nubes suaves para manchas y variación de tono.
function cloudField() {
  return field('cloud', 512, (u, v) => noiseA(u, v, 4, 6));
}

// Poros y granos finos (concreto, papel, plástico).
function poreField() {
  return field('pore', 512, (u, v) => {
    const n = noiseB(u, v, 96, 3);
    return n > 0.68 ? 0.15 : 0.55 + noiseA(u, v, 32, 3) * 0.35;
  });
}

function tex(c, { srgb = true, repeat = [1, 1], anisotropy = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = anisotropy;
  return t;
}

// Dibuja un campo compartido con desplazamiento, como mosaico, para que cada objeto lo vea distinto.
function drawField(ctx, src, w, h, r, alpha = 1, op = 'source-over', scale = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = op;
  const ox = -r() * src.width;
  const oy = -r() * src.height;
  const sw = src.width * scale;
  const sh = src.height * scale;
  for (let x = ox; x < w; x += sw) for (let y = oy; y < h; y += sh) ctx.drawImage(src, x, y, sw, sh);
  ctx.restore();
}

function blob(ctx, x, y, radius, color, r) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
  g.addColorStop(0, color);
  g.addColorStop(1, color.replace(/[\d.]+\)$/, '0)'));
  ctx.fillStyle = g;
  ctx.beginPath();
  const n = 9;
  for (let i = 0; i <= n; i += 1) {
    const a = (i / n) * Math.PI * 2;
    const rr = radius * (0.75 + r() * 0.35);
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.fill();
}

function scratches(ctx, w, h, r, count, color, maxLen = 0.25, vertical = false) {
  ctx.save();
  ctx.strokeStyle = color;
  for (let i = 0; i < count; i += 1) {
    ctx.lineWidth = 0.5 + r() * 1.2;
    ctx.globalAlpha = 0.2 + r() * 0.5;
    let x = r() * w;
    let y = r() * h;
    const len = (0.03 + r() * maxLen) * w;
    const a = vertical ? Math.PI / 2 + (r() - 0.5) * 0.3 : r() * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    const steps = 4;
    for (let s = 0; s < steps; s += 1) {
      x += (Math.cos(a) * len) / steps + (r() - 0.5) * 2;
      y += (Math.sin(a) * len) / steps + (r() - 0.5) * 2;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

// Anillo de taza o de frasco apoyado sobre la madera.
function ring(ctx, x, y, radius, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = radius * 0.08;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0.3, Math.PI * 2 - 0.2);
  ctx.stroke();
  ctx.restore();
}

// Bordes más oscuros: el desgaste y la suciedad se juntan en las aristas.
function edgeGrime(ctx, w, h, strength = 0.35, color = '20,14,9') {
  const s = Math.min(w, h) * 0.16;
  [
    [0, 0, s, 0, 0, 0, s, h],
    [w, 0, w - s, 0, w - s, 0, s, h],
    [0, 0, 0, s, 0, 0, w, s],
    [0, h, 0, h - s, 0, h - s, w, s],
  ].forEach(([x0, y0, x1, y1, rx, ry, rw, rh]) => {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, `rgba(${color},${strength})`);
    g.addColorStop(1, `rgba(${color},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(rx, ry, rw, rh);
  });
}

/**
 * Madera de caja de reliquias (kiri-bako): clara, veta recta, manchas de té y humedad.
 * cursed = la caja tiene un dedo adentro: quemaduras rojizas cerca de la tapa.
 */
export function boxWoodTextures(seed, { tone = 0, cursed = false } = {}) {
  const r = rng(seed);
  const size = 512;
  const map = canvas(size);
  const bump = canvas(size);
  const rough = canvas(size);
  const ctx = map.getContext('2d');
  const bctx = bump.getContext('2d');
  const rctx = rough.getContext('2d');

  const hue = 28 + tone * 6 + (r() - 0.5) * 6;
  const light = 44 - tone * 9 + (r() - 0.5) * 6;
  ctx.fillStyle = `hsl(${hue}, ${30 + r() * 12}%, ${light}%)`;
  ctx.fillRect(0, 0, size, size);
  drawField(ctx, grainField(), size, size, r, 0.32, 'multiply');
  drawField(ctx, cloudField(), size, size, r, 0.3, 'multiply', 1.5);

  // Manchas: té, humedad, dedos sucios.
  const stains = 3 + Math.floor(r() * 5);
  for (let i = 0; i < stains; i += 1) {
    blob(ctx, r() * size, r() * size, 20 + r() * 90, `rgba(${50 + r() * 30},${30 + r() * 20},${15},${0.12 + r() * 0.2})`, r);
  }
  if (r() > 0.5) ring(ctx, r() * size, r() * size, 25 + r() * 30, 'rgba(45,28,14,0.25)');
  // Goteo de humedad desde arriba.
  if (r() > 0.4) {
    for (let i = 0; i < 4; i += 1) {
      const x = r() * size;
      const g = ctx.createLinearGradient(x, 0, x, size * (0.3 + r() * 0.5));
      g.addColorStop(0, 'rgba(30,20,12,0.28)');
      g.addColorStop(1, 'rgba(30,20,12,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - 3 - r() * 6, 0, 6 + r() * 10, size);
    }
  }
  scratches(ctx, size, size, r, 14 + r() * 16, 'rgba(230,205,170,0.45)', 0.16);
  scratches(ctx, size, size, r, 8, 'rgba(20,12,6,0.5)', 0.1);
  if (cursed) {
    // Chamuscado: la energía maldita quema la madera desde las juntas.
    for (let i = 0; i < 7; i += 1) {
      blob(ctx, r() * size, size * (r() * 0.18), 30 + r() * 60, `rgba(25,6,4,${0.35 + r() * 0.3})`, r);
    }
    for (let i = 0; i < 4; i += 1) blob(ctx, r() * size, size * 0.05, 12 + r() * 20, 'rgba(120,20,12,0.35)', r);
  }
  edgeGrime(ctx, size, size, 0.45 + r() * 0.2);

  // Relieve: veta + rayones hundidos.
  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, size, size);
  drawField(bctx, grainField(), size, size, r, 0.5);
  scratches(bctx, size, size, r, 20, 'rgba(0,0,0,0.7)', 0.16);

  // Rugosidad: manchas un poco más brillantes (grasa), bordes más ásperos.
  rctx.fillStyle = '#c8c8c8';
  rctx.fillRect(0, 0, size, size);
  drawField(rctx, cloudField(), size, size, r, 0.4, 'multiply');
  for (let i = 0; i < 4; i += 1) blob(rctx, r() * size, r() * size, 40 + r() * 70, 'rgba(90,90,90,0.5)', r);

  return { map: tex(map), bumpMap: tex(bump, { srgb: false }), roughnessMap: tex(rough, { srgb: false }) };
}

/** Acero pintado de estantería: pintura gris verdosa, saltaduras, óxido que chorrea. */
export function paintedMetalTextures(seed, { color = [62, 70, 62], repeat = [1, 1], slots = false } = {}) {
  const r = rng(seed);
  const size = 512;
  const map = canvas(size);
  const rough = canvas(size);
  const metal = canvas(size);
  const bump = canvas(size);
  const ctx = map.getContext('2d');
  const rctx = rough.getContext('2d');
  const mctx = metal.getContext('2d');
  const bctx = bump.getContext('2d');

  ctx.fillStyle = `rgb(${color.join(',')})`;
  ctx.fillRect(0, 0, size, size);
  drawField(ctx, cloudField(), size, size, r, 0.3, 'multiply', 0.7);
  rctx.fillStyle = '#9a9a9a';
  rctx.fillRect(0, 0, size, size);
  mctx.fillStyle = '#202020';
  mctx.fillRect(0, 0, size, size);
  bctx.fillStyle = '#909090';
  bctx.fillRect(0, 0, size, size);

  // Saltaduras de pintura: debajo queda metal oscuro u óxido.
  const chips = 40 + Math.floor(r() * 50);
  for (let i = 0; i < chips; i += 1) {
    const x = r() * size;
    const y = r() * size;
    const s = 2 + r() * 12;
    const rust = r() > 0.45;
    ctx.fillStyle = rust ? `rgba(${110 + r() * 40},${50 + r() * 20},${25},0.9)` : 'rgba(55,55,52,0.95)';
    ctx.beginPath();
    for (let k = 0; k < 7; k += 1) {
      const a = (k / 7) * Math.PI * 2;
      ctx.lineTo(x + Math.cos(a) * s * (0.5 + r()), y + Math.sin(a) * s * (0.5 + r()));
    }
    ctx.fill();
    rctx.fillStyle = rust ? '#f0f0f0' : '#555555';
    rctx.fillRect(x - s / 2, y - s / 2, s, s);
    if (!rust) {
      mctx.fillStyle = '#d0d0d0';
      mctx.fillRect(x - s / 2, y - s / 2, s, s);
    }
    bctx.fillStyle = '#5a5a5a';
    bctx.fillRect(x - s / 2, y - s / 2, s, s);
    // Chorreado de óxido hacia abajo.
    if (rust && r() > 0.55) {
      const g = ctx.createLinearGradient(x, y, x, y + 40 + r() * 120);
      g.addColorStop(0, 'rgba(120,58,24,0.55)');
      g.addColorStop(1, 'rgba(120,58,24,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - 1.5, y, 2 + r() * 3, 160);
    }
  }
  scratches(ctx, size, size, r, 40, 'rgba(150,150,140,0.5)', 0.15);
  edgeGrime(ctx, size, size, 0.25, '15,15,12');
  if (slots) {
    // Perforaciones de los parantes: ranuras cada pocos centímetros.
    for (let y = 12; y < size; y += 32) {
      [size * 0.3, size * 0.7].forEach((x) => {
        ctx.fillStyle = '#0b0a08';
        ctx.beginPath();
        ctx.roundRect(x - 9, y, 18, 20, 6);
        ctx.fill();
        bctx.fillStyle = '#000000';
        bctx.fillRect(x - 9, y, 18, 20);
        rctx.fillStyle = '#ffffff';
        rctx.fillRect(x - 9, y, 18, 20);
      });
    }
  }
  return {
    map: tex(map, { repeat }),
    roughnessMap: tex(rough, { srgb: false, repeat }),
    metalnessMap: tex(metal, { srgb: false, repeat }),
    bumpMap: tex(bump, { srgb: false, repeat }),
  };
}

/** Tablones de estante: madera oscura con polvo acumulado y marcas de cajas arrastradas. */
export function plankTextures(seed, { repeat = [1, 1] } = {}) {
  const r = rng(seed);
  const w = 1024;
  const h = 256;
  const map = canvas(w, h);
  const bump = canvas(w, h);
  const ctx = map.getContext('2d');
  const bctx = bump.getContext('2d');
  ctx.fillStyle = 'hsl(26, 28%, 22%)';
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate(Math.PI / 2);
  ctx.translate(-h / 2, -w / 2);
  drawField(ctx, grainField(), h, w, r, 0.6, 'multiply');
  ctx.restore();
  // Polvo claro.
  drawField(ctx, cloudField(), w, h, r, 0.18, 'screen', 0.8);
  // Marcas de arrastre.
  for (let i = 0; i < 8; i += 1) {
    ctx.fillStyle = `rgba(200,180,150,${0.04 + r() * 0.06})`;
    ctx.fillRect(r() * w, r() * h, 60 + r() * 200, 2 + r() * 6);
  }
  // Juntas entre tablones.
  ctx.fillStyle = 'rgba(8,5,3,0.8)';
  [h / 3, (2 * h) / 3].forEach((y) => ctx.fillRect(0, y - 1.5, w, 3));
  scratches(ctx, w, h, r, 30, 'rgba(10,6,3,0.5)', 0.1);
  edgeGrime(ctx, w, h, 0.4);
  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, w, h);
  bctx.fillStyle = '#202020';
  [h / 3, (2 * h) / 3].forEach((y) => bctx.fillRect(0, y - 2, w, 4));
  return { map: tex(map, { repeat }), bumpMap: tex(bump, { srgb: false, repeat }) };
}

/** Pared de concreto con manchas de humedad, chorreados, grietas y parches. */
export function concreteTextures(seed, { repeat = [1, 1], base = [52, 48, 42] } = {}) {
  const r = rng(seed);
  const size = 1024;
  const map = canvas(size);
  const bump = canvas(size);
  const rough = canvas(size);
  const ctx = map.getContext('2d');
  const bctx = bump.getContext('2d');
  const rctx = rough.getContext('2d');
  ctx.fillStyle = `rgb(${base.join(',')})`;
  ctx.fillRect(0, 0, size, size);
  drawField(ctx, cloudField(), size, size, r, 0.5, 'multiply', 2);
  drawField(ctx, poreField(), size, size, r, 0.35, 'multiply', 1);
  // Juntas del encofrado.
  ctx.fillStyle = 'rgba(15,12,10,0.35)';
  for (let y = size / 4; y < size; y += size / 4) ctx.fillRect(0, y, size, 2);
  // Humedad y chorreados.
  for (let i = 0; i < 9; i += 1) {
    const x = r() * size;
    const len = size * (0.2 + r() * 0.7);
    const g = ctx.createLinearGradient(x, 0, x, len);
    g.addColorStop(0, 'rgba(20,18,14,0.5)');
    g.addColorStop(1, 'rgba(20,18,14,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, 4 + r() * 22, len);
  }
  for (let i = 0; i < 6; i += 1) blob(ctx, r() * size, size * (0.6 + r() * 0.4), 80 + r() * 180, `rgba(25,22,16,${0.2 + r() * 0.2})`, r);
  // Eflorescencias (sales blancas).
  for (let i = 0; i < 4; i += 1) blob(ctx, r() * size, r() * size, 40 + r() * 90, 'rgba(170,165,150,0.12)', r);
  // Grietas: caminata aleatoria.
  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, size, size);
  drawField(bctx, poreField(), size, size, r, 0.6);
  for (let i = 0; i < 5; i += 1) {
    let x = r() * size;
    let y = r() * size;
    let a = r() * Math.PI * 2;
    ctx.strokeStyle = 'rgba(10,8,6,0.7)';
    bctx.strokeStyle = 'rgba(0,0,0,0.9)';
    ctx.lineWidth = 1.2;
    bctx.lineWidth = 2;
    ctx.beginPath();
    bctx.beginPath();
    ctx.moveTo(x, y);
    bctx.moveTo(x, y);
    const steps = 20 + r() * 40;
    for (let s = 0; s < steps; s += 1) {
      a += (r() - 0.5) * 0.9;
      x += Math.cos(a) * 8;
      y += Math.sin(a) * 8;
      ctx.lineTo(x, y);
      bctx.lineTo(x, y);
    }
    ctx.stroke();
    bctx.stroke();
  }
  rctx.fillStyle = '#e8e8e8';
  rctx.fillRect(0, 0, size, size);
  drawField(rctx, cloudField(), size, size, r, 0.25, 'multiply', 2);
  return {
    map: tex(map, { repeat }),
    bumpMap: tex(bump, { srgb: false, repeat }),
    roughnessMap: tex(rough, { srgb: false, repeat }),
  };
}

/** Piso de baldosas vinílicas gastadas, con mugre en las juntas y marcas de carros. */
export function floorTextures(seed, { repeat = [1, 1], tiles = 4 } = {}) {
  const r = rng(seed);
  const size = 1024;
  const map = canvas(size);
  const bump = canvas(size);
  const rough = canvas(size);
  const ctx = map.getContext('2d');
  const bctx = bump.getContext('2d');
  const rctx = rough.getContext('2d');
  const t = size / tiles;
  for (let i = 0; i < tiles; i += 1) {
    for (let j = 0; j < tiles; j += 1) {
      const dark = (i + j) % 2 === 0;
      const v = dark ? 38 + r() * 6 : 58 + r() * 8;
      ctx.fillStyle = `rgb(${v + 6},${v + 2},${v - 4})`;
      ctx.fillRect(i * t, j * t, t, t);
    }
  }
  drawField(ctx, cloudField(), size, size, r, 0.45, 'multiply', 2);
  drawField(ctx, poreField(), size, size, r, 0.25, 'multiply', 0.5);
  // Huellas de tránsito: el centro más gastado.
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size * 0.6);
  g.addColorStop(0, 'rgba(160,150,130,0.07)');
  g.addColorStop(1, 'rgba(160,150,130,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 10; i += 1) blob(ctx, r() * size, r() * size, 30 + r() * 120, `rgba(15,12,8,${0.15 + r() * 0.25})`, r);
  // Marcas de ruedas.
  ctx.strokeStyle = 'rgba(10,8,6,0.25)';
  for (let i = 0; i < 4; i += 1) {
    ctx.lineWidth = 3 + r() * 4;
    ctx.beginPath();
    const y = r() * size;
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(size * 0.3, y + (r() - 0.5) * 200, size * 0.7, y + (r() - 0.5) * 200, size, y + (r() - 0.5) * 80);
    ctx.stroke();
  }
  scratches(ctx, size, size, r, 60, 'rgba(120,110,95,0.4)', 0.08);
  // Juntas.
  ctx.fillStyle = 'rgba(12,10,8,0.9)';
  bctx.fillStyle = '#909090';
  bctx.fillRect(0, 0, size, size);
  drawField(bctx, poreField(), size, size, r, 0.3);
  bctx.fillStyle = '#202020';
  for (let i = 0; i <= tiles; i += 1) {
    ctx.fillRect(i * t - 2, 0, 4, size);
    ctx.fillRect(0, i * t - 2, size, 4);
    bctx.fillRect(i * t - 3, 0, 6, size);
    bctx.fillRect(0, i * t - 3, size, 6);
  }
  rctx.fillStyle = '#b0b0b0';
  rctx.fillRect(0, 0, size, size);
  drawField(rctx, cloudField(), size, size, r, 0.5, 'multiply', 2);
  return {
    map: tex(map, { repeat }),
    bumpMap: tex(bump, { srgb: false, repeat }),
    roughnessMap: tex(rough, { srgb: false, repeat }),
  };
}

/** Madera barnizada oscura (mesa y escritorio): veta, barniz gastado, anillos y quemaduras. */
export function varnishedWoodTextures(seed, { repeat = [1, 1], hue = 22, light = 20 } = {}) {
  const r = rng(seed);
  const size = 1024;
  const map = canvas(size);
  const bump = canvas(size);
  const rough = canvas(size);
  const ctx = map.getContext('2d');
  const bctx = bump.getContext('2d');
  const rctx = rough.getContext('2d');
  ctx.fillStyle = `hsl(${hue}, 38%, ${light}%)`;
  ctx.fillRect(0, 0, size, size);
  ctx.save();
  ctx.translate(size / 2, size / 2);
  ctx.rotate(Math.PI / 2);
  ctx.translate(-size / 2, -size / 2);
  drawField(ctx, grainField(), size, size, r, 0.7, 'multiply', 2);
  ctx.restore();
  drawField(ctx, cloudField(), size, size, r, 0.35, 'multiply', 2);
  // Barniz gastado: zonas más claras donde se apoyan los brazos.
  for (let i = 0; i < 3; i += 1) blob(ctx, size * (0.3 + r() * 0.4), size * (0.6 + r() * 0.3), 120 + r() * 120, 'rgba(120,85,55,0.18)', r);
  for (let i = 0; i < 5; i += 1) ring(ctx, r() * size, r() * size, 18 + r() * 26, `rgba(10,6,3,${0.3 + r() * 0.3})`);
  for (let i = 0; i < 2; i += 1) blob(ctx, r() * size, r() * size, 8 + r() * 10, 'rgba(5,3,2,0.8)', r);
  scratches(ctx, size, size, r, 120, 'rgba(160,120,80,0.45)', 0.12);
  edgeGrime(ctx, size, size, 0.5, '8,5,3');
  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, size, size);
  ctx.save();
  scratches(bctx, size, size, r, 120, 'rgba(0,0,0,0.7)', 0.12);
  ctx.restore();
  rctx.fillStyle = '#6a6a6a';
  rctx.fillRect(0, 0, size, size);
  drawField(rctx, cloudField(), size, size, r, 0.5, 'screen', 2);
  return {
    map: tex(map, { repeat }),
    bumpMap: tex(bump, { srgb: false, repeat }),
    roughnessMap: tex(rough, { srgb: false, repeat }),
  };
}

/** Plástico beige amarillento de equipos de oficina viejos. */
export function plasticTextures(seed, { base = [196, 186, 160] } = {}) {
  const r = rng(seed);
  const size = 512;
  const map = canvas(size);
  const ctx = map.getContext('2d');
  ctx.fillStyle = `rgb(${base.join(',')})`;
  ctx.fillRect(0, 0, size, size);
  drawField(ctx, cloudField(), size, size, r, 0.25, 'multiply', 1);
  drawField(ctx, poreField(), size, size, r, 0.08, 'multiply', 0.4);
  for (let i = 0; i < 5; i += 1) blob(ctx, r() * size, r() * size, 30 + r() * 80, 'rgba(120,100,50,0.12)', r);
  edgeGrime(ctx, size, size, 0.35, '60,50,30');
  scratches(ctx, size, size, r, 20, 'rgba(90,80,60,0.3)', 0.06);
  return { map: tex(map) };
}

/** Alfombra de inspección: goma verde oscura con cuadrícula en centímetros. */
export function matTexture(seed) {
  const r = rng(seed);
  const w = 1024;
  const h = 640;
  const c = canvas(w, h);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#1c2a22';
  ctx.fillRect(0, 0, w, h);
  drawField(ctx, cloudField(), w, h, r, 0.3, 'multiply', 1);
  const cm = w / 64;
  for (let x = 0; x <= w; x += cm) {
    const major = Math.round(x / cm) % 5 === 0;
    ctx.fillStyle = major ? 'rgba(200,215,190,0.35)' : 'rgba(200,215,190,0.12)';
    ctx.fillRect(x, 0, major ? 1.6 : 1, h);
  }
  for (let y = 0; y <= h; y += cm) {
    const major = Math.round(y / cm) % 5 === 0;
    ctx.fillStyle = major ? 'rgba(200,215,190,0.35)' : 'rgba(200,215,190,0.12)';
    ctx.fillRect(0, y, w, major ? 1.6 : 1);
  }
  ctx.fillStyle = 'rgba(210,220,200,0.55)';
  ctx.font = '500 13px "IBM Plex Mono", monospace';
  for (let i = 0; i <= 60; i += 5) ctx.fillText(String(i), i * cm + 3, 14);
  ctx.font = '600 15px "IBM Plex Mono", monospace';
  ctx.fillText('JUJUTSU KŌSEN · MESA B3-M1 · NO APOYAR OBJETOS SIN SELLAR', 24, h - 18);
  scratches(ctx, w, h, r, 80, 'rgba(150,170,150,0.25)', 0.08);
  for (let i = 0; i < 6; i += 1) blob(ctx, r() * w, r() * h, 20 + r() * 50, 'rgba(10,6,4,0.3)', r);
  // Mancha vieja, rojiza.
  blob(ctx, w * 0.62, h * 0.4, 36, 'rgba(70,14,10,0.35)', r);
  return tex(c);
}

/** Paneles de cielorraso con manchas de agua. */
export function ceilingTextures(seed, { repeat = [1, 1] } = {}) {
  const r = rng(seed);
  const size = 1024;
  const map = canvas(size);
  const ctx = map.getContext('2d');
  ctx.fillStyle = '#3a3630';
  ctx.fillRect(0, 0, size, size);
  drawField(ctx, poreField(), size, size, r, 0.4, 'multiply', 0.5);
  for (let i = 0; i < 5; i += 1) {
    const x = r() * size;
    const y = r() * size;
    const rad = 40 + r() * 110;
    blob(ctx, x, y, rad, 'rgba(70,50,25,0.35)', r);
    ring(ctx, x, y, rad * 0.8, 'rgba(60,40,20,0.3)');
  }
  ctx.fillStyle = '#1a1714';
  for (let i = 0; i <= 4; i += 1) {
    ctx.fillRect((i * size) / 4 - 4, 0, 8, size);
    ctx.fillRect(0, (i * size) / 4 - 4, size, 8);
  }
  return { map: tex(map, { repeat }) };
}

/** Papel viejo para notas, carteles y etiquetas. Devuelve el canvas para dibujar encima. */
export function paperCanvas(seed, w, h, { tint = [220, 210, 184], age = 0.5 } = {}) {
  const r = rng(seed);
  const c = canvas(w, h);
  const ctx = c.getContext('2d');
  ctx.fillStyle = `rgb(${tint.join(',')})`;
  ctx.fillRect(0, 0, w, h);
  drawField(ctx, cloudField(), w, h, r, 0.2 * age + 0.05, 'multiply', 0.6);
  drawField(ctx, poreField(), w, h, r, 0.06, 'multiply', 0.3);
  for (let i = 0; i < 2 + age * 4; i += 1) blob(ctx, r() * w, r() * h, Math.min(w, h) * (0.1 + r() * 0.3), `rgba(120,90,40,${0.06 + age * 0.12})`, r);
  edgeGrime(ctx, w, h, 0.15 + age * 0.25, '90,70,40');
  return { canvas: c, ctx, r, toTexture: () => tex(c, { anisotropy: 4 }) };
}

/** Halo aditivo (para brillos falsos sin postprocesado). */
export function glowTexture(color = '255,60,40') {
  const c = canvas(128);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, `rgba(${color},1)`);
  g.addColorStop(0.25, `rgba(${color},0.45)`);
  g.addColorStop(1, `rgba(${color},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
