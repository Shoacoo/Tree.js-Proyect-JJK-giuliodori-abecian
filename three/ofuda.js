import * as THREE from 'three';
import { fingerAxisY, fingerRadius } from './finger';

const PAPER = '#e3d4a6';
const RED = '#9e1f17';
const INK = '#17140f';

// Textura de papel ofuda dibujada en canvas: borde rojo, kanji en tinta y sello.
export function createOfudaTexture({ text = '封', fresh = false, vertical = false } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = vertical ? 128 : 512;
  canvas.height = vertical ? 512 : 128;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // Fibras del papel.
  for (let i = 0; i < 900; i += 1) {
    ctx.fillStyle = `rgba(120, 96, 60, ${Math.random() * 0.08})`;
    ctx.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, 1 + Math.random() * 3, 1);
  }
  ctx.strokeStyle = RED;
  ctx.lineWidth = 6;
  ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

  ctx.fillStyle = fresh ? '#0b0907' : 'rgba(23, 20, 15, 0.82)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const font = '"Zen Kaku Gothic New", "Hiragino Mincho ProN", "Noto Serif JP", serif';
  if (vertical) {
    const chars = [...text];
    const step = (canvas.height - 80) / chars.length;
    ctx.font = `700 ${Math.min(72, step * 0.9)}px ${font}`;
    chars.forEach((ch, i) => ctx.fillText(ch, canvas.width / 2, 40 + step * (i + 0.5)));
  } else {
    // La banda rodea el dedo: el kanji se repite para que se vea desde cualquier ángulo.
    ctx.font = `700 76px ${font}`;
    const label = text.length > 1 ? '封' : text;
    [0.25, 0.75].forEach((x) => ctx.fillText(label, canvas.width * x, canvas.height / 2 + 4));
    ctx.font = `500 22px ${font}`;
    ctx.fillStyle = INK;
    if (text.length > 1) ctx.fillText(text, canvas.width * 0.5, canvas.height / 2);
  }
  // Sello rojo en una esquina.
  ctx.fillStyle = RED;
  ctx.fillRect(canvas.width - 46, canvas.height - 46, 26, 26);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

// Banda de papel que envuelve el dedo en la posición x (cm).
export function createSealBand(seal, length) {
  const t = (seal.x + length / 2) / length;
  const radius = fingerRadius(t) + 0.05;
  const width = 1.15;
  const geometry = new THREE.CylinderGeometry(radius, radius * 0.98, width, 64, 1, true);
  geometry.rotateZ(Math.PI / 2);

  const material = new THREE.MeshStandardMaterial({
    map: createOfudaTexture({ text: seal.inscription, fresh: seal.ink === 'fresca' }),
    roughness: 0.85,
    side: THREE.DoubleSide,
    transparent: true,
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
    map: createOfudaTexture({ text: seal.inscription, vertical: true, fresh: seal.ink === 'fresca' }),
    roughness: 0.9,
    side: THREE.DoubleSide,
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
