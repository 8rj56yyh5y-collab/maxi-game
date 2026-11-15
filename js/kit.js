// Фотореалистичные модульные наборы (Poly Haven, CC0): загрузка, нарезка на модули, расстановка инстансами.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
const scenes = {};      // имя файла → gltf.scene
const loading = {};
const templates = {};   // 'kit/модуль' → [{ geo, mat }]

export function loadKits(names, onProgress) {
  let done = 0;
  return Promise.all(names.map(n => {
    if (scenes[n]) { onProgress && onProgress(++done / names.length); return null; }
    loading[n] = loading[n] || loader.loadAsync(`assets/kits/${n}.glb`).then(g => {
      scenes[n] = g.scene;
      g.scene.updateMatrixWorld(true);
      g.scene.traverse(o => { if (o.isMesh) prepMaterial(o.material); });
    });
    return loading[n].then(() => { onProgress && onProgress(++done / names.length); });
  }));
}
export const kitLoaded = (n) => !!scenes[n];

function prepMaterial(m) {
  if (m.userData.prepped) return;
  m.userData.prepped = true;
  const glass = m.transparent || /glass/i.test(m.name);
  m.side = glass ? THREE.DoubleSide : THREE.FrontSide;
  if (glass) { m.transparent = true; m.opacity = Math.min(m.opacity, 0.55); m.depthWrite = false; m.roughness = 0.05; m.metalness = 0.6; m.envMapIntensity = 1.6; }
  for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap']) if (m[k]) m[k].anisotropy = 8;
}

function toFloat(a) {
  if (a.array instanceof Float32Array && !a.normalized && !a.isInterleavedBufferAttribute) return a;
  const n = a.itemSize, f = new Float32Array(a.count * n), get = [a.getX, a.getY, a.getZ, a.getW];
  for (let i = 0; i < a.count; i++) for (let c = 0; c < n; c++) f[i * n + c] = get[c].call(a, i);
  return new THREE.BufferAttribute(f, n);
}

// Собрать шаблон из набора узлов: геометрии в мировых координатах набора, сдвинутые на offset
function bake(nodes, offset) {
  const byMat = new Map();
  for (const n of nodes) n.traverse(o => {
    if (!o.isMesh) return;
    const g = o.geometry.clone();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'tangent'].includes(k)) g.deleteAttribute(k);
    for (const k of Object.keys(g.attributes)) g.setAttribute(k, toFloat(g.attributes[k]));
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!g.attributes.normal) g.computeVertexNormals();
    if (g.attributes.tangent) g.deleteAttribute('tangent');
    g.applyMatrix4(o.matrixWorld);
    g.translate(-offset.x, -offset.y, -offset.z);
    const list = byMat.get(o.material) || []; list.push(g); byMat.set(o.material, list);
  });
  const out = [];
  for (const [mat, list] of byMat) {
    const idx = list.some(g => g.index), geos = list.map(g => (idx && !g.index) ? g.setIndex([...Array(g.attributes.position.count).keys()]) : g);
    out.push({ mat, geo: geos.length === 1 ? geos[0] : mergeGeometries(geos, false) });
  }
  return out;
}

const _b = new THREE.Box3();
const boxOf = (o) => _b.setFromObject(o).clone();

// Модуль фасада: стена с именем wallName + всё, что лежит в той же ячейке (окна, двери, подоконники)
export function facadeModule(kit, wallName) {
  const key = kit + '/' + wallName;
  if (templates[key]) return templates[key];
  const sc = scenes[kit]; if (!sc) return null;
  const wall = sc.getObjectByName(wallName); if (!wall) { console.warn('нет модуля', key); return null; }
  const wb = boxOf(wall);
  const front = wb.max.z;
  const parts = [wall];
  const cx = (wb.min.x + wb.max.x) / 2, cy = (wb.min.y + wb.max.y) / 2, cz = (wb.min.z + wb.max.z) / 2;
  for (const o of sc.children) {
    if (o === wall || /^(wall|dado|cornice|crown|base)/.test(o.name)) continue;
    const b = boxOf(o), oc = b.getCenter(new THREE.Vector3());
    if (oc.x > wb.min.x && oc.x < wb.max.x && oc.y > wb.min.y && oc.y < wb.max.y && Math.abs(oc.z - cz) < 1.0) parts.push(o);
  }
  const t = { parts: bake(parts, new THREE.Vector3(wb.min.x, wb.min.y, Math.round(front * 100) / 100)), w: wb.max.x - wb.min.x, h: wb.max.y - wb.min.y };
  templates[key] = t;
  return t;
}

// Отдельная деталь (карниз, цоколь, угол) — привязка: левый край, низ, линия стены z=0 (или центр для mode 'center')
export function piece(kit, name, mode = 'edge') {
  const key = kit + '/' + name + '#' + mode;
  if (templates[key]) return templates[key];
  const sc = scenes[kit]; if (!sc) return null;
  const o = sc.getObjectByName(name); if (!o) { console.warn('нет детали', key); return null; }
  const b = boxOf(o);
  const off = mode === 'center' ? new THREE.Vector3((b.min.x + b.max.x) / 2, b.min.y, (b.min.z + b.max.z) / 2)
    : new THREE.Vector3(b.min.x, b.min.y, Math.abs((b.min.z + b.max.z) / 2) < 1 ? 0 : Math.round((b.min.z + b.max.z) / 2));
  const t = { parts: bake([o], off), w: b.max.x - b.min.x, h: b.max.y - b.min.y, d: b.max.z - b.min.z };
  templates[key] = t;
  return t;
}

// Целая модель-реквизит (центр по X/Z, низ на 0)
export function prop(kit) {
  const key = kit + '/*';
  if (templates[key]) return templates[key];
  const sc = scenes[kit]; if (!sc) return null;
  const b = boxOf(sc);
  const t = { parts: bake(sc.children, new THREE.Vector3((b.min.x + b.max.x) / 2, b.min.y, (b.min.z + b.max.z) / 2)), size: b.getSize(new THREE.Vector3()) };
  templates[key] = t;
  return t;
}

// Отдельные узлы набора как реквизит (например, один фонарный столб из набора столбов)
export function nodeProp(kit, name) {
  const key = kit + '/' + name + '#node';
  if (templates[key]) return templates[key];
  const sc = scenes[kit]; if (!sc) return null;
  const o = sc.getObjectByName(name); if (!o) { console.warn('нет узла', key); return null; }
  const b = boxOf(o);
  const t = { parts: bake([o], new THREE.Vector3((b.min.x + b.max.x) / 2, b.min.y, (b.min.z + b.max.z) / 2)), size: b.getSize(new THREE.Vector3()) };
  templates[key] = t;
  return t;
}
export function kitNodeNames(kit) { return scenes[kit] ? scenes[kit].children.map(o => o.name) : []; }

// Накопитель инстансов
export class KitBuilder {
  constructor() { this.inst = new Map(); this.colliders = []; }
  // t — шаблон; x,y,z — позиция; ry — поворот вокруг Y; s — масштаб (число или [sx,sy,sz])
  add(t, x, y, z, ry = 0, s = 1) {
    if (!t) return;
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), Array.isArray(s) ? new THREE.Vector3(...s) : new THREE.Vector3(s, s, s));
    for (const p of t.parts) { const l = this.inst.get(p) || []; l.push(m); this.inst.set(p, l); }
  }
  // реквизит с коллайдером по габаритам
  solid(t, x, z, ry = 0, s = 1, y = 0, hMax = 99) {
    if (!t) return;
    this.add(t, x, y, z, ry, s);
    const sx = t.size.x * s, sz = t.size.z * s, c = Math.abs(Math.cos(ry)), sn = Math.abs(Math.sin(ry));
    const hw = (sx * c + sz * sn) / 2, hd = (sx * sn + sz * c) / 2;
    this.colliders.push({ min: [x - hw, y, z - hd], max: [x + hw, y + Math.min(hMax, t.size.y * s), z + hd] });
  }
  build(group, shadows) {
    for (const [p, list] of this.inst) {
      const im = new THREE.InstancedMesh(p.geo, p.mat, list.length);
      list.forEach((m, i) => im.setMatrixAt(i, m));
      im.computeBoundingSphere(); im.computeBoundingBox && im.computeBoundingBox();
      const glass = p.mat.transparent;
      im.castShadow = shadows && !glass; im.receiveShadow = shadows;
      if (glass) im.renderOrder = 2;
      group.add(im);
    }
  }
}

// Группа узлов по регулярному выражению имени как один реквизит.
// mode: 'center' — центр X/Z, 'back' — центр X, задняя грань по Z на 0 (для крепления к стене)
export function groupProp(kit, re, mode = 'center') {
  const key = kit + '/' + re + '#' + mode;
  if (templates[key]) return templates[key];
  const sc = scenes[kit]; if (!sc) return null;
  const nodes = sc.children.filter(o => re.test(o.name));
  if (!nodes.length) { console.warn('нет группы', key); return null; }
  const b = new THREE.Box3(); for (const n of nodes) b.expandByObject(n);
  const off = new THREE.Vector3((b.min.x + b.max.x) / 2, b.min.y, mode === 'back' ? b.min.z : (b.min.z + b.max.z) / 2);
  const t = { parts: bake(nodes, off), size: b.getSize(new THREE.Vector3()) };
  templates[key] = t;
  return t;
}
