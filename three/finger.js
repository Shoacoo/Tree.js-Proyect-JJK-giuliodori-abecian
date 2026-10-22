import * as THREE from 'three';

// Perfil del dedo momificado. t va de 0 (base cortada) a 1 (punta).
// Devuelve el radio en cm.
export function fingerRadius(t) {
  t = Math.min(1, Math.max(0, t));
  const knuckle = (center, width, height) => height * Math.exp(-((t - center) ** 2) / (2 * width ** 2));
  let r = 0.92 - 0.22 * t; // se afina hacia la punta
  r += knuckle(0.34, 0.05, 0.2); // nudillo proximal
  r += knuckle(0.67, 0.045, 0.15); // nudillo distal
  r -= knuckle(0.5, 0.08, 0.1); // falange hundida por la momificación
  if (t > 0.86) {
    const k = (t - 0.86) / 0.14;
    r *= Math.sqrt(Math.max(0, 1 - k * k)) * 0.85 + 0.15 * (1 - k);
  }
  if (t < 0.03) r *= 0.82 + 0.18 * (t / 0.03);
  return Math.max(r, 0.001);
}

// Pequeña función de ruido determinista (sin dependencias).
function hash(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function valueNoise(x, y) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi);
  const b = hash(xi + 1, yi);
  const c = hash(xi, yi + 1);
  const d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// Geometría procedural: torno (LatheGeometry) + arrugas + curvatura.
// El resultado queda acostado sobre el eje X, centrado en el origen.
export function createFingerGeometry(length) {
  const steps = 140;
  const profile = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    profile.push(new THREE.Vector2(fingerRadius(t), t * length));
  }
  profile[0].x = 0.001;

  const geometry = new THREE.LatheGeometry(profile, 72);
  const position = geometry.attributes.position;
  const vertex = new THREE.Vector3();

  for (let i = 0; i < position.count; i += 1) {
    vertex.fromBufferAttribute(position, i);
    const t = vertex.y / length;
    const angle = Math.atan2(vertex.z, vertex.x);
    const radial = Math.hypot(vertex.x, vertex.z);
    if (radial > 0.01) {
      // Arrugas anulares cerca de los nudillos y piel reseca en general.
      const ring = Math.sin(t * length * 22) * 0.018 * (Math.exp(-((t - 0.34) ** 2) / 0.004) + Math.exp(-((t - 0.67) ** 2) / 0.003));
      const dry = (valueNoise(angle * 3.2, t * 26) - 0.5) * 0.07 + (valueNoise(angle * 9, t * 70) - 0.5) * 0.025;
      const scale = (radial + ring + dry * Math.min(1, radial * 2)) / radial;
      vertex.x *= scale;
      vertex.z *= scale * 0.86; // aplastado por la momificación
    }
    // Leve arco hacia arriba, como un dedo seco (x del torno pasa a ser -y del mundo).
    vertex.x -= Math.sin(t * Math.PI) * 0.3;
    position.setXYZ(i, vertex.x, vertex.y, vertex.z);
  }

  geometry.translate(0, -length / 2, 0);
  geometry.rotateZ(-Math.PI / 2); // eje Y del torno -> eje X del mundo (punta en +X)
  geometry.computeVertexNormals();
  return geometry;
}

// Textura de relieve para la piel momificada.
export function createSkinTextures() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(size, size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const n = valueNoise(x / 9, y / 3) * 0.6 + valueNoise(x / 3, y / 1.2) * 0.4;
      const v = Math.floor(n * 255);
      const i = (y * size + x) * 4;
      image.data[i] = v;
      image.data[i + 1] = v;
      image.data[i + 2] = v;
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  const bump = new THREE.CanvasTexture(canvas);
  bump.wrapS = THREE.RepeatWrapping;
  bump.wrapT = THREE.RepeatWrapping;
  bump.repeat.set(2, 3);
  return { bump };
}

export function createFinger(length) {
  const group = new THREE.Group();
  group.name = 'finger';
  const { bump } = createSkinTextures();

  const skin = new THREE.Mesh(
    createFingerGeometry(length),
    new THREE.MeshStandardMaterial({
      color: 0x5a4030,
      roughness: 0.92,
      metalness: 0,
      bumpMap: bump,
      bumpScale: 0.6,
    }),
  );
  skin.castShadow = true;
  skin.receiveShadow = true;
  skin.name = 'skin';
  group.add(skin);

  // Uña.
  const tipT = 0.9;
  const nailX = -length / 2 + tipT * length;
  const nail = new THREE.Mesh(
    new THREE.SphereGeometry(1, 32, 16),
    new THREE.MeshStandardMaterial({ color: 0x6b5446, roughness: 0.55 }),
  );
  nail.position.set(nailX, fingerRadius(tipT) * 0.95 + Math.sin(tipT * Math.PI) * 0.3, 0);
  nail.scale.set(0.9, 0.12, 0.42);
  nail.castShadow = true;
  group.add(nail);

  // Hueso expuesto en el corte de la base.
  const bone = new THREE.Mesh(
    new THREE.CircleGeometry(0.32, 24),
    new THREE.MeshStandardMaterial({ color: 0xd8ccb0, roughness: 0.8 }),
  );
  bone.rotation.y = -Math.PI / 2;
  bone.position.set(-length / 2 - 0.01, 0, 0);
  group.add(bone);

  return { group, skin };
}

// Altura del eje del dedo en x (cm), por la curvatura.
export function fingerAxisY(x, length) {
  const t = (x + length / 2) / length;
  return Math.sin(Math.min(1, Math.max(0, t)) * Math.PI) * 0.3;
}
