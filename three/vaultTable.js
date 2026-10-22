import * as THREE from 'three';
import { createAuraMaterial } from './auraShader';
import { createFinger } from './finger';
import { applyFingerModel, fitBandToProfile } from './fingerModel';
import { font } from './fonts';
import { createOfudaTexture, createSealBand } from './ofuda';
import { matTexture, paperCanvas, varnishedWoodTextures } from './proctex';
import { merged, mesh } from './vaultRoom';

const steel = new THREE.MeshStandardMaterial({ color: 0xa8a69e, metalness: 0.9, roughness: 0.28 });
const brass = new THREE.MeshStandardMaterial({ color: 0x8a6a35, metalness: 0.9, roughness: 0.35 });
const blackPlastic = new THREE.MeshStandardMaterial({ color: 0x151412, roughness: 0.5 });

function lathe(points, segments = 24) {
  return new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), segments);
}

// Cuaderno abierto con anotaciones de la inspección.
function createNotebook() {
  const group = new THREE.Group();
  const pages = paperCanvas(811, 512, 360, { tint: [226, 220, 200], age: 0.3 });
  const { ctx } = pages;
  ctx.strokeStyle = 'rgba(70,90,130,0.35)';
  ctx.lineWidth = 1;
  for (let y = 40; y < 360; y += 18) {
    ctx.beginPath();
    ctx.moveTo(10, y);
    ctx.lineTo(502, y);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(40,40,40,0.5)';
  ctx.fillRect(254, 0, 4, 360);
  ctx.fillStyle = 'rgba(23,20,15,0.8)';
  ctx.font = font('mono', 15, 500);
  ['15/03 23:31 · ingreso B3', 'OM-2018-0311 (verbal)', 'Lote: 3 objetos', 'Sellos: orden inverso', '', 'B3-11: figura vacía', '¿Por qué hay marca', 'en el polvo?'].forEach((line, i) => ctx.fillText(line, 20, 56 + i * 18));
  ctx.font = font('brush', 22);
  ctx.fillText('no mirar la uña', 290, 110);
  ctx.strokeStyle = 'rgba(158,31,23,0.7)';
  ctx.lineWidth = 2;
  ctx.strokeRect(284, 86, 170, 34);
  const pageMat = new THREE.MeshStandardMaterial({ map: pages.toTexture(), roughness: 0.95 });
  const g = new THREE.PlaneGeometry(0.3, 0.21, 16, 1);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i += 1) pos.setZ(i, Math.abs(pos.getX(i)) ** 0.5 * 0.012);
  g.computeVertexNormals();
  const page = mesh(g, pageMat);
  page.rotation.x = -Math.PI / 2;
  page.position.y = 0.006;
  group.add(page);
  const cover = mesh(new THREE.BoxGeometry(0.31, 0.004, 0.215), new THREE.MeshStandardMaterial({ color: 0x2b3a2e, roughness: 0.8 }));
  cover.position.y = 0.002;
  group.add(cover);
  // Lápiz hexagonal.
  const pencil = new THREE.Group();
  pencil.add(mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.17, 6), new THREE.MeshStandardMaterial({ color: 0xb8902a, roughness: 0.6 })));
  const tip = mesh(new THREE.ConeGeometry(0.0045, 0.018, 6), new THREE.MeshStandardMaterial({ color: 0xd9b98a, roughness: 0.8 }));
  tip.position.y = 0.094;
  pencil.add(tip);
  const lead = mesh(new THREE.ConeGeometry(0.0015, 0.006, 6), new THREE.MeshStandardMaterial({ color: 0x222222 }));
  lead.position.y = 0.105;
  pencil.add(lead);
  pencil.rotation.set(0, 0.4, Math.PI / 2);
  pencil.position.set(0.04, 0.016, 0.05);
  group.add(pencil);
  return group;
}

// Planilla en una tabla con clip.
function createClipboard() {
  const group = new THREE.Group();
  const board = mesh(new THREE.BoxGeometry(0.23, 0.006, 0.32), new THREE.MeshStandardMaterial({ color: 0x5a3e26, roughness: 0.7 }));
  group.add(board);
  const form = paperCanvas(823, 360, 500, { tint: [230, 226, 214], age: 0.25 });
  const { ctx } = form;
  ctx.fillStyle = '#17140f';
  ctx.font = font('mono', 18, 600);
  ctx.fillText('CONTROL DE INTEGRIDAD', 20, 70);
  ctx.font = font('mono', 13, 400);
  ['Form. B3-07', 'Operador: V. N.° 0417', 'Fecha: 15/03/2018', 'Objeto: ____________', 'Sellos: [ ] [ ] [ ] [ ]', 'Residuo: __________', 'Firma: ____________'].forEach((line, i) => ctx.fillText(line, 20, 110 + i * 34));
  ctx.strokeStyle = 'rgba(158,31,23,0.8)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(300, 440, 30, 0, Math.PI * 2);
  ctx.stroke();
  const sheet = mesh(new THREE.PlaneGeometry(0.21, 0.29), new THREE.MeshStandardMaterial({ map: form.toTexture(), roughness: 0.95 }));
  sheet.rotation.x = -Math.PI / 2;
  sheet.position.set(0, 0.0035, 0.01);
  group.add(sheet);
  const clip = mesh(new THREE.BoxGeometry(0.09, 0.012, 0.03), steel);
  clip.position.set(0, 0.008, -0.145);
  group.add(clip);
  return group;
}

// Lupa de mano.
function createLoupe() {
  const group = new THREE.Group();
  group.add(mesh(new THREE.TorusGeometry(0.04, 0.005, 10, 32), blackPlastic));
  const glass = mesh(new THREE.CircleGeometry(0.04, 32), new THREE.MeshStandardMaterial({ color: 0xdfe8ea, transparent: true, opacity: 0.25, roughness: 0.02, metalness: 0.3 }));
  group.add(glass);
  const handle = mesh(new THREE.CylinderGeometry(0.008, 0.009, 0.1, 12), new THREE.MeshStandardMaterial({ color: 0x3a2416, roughness: 0.5 }));
  handle.position.y = -0.09;
  group.add(handle);
  group.rotation.x = -Math.PI / 2;
  return group;
}

// Pinza, pincel, sello hanko y almohadilla.
function createTools() {
  const group = new THREE.Group();
  const tweezers = new THREE.Group();
  [-1, 1].forEach((s) => {
    const arm = mesh(new THREE.BoxGeometry(0.12, 0.002, 0.006), steel);
    arm.position.set(0, 0.004, s * 0.006);
    arm.rotation.y = s * 0.05;
    tweezers.add(arm);
  });
  tweezers.position.set(0, 0, 0);
  tweezers.rotation.y = -0.3;
  group.add(tweezers);

  const brush = new THREE.Group();
  brush.add(mesh(new THREE.CylinderGeometry(0.005, 0.006, 0.14, 10), new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 0.6 })));
  const ferrule = mesh(new THREE.CylinderGeometry(0.0065, 0.006, 0.02, 10), brass);
  ferrule.position.y = 0.075;
  brush.add(ferrule);
  const bristles = mesh(new THREE.ConeGeometry(0.008, 0.035, 10), new THREE.MeshStandardMaterial({ color: 0x1a1612, roughness: 1 }));
  bristles.position.y = 0.1;
  brush.add(bristles);
  brush.rotation.set(0, 0.2, Math.PI / 2);
  brush.position.set(0.02, 0.007, 0.06);
  group.add(brush);

  const pad = mesh(new THREE.BoxGeometry(0.07, 0.015, 0.05), new THREE.MeshStandardMaterial({ color: 0x1c1a17, roughness: 0.6 }));
  pad.position.set(0.16, 0.0075, -0.02);
  group.add(pad);
  const ink = mesh(new THREE.PlaneGeometry(0.06, 0.04), new THREE.MeshStandardMaterial({ color: 0x7a1510, roughness: 0.4 }));
  ink.rotation.x = -Math.PI / 2;
  ink.position.set(0.16, 0.0152, -0.02);
  group.add(ink);
  const hanko = new THREE.Group();
  hanko.add(mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.06, 16), new THREE.MeshStandardMaterial({ color: 0xd8cfb8, roughness: 0.4 })));
  const red = mesh(new THREE.CylinderGeometry(0.0092, 0.0092, 0.006, 16), new THREE.MeshStandardMaterial({ color: 0x8e1712, roughness: 0.6 }));
  red.position.y = -0.028;
  hanko.add(red);
  hanko.position.set(0.24, 0.03, -0.03);
  group.add(hanko);
  return group;
}

// Taza de té con el líquido frío.
function createTeacup() {
  const group = new THREE.Group();
  const cup = mesh(lathe([[0, 0], [0.026, 0], [0.028, 0.004], [0.034, 0.07], [0.031, 0.07], [0.025, 0.006], [0, 0.006]], 28), new THREE.MeshStandardMaterial({ color: 0x5c6a6a, roughness: 0.3, metalness: 0.05 }), { cast: true });
  group.add(cup);
  const tea = mesh(new THREE.CircleGeometry(0.03, 24), new THREE.MeshStandardMaterial({ color: 0x5a4a16, roughness: 0.1 }));
  tea.rotation.x = -Math.PI / 2;
  tea.position.y = 0.055;
  group.add(tea);
  return group;
}

// Pila de ofudas nuevos para volver a sellar.
function createOfudaStack() {
  const group = new THREE.Group();
  const tex = createOfudaTexture({ text: '封印', vertical: true });
  const top = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 });
  const sideMat = new THREE.MeshStandardMaterial({ color: 0xe3d4a6, roughness: 1 });
  for (let i = 0; i < 3; i += 1) {
    const s = mesh(new THREE.BoxGeometry(0.06, 0.008, 0.2), [sideMat, sideMat, top, sideMat, sideMat, sideMat], { cast: true });
    s.position.y = 0.004 + i * 0.008;
    s.rotation.y = (i - 1) * 0.08;
    group.add(s);
  }
  return group;
}

// Lupa articulada con aro de luz, apretada al borde de la mesa.
function createArmLamp() {
  const group = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color: 0x2f3b34, roughness: 0.5, metalness: 0.5 });
  const clamp = mesh(new THREE.BoxGeometry(0.06, 0.08, 0.05), paint, { cast: true });
  clamp.position.y = -0.02;
  group.add(clamp);
  const arm1 = mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.42, 10), steel, { cast: true });
  arm1.position.set(0, 0.2, -0.05);
  arm1.rotation.x = -0.25;
  group.add(arm1);
  const joint = mesh(new THREE.SphereGeometry(0.016, 12, 8), paint);
  joint.position.set(0, 0.4, -0.1);
  group.add(joint);
  const arm2 = mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.36, 10), steel, { cast: true });
  arm2.position.set(0, 0.43, 0.07);
  arm2.rotation.x = 1.4;
  group.add(arm2);
  // Resortes del brazo.
  const spring = mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.3, 6), steel);
  spring.position.set(0.018, 0.21, -0.04);
  spring.rotation.x = -0.25;
  group.add(spring);
  const head = new THREE.Group();
  head.position.set(0, 0.44, 0.25);
  head.rotation.x = -1.2;
  head.add(mesh(new THREE.TorusGeometry(0.075, 0.016, 12, 40), paint, { cast: true }));
  head.add(mesh(new THREE.CircleGeometry(0.068, 32), new THREE.MeshStandardMaterial({ color: 0xcfe0e4, transparent: true, opacity: 0.22, roughness: 0.02, metalness: 0.4 })));
  const ringLight = mesh(new THREE.TorusGeometry(0.068, 0.004, 8, 40), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xf4f2e6, emissiveIntensity: 0.5 }));
  ringLight.position.z = -0.006;
  head.add(ringLight);
  group.add(head);
  return group;
}

// Taburete de madera.
function createStool(wood) {
  const group = new THREE.Group();
  const seat = mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.04, 28), wood, { cast: true });
  seat.position.y = 0.6;
  group.add(seat);
  const legs = [];
  for (let i = 0; i < 4; i += 1) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    legs.push([new THREE.CylinderGeometry(0.016, 0.02, 0.6, 10), Math.cos(a) * 0.12, 0.3, Math.sin(a) * 0.12, Math.sin(a) * 0.12, 0, -Math.cos(a) * 0.12]);
  }
  legs.push([new THREE.TorusGeometry(0.12, 0.008, 6, 24), 0, 0.22, 0, Math.PI / 2, 0, 0]);
  group.add(merged(legs, wood, { cast: true }));
  return group;
}

// Mesa de inspección: madera barnizada, cajón, alfombra cuadriculada, bandeja laqueada,
// herramientas de la Ventana y la lámpara colgante que da la luz cenital.
export function createTable() {
  const group = new THREE.Group();
  group.name = 'table';
  const woodTex = varnishedWoodTextures(211, { hue: 22, light: 19 });
  const wood = new THREE.MeshStandardMaterial({ ...woodTex, color: 0xffffff, roughness: 1, bumpScale: 0.8 });
  const darkWood = new THREE.MeshStandardMaterial({ ...varnishedWoodTextures(223, { hue: 18, light: 12 }), color: 0xffffff, roughness: 1 });

  const top = mesh(new THREE.BoxGeometry(1.9, 0.06, 1.0), wood, { cast: true });
  top.position.y = 0.86;
  group.add(top);
  // Canto moldurado bajo la tapa.
  const edge = mesh(new THREE.BoxGeometry(1.86, 0.025, 0.96), darkWood);
  edge.position.y = 0.818;
  group.add(edge);
  // Faldón con cajón al frente.
  const apron = merged(
    [
      [new THREE.BoxGeometry(1.7, 0.11, 0.025), 0, 0.75, 0.43],
      [new THREE.BoxGeometry(1.7, 0.11, 0.025), 0, 0.75, -0.43],
      [new THREE.BoxGeometry(0.025, 0.11, 0.86), 0.84, 0.75, 0],
      [new THREE.BoxGeometry(0.025, 0.11, 0.86), -0.84, 0.75, 0],
    ],
    darkWood,
    { cast: true },
  );
  group.add(apron);
  const drawer = mesh(new THREE.BoxGeometry(0.6, 0.08, 0.012), wood);
  drawer.position.set(0.35, 0.75, 0.448);
  group.add(drawer);
  const pull = mesh(new THREE.TorusGeometry(0.022, 0.004, 8, 20, Math.PI), brass);
  pull.position.set(0.35, 0.745, 0.458);
  pull.rotation.z = Math.PI;
  group.add(pull);
  const keyhole = mesh(new THREE.CircleGeometry(0.008, 12), new THREE.MeshStandardMaterial({ color: 0x0a0806 }));
  keyhole.position.set(0.35, 0.772, 0.4545);
  group.add(keyhole);
  const plate = mesh(new THREE.CircleGeometry(0.014, 16), brass);
  plate.position.set(0.35, 0.772, 0.4542);
  group.add(plate);

  // Patas ahusadas con regatones de bronce y travesaños en H.
  const legParts = [];
  const footParts = [];
  [[-0.84, -0.42], [0.84, -0.42], [-0.84, 0.42], [0.84, 0.42]].forEach(([x, z]) => {
    legParts.push([new THREE.CylinderGeometry(0.045, 0.032, 0.7, 4), x, 0.36, z, 0, Math.PI / 4, 0]);
    footParts.push([new THREE.CylinderGeometry(0.03, 0.034, 0.025, 12), x, 0.0125, z]);
  });
  legParts.push([new THREE.BoxGeometry(0.035, 0.05, 0.8), -0.84, 0.18, 0]);
  legParts.push([new THREE.BoxGeometry(0.035, 0.05, 0.8), 0.84, 0.18, 0]);
  legParts.push([new THREE.BoxGeometry(1.64, 0.05, 0.035), 0, 0.18, 0]);
  group.add(merged(legParts, darkWood, { cast: true }));
  group.add(merged(footParts, brass));

  // Alfombra de inspección y bandeja laqueada con terciopelo.
  const matMesh = mesh(new THREE.BoxGeometry(1.1, 0.004, 0.68), [
    blackPlastic, blackPlastic, new THREE.MeshStandardMaterial({ map: matTexture(5), roughness: 0.85 }), blackPlastic, blackPlastic, blackPlastic,
  ]);
  matMesh.position.y = 0.892;
  group.add(matMesh);
  const lacquer = new THREE.MeshStandardMaterial({ color: 0x0f0d0c, roughness: 0.18, metalness: 0.1 });
  const trayRim = merged(
    [
      [new THREE.BoxGeometry(0.47, 0.03, 0.02), 0, 0.909, 0.125],
      [new THREE.BoxGeometry(0.47, 0.03, 0.02), 0, 0.909, -0.125],
      [new THREE.BoxGeometry(0.02, 0.03, 0.27), 0.225, 0.909, 0],
      [new THREE.BoxGeometry(0.02, 0.03, 0.27), -0.225, 0.909, 0],
      [new THREE.BoxGeometry(0.47, 0.012, 0.27), 0, 0.9, 0],
    ],
    lacquer,
    { cast: true },
  );
  group.add(trayRim);
  const velvet = mesh(new THREE.PlaneGeometry(0.43, 0.23), new THREE.MeshStandardMaterial({ color: 0x4a1112, roughness: 1 }));
  velvet.rotation.x = -Math.PI / 2;
  velvet.position.y = 0.907;
  group.add(velvet);
  // Filete dorado del borde de la bandeja.
  const gold = merged(
    [
      [new THREE.BoxGeometry(0.47, 0.003, 0.004), 0, 0.9245, 0.133],
      [new THREE.BoxGeometry(0.47, 0.003, 0.004), 0, 0.9245, -0.133],
      [new THREE.BoxGeometry(0.004, 0.003, 0.27), 0.233, 0.9245, 0],
      [new THREE.BoxGeometry(0.004, 0.003, 0.27), -0.233, 0.9245, 0],
    ],
    brass,
  );
  group.add(gold);

  // Útiles sobre la mesa.
  const notebook = createNotebook();
  notebook.position.set(-0.55, 0.894, 0.16);
  notebook.rotation.y = 0.15;
  group.add(notebook);
  const clipboard = createClipboard();
  clipboard.position.set(0.62, 0.894, 0.18);
  clipboard.rotation.y = -0.2;
  group.add(clipboard);
  const tools = createTools();
  tools.position.set(-0.1, 0.894, 0.25);
  group.add(tools);
  const loupe = createLoupe();
  loupe.position.set(0.33, 0.9, -0.04);
  loupe.rotation.z = 0.6;
  group.add(loupe);
  const cup = createTeacup();
  cup.position.set(-0.78, 0.89, -0.3);
  group.add(cup);
  const stack = createOfudaStack();
  stack.position.set(-0.4, 0.894, -0.22);
  stack.rotation.y = 0.5;
  group.add(stack);
  const armLamp = createArmLamp();
  armLamp.position.set(0.82, 0.9, -0.44);
  armLamp.rotation.y = -0.6;
  group.add(armLamp);
  const stool = createStool(darkWood);
  stool.position.set(-1.25, 0, 0.25);
  group.add(stool);
  // Caja de herramientas debajo.
  const toolbox = mesh(new THREE.BoxGeometry(0.4, 0.16, 0.2), new THREE.MeshStandardMaterial({ color: 0x6e1a14, roughness: 0.5, metalness: 0.5 }), { cast: true });
  toolbox.position.set(-0.4, 0.29, 0);
  group.add(toolbox);
  const tbHandle = mesh(new THREE.TorusGeometry(0.06, 0.006, 6, 16, Math.PI), steel);
  tbHandle.position.set(-0.4, 0.37, 0);
  group.add(tbHandle);

  const hit = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.5, 1.0), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.y = 0.95;
  hit.userData = { type: 'table' };
  group.add(hit);

  // Lámpara colgante esmaltada: la luz cenital dura del prototipo.
  const cable = mesh(new THREE.CylinderGeometry(0.005, 0.005, 1.0, 6), new THREE.MeshStandardMaterial({ color: 0x111111 }));
  cable.position.y = 2.68;
  const socket = mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.08, 16), blackPlastic);
  socket.position.y = 2.14;
  const enamel = new THREE.MeshStandardMaterial({ color: 0x2c4234, roughness: 0.35, metalness: 0.3, side: THREE.FrontSide });
  const inner = new THREE.MeshStandardMaterial({ color: 0xf0ece0, emissive: 0xfff0d0, emissiveIntensity: 0.25, roughness: 0.4, side: THREE.BackSide });
  const shadeProfile = [[0.035, 0.14], [0.06, 0.12], [0.12, 0.06], [0.2, 0.01], [0.24, 0]];
  const shade = mesh(lathe(shadeProfile, 40), enamel, { cast: true });
  const shadeInner = mesh(lathe(shadeProfile.map(([x, y]) => [x - 0.003, y]), 40), inner);
  [shade, shadeInner].forEach((s) => (s.position.y = 1.96));
  const rim = mesh(new THREE.TorusGeometry(0.24, 0.006, 8, 48), enamel);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 1.96;
  const bulb = mesh(new THREE.SphereGeometry(0.045, 16, 10), new THREE.MeshStandardMaterial({ emissive: 0xfff0d0, emissiveIntensity: 4, color: 0xffffff }));
  bulb.position.y = 2.02;
  group.add(cable, socket, shade, shadeInner, rim, bulb);

  // Cono de luz visible por el polvo (falso volumen).
  const beamCanvas = document.createElement('canvas');
  beamCanvas.width = 4;
  beamCanvas.height = 128;
  const bctx = beamCanvas.getContext('2d');
  const grad = bctx.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, 'rgba(255,230,190,0.0)');
  grad.addColorStop(0.15, 'rgba(255,230,190,0.5)');
  grad.addColorStop(1, 'rgba(255,230,190,0.0)');
  bctx.fillStyle = grad;
  bctx.fillRect(0, 0, 4, 128);
  const beamTex = new THREE.CanvasTexture(beamCanvas);
  beamTex.colorSpace = THREE.SRGBColorSpace;
  const beam = mesh(
    new THREE.CylinderGeometry(0.22, 0.75, 1.05, 40, 1, true),
    new THREE.MeshBasicMaterial({ map: beamTex, transparent: true, opacity: 0.09, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    { receive: false },
  );
  beam.position.y = 1.44;
  beam.renderOrder = 5;
  beam.name = 'lamp-beam';
  group.add(beam);

  const lamp = new THREE.SpotLight(0xffd9a8, 24, 5, 0.6, 0.5, 1.4);
  lamp.position.set(0, 1.95, 0);
  lamp.target.position.set(0, 0.86, 0);
  lamp.castShadow = true;
  lamp.shadow.mapSize.set(1024, 1024);
  lamp.shadow.bias = -0.0005;
  group.add(lamp, lamp.target);

  const slot = new THREE.Group();
  slot.position.set(0, 0.935, 0);
  slot.name = 'table-slot';
  group.add(slot);

  return { group, slot, lamp, beam };
}

// Relicario sobre la mesa: el dedo elegido con sus sellos, en escala real.
export function createTableRelic(caseData, sealState) {
  const group = new THREE.Group();
  const { group: finger, skin } = createFinger(caseData.length);
  group.add(finger);
  const bands = [];
  caseData.seals.forEach((seal) => {
    if (sealState?.[seal.id]?.peeled) return;
    const band = createSealBand(seal, caseData.length);
    group.add(band);
    bands.push(band);
  });
  const aura = new THREE.Mesh(skin.geometry, createAuraMaterial());
  group.add(aura);
  applyFingerModel(finger, aura, caseData.length).then((profile) => {
    if (profile) bands.forEach((band) => fitBandToProfile(band, profile));
  });
  group.scale.setScalar(0.03);
  group.position.y = 0.025;
  group.userData = { aura };
  return group;
}
