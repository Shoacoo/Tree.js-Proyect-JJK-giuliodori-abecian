import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { glowTexture } from './proctex';

// Modelos de Sketchfab de la expansión de dominio (CC-BY-4.0, ver /creditos):
// el santuario "Malevolent_shrine jjk cc" (Tyo155q) y "Sukuna Free Fire Skin" (rocklee.ff).
// Se optimizaron para la web: texturas más chicas y sin atributos que no se usan.
export const SHRINE_URL = '/models/malevolent-shrine.glb';
export const SUKUNA_URL = '/models/sukuna.glb';

// Medidas tomadas del modelo del santuario (1 unidad = 1 m de la escena).
export const LAYOUT = {
  mouthFloor: 2.3, // piso de las fauces, donde está parado Sukuna
  mouthZ: -2.2,
  sukunaScale: 2.3, // el modelo mide 0,98: queda de unos 2,25 m
  altar: { y: 1.0, z: 1.5, scale: 1.4 }, // sobre los cráneos, delante de las fauces
  throat: { y: 4.0, z: -5.0 }, // fondo de la boca
};

// Huesos del esqueleto de Sukuna que se mueven.
const BONES = {
  head: 'bone_Head_071',
  spine: 'bone_Spine1_052',
  leftArm: 'bone_LeftArm_056',
  rightArm: 'bone_RightArm_082',
};

// Ojos en el espacio del hueso de la cabeza (x arriba, y adelante, z al costado).
const EYES = [
  [0.0392, 0.053, -0.0194],
  [0.0392, 0.053, 0.0194],
];

let cache = null;

/** Carga los dos modelos una sola vez. Si fallan, resuelve null y queda la escena procedural. */
export function loadDomainModels() {
  if (!cache) {
    const loader = new GLTFLoader();
    cache = Promise.all([loader.loadAsync(SHRINE_URL), loader.loadAsync(SUKUNA_URL)])
      .then(([shrine, sukuna]) => prepare(shrine.scene, sukuna.scene))
      .catch((error) => {
        console.warn('[dominio] no se pudieron cargar los modelos', error);
        cache = null;
        return null;
      });
  }
  return cache;
}

function prepare(shrine, sukuna) {
  shrine.name = 'malevolent-shrine-model';
  // El santuario solo recibe sombras: proyectarlas con 200.000 triángulos no vale la pena.
  shrine.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = false;
    o.receiveShadow = true;
  });

  sukuna.name = 'sukuna-model';
  sukuna.scale.setScalar(LAYOUT.sukunaScale);
  sukuna.position.set(0, LAYOUT.mouthFloor, LAYOUT.mouthZ);
  const bones = {};
  sukuna.traverse((o) => {
    if (o.isBone) bones[o.name] = o;
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    // Con el esqueleto deformado, los límites originales no sirven para descartarlo de cámara.
    o.frustumCulled = false;
  });
  const head = bones[BONES.head];
  const spine = bones[BONES.spine];

  // Pose: el modelo viene con los brazos abiertos; se bajan a los costados.
  bones[BONES.leftArm]?.rotateOnAxis(new THREE.Vector3(0, 1, 0), 0.7).rotateOnAxis(new THREE.Vector3(0, 0, 1), -0.12);
  bones[BONES.rightArm]?.rotateOnAxis(new THREE.Vector3(0, 1, 0), -0.7).rotateOnAxis(new THREE.Vector3(0, 0, 1), -0.12);

  // Brillo de los ojos: es lo único que queda en la oscuridad del apagón.
  const glowMap = glowTexture('255,40,20');
  const glows = EYES.map(([x, y, z]) => {
    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: glowMap, color: 0xff3a20, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
    );
    glow.position.set(x, y, z);
    glow.scale.setScalar(0.034);
    head?.add(glow);
    return glow.material;
  });

  const base = {
    head: head?.quaternion.clone(),
    headPosition: head?.position.clone(),
    spine: spine?.quaternion.clone(),
  };
  const nod = new THREE.Quaternion();
  const zAxis = new THREE.Vector3(0, 0, 1);
  const up = new THREE.Vector3(1, 0, 0);

  return {
    shrine,
    sukuna,
    glows,
    // Cabeza: positivo la baja (mira al piso), negativo la echa hacia atrás. bob la sacude.
    setHead(angle, bob = 0) {
      if (!head) return;
      head.quaternion.copy(base.head).multiply(nod.setFromAxisAngle(zAxis, angle));
      head.position.copy(base.headPosition).addScaledVector(up, bob);
    },
    breathe(amount) {
      if (!spine) return;
      spine.quaternion.copy(base.spine).multiply(nod.setFromAxisAngle(zAxis, amount));
    },
  };
}
