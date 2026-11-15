// Процедурные PBR-текстуры (цвет + карта нормалей) без внешних файлов.
import * as THREE from 'three';

// ---------- Шум ----------
function hash2(x, y, s = 0) {
  let h = (x * 374761393 + y * 668265263 + s * 982451653) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
// Тайлящийся value-noise: период p клеток
function vnoise(x, y, p, s) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const x0 = ((xi % p) + p) % p, y0 = ((yi % p) + p) % p, x1 = (x0 + 1) % p, y1 = (y0 + 1) % p;
  const a = hash2(x0, y0, s), b = hash2(x1, y0, s), c = hash2(x0, y1, s), d = hash2(x1, y1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
// fbm в координатах u,v ∈ [0,1), базовая частота f (целое — для тайлинга)
function fbm(u, v, f, oct = 4, s = 0, fy = f) {
  let sum = 0, amp = 0.5, norm = 0;
  for (let o = 0; o < oct; o++) {
    const m = 1 << o;
    sum += vnoise(u * f * m, v * fy * m, f * m, s + o * 17) * amp * (fy === f ? 1 : 1);
    norm += amp; amp *= 0.5;
  }
  return sum / norm;
}
function fbm2(u, v, fx, fy, oct, s) {
  // анизотропный (для волокон дерева, подтёков)
  let sum = 0, amp = 0.5, norm = 0;
  for (let o = 0; o < oct; o++) {
    const m = 1 << o;
    const x = u * fx * m, y = v * fy * m;
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const px = fx * m, py = fy * m;
    const ux = xf * xf * (3 - 2 * xf), uy = yf * yf * (3 - 2 * yf);
    const x0 = ((xi % px) + px) % px, y0 = ((yi % py) + py) % py, x1 = (x0 + 1) % px, y1 = (y0 + 1) % py;
    const a = hash2(x0, y0, s + o), b = hash2(x1, y0, s + o), c = hash2(x0, y1, s + o), d = hash2(x1, y1, s + o);
    sum += (a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy) * amp;
    norm += amp; amp *= 0.5;
  }
  return sum / norm;
}
const clamp = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const hex = (h) => [(h >> 16 & 255) / 255, (h >> 8 & 255) / 255, (h & 255) / 255];
const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// ---------- Генерация ----------
function generate(size, fn) {
  const col = new Uint8ClampedArray(size * size * 4);
  const h = new Float32Array(size * size);
  const out = { c: [0, 0, 0], h: 0 };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    fn(x / size, y / size, out, x, y);
    const i = y * size + x;
    col[i * 4] = out.c[0] * 255; col[i * 4 + 1] = out.c[1] * 255; col[i * 4 + 2] = out.c[2] * 255; col[i * 4 + 3] = 255;
    h[i] = out.h;
  }
  return { col, h };
}

function normalFromHeight(h, size, strength) {
  const n = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const xl = (x - 1 + size) % size, xr = (x + 1) % size, yu = (y - 1 + size) % size, yd = (y + 1) % size;
    const dx = (h[y * size + xr] - h[y * size + xl]) * strength;
    const dy = (h[yd * size + x] - h[yu * size + x]) * strength;
    const l = Math.hypot(dx, dy, 1);
    const i = (y * size + x) * 4;
    n[i] = (-dx / l * 0.5 + 0.5) * 255; n[i + 1] = (dy / l * 0.5 + 0.5) * 255; n[i + 2] = (1 / l * 0.5 + 0.5) * 255; n[i + 3] = 255;
  }
  return n;
}

function dataTex(arr, size, srgb) {
  const t = new THREE.DataTexture(arr, size, size, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

// Кирпичная кладка: возвращает {mortar, id, edge}
function bricks(u, v, rows, cols, mortar) {
  const ry = v * rows, row = Math.floor(ry);
  const off = (row % 2) * 0.5;
  const rx = u * cols + off, col = Math.floor(rx);
  const fx = rx - col, fy = ry - row;
  const mx = mortar * cols, my = mortar * rows;
  const ex = Math.min(fx, 1 - fx) / mx, ey = Math.min(fy, 1 - fy) / my;
  const e = Math.min(ex, ey);
  return { mortar: e < 1, edge: clamp(e - 1, 0, 2) / 2, id: hash2(((col % cols) + cols) % cols, row, 7) };
}

// ---------- Поверхности ----------
const DEFS = {
  sand: { tile: 7, rough: 0.95, normal: 3.5, gen(u, v, o) {
    const big = fbm(u, v, 4, 4, 1), mid = fbm(u, v, 16, 3, 2), g = hash2(u * 4096 | 0, v * 4096 | 0, 3);
    const peb = fbm(u, v, 48, 2, 5);
    let c = mix3(hex(0xb8956a), hex(0xd9bc8f), smooth(0.25, 0.75, big));
    c = mix3(c, hex(0xa98a62), smooth(0.55, 0.8, mid) * 0.25);
    const pebble = smooth(0.74, 0.78, peb);
    c = mix3(c, hex(0xa08a70), pebble * 0.45);
    const k = 0.9 + g * 0.18;
    o.c = [c[0] * k, c[1] * k, c[2] * k];
    o.h = big * 0.4 + mid * 0.3 + g * 0.15 + pebble * 0.6;
  } },
  asphalt: { tile: 6, rough: 0.85, normal: 4, gen(u, v, o) {
    const big = fbm(u, v, 4, 4, 11), g = hash2(u * 4096 | 0, v * 4096 | 0, 12), agg = fbm(u, v, 64, 2, 13);
    const crack = 1 - Math.abs(fbm(u, v, 6, 4, 14) * 2 - 1);
    let c = mix3(hex(0x3a3c40), hex(0x55575b), big);
    c = mix3(c, hex(0x5d5f62), smooth(0.6, 0.7, agg) * 0.6);
    if (crack > 0.978) c = mix3(c, hex(0x222325), 0.6);
    const oil = smooth(0.62, 0.75, fbm(u, v, 3, 3, 15));
    c = mix3(c, hex(0x2a2a2d), oil * 0.2);
    const k = 0.88 + g * 0.24;
    o.c = [c[0] * k, c[1] * k, c[2] * k];
    o.h = agg * 0.5 + g * 0.3 - (crack > 0.978 ? 0.4 : 0);
  } },
  plaster: { tile: 4, rough: 0.92, normal: 5, base: [0xd8bd92, 0xe8d3ab], gen(u, v, o, x, y, def) {
    const big = fbm(u, v, 3, 5, 21), dirt = fbm(u, v, 6, 4, 22), g = hash2(x, y, 23);
    const chip = fbm(u, v, 5, 5, 24);
    const crack = 1 - Math.abs(fbm(u, v, 4, 5, 25) * 2 - 1);
    let c = mix3(hex(def.base[0]), hex(def.base[1]), smooth(0.3, 0.7, big));
    c = mix3(c, hex(0xa08c6c), smooth(0.6, 0.9, dirt) * 0.22);
    let hh = 0.7 + big * 0.15 + g * 0.08;
    if (chip > 0.79) {
      const b = bricks(u, v, 16, 4, 0.06);
      const bc = mix3(hex(0x9b6b45), hex(0xb98a5c), b.id);
      c = b.mortar ? hex(0x8c8173) : bc;
      hh = b.mortar ? 0.05 : 0.25 + b.edge * 0.1;
      c = mix3(c, hex(0x6e5a44), (1 - smooth(0.79, 0.82, chip)) * 0.4);
    } else if (chip > 0.775) { c = mix3(c, hex(0x9a8668), 0.35); hh = 0.5; }
    if (crack > 0.985) { c = mix3(c, hex(0x7a6a55), 0.45); hh -= 0.2; }
    const k = 0.93 + g * 0.1;
    o.c = [c[0] * k, c[1] * k, c[2] * k]; o.h = hh;
  } },
  plasterWhite: { tile: 4, rough: 0.9, normal: 5, base: [0xcfc6b4, 0xe9e2d2], gen(...a) { DEFS.plaster.gen(...a); } },
  plasterTerra: { tile: 4, rough: 0.92, normal: 5, base: [0xb57f57, 0xc9946a], gen(...a) { DEFS.plaster.gen(...a); } },
  brick: { tile: 2.4, rough: 0.9, normal: 6, gen(u, v, o, x, y) {
    const b = bricks(u, v, 20, 5, 0.05);
    const n = fbm(u, v, 8, 3, 31), g = hash2(x, y, 32);
    let c;
    if (b.mortar) { c = mix3(hex(0x9d9282), hex(0xb3a895), n); o.h = 0.1 + g * 0.1; }
    else {
      c = mix3(hex(0xa8754b), hex(0xc99a68), b.id);
      c = mix3(c, hex(0x7c5235), smooth(0.5, 0.9, fbm(u, v, 32, 2, 33)) * 0.5);
      o.h = 0.55 + b.edge * 0.3 + n * 0.15;
    }
    const k = 0.9 + g * 0.16;
    o.c = [c[0] * k, c[1] * k, c[2] * k];
  } },
  concrete: { tile: 3, rough: 0.88, normal: 3, gen(u, v, o, x, y) {
    const big = fbm(u, v, 3, 5, 41), g = hash2(x, y, 42), pores = fbm(u, v, 96, 1, 43);
    let c = mix3(hex(0x86847e), hex(0xa9a69e), big);
    c = mix3(c, hex(0x6e6b64), smooth(0.6, 0.85, fbm(u, v, 5, 4, 44)) * 0.4);
    let hh = 0.6 + big * 0.2 + g * 0.06;
    if (pores > 0.8) { c = mix3(c, hex(0x55524c), 0.6); hh -= 0.25; }
    // швы опалубки и отверстия от стяжек
    const seam = Math.min(Math.abs(u - 0.5), u, 1 - u) * 3 / 0.004, sy = Math.min(v, 1 - v) * 3 / 0.004;
    if (seam < 1 || sy < 1) { c = mix3(c, hex(0x5f5c56), 0.6); hh = 0.3; }
    for (const [hx, hy] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) {
      const d = Math.hypot(u - hx, v - hy);
      if (d < 0.012) { c = mix3(c, hex(0x3d3b37), 0.8); hh = 0.1; }
    }
    const k = 0.94 + g * 0.1;
    o.c = [c[0] * k, c[1] * k, c[2] * k]; o.h = hh;
  } },
  wood: { tile: 1, rough: 0.8, normal: 4, gen(u, v, o, x, y) {
    const planks = 5, pv = v * planks, pi = Math.floor(pv), pf = pv - pi;
    const grain = fbm2(u + pi * 0.37, v, 3, 48, 4, 51 + pi);
    const knot = fbm(u, v, 8, 2, 52 + pi);
    let c = mix3(hex(0x8a5d33), hex(0xb88a55), grain);
    c = mix3(c, hex(0x5b3a1d), smooth(0.8, 0.84, knot) * 0.5);
    const id = hash2(pi, 0, 53);
    c = mix3(c, hex(0x6e4a2a), id * 0.35);
    let hh = 0.6 + grain * 0.2;
    const gap = Math.min(pf, 1 - pf);
    if (gap < 0.04) { c = mix3(c, hex(0x2a1a0c), 0.85); hh = 0.05; }
    // рама ящика
    const fr = Math.min(u, 1 - u, v, 1 - v);
    if (fr < 0.085) { c = mix3(hex(0x6e4826), hex(0x8d6238), grain); hh = 0.95; if (fr > 0.08) hh = 0.5; }
    // гвозди
    for (const [nx, ny] of [[0.04, 0.04], [0.96, 0.04], [0.04, 0.96], [0.96, 0.96]]) if (Math.hypot(u - nx, v - ny) < 0.008) { c = hex(0x3a3a3a); hh = 1; }
    const g = hash2(x, y, 54);
    const k = 0.92 + g * 0.12;
    o.c = [c[0] * k, c[1] * k, c[2] * k]; o.h = hh;
  } },
  planks: { tile: 2, rough: 0.82, normal: 4, gen(u, v, o, x, y) {
    const planks = 8, pu = u * planks, pi = Math.floor(pu), pf = pu - pi;
    const grain = fbm2(u, v + pi * 0.37, 48, 3, 4, 61 + pi);
    let c = mix3(hex(0x5e432b), hex(0x8a6a48), grain);
    c = mix3(c, hex(0x4a3420), hash2(pi, 1, 62) * 0.5);
    let hh = 0.6 + grain * 0.2;
    if (Math.min(pf, 1 - pf) < 0.05) { c = mix3(c, hex(0x1d140b), 0.85); hh = 0; }
    const g = hash2(x, y, 63), k = 0.9 + g * 0.15;
    o.c = [c[0] * k, c[1] * k, c[2] * k]; o.h = hh;
  } },
  container: { tile: 2.6, rough: 0.68, metal: 0.3, normal: 6, paint: 0x9b3a2c, gen(u, v, o, x, y, def) {
    const ribs = 14, r = (u * ribs) % 1;
    const prof = smooth(0.08, 0.2, r) * (1 - smooth(0.55, 0.67, r));
    const n = fbm(u, v, 6, 4, 71), g = hash2(x, y, 72);
    let c = hex(def.paint);
    c = mix3(c, [c[0] * 0.75, c[1] * 0.75, c[2] * 0.75], n);
    const streak = fbm2(u, v, 40, 2, 4, 73);
    const rust = smooth(0.62, 0.8, streak) * smooth(0.3, 0.8, fbm(u, v, 3, 3, 74));
    c = mix3(c, hex(0x6b3a1c), rust * 0.75);
    const scratch = fbm2(u, v, 2, 60, 3, 75);
    if (scratch > 0.78) c = mix3(c, hex(0x8c8c8c), 0.35);
    // верхняя и нижняя балка
    let hh = 0.4 + prof * 0.6;
    const edge = Math.min(v, 1 - v);
    if (edge < 0.04) { c = mix3(c, hex(0x2b2b2b), 0.5); hh = 1; }
    const k = 0.92 + g * 0.1;
    o.c = [c[0] * k, c[1] * k, c[2] * k]; o.h = hh;
  } },
  metal: { tile: 2, rough: 0.5, metal: 0.6, normal: 2, gen(u, v, o, x, y) {
    const n = fbm(u, v, 5, 4, 81), g = hash2(x, y, 82);
    let c = mix3(hex(0x3b3e42), hex(0x575b60), n);
    c = mix3(c, hex(0x5c3b22), smooth(0.65, 0.8, fbm(u, v, 8, 3, 83)) * 0.5);
    const k = 0.92 + g * 0.1;
    o.c = [c[0] * k, c[1] * k, c[2] * k]; o.h = n * 0.5 + g * 0.1;
  } },
  tiles: { tile: 3, rough: 0.7, normal: 5, gen(u, v, o, x, y) {
    const b = bricks(u, v, 6, 6, 0.02);
    const n = fbm(u, v, 6, 3, 91), g = hash2(x, y, 92);
    let c = b.mortar ? hex(0x7d7266) : mix3(hex(0xb59a76), hex(0xcdb38c), b.id);
    c = mix3(c, hex(0x7a644a), smooth(0.55, 0.85, n) * 0.4);
    const k = 0.92 + g * 0.1;
    o.c = [c[0] * k, c[1] * k, c[2] * k]; o.h = b.mortar ? 0 : 0.6 + b.edge * 0.3;
  } },
  cloth: { tile: 1.5, rough: 1, normal: 2, color: 0xb03a2e, gen(u, v, o, x, y, def) {
    const stripe = Math.floor(u * 8) % 2;
    const n = fbm(u, v, 6, 3, 101), weave = (hash2(x >> 1, y >> 1, 102)) * 0.1;
    let c = stripe ? hex(def.color) : hex(0xe6dcc6);
    c = mix3(c, hex(0x6b5a45), smooth(0.5, 0.9, n) * 0.4);
    o.c = [c[0] * (0.92 + weave), c[1] * (0.92 + weave), c[2] * (0.92 + weave)]; o.h = weave * 4;
  } },
  sandbag: { tile: 1, rough: 1, normal: 3, gen(u, v, o, x, y) {
    const n = fbm(u, v, 8, 4, 111), weave = ((x + y) % 4 < 2 ? 1 : 0) * 0.5 + hash2(x, y, 112) * 0.5;
    const c = mix3(hex(0x8d7e5a), hex(0xae9e76), n);
    const k = 0.9 + weave * 0.15;
    o.c = [c[0] * k, c[1] * k, c[2] * k]; o.h = weave * 0.4 + n * 0.4;
  } },
};
DEFS.container_r = { ...DEFS.container, paint: 0x9b3a2c };
DEFS.container_b = { ...DEFS.container, paint: 0x2d5a86 };
DEFS.container_g = { ...DEFS.container, paint: 0x3f6e45 };
DEFS.container_o = { ...DEFS.container, paint: 0xc4742a };
DEFS.container_w = { ...DEFS.container, paint: 0xb9b4a8 };
DEFS.cloth_b = { ...DEFS.cloth, color: 0x2e5d8c };
DEFS.cloth_g = { ...DEFS.cloth, color: 0x4b7a3a };

const SIZE = 512;
const cache = new Map();

export function surface(name) {
  if (cache.has(name)) return cache.get(name);
  const def = DEFS[name] || DEFS.concrete;
  const size = name.startsWith('cloth') || name === 'sandbag' ? 256 : SIZE;
  const { col, h } = generate(size, (u, v, o, x, y) => def.gen(u, v, o, x, y, def));
  const res = {
    map: dataTex(col, size, true),
    normalMap: dataTex(normalFromHeight(h, size, def.normal * size / 512), size, false),
    tile: def.tile, roughness: def.rough, metalness: def.metal || 0,
  };
  cache.set(name, res);
  return res;
}

// Текстура «мягкой тени» у основания объектов
let aoTex = null;
export function contactShadowTexture() {
  if (aoTex) return aoTex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(64, 64);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const dx = Math.max(0, Math.abs(x - 31.5) - 16) / 16, dy = Math.max(0, Math.abs(y - 31.5) - 16) / 16;
    const d = Math.hypot(dx, dy);
    const a = Math.pow(clamp(1 - d), 2.2) * 255;
    const i = (y * 64 + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = 0; img.data[i + 3] = a;
  }
  ctx.putImageData(img, 0, 0);
  aoTex = new THREE.CanvasTexture(c);
  return aoTex;
}

// След от пули
let holeTex = null;
export function bulletHoleTexture() {
  if (holeTex) return holeTex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, 'rgba(10,8,6,1)'); g.addColorStop(0.18, 'rgba(20,16,12,0.95)'); g.addColorStop(0.3, 'rgba(60,50,40,0.6)'); g.addColorStop(1, 'rgba(60,50,40,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(32, 32, 30, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(20,16,12,0.6)'; ctx.lineWidth = 1;
  for (let i = 0; i < 7; i++) { const a = Math.random() * 6.28; ctx.beginPath(); ctx.moveTo(32, 32); ctx.lineTo(32 + Math.cos(a) * (10 + Math.random() * 14), 32 + Math.sin(a) * (10 + Math.random() * 14)); ctx.stroke(); }
  holeTex = new THREE.CanvasTexture(c);
  holeTex.colorSpace = THREE.SRGBColorSpace;
  return holeTex;
}

// Мягкая круглая частица (дым, вспышка)
let puffTex = null;
export function puffTexture() {
  if (puffTex) return puffTex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  puffTex = new THREE.CanvasTexture(c);
  return puffTex;
}

// Листья пальмы
let leafTex = null;
export function leafTexture() {
  if (leafTex) return leafTex;
  const c = document.createElement('canvas'); c.width = 64; c.height = 256;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 64, 256);
  ctx.strokeStyle = '#4a5a23'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(32, 0); ctx.lineTo(32, 256); ctx.stroke();
  for (let y = 4; y < 252; y += 5) {
    const w = 30 * Math.sin((y / 256) * Math.PI) + 2;
    const shade = 70 + Math.random() * 40;
    ctx.strokeStyle = `rgb(${shade * 0.6 | 0},${shade + 30 | 0},${shade * 0.35 | 0})`;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(32, y); ctx.lineTo(32 - w, y + 10); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(32, y); ctx.lineTo(32 + w, y + 10); ctx.stroke();
  }
  leafTex = new THREE.CanvasTexture(c);
  leafTex.colorSpace = THREE.SRGBColorSpace;
  return leafTex;
}

// ---------- Скины оружия ----------
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; };
}
function noiseDots(ctx, size, amount, r, alpha) {
  for (let i = 0; i < amount; i++) {
    const v = r() > 0.5 ? 255 : 0;
    ctx.fillStyle = `rgba(${v},${v},${v},${alpha * r()})`;
    ctx.fillRect(r() * size, r() * size, 1 + r() * 2, 1 + r() * 2);
  }
}

export function skinCanvas(skin, size = 256) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const ctx = c.getContext('2d');
  const r = rng(strHash(skin.id));
  const [a, b, d] = skin.colors;
  const S = size / 128;
  ctx.fillStyle = a; ctx.fillRect(0, 0, size, size);
  switch (skin.pattern) {
    case 'solid': noiseDots(ctx, size, 800, r, 0.06); break;
    case 'stripes':
      ctx.fillStyle = b;
      for (let i = -size; i < size * 2; i += 22 * S) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + 10 * S, 0); ctx.lineTo(i + 10 * S - size, size); ctx.lineTo(i - size, size); ctx.fill(); }
      break;
    case 'camo':
      for (const col of [b, d || b]) {
        ctx.fillStyle = col;
        for (let i = 0; i < 16; i++) {
          ctx.beginPath();
          const x = r() * size, y = r() * size, rad = (8 + r() * 18) * S;
          for (let k = 0; k < 9; k++) { const ang = k / 9 * Math.PI * 2, rr = rad * (0.6 + r() * 0.6); const px = x + Math.cos(ang) * rr, py = y + Math.sin(ang) * rr; k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
          ctx.fill();
        }
      }
      noiseDots(ctx, size, 1500, r, 0.08);
      break;
    case 'gradient': {
      const g = ctx.createLinearGradient(0, 0, size, size);
      g.addColorStop(0, a); g.addColorStop(0.55, b); g.addColorStop(1, d || a);
      ctx.fillStyle = g; ctx.fillRect(0, 0, size, size); noiseDots(ctx, size, 600, r, 0.05);
      break;
    }
    case 'carbon':
      for (let y = 0; y < size; y += 8 * S) for (let x = 0; x < size; x += 8 * S) {
        const alt = Math.round((x + y) / (8 * S)) % 2;
        ctx.fillStyle = alt ? b : a; ctx.fillRect(x, y, 8 * S, 4 * S);
        ctx.fillStyle = alt ? a : b; ctx.fillRect(x, y + 4 * S, 8 * S, 4 * S);
      }
      if (d) { ctx.fillStyle = d; ctx.fillRect(0, size * 0.45, size, size * 0.06); }
      break;
    case 'hex': {
      ctx.strokeStyle = b; ctx.lineWidth = 2 * S;
      const s = 10 * S;
      for (let y = 0; y < size + s * 2; y += s * 1.5) for (let x = 0; x < size + s * 2; x += s * Math.sqrt(3)) {
        const ox = (Math.round(y / (s * 1.5)) % 2) * s * Math.sqrt(3) / 2;
        ctx.beginPath();
        for (let k = 0; k < 6; k++) { const ang = Math.PI / 3 * k + Math.PI / 6; const px = x + ox + Math.cos(ang) * s, py = y + Math.sin(ang) * s; k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
        ctx.closePath(); ctx.stroke();
        if (d && r() < 0.12) { ctx.fillStyle = d; ctx.fill(); }
      }
      break;
    }
    case 'tiger':
      ctx.fillStyle = b;
      for (let i = 0; i < 14; i++) {
        const y = r() * size;
        ctx.beginPath(); ctx.moveTo(0, y);
        ctx.quadraticCurveTo(size * 0.5, y + (r() - 0.5) * 40 * S, size, y + (r() - 0.5) * 20 * S);
        ctx.lineTo(size, y + 6 * S); ctx.quadraticCurveTo(size * 0.5, y + 10 * S, 0, y + 4 * S); ctx.fill();
      }
      break;
    case 'galaxy': {
      const g = ctx.createRadialGradient(size * 0.3, size * 0.4, 4, size * 0.5, size * 0.5, size * 0.8);
      g.addColorStop(0, b); g.addColorStop(0.5, d || a); g.addColorStop(1, a);
      ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
      for (let i = 0; i < 160; i++) { ctx.fillStyle = `rgba(255,255,255,${r()})`; ctx.fillRect(r() * size, r() * size, (1 + r() * 1.5) * S * 0.7, (1 + r() * 1.5) * S * 0.7); }
      break;
    }
    case 'neon':
      ctx.strokeStyle = b; ctx.lineWidth = 3 * S; ctx.shadowColor = b; ctx.shadowBlur = 8 * S;
      for (let i = 0; i < 10; i++) {
        ctx.beginPath(); let x = r() * size, y = r() * size; ctx.moveTo(x, y);
        for (let k = 0; k < 4; k++) { if (r() > 0.5) x += (r() - 0.5) * 60 * S; else y += (r() - 0.5) * 60 * S; ctx.lineTo(x, y); }
        ctx.stroke();
      }
      if (d) { ctx.strokeStyle = d; ctx.shadowColor = d; ctx.strokeRect(10 * S, 10 * S, size - 20 * S, size - 20 * S); }
      ctx.shadowBlur = 0;
      break;
    case 'dragon': {
      const g = ctx.createLinearGradient(0, 0, 0, size);
      g.addColorStop(0, a); g.addColorStop(1, d || a);
      ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
      ctx.strokeStyle = b; ctx.lineWidth = 1.5 * S;
      for (let y = 0; y < size + 12 * S; y += 12 * S) for (let x = 0; x < size + 14 * S; x += 14 * S) {
        const ox = Math.round(y / (12 * S)) % 2 ? 7 * S : 0;
        ctx.beginPath(); ctx.arc(x + ox, y, 7 * S, 0, Math.PI); ctx.stroke();
      }
      break;
    }
  }
  return c;
}

const skinTexCache = new Map();
export function skinTexture(skin) {
  if (skinTexCache.has(skin.id)) return skinTexCache.get(skin.id);
  const t = new THREE.CanvasTexture(skinCanvas(skin));
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  skinTexCache.set(skin.id, t);
  return t;
}

const previewCache = new Map();
export function skinPreviewURL(skin) {
  if (previewCache.has(skin.id)) return previewCache.get(skin.id);
  const url = skinCanvas(skin, 96).toDataURL();
  previewCache.set(skin.id, url);
  return url;
}

function strHash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
