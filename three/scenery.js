import * as THREE from 'three';

function canvasTexture(width, height, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d'), width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

// Mesa de inspección: madera procedural.
function createTable() {
  const texture = canvasTexture(1024, 512, (ctx, w, h) => {
    ctx.fillStyle = '#2a1c12';
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2) {
      const tone = 30 + Math.sin(y * 0.05) * 8 + Math.random() * 10;
      ctx.fillStyle = `rgba(${tone + 30}, ${tone + 12}, ${tone}, 0.35)`;
      ctx.fillRect(0, y, w, 1 + Math.random() * 2);
    }
    for (let i = 0; i < 6; i += 1) {
      ctx.strokeStyle = 'rgba(10, 6, 3, 0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      const y0 = Math.random() * h;
      ctx.moveTo(0, y0);
      for (let x = 0; x < w; x += 20) ctx.lineTo(x, y0 + Math.sin(x * 0.01 + i) * 14);
      ctx.stroke();
    }
  });
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  const table = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 50),
    new THREE.MeshStandardMaterial({ map: texture, roughness: 0.75 }),
  );
  table.rotation.x = -Math.PI / 2;
  table.position.y = -1.6;
  table.receiveShadow = true;
  return table;
}

// Bandeja del relicario: marco de madera y fieltro rojo.
function createTray() {
  const group = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x2c1d14, roughness: 0.7 });
  const felt = new THREE.MeshStandardMaterial({ color: 0x4a1514, roughness: 1 });
  const w = 17;
  const d = 9;
  const base = new THREE.Mesh(new THREE.BoxGeometry(w, 0.4, d), felt);
  base.position.y = -1.4;
  base.receiveShadow = true;
  group.add(base);
  const sides = [
    [w + 0.8, 0.9, 0.4, 0, -1.05, d / 2 + 0.2],
    [w + 0.8, 0.9, 0.4, 0, -1.05, -d / 2 - 0.2],
    [0.4, 0.9, d, w / 2 + 0.2, -1.05, 0],
    [0.4, 0.9, d, -w / 2 - 0.2, -1.05, 0],
  ];
  sides.forEach(([sx, sy, sz, x, y, z]) => {
    const side = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), wood);
    side.position.set(x, y, z);
    side.castShadow = true;
    side.receiveShadow = true;
    group.add(side);
  });
  return group;
}

// Regla en escala real (1 unidad = 1 cm), para que coincida con la ficha.
function createRuler() {
  const length = 15;
  const texture = canvasTexture(1536, 128, (ctx, w, h) => {
    ctx.fillStyle = '#d8d0b8';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#17140f';
    ctx.font = '500 26px "IBM Plex Mono", monospace';
    const px = (w - 40) / length;
    for (let mm = 0; mm <= length * 10; mm += 1) {
      const x = 20 + (mm / 10) * px;
      const tall = mm % 10 === 0 ? 48 : mm % 5 === 0 ? 32 : 20;
      ctx.fillRect(x, 0, 2, tall);
      if (mm % 10 === 0) ctx.fillText(String(mm / 10), x - 7, 84);
    }
    ctx.fillText('cm', w - 70, 116);
  });
  const ruler = new THREE.Mesh(
    new THREE.BoxGeometry(length + 0.4, 0.08, 1.4),
    [null, null, new THREE.MeshStandardMaterial({ map: texture, roughness: 0.5 }), null, null, null].map(
      (m) => m ?? new THREE.MeshStandardMaterial({ color: 0xbdb49c, roughness: 0.5 }),
    ),
  );
  ruler.position.set(0.4, -1.52, 5.8);
  ruler.receiveShadow = true;
  return ruler;
}

// Etiqueta colgante con el código del expediente.
function createTag(code) {
  const texture = canvasTexture(256, 128, (ctx, w, h) => {
    ctx.fillStyle = '#d6cbb0';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#17140f';
    ctx.font = '600 40px "IBM Plex Mono", monospace';
    ctx.fillText(code, 24, 60);
    ctx.font = '400 20px "IBM Plex Mono", monospace';
    ctx.fillText('DEPÓSITO B3', 24, 98);
    ctx.beginPath();
    ctx.arc(w - 26, 26, 9, 0, Math.PI * 2);
    ctx.fillStyle = '#2a2620';
    ctx.fill();
  });
  const tag = new THREE.Mesh(
    new THREE.PlaneGeometry(3.2, 1.6),
    new THREE.MeshStandardMaterial({ map: texture, roughness: 0.8 }),
  );
  tag.rotation.x = -Math.PI / 2;
  tag.rotation.z = 0.4;
  tag.position.set(-10.5, -1.55, -4);
  tag.receiveShadow = true;
  return tag;
}

export function createScenery(code) {
  const group = new THREE.Group();
  group.add(createTable(), createTray(), createRuler(), createTag(code));
  return group;
}
