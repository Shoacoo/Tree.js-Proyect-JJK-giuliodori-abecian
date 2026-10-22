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
  return true;
}
