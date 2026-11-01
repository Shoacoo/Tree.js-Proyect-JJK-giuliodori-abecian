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
  mouthFloor: 2.3, // piso de las fauces, donde está sentado Sukuna
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

// Pose: sentado en el piso con una rodilla arriba y el brazo apoyado encima. Cada hueso apunta
// hacia su hijo en una dirección de la escena (x: costado, y: arriba, z: hacia la cámara).
// El lado "left" es la izquierda de Sukuna, que se ve a la derecha de la pantalla.
const POSE = [
  ['bone_Spine_051', 'bone_Spine1_052', [0.03, 1, 0.06]],
  ['bone_Spine1_052', 'bone_Neck_070', [0.08, 1, 0.22]],
  ['bone_Neck_070', 'bone_Head_071', [0.1, 1, 0.3]],
  ['bone_LeftLegUpper_043', 'bone_LeftLeg_044', [0.42, 0.72, 0.55]],
  ['bone_LeftLeg_044', 'bone_LeftAnkle_045', [0.04, -0.95, 0.3]],
  ['bone_RightLegUpper_047', 'bone_RightLeg_048', [-0.62, 0.03, 0.78]],
  ['bone_RightLeg_048', 'bone_RightAnkle_049', [-0.42, -0.05, 0.9]],
  ['bone_LeftClav_055', 'bone_LeftArm_056', [1, -0.12, 0.25]],
  ['bone_LeftArm_056', 'bone_LeftForeArm_057', [0.42, -0.48, 0.76]],
  ['bone_LeftForeArm_057', 'bone_LeftHand_058', [0.2, -0.42, 0.88]],
  ['bone_RightArm_082', 'bone_RightForeArm_083', [-0.42, -0.86, -0.3]],
  ['bone_RightForeArm_083', 'bone_RightHand_084', [-0.22, -0.96, -0.1]],
  ['bone_LeftAnkle_045', 'bone_LeftToe_046', [0.12, -0.28, 0.95]],
  ['bone_RightAnkle_049', 'bone_RightToe_050', [-0.28, 0.82, 0.5]],
];
const SIT_DROP = 0.4; // cuánto baja la cadera (en unidades del modelo) hasta tocar el piso
const HEM_DROP = [-0.7, -0.35, -0.05]; // caída de cada tramo de la falda, de la cintura al borde
const HEAD_LEAN = 0.09;

function aimBone(bone, child, direction, rotation, from, parentRotation) {
  from.subVectors(child.getWorldPosition(new THREE.Vector3()), bone.getWorldPosition(new THREE.Vector3())).normalize();
  rotation.setFromUnitVectors(from, new THREE.Vector3(...direction).normalize());
  bone.parent.getWorldQuaternion(parentRotation);
  bone.quaternion.copy(parentRotation.invert().multiply(rotation).multiply(bone.getWorldQuaternion(new THREE.Quaternion())));
  bone.updateMatrixWorld(true);
}

function sitDown(sukuna, bones) {
  const rotation = new THREE.Quaternion();
  const from = new THREE.Vector3();
  const parentRotation = new THREE.Quaternion();
  sukuna.updateMatrixWorld(true);
  POSE.forEach(([name, childName, direction]) => {
    if (bones[name] && bones[childName]) aimBone(bones[name], bones[childName], direction, rotation, from, parentRotation);
  });

  // La falda del kimono tiene sus propias tiras de huesos: se abren sobre el piso alrededor de él.
  const center = bones.bone_Hips_02.getWorldPosition(new THREE.Vector3());
  const hem = Object.values(bones).find((b) => b.name.includes('Hemline') && b.name.includes('Dummy'));
  hem?.children.forEach((root) => {
    const at = root.getWorldPosition(new THREE.Vector3());
    const out = new THREE.Vector3(at.x - center.x, 0, at.z - center.z).normalize();
    let bone = root;
    for (let level = 0; bone?.children.find((c) => c.isBone); level += 1) {
      const child = bone.children.find((c) => c.isBone);
      aimBone(bone, child, [out.x, HEM_DROP[Math.min(level, HEM_DROP.length - 1)], out.z], rotation, from, parentRotation);
      bone = child;
    }
  });

  // Cabeza apenas ladeada, sobrándola.
  bones.bone_Neck_070?.rotateOnWorldAxis(new THREE.Vector3(0, 0, 1), -HEAD_LEAN);
  sukuna.position.y -= SIT_DROP * LAYOUT.sukunaScale;
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

  sitDown(sukuna, bones);

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
