// Карты: игровая разметка (коллизии) + детальное оформление.
// box: [x1, z1, x2, z2, высота, тип, y0]
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { surface, contactShadowTexture, leafTexture } from './textures.js';
import { texSet } from './assets.js';
import { cityMaterial, cityTile, finishLighting, makeLightPool } from './city.js';
import { CITY_MAPS } from './citymaps.js';
let curNight = false;
const isCityKey = (k) => k.includes('|') || ['neonH', 'neonV', 'winLit', 'glass', 'shopGlass', 'vending', 'ads', 'lantern', 'clock', 'roofTile', 'roofTileJp', 'bulb', 'chrome', 'carGlass', 'tail', 'head', 'bark', 'iron', 'skyline', 'leafPalm'].includes(k);

// Реальные PBR-текстуры (ambientCG, CC0): ключ → набор, размер тайла (м), тонировка
const REAL = {
  plaster: { set: 'plaster', tile: 3.5, color: 0xf0d8b0 },
  plasterWhite: { set: 'plaster2', tile: 3.5, color: 0xf2ece0 },
  plasterTerra: { set: 'plaster3', tile: 3.5, color: 0xe0a676 },
  brick: { set: 'bricks3', tile: 2.2, color: 0xffffff },
  stone: { set: 'bricks2', tile: 2.4, color: 0xf2e2c8 },
  concrete: { set: 'concrete', tile: 3, color: 0xe8e2d6 },
  concreteLight: { set: 'concrete2', tile: 4, color: 0xffffff, ry: 0.5 },
  wood: { set: 'wood', tile: 1.2, color: 0xffffff },
  planks: { set: 'wood3', tile: 1.5, color: 0xb08868, ry: 0.5 },
  metal: { set: 'metal3', tile: 2.5, color: 0xffffff, metal: 0.6 },
  sand: { set: 'ground', tile: 5, color: 0xffffff },
  asphalt: { set: 'asphalt2', tile: 5, color: 0xd0d0d0 },
  tiles: { set: 'concrete3', tile: 3, color: 0xffffff },
};

function perimeter(x1, z1, x2, z2, h = 7) {
  return [
    [x1 - 1, z1 - 1, x2 + 1, z1, h, 'border'], [x1 - 1, z2, x2 + 1, z2 + 1, h, 'border'],
    [x1 - 1, z1, x1, z2, h, 'border'], [x2, z1, x2 + 1, z2, h, 'border'],
  ];
}
// Центральная симметрия (честный баланс сторон)
const mirror = (list) => list.map(([x1, z1, x2, z2, h, k, y0]) => [-x2, -z2, -x1, -z1, h, k, y0]);
const mirrorD = (list) => list.map(d => {
  if (d[0] === 'wire') return ['wire', -d[1], d[2], -d[3], -d[4], d[5], -d[6]];
  const o = [...d]; o[1] = -d[1]; o[2] = -d[2];
  if (d[0] === 'stall') o[3] = d[3] + Math.PI;
  return o;
});

const oasisHalf = [
  [-33, -4, -31, 4, 1.1, 'sandbag'], [-36, 10, -34.6, 11.4, 1.4, 'crate'], [-36, -12, -34.6, -10.6, 1.4, 'crate'], [-34.4, -12, -33.4, -11, 1, 'crate'],
  [-41, -31, -31, -24, 6, 'house:plasterTerra'], [-41, 24, -31, 31, 6.5, 'house:plaster'],
  [-26, 7, -9, 15, 5.5, 'house:plaster'],
  [-26, -15, -11, -7, 5, 'house:plasterWhite'],
  [-16.2, -3.2, -14.4, -1.4, 1.0, 'crate'], [-8.6, 1.4, -6.2, 4.2, 1.6, 'car'],
  [-18, 24, -16.6, 25.4, 1.0, 'crate'], [-10, 27, -8.2, 28.8, 1.8, 'crate'],
  [-18, -21, -16.6, -19.6, 1.0, 'crate'], [-12, -29, -10.2, -27.2, 1.8, 'crate'],
  [-28.6, 16, -27.8, 16.8, 1.1, 'barrel'], [-27.6, 16.2, -26.8, 17, 1.1, 'barrel'],
  [-22.6, -18.2, -21.8, -17.4, 1.1, 'barrel'],
];
const oasisDecorHalf = [
  ['palm', -37, 15], ['palm', -29, -19], ['palm', -6, 19.5],
  ['stall', -14, 29, 0, 'cloth'], ['stall', -21, 29, 0, 'cloth_b'],
  ['lamp', -27, 0], ['lamp', -12, 16.2], ['lamp', -12, -16.2],
  ['wire', -9, 5.3, 15, -4, 7.5, 15], ['wire', -26, 5.2, 7, -26, 5, -7],
];

export const MAPS = {
  oasis: {
    id: 'oasis', name: 'Оазис', desc: 'Пустынный городок, три линии', ground: 'sand',
    sky: { elevation: 48, azimuth: 135, turbidity: 3.5, rayleigh: 1.1, mie: 0.004, exposure: 0.55 },
    sun: 0xfff0d8, sunI: 3.0, hemi: [0xbcd4f0, 0x8a7258, 0.35], fog: [0xcdd5d8, 0.0055], hdri: 'quarry_01_1k', envI: 0.7,
    sites: { A: [-18, 21, 5], B: [-18, -21, 5] },
    bounds: [-41, -31, 41, 31],
    boxes: [
      ...perimeter(-41, -31, 41, 31, 7),
      ...oasisHalf, ...mirror(oasisHalf),
      [-4, 7, 4, 15, 8.5, 'house:plasterTerra'], [-6, -15, 6, -7, 4.5, 'house:plaster'],
      [-1.3, -1.3, 1.3, 1.3, 1.0, 'crate'], [-1.2, -1.2, 0.1, 0.1, 0.9, 'crate', 1.0],
      [-1, 18, 1, 25, 3, 'house:brick'],
      [-6, -23, 6, -22, 1.15, 'cover'],
    ],
    decor: [...oasisDecorHalf, ...mirrorD(oasisDecorHalf), ['palm', 2.5, 4.5], ['lamp', 0, -21.3]],
    paths: [[-30, -4.5, 30, 4.5], [-4, -31, 4, -15]],
    spawns: {
      A: [[-38, -6], [-38, -2], [-38, 2], [-38, 6], [-36, 0], [-39, 8], [-39, -8]],
      B: [[38, -6], [38, -2], [38, 2], [38, 6], [36, 0], [39, 8], [39, -8]],
    },
    points: [[0, 22], [0, -19], [0, 4], [-20, 0], [20, 0], [-20, 22], [20, 22], [-20, -20], [20, -20], [-7, 11], [7, 11], [-8, -11], [8, -11]],
  },
  port: {
    id: 'port', name: 'Порт', desc: 'Контейнерный терминал на закате', ground: 'asphalt',
    sky: { elevation: 13, azimuth: 250, turbidity: 7, rayleigh: 2.2, mie: 0.005, exposure: 0.5 },
    sun: 0xffc896, sunI: 3.0, hemi: [0xa8b8d8, 0x5a4a3c, 0.5], fog: [0xc2a898, 0.0065], hdri: 'venice_sunset_1k', envI: 0.8,
    sites: { A: [-21, -17, 4.5], B: [15, -18, 4.5] },
    bounds: [-36, -36, 36, 36],
    boxes: [
      ...perimeter(-36, -36, 36, 36, 5),
      [-8, 7.4, -1.5, 8, 4.2, 'wh'], [1.5, 7.4, 8, 8, 4.2, 'wh'],
      [-8, -8, -1.5, -7.4, 4.2, 'wh'], [1.5, -8, 8, -7.4, 4.2, 'wh'],
      [-8, -7.4, -7.4, -1.5, 4.2, 'wh'], [-8, 1.5, -7.4, 7.4, 4.2, 'wh'],
      [7.4, -7.4, 8, -1.5, 4.2, 'wh'], [7.4, 1.5, 8, 7.4, 4.2, 'wh'],
      [-4, -4, -2.6, -2.6, 1.0, 'crate'], [2.6, 2.6, 4, 4, 1.0, 'crate'], [-0.9, -0.9, 0.9, 0.9, 1.8, 'crate'],
      [-24, -24, -18, -21.5, 2.6, 'cont:r'], [18, 21.5, 24, 24, 2.6, 'cont:b'],
      [-24, -24, -18, -21.5, 2.6, 'cont:o', 2.6], [18, 21.5, 24, 24, 2.6, 'cont:g', 2.6],
      [18, -24, 24, -21.5, 2.6, 'cont:g'], [-24, 21.5, -18, 24, 2.6, 'cont:o'],
      [-30, -10, -27.5, -4, 2.6, 'cont:b'], [27.5, 4, 30, 10, 2.6, 'cont:r'],
      [-30, 4, -27.5, 10, 2.6, 'cont:g'], [27.5, -10, 30, -4, 2.6, 'cont:o'],
      [-18, -14, -12, -11.5, 2.6, 'cont:w'], [12, 11.5, 18, 14, 2.6, 'cont:r'],
      [-18, 11.5, -12, 14, 2.6, 'cont:b'], [12, -14, 18, -11.5, 2.6, 'cont:w'],
      [-3, -22, 3, -19.5, 2.6, 'cont:r'], [-3, 19.5, 3, 22, 2.6, 'cont:g'],
      [-20, -2, -17.5, 4, 2.6, 'cont:r'], [17.5, -4, 20, 2, 2.6, 'cont:o'],
      [-10, -27, -8.6, -25.6, 1.0, 'crate'], [8.6, 25.6, 10, 27, 1.0, 'crate'],
      [10, -28, 11.8, -26.2, 1.8, 'crate'], [-11.8, 26.2, -10, 28, 1.8, 'crate'],
      [-26, -1, -24.6, 0.4, 1.0, 'crate'], [24.6, -0.4, 26, 1, 1.0, 'crate'],
      [-12, -5, -10.6, -3.6, 1.0, 'crate'], [10.6, 3.6, 12, 5, 1.0, 'crate'],
      [-6.5, -30, -5.7, -29.2, 1.1, 'barrel'], [5.7, 29.2, 6.5, 30, 1.1, 'barrel'],
      [24, -30, 28, -29, 1.1, 'cover'], [-28, 29, -24, 30, 1.1, 'cover'],
    ],
    decor: [
      ['lamp', -14, -30], ['lamp', 14, 30], ['lamp', -33, 0], ['lamp', 33, 0], ['lamp', 0, -11], ['lamp', 0, 11],
      ['roof', -8, -8, 8, 8, 4.2],
    ],
    paths: [],
    spawns: {
      A: [[-6, -33], [-2, -33], [2, -33], [6, -33], [0, -31], [-10, -32], [10, -32]],
      B: [[-6, 33], [-2, 33], [2, 33], [6, 33], [0, 31], [-10, 32], [10, 32]],
    },
    points: [[0, 0], [0, -14], [0, 14], [-14, 0], [14, 0], [-24, 0], [24, 0], [-14, -24], [14, 24], [-24, 14], [24, -14], [-5, 5], [5, -5]],
  },
};

Object.assign(MAPS, CITY_MAPS);

// ---------- материалы ----------
const matCache = {};
function patchGroundAO(mat) {
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vWY;')
      .replace('#include <fog_vertex>', '#include <fog_vertex>\nvWY = (modelMatrix * vec4(transformed, 1.0)).y;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vWY;')
      .replace('#include <aomap_fragment>', '#include <aomap_fragment>\nfloat gAO = mix(0.5, 1.0, smoothstep(0.0, 1.3, vWY));\nreflectedLight.indirectDiffuse *= gAO;\nreflectedLight.directDiffuse *= mix(0.75, 1.0, gAO);');
  };
  mat.customProgramCacheKey = () => 'gao';
}
export function mapMaterial(key) {
  if (isCityKey(key)) { const cm = cityMaterial(key, curNight); if (cm) return cm; }
  if (matCache[key]) return matCache[key];
  let m;
  const std = (o) => new THREE.MeshStandardMaterial(o);
  switch (key) {
    case 'win': m = std({ color: 0x14181d, metalness: 0.85, roughness: 0.12 }); break;
    case 'darkHole': m = std({ color: 0x0b0b0c, roughness: 1 }); break;
    case 'steel': m = std({ color: 0x55595f, metalness: 0.8, roughness: 0.4 }); break;
    case 'black': m = std({ color: 0x1a1a1a, metalness: 0.3, roughness: 0.6 }); break;
    case 'yellow': m = std({ color: 0xd9a21b, metalness: 0.4, roughness: 0.5 }); break;
    case 'trunk': m = std({ color: 0x6b5236, roughness: 0.95 }); break;
    case 'leaf': m = std({ map: leafTexture(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.8 }); break;
    case 'glow': m = new THREE.MeshBasicMaterial({ color: 0xfff1c4 }); break;
    case 'carPaint': m = std({ color: 0x8e2b22, metalness: 0.5, roughness: 0.45 }); break;
    case 'carPaint2': m = std({ color: 0x2a4f6b, metalness: 0.5, roughness: 0.45 }); break;
    case 'rubber': m = std({ color: 0x151515, roughness: 0.9 }); break;
    case 'water': m = std({ color: 0x2a4d5e, metalness: 0.6, roughness: 0.08 }); break;
    case 'mountain': m = std({ color: 0xb08d63, roughness: 1, flatShading: true }); break;
    default: {
      if (REAL[key]) {
        const r = REAL[key], t = texSet(r.set);
        m = std({ map: t.map, normalMap: t.normalMap, roughnessMap: t.roughnessMap, color: r.color, roughness: 1, metalness: r.metal || 0 });
        if (key !== 'sand' && key !== 'asphalt' && key !== 'tiles') patchGroundAO(m);
        break;
      }
      const s = surface(key);
      m = std({ map: s.map, normalMap: s.normalMap, roughness: s.roughness, metalness: s.metalness });
      m.normalScale.set(1, 1);
      if (key !== 'sand' && key !== 'asphalt' && key !== 'tiles') patchGroundAO(m);
    }
  }
  matCache[key] = m;
  return m;
}

// ---------- построитель ----------
class Builder {
  constructor() { this.parts = {}; this.colliders = []; this.shadowless = new Set(['glow', 'leaf']); }
  push(mat, geo) { (this.parts[mat] = this.parts[mat] || []).push(geo); }
  // коробка с тайлингом UV по размеру
  box(x1, y1, z1, x2, y2, z2, mat, collide = false, tileOverride) {
    const w = x2 - x1, h = y2 - y1, d = z2 - z1;
    if (w <= 0 || h <= 0 || d <= 0) return;
    const geo = new THREE.BoxGeometry(w, h, d);
    const tile = tileOverride || (surfaceTile(mat));
    const ok = tileOverride ? 0 : 1;
    const uv = geo.attributes.uv;
    const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    const offs = [[z1, y1], [z1, y1], [x1, z1], [x1, z1], [x1, y1], [x1, y1]].map(([a, b2]) => [a * ok, b2 * ok]);
    for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) {
      const k = f * 4 + i;
      uv.setXY(k, (uv.getX(k) * dims[f][0] + offs[f][0] * 0.37) / tile, (uv.getY(k) * dims[f][1] + offs[f][1]) / tile);
    }
    geo.translate((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2);
    this.push(mat, geo);
    if (collide) this.colliders.push({ min: [x1, y1, z1], max: [x2, y2, z2] });
  }
  geo(mat, geo, x, y, z, ry = 0, rx = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(sx, sy, sz));
    geo.applyMatrix4(m);
    this.push(mat, geo);
  }
  build(group, quality) {
    for (const [mat, list] of Object.entries(this.parts)) {
      const norm = list.map(g => {
        const gg = g.index ? g.toNonIndexed() : g;
        for (const n of Object.keys(gg.attributes)) if (!['position', 'normal', 'uv'].includes(n)) gg.deleteAttribute(n);
        return gg;
      });
      const merged = mergeGeometries(norm, false);
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, mapMaterial(mat));
      const pool = mat.startsWith('pool|');
      const shadows = quality !== 'low' && !this.shadowless.has(mat) && !pool && mat !== 'water';
      mesh.castShadow = shadows; mesh.receiveShadow = quality !== 'low' && !pool;
      if (pool) mesh.renderOrder = 2;
      group.add(mesh);
    }
  }
}
function surfaceTile(mat) {
  if (isCityKey(mat)) return cityTile(mat);
  if (REAL[mat]) return REAL[mat].tile;
  if (['win', 'darkHole', 'steel', 'black', 'yellow', 'trunk', 'leaf', 'glow', 'carPaint', 'carPaint2', 'rubber', 'water', 'mountain'].includes(mat)) return 1;
  return surface(mat).tile;
}

const rnd = (seed) => { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; };

// ---------- элементы ----------
// Фасадная система координат: side 0..3 (N,E,S,W), along — вдоль стены
function facade(x1, z1, x2, z2, side) {
  // возвращает функцию (a, y, out) → мировые координаты, длину стены и нормаль
  const s = [
    { len: x2 - x1, p: (a, o) => [x1 + a, z1 - o], n: [0, -1] },
    { len: z2 - z1, p: (a, o) => [x2 + o, z1 + a], n: [1, 0] },
    { len: x2 - x1, p: (a, o) => [x2 - a, z2 + o], n: [0, 1] },
    { len: z2 - z1, p: (a, o) => [x1 - o, z2 - a], n: [-1, 0] },
  ][side];
  return s;
}
// коробка в координатах фасада: a0..a1 вдоль, y0..y1, o0..o1 наружу
function fbox(B, f, a0, a1, y0, y1, o0, o1, mat, collide = false) {
  const [ax, az] = f.p(a0, o0), [bx, bz] = f.p(a1, o1);
  B.box(Math.min(ax, bx), y0, Math.min(az, bz), Math.max(ax, bx), y1, Math.max(az, bz), mat, collide);
}

function house(B, b, R, exposed) {
  const [x1, z1, x2, z2, h, kind, y0 = 0] = b;
  const mat = kind.split(':')[1] || 'plaster';
  B.box(x1, y0, z1, x2, y0 + h, z2, mat, true);
  // цоколь
  B.box(x1 - 0.06, y0, z1 - 0.06, x2 + 0.06, y0 + 0.6, z2 + 0.06, 'stone');
  // карниз и парапет
  const trim = mat === 'brick' ? 'concrete' : 'plasterWhite';
  B.box(x1 - 0.14, y0 + h - 0.3, z1 - 0.14, x2 + 0.14, y0 + h - 0.05, z2 + 0.14, trim);
  B.box(x1, y0 + h, z1, x2, y0 + h + 0.45, z1 + 0.25, mat); B.box(x1, y0 + h, z2 - 0.25, x2, y0 + h + 0.45, z2, mat);
  B.box(x1, y0 + h, z1, x1 + 0.25, y0 + h + 0.45, z2, mat); B.box(x2 - 0.25, y0 + h, z1, x2, y0 + h + 0.45, z2, mat);
  B.colliders.push({ min: [x1, y0 + h, z1], max: [x2, y0 + h + 0.45, z2] });
  for (let side = 0; side < 4; side++) {
    if (!exposed(side)) continue;
    const f = facade(x1, z1, x2, z2, side);
    const L = f.len;
    if (L < 2.5) continue;
    const n = Math.max(1, Math.floor(L / 3.4));
    const step = L / n;
    const floors = h >= 5 ? [1.2, 3.7] : [1.2];
    if (h >= 8) floors.push(6.0);
    let doorPlaced = false;
    for (let i = 0; i < n; i++) {
      const c = step * (i + 0.5);
      for (const fy of floors) {
        if (fy + 1.4 > h - 0.4) continue;
        const r = R();
        if (fy < 2 && !doorPlaced && L > 6 && r < 0.35) { door(B, f, c, y0); doorPlaced = true; continue; }
        if (r < 0.12) continue;
        windowAt(B, f, c, y0 + fy, R, mat);
      }
    }
    // деревянные балки под крышей
    if (mat !== 'brick' && R() < 0.6) {
      for (let a = 0.6; a < L - 0.4; a += 0.9) {
        const [px, pz] = f.p(a, 0.25);
        B.geo('trunk', new THREE.CylinderGeometry(0.07, 0.07, 0.5, 6), px, y0 + h - 0.55, pz, 0, Math.PI / 2, 0);
        // поворот цилиндра по нормали
        const g = B.parts.trunk[B.parts.trunk.length - 1];
        if (f.n[0] !== 0) { g.translate(-px, -(y0 + h - 0.55), -pz); g.rotateY(Math.PI / 2); g.translate(px, y0 + h - 0.55, pz); }
      }
    }
    // кондиционер
    if (L > 5 && R() < 0.5) {
      const a = 1 + R() * (L - 2), y = y0 + Math.min(h - 1.2, 2.6 + R());
      fbox(B, f, a - 0.4, a + 0.4, y, y + 0.55, 0, 0.4, 'steel');
      fbox(B, f, a - 0.3, a + 0.3, y + 0.08, y + 0.47, 0.4, 0.41, 'black');
    }
  }
}

function windowAt(B, f, c, y, R, mat) {
  const w = 1.1, h = 1.35;
  fbox(B, f, c - w / 2, c + w / 2, y, y + h, 0, 0.02, 'win');                                  // стекло
  fbox(B, f, c - w / 2 - 0.1, c + w / 2 + 0.1, y + h, y + h + 0.16, 0, 0.1, 'plasterWhite');   // перемычка
  fbox(B, f, c - w / 2 - 0.12, c + w / 2 + 0.12, y - 0.1, y, 0, 0.16, 'concrete');             // подоконник
  fbox(B, f, c - w / 2 - 0.08, c - w / 2, y, y + h, 0, 0.07, 'planks');                         // рама
  fbox(B, f, c + w / 2, c + w / 2 + 0.08, y, y + h, 0, 0.07, 'planks');
  fbox(B, f, c - 0.03, c + 0.03, y, y + h, 0, 0.05, 'planks');
  fbox(B, f, c - w / 2, c + w / 2, y + h * 0.6 - 0.03, y + h * 0.6 + 0.03, 0, 0.05, 'planks');
  const r = R();
  if (r < 0.45) {
    // ставни (одна может быть закрыта)
    fbox(B, f, c - w / 2 - 0.62, c - w / 2 - 0.08, y, y + h, 0.02, 0.07, 'planks');
    if (r < 0.15) fbox(B, f, c, c + w / 2, y, y + h, 0.02, 0.08, 'planks');
    else fbox(B, f, c + w / 2 + 0.08, c + w / 2 + 0.62, y, y + h, 0.02, 0.07, 'planks');
  } else if (r < 0.7) {
    // решётка
    for (let a = c - w / 2 + 0.15; a < c + w / 2; a += 0.18) fbox(B, f, a - 0.012, a + 0.012, y, y + h, 0.06, 0.085, 'black');
    fbox(B, f, c - w / 2, c + w / 2, y + h / 2 - 0.012, y + h / 2 + 0.012, 0.06, 0.085, 'black');
  }
}

function door(B, f, c, y0) {
  const w = 1.3, h = 2.3;
  fbox(B, f, c - w / 2, c + w / 2, y0, y0 + h, 0, 0.03, 'planks');
  fbox(B, f, c - w / 2 - 0.15, c - w / 2, y0, y0 + h + 0.15, 0, 0.1, 'concrete');
  fbox(B, f, c + w / 2, c + w / 2 + 0.15, y0, y0 + h + 0.15, 0, 0.1, 'concrete');
  fbox(B, f, c - w / 2 - 0.15, c + w / 2 + 0.15, y0 + h, y0 + h + 0.2, 0, 0.12, 'concrete');
  fbox(B, f, c + 0.35, c + 0.45, y0 + 1.0, y0 + 1.1, 0.03, 0.08, 'black');
  fbox(B, f, c - w / 2 - 0.2, c + w / 2 + 0.2, y0, y0 + 0.15, 0, 0.35, 'concrete');
}

function borderWall(B, b, R) {
  const [x1, z1, x2, z2, h] = b;
  B.box(x1, 0, z1, x2, h, z2, 'plaster', true);
  B.box(x1 - 0.1, h - 0.25, z1 - 0.1, x2 + 0.1, h, z2 + 0.1, 'plasterWhite');
  B.box(x1 - 0.06, 0, z1 - 0.06, x2 + 0.06, 0.7, z2 + 0.06, 'stone');
  // пилястры
  const along = x2 - x1 > z2 - z1;
  const L = along ? x2 - x1 : z2 - z1;
  for (let a = 2; a < L - 1; a += 6) {
    if (along) B.box(x1 + a - 0.3, 0, z1 - 0.15, x1 + a + 0.3, h - 0.25, z2 + 0.15, 'plasterWhite');
    else B.box(x1 - 0.15, 0, z1 + a - 0.3, x2 + 0.15, h - 0.25, z1 + a + 0.3, 'plasterWhite');
  }
  void R;
}

function crate(B, b) {
  const [x1, z1, x2, z2, h, , y0 = 0] = b;
  B.box(x1, y0, z1, x2, y0 + h, z2, 'wood', true, Math.max(x2 - x1, z2 - z1, h));
}

function barrel(B, b, R) {
  const [x1, z1, x2, z2, h] = b;
  const cx = (x1 + x2) / 2, cz = (z1 + z2) / 2, r = (x2 - x1) / 2;
  const mat = R() < 0.5 ? 'container_b' : 'container_r';
  B.geo(mat, new THREE.CylinderGeometry(r, r, h, 18, 1), cx, h / 2, cz);
  for (const y of [0.25, h - 0.25]) B.geo('black', new THREE.CylinderGeometry(r + 0.015, r + 0.015, 0.05, 18), cx, y, cz);
  B.geo('steel', new THREE.CylinderGeometry(r - 0.02, r - 0.02, 0.02, 18), cx, h, cz);
  B.colliders.push({ min: [x1, 0, z1], max: [x2, h, z2] });
}

function sandbags(B, b) {
  const [x1, z1, x2, z2, h] = b;
  const along = x2 - x1 >= z2 - z1;
  const L = along ? x2 - x1 : z2 - z1, W = along ? z2 - z1 : x2 - x1;
  const rows = Math.round(h / 0.22);
  for (let r = 0; r < rows; r++) {
    const off = (r % 2) * 0.3;
    for (let a = -off; a < L; a += 0.6) {
      const a0 = Math.max(0, a), a1 = Math.min(L, a + 0.6);
      if (a1 - a0 < 0.15) continue;
      const len = a1 - a0 - 0.02;
      const g = new THREE.CapsuleGeometry(0.11, Math.max(0.01, len - 0.22), 3, 8);
      g.rotateZ(Math.PI / 2);
      g.scale(1, 0.95, W / 0.22 * 0.5);
      const ca = (a0 + a1) / 2, y = 0.11 + r * 0.21;
      if (along) B.geo('sandbag', g, x1 + ca, y, (z1 + z2) / 2);
      else B.geo('sandbag', g, (x1 + x2) / 2, y, z1 + ca, Math.PI / 2);
    }
  }
  B.colliders.push({ min: [x1, 0, z1], max: [x2, h, z2] });
}

function cover(B, b) {
  const [x1, z1, x2, z2, h] = b;
  B.box(x1, 0, z1, x2, h, z2, 'concrete', true);
  B.box(x1 - 0.08, 0, z1 - 0.08, x2 + 0.08, 0.2, z2 + 0.08, 'concrete');
}

function car(B, b, R) {
  const [x1, z1, x2, z2, h] = b;
  const along = x2 - x1 > z2 - z1;
  const cx = (x1 + x2) / 2, cz = (z1 + z2) / 2;
  const L = along ? x2 - x1 : z2 - z1, W = along ? z2 - z1 : x2 - x1;
  const paint = R() < 0.5 ? 'carPaint' : 'carPaint2';
  const ry = along ? 0 : Math.PI / 2;
  const put = (mat, geo, lx, y, lz) => {
    const c = Math.cos(ry), s = Math.sin(ry);
    B.geo(mat, geo, cx + lx * c + lz * s, y, cz - lx * s + lz * c, ry);
  };
  put(paint, new THREE.BoxGeometry(L, 0.55, W), 0, 0.6, 0);
  put(paint, new THREE.BoxGeometry(L * 0.5, 0.5, W * 0.9), -L * 0.08, 1.12, 0);
  put('win', new THREE.BoxGeometry(L * 0.5 + 0.02, 0.38, W * 0.92), -L * 0.08, 1.12, 0);
  put('black', new THREE.BoxGeometry(L + 0.04, 0.12, W + 0.02), 0, 0.38, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const wg = new THREE.CylinderGeometry(0.32, 0.32, 0.22, 14); wg.rotateX(Math.PI / 2);
    put('rubber', wg, sx * L * 0.32, 0.32, sz * (W / 2 - 0.08));
  }
  put('glow', new THREE.BoxGeometry(0.04, 0.1, 0.25), L / 2, 0.72, W * 0.32);
  put('glow', new THREE.BoxGeometry(0.04, 0.1, 0.25), L / 2, 0.72, -W * 0.32);
  B.colliders.push({ min: [x1, 0, z1], max: [x2, 0.9, z2] });
  B.colliders.push({ min: along ? [cx - L * 0.33, 0.9, z1 + 0.1] : [x1 + 0.1, 0.9, cz - L * 0.33], max: along ? [cx + L * 0.17, h, z2 - 0.1] : [x2 - 0.1, h, cz + L * 0.17] });
}

function container(B, b) {
  const [x1, z1, x2, z2, h, kind, y0 = 0] = b;
  const col = 'container_' + kind.split(':')[1];
  const along = x2 - x1 > z2 - z1;
  B.box(x1, y0, z1, x2, y0 + h, z2, col, true, 2.6);
  // угловые стойки
  for (const [cx, cz] of [[x1, z1], [x2, z1], [x1, z2], [x2, z2]]) B.box(cx - 0.09, y0, cz - 0.09, cx + 0.09, y0 + h, cz + 0.09, 'black');
  B.box(x1 - 0.05, y0 + h - 0.12, z1 - 0.05, x2 + 0.05, y0 + h, z2 + 0.05, 'metal');
  B.box(x1 - 0.05, y0, z1 - 0.05, x2 + 0.05, y0 + 0.14, z2 + 0.05, 'metal');
  // двери на торце: вертикальные запорные штанги
  if (along) for (const dx of [-0.25, 0.25, 0.55, -0.55]) B.box(x2 + 0.02, y0 + 0.15, (z1 + z2) / 2 + dx - 0.02, x2 + 0.06, y0 + h - 0.15, (z1 + z2) / 2 + dx + 0.02, 'steel');
  else for (const dx of [-0.25, 0.25, 0.55, -0.55]) B.box((x1 + x2) / 2 + dx - 0.02, y0 + 0.15, z2 + 0.02, (x1 + x2) / 2 + dx + 0.02, y0 + h - 0.15, z2 + 0.06, 'steel');
}

function warehouseWall(B, b) {
  const [x1, z1, x2, z2, h] = b;
  B.box(x1, 0, z1, x2, h, z2, 'brick', true);
  B.box(x1 - 0.05, 0, z1 - 0.05, x2 + 0.05, 0.6, z2 + 0.05, 'concrete');
  B.box(x1 - 0.08, h - 0.2, z1 - 0.08, x2 + 0.08, h, z2 + 0.08, 'concrete');
}

function palm(B, x, z, R) {
  const H = 6 + R() * 2.5, lean = (R() - 0.5) * 0.5, dir = R() * Math.PI * 2;
  let px = x, pz = z, py = 0;
  const segs = 7;
  for (let i = 0; i < segs; i++) {
    const t = (i + 1) / segs;
    const nx = x + Math.cos(dir) * lean * t * t * 3, nz = z + Math.sin(dir) * lean * t * t * 3, ny = H * t;
    const len = Math.hypot(nx - px, ny - py, nz - pz);
    const r0 = 0.2 - 0.08 * (i / segs), r1 = 0.2 - 0.08 * t;
    const g = new THREE.CylinderGeometry(r1, r0 + 0.02, len + 0.05, 8);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(nx - px, ny - py, nz - pz).normalize());
    g.applyQuaternion(q); g.translate((px + nx) / 2, (py + ny) / 2, (pz + nz) / 2);
    B.push('trunk', g);
    px = nx; py = ny; pz = nz;
  }
  const n = 9;
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2 + R() * 0.3;
    const len = 2.6 + R() * 0.8;
    const g = new THREE.PlaneGeometry(1.1, len, 1, 6);
    // изгиб листа вниз
    const pos = g.attributes.position;
    for (let k = 0; k < pos.count; k++) {
      const yy = pos.getY(k) + len / 2;
      pos.setXYZ(k, pos.getX(k), yy, -Math.pow(yy / len, 2) * 1.4);
    }
    g.computeVertexNormals();
    g.rotateX(-Math.PI / 2 + 0.5);
    g.rotateY(a);
    g.translate(px, py, pz);
    B.push('leaf', g);
  }
  B.colliders.push({ min: [x - 0.22, 0, z - 0.22], max: [x + 0.22, 3, z + 0.22] });
}

function stall(B, x, z, rot, cloth) {
  const w = 3, d = 2;
  const c = Math.cos(rot), s = Math.sin(rot);
  const P = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
  for (const [lx, lz, hh] of [[-w / 2, -d / 2, 2.5], [w / 2, -d / 2, 2.5], [-w / 2, d / 2, 2.1], [w / 2, d / 2, 2.1]]) {
    const [px, pz] = P(lx, lz);
    B.geo('trunk', new THREE.CylinderGeometry(0.05, 0.05, hh, 6), px, hh / 2, pz);
  }
  const roof = new THREE.BoxGeometry(w + 0.3, 0.03, d + 0.4);
  roof.rotateX(-0.2);
  B.geo(cloth, roof, x, 2.32, z, rot);
  const [tx, tz] = P(0, 0.3);
  B.geo('planks', new THREE.BoxGeometry(w - 0.2, 0.9, 0.8), tx, 0.45, tz, rot);
  // товары
  for (let i = -1; i <= 1; i++) { const [bx, bz] = P(i * 0.9, 0.3); B.geo(i ? 'wood' : 'sandbag', new THREE.BoxGeometry(0.5, 0.3, 0.45), bx, 1.05, bz, rot + i * 0.2); }
  const hw = (w - 0.2) / 2;
  const a = P(-hw, -0.1), bb = P(hw, 0.7);
  B.colliders.push({ min: [Math.min(a[0], bb[0]), 0, Math.min(a[1], bb[1])], max: [Math.max(a[0], bb[0]), 0.9, Math.max(a[1], bb[1])] });
}

function lamp(B, x, z) {
  B.geo('black', new THREE.CylinderGeometry(0.06, 0.09, 4.2, 8), x, 2.1, z);
  B.geo('black', new THREE.BoxGeometry(0.08, 0.08, 0.9), x, 4.15, z + 0.4);
  B.geo('black', new THREE.BoxGeometry(0.3, 0.12, 0.45), x, 4.1, z + 0.8);
  B.geo('glow', new THREE.BoxGeometry(0.24, 0.02, 0.38), x, 4.03, z + 0.8);
  B.colliders.push({ min: [x - 0.1, 0, z - 0.1], max: [x + 0.1, 4.2, z + 0.1] });
}

function wire(group, a, b) {
  const pts = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    pts.push(new THREE.Vector3(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - Math.sin(t * Math.PI) * 0.6, a[2] + (b[2] - a[2]) * t));
  }
  const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.015, 4);
  group.add(new THREE.Mesh(g, mapMaterial('black')));
}

function roof(B, x1, z1, x2, z2, h) {
  for (let x = x1 + 1; x < x2; x += 2.2) B.box(x - 0.1, h + 0.6, z1, x + 0.1, h + 0.9, z2, 'steel');
  B.box(x1, h + 0.9, z1, x2, h + 1.0, z1 + 0.2, 'steel'); B.box(x1, h + 0.9, z2 - 0.2, x2, h + 1.0, z2, 'steel');
}

// Фон за стенами: дома и горы
function backdrop(B, group, def, R) {
  const [x1, z1, x2, z2] = def.bounds;
  if (def.id === 'oasis') {
    const ring = (len, fn) => { for (let a = -6; a < len + 6;) { const w = 4 + R() * 6; fn(a, w); a += w + R() * 1.5; } };
    const mats = ['plaster', 'plasterWhite', 'plasterTerra'];
    ring(x2 - x1, (a, w) => {
      for (const side of [-1, 1]) {
        const zz = side < 0 ? z1 - 2 - R() * 3 : z2 + 2 + R() * 3, d = 5 + R() * 4, hh = 7 + R() * 7;
        const m = mats[R() * 3 | 0];
        const xa = x1 + a;
        if (side < 0) B.box(xa, 0, zz - d, xa + w, hh, zz, m); else B.box(xa, 0, zz, xa + w, hh, zz + d, m);
      }
    });
    ring(z2 - z1, (a, w) => {
      for (const side of [-1, 1]) {
        const xx = side < 0 ? x1 - 2 - R() * 3 : x2 + 2 + R() * 3, d = 5 + R() * 4, hh = 7 + R() * 7;
        const m = mats[R() * 3 | 0];
        const za = z1 + a;
        if (side < 0) B.box(xx - d, 0, za, xx, hh, za + w, m); else B.box(xx, 0, za, xx + d, hh, za + w, m);
      }
    });
    // минарет
    B.geo('plasterWhite', new THREE.CylinderGeometry(1.2, 1.5, 22, 12), 30, 11, -42);
    B.geo('plasterTerra', new THREE.CylinderGeometry(1.6, 1.6, 1, 12), 30, 18, -42);
    B.geo('plasterWhite', new THREE.ConeGeometry(1.3, 3, 12), 30, 23.5, -42);
    // горы
    for (let i = 0; i < 26; i++) {
      const a = i / 26 * Math.PI * 2, r = 190 + R() * 40;
      const g = new THREE.ConeGeometry(30 + R() * 30, 25 + R() * 35, 6 + (R() * 3 | 0));
      g.translate(Math.cos(a) * r, 8, Math.sin(a) * r);
      const m = new THREE.Mesh(g, mapMaterial('mountain')); group.add(m);
    }
  } else {
    // вода и краны
    const water = new THREE.Mesh(new THREE.PlaneGeometry(600, 200), mapMaterial('water'));
    water.rotation.x = -Math.PI / 2; water.position.set(0, -0.6, z2 + 104); group.add(water);
    for (const cx of [-24, 6, 30]) crane(B, cx, z2 + 10);
    for (let i = 0; i < 40; i++) {
      const side = i % 2 ? 1 : -1;
      const x = side * (x2 + 4 + (R() * 30 | 0) * 2.7), z = (R() - 0.5) * 120;
      const stack = 1 + (R() * 3 | 0);
      const col = ['container_r', 'container_b', 'container_g', 'container_o', 'container_w'][R() * 5 | 0];
      for (let s = 0; s < stack; s++) B.box(x - 1.25, s * 2.6, z - 3, x + 1.25, s * 2.6 + 2.6, z + 3, col, false, 2.6);
    }
    for (let i = 0; i < 18; i++) {
      const z = z1 - 8 - R() * 30, x = (R() - 0.5) * 140, w = 8 + R() * 14, hh = 8 + R() * 14;
      B.box(x, 0, z - 10, x + w, hh, z, R() < 0.5 ? 'concrete' : 'metal');
    }
  }
}

function crane(B, x, z) {
  const H = 26;
  for (const [dx, dz] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) B.box(x + dx - 0.3, 0, z + dz - 0.3, x + dx + 0.3, H, z + dz + 0.3, 'yellow');
  for (let y = 4; y < H; y += 5) { B.box(x - 3, y, z - 3.1, x + 3, y + 0.3, z - 2.9, 'yellow'); B.box(x - 3, y, z + 2.9, x + 3, y + 0.3, z + 3.1, 'yellow'); }
  B.box(x - 1, H, z - 30, x + 1, H + 2, z + 12, 'yellow');
  B.box(x - 2, H + 2, z - 2, x + 2, H + 5, z + 3, 'container_w');
}

function siteMarker(name, x, z, r) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.strokeStyle = 'rgba(255,200,40,0.75)'; ctx.lineWidth = 10; ctx.setLineDash([26, 16]);
  ctx.beginPath(); ctx.arc(128, 128, 118, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = 'rgba(255,200,40,0.7)'; ctx.font = 'bold 150px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(name, 128, 136);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), new THREE.MeshStandardMaterial({ map: t, transparent: true, depthWrite: false, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -4 }));
  m.rotation.x = -Math.PI / 2; m.position.set(x, 0.02, z); m.receiveShadow = true;
  return m;
}

// ---------- сборка ----------
export function buildMap(scene, id, quality) {
  const def = MAPS[id];
  curNight = !!def.night;
  const group = new THREE.Group();
  const B = new Builder();
  const R = rnd(id === 'oasis' ? 1234 : id.length * 97 + 777);
  let lightCtx = null;
  if (def.build) {
    lightCtx = { R, night: !!def.night, evening: !!def.evening, pools: [], lamps: [] };
    def.build(B, group, lightCtx);
    const byCol = finishLighting(group, lightCtx, quality);
    for (const [k, geos] of Object.entries(byCol)) for (const g of geos) B.push('pool|' + k, g);
  }
  const solid = def.boxes.filter(b => !['crate', 'barrel'].includes(b[5]));

  // Сторона фасада «открыта», если перед ней нет вплотную другой коробки
  const exposedFn = (b) => (side) => {
    const [x1, z1, x2, z2] = b;
    const probe = [[(x1 + x2) / 2, z1 - 0.6], [x2 + 0.6, (z1 + z2) / 2], [(x1 + x2) / 2, z2 + 0.6], [x1 - 0.6, (z1 + z2) / 2]][side];
    const [bx1, bz1, bx2, bz2] = def.bounds;
    if (probe[0] < bx1 || probe[0] > bx2 || probe[1] < bz1 || probe[1] > bz2) return false;
    for (const o of solid) if (o !== b && o[5] !== 'border' && probe[0] > o[0] && probe[0] < o[2] && probe[1] > o[1] && probe[1] < o[3] && o[4] > 3) return false;
    return true;
  };

  for (const b of (def.build ? [] : def.boxes)) {
    const k = b[5];
    if (k.startsWith('house')) house(B, b, R, exposedFn(b));
    else if (k === 'border') borderWall(B, b, R);
    else if (k === 'crate') crate(B, b);
    else if (k === 'barrel') barrel(B, b, R);
    else if (k === 'sandbag') sandbags(B, b);
    else if (k === 'cover') cover(B, b);
    else if (k === 'car') car(B, b, R);
    else if (k.startsWith('cont')) container(B, b);
    else if (k === 'wh') warehouseWall(B, b);
  }
  for (const d of def.decor) {
    if (d[0] === 'palm') palm(B, d[1], d[2], R);
    else if (d[0] === 'stall') stall(B, d[1], d[2], d[3], d[4]);
    else if (d[0] === 'lamp') lamp(B, d[1], d[2]);
    else if (d[0] === 'wire') wire(group, [d[1], d[2], d[3]], [d[4], d[5], d[6]]);
    else if (d[0] === 'roof') roof(B, d[1], d[2], d[3], d[4], d[5]);
  }
  if (!def.build) backdrop(B, group, def, R);
  B.build(group, quality);

  // Пол
  const fw = 600, fd = 600;
  const plane = (w, d, tile) => { const g = new THREE.PlaneGeometry(w, d); const uv = g.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * w / tile, uv.getY(k) * d / tile); return g; };
  const floor = new THREE.Mesh(plane(fw, fd, surfaceTile(def.ground)), mapMaterial(def.ground));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = quality !== 'low';
  group.add(floor);
  // дорожки
  for (const [px1, pz1, px2, pz2] of def.paths) {
    const tm = mapMaterial('tiles').clone();
    tm.polygonOffset = true; tm.polygonOffsetFactor = -1;
    const p = new THREE.Mesh(plane(px2 - px1, pz2 - pz1, surfaceTile('tiles')), tm);
    p.rotation.x = -Math.PI / 2; p.position.set((px1 + px2) / 2, 0.005, (pz1 + pz2) / 2);
    p.receiveShadow = quality !== 'low';
    group.add(p);
  }
  // Разметка в порту
  if (def.id === 'port') {
    const lm = new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -2 });
    for (const [x, z, w, d] of [[0, -27, 30, 0.15], [0, 27, 30, 0.15], [-23, 0, 0.15, 30], [23, 0, 0.15, 30]]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(w, d), lm); p.rotation.x = -Math.PI / 2; p.position.set(x, 0.01, z); p.receiveShadow = true; group.add(p);
    }
  }
  // Точки закладки бомбы
  if (def.sites) for (const [name, [sx, sz, sr]] of Object.entries(def.sites)) group.add(siteMarker(name, sx, sz, sr));
  // Мягкие контактные тени у основания объектов
  const aoMat = new THREE.MeshBasicMaterial({ map: contactShadowTexture(), transparent: true, depthWrite: false, opacity: 0.55, polygonOffset: true, polygonOffsetFactor: -3 });
  const aoGeos = [];
  for (const c of B.colliders) {
    if (c.min[1] > 0.01 || c.max[1] < 0.3) continue;
    const w = c.max[0] - c.min[0] + 1.6, d = c.max[2] - c.min[2] + 1.6;
    const g = new THREE.PlaneGeometry(w, d); g.rotateX(-Math.PI / 2); g.translate((c.min[0] + c.max[0]) / 2, 0.1, (c.min[2] + c.max[2]) / 2);
    aoGeos.push(g);
  }
  if (aoGeos.length) { const ao = new THREE.Mesh(mergeGeometries(aoGeos, false), aoMat); ao.renderOrder = 1; group.add(ao); }

  scene.add(group);
  const colliders = B.colliders;
  const nav = buildNavGrid(def, colliders);
  const updateLights = lightCtx && lightCtx.lamps.length && def.lightCount && quality !== 'low' ? makeLightPool(scene, lightCtx.lamps, def.lightCount) : null;
  return { def, group, colliders, nav, updateLights };
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
  const c = navCell(nav, x, z);
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
  const nx = -(b.z - a.z) / (dist || 1), nz = (b.x - a.x) / (dist || 1);
  for (let s = 1; s <= steps; s++) {
    const t = s / steps;
    for (const off of [-0.3, 0.3]) {
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
