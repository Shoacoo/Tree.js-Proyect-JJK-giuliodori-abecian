import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Modelo "Sukuna's finger" de André Souza (CC BY-NC-ND 4.0). Se usa tal cual:
// solo se ubica, rota y escala; la malla y las texturas no se modifican.
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
          if (o.isMesh) meshes.push(o);
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
  finger.userData.profile = measureProfile(auraGeometries, length);
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

// Perfil del modelo ya ubicado: para cada tramo en X, centro y semiancho en Y y Z (cm).
function measureProfile(geometries, length) {
  const bins = 48;
  const slots = Array.from({ length: bins }, () => ({ minY: Infinity, maxY: -Infinity, minZ: Infinity, maxZ: -Infinity }));
  geometries.forEach((geometry) => {
    const pos = geometry.attributes.position;
    for (let i = 0; i < pos.count; i += 1) {
      const t = (pos.getX(i) + length / 2) / length;
      const slot = slots[Math.min(bins - 1, Math.max(0, Math.floor(t * bins)))];
      const y = pos.getY(i);
      const z = pos.getZ(i);
      if (y < slot.minY) slot.minY = y;
      if (y > slot.maxY) slot.maxY = y;
      if (z < slot.minZ) slot.minZ = z;
      if (z > slot.maxZ) slot.maxZ = z;
    }
  });
  return (x) => {
    const t = (x + length / 2) / length;
    const slot = slots[Math.min(bins - 1, Math.max(0, Math.floor(t * bins)))];
    if (!Number.isFinite(slot.minY)) return null;
    return {
      y: (slot.minY + slot.maxY) / 2,
      z: (slot.minZ + slot.maxZ) / 2,
      ry: (slot.maxY - slot.minY) / 2,
      rz: (slot.maxZ - slot.minZ) / 2,
    };
  };
}

// Ajusta una banda ofuda (createSealBand) al grosor real del modelo en su posición.
export function fitBandToProfile(band, profile) {
  const section = profile?.(band.position.x);
  if (!section) return;
  const radius = Math.max(section.ry, section.rz) + 0.06;
  const width = band.geometry.parameters?.height ?? 1.15;
  band.geometry.dispose();
  band.geometry = new THREE.CylinderGeometry(radius, radius * 0.98, width * 1.3, 64, 1, true);
  band.geometry.rotateZ(Math.PI / 2);
  band.scale.set(1, section.ry >= section.rz ? 1 : (section.ry + 0.06) / radius, section.rz >= section.ry ? 1 : (section.rz + 0.06) / radius);
  band.position.y = section.y;
  band.position.z = section.z;
  band.userData.baseY = section.y;
  band.userData.radius = radius;
}
