// Empaqueta los modelos de Sketchfab de la expansión de dominio (.gltf + .bin + texturas
// sueltas) en .glb livianos para public/models: saca atributos que no se usan, pasa los
// índices a 16 bits cuando entran y achica las texturas con sharp (ya instalado por Next).
//
// Uso: node scripts/build-domain-models.cjs <carpeta del proyecto> <carpeta de fuentes>
// La carpeta de fuentes tiene que tener los zips de Sketchfab descomprimidos en dos
// subcarpetas: shrine/ ("malevolent_shrine_jjk_cc") y sukuna/ ("sukuna_free_fire_skin").
// Ejemplo: node scripts/build-domain-models.cjs . ../modelos-originales
const fs = require('fs');
const path = require('path');

const project = process.argv[2];
const sources = process.argv[3];
const sharp = require(path.join(project, 'node_modules', 'sharp'));

const COMPONENT_SIZE = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
const TYPE_COUNT = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };
const ARRAY_BUFFER = 34962;
const ELEMENT_ARRAY_BUFFER = 34963;

async function pack(srcDir, outFile, { dropAttribute = () => false, image, editJson } = {}) {
  const gltf = JSON.parse(fs.readFileSync(path.join(srcDir, 'scene.gltf'), 'utf8'));
  const bin = fs.readFileSync(path.join(srcDir, gltf.buffers[0].uri));

  // 1. Atributos que no usa ningún material.
  gltf.meshes.forEach((mesh) =>
    mesh.primitives.forEach((p) => {
      Object.keys(p.attributes).forEach((name) => {
        if (dropAttribute(name, p)) delete p.attributes[name];
      });
    }),
  );

  // 2. Accesos que siguen en uso y para qué.
  const role = new Map();
  gltf.meshes.forEach((mesh) =>
    mesh.primitives.forEach((p) => {
      Object.values(p.attributes).forEach((a) => role.set(a, 'vertex'));
      if (p.indices !== undefined) role.set(p.indices, 'index');
    }),
  );
  (gltf.skins ?? []).forEach((s) => s.inverseBindMatrices !== undefined && role.set(s.inverseBindMatrices, 'other'));
  (gltf.animations ?? []).forEach((a) =>
    a.samplers.forEach((s) => {
      role.set(s.input, 'other');
      role.set(s.output, 'other');
    }),
  );

  // 3. Buffer nuevo, sin huecos.
  const chunks = [];
  let offset = 0;
  const views = [];
  const addView = (data, target, byteStride) => {
    const pad = (4 - (offset % 4)) % 4;
    if (pad) {
      chunks.push(Buffer.alloc(pad));
      offset += pad;
    }
    const view = { buffer: 0, byteOffset: offset, byteLength: data.length };
    if (target) view.target = target;
    if (byteStride) view.byteStride = byteStride;
    chunks.push(data);
    offset += data.length;
    views.push(view);
    return views.length - 1;
  };

  const accessorMap = new Map();
  const accessors = [];
  [...role.keys()].sort((a, b) => a - b).forEach((index) => {
    const acc = gltf.accessors[index];
    if (acc.sparse) throw new Error('accesos dispersos no soportados');
    const view = gltf.bufferViews[acc.bufferView];
    const elementSize = COMPONENT_SIZE[acc.componentType] * TYPE_COUNT[acc.type];
    const stride = view.byteStride || elementSize;
    const start = (view.byteOffset ?? 0) + (acc.byteOffset ?? 0);
    let data = Buffer.alloc(acc.count * elementSize);
    for (let k = 0; k < acc.count; k += 1) bin.copy(data, k * elementSize, start + k * stride, start + k * stride + elementSize);
    const next = { ...acc };
    delete next.byteOffset;
    if (role.get(index) === 'index' && acc.componentType === 5125) {
      const source = new Uint32Array(data.buffer, data.byteOffset, acc.count);
      let maxIndex = 0;
      for (let k = 0; k < source.length; k += 1) maxIndex = Math.max(maxIndex, source[k]);
      if (maxIndex < 65535) {
        data = Buffer.from(Uint16Array.from(source).buffer);
        next.componentType = 5123;
      }
    }
    if (role.get(index) === 'vertex' && elementSize % 4) throw new Error('atributo sin alinear');
    const target = role.get(index) === 'vertex' ? ARRAY_BUFFER : role.get(index) === 'index' ? ELEMENT_ARRAY_BUFFER : undefined;
    next.bufferView = addView(data, target);
    accessors.push(next);
    accessorMap.set(index, accessors.length - 1);
  });

  const remap = (i) => accessorMap.get(i);
  gltf.meshes.forEach((mesh) =>
    mesh.primitives.forEach((p) => {
      Object.keys(p.attributes).forEach((name) => (p.attributes[name] = remap(p.attributes[name])));
      if (p.indices !== undefined) p.indices = remap(p.indices);
    }),
  );
  (gltf.skins ?? []).forEach((s) => {
    if (s.inverseBindMatrices !== undefined) s.inverseBindMatrices = remap(s.inverseBindMatrices);
  });
  (gltf.animations ?? []).forEach((a) =>
    a.samplers.forEach((s) => {
      s.input = remap(s.input);
      s.output = remap(s.output);
    }),
  );

  // 4. Texturas adentro del .glb.
  for (let i = 0; i < (gltf.images ?? []).length; i += 1) {
    const img = gltf.images[i];
    const file = path.join(srcDir, decodeURIComponent(img.uri));
    const { data, mimeType } = await image(file, img);
    gltf.images[i] = { name: path.basename(img.uri).replace(/\.[^.]+$/, ''), bufferView: addView(data), mimeType };
  }

  gltf.accessors = accessors;
  gltf.bufferViews = views;
  const body = Buffer.concat(chunks);
  gltf.buffers = [{ byteLength: body.length }];
  editJson?.(gltf);

  // 5. Contenedor GLB: encabezado, JSON (relleno con espacios) y binario (relleno con ceros).
  let json = Buffer.from(JSON.stringify(gltf), 'utf8');
  json = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 0x20)]);
  const binChunk = Buffer.concat([body, Buffer.alloc((4 - (body.length % 4)) % 4)]);
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + json.length + 8 + binChunk.length, 8);
  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(json.length, 0);
  jsonHeader.writeUInt32LE(0x4e4f534a, 4);
  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(binChunk.length, 0);
  binHeader.writeUInt32LE(0x004e4942, 4);
  fs.writeFileSync(outFile, Buffer.concat([header, jsonHeader, json, binHeader, binChunk]));
  return fs.statSync(outFile).size;
}

// Texturas del santuario: color y relieve a 1024, metal/rugosidad a 512, todo en JPEG.
async function shrineImage(file) {
  const name = path.basename(file);
  const normal = name.includes('_normal');
  const size = name.includes('_metallicRoughness') ? 512 : 1024;
  const data = await sharp(file)
    .resize(size, size)
    .removeAlpha()
    .jpeg({ quality: normal ? 90 : 82, mozjpeg: true, chromaSubsampling: normal ? '4:4:4' : '4:2:0' })
    .toBuffer();
  return { data, mimeType: 'image/jpeg' };
}

// Texturas de Sukuna: ya son chicas, se recomprimen en PNG.
async function sukunaImage(file) {
  const data = await sharp(file).png({ compressionLevel: 9, palette: false }).toBuffer();
  return { data, mimeType: 'image/png' };
}

(async () => {
  const out = path.join(project, 'public', 'models');
  const shrineSize = await pack(path.join(sources, 'shrine'), path.join(out, 'malevolent-shrine.glb'), {
    // Solo el material 2 usa TEXCOORD_1 y TEXCOORD_2. Las tangentes se calculan en el shader.
    dropAttribute: (name, p) => name === 'TANGENT' || name === 'TEXCOORD_3' || ((name === 'TEXCOORD_1' || name === 'TEXCOORD_2') && p.material !== 2),
    image: shrineImage,
  });
  const sukunaSize = await pack(path.join(sources, 'sukuna'), path.join(out, 'sukuna.glb'), {
    image: sukunaImage,
    // Materiales "unlit" → con luz: en la escena tiene que poder quedar en sombra.
    editJson: (gltf) => {
      gltf.materials.forEach((m) => {
        delete m.extensions?.KHR_materials_unlit;
        if (m.extensions && !Object.keys(m.extensions).length) delete m.extensions;
        m.pbrMetallicRoughness = { ...m.pbrMetallicRoughness, metallicFactor: 0, roughnessFactor: 0.85 };
      });
      gltf.extensionsUsed = (gltf.extensionsUsed ?? []).filter((e) => e !== 'KHR_materials_unlit');
      if (!gltf.extensionsUsed.length) delete gltf.extensionsUsed;
    },
  });
  fs.copyFileSync(path.join(sources, 'shrine', 'license.txt'), path.join(out, 'malevolent-shrine-LICENSE.txt'));
  fs.copyFileSync(path.join(sources, 'sukuna', 'license.txt'), path.join(out, 'sukuna-LICENSE.txt'));
  console.log('malevolent-shrine.glb', (shrineSize / 1048576).toFixed(2), 'MB');
  console.log('sukuna.glb', (sukunaSize / 1048576).toFixed(2), 'MB');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
