import * as THREE from 'three';
import { font } from './fonts';
import { rng } from './proctex';
import { ROOM, mesh } from './vaultRoom';

// Tablón blanco de la pared izquierda: entre la salida y el rincón de la estantería, debajo de
// la rejilla de ventilación. Anota a marcador los objetivos, el avance y los detalles encontrados.
export const BOARD = { width: 2, height: 1.3, y: 1.4, z: -1.3 };

const W = 1600;
const H = 1040;
const BLACK = '#1b2029';
const BLUE = '#1c3f94';
const RED = '#b5201a';
const FADED = 'rgba(27, 32, 41, 0.38)';

function createSurfaceCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  return canvas;
}

// Blanco con restos de marcador mal borrado.
function paintSurface(ctx) {
  const r = rng(617);
  ctx.fillStyle = '#eef0ec';
  ctx.fillRect(0, 0, W, H);
  ctx.lineCap = 'round';
  for (let i = 0; i < 26; i += 1) {
    const x = r() * W;
    const y = r() * H;
    ctx.strokeStyle = `rgba(${r() > 0.7 ? '150,60,60' : '70,80,110'},${0.025 + r() * 0.05})`;
    ctx.lineWidth = 8 + r() * 26;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + r() * 180 - 90, y + r() * 50 - 25, x + r() * 340 - 170, y + r() * 30 - 15);
    ctx.stroke();
  }
}

function checkbox(ctx, x, y, done, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.lineJoin = 'round';
  ctx.strokeRect(x, y - 26, 32, 32);
  if (!done) return;
  ctx.strokeStyle = BLUE;
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x + 5, y - 12);
  ctx.lineTo(x + 14, y + 1);
  ctx.lineTo(x + 40, y - 36);
  ctx.stroke();
}

function arrow(ctx, x, y) {
  ctx.strokeStyle = RED;
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + 34, y);
  ctx.moveTo(x + 21, y - 12);
  ctx.lineTo(x + 34, y);
  ctx.lineTo(x + 21, y + 12);
  ctx.stroke();
}

function underline(ctx, x, y, width, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + width / 2, y + 6, x + width, y - 2);
  ctx.stroke();
}

// Rayitas de a cinco, como se cuentan en un pizarrón.
function tally(ctx, x, y, count) {
  ctx.strokeStyle = RED;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  for (let i = 0; i < count; i += 1) {
    const group = Math.floor(i / 5);
    const px = x + group * 92 + (i % 5) * 15;
    ctx.beginPath();
    if (i % 5 === 4) {
      ctx.moveTo(px - 66, y - 4);
      ctx.lineTo(px - 2, y - 32);
    } else {
      ctx.moveTo(px, y - 36);
      ctx.lineTo(px, y);
    }
    ctx.stroke();
  }
}

function draw(ctx, data) {
  paintSurface(ctx);
  ctx.textBaseline = 'alphabetic';

  // Objetivos.
  ctx.fillStyle = BLACK;
  ctx.font = font('display', 62, 700);
  ctx.fillText('OBJETIVOS', 70, 104);
  underline(ctx, 70, 124, 350, RED);

  let y = 206;
  data.objectives.forEach((o) => {
    const current = data.current?.id === o.id;
    if (current) arrow(ctx, 40, y - 10);
    checkbox(ctx, 92, y, o.done, o.locked ? FADED : BLACK);
    ctx.fillStyle = o.locked ? FADED : BLACK;
    ctx.font = font('display', current ? 42 : 38, current ? 700 : 500);
    ctx.fillText(o.text, 146, y);
    if (o.done) {
      const width = ctx.measureText(o.text).width;
      ctx.strokeStyle = 'rgba(28, 63, 148, 0.75)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(146, y - 13);
      ctx.lineTo(146 + width, y - 15);
      ctx.stroke();
    }
    y += 44;
    if (o.detail) {
      ctx.fillStyle = o.locked ? FADED : current ? RED : 'rgba(27, 32, 41, 0.72)';
      ctx.font = font('mono', 25, 500);
      ctx.fillText(o.detail, 146, y);
      y += 58;
    } else {
      y += 22;
    }
  });

  // Avance y residuo, abajo a la izquierda.
  const barY = 880;
  ctx.fillStyle = BLACK;
  ctx.font = font('display', 34, 700);
  ctx.fillText(`LOTE ${data.archived}/${data.cases.length} ARCHIVADOS`, 70, barY);
  ctx.strokeStyle = BLACK;
  ctx.lineWidth = 4;
  ctx.strokeRect(70, barY + 16, 600, 30);
  ctx.fillStyle = BLUE;
  ctx.fillRect(74, barY + 20, (592 * data.archived) / data.cases.length, 22);
  ctx.fillStyle = BLACK;
  ctx.font = font('display', 34, 700);
  ctx.fillText('RESIDUO', 720, barY);
  if (data.leak) tally(ctx, 720, barY + 50, data.leak);
  else {
    ctx.fillStyle = FADED;
    ctx.font = font('mono', 30, 500);
    ctx.fillText('sin fugas', 720, barY + 42);
  }

  // Detalles encontrados, a la derecha.
  const x = 1010;
  ctx.fillStyle = 'rgba(27, 32, 41, 0.18)';
  ctx.fillRect(x - 40, 64, 3, H - 128);
  ctx.fillStyle = BLACK;
  ctx.font = font('display', 62, 700);
  ctx.fillText('DETALLES', x, 104);
  ctx.fillStyle = data.found ? BLUE : FADED;
  ctx.fillText(`${data.found}/${data.total}`, x + 340, 104);
  underline(ctx, x, 124, 500, RED);

  y = 190;
  data.cases.forEach((c) => {
    ctx.fillStyle = c.unlocked ? BLACK : FADED;
    ctx.font = font('display', 36, 700);
    ctx.fillText(c.code, x, y);
    y += 52;
    c.details.forEach((d) => {
      if (d.found) {
        ctx.fillStyle = BLUE;
        ctx.font = font('mono', 31, 500);
        ctx.fillText(`× ${d.word}`, x + 16, y);
      } else {
        ctx.fillStyle = FADED;
        ctx.font = font('mono', 31, 500);
        ctx.fillText('· ______________', x + 16, y);
      }
      y += 46;
    });
    y += 22;
  });
}

/** Devuelve el grupo, la superficie (para el raycasting) y redraw(datos), que solo dibuja si algo cambió. */
export function createObjectivesBoard() {
  const group = new THREE.Group();
  group.name = 'objectives-board';
  group.position.set(-ROOM.width / 2 + 0.03, BOARD.y, BOARD.z);
  group.rotation.y = Math.PI / 2;

  const canvas = createSurfaceCanvas();
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;

  // Un poco de luz propia: es un rincón oscuro y lo escrito se tiene que poder leer.
  const surface = mesh(
    new THREE.PlaneGeometry(BOARD.width, BOARD.height),
    new THREE.MeshStandardMaterial({ map: texture, emissive: 0xffffff, emissiveMap: texture, emissiveIntensity: 0.3, roughness: 0.7 }),
  );
  surface.position.z = 0.016;
  surface.userData = { type: 'board' };
  group.add(surface);

  // Marco de aluminio, respaldo y bandeja con marcadores y borrador.
  const aluminium = new THREE.MeshStandardMaterial({ color: 0xa9adab, metalness: 0.75, roughness: 0.38 });
  const back = mesh(new THREE.BoxGeometry(BOARD.width + 0.03, BOARD.height + 0.03, 0.02), new THREE.MeshStandardMaterial({ color: 0x55585a, roughness: 0.7 }));
  back.position.z = 0.004;
  group.add(back);
  const bar = 0.032;
  [
    [BOARD.width + bar * 2, bar, 0, BOARD.height / 2 + bar / 2],
    [BOARD.width + bar * 2, bar, 0, -BOARD.height / 2 - bar / 2],
    [bar, BOARD.height, BOARD.width / 2 + bar / 2, 0],
    [bar, BOARD.height, -BOARD.width / 2 - bar / 2, 0],
  ].forEach(([w, h, x, y]) => {
    const piece = mesh(new THREE.BoxGeometry(w, h, 0.034), aluminium, { cast: true });
    piece.position.set(x, y, 0.012);
    group.add(piece);
  });
  const tray = mesh(new THREE.BoxGeometry(0.9, 0.018, 0.07), aluminium, { cast: true });
  tray.position.set(0.18, -BOARD.height / 2 - 0.046, 0.05);
  group.add(tray);
  [
    [-0.12, 0x1b2029],
    [0.06, 0x1c3f94],
    [0.2, 0xb5201a],
  ].forEach(([x, color], i) => {
    const pen = mesh(new THREE.CylinderGeometry(0.0095, 0.0095, 0.13, 10), new THREE.MeshStandardMaterial({ color, roughness: 0.4 }));
    pen.rotation.z = Math.PI / 2 + (i - 1) * 0.06;
    pen.position.set(x, -BOARD.height / 2 - 0.027, 0.052);
    group.add(pen);
  });
  const eraser = mesh(new THREE.BoxGeometry(0.13, 0.035, 0.05), new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.85 }));
  eraser.position.set(0.47, -BOARD.height / 2 - 0.02, 0.05);
  group.add(eraser);

  let drawn = null;
  let last = null;
  const redraw = (data, force = false) => {
    if (!data) return;
    last = data;
    const signature = JSON.stringify(data);
    if (signature === drawn && !force) return;
    drawn = signature;
    draw(ctx, data);
    texture.needsUpdate = true;
  };
  // Si las tipografías terminan de cargar después del primer dibujo, se vuelve a escribir.
  document.fonts?.ready.then(() => last && redraw(last, true));

  return { group, surface, redraw };
}
