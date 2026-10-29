import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { WRAP_RING, buildWrapGeometry } from './ofuda';

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

// Superficie del modelo a lo largo del dedo, medida una sola vez: cada STEP cm, el centro
// de la sección y la distancia al borde en cada punto alrededor (WRAP_RING).
const FIELD_STEP = 0.25;
const WRAP_GAP = 0.05; // aire extra entre la envoltura y la piel (cm)

function modelField(profile) {
  if (profile.field) return profile.field;
  const { points } = profile;
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < points.length; i += 3) {
    min = Math.min(min, points[i]);
    max = Math.max(max, points[i]);
  }
  const rows = [];
  for (let x = min; x <= max + 1e-6; x += FIELD_STEP) {
    const section = wrapSection(profile, x - FIELD_STEP, x + FIELD_STEP);
    if (!section) {
      rows.push(null);
      continue;
    }
    const { cy, cz, hull } = section;
    const radii = [];
    for (let a = 0; a < WRAP_RING; a += 1) {
      const angle = (a / WRAP_RING) * Math.PI * 2;
      radii.push(hullDistance(hull, cy, cz, Math.sin(angle), Math.cos(angle)) + BAND_GAP);
    }
    rows.push({ cy, cz, radii });
  }
  // Las puntas con pocos vértices copian la sección vecina, achicada.
  for (let pass = 0; pass < 2; pass += 1) {
    const order = pass ? [...rows.keys()].reverse() : [...rows.keys()];
    let last = null;
    order.forEach((i) => {
      if (rows[i]) last = rows[i];
      else if (last) rows[i] = { ...last, radii: last.radii.map((r) => r * 0.85) };
    });
  }
  // Sin picos: cada radio se limita respecto de la mediana de su anillo y se suaviza con
  // los anillos vecinos (los pliegues y la uña no deben levantar el papel).
  const clamped = rows.map((row) => {
    if (!row) return row;
    const ref = [...row.radii].sort((a, b) => a - b)[Math.floor(row.radii.length * 0.7)];
    return { ...row, radii: row.radii.map((r) => Math.min(r, ref * 1.15)) };
  });
  const smooth = clamped.map((row, i) => {
    if (!row) return row;
    const near = [clamped[i - 1], row, clamped[i + 1]].filter(Boolean);
    return {
      cy: near.reduce((s, n) => s + n.cy, 0) / near.length,
      cz: near.reduce((s, n) => s + n.cz, 0) / near.length,
      // El papel no entra en la piel: nunca queda por debajo del radio medido.
      radii: row.radii.map((r, a) => {
        const around = [a - 1, a, a + 1].map((k) => (k + WRAP_RING) % WRAP_RING);
        let sum = 0;
        near.forEach((n) => around.forEach((k) => (sum += n.radii[k])));
        return Math.max(r, sum / (near.length * around.length)) + WRAP_GAP;
      }),
    };
  });
  profile.field = { min, rows: smooth };
  return profile.field;
}

function modelSample(field) {
  const { min, rows } = field;
  return (x, a, gap) => {
    const f = Math.min(rows.length - 1, Math.max(0, (x - min) / FIELD_STEP));
    const i = Math.min(rows.length - 2, Math.floor(f));
    const k = f - i;
    const p = rows[i];
    const q = rows[i + 1] ?? p;
    const cy = p.cy + (q.cy - p.cy) * k;
    const cz = p.cz + (q.cz - p.cz) * k;
    if (a < 0) return [cy, cz];
    const r = p.radii[a] + (q.radii[a] - p.radii[a]) * k + gap;
    const angle = (a / WRAP_RING) * Math.PI * 2;
    return [cy + Math.sin(angle) * r, cz + Math.cos(angle) * r];
  };
}

// Rehace el tramo de envoltura para que siga la forma real del modelo.
export function fitBandToProfile(band, profile) {
  if (!profile?.points || !band.userData.span) return;
  const field = modelField(profile);
  if (!field.rows.some(Boolean)) return;
  const { geometry, center } = buildWrapGeometry(band.userData.span, modelSample(field));
  band.geometry.dispose();
  band.geometry = geometry;
  band.scale.set(1, 1, 1);
  band.position.set(...center);
  band.userData.baseY = center[1];
}
