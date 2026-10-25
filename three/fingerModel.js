import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Modelo "Sukuna's finger" de André Souza (CC BY-NC-ND 4.0). Se usa tal cual:
// solo se ubica, rota y escala; la malla y las texturas no se modifican. Sí se dibuja
// opaco: viene marcado como semitransparente (BLEND) aunque su textura es opaca, y así no
// tapaba la mitad de atrás de los sellos.
export const FINGER_MODEL_URL = '/models/sukuna-finger.glb';

let cache = null;

// Carga el .glb una sola vez. Si no está, resuelve null y queda el dedo procedural.
export function loadFingerModel() {
  if (!cache) {
    cache = new GLTFLoader()
      .loadAsync(FINGER_MODEL_URL)
      .then((gltf) => {
        const meshes = [];
        gltf.scene.updateMatrixWorld(true);
        gltf.scene.traverse((o) => {
          if (!o.isMesh) return;
          o.material.transparent = false;
          o.material.depthWrite = true;
          o.material.needsUpdate = true;
          meshes.push(o);
        });
        return meshes.length ? { meshes, layout: measure(meshes) } : null;
      })
      .catch(() => null);
  }
  return cache;
}

// Encuentra el eje largo, el centro y de qué lado está la punta (el extremo más fino).
function measure(meshes) {
  const box = new THREE.Box3();
  meshes.forEach((m) => box.expandByObject(m));
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const axis = size.x >= size.y && size.x >= size.z ? 'x' : size.y >= size.z ? 'y' : 'z';
  const others = ['x', 'y', 'z'].filter((a) => a !== axis);
  const half = size[axis] / 2;
  const v = new THREE.Vector3();
  let low = 0;
  let lowN = 0;
  let high = 0;
  let highN = 0;
  meshes.forEach((m) => {
    const pos = m.geometry.attributes.position;
    for (let i = 0; i < pos.count; i += 7) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld).sub(center);
      const r = Math.hypot(v[others[0]], v[others[1]]);
      if (v[axis] < -half * 0.7) {
        low += r;
        lowN += 1;
      } else if (v[axis] > half * 0.7) {
        high += r;
        highN += 1;
      }
    }
  });
  const tipPositive = (highN ? high / highN : 0) < (lowN ? low / lowN : 0);
  return { center, axis, length: size[axis], tipPositive };
}

// Matriz que deja el modelo acostado en X, centrado, con la punta en +X y el largo pedido (cm).
function layoutMatrix(layout, length) {
  const { center, axis, tipPositive } = layout;
  const rotation = new THREE.Matrix4();
  if (axis === 'y') rotation.makeRotationZ(-Math.PI / 2);
  if (axis === 'z') rotation.makeRotationY(Math.PI / 2);
  const flip = new THREE.Matrix4();
  // Con rotación en Z, +Y pasa a +X; con rotación en Y, +Z pasa a +X.
  if (!tipPositive) flip.makeRotationY(Math.PI);
  const scale = new THREE.Matrix4().makeScale(length / layout.length, length / layout.length, length / layout.length);
  const translate = new THREE.Matrix4().makeTranslation(-center.x, -center.y, -center.z);
  return new THREE.Matrix4().multiply(scale).multiply(flip).multiply(rotation).multiply(translate);
}

/**
 * Reemplaza el dedo procedural por el modelo cuando termina de cargar.
 * finger: grupo de createFinger; aura: malla del aura que copiaba la geometría procedural.
 */
export async function applyFingerModel(finger, aura, length) {
  const model = await loadFingerModel();
  if (!model || finger.userData.disposed) return false;
  const matrix = layoutMatrix(model.layout, length);
  const holder = new THREE.Group();
  holder.name = 'finger-model';
  const auraGeometries = [];
  model.meshes.forEach((source) => {
    const geometry = source.geometry.clone();
    geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(matrix, source.matrixWorld));
    const mesh = new THREE.Mesh(geometry, source.material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    holder.add(mesh);
    auraGeometries.push(geometry);
  });
  finger.userData.profile = measureProfile(auraGeometries);
  finger.children.forEach((child) => {
    child.visible = false;
  });
  finger.add(holder);
  if (aura && auraGeometries[0]) {
    aura.geometry = auraGeometries[0];
    model.meshes.slice(1).forEach((_, i) => {
      const extra = new THREE.Mesh(auraGeometries[i + 1], aura.material);
      extra.renderOrder = aura.renderOrder;
      aura.add(extra);
    });
  }
  return finger.userData.profile;
}

const ANGLE_BINS = 48; // sectores para medir la sección del dedo
const RING_POINTS = 96; // puntos del anillo de papel
const BAND_GAP = 0.04; // separación entre el papel y la piel (cm)
const RADIUS_PERCENTILE = 0.88; // ignora las puntas sueltas de la malla

// Vértices del modelo ya ubicado (cm), en un solo arreglo para recortar franjas en X.
function measureProfile(geometries) {
  const total = geometries.reduce((sum, g) => sum + g.attributes.position.count, 0);
  const points = new Float32Array(total * 3);
  let offset = 0;
  geometries.forEach((geometry) => {
    const pos = geometry.attributes.position;
    for (let i = 0; i < pos.count; i += 1) {
      points[offset] = pos.getX(i);
      points[offset + 1] = pos.getY(i);
      points[offset + 2] = pos.getZ(i);
      offset += 3;
    }
  });
  return { points };
}

// Envolvente convexa 2D (cadena monótona). Recibe y devuelve pares [y, z].
function convexHull(points) {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  sorted.forEach((p) => {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  });
  const upper = [];
  [...sorted].reverse().forEach((p) => {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  });
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

// Distancia desde el centro hasta el borde de la envolvente en la dirección (sin, cos).
function hullDistance(hull, cy, cz, dy, dz) {
  let best = 0;
  for (let i = 0; i < hull.length; i += 1) {
    const [ay, az] = hull[i];
    const [by, bz] = hull[(i + 1) % hull.length];
    const ey = by - ay;
    const ez = bz - az;
    const denom = dy * ez - dz * ey;
    if (Math.abs(denom) < 1e-9) continue;
    const t = ((ay - cy) * ez - (az - cz) * ey) / denom;
    const s = ((ay - cy) * dz - (az - cz) * dy) / denom;
    if (t > 0 && s >= 0 && s <= 1) best = Math.max(best, t);
  }
  return best;
}

// Sección del dedo entre x0 y x1: centro y contorno convexo (el papel no entra en los pliegues).
function wrapSection(profile, x0, x1) {
  const { points } = profile;
  const slice = [];
  for (let i = 0; i < points.length; i += 3) {
    if (points[i] >= x0 && points[i] <= x1) slice.push([points[i + 1], points[i + 2]]);
  }
  if (slice.length < 24) return null;
  let cy = 0;
  let cz = 0;
  slice.forEach(([y, z]) => {
    cy += y;
    cz += z;
  });
  cy /= slice.length;
  cz /= slice.length;

  // Por sector, un radio alto pero robusto (percentil) en lugar del máximo.
  const bins = Array.from({ length: ANGLE_BINS }, () => []);
  slice.forEach(([y, z]) => {
    const angle = Math.atan2(y - cy, z - cz);
    const bin = Math.floor(((angle + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2) * ANGLE_BINS) % ANGLE_BINS;
    bins[bin].push(Math.hypot(y - cy, z - cz));
  });
  const outline = [];
  bins.forEach((radii, i) => {
    if (!radii.length) return;
    radii.sort((a, b) => a - b);
    const r = radii[Math.min(radii.length - 1, Math.floor(radii.length * RADIUS_PERCENTILE))];
    const angle = ((i + 0.5) / ANGLE_BINS) * Math.PI * 2;
    outline.push([cy + Math.sin(angle) * r, cz + Math.cos(angle) * r]);
  });
  if (outline.length < 3) return null;
  return { cy, cz, hull: convexHull(outline) };
}

// Reemplaza la banda cilíndrica por un anillo de papel que sigue la sección real del modelo.
// La geometría queda en el espacio local de la banda; la escala de la malla vuelve a 1.
export function fitBandToProfile(band, profile) {
  if (!profile?.points) return;
  const width = band.geometry.parameters?.height ?? 1.15;
  const x = band.position.x;
  const section = wrapSection(profile, x - width / 2, x + width / 2);
  if (!section) return;
  const { cy, cz, hull } = section;

  // Contorno remuestreado: empieza en +Z y gira hacia +Y, como el CylinderGeometry rotado.
  const ring = [];
  for (let i = 0; i <= RING_POINTS; i += 1) {
    const angle = (i / RING_POINTS) * Math.PI * 2;
    const dy = Math.sin(angle);
    const dz = Math.cos(angle);
    const r = hullDistance(hull, cy, cz, dy, dz) + BAND_GAP;
    ring.push([dy * r, dz * r, dy, dz]);
  }
  const lengths = [0];
  for (let i = 1; i < ring.length; i += 1) {
    lengths.push(lengths[i - 1] + Math.hypot(ring[i][0] - ring[i - 1][0], ring[i][1] - ring[i - 1][1]));
  }
  const perimeter = lengths[lengths.length - 1];

  const positions = [];
  const normals = [];
  const uvs = [];
  [-width / 2, width / 2].forEach((edge, row) => {
    ring.forEach(([y, z, ny, nz], i) => {
      positions.push(edge, y, z);
      normals.push(0, ny, nz);
      uvs.push(lengths[i] / perimeter, row === 0 ? 1 : 0);
    });
  });
  const indices = [];
  const n = ring.length;
  for (let i = 0; i < n - 1; i += 1) {
    const a = i;
    const b = i + 1;
    const c = n + i + 1;
    const d = n + i;
    indices.push(a, d, b, b, d, c);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  geometry.parameters = { height: width };

  band.geometry.dispose();
  band.geometry = geometry;
  band.scale.set(1, 1, 1);
  band.position.set(x, cy, cz);
  band.userData.baseY = cy;
  band.userData.radius = Math.max(...ring.map(([y, z]) => Math.hypot(y, z)));
}
