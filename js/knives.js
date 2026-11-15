// Ножи: настоящая геометрия клинка (обух, спуски, кромка), рукояти, отделки клинка.
// Клинок направлен в −Z, рукоять — в +Z. Хват правой руки ≈ (0, 0, 0.055).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { texSet } from './assets.js';

// ---------- Геометрия клинка ----------
// prof(u) → { top, bot, t, grind, dbl }  u∈[0..1] от основания к острию; размеры в метрах
function bladeGeometry(L, prof, segs = 40) {
  const facets = []; // каждая грань — своя полоса вершин (острые рёбра между гранями)
  const rings = [];
  for (let i = 0; i <= segs; i++) {
    const u = i / segs, p = prof(u), z = -u * L, h = p.t / 2;
    const gy = p.bot + (p.top - p.bot) * p.grind; // линия спуска
    if (p.dbl) {
      const mid = (p.top + p.bot) / 2;
      rings.push([[0, p.top, z], [h, mid, z], [0, p.bot, z], [-h, mid, z]]);
    } else rings.push([[-h, p.top, z], [h, p.top, z], [h, gy, z], [0, p.bot, z], [-h, gy, z]]);
  }
  const n = rings[0].length;
  const pos = [], uv = [], idx = [];
  for (let f = 0; f < n; f++) {
    const base = pos.length / 3;
    for (let i = 0; i <= segs; i++) {
      const a = rings[i][f], b = rings[i][(f + 1) % n];
      pos.push(...a, ...b);
      uv.push(i / segs, (a[1] + 0.05) * 6, i / segs, (b[1] + 0.05) * 6);
    }
    for (let i = 0; i < segs; i++) { const k = base + i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  }
  // торец у основания
  const base = pos.length / 3; for (const v of rings[0]) { pos.push(...v); uv.push(0, 0); }
  for (let k = 1; k < n - 1; k++) idx.push(base, base + k + 1, base + k);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  // ориентация граней наружу: проверяем по нормали первой грани
  return g;
}
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

// Профили клинков: осевая линия c(u), высота над ней a(u) (обух), под ней b(u) (кромка); a,b → 0 в острие
const P = (c, a, b, t, grind = 0.55, dbl = false) => (u) => { const cu = c(u), au = Math.max(0, a(u)), bu = Math.max(0, b(u)); return { top: cu + au, bot: cu - bu, t: t(u), grind, dbl }; };
const tipA = (u, s0, k = 1) => 1 - Math.pow(sm(s0, 1, u), k);       // плавный «клип» обуха к острию
const BLADES = {
  tactical: { L: 0.19, prof: P((u) => -0.004 * u, (u) => 0.017 * tipA(u, 0.62, 0.8), (u) => 0.017 * (1 - Math.pow(u, 6)) * (1 - sm(0.85, 1, u) * 0.6), (u) => lerp(0.0055, 0.0012, u * u)) },
  bayonet: { L: 0.2, prof: P((u) => 0.002 - 0.006 * u, (u) => 0.015 * tipA(u, 0.6, 0.7), (u) => 0.016 * (1 - Math.pow(u, 5)), (u) => lerp(0.006, 0.0014, u), 0.6) },
  hunting: { L: 0.18, prof: P((u) => 0.004 * u, (u) => 0.016 * tipA(u, 0.5, 0.9) - (u > 0.3 && u < 0.46 ? Math.sin((u - 0.3) / 0.16 * Math.PI) * 0.007 : 0), (u) => 0.02 * (1 - Math.pow(u, 2.2)), (u) => lerp(0.005, 0.0013, u), 0.6) },
  folding: { L: 0.15, prof: P((u) => -0.002 * u, (u) => 0.013 * tipA(u, 0.55, 0.8), (u) => 0.013 * (1 - Math.pow(u, 7)), (u) => lerp(0.004, 0.0011, u), 0.7) },
  cleaver: { L: 0.2, prof: P((u) => -0.004, (u) => 0.022 * tipA(u, 0.9, 0.6), (u) => 0.027 * (1 - Math.pow(u, 14)), (u) => lerp(0.006, 0.0018, u), 0.45) },
  kukri: { L: 0.24, prof: P((u) => -0.05 * Math.sin(u * Math.PI * 0.85) * u, (u) => 0.014 * (1 - Math.pow(u, 3)), (u) => (0.015 + 0.02 * Math.sin(u * Math.PI)) * (1 - Math.pow(u, 4)), (u) => lerp(0.007, 0.0018, u), 0.5) },
  claw: { L: 0.11, prof: P((u) => -0.075 * u * u, (u) => 0.011 * (1 - Math.pow(u, 1.5)), (u) => 0.014 * (1 - Math.pow(u, 1.2)), (u) => lerp(0.0045, 0.0012, u), 0.55) },
  dagger: { L: 0.12, prof: P(() => 0, (u) => 0.021 * (1 - u), (u) => 0.021 * (1 - u), (u) => lerp(0.0065, 0.001, u), 0, true) },
  stiletto: { L: 0.19, prof: P(() => 0, (u) => 0.015 * (1 - Math.pow(u, 1.4)), (u) => 0.015 * (1 - Math.pow(u, 1.4)), (u) => lerp(0.0055, 0.001, u), 0, true) },
  tanto: { L: 0.17, prof: P(() => 0, (u) => 0.015 * (u < 0.82 ? 1 : 1 - (u - 0.82) / 0.18 * 0.15) * (u < 0.97 ? 1 : 0), (u) => u < 0.8 ? 0.015 : 0.015 * (1 - (u - 0.8) / 0.2), (u) => lerp(0.006, 0.002, u), 0.5) },
  bowie: { L: 0.24, prof: P((u) => -0.004 * u, (u) => 0.02 * tipA(u, 0.55, 0.65), (u) => 0.022 * (1 - Math.pow(u, 3.2)), (u) => lerp(0.0065, 0.0013, u), 0.5) },
  machete: { L: 0.32, prof: P((u) => 0.006 * Math.sin(u * Math.PI), (u) => 0.018 * (1 - Math.pow(u, 8)), (u) => (0.018 + 0.012 * Math.sin(u * Math.PI * 0.9)) * (1 - Math.pow(u, 6)), (u) => lerp(0.004, 0.0015, u), 0.4) },
  fairbairn: { L: 0.17, prof: P(() => 0, (u) => 0.013 * (1 - u), (u) => 0.013 * (1 - u), (u) => lerp(0.006, 0.001, u), 0, true) },
  navaja: { L: 0.18, prof: P((u) => -0.03 * u * u, (u) => 0.012 * (1 - Math.pow(u, 1.8)), (u) => 0.015 * (1 - Math.pow(u, 2.5)), (u) => lerp(0.0035, 0.001, u), 0.65) },
  skinner: { L: 0.13, prof: P((u) => 0.01 * u, (u) => 0.012 * (1 - Math.pow(u, 1.2)), (u) => 0.022 * (1 - Math.pow(u, 1.5)), (u) => lerp(0.005, 0.0012, u), 0.6) },
  butterfly: { L: 0.17, prof: P((u) => -0.002 * u, (u) => 0.012 * tipA(u, 0.65, 0.8), (u) => 0.012 * (1 - Math.pow(u, 5)), (u) => lerp(0.004, 0.0011, u), 0.6) },
};

// ---------- Материалы ----------
const C = {};
function base() {
  if (C.ready) return C;
  const gp = texSet('gun_poly'), gm = texSet('gun_metal'), lt = texSet('glove');
  C.g10 = new THREE.MeshStandardMaterial({ map: gp.map, normalMap: gp.normalMap, color: 0x3a3d42, roughness: 0.75, metalness: 0.05 });
  C.rubber = new THREE.MeshStandardMaterial({ map: lt.map, normalMap: lt.normalMap, color: 0x2a2b2d, roughness: 0.9 });
  C.steel = new THREE.MeshStandardMaterial({ map: gm.map, normalMap: gm.normalMap, color: 0x9aa0a8, metalness: 1, roughness: 0.35 });
  C.dark = new THREE.MeshStandardMaterial({ map: gm.map, normalMap: gm.normalMap, color: 0x3a3c40, metalness: 0.9, roughness: 0.45 });
  C.brass = new THREE.MeshStandardMaterial({ color: 0xc9a043, metalness: 1, roughness: 0.28 });
  const wood = texSet('wood2');
  C.wood = new THREE.MeshStandardMaterial({ map: wood.map, normalMap: wood.normalMap, color: 0x8a5a38, roughness: 0.5 });
  C.ready = true;
  return C;
}

// Процедурные отделки клинка
function canvasTex(draw, size = 512) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
}
function rng(seed) { let s = seed >>> 0 || 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
function noise2(R, n = 12) { const g = []; for (let i = 0; i < n * n; i++) g.push(R()); return (x, y) => { x = ((x % 1) + 1) % 1 * n; y = ((y % 1) + 1) % 1 * n; const xi = x | 0, yi = y | 0, fx = x - xi, fy = y - yi, a = g[yi * n + xi], b = g[yi * n + (xi + 1) % n], c = g[((yi + 1) % n) * n + xi], d = g[((yi + 1) % n) * n + (xi + 1) % n]; const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy); return lerp(lerp(a, b, sx), lerp(c, d, sx), sy); }; }
function fbm(nz, x, y, o = 4) { let v = 0, a = 0.5, f = 1; for (let i = 0; i < o; i++) { v += nz(x * f, y * f) * a; a *= 0.5; f *= 2; } return v; }

const FINISH_CACHE = new Map();
export function finishMaterial(finish, seed = 1) {
  const key = finish + ':' + seed;
  if (FINISH_CACHE.has(key)) return FINISH_CACHE.get(key);
  const R = rng(seed * 7919 + 13), nz = noise2(R);
  const px = (fn) => canvasTex((ctx, S) => { const im = ctx.createImageData(S, S); for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const [r, g, b] = fn(x / S, y / S); const i = (y * S + x) * 4; im.data[i] = r; im.data[i + 1] = g; im.data[i + 2] = b; im.data[i + 3] = 255; } ctx.putImageData(im, 0, 0); }, 256);
  let m;
  const std = (o) => new THREE.MeshStandardMaterial({ metalness: 1, roughness: 0.2, envMapIntensity: 1.4, ...o });
  switch (finish) {
    case 'mirror': m = std({ color: 0xe8ecf0, roughness: 0.06 }); break;
    case 'satin': m = std({ map: texSet('gun_metal').map, color: 0xc8ccd2, roughness: 0.3 }); break;
    case 'black': m = std({ color: 0x1c1d20, roughness: 0.32, metalness: 0.85 }); break;
    case 'damascus': m = std({ roughness: 0.22, map: px((u, v) => { const w = Math.sin((v * 34 + fbm(nz, u * 3, v * 2) * 9 + u * 6) * 1.0); const k = 0.55 + 0.45 * Math.sign(w) * Math.pow(Math.abs(w), 0.3); return [120 + 110 * k, 124 + 110 * k, 130 + 112 * k]; }) }); break;
    case 'casehard': m = std({ roughness: 0.18, map: px((u, v) => { const a = fbm(nz, u * 2.5, v * 2.5, 5), b = fbm(nz, u * 2 + 7, v * 2 + 3, 5); const blue = [40, 80, 200], gold = [220, 170, 60], purple = [120, 70, 150], steel = [190, 195, 200]; const c = a > 0.55 ? blue : b > 0.58 ? gold : a < 0.38 ? purple : steel; const t = Math.abs(a - 0.5) * 2; return c.map((x, i) => lerp(steel[i], x, Math.min(1, t * 1.6))); }) }); break;
    case 'fade': m = std({ roughness: 0.12, map: px((u) => { const s = [[255, 220, 60], [255, 70, 140], [130, 70, 230]]; const t = u * 2; const i = Math.min(1, Math.floor(t)), f = t - i; return s[i].map((x, k) => lerp(x, s[i + 1][k], f)); }) }); break;
    case 'ocean': m = std({ roughness: 0.12, map: px((u) => [lerp(40, 20, u), lerp(220, 90, u), lerp(230, 255, u)]) }); break;
    case 'marble': m = std({ roughness: 0.12, map: px((u, v) => { const f = fbm(nz, u * 1.6, v * 1.6, 5); const t = Math.sin((u * 3 + f * 6) * Math.PI) * 0.5 + 0.5; return [lerp(230, 30, t), lerp(40, 60, t), lerp(60, 230, t)]; }) }); break;
    case 'tiger': m = std({ roughness: 0.15, map: px((u, v) => { const s = Math.sin((u * 16 + fbm(nz, u * 2, v * 4) * 4) * Math.PI); return s > 0.55 ? [150, 70, 10] : [250, 190, 70]; }) }); break;
    case 'web': m = std({ roughness: 0.3, metalness: 0.7, map: canvasTex((ctx, S) => { ctx.fillStyle = '#8e0f14'; ctx.fillRect(0, 0, S, S); ctx.strokeStyle = '#140405'; ctx.lineWidth = 2.5; const cx = S * 0.4, cy = S * 0.5; for (let k = 0; k < 14; k++) { const a = k / 14 * Math.PI * 2; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * S, cy + Math.sin(a) * S); ctx.stroke(); } for (let r = 20; r < S; r += 26) { ctx.beginPath(); for (let k = 0; k <= 14; k++) { const a = k / 14 * Math.PI * 2; const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r; k ? ctx.quadraticCurveTo(cx + Math.cos(a - 0.22) * r * 0.86, cy + Math.sin(a - 0.22) * r * 0.86, x, y) : ctx.moveTo(x, y); } ctx.stroke(); } }) }); break;
    case 'sapphire': case 'ruby': case 'emerald': {
      const col = { sapphire: [20, 60, 230], ruby: [210, 15, 40], emerald: [10, 180, 90] }[finish];
      m = std({ roughness: 0.08, map: px((u, v) => { const f = fbm(nz, u * 3, v * 3, 5); const k = 0.45 + f * 0.8; return col.map(x => Math.min(255, x * k + (f > 0.72 ? 120 : 0))); }) }); break;
    }
    case 'urban': m = std({ roughness: 0.5, metalness: 0.4, map: px((u, v) => { const f = fbm(nz, u * 4, v * 4); const t = f > 0.58 ? 60 : f > 0.46 ? 120 : 180; return [t, t + 4, t + 10]; }) }); break;
    case 'night': m = std({ roughness: 0.25, metalness: 0.9, map: px((u, v) => { const f = fbm(nz, u * 3, v * 3); const t = 20 + f * 40; return [t, t + 2, t + 8]; }) }); break;
    case 'gold': m = std({ color: 0xffcf6a, roughness: 0.12 }); break;
    default: m = std({ color: 0xc8ccd0, roughness: 0.25 });
  }
  FINISH_CACHE.set(key, m);
  return m;
}

// ---------- Детали ----------
function rbox(w, h, d, r, mat, x, y, z) { const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, r), mat); m.position.set(x, y, z); return m; }
function cyl(r1, r2, len, mat, seg = 16) { return new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, len, seg), mat); }
function pins(g, mat, zs, y = 0, w = 0.026) { for (const z of zs) { const p = cyl(0.0032, 0.0032, w + 0.002, mat, 10); p.rotation.z = Math.PI / 2; p.position.set(0, y, z); g.add(p); } }
function bladeMesh(type, mat) { const B = BLADES[type]; const m = new THREE.Mesh(bladeGeometry(B.L, B.prof), mat); m.userData.L = B.L; return m; }

// Эргономичная рукоять: профиль сбоку (подпальцевые выемки, изгиб), выдавленный с фаской
function ergoHandle(g, mat, len, h, w, { curve = 0, fingers = true, pommel = 0 } = {}) {
  const s = new THREE.Shape(), N = 24;
  const top = (t) => h / 2 - curve * t * t, bot = (t) => -h / 2 - curve * t * t + (fingers && t < 0.6 ? Math.max(0, Math.sin(t / 0.6 * Math.PI * 3)) * 0.004 : 0) - (t > 0.85 ? (t - 0.85) * 0.03 * pommel : 0);
  s.moveTo(0, top(0));
  for (let i = 1; i <= N; i++) { const t = i / N; s.lineTo(t * len, top(t)); }
  for (let i = N; i >= 0; i--) { const t = i / N; s.lineTo(t * len, bot(t)); }
  const geo = new THREE.ExtrudeGeometry(s, { depth: w - 0.006, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 3 });
  geo.translate(0, 0, -(w - 0.006) / 2); geo.rotateY(-Math.PI / 2);
  const p = geo.attributes.position, uv = new Float32Array(p.count * 2); for (let i = 0; i < p.count; i++) { uv[i * 2] = p.getZ(i) * 8; uv[i * 2 + 1] = p.getY(i) * 8; } geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat); g.add(m); return m;
}

// ---------- Сборка ножа ----------
export function buildKnifeModel(type, skin) {
  const K = base();
  const blade = skin ? finishMaterial(skin.finish || skin.style || 'satin', hashStr(skin.id)) : finishMaterial('satin');
  const g = new THREE.Group();
  const ud = { knifeType: type };
  switch (type) {
    case 'bayonet': {
      g.add(bladeMesh('bayonet', blade));
      g.add(rbox(0.014, 0.062, 0.012, 0.003, K.dark, 0, 0.004, 0.003));               // гарда
      g.add(rbox(0.024, 0.03, 0.12, 0.008, K.rubber, 0, 0, 0.068));                     // рукоять
      for (let i = 0; i < 6; i++) g.add(rbox(0.026, 0.032, 0.006, 0.002, K.g10, 0, 0, 0.02 + i * 0.019));
      g.add(rbox(0.02, 0.028, 0.016, 0.004, K.dark, 0, 0, 0.134));                    // навершие
      break;
    }
    case 'karambit': {
      // изогнутая рукоять из сегментов, кольцо на конце, клинок-коготь
      const arc = (t) => new THREE.Vector3(0, -0.012 + 0.03 * t * t, 0.11 * t);
      for (let k = 0; k < 6; k++) {
        const a = arc(k / 6), b = arc((k + 1) / 6), mid = a.clone().add(b).multiplyScalar(0.5);
        const seg = rbox(0.02, 0.027, a.distanceTo(b) + 0.006, 0.008, K.g10, mid.x, mid.y, mid.z);
        seg.rotation.x = -Math.atan2(b.y - a.y, b.z - a.z); g.add(seg);
      }
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.0055, 14, 32), K.steel); ring.rotation.y = Math.PI / 2; ring.position.set(0, 0.024, 0.13); g.add(ring);
      const b = bladeMesh('claw', blade); b.position.set(0, -0.012, 0.002); g.add(b);
      g.add(rbox(0.022, 0.03, 0.008, 0.003, K.dark, 0, -0.012, 0.0));
      pins(g, K.steel, [0.03, 0.075], -0.006, 0.021);
      ud.spinPivot = new THREE.Vector3(0, 0.024, 0.13);
      break;
    }
    case 'butterfly': {
      g.add(bladeMesh('butterfly', blade));
      const tang = rbox(0.006, 0.022, 0.02, 0.002, K.dark, 0, 0, 0.004); g.add(tang);
      ud.halves = [];
      for (const sx of [-1, 1]) {
        const pivot = new THREE.Group(); pivot.position.set(sx * 0.0055, sx > 0 ? -0.006 : 0.006, 0.006);
        const half = new THREE.Group();
        half.add(rbox(0.005, 0.022, 0.13, 0.002, K.steel, 0, -sx * 0.006 * -1 * 0, 0.065));
        for (let i = 0; i < 6; i++) { const hole = cyl(0.0035, 0.0035, 0.0062, K.dark, 10); hole.rotation.z = Math.PI / 2; hole.position.set(0, 0, 0.02 + i * 0.018); half.add(hole); }
        if (sx > 0) { const latch = rbox(0.004, 0.006, 0.03, 0.001, K.dark, 0, -0.012, 0.12); half.add(latch); }
        pivot.add(half); g.add(pivot);
        ud.halves.push({ pivot, sx });
      }
      break;
    }
    case 'kukri': {
      const b = bladeMesh('kukri', blade); b.position.z = -0.004; g.add(b);
      g.add(rbox(0.018, 0.04, 0.008, 0.002, K.brass, 0, 0, 0.0));
      const h = rbox(0.026, 0.034, 0.115, 0.012, K.wood, 0, -0.002, 0.064); h.rotation.x = 0.12; g.add(h);
      g.add(rbox(0.028, 0.034, 0.01, 0.003, K.brass, 0, -0.008, 0.124));
      break;
    }
    case 'dagger': { // тычковый: T-образная рукоять поперёк
      const b = bladeMesh('dagger', blade); g.add(b);
      g.add(rbox(0.014, 0.05, 0.016, 0.004, K.dark, 0, 0, 0.004));
      const grip = rbox(0.11, 0.03, 0.026, 0.012, K.g10, 0, 0, 0.026); g.add(grip);
      for (const x of [-0.035, 0, 0.035]) { const p = cyl(0.003, 0.003, 0.03, K.steel, 8); p.rotation.x = Math.PI / 2; p.position.set(x, 0, 0.026); g.add(p); }
      break;
    }
    case 'hunting': {
      g.add(bladeMesh('hunting', blade));
      g.add(rbox(0.03, 0.05, 0.01, 0.003, K.brass, 0, -0.002, 0.003));
      const h = rbox(0.026, 0.032, 0.115, 0.012, K.wood, 0, -0.002, 0.064); g.add(h);
      pins(g, K.brass, [0.035, 0.09], -0.002);
      g.add(rbox(0.028, 0.034, 0.012, 0.004, K.brass, 0, -0.002, 0.124));
      break;
    }
    case 'folding': {
      g.add(bladeMesh('folding', blade));
      const h = rbox(0.016, 0.026, 0.12, 0.007, K.g10, 0, -0.002, 0.058); g.add(h);
      g.add(rbox(0.0175, 0.012, 0.11, 0.003, K.dark, 0, 0.01, 0.06));
      pins(g, K.steel, [0.004, 0.11], 0, 0.018);
      const clip = rbox(0.002, 0.008, 0.07, 0.001, K.steel, 0.0095, 0.004, 0.07); g.add(clip);
      break;
    }
    case 'cleaver': {
      g.add(bladeMesh('cleaver', blade));
      g.add(rbox(0.024, 0.052, 0.01, 0.003, K.dark, 0, -0.004, 0.003));
      const h = rbox(0.026, 0.032, 0.12, 0.01, K.rubber, 0, -0.006, 0.066); h.rotation.x = 0.08; g.add(h);
      pins(g, K.steel, [0.03, 0.08], -0.006);
      break;
    }
    case 'stiletto': {
      g.add(bladeMesh('stiletto', blade));
      g.add(rbox(0.01, 0.05, 0.008, 0.002, K.steel, 0, 0, 0.002));
      const h = rbox(0.016, 0.022, 0.12, 0.007, K.g10, 0, 0, 0.066); g.add(h);
      g.add(rbox(0.018, 0.006, 0.105, 0.002, K.steel, 0, 0.011, 0.066)); g.add(rbox(0.018, 0.006, 0.105, 0.002, K.steel, 0, -0.011, 0.066));
      g.add(cyl(0.006, 0.008, 0.014, K.steel, 12)).rotation.x = Math.PI / 2; g.children[g.children.length - 1].position.z = 0.13;
      break;
    }
    case 'tanto': {
      g.add(bladeMesh('tanto', blade));
      g.add(rbox(0.012, 0.05, 0.008, 0.003, K.dark, 0, 0, 0.002));
      ergoHandle(g, K.g10, 0.12, 0.028, 0.024, { fingers: true });
      pins(g, K.steel, [0.03, 0.09], 0, 0.025);
      break;
    }
    case 'bowie': {
      g.add(bladeMesh('bowie', blade));
      g.add(rbox(0.016, 0.07, 0.01, 0.003, K.brass, 0, -0.003, 0.003));
      ergoHandle(g, K.wood, 0.125, 0.032, 0.028, { curve: 0.006, fingers: false, pommel: 1 });
      pins(g, K.brass, [0.035, 0.09], -0.002, 0.029);
      g.add(rbox(0.03, 0.034, 0.012, 0.005, K.brass, 0, -0.006, 0.128));
      break;
    }
    case 'machete': {
      g.add(bladeMesh('machete', blade));
      ergoHandle(g, K.rubber, 0.13, 0.03, 0.026, { curve: 0.012, fingers: true, pommel: 1.5 });
      g.add(rbox(0.006, 0.024, 0.02, 0.002, K.dark, 0, 0, 0.003));
      break;
    }
    case 'fairbairn': {
      g.add(bladeMesh('fairbairn', blade));
      g.add(rbox(0.012, 0.06, 0.006, 0.003, K.brass, 0, 0, 0.002));
      const hg = new THREE.LatheGeometry([[0, 0], [0.008, 0], [0.011, 0.03], [0.009, 0.08], [0.012, 0.105], [0.009, 0.115], [0, 0.115]].map(([r, y]) => new THREE.Vector2(r, y)), 20); hg.rotateX(Math.PI / 2); hg.translate(0, 0, 0.006);
      g.add(new THREE.Mesh(hg, K.brass));
      for (let k = 0; k < 10; k++) { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.0105, 0.0012, 6, 20), K.dark); ring.position.z = 0.025 + k * 0.007; g.add(ring); }
      break;
    }
    case 'navaja': {
      const b = bladeMesh('navaja', blade); g.add(b);
      ergoHandle(g, K.wood, 0.14, 0.024, 0.02, { curve: 0.018, fingers: false, pommel: 0 });
      g.add(rbox(0.022, 0.02, 0.012, 0.004, K.brass, 0, 0, 0.004));
      g.add(rbox(0.021, 0.016, 0.014, 0.004, K.brass, 0, -0.016, 0.136));
      pins(g, K.brass, [0.02, 0.06, 0.1], -0.005, 0.021);
      break;
    }
    case 'skinner': {
      g.add(bladeMesh('skinner', blade));
      ergoHandle(g, K.wood, 0.11, 0.03, 0.026, { curve: 0.004, fingers: true, pommel: 1 });
      pins(g, K.brass, [0.03, 0.08], -0.002, 0.027);
      g.add(rbox(0.01, 0.036, 0.008, 0.002, K.steel, 0, -0.004, 0.003));
      break;
    }
    default: { // боевой (тактический)
      g.add(bladeMesh('tactical', blade));
      for (let i = 0; i < 7; i++) { const s = rbox(0.0045, 0.006, 0.006, 0.001, blade, 0, 0.0185, -0.035 - i * 0.009); s.rotation.x = Math.PI / 4; g.add(s); }
      g.add(rbox(0.016, 0.066, 0.012, 0.004, K.dark, 0, 0, 0.003));
      const h = rbox(0.026, 0.032, 0.12, 0.011, K.rubber, 0, -0.001, 0.068); g.add(h);
      for (let i = 0; i < 5; i++) g.add(rbox(0.0275, 0.0335, 0.004, 0.0015, K.g10, 0, -0.001, 0.025 + i * 0.022));
      g.add(rbox(0.024, 0.03, 0.014, 0.005, K.dark, 0, -0.001, 0.133));
    }
  }
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  g.userData = { ...g.userData, ...ud };
  return g;
}
function hashStr(s) { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h) % 9973 + 1; }

export const KNIFE_FINISHES = [
  { key: 'satin', name: 'Сатин', rarity: 'epic' }, { key: 'mirror', name: 'Зеркало', rarity: 'legendary' }, { key: 'black', name: 'Ночная сталь', rarity: 'epic' },
  { key: 'urban', name: 'Городской камуфляж', rarity: 'epic' }, { key: 'night', name: 'Полночь', rarity: 'legendary' },
  { key: 'damascus', name: 'Дамасская сталь', rarity: 'legendary' }, { key: 'casehard', name: 'Цветная закалка', rarity: 'legendary' },
  { key: 'tiger', name: 'Тигровый клык', rarity: 'legendary' }, { key: 'web', name: 'Алая паутина', rarity: 'mythic' },
  { key: 'fade', name: 'Рассвет', rarity: 'mythic' }, { key: 'ocean', name: 'Глубина', rarity: 'mythic' }, { key: 'marble', name: 'Мраморный вихрь', rarity: 'mythic' },
  { key: 'gold', name: 'Золото', rarity: 'mythic' }, { key: 'sapphire', name: 'Сапфир', rarity: 'mythic' }, { key: 'ruby', name: 'Рубин', rarity: 'mythic' }, { key: 'emerald', name: 'Изумруд', rarity: 'mythic' },
];
