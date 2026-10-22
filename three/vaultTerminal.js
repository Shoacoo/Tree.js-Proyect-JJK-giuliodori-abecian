import * as THREE from 'three';
import { font } from './fonts';
import { paintedMetalTextures, paperCanvas, plasticTextures, rng } from './proctex';
import { createClock, createNoticeBoard, merged, mesh } from './vaultRoom';

// Resolución del canvas de la pantalla (4:3, como un monitor CRT).
export const SCREEN = { width: 1024, height: 768 };

const C = {
  bg: '#0d110f',
  panel: '#141a16',
  line: 'rgba(232,224,200,0.18)',
  text: '#e8e0c8',
  dim: '#8f8a76',
  accent: '#d4452f',
  ok: '#9cc59a',
  warn: '#e0b54a',
};

export const SCREEN_TABS = [
  { id: 'session', key: 'F1', label: 'SESIÓN' },
  { id: 'lot', key: 'F2', label: 'LOTE 2018-B3' },
  { id: 'log', key: 'F3', label: 'REGISTRO' },
  { id: 'barrier', key: 'F4', label: 'BARRERA' },
  { id: 'protocol', key: 'F5', label: 'PROTOCOLO' },
];

const STATUS_LABEL = {
  pending: ['PENDIENTE', C.warn],
  archived: ['ARCHIVADO', C.ok],
  locked: ['BLOQUEADO', C.dim],
  revealed: ['SIN REGISTRO', C.accent],
};

const PERSISTENCE_LABEL = { nube: 'ARCHIVO CENTRAL', local: 'REGISTRO LOCAL', offline: 'SIN ENLACE' };

function pad(n) {
  return String(n).padStart(2, '0');
}

function button(ctx, hotspots, { x, y, w, h, label, action, hover, primary = false }) {
  const active = hover === action;
  ctx.fillStyle = primary ? (active ? '#f2ead4' : C.text) : active ? 'rgba(232,224,200,0.16)' : 'rgba(232,224,200,0.05)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = primary ? C.text : 'rgba(232,224,200,0.55)';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  ctx.fillStyle = primary ? C.bg : C.text;
  ctx.font = font('mono', 22, 600);
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + 18, y + h / 2 + 1);
  ctx.textBaseline = 'alphabetic';
  hotspots.push({ x, y, w, h, action });
}

function bar(ctx, x, y, w, value, max, color) {
  ctx.fillStyle = 'rgba(232,224,200,0.08)';
  ctx.fillRect(x, y, w, 16);
  const cells = 24;
  const filled = Math.round((Math.min(value, max) / max) * cells);
  for (let i = 0; i < cells; i += 1) {
    ctx.fillStyle = i < filled ? color : 'rgba(232,224,200,0.12)';
    ctx.fillRect(x + i * (w / cells) + 1, y + 2, w / cells - 3, 12);
  }
}

function drawSession(ctx, s, hotspots, x, y, w) {
  ctx.fillStyle = C.text;
  ctx.font = font('mono', 30, 600);
  if (!s.signedIn) {
    ctx.fillText('IDENTIFICACIÓN REQUERIDA', x, y + 40);
    ctx.font = font('mono', 20, 400);
    ctx.fillStyle = C.dim;
    ['Toda inspección del Depósito B3 queda registrada', 'a nombre del operador que la realiza.', '', 'Ingresá con tu número de Ventana para continuar.'].forEach((line, i) => ctx.fillText(line, x, y + 90 + i * 30));
    // Campo de texto con cursor.
    ctx.strokeStyle = 'rgba(232,224,200,0.6)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y + 230, w - 40, 56);
    ctx.fillStyle = C.dim;
    ctx.font = font('mono', 22, 500);
    ctx.fillText('OPERADOR:', x + 16, y + 266);
    if (s.cursor) {
      ctx.fillStyle = C.text;
      ctx.fillRect(x + 150, y + 244, 14, 28);
    }
    button(ctx, hotspots, { x, y: y + 320, w: 320, h: 60, label: '▶ IDENTIFICARSE', action: 'login', hover: s.hover, primary: true });
    ctx.fillStyle = C.dim;
    ctx.font = font('mono', 17, 400);
    ctx.fillText('Acceso anónimo, Google o correo. Se abre el formulario.', x, y + 420);
    return;
  }
  ctx.fillText('SESIÓN ACTIVA', x, y + 40);
  // Ficha del operador.
  ctx.strokeStyle = C.line;
  ctx.strokeRect(x, y + 64, w - 40, 170);
  ctx.fillStyle = 'rgba(232,224,200,0.06)';
  ctx.fillRect(x + 16, y + 80, 110, 136);
  ctx.fillStyle = C.dim;
  ctx.font = font('sans', 64, 700);
  ctx.fillText('窓', x + 38, y + 170);
  ctx.fillStyle = C.text;
  ctx.font = font('mono', 26, 600);
  ctx.fillText(String(s.operator ?? 'Operador').toUpperCase().slice(0, 22), x + 150, y + 112);
  ctx.font = font('mono', 19, 400);
  ctx.fillStyle = C.dim;
  ['Ventana · personal de apoyo · sin técnica', 'Asignación: OM-2018-0311', `Enlace: ${PERSISTENCE_LABEL[s.persistence] ?? '—'}`].forEach((line, i) => ctx.fillText(line, x + 150, y + 148 + i * 28));
  const archived = s.cases.filter((c) => c.status === 'archived').length;
  ctx.fillStyle = C.text;
  ctx.font = font('mono', 20, 500);
  ctx.fillText(`Expedientes archivados: ${archived} / ${s.cases.length}`, x, y + 280);
  ctx.fillText(`Detalles registrados:   ${s.memory} / ${s.memoryTotal}`, x, y + 312);
  button(ctx, hotspots, { x, y: y + 350, w: 330, h: 60, label: '▶ ABRIR ÍNDICE', action: 'index', hover: s.hover, primary: true });
  button(ctx, hotspots, { x: x + 350, y: y + 350, w: 300, h: 60, label: 'CAMBIAR OPERADOR', action: 'login', hover: s.hover });
}

function drawLot(ctx, s, hotspots, x, y, w) {
  ctx.fillStyle = C.text;
  ctx.font = font('mono', 26, 600);
  ctx.fillText('LOTE 2018-B3 · CONTROL DE INTEGRIDAD', x, y + 34);
  ctx.fillStyle = C.dim;
  ctx.font = font('mono', 17, 400);
  ctx.fillText('ORDEN DE MANTENIMIENTO OM-2018-0311 · 3 OBJETOS DE GRADO ESPECIAL', x, y + 62);
  const cols = [0, 120, 410, 510, 600];
  const head = ['EXP', 'ORIGEN', 'CAJA', 'SELLOS', 'ESTADO'];
  const top = y + 92;
  ctx.fillStyle = 'rgba(232,224,200,0.1)';
  ctx.fillRect(x, top, w - 20, 34);
  ctx.fillStyle = C.dim;
  ctx.font = font('mono', 16, 600);
  head.forEach((hd, i) => ctx.fillText(hd, x + 12 + cols[i], top + 23));
  const rows = [
    ...s.cases.map((c) => ({ ...c, action: s.signedIn && c.status !== 'locked' ? `case:${c.id}` : null })),
    {
      id: '00',
      code: s.hiddenStatus === 'revealed' ? 'EXP-00' : '———',
      place: s.hiddenStatus === 'revealed' ? 'sin origen registrado' : 'caja sin uso',
      box: 'B3-11',
      seals: s.hiddenStatus === 'revealed' ? 0 : '—',
      status: s.hiddenStatus === 'revealed' ? 'revealed' : null,
      action: s.signedIn && s.hiddenStatus === 'revealed' ? 'case:00' : null,
    },
  ];
  rows.forEach((row, i) => {
    const ry = top + 40 + i * 62;
    const hover = row.action && s.hover === row.action;
    if (hover) {
      ctx.fillStyle = 'rgba(232,224,200,0.14)';
      ctx.fillRect(x, ry, w - 20, 56);
    }
    ctx.strokeStyle = C.line;
    ctx.beginPath();
    ctx.moveTo(x, ry + 58);
    ctx.lineTo(x + w - 20, ry + 58);
    ctx.stroke();
    const muted = row.status === 'locked' || !row.status;
    ctx.fillStyle = muted ? C.dim : C.text;
    ctx.font = font('mono', 21, 600);
    ctx.fillText(row.code, x + 12 + cols[0], ry + 36);
    ctx.font = font('mono', 17, 400);
    ctx.fillText(String(row.place).split(',')[0].slice(0, 26), x + 12 + cols[1], ry + 36);
    ctx.fillText(row.box, x + 12 + cols[2], ry + 36);
    ctx.fillText(String(row.seals), x + 12 + cols[3], ry + 36);
    const [label, color] = STATUS_LABEL[row.status] ?? ['VACÍA', C.dim];
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 12 + cols[4], ry + 14, 150, 30);
    ctx.font = font('mono', 15, 600);
    ctx.fillText(label, x + 24 + cols[4], ry + 35);
    if (row.action) hotspots.push({ x, y: ry, w: w - 20, h: 56, action: row.action });
  });
  ctx.fillStyle = C.dim;
  ctx.font = font('mono', 17, 400);
  ctx.fillText(s.signedIn ? 'Click en un expediente habilitado para abrirlo.' : 'Identificate para abrir los expedientes.', x, top + 40 + rows.length * 62 + 36);
}

function drawLog(ctx, s, x, y, w) {
  ctx.fillStyle = C.text;
  ctx.font = font('mono', 26, 600);
  ctx.fillText('REGISTRO DE ACTIVIDAD', x, y + 34);
  const entries = s.log.slice(-11).reverse();
  ctx.font = font('mono', 18, 400);
  if (!entries.length) {
    ctx.fillStyle = C.dim;
    ctx.fillText('Sin actividad registrada en esta inspección.', x, y + 84);
  }
  entries.forEach((entry, i) => {
    const ly = y + 80 + i * 40;
    ctx.fillStyle = C.dim;
    ctx.fillText(String(entry.at ?? '').slice(0, 16), x, ly);
    ctx.fillStyle = /arrancado|fuera de orden/.test(entry.text) ? C.accent : C.text;
    ctx.fillText(String(entry.text).slice(0, 44), x + 200, ly);
    ctx.strokeStyle = C.line;
    ctx.beginPath();
    ctx.moveTo(x, ly + 14);
    ctx.lineTo(x + w - 20, ly + 14);
    ctx.stroke();
  });
  // La orden de mantenimiento, siempre arriba de todo (por ahora).
  ctx.fillStyle = C.dim;
  ctx.font = font('mono', 16, 400);
  ctx.fillText('15/03 23:31  OM-2018-0311 emitida por: [superior, sin firma]', x, y + 540);
}

function drawBarrier(ctx, s, x, y, w) {
  const stress = Math.min(1, s.leak / 8 + s.influence / 4);
  ctx.fillStyle = C.text;
  ctx.font = font('mono', 26, 600);
  ctx.fillText('BARRERA DEL DEPÓSITO · MONITOR', x, y + 34);
  ctx.fillStyle = stress > 0.6 ? C.accent : stress > 0.3 ? C.warn : C.ok;
  ctx.font = font('mono', 20, 600);
  ctx.fillText(stress > 0.6 ? '■ INESTABLE' : stress > 0.3 ? '■ FLUCTUANTE' : '■ ESTABLE', x, y + 70);
  // Osciloscopio.
  const ox = x;
  const oy = y + 90;
  const ow = w - 20;
  const oh = 200;
  ctx.strokeStyle = C.line;
  ctx.strokeRect(ox, oy, ow, oh);
  for (let i = 1; i < 8; i += 1) {
    ctx.beginPath();
    ctx.moveTo(ox + (ow / 8) * i, oy);
    ctx.lineTo(ox + (ow / 8) * i, oy + oh);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(ox, oy + oh / 2);
  ctx.lineTo(ox + ow, oy + oh / 2);
  ctx.stroke();
  ctx.strokeStyle = stress > 0.6 ? C.accent : C.ok;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  const r = rng(Math.floor(s.time * 8));
  for (let px = 0; px <= ow; px += 4) {
    const t = px / ow;
    const v =
      Math.sin(t * 18 + s.time * 3) * 0.35 +
      Math.sin(t * 47 - s.time * 5) * 0.12 * (1 + stress * 3) +
      (r() - 0.5) * stress * 0.9;
    const py = oy + oh / 2 - v * (oh / 2.6);
    if (px === 0) ctx.moveTo(ox + px, py);
    else ctx.lineTo(ox + px, py);
  }
  ctx.stroke();
  ctx.lineWidth = 1;
  const rows = [
    ['RESIDUO EN BÓVEDA', s.leak, 10, s.leak > 3 ? C.accent : C.warn],
    ['INFLUENCIA', s.influence, 3, C.accent],
    ['DETALLES REGISTRADOS', s.memory, s.memoryTotal, C.ok],
  ];
  rows.forEach(([label, value, max, color], i) => {
    const ry = y + 330 + i * 62;
    ctx.fillStyle = C.dim;
    ctx.font = font('mono', 17, 600);
    ctx.fillText(label, x, ry);
    ctx.fillStyle = C.text;
    ctx.fillText(`${value} / ${max}`, x + w - 130, ry);
    bar(ctx, x, ry + 12, w - 20, value, max, color);
  });
}

function drawProtocol(ctx, x, y) {
  ctx.fillStyle = C.text;
  ctx.font = font('mono', 26, 600);
  ctx.fillText('PROTOCOLO DE INSPECCIÓN', x, y + 34);
  ctx.font = font('mono', 19, 400);
  [
    '1. Ubicar la caja del objeto en las estanterías.',
    '2. Trasladar el objeto a la mesa B3-M1.',
    '3. Retirar los sellos en orden inverso al de',
    '   su colocación. No arrancarlos.',
    '4. Registrar residuos y detalles observados.',
    '5. Archivar el expediente antes de pasar al',
    '   siguiente objeto del lote.',
  ].forEach((line, i) => {
    ctx.fillStyle = C.text;
    ctx.fillText(line, x, y + 84 + i * 34);
  });
  ctx.fillStyle = C.accent;
  ctx.font = font('mono', 18, 600);
  ctx.fillText('No dirigirle la palabra al objeto.', x, y + 360);
  ctx.fillStyle = C.dim;
  ctx.font = font('mono', 17, 400);
  ctx.fillText('Nota: la caja B3-11 figura vacía en el sistema.', x, y + 400);
}

/**
 * Interfaz de la terminal B3-T02. Se dibuja en canvas y vuelve con las zonas clickeables
 * (hotspots) en coordenadas del canvas, para el raycasting sobre la pantalla.
 */
export function drawTerminalScreen(ctx, w, h, s) {
  const hotspots = [];
  ctx.save();
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, w, h);

  // Encabezado.
  ctx.fillStyle = C.text;
  ctx.fillRect(0, 0, w, 64);
  ctx.fillStyle = C.bg;
  ctx.beginPath();
  ctx.arc(36, 32, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = C.text;
  ctx.font = font('sans', 22, 700);
  ctx.textAlign = 'center';
  ctx.fillText('呪', 36, 40);
  ctx.textAlign = 'left';
  ctx.fillStyle = C.bg;
  ctx.font = font('sans', 24, 700);
  ctx.fillText('呪術高専', 70, 41);
  ctx.font = font('mono', 17, 600);
  ctx.fillText('SISTEMA DE CUSTODIA · DEPÓSITO B3', 180, 39);
  const seconds = Math.floor(s.time) % 60;
  const minutes = 47 + Math.floor(s.time / 60);
  ctx.textAlign = 'right';
  ctx.font = font('mono', 20, 600);
  ctx.fillText(`JUE 15/03/2018 23:${pad(minutes % 60)}:${pad(seconds)}`, w - 24, 40);
  ctx.textAlign = 'left';

  // Línea de estado.
  ctx.fillStyle = C.panel;
  ctx.fillRect(0, 64, w, 36);
  ctx.font = font('mono', 16, 500);
  ctx.fillStyle = C.dim;
  ctx.fillText('OPERADOR', 20, 88);
  ctx.fillStyle = s.signedIn ? C.text : C.accent;
  ctx.fillText(s.signedIn ? String(s.operator ?? '').toUpperCase().slice(0, 18) : 'SIN SESIÓN', 112, 88);
  ctx.fillStyle = C.dim;
  ctx.fillText('ENLACE', 380, 88);
  ctx.fillStyle = s.persistence === 'offline' ? C.accent : C.text;
  ctx.fillText(PERSISTENCE_LABEL[s.persistence] ?? '—', 450, 88);
  ctx.fillStyle = C.dim;
  ctx.fillText('TERMINAL B3-T02', w - 180, 88);

  // Menú lateral.
  const tab = s.tab;
  SCREEN_TABS.forEach((item, i) => {
    const y = 120 + i * 70;
    const action = `tab:${item.id}`;
    const selected = tab === item.id;
    const hover = s.hover === action;
    ctx.fillStyle = selected ? C.text : hover ? 'rgba(232,224,200,0.14)' : 'rgba(232,224,200,0.04)';
    ctx.fillRect(16, y, 236, 58);
    ctx.fillStyle = selected ? C.bg : C.dim;
    ctx.font = font('mono', 15, 600);
    ctx.fillText(item.key, 30, y + 35);
    ctx.fillStyle = selected ? C.bg : C.text;
    ctx.font = font('mono', 19, 600);
    ctx.fillText(item.label, 72, y + 36);
    hotspots.push({ x: 16, y, w: 236, h: 58, action });
  });
  button(ctx, hotspots, {
    x: 16,
    y: 500,
    w: 236,
    h: 64,
    label: s.signedIn ? '▶ ÍNDICE' : '▶ IDENTIFICARSE',
    action: s.signedIn ? 'index' : 'login',
    hover: s.hover,
    primary: true,
  });
  ctx.fillStyle = C.dim;
  ctx.font = font('mono', 14, 400);
  ['Lote 2018-B3', 'Nivel -3 · Sala de', 'Catalogación'].forEach((line, i) => ctx.fillText(line, 20, 610 + i * 22));

  // Separador vertical.
  ctx.fillStyle = C.line;
  ctx.fillRect(268, 112, 2, 580);

  // Panel principal.
  const px = 292;
  const py = 112;
  const pw = w - px - 16;
  if (tab === 'session') drawSession(ctx, s, hotspots, px, py, pw);
  else if (tab === 'lot') drawLot(ctx, s, hotspots, px, py, pw);
  else if (tab === 'log') drawLog(ctx, s, px, py, pw);
  else if (tab === 'barrier') drawBarrier(ctx, s, px, py, pw);
  else drawProtocol(ctx, px, py);

  // Línea de comandos.
  ctx.fillStyle = C.panel;
  ctx.fillRect(0, h - 64, w, 64);
  ctx.fillStyle = C.ok;
  ctx.font = font('mono', 20, 500);
  const command = { session: s.signedIn ? 'whoami' : 'login', lot: 'lote --listar 2018-B3', log: 'registro --ultimos', barrier: 'barrera --monitor', protocol: 'man inspeccion' }[tab] ?? '';
  const prompt = `B3-T02> ${command}`;
  ctx.fillText(prompt, 20, h - 26);
  if (s.cursor) ctx.fillRect(28 + ctx.measureText(prompt).width, h - 46, 12, 24);
  ctx.fillStyle = C.dim;
  ctx.font = font('mono', 15, 400);
  ctx.textAlign = 'right';
  ctx.fillText('CLICK EN EL MENÚ · TODA SESIÓN QUEDA REGISTRADA', w - 20, h - 28);
  ctx.textAlign = 'left';

  // Influencia: la pantalla también se corrompe.
  if (s.influence >= 1) {
    const r = rng(Math.floor(s.time * 4) + 1);
    const slices = s.influence * 2;
    for (let i = 0; i < slices; i += 1) {
      if (r() > 0.55) continue;
      const sy = Math.floor(r() * h);
      const sh = 6 + Math.floor(r() * 26);
      ctx.drawImage(ctx.canvas, 0, sy, w, sh, (r() - 0.5) * 30 * s.influence, sy, w, sh);
    }
    if (s.influence >= 2) {
      ctx.fillStyle = 'rgba(212,69,47,0.85)';
      ctx.font = font('brush', 44);
      ctx.fillText(s.influence >= 3 ? 'ya son tuyos' : 'ya casi', w - 300, h - 110);
    }
  }

  // Barrido, viñeta y una franja de refresco que baja: aspecto de tubo.
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);
  const band = ((s.time * 0.18) % 1) * (h + 200) - 100;
  const bandGrad = ctx.createLinearGradient(0, band - 80, 0, band + 80);
  bandGrad.addColorStop(0, 'rgba(232,224,200,0)');
  bandGrad.addColorStop(0.5, 'rgba(232,224,200,0.05)');
  bandGrad.addColorStop(1, 'rgba(232,224,200,0)');
  ctx.fillStyle = bandGrad;
  ctx.fillRect(0, band - 80, w, 160);
  const vignette = ctx.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, h * 0.85);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
  return hotspots;
}

// Monitor CRT beige: frente con bisel, tubo trasero ahusado y pantalla curva.
function createMonitor(plastic, darkPlastic) {
  const group = new THREE.Group();
  const bezel = mesh(new THREE.BoxGeometry(0.47, 0.4, 0.05), plastic, { cast: true });
  bezel.position.z = 0.0;
  group.add(bezel);
  const back = new THREE.BoxGeometry(0.43, 0.37, 0.36, 1, 1, 1);
  const pos = back.attributes.position;
  for (let i = 0; i < pos.count; i += 1) {
    if (pos.getZ(i) < 0) {
      pos.setX(i, pos.getX(i) * 0.6);
      pos.setY(i, pos.getY(i) * 0.62 - 0.02);
    }
  }
  back.computeVertexNormals();
  const tube = mesh(back, plastic, { cast: true });
  tube.position.z = -0.205;
  group.add(tube);
  // Ranuras de ventilación arriba.
  const vent = new THREE.BoxGeometry(0.2, 0.004, 0.012);
  const vents = [];
  for (let i = 0; i < 8; i += 1) vents.push([vent, 0, 0.165 - i * 0.004, -0.12 - i * 0.03, -0.12, 0, 0]);
  group.add(merged(vents, darkPlastic));
  // Marco oscuro alrededor del vidrio.
  const recess = mesh(new THREE.BoxGeometry(0.41, 0.32, 0.01), darkPlastic);
  recess.position.set(0, 0.02, 0.022);
  group.add(recess);

  const canvas = document.createElement('canvas');
  canvas.width = SCREEN.width;
  canvas.height = SCREEN.height;
  const screenTexture = new THREE.CanvasTexture(canvas);
  screenTexture.colorSpace = THREE.SRGBColorSpace;
  screenTexture.anisotropy = 8;
  // Vidrio abombado.
  const sw = 0.38;
  const sh = 0.285;
  const glass = new THREE.PlaneGeometry(sw, sh, 24, 18);
  const gp = glass.attributes.position;
  for (let i = 0; i < gp.count; i += 1) {
    const nx = gp.getX(i) / (sw / 2);
    const ny = gp.getY(i) / (sh / 2);
    gp.setZ(i, 0.012 * (1 - nx * nx * 0.6) * (1 - ny * ny * 0.6));
  }
  glass.computeVertexNormals();
  const screen = mesh(
    glass,
    // Sin iluminar: la pantalla emite su propia luz y no recibe manchas de las lámparas.
    new THREE.MeshBasicMaterial({ map: screenTexture, toneMapped: false, color: 0xe6e6e6 }),
    { receive: false },
  );
  screen.position.set(0, 0.02, 0.027);
  screen.userData = { type: 'terminal', screen: true };
  group.add(screen);
  // Vidrio del tubo: un reflejo muy tenue encima de la imagen.
  const glassLayer = mesh(glass.clone(), new THREE.MeshStandardMaterial({ color: 0x0a0c0b, transparent: true, opacity: 0.07, roughness: 0.3, metalness: 0.4, depthWrite: false }), { receive: false });
  glassLayer.position.set(0, 0.02, 0.0285);
  glassLayer.raycast = () => {};
  group.add(glassLayer);

  // Placa, botones y LED.
  const plate = paperCanvas(951, 256, 40, { tint: [70, 66, 58], age: 0.1 });
  plate.ctx.fillStyle = '#d8d0b8';
  plate.ctx.font = font('mono', 22, 600);
  plate.ctx.fillText('KŌSEN · B3-T02', 12, 28);
  const plateMesh = mesh(new THREE.PlaneGeometry(0.1, 0.016), new THREE.MeshStandardMaterial({ map: plate.toTexture(), roughness: 0.5, metalness: 0.4 }));
  plateMesh.position.set(-0.13, -0.168, 0.0255);
  group.add(plateMesh);
  const knob = new THREE.CylinderGeometry(0.007, 0.007, 0.006, 12);
  const knobs = [];
  for (let i = 0; i < 4; i += 1) knobs.push([knob, 0.06 + i * 0.03, -0.168, 0.027, Math.PI / 2, 0, 0]);
  group.add(merged(knobs, darkPlastic));
  const led = mesh(new THREE.CircleGeometry(0.004, 12), new THREE.MeshStandardMaterial({ color: 0x2bd36f, emissive: 0x2bd36f, emissiveIntensity: 2 }));
  led.position.set(0.2, -0.168, 0.0256);
  group.add(led);

  // Notas adhesivas en el bisel.
  [
    ['NO APAGAR', 0.19, 0.17, -0.12],
    ['ext. 3104\nIjichi', -0.2, 0.15, 0.08],
  ].forEach(([text, x, y, rot], i) => {
    const note = paperCanvas(960 + i, 128, 128, { tint: [226, 206, 96], age: 0.3 });
    note.ctx.fillStyle = 'rgba(20,20,40,0.85)';
    note.ctx.font = font('brush', 24);
    String(text)
      .split('\n')
      .forEach((line, l) => note.ctx.fillText(line, 12, 48 + l * 32));
    const n = mesh(new THREE.PlaneGeometry(0.06, 0.06), new THREE.MeshStandardMaterial({ map: note.toTexture(), roughness: 0.9, side: THREE.DoubleSide }));
    n.position.set(x, y, 0.0262 + i * 0.0004);
    n.rotation.z = rot;
    group.add(n);
  });

  // Pie giratorio.
  const foot = mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.03, 32), plastic, { cast: true });
  foot.position.set(0, -0.235, -0.12);
  group.add(foot);
  const neck = mesh(new THREE.BoxGeometry(0.14, 0.05, 0.14), plastic);
  neck.position.set(0, -0.21, -0.12);
  group.add(neck);

  return { group, screen, canvas, screenTexture, led };
}

// Teclado con teclas individuales (InstancedMesh) y teclas especiales más oscuras.
function createKeyboard(plastic) {
  const group = new THREE.Group();
  const base = mesh(new THREE.BoxGeometry(0.46, 0.028, 0.17), plastic, { cast: true });
  group.add(base);
  const rows = [15, 14, 14, 13, 12];
  const key = new THREE.BoxGeometry(0.024, 0.012, 0.024);
  const count = rows.reduce((a, b) => a + b, 0) + 1;
  const keys = new THREE.InstancedMesh(key, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }), count);
  const m = new THREE.Matrix4();
  const light = new THREE.Color(0xd8cfb6);
  const dark = new THREE.Color(0x8d8674);
  let i = 0;
  rows.forEach((n, row) => {
    for (let k = 0; k < n; k += 1) {
      const x = -0.2 + k * 0.028 + row * 0.006;
      const z = -0.06 + row * 0.028;
      m.makeTranslation(x, 0.018 + row * 0.0015, z);
      keys.setMatrixAt(i, m);
      keys.setColorAt(i, k === 0 || k === n - 1 || row === 4 ? dark : light);
      i += 1;
    }
  });
  // Barra espaciadora.
  m.compose(new THREE.Vector3(0.0, 0.024, 0.085), new THREE.Quaternion(), new THREE.Vector3(6, 1, 1));
  keys.setMatrixAt(i, m);
  keys.setColorAt(i, light);
  keys.instanceMatrix.needsUpdate = true;
  keys.castShadow = true;
  group.add(keys);
  return group;
}

// Gabinete de PC beige con disquetera y LED de actividad.
function createTower(plastic, darkPlastic) {
  const group = new THREE.Group();
  const body = mesh(new THREE.BoxGeometry(0.19, 0.42, 0.44), plastic, { cast: true });
  body.position.y = 0.21;
  group.add(body);
  const bays = [];
  [0.36, 0.31].forEach((y) => bays.push([new THREE.BoxGeometry(0.15, 0.04, 0.004), 0, y, 0.222]));
  bays.push([new THREE.BoxGeometry(0.1, 0.006, 0.004), 0, 0.25, 0.222]);
  bays.push([new THREE.BoxGeometry(0.15, 0.1, 0.004), 0, 0.09, 0.222]);
  group.add(merged(bays, darkPlastic));
  const led = mesh(new THREE.CircleGeometry(0.005, 10), new THREE.MeshStandardMaterial({ color: 0xffa030, emissive: 0xffa030, emissiveIntensity: 2 }));
  led.position.set(0.05, 0.2, 0.2245);
  group.add(led);
  const power = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.006, 16), darkPlastic);
  power.rotation.x = Math.PI / 2;
  power.position.set(0, 0.2, 0.224);
  group.add(power);
  return { group, led };
}

// Teléfono de línea con su cable enrulado.
function createPhone(plastic, darkPlastic) {
  const group = new THREE.Group();
  const base = mesh(new THREE.BoxGeometry(0.18, 0.05, 0.2), darkPlastic, { cast: true });
  base.position.y = 0.025;
  base.rotation.x = -0.12;
  group.add(base);
  const pad = paperCanvas(971, 128, 128, { tint: [40, 40, 38], age: 0.1 });
  pad.ctx.fillStyle = '#d8d0b8';
  pad.ctx.font = font('mono', 20, 600);
  for (let i = 0; i < 12; i += 1) pad.ctx.fillText('123456789*0#'[i], 18 + (i % 3) * 38, 28 + Math.floor(i / 3) * 30);
  const keypad = mesh(new THREE.PlaneGeometry(0.08, 0.08), new THREE.MeshStandardMaterial({ map: pad.toTexture(), roughness: 0.6 }));
  keypad.rotation.x = -Math.PI / 2 - 0.12;
  keypad.position.set(0.03, 0.052, 0.03);
  group.add(keypad);
  const handset = merged(
    [
      [new THREE.BoxGeometry(0.035, 0.03, 0.2), 0, 0, 0],
      [new THREE.BoxGeometry(0.05, 0.035, 0.05), 0, -0.015, 0.09],
      [new THREE.BoxGeometry(0.05, 0.035, 0.05), 0, -0.015, -0.09],
    ],
    darkPlastic,
    { cast: true },
  );
  handset.position.set(-0.05, 0.075, 0);
  group.add(handset);
  const coil = new THREE.CatmullRomCurve3(Array.from({ length: 40 }, (_, i) => new THREE.Vector3(-0.08 - i * 0.003, 0.03 + Math.sin(i * 1.6) * 0.008, 0.1 + i * 0.004 + Math.cos(i * 1.6) * 0.008)));
  group.add(mesh(new THREE.TubeGeometry(coil, 120, 0.003, 5), darkPlastic));
  return group;
}

// Silla de oficina con base de cinco patas.
function createChair() {
  const group = new THREE.Group();
  const fabric = new THREE.MeshStandardMaterial({ color: 0x2c3138, roughness: 1 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.7, roughness: 0.4 });
  const seat = mesh(new THREE.BoxGeometry(0.46, 0.07, 0.44), fabric, { cast: true });
  seat.position.y = 0.47;
  group.add(seat);
  const back = mesh(new THREE.BoxGeometry(0.44, 0.48, 0.06), fabric, { cast: true });
  back.position.set(0, 0.8, -0.22);
  back.rotation.x = -0.08;
  group.add(back);
  const parts = [[new THREE.CylinderGeometry(0.025, 0.025, 0.32, 12), 0, 0.28, 0], [new THREE.BoxGeometry(0.04, 0.3, 0.02), 0, 0.62, -0.2]];
  for (let i = 0; i < 5; i += 1) {
    const a = (i / 5) * Math.PI * 2;
    parts.push([new THREE.BoxGeometry(0.3, 0.025, 0.04), Math.cos(a) * 0.15, 0.08, Math.sin(a) * 0.15, 0, -a, 0]);
    parts.push([new THREE.SphereGeometry(0.025, 10, 8), Math.cos(a) * 0.3, 0.03, Math.sin(a) * 0.3]);
  }
  group.add(merged(parts, metal, { cast: true }));
  return group;
}

// Archivador metálico de cuatro cajones.
function createCabinet(metalMat) {
  const group = new THREE.Group();
  const body = mesh(new THREE.BoxGeometry(0.46, 1.32, 0.6), metalMat, { cast: true });
  body.position.y = 0.66;
  group.add(body);
  const handle = new THREE.BoxGeometry(0.12, 0.015, 0.02);
  const parts = [];
  for (let i = 0; i < 4; i += 1) {
    parts.push([new THREE.BoxGeometry(0.42, 0.29, 0.01), 0, 0.17 + i * 0.32, 0.302]);
    parts.push([handle, 0, 0.25 + i * 0.32, 0.315]);
  }
  group.add(merged(parts, metalMat));
  for (let i = 0; i < 4; i += 1) {
    const label = paperCanvas(990 + i, 128, 48, { age: 0.4 });
    label.ctx.fillStyle = '#17140f';
    label.ctx.font = font('mono', 22, 600);
    label.ctx.fillText(['1990–1999', '2000–2009', '2010–2017', 'BAJAS'][i], 10, 32);
    const l = mesh(new THREE.PlaneGeometry(0.08, 0.03), new THREE.MeshStandardMaterial({ map: label.toTexture(), roughness: 0.9 }));
    l.position.set(0, 0.29 + i * 0.32, 0.309);
    group.add(l);
  }
  return group;
}

export function createTerminal() {
  const group = new THREE.Group();
  group.name = 'terminal';
  // A la derecha de la mesa, mirando hacia ella.
  group.position.set(2.45, 0, 0.35);
  group.rotation.y = -Math.PI / 2 + 0.25;

  const plasticMat = new THREE.MeshStandardMaterial({ ...plasticTextures(931), roughness: 0.55 });
  const darkPlastic = new THREE.MeshStandardMaterial({ color: 0x2a2824, roughness: 0.6 });
  const deskMetal = new THREE.MeshStandardMaterial({ ...paintedMetalTextures(941, { color: [112, 116, 106] }), color: 0xffffff, metalness: 0.8, roughness: 1 });
  const laminate = new THREE.MeshStandardMaterial({ ...plasticTextures(943, { base: [150, 156, 140] }), roughness: 0.5 });

  // Escritorio metálico de oficina con cajonera a la derecha.
  const desk = new THREE.Group();
  const top = mesh(new THREE.BoxGeometry(1.2, 0.035, 0.7), laminate, { cast: true });
  top.position.y = 0.76;
  desk.add(top);
  const frameParts = [
    [new THREE.BoxGeometry(0.02, 0.74, 0.66), -0.58, 0.37, 0],
    [new THREE.BoxGeometry(1.14, 0.5, 0.02), 0, 0.5, -0.32],
    [new THREE.BoxGeometry(0.42, 0.74, 0.66), 0.38, 0.37, 0],
  ];
  desk.add(merged(frameParts, deskMetal, { cast: true }));
  const drawerParts = [];
  const handleParts = [];
  [0.62, 0.42, 0.17].forEach((y, i) => {
    const h = i === 2 ? 0.28 : 0.18;
    drawerParts.push([new THREE.BoxGeometry(0.39, h, 0.012), 0.38, y, 0.336]);
    handleParts.push([new THREE.BoxGeometry(0.14, 0.018, 0.02), 0.38, y + h / 2 - 0.04, 0.35]);
  });
  desk.add(merged(drawerParts, deskMetal));
  desk.add(merged(handleParts, new THREE.MeshStandardMaterial({ color: 0x9a978c, metalness: 0.9, roughness: 0.3 })));
  group.add(desk);

  const monitor = createMonitor(plasticMat, darkPlastic);
  monitor.group.position.set(-0.05, 1.03, -0.05);
  group.add(monitor.group);
  const keyboard = createKeyboard(plasticMat);
  keyboard.position.set(-0.07, 0.79, 0.2);
  keyboard.rotation.x = 0.05;
  group.add(keyboard);
  // Mouse y alfombrilla.
  const padMesh = mesh(new THREE.BoxGeometry(0.22, 0.004, 0.18), new THREE.MeshStandardMaterial({ color: 0x23324a, roughness: 0.9 }));
  padMesh.position.set(0.3, 0.779, 0.18);
  group.add(padMesh);
  const mouse = mesh(new THREE.SphereGeometry(0.03, 16, 10), plasticMat, { cast: true });
  mouse.scale.set(0.9, 0.5, 1.4);
  mouse.position.set(0.3, 0.792, 0.18);
  group.add(mouse);
  const mouseCable = new THREE.CatmullRomCurve3([new THREE.Vector3(0.3, 0.79, 0.13), new THREE.Vector3(0.28, 0.785, 0.0), new THREE.Vector3(0.12, 0.785, -0.15), new THREE.Vector3(0.05, 0.79, -0.3)]);
  group.add(mesh(new THREE.TubeGeometry(mouseCable, 24, 0.002, 5), darkPlastic));

  const tower = createTower(plasticMat, darkPlastic);
  tower.group.position.set(-0.4, 0, 0.05);
  group.add(tower.group);

  const phone = createPhone(plasticMat, darkPlastic);
  phone.position.set(0.42, 0.778, -0.15);
  phone.rotation.y = -0.3;
  group.add(phone);

  // Portalápices, carpetas y una bandeja de papeles.
  const cup = mesh(new THREE.CylinderGeometry(0.035, 0.032, 0.1, 18, 1, true), new THREE.MeshStandardMaterial({ color: 0x3a4a5a, roughness: 0.5, side: THREE.DoubleSide }), { cast: true });
  cup.position.set(-0.5, 0.83, -0.18);
  group.add(cup);
  const r = rng(977);
  for (let i = 0; i < 4; i += 1) {
    const pen = mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.15, 6), new THREE.MeshStandardMaterial({ color: [0x111111, 0x1c3a8a, 0x8a1c1c, 0xb8902a][i] }));
    pen.position.set(-0.5 + (r() - 0.5) * 0.03, 0.87, -0.18 + (r() - 0.5) * 0.03);
    pen.rotation.set((r() - 0.5) * 0.4, 0, (r() - 0.5) * 0.4);
    group.add(pen);
  }
  const files = new THREE.Group();
  for (let i = 0; i < 5; i += 1) {
    const f = mesh(new THREE.BoxGeometry(0.23, 0.012, 0.31), new THREE.MeshStandardMaterial({ color: [0xc9b98a, 0x9e8a5a, 0xd8d0bc, 0x7a2a22, 0xc9b98a][i], roughness: 0.9 }), { cast: true });
    f.position.y = 0.006 + i * 0.012;
    f.rotation.y = (r() - 0.5) * 0.15;
    files.add(f);
  }
  const memo = paperCanvas(981, 256, 340, { age: 0.3 });
  memo.ctx.fillStyle = '#17140f';
  memo.ctx.font = font('mono', 18, 600);
  memo.ctx.fillText('ORDEN OM-2018-0311', 16, 40);
  memo.ctx.font = font('mono', 14, 400);
  ['Control de integridad de', 'sellos, lote 2018-B3.', 'Asignado: V. N.° 0417', 'Autoriza: ———————', '', 'Firma pendiente.'].forEach((line, i) => memo.ctx.fillText(line, 16, 80 + i * 26));
  const memoMesh = mesh(new THREE.PlaneGeometry(0.2, 0.27), new THREE.MeshStandardMaterial({ map: memo.toTexture(), roughness: 0.95 }));
  memoMesh.rotation.x = -Math.PI / 2;
  memoMesh.position.y = 0.062;
  files.add(memoMesh);
  files.position.set(-0.42, 0.778, 0.18);
  files.rotation.y = 0.2;
  group.add(files);

  // Panel divisorio detrás del escritorio, con el tablero de avisos y el reloj.
  const fabric = paperCanvas(985, 256, 256, { tint: [74, 82, 90], age: 0.6 });
  for (let i = 0; i < 3000; i += 1) {
    fabric.ctx.fillStyle = `rgba(${r() > 0.5 ? 255 : 0},${r() > 0.5 ? 255 : 0},255,0.04)`;
    fabric.ctx.fillRect(r() * 256, r() * 256, 1, 1);
  }
  const fabricTex = fabric.toTexture();
  fabricTex.repeat.set(3, 3);
  const panel = mesh(new THREE.BoxGeometry(1.7, 1.75, 0.05), new THREE.MeshStandardMaterial({ map: fabricTex, roughness: 1 }), { cast: true });
  panel.position.set(-0.05, 0.875, -0.45);
  group.add(panel);
  const panelFrame = mesh(new THREE.BoxGeometry(1.74, 0.04, 0.06), deskMetal);
  panelFrame.position.set(-0.05, 1.77, -0.45);
  group.add(panelFrame);
  const board = createNoticeBoard(1001);
  board.position.set(0.15, 1.42, -0.42);
  board.scale.setScalar(0.85);
  group.add(board);
  const clock = createClock();
  clock.position.set(-0.6, 1.5, -0.42);
  group.add(clock);

  const cabinet = createCabinet(deskMetal);
  cabinet.position.set(-0.9, 0, -0.05);
  group.add(cabinet);
  const chair = createChair();
  chair.position.set(-0.4, 0, 0.75);
  chair.rotation.y = 0.9;
  group.add(chair);

  const glow = new THREE.PointLight(0xd8e8d0, 0.9, 2.4, 2);
  glow.position.set(-0.05, 1.0, 0.3);
  group.add(glow);

  const hit = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 0.7), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.y = 1.0;
  hit.userData = { type: 'terminal' };
  group.add(hit);

  return { group, screen: monitor.screen, canvas: monitor.canvas, screenTexture: monitor.screenTexture, towerLed: tower.led, glow };
}
