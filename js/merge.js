// Склейка геометрии: меньше объектов — меньше вызовов отрисовки (выше FPS).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

function prep(geo, matrix, color) {
  let g = geo.index ? geo.toNonIndexed() : geo.clone();
  for (const n of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(n)) g.deleteAttribute(n);
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  g.applyMatrix4(matrix);
  if (color) {
    const n = g.attributes.position.count, arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = color.r; arr[i * 3 + 1] = color.g; arr[i * 3 + 2] = color.b; }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  }
  return g;
}

// Собирает меши-потомки группы (не заходя во вложенные Group)
function collect(group, out = [], parentMatrix = new THREE.Matrix4()) {
  for (const c of group.children) {
    if (!c.isMesh) continue;
    c.updateMatrix();
    const m = parentMatrix.clone().multiply(c.matrix);
    out.push({ mesh: c, matrix: m });
    collect(c, out, m);
  }
  return out;
}

// Склейка по материалам (для оружия)
export function mergeByMaterial(group) {
  const items = collect(group);
  const byMat = new Map();
  for (const it of items) {
    if (it.mesh.material.transparent || it.mesh.renderOrder) continue;
    if (!byMat.has(it.mesh.material)) byMat.set(it.mesh.material, []);
    byMat.get(it.mesh.material).push(it);
  }
  for (const [mat, list] of byMat) {
    if (list.length < 2) continue;
    const geo = mergeGeometries(list.map(it => prep(it.mesh.geometry, it.matrix)), false);
    if (!geo) continue;
    for (const it of list) { it.mesh.parent.remove(it.mesh); }
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    group.add(m);
  }
}

// Склейка в один меш с цветами вершин (для бойцов)
const vcMats = new Map();
export function mergeVertexColors(group) {
  const items = collect(group).filter(it => !it.mesh.material.transparent);
  if (items.length < 2) return;
  const geos = items.map(it => prep(it.mesh.geometry, it.matrix, it.mesh.material.color));
  const geo = mergeGeometries(geos, false);
  if (!geo) return;
  for (const it of items) it.mesh.parent && it.mesh.parent.remove(it.mesh);
  const rough = 0.8;
  if (!vcMats.has(rough)) vcMats.set(rough, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: rough, metalness: 0.05 }));
  const m = new THREE.Mesh(geo, vcMats.get(rough));
  m.castShadow = true;
  group.add(m);
}
