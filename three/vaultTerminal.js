import * as THREE from 'three';
import { SETTING } from '@/data/cases';
import { LEAK_LIMIT, barrierCells, barrierReading, handle, logParts, placeKind, shortPlace } from '@/lib/readings';
import { font } from './fonts';
import { paintedMetalTextures, paperCanvas, plasticTextures, rng } from './proctex';
import { createClock, createNoticeBoard, merged, mesh } from './vaultRoom';

// Resolución del canvas de la pantalla (4:3, como un monitor CRT). Es el mismo tamaño que los cuadros
// "Terminal B3" de la interfaz V3.2 en el Figma: las medidas de abajo salen de ahí tal cual.
export const SCREEN = { width: 1024, height: 768 };

const C = {
  tinta: '#141415',
  fondo: '#262628',
  marco: '#3a3a3c',
  panel: '#5e5e61',
  claro: '#c6c6c8',
  papel: '#ededeb',
  amarillo: '#d9ae3a',
  rojo: '#b8322a',
  rojoTexto: '#e0574d',
  vacio: 'rgba(237,237,235,0.1)',
  linea: 'rgba(237,237,235,0.14)',
};
const GLOW_Y = 'rgba(217,174,58,0.7)';
const GLOW_R = 'rgba(184,50,42,0.65)';
const GLOW_P = 'rgba(237,237,235,0.35)';

export const SCREEN_TABS = [
  { id: 'session', label: 'Sesión' },
  { id: 'lot', label: 'Lote' },
  { id: 'log', label: 'Registro' },
  { id: 'barrier', label: 'Barrera' },
  { id: 'protocol', label: 'Protocolo' },
  { id: 'forms', label: 'Formularios' },
  { id: 'help', label: 'Ayuda' },
];

const HINTS = {
  session: '[CLICK] Seleccionar   [ARRASTRAR] Mirar alrededor',
  lot: '[CLICK] Abrir expediente   [MENÚ] Navegar',
  log: '[CLICK] Abrir el registro completo   [MENÚ] Navegar',
  barrier: 'Lectura en vivo · sensor B3-S1',
  protocol: '[CLICK] Firmar en el sistema   [MENÚ] Navegar',
  forms: '[CLICK] Abrir formulario   [MENÚ] Navegar',
  help: '[CLICK] Seleccionar   [MENÚ] Navegar',
};

const PERSISTENCE_LABEL = { nube: 'archivo central', local: 'registro local', offline: 'sin enlace' };
const LOT = SETTING.lot.replace(/^LOTE /, '');
const ORDER = SETTING.maintenanceOrder.split(' ').pop();
const ASSIGNED = SETTING.date.split(' ')[1];
// Columna de contenido: a la derecha del panel lateral, hasta el borde de la ventana.
const X = 224;
const W = 776;
const RIGHT = X + W;

function pad(n) {
  return String(n).padStart(2, '0');
}

// Las tipografías de títulos y números puede que todavía no se hayan usado en la página.
let fontsRequested = false;
function requestFonts() {
  if (fontsRequested || typeof document === 'undefined' || !document.fonts) return;
  fontsRequested = true;
  [font('display', 30, 700), font('display', 130, 500), font('mono', 14, 400), font('mono', 14, 500)].forEach((f) => document.fonts.load(f).catch(() => {}));
}

function path(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

function box(ctx, x, y, w, h, { fill, stroke, glow, r = 6, line = 1.5 } = {}) {
  if (fill) {
    path(ctx, x, y, w, h, r);
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.save();
    if (glow) {
      ctx.shadowColor = glow;
      ctx.shadowBlur = 10;
    }
    ctx.strokeStyle = stroke;
    ctx.lineWidth = line;
    path(ctx, x + line / 2, y + line / 2, w - line, h - line, Array.isArray(r) ? r : Math.max(0, r - line / 2));
    ctx.stroke();
    ctx.restore();
  }
}

// Texto centrado en y. Devuelve el ancho.
function text(ctx, str, x, y, { size = 13, weight = 400, color = C.papel, kind = 'mono', align = 'left', glow, spacing = 0 } = {}) {
  ctx.save();
  ctx.font = font(kind, size, weight);
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  if (spacing && 'letterSpacing' in ctx) ctx.letterSpacing = `${spacing}px`;
  if (glow) {
    ctx.shadowColor = glow;
    ctx.shadowBlur = 10;
  }
  ctx.fillText(str, x, y);
  const width = ctx.measureText(str).width;
  ctx.restore();
  return width;
}

function measure(ctx, str, size, weight = 400, kind = 'mono') {
  ctx.save();
  ctx.font = font(kind, size, weight);
  const width = ctx.measureText(str).width;
  ctx.restore();
  return width;
}

function wrap(ctx, str, maxWidth, size, weight = 400) {
  const lines = [];
  let line = '';
  String(str)
    .split(' ')
    .forEach((word) => {
      const next = line ? `${line} ${word}` : word;
      if (line && measure(ctx, next, size, weight) > maxWidth) {
        lines.push(line);
        line = word;
      } else line = next;
    });
  if (line) lines.push(line);
  return lines;
}

function hline(ctx, x1, x2, y, color = C.linea) {
  ctx.fillStyle = color;
  ctx.fillRect(x1, y, x2 - x1, 1);
}

// Tecla "[ENTER] Ingresar": contorno, amarilla, roja, tinta o sin borde.
function key(ctx, hotspots, s, { x, y, label, variant = 'outline', action, h = 30, size = 12, right = false }) {
  const plain = variant === 'plain';
  const w = Math.ceil(measure(ctx, label, size)) + (plain ? 0 : 24);
  const left = right ? x - w : x;
  const hover = Boolean(action) && s.hover === action;
  const look = {
    outline: { fill: hover ? 'rgba(237,237,235,0.12)' : null, stroke: hover ? C.amarillo : C.papel, text: hover ? C.amarillo : C.papel },
    fill: { fill: hover ? '#e9c157' : C.amarillo, text: C.tinta },
    red: { fill: hover ? '#cf4036' : C.rojo, text: C.papel },
    ink: { fill: hover ? 'rgba(20,20,21,0.14)' : null, stroke: C.tinta, text: C.tinta },
    plain: { text: hover ? C.amarillo : C.papel },
  }[variant];
  box(ctx, left, y, w, h, { fill: look.fill, stroke: look.stroke, r: 2 });
  text(ctx, label, plain ? left : left + 12, y + h / 2 + 1, { size, color: look.text, glow: hover && plain ? GLOW_Y : null });
  if (action) hotspots.push({ x: left - 4, y: y - 4, w: w + 8, h: h + 8, action });
  return w;
}

// Etiqueta de estado: normal, alerta (contorno rojo), activa (roja) o apagada.
function tag(ctx, { x, y, label, tone = 'normal', h = 22, right = true }) {
  const w = Math.ceil(measure(ctx, label, 11)) + 16;
  const left = right ? x - w : x;
  const look = {
    normal: { stroke: C.claro, text: C.papel },
    alert: { stroke: C.rojo, text: C.rojoTexto },
    active: { fill: C.rojo, text: C.papel },
    muted: { stroke: C.panel, text: C.claro },
    ink: { stroke: C.tinta, text: C.tinta },
  }[tone];
  box(ctx, left, y, w, h, { fill: look.fill, stroke: look.stroke, r: 2, line: 1 });
  text(ctx, label, left + 8, y + h / 2 + 1, { size: 11, color: look.text });
  return w;
}

function cells(ctx, x, y, max, value, color, size = 16) {
  for (let i = 0; i < max; i += 1) box(ctx, x + i * (size + 4), y, size, size, { fill: i < value ? color : C.vacio, r: 2 });
}

function heading(ctx, eyebrow, title) {
  text(ctx, eyebrow.toUpperCase(), X, 43, { size: 11, weight: 500, color: C.amarillo, glow: GLOW_Y, spacing: 1.54 });
  if (title) text(ctx, title, X, 72, { size: 30, weight: 700, kind: 'display' });
}

function sealDots(ctx, x, y, row) {
  if (!row.dots) {
    text(ctx, '—', x, y, { size: 13, color: row.color });
    return;
  }
  row.dots.forEach((on, i) => {
    ctx.beginPath();
    ctx.arc(x + 6 + i * 14, y, 5.5, 0, Math.PI * 2);
    if (on) {
      ctx.fillStyle = row.color;
      ctx.fill();
    } else {
      ctx.strokeStyle = row.color;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  });
}

// Panel lateral: logo, menú del sistema, versión y accesos rápidos.
function drawSide(ctx, s, hotspots) {
  box(ctx, 24, 24, 176, 720, { fill: C.marco });
  text(ctx, 'contención', 48, 58, { size: 17, weight: 700, kind: 'display', color: C.amarillo, glow: GLOW_Y });
  box(ctx, 48, 84, 30, 20, { stroke: C.amarillo, r: 3 });
  text(ctx, 'B3', 63, 95, { size: 11, weight: 500, color: C.amarillo, align: 'center' });
  const counts = { lot: s.cases.length, log: s.log.length || null };
  SCREEN_TABS.forEach((item, i) => {
    const y = 130 + i * 26;
    const action = `tab:${item.id}`;
    const active = s.tab === item.id;
    if (active) box(ctx, 36, y, 152, 24, { fill: C.rojo });
    else if (s.hover === action) box(ctx, 36, y, 152, 24, { fill: 'rgba(237,237,235,0.09)' });
    text(ctx, item.label, 48, y + 12.5, { size: 14 });
    if (counts[item.id]) text(ctx, String(counts[item.id]), 176, y + 12.5, { size: 12, color: active ? C.papel : C.claro, align: 'right' });
    hotspots.push({ x: 36, y, w: 152, h: 24, action });
  });
  const minutes = 47 + Math.floor(s.time / 60);
  text(ctx, `${ASSIGNED} 23:${pad(minutes % 60)}:${pad(Math.floor(s.time) % 60)}`, 48, 640, { size: 11, color: C.claro });
  text(ctx, 'CustodiaOS v2.0.6', 48, 664, { size: 11, color: C.claro });
  [
    ['[?]', 'tab:help'],
    ['[⚙]', 'tab:forms'],
    ['[⏻]', s.signedIn ? 'exit' : 'login#power'],
  ].forEach(([label, action], i) => {
    const x = 48 + i * 40;
    text(ctx, label, x, 692, { size: 12, color: C.amarillo, glow: s.hover === action ? GLOW_Y : null });
    hotspots.push({ x: x - 4, y: 680, w: 36, h: 24, action });
  });
}

function drawStatus(ctx, s) {
  box(ctx, X, 700, W, 44, { fill: C.marco });
  text(ctx, HINTS[s.tab] ?? HINTS.session, 244, 722, { size: 11, color: C.claro });
  text(ctx, s.signedIn ? handle(s.operator) : 'sin sesión', RIGHT - 20, 722, { size: 11, color: C.amarillo, align: 'right' });
}

function drawLogin(ctx, s, hotspots) {
  heading(ctx, 'Identificación');
  text(ctx, 'IDENTIFICACIÓN', X, 117, { size: 55, weight: 700, kind: 'display', glow: GLOW_P });
  text(ctx, 'REQUERIDA', X, 171, { size: 55, weight: 700, kind: 'display', glow: GLOW_P });
  wrap(ctx, 'Toda inspección del Depósito B3 queda registrada a nombre del operador.', 560, 14).forEach((line, i) =>
    text(ctx, line, X, 270 + i * 19, { size: 14, color: C.claro }),
  );
  const fieldHover = s.hover === 'login#field';
  box(ctx, X, 324, 560, 56, { fill: C.marco, stroke: C.amarillo, glow: fieldHover ? GLOW_Y : null });
  const prompt = text(ctx, '> operador:', 242, 353, { size: 15 });
  if (s.cursor) {
    ctx.save();
    ctx.shadowColor = GLOW_R;
    ctx.shadowBlur = 10;
    ctx.fillStyle = C.rojo;
    ctx.fillRect(242 + prompt + 20, 340, 11, 24);
    ctx.restore();
  }
  hotspots.push({ x: X, y: 324, w: 560, h: 56, action: 'login#field' });
  let kx = X;
  [
    ['[1] Anónimo', 'fill'],
    ['[2] Google', 'outline'],
    ['[3] Correo', 'outline'],
  ].forEach(([label, variant], i) => {
    kx += key(ctx, hotspots, s, { x: kx, y: 404, label, variant, action: `login#${i + 1}` }) + 10;
  });
  box(ctx, X, 472, 560, 64, { fill: C.fondo, stroke: C.rojo, glow: GLOW_R });
  text(ctx, '!', 246, 504, { size: 16, weight: 700, kind: 'display', color: C.rojoTexto });
  text(ctx, `Sin sesión. El lote ${LOT} está bloqueado.`, 270, 504, { size: 13, color: C.rojoTexto });
  key(ctx, hotspots, s, { x: X, y: 572, label: '[ENTER] Ingresar', variant: 'fill', action: 'login#enter' });
}

function drawDesk(ctx, s, hotspots) {
  heading(ctx, 'Sesión', 'Sesión activa');
  box(ctx, X, 108, W, 232, { fill: C.marco });
  // Foto del legajo: una silueta, como en el Figma.
  ctx.fillStyle = '#2d2d2f';
  ctx.fillRect(244, 128, 124, 124);
  ctx.fillStyle = '#4e4e51';
  ctx.beginPath();
  ctx.arc(306, 174, 24, 0, Math.PI * 2);
  ctx.fill();
  box(ctx, 262, 210, 88, 42, { fill: '#4e4e51', r: [12, 12, 0, 0] });
  text(ctx, handle(s.operator), 388, 139, { size: 14, weight: 500 });
  text(ctx, `Asignado ${ASSIGNED}`, 980, 139, { size: 12, align: 'right' });
  text(ctx, 'Ventana · personal de apoyo. Sin técnica.', 388, 169, { size: 13 });
  text(ctx, `Enlace: ${PERSISTENCE_LABEL[s.persistence] ?? '—'}`, 388, 195, { size: 12, color: C.claro });
  hline(ctx, 244, 980, 272);
  const archived = s.cases.filter((c) => c.status === 'archived').length;
  let sx = 244;
  sx += text(ctx, String(archived), sx, 302, { size: 13, weight: 500 }) + 8;
  sx += text(ctx, 'Archivados', sx, 302, { size: 13 }) + 34;
  sx += text(ctx, String(s.cases.length - archived), sx, 302, { size: 13, weight: 500 }) + 8;
  text(ctx, 'Pendientes', sx, 302, { size: 13 });
  const cw = key(ctx, hotspots, s, { x: 968, y: 287, label: '[C] Cambiar', action: 'login#change', right: true });
  key(ctx, hotspots, s, { x: 968 - cw - 10, y: 287, label: '[I] Índice', action: 'index', right: true });

  const tw = key(ctx, hotspots, s, { x: X, y: 360, label: 'Órdenes', variant: 'fill' });
  key(ctx, hotspots, s, { x: X + tw + 10, y: 360, label: 'Expedientes', action: 'tab:lot' });

  const revealed = s.hiddenStatus === 'revealed';
  box(ctx, X, 408, W, 202, { fill: C.marco });
  text(ctx, '@superior_sin_firma', 242, 435, { size: 13, weight: 500 });
  text(ctx, `23:02 · ${s.cases.length} objetos · 1 lote`, 982, 435, { size: 12, align: 'right' });
  const ow = text(ctx, ORDER, 242, 464, { size: 13, weight: 500, color: revealed ? C.claro : C.papel });
  ctx.fillStyle = revealed ? C.rojo : C.papel;
  ctx.fillRect(242, revealed ? 463 : 472, ow, revealed ? 2 : 1);
  [`Control de integridad del lote ${LOT}`, 'Retirar sellos en orden inverso', 'Archivar cada expediente antes de salir'].forEach((line, i) =>
    text(ctx, `• ${line}`, 242, 495 + i * 20, { size: 13 }),
  );
  hline(ctx, 242, 982, 557);
  const aw = key(ctx, hotspots, s, { x: 242, y: 567, label: '[↵] Abrir', variant: 'plain', action: 'tab:lot' });
  key(ctx, hotspots, s, { x: 242 + aw + 22, y: 567, label: '[S] Firmar', variant: 'plain', action: 'index:sesion' });
  let tx = 982;
  tx -= tag(ctx, { x: tx, y: 571, label: revealed ? 'no figura en el archivo' : 'sin firma', tone: 'alert' }) + 8;
  tx -= tag(ctx, { x: tx, y: 571, label: 'B3' }) + 8;
  tag(ctx, { x: tx, y: 571, label: 'mantenimiento' });
}

const LOT_STATUS = {
  pending: ['pendiente', 'normal'],
  archived: ['archivado', 'normal'],
  locked: ['bloqueado', 'muted'],
};

function lotRows(s) {
  const rows = s.cases.map((c) => ({
    id: c.id,
    code: c.code,
    origin: shortPlace(c.place),
    box: c.box,
    dots: c.dots ?? Array.from({ length: c.seals }, () => c.status !== 'archived'),
    status: LOT_STATUS[c.status] ?? LOT_STATUS.locked,
    locked: c.status === 'locked',
    action: c.status !== 'locked' ? (s.signedIn ? `case:${c.id}` : `login#case${c.id}`) : null,
    title: `${c.code} · ${shortPlace(c.place)}`,
    desc: `${placeKind(c.place)}. ${c.seals} sellos de papel, caja ${c.box}.${c.status === 'archived' ? ' Archivado: se puede volver a revisar.' : c.status === 'locked' ? ' Bloqueado hasta archivar el anterior.' : ''}`,
    color: C.papel,
  }));
  const revealed = s.hiddenStatus === 'revealed';
  rows.push({
    id: '00',
    code: 'B3-11',
    origin: revealed ? 'sin registro' : 'vacía',
    box: 'B3-11',
    dots: null,
    status: revealed ? ['revisar', 'active'] : ['vacía', 'muted'],
    locked: !revealed,
    alert: revealed,
    action: revealed ? (s.signedIn ? 'case:00' : 'login#case00') : null,
    title: revealed ? 'B3-11 · Sin registro' : 'B3-11 · Vacía',
    desc: revealed
      ? 'La caja que el sistema da por vacía. Adentro hay un dedo sin sellos y el registro de la Ventana N.º 0391.'
      : 'Según el sistema, este lugar nunca se usó.',
    color: revealed ? C.rojoTexto : C.papel,
  });
  return rows;
}

function drawLot(ctx, s, hotspots) {
  heading(ctx, 'Lote', `Lote ${LOT}`);
  const cols = [244, 344, 554, 664];
  ['EXP', 'ORIGEN', 'CAJA', 'SELLOS'].forEach((label, i) => text(ctx, label, cols[i], 120, { size: 11, color: C.claro, spacing: 1.1 }));
  text(ctx, 'ESTADO', 980, 120, { size: 11, color: C.claro, spacing: 1.1, align: 'right' });
  const rows = lotRows(s);
  const hovered = rows.find((r) => r.action && r.action === s.hover);
  const selected = hovered ?? rows.find((r) => r.alert) ?? rows.find((r) => r.status[0] === 'pendiente') ?? rows[0];
  rows.forEach((row, i) => {
    const y = 140 + i * 72;
    const isSelected = row === selected;
    ctx.save();
    if (row.locked) ctx.globalAlpha = 0.5;
    if (row.alert) box(ctx, X, y, W, 60, { fill: C.fondo, stroke: C.rojo, glow: isSelected ? GLOW_R : null });
    else box(ctx, X, y, W, 60, { fill: C.marco, stroke: isSelected && !row.locked ? C.amarillo : null, glow: GLOW_Y });
    text(ctx, row.code, cols[0], y + 30, { size: 13, weight: 500, color: row.color });
    text(ctx, row.origin, cols[1], y + 30, { size: 13, color: row.color });
    text(ctx, row.box, cols[2], y + 30, { size: 13, color: row.color });
    sealDots(ctx, cols[3], y + 30, row);
    tag(ctx, { x: 975, y: y + 19, label: row.status[0], tone: row.status[1] });
    ctx.restore();
    if (row.action) hotspots.push({ x: X, y, w: W, h: 60, action: row.action });
  });
  const dy = 140 + rows.length * 72 + 4;
  box(ctx, X, dy, W, 170, { fill: C.marco, stroke: selected.alert ? C.rojo : null, glow: GLOW_R });
  text(ctx, selected.title.toUpperCase(), 244, dy + 38, { size: 28, weight: 700, kind: 'display', glow: GLOW_P, color: selected.alert ? C.rojoTexto : C.papel });
  wrap(ctx, s.signedIn ? selected.desc : `${selected.desc} Identificate para abrirlo.`, 736, 13).forEach((line, i) =>
    text(ctx, line, 244, dy + 80 + i * 18, { size: 13, color: C.claro }),
  );
  if (selected.action) {
    const label = s.signedIn ? (selected.status[0] === 'archivado' ? '[↵] Revisar expediente' : '[↵] Abrir expediente') : '[↵] Identificarse';
    const kw = key(ctx, hotspots, s, { x: 244, y: dy + 118, label, variant: selected.alert ? 'red' : 'fill', action: selected.action });
    key(ctx, hotspots, s, { x: 244 + kw + 10, y: dy + 118, label: '[I] Índice completo', action: s.signedIn ? 'index:lote' : 'login#index' });
  }
}

function drawLog(ctx, s, hotspots) {
  heading(ctx, 'Registro', 'Registro de actividad');
  const revealed = s.hiddenStatus === 'revealed';
  const max = revealed ? 3 : 9;
  const entries = s.log.map(logParts).slice(-max);
  let y = 108;
  const row = (at, label, detail, color = C.papel, detailColor = C.claro) => {
    text(ctx, at, X, y + 24, { size: 13, weight: 500, color });
    text(ctx, label.length > 52 ? `${label.slice(0, 51)}…` : label, X + 90, y + 24, { size: 13, color });
    if (detail) text(ctx, detail, RIGHT, y + 24, { size: 12, color: detailColor, align: 'right' });
    hline(ctx, X, RIGHT, y + 50, C.marco);
    y += 52;
  };
  if (!revealed) row('23:02', `${ORDER} emitida`, '@superior_sin_firma', C.claro);
  if (!entries.length) row('--:--', 'Sin actividad registrada en esta inspección.', '', C.claro);
  entries.forEach((e) => row(e.at, e.text, e.detail, C.papel, e.bad ? C.rojoTexto : C.claro));
  if (revealed) {
    y += 6;
    box(ctx, X, y, W, 46, { fill: C.fondo, stroke: C.rojo, glow: GLOW_R });
    text(ctx, '23:02', X + 12, y + 23, { size: 13, weight: 500, color: C.rojoTexto });
    box(ctx, X + 102, y + 15, 300, 16, { fill: C.rojo, r: 1 });
    tag(ctx, { x: RIGHT - 16, y: y + 12, label: 'eliminado', tone: 'active' });
    y += 58;
    box(ctx, X, y, W, 200, { fill: C.rojo });
    text(ctx, ORDER, X + 24, y + 30, { size: 13, color: C.tinta });
    text(ctx, 'AUTORIZACIÓN', X + 24, y + 66, { size: 39, weight: 700, kind: 'display', color: C.tinta });
    text(ctx, 'NO ENCONTRADA', X + 24, y + 104, { size: 39, weight: 700, kind: 'display', color: C.tinta });
    text(ctx, 'La orden ya no figura en el sistema central.', X + 24, y + 168, { size: 13, color: C.tinta });
    key(ctx, hotspots, s, { x: RIGHT - 34, y: y + 150, label: '[R] Reintentar', variant: 'ink', action: 'index:registro', right: true });
    y += 200;
  }
  key(ctx, hotspots, s, { x: X, y: y + 24, label: '[↵] Abrir el registro completo', action: s.signedIn ? 'index:registro' : 'login#log' });
}

function drawBarrier(ctx, s) {
  const { percent, stress, status } = barrierReading(s.leak, s.influence);
  const critical = status === 'crítica';
  text(ctx, 'BARRERA DEL DEPÓSITO', X, 43, { size: 11, weight: 500, color: C.amarillo, glow: GLOW_Y, spacing: 1.54 });
  // La lectura tiembla un poco cuando la barrera no está estable.
  const r = rng(Math.floor(s.time * 6));
  const shake = stress > 0.15 ? (r() - 0.5) * stress * 3 : 0;
  const reading = `${percent}%`;
  text(ctx, reading, X - 4 + shake, 132, { size: 130, weight: 500, kind: 'display', color: critical ? C.rojoTexto : C.amarillo, glow: critical ? GLOW_R : GLOW_Y });
  // La etiqueta va a la derecha del número; con "100%" se corre para no pisarlo.
  const tagX = Math.max(524, Math.ceil(X - 4 + measure(ctx, reading, 130, 500, 'display')) + 20);
  const label = status.toUpperCase();
  const lw = Math.ceil(measure(ctx, label, 12)) + 28;
  box(ctx, tagX, 142, lw, 30, { fill: critical ? C.rojo : C.amarillo, r: 2 });
  text(ctx, label, tagX + 14, 158, { size: 12, color: critical ? C.papel : C.tinta });
  const readAt = String(s.log.at(-1)?.at ?? SETTING.time).slice(0, 5);
  text(ctx, `Lectura ${readAt} · sensor B3-S1`, tagX, 196, { size: 12 });
  barrierCells(percent, stress).forEach((tone, i) =>
    box(ctx, X + i * 22, 294, 18, 36, { fill: tone === 'y' ? C.amarillo : tone === 'r' ? C.rojo : C.marco, r: 2 }),
  );
  text(ctx, 'estable', X, 344, { size: 11, color: C.claro });
  text(ctx, 'crítico', X + 656, 344, { size: 11, color: C.claro, align: 'right' });
  text(ctx, 'energía filtrada', X, 392, { size: 13 });
  cells(ctx, X + 220, 384, LEAK_LIMIT, Math.min(s.leak, LEAK_LIMIT), C.rojo, 18);
  text(ctx, `${s.leak}/${LEAK_LIMIT}`, RIGHT, 392, { size: 13, weight: 500, color: s.leak > 0 ? C.rojoTexto : C.papel, align: 'right' });
  hline(ctx, X, RIGHT, 416, C.marco);
  text(ctx, 'memoria', X, 438, { size: 13 });
  cells(ctx, X + 220, 430, s.memoryTotal, s.memory, C.amarillo, 18);
  text(ctx, `${s.memory}/${s.memoryTotal}`, RIGHT, 438, { size: 13, weight: 500, align: 'right' });
  hline(ctx, X, RIGHT, 462, C.marco);
  const alert =
    s.influence >= 2 || s.hiddenStatus === 'revealed'
      ? 'Residuos sin registro detectados en la caja B3-11.'
      : s.leak > 0
        ? `Fuga registrada: ${s.leak} de energía maldita en el depósito.`
        : null;
  if (alert) {
    box(ctx, X, 502, W, 72, { fill: C.rojo });
    text(ctx, '!', X + 26, 538, { size: 18, weight: 700, kind: 'display', color: C.tinta });
    text(ctx, alert, X + 52, 538, { size: 13, color: C.tinta });
  }
}

const RULES = ['Retirar los sellos en orden inverso al de colocación.', 'Usar guantes durante toda la inspección.', 'No dirigirle la palabra al objeto.'];

function drawProtocol(ctx, s, hotspots) {
  heading(ctx, 'Protocolo', 'Protocolo de inspección');
  RULES.forEach((rule, i) => {
    const y = 112 + i * 72;
    box(ctx, X, y, W, 60, { fill: C.marco });
    text(ctx, pad(i + 1), 242, y + 30, { size: 28, weight: 700, kind: 'display', color: C.amarillo, glow: GLOW_Y });
    text(ctx, rule, 304, y + 30, { size: 13 });
  });
  box(ctx, X, 328, W, 60, { fill: C.fondo, stroke: C.rojo, glow: GLOW_R });
  text(ctx, '04', 242, 358, { size: 28, weight: 700, kind: 'display', color: C.rojoTexto, glow: GLOW_R });
  text(ctx, 'La caja B3-11 figura vacía en el sistema.', 304, 358, { size: 13, color: C.rojoTexto });
  tag(ctx, { x: 980, y: 347, label: '¿?', tone: 'alert' });
  box(ctx, X, 424, W, 170, { fill: C.marco });
  text(ctx, 'CONFORMIDAD DEL OPERADOR', 246, 452, { size: 12, weight: 500, spacing: 1.2 });
  text(ctx, 'Leí y acepto el protocolo vigente del Depósito B3.', 246, 482, { size: 13 });
  ctx.fillStyle = C.claro;
  ctx.fillRect(246, 534, 360, 1.5);
  text(ctx, s.signedIn ? handle(s.operator) : 'sin sesión', 246, 554, { size: 12 });
  key(ctx, hotspots, s, { x: 976, y: 532, label: '[F] Firmar', action: s.signedIn ? 'index:protocolo' : 'login#sign', right: true });
}

const FORMS = [
  ['B3-01', 'Acceso de personal de apoyo', 'login#form'],
  ['B3-07', 'Control de integridad del lote', 'index:lote'],
  ['B3-09', 'Registro de actividad', 'index:registro'],
  ['B3-12', 'Ajustes del equipo: sonido, efectos y calidad', 'index:formularios'],
];

function drawForms(ctx, s, hotspots) {
  heading(ctx, 'Formularios', 'Formularios y ajustes');
  FORMS.forEach(([code, title, target], i) => {
    const y = 112 + i * 72;
    const action = target.startsWith('index') && !s.signedIn ? `login#${code}` : target;
    const hover = s.hover === action;
    box(ctx, X, y, W, 60, { fill: C.marco, stroke: hover ? C.amarillo : null, glow: GLOW_Y });
    text(ctx, `FORM. ${code}`, 244, y + 30, { size: 12, weight: 500, color: C.amarillo, spacing: 1.1 });
    text(ctx, title, 384, y + 30, { size: 13 });
    text(ctx, '[↵] Abrir', 980, y + 30, { size: 12, color: hover ? C.amarillo : C.claro, align: 'right' });
    hotspots.push({ x: X, y, w: W, h: 60, action });
  });
  wrap(ctx, 'Los formularios se completan en el sistema de expedientes. Cada cambio queda registrado a nombre del operador.', 736, 13).forEach(
    (line, i) => text(ctx, line, X, 432 + i * 19, { size: 13, color: C.claro }),
  );
}

const STEPS = [
  ['Buscar el dedo', 'Abrí su caja en la estantería y llevalo a la mesa de inspección.'],
  ['Levantar el sello', 'Mantené presionado cada sello hasta que se suelte solo.'],
  ['Leer el residuo', 'Algunas palabras del recuerdo esconden detalles: suman memoria.'],
  ['Marcar el estado', 'Intacto, fisurado o dañado: mirá el papel antes de elegir.'],
  ['Archivar', 'Archivar un expediente habilita el siguiente del lote.'],
];

function drawHelp(ctx) {
  heading(ctx, 'Ayuda', 'Cómo se inspecciona');
  STEPS.forEach(([title, body], i) => {
    const y = 112 + i * 72;
    box(ctx, X, y, W, 60, { fill: C.marco });
    text(ctx, pad(i + 1), 242, y + 30, { size: 28, weight: 700, kind: 'display', color: C.amarillo, glow: GLOW_Y });
    text(ctx, title, 304, y + 21, { size: 13, weight: 500 });
    text(ctx, body, 304, y + 40, { size: 12, color: C.claro });
  });
  text(ctx, 'Los sellos se retiran en orden inverso al de colocación.', X, 492, { size: 13, color: C.claro });
}

const SCREENS = { lot: drawLot, log: drawLog, barrier: drawBarrier, protocol: drawProtocol, forms: drawForms, help: drawHelp };

/**
 * Interfaz de la terminal B3-T02: CustodiaOS, igual que la interfaz web (V3.2 del Figma).
 * Se dibuja en canvas y vuelve con las zonas clickeables (hotspots) en coordenadas del canvas,
 * para el raycasting sobre la pantalla.
 */
export function drawTerminalScreen(ctx, w, h, s) {
  requestFonts();
  const hotspots = [];
  ctx.save();
  ctx.fillStyle = C.fondo;
  ctx.fillRect(0, 0, w, h);

  drawSide(ctx, s, hotspots);
  if (s.tab === 'session' || !SCREENS[s.tab]) (s.signedIn ? drawDesk : drawLogin)(ctx, s, hotspots);
  else SCREENS[s.tab](ctx, s, hotspots);
  drawStatus(ctx, s);

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
      ctx.fillStyle = 'rgba(224,87,77,0.85)';
      ctx.font = font('brush', 44);
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(s.influence >= 3 ? 'ya son tuyos' : 'ya casi', w - 300, h - 110);
    }
  }

  // Líneas de barrido (1 px cada 4, como el Figma), franja de refresco y viñeta: aspecto de tubo.
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 1);
  const band = ((s.time * 0.18) % 1) * (h + 200) - 100;
  const bandGrad = ctx.createLinearGradient(0, band - 80, 0, band + 80);
  bandGrad.addColorStop(0, 'rgba(237,237,235,0)');
  bandGrad.addColorStop(0.5, 'rgba(237,237,235,0.04)');
  bandGrad.addColorStop(1, 'rgba(237,237,235,0)');
  ctx.fillStyle = bandGrad;
  ctx.fillRect(0, band - 80, w, 160);
  const vignette = ctx.createRadialGradient(w / 2, h / 2, h * 0.4, w / 2, h / 2, h * 0.9);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.45)');
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
