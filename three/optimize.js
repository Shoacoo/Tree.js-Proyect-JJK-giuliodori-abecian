import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Optimizaciones de escena para que la bóveda corra en equipos modestos.

// Clave que identifica materiales equivalentes: mismas propiedades visibles y mismas texturas.
function materialKey(material) {
  const m = material;
  return [
    m.type,
    m.color?.getHex(),
    m.emissive?.getHex(),
    m.emissiveIntensity,
    m.roughness,
    m.metalness,
    m.map?.uuid,
    m.normalMap?.uuid,
    m.roughnessMap?.uuid,
    m.metalnessMap?.uuid,
    m.bumpMap?.uuid,
    m.bumpScale,
    m.aoMap?.uuid,
    m.emissiveMap?.uuid,
    m.alphaMap?.uuid,
    m.transparent,
    m.opacity,
    m.side,
    m.vertexColors,
    m.flatShading,
    m.depthWrite,
    m.visible,
  ].join('|');
}

function attributeKey(geometry) {
  return `${Object.keys(geometry.attributes).sort().join(',')}|${geometry.index ? 'i' : 'n'}|${geometry.morphAttributes && Object.keys(geometry.morphAttributes).length ? 'm' : ''}`;
}

/**
 * Une en una sola malla las piezas estáticas que comparten material.
 * Cada malla unida es una llamada de dibujo en lugar de decenas.
 * keep: objetos que se animan, se clickean o se modifican después (y todo lo que cuelga de ellos).
 * Devuelve cuántas mallas se eliminaron.
 */
export function bakeStatic(root, keep = []) {
  root.updateMatrixWorld(true);
  const kept = new Set();
  keep.filter(Boolean).forEach((object) => object.traverse((o) => kept.add(o)));

  const meshes = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    if (kept.has(o) || o.userData.type) kept.add(o);
    meshes.push(o);
  });

  // Materiales que usa algo que se anima: no se tocan.
  const busyMaterials = new Set();
  meshes.forEach((o) => {
    if (kept.has(o)) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => busyMaterials.add(m));
  });

  const visibleChain = (o) => {
    for (let p = o; p && p !== root; p = p.parent) if (!p.visible) return false;
    return true;
  };

  const rootInverse = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const groups = new Map();
  meshes.forEach((o) => {
    if (kept.has(o) || o.isInstancedMesh || o.isSkinnedMesh || Array.isArray(o.material)) return;
    const m = o.material;
    if (busyMaterials.has(m) || m.isShaderMaterial || m.transparent || !visibleChain(o)) return;
    if (o.renderOrder !== 0 || o.onBeforeRender !== THREE.Object3D.prototype.onBeforeRender) return;
    if (o.matrixWorld.determinant() < 0) return; // espejadas: invertirían las caras
    const key = `${materialKey(m)}#${attributeKey(o.geometry)}#${o.castShadow}#${o.receiveShadow}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(o);
  });

  let removed = 0;
  const geometryUsers = new Map();
  meshes.forEach((o) => geometryUsers.set(o.geometry, (geometryUsers.get(o.geometry) ?? 0) + 1));

  groups.forEach((list) => {
    if (list.length < 2) return;
    const geometries = list.map((o) => {
      const g = o.geometry.clone();
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(rootInverse, o.matrixWorld));
      // mergeGeometries exige los mismos grupos: se descartan (un solo material).
      g.clearGroups();
      return g;
    });
    const geometry = mergeGeometries(geometries, false);
    geometries.forEach((g) => g.dispose());
    if (!geometry) return;
    const first = list[0];
    const merged = new THREE.Mesh(geometry, first.material);
    merged.name = 'baked';
    merged.castShadow = first.castShadow;
    merged.receiveShadow = first.receiveShadow;
    merged.matrixAutoUpdate = false;
    root.add(merged);
    list.forEach((o) => {
      o.removeFromParent();
      const users = geometryUsers.get(o.geometry) - 1;
      geometryUsers.set(o.geometry, users);
      if (users === 0) o.geometry.dispose();
      removed += 1;
    });
  });

  // Grupos que quedaron vacíos.
  const empty = [];
  root.traverse((o) => {
    if (o !== root && !o.isMesh && !o.isLight && o.type === 'Group' && o.children.length === 0 && !kept.has(o)) empty.push(o);
  });
  empty.forEach((o) => o.removeFromParent());

  // Lo estático no necesita recalcular su matriz en cada cuadro.
  root.traverse((o) => {
    if (!kept.has(o) && o !== root && (o.isMesh || o.type === 'Group')) {
      let animatedInside = false;
      o.traverse((c) => {
        if (kept.has(c)) animatedInside = true;
      });
      if (!animatedInside) {
        o.updateMatrix();
        o.matrixAutoUpdate = false;
      }
    }
  });
  return removed;
}

/** Las piezas chicas (tornillos, etiquetas, cables) no proyectan sombras visibles: se apagan. */
export function pruneSmallCasters(root, minRadius = 0.05) {
  root.updateMatrixWorld(true);
  const scale = new THREE.Vector3();
  root.traverse((o) => {
    if (!o.isMesh || !o.castShadow) return;
    if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
    o.matrixWorld.decompose(new THREE.Vector3(), new THREE.Quaternion(), scale);
    const radius = o.geometry.boundingSphere.radius * Math.max(scale.x, scale.y, scale.z);
    if (radius < minRadius) o.castShadow = false;
  });
}
