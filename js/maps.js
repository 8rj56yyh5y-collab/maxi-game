// Карты. Каждая коробка: [x1, z1, x2, z2, высота, поверхность, y0]
import * as THREE from 'three';
import { surfaceTexture } from './textures.js';

function perimeter(x1, z1, x2, z2, h = 7, mat = 'border') {
  return [
    [x1 - 1, z1 - 1, x2 + 1, z1, h, mat], [x1 - 1, z2, x2 + 1, z2 + 1, h, mat],
    [x1 - 1, z1, x1, z2, h, mat], [x2, z1, x2 + 1, z2, h, mat],
  ];
}

// Зеркалирование коробок по оси X (для симметричных карт)
function mirrorX(list) {
  return list.map(([x1, z1, x2, z2, h, m, y0]) => [-x2, -z2, -x1, -z1, h, m, y0]);
}

const oasisHalf = [
  // спаун A
  [-33, -4, -31, 4, 1.5, 'concrete'], [-36, 10, -34, 12, 0.9, 'crate'], [-36, -12, -34, -10, 0.9, 'crate'],
  [-41, -31, -31, -24, 6, 'wall2'], [-41, 24, -31, 31, 6, 'wall'],
  // ряд домов между верхом и центром
  [-26, 7, -9, 15, 5, 'wall'],
  // ряд домов между центром и низом
  [-26, -15, -11, -7, 5, 'wall2'],
  // центр
  [-16, -3, -14, -1, 0.9, 'crate'], [-8, 2, -6, 4, 1.8, 'crate'],
  // верх
  [-18, 24, -16, 26, 0.9, 'crate'], [-10, 27, -7, 29, 1.8, 'crate'],
  // низ
  [-18, -21, -16, -19, 0.9, 'crate'], [-12, -29, -10, -27, 1.8, 'crate'],
];

export const MAPS = {
  oasis: {
    id: 'oasis', name: 'Оазис', desc: 'Пустынный городок, три линии', ground: 'sand',
    sky: 0xbfd8ee, fog: 0xd9cdb5, sun: 0xfff1d6,
    bounds: [-41, -31, 41, 31],
    boxes: [
      ...perimeter(-41, -31, 41, 31, 7, 'border'),
      ...oasisHalf, ...mirrorX(oasisHalf),
      [-4, 7, 4, 15, 8, 'wall2'], [-6, -15, 6, -7, 4.5, 'wall'],
      [-1.2, -1.2, 1.2, 1.2, 0.9, 'crate'], [-1.2, -1.2, 0, 0, 0.9, 'crate', 0.9],
      [-1, 18, 1, 25, 3, 'wall2'],
      [-6, -23, 6, -22, 1.2, 'concrete'],
    ],
    spawns: {
      A: [[-38, -6], [-38, -2], [-38, 2], [-38, 6], [-36, 0], [-39, 8], [-39, -8]],
      B: [[38, -6], [38, -2], [38, 2], [38, 6], [36, 0], [39, 8], [39, -8]],
    },
    points: [[0, 22], [0, -19], [0, 4], [-20, 0], [20, 0], [-20, 22], [20, 22], [-20, -20], [20, -20], [-7, 11], [7, 11], [-8, -11], [8, -11]],
  },
  port: {
    id: 'port', name: 'Порт', desc: 'Контейнерный терминал, ближний бой', ground: 'asphalt',
    sky: 0x9fb4c8, fog: 0xa9b6c0, sun: 0xffffff,
    bounds: [-36, -36, 36, 36],
    boxes: [
      ...perimeter(-36, -36, 36, 36, 6, 'dark'),
      // склад в центре
      [-8, 7.4, -1.5, 8, 4, 'concrete'], [1.5, 7.4, 8, 8, 4, 'concrete'],
      [-8, -8, -1.5, -7.4, 4, 'concrete'], [1.5, -8, 8, -7.4, 4, 'concrete'],
      [-8, -7.4, -7.4, -1.5, 4, 'concrete'], [-8, 1.5, -7.4, 7.4, 4, 'concrete'],
      [7.4, -7.4, 8, -1.5, 4, 'concrete'], [7.4, 1.5, 8, 7.4, 4, 'concrete'],
      [-4, -4, -2.5, -2.5, 0.9, 'crate'], [2.5, 2.5, 4, 4, 0.9, 'crate'], [-0.8, -0.8, 0.8, 0.8, 1.8, 'crate'],
      // контейнеры
      [-24, -24, -18, -21.5, 2.6, 'metal_r'], [18, 21.5, 24, 24, 2.6, 'metal_b'],
      [-24, -24, -18, -21.5, 2.6, 'metal_o', 2.6], [18, 21.5, 24, 24, 2.6, 'metal_g', 2.6],
      [18, -24, 24, -21.5, 2.6, 'metal_g'], [-24, 21.5, -18, 24, 2.6, 'metal_o'],
      [-30, -10, -27.5, -4, 2.6, 'metal_b'], [27.5, 4, 30, 10, 2.6, 'metal_r'],
      [-30, 4, -27.5, 10, 2.6, 'metal_g'], [27.5, -10, 30, -4, 2.6, 'metal_o'],
      [-18, -14, -12, -11.5, 2.6, 'metal_o'], [12, 11.5, 18, 14, 2.6, 'metal_r'],
      [-18, 11.5, -12, 14, 2.6, 'metal_b'], [12, -14, 18, -11.5, 2.6, 'metal_b'],
      [-3, -22, 3, -19.5, 2.6, 'metal_r'], [-3, 19.5, 3, 22, 2.6, 'metal_g'],
      [-20, -2, -17.5, 4, 2.6, 'metal_r'], [17.5, -4, 20, 2, 2.6, 'metal_o'],
      // ящики
      [-10, -27, -8, -25, 0.9, 'crate'], [8, 25, 10, 27, 0.9, 'crate'],
      [10, -28, 12, -26, 1.8, 'crate'], [-12, 26, -10, 28, 1.8, 'crate'],
      [-26, -1, -24, 1, 0.9, 'crate'], [24, -1, 26, 1, 0.9, 'crate'],
      [-12, -5, -10.5, -3.5, 0.9, 'crate'], [10.5, 3.5, 12, 5, 0.9, 'crate'],
    ],
    spawns: {
      A: [[-6, -33], [-2, -33], [2, -33], [6, -33], [0, -31], [-10, -32], [10, -32]],
      B: [[-6, 33], [-2, 33], [2, 33], [6, 33], [0, 31], [-10, 32], [10, 32]],
    },
    points: [[0, 0], [0, -14], [0, 14], [-14, 0], [14, 0], [-24, 0], [24, 0], [-14, -24], [14, 24], [-24, 14], [24, -14], [-5, 5], [5, -5]],
  },
};

// Сборка карты в сцену. Возвращает данные для физики и навигации.
export function buildMap(scene, id, quality) {
  const def = MAPS[id];
  const group = new THREE.Group();
  const colliders = [];
  const matCache = {};
  const getMat = (name) => {
    if (!matCache[name]) {
      const { tex } = surfaceTexture(name);
      matCache[name] = new THREE.MeshLambertMaterial({ map: tex });
    }
    return matCache[name];
  };

  for (const b of def.boxes) {
    const [x1, z1, x2, z2, h, matName, y0 = 0] = b;
    const w = x2 - x1, d = z2 - z1;
    const geo = new THREE.BoxGeometry(w, h, d);
    const { tile } = surfaceTexture(matName);
    tileUVs(geo, w, h, d, tile);
    const mesh = new THREE.Mesh(geo, getMat(matName));
    mesh.position.set((x1 + x2) / 2, y0 + h / 2, (z1 + z2) / 2);
    mesh.castShadow = quality !== 'low';
    mesh.receiveShadow = quality !== 'low';
    group.add(mesh);
    colliders.push({ min: [x1, y0, z1], max: [x2, y0 + h, z2] });
  }

  // Пол
  const [bx1, bz1, bx2, bz2] = def.bounds;
  const fw = bx2 - bx1 + 20, fd = bz2 - bz1 + 20;
  const { tex: gt, tile: gtile } = surfaceTexture(def.ground);
  const groundTex = gt.clone(); groundTex.needsUpdate = true;
  groundTex.repeat.set(fw / gtile, fd / gtile);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(fw, fd), new THREE.MeshLambertMaterial({ map: groundTex }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set((bx1 + bx2) / 2, 0, (bz1 + bz2) / 2);
  floor.receiveShadow = quality !== 'low';
  group.add(floor);

  // Свет
  const hemi = new THREE.HemisphereLight(0xffffff, 0x8a7a60, 1.25);
  group.add(hemi);
  const sun = new THREE.DirectionalLight(def.sun, 1.7);
  sun.position.set(30, 50, 20);
  if (quality !== 'low') {
    sun.castShadow = true;
    const sz = quality === 'high' ? 4096 : 2048;
    sun.shadow.mapSize.set(sz, sz);
    const ext = Math.max(bx2 - bx1, bz2 - bz1) * 0.6;
    Object.assign(sun.shadow.camera, { left: -ext, right: ext, top: ext, bottom: -ext, near: 1, far: 140 });
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.03;
  }
  group.add(sun); group.add(sun.target);

  scene.add(group);
  scene.background = new THREE.Color(def.sky);
  scene.fog = new THREE.Fog(def.fog, 50, 160);

  const nav = buildNavGrid(def, colliders);
  return { def, group, colliders, nav };
}

function tileUVs(geo, w, h, d, tile) {
  const uv = geo.attributes.uv;
  // порядок граней BoxGeometry: +x, -x, +y, -y, +z, -z (по 4 вершины)
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    const [su, sv] = dims[f];
    for (let i = 0; i < 4; i++) {
      const idx = f * 4 + i;
      uv.setXY(idx, uv.getX(idx) * su / tile, uv.getY(idx) * sv / tile);
    }
  }
  uv.needsUpdate = true;
}

// ---------- Навигационная сетка для ботов ----------
const CELL = 1;
const AGENT = 0.45;

function buildNavGrid(def, colliders) {
  const [x1, z1, x2, z2] = def.bounds;
  const w = Math.ceil((x2 - x1) / CELL), h = Math.ceil((z2 - z1) / CELL);
  const blocked = new Uint8Array(w * h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const cx = x1 + (i + 0.5) * CELL, cz = z1 + (j + 0.5) * CELL;
    for (const c of colliders) {
      if (c.max[1] < 0.4 || c.min[1] > 1.7) continue;
      if (cx > c.min[0] - AGENT && cx < c.max[0] + AGENT && cz > c.min[2] - AGENT && cz < c.max[2] + AGENT) { blocked[j * w + i] = 1; break; }
    }
  }
  return { x1, z1, w, h, blocked };
}

export function navCell(nav, x, z) {
  const i = Math.floor((x - nav.x1) / CELL), j = Math.floor((z - nav.z1) / CELL);
  if (i < 0 || j < 0 || i >= nav.w || j >= nav.h) return -1;
  return j * nav.w + i;
}

export function nearestFree(nav, x, z) {
  let c = navCell(nav, x, z);
  if (c >= 0 && !nav.blocked[c]) return c;
  const ci = Math.floor((x - nav.x1) / CELL), cj = Math.floor((z - nav.z1) / CELL);
  for (let r = 1; r < 8; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
    const i = ci + di, j = cj + dj;
    if (i < 0 || j < 0 || i >= nav.w || j >= nav.h) continue;
    if (!nav.blocked[j * nav.w + i]) return j * nav.w + i;
  }
  return -1;
}

export function cellCenter(nav, c) {
  const i = c % nav.w, j = Math.floor(c / nav.w);
  return { x: nav.x1 + (i + 0.5) * CELL, z: nav.z1 + (j + 0.5) * CELL };
}

// A* по сетке с 8 направлениями, без срезания углов.
export function findPath(nav, sx, sz, tx, tz) {
  const start = nearestFree(nav, sx, sz), goal = nearestFree(nav, tx, tz);
  if (start < 0 || goal < 0) return null;
  const { w, h, blocked } = nav;
  const N = w * h;
  const g = new Float32Array(N).fill(Infinity);
  const came = new Int32Array(N).fill(-1);
  const closed = new Uint8Array(N);
  const open = new MinHeap();
  const gi = goal % w, gj = Math.floor(goal / w);
  const heur = (c) => { const di = Math.abs(c % w - gi), dj = Math.abs(Math.floor(c / w) - gj); return Math.max(di, dj) + 0.414 * Math.min(di, dj); };
  g[start] = 0; open.push(start, heur(start));
  let iter = 0;
  while (open.size && iter++ < 6000) {
    const cur = open.pop();
    if (cur === goal) break;
    if (closed[cur]) continue;
    closed[cur] = 1;
    const ci = cur % w, cj = Math.floor(cur / w);
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      const ni = ci + di, nj = cj + dj;
      if (ni < 0 || nj < 0 || ni >= w || nj >= h) continue;
      const n = nj * w + ni;
      if (blocked[n] || closed[n]) continue;
      if (di && dj && (blocked[cj * w + ni] || blocked[nj * w + ci])) continue;
      const ng = g[cur] + (di && dj ? 1.414 : 1);
      if (ng < g[n]) { g[n] = ng; came[n] = cur; open.push(n, ng + heur(n)); }
    }
  }
  if (came[goal] < 0 && goal !== start) return null;
  const path = [];
  for (let c = goal; c !== -1 && c !== start; c = came[c]) path.push(cellCenter(nav, c));
  path.reverse();
  return smoothPath(nav, { x: sx, z: sz }, path);
}

// Убираем лишние точки, если между ними есть прямой проход по сетке.
function smoothPath(nav, from, path) {
  if (path.length < 3) return path;
  const out = [];
  let anchor = from, i = 0;
  while (i < path.length) {
    let j = path.length - 1;
    while (j > i && !gridLine(nav, anchor, path[j])) j--;
    out.push(path[j]);
    anchor = path[j];
    i = j + 1;
  }
  return out;
}

function gridLine(nav, a, b) {
  const dist = Math.hypot(b.x - a.x, b.z - a.z);
  const steps = Math.ceil(dist / 0.3);
  for (let s = 1; s <= steps; s++) {
    const t = s / steps;
    for (const off of [-0.3, 0.3]) {
      // проверяем «полосу» шириной с бота
      const nx = -(b.z - a.z) / (dist || 1), nz = (b.x - a.x) / (dist || 1);
      const c = navCell(nav, a.x + (b.x - a.x) * t + nx * off, a.z + (b.z - a.z) * t + nz * off);
      if (c < 0 || nav.blocked[c]) return false;
    }
  }
  return true;
}

class MinHeap {
  constructor() { this.k = []; this.v = []; }
  get size() { return this.k.length; }
  push(key, val) {
    const k = this.k, v = this.v; k.push(key); v.push(val);
    let i = k.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (v[p] <= v[i]) break;
      [k[p], k[i]] = [k[i], k[p]]; [v[p], v[i]] = [v[i], v[p]]; i = p;
    }
  }
  pop() {
    const k = this.k, v = this.v, top = k[0];
    const lk = k.pop(), lv = v.pop();
    if (k.length) {
      k[0] = lk; v[0] = lv;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1; let m = i;
        if (l < k.length && v[l] < v[m]) m = l;
        if (r < k.length && v[r] < v[m]) m = r;
        if (m === i) break;
        [k[m], k[i]] = [k[i], k[m]]; [v[m], v[i]] = [v[i], v[m]]; i = m;
      }
    }
    return top;
  }
}
