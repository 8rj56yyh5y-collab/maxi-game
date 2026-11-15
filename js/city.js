// Конструктор городов: дома разных стилей, неон, улицы, транспорт, деревья, ночное освещение.
import * as THREE from 'three';
import { texSet } from './assets.js';
import { puffTexture } from './textures.js';

// ---------- Текстуры-атласы (вывески, окна, реклама) ----------
const NEON_COLORS = ['#ff3ea5', '#3ef0ff', '#ffe14a', '#ff4b3e', '#4dff7a', '#b35cff', '#ff9a2a', '#ffffff'];
const H_TEXT = ['ラーメン', '居酒屋', 'カラオケ', '寿司', '焼鳥', '喫茶店', 'BAR', 'HOTEL', 'CAFÉ', 'PIZZA', 'BAKERY', 'OPEN 24H', 'DINER', 'PHARMACY', 'BOOKS', 'CINEMA',
  'KARAOKE', 'SUSHI', 'GAME', 'MAXI', 'NOODLE', 'DELI', 'PUB', 'TAXI', 'BISTRO', 'MOTEL', 'LIVE', 'CLUB', 'GELATO', 'SHOES', 'RAMEN', 'TAVERNA'];
const V_TEXT = ['ラーメン', 'カラオケ', '居酒屋', '寿司', '焼肉', 'ホテル', '薬局', '本屋', 'ゲーム', 'パチンコ', 'スナック', 'たばこ', '東京', '新宿', '酒場', 'うどん'];

let atlasCache = {};
function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function neonAtlasH() {
  if (atlasCache.h) return atlasCache.h;
  atlasCache.h = canvasTex(1024, 1024, (ctx) => {
    for (let i = 0; i < 32; i++) {
      const cx = (i % 4) * 256, cy = Math.floor(i / 4) * 128;
      const col = NEON_COLORS[i % NEON_COLORS.length];
      ctx.fillStyle = i % 3 === 0 ? '#120a14' : i % 3 === 1 ? '#0a1018' : '#14100a';
      ctx.fillRect(cx + 4, cy + 4, 248, 120);
      ctx.strokeStyle = col; ctx.lineWidth = 5; ctx.shadowColor = col; ctx.shadowBlur = 14;
      ctx.strokeRect(cx + 12, cy + 12, 232, 104);
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${H_TEXT[i].length > 7 ? 38 : 54}px "Noto Sans JP", "Hiragino Sans", "Yu Gothic", sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.shadowBlur = 22; ctx.fillStyle = col; ctx.fillText(H_TEXT[i], cx + 128, cy + 66);
      ctx.shadowBlur = 6; ctx.fillStyle = '#ffffff'; ctx.globalAlpha = 0.65; ctx.fillText(H_TEXT[i], cx + 128, cy + 66); ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    }
  });
  return atlasCache.h;
}
function neonAtlasV() {
  if (atlasCache.v) return atlasCache.v;
  atlasCache.v = canvasTex(1024, 1024, (ctx) => {
    for (let i = 0; i < 16; i++) {
      const cx = (i % 8) * 128, cy = Math.floor(i / 8) * 512;
      const col = NEON_COLORS[(i * 3) % NEON_COLORS.length];
      ctx.fillStyle = i % 2 ? '#f4efe6' : '#101016';
      ctx.fillRect(cx + 6, cy + 6, 116, 500);
      ctx.strokeStyle = col; ctx.lineWidth = 6; ctx.shadowColor = col; ctx.shadowBlur = 14;
      ctx.strokeRect(cx + 14, cy + 14, 100, 484);
      const chars = [...V_TEXT[i]];
      const step = Math.min(110, 470 / chars.length);
      ctx.font = `bold ${Math.min(84, step * 0.85)}px "Noto Sans JP", "Hiragino Sans", "Yu Gothic", sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = i % 2 ? '#c8102e' : col; ctx.shadowBlur = i % 2 ? 0 : 20;
      chars.forEach((ch, k) => ctx.fillText(ch, cx + 64, cy + 256 - (chars.length - 1) * step / 2 + k * step));
      ctx.shadowBlur = 0;
    }
  });
  return atlasCache.v;
}
function windowTex() {
  if (atlasCache.win) return atlasCache.win;
  // 4 варианта освещённых окон: тёплые, холодные, с шторами, с жалюзи
  atlasCache.win = canvasTex(256, 64, (ctx) => {
    const cols = [['#ffd79a', '#b9763a'], ['#cfe6ff', '#5a7fa8'], ['#ffc27a', '#7a3f22'], ['#fff0c8', '#a88850']];
    cols.forEach(([a, b], i) => {
      const x = i * 64;
      const g = ctx.createLinearGradient(x, 0, x, 64); g.addColorStop(0, a); g.addColorStop(1, b);
      ctx.fillStyle = g; ctx.fillRect(x, 0, 64, 64);
      if (i === 2) { ctx.fillStyle = 'rgba(120,40,30,0.75)'; ctx.fillRect(x, 0, 18, 64); ctx.fillRect(x + 46, 0, 18, 64); }
      if (i === 3) { ctx.fillStyle = 'rgba(80,60,30,0.35)'; for (let y = 2; y < 64; y += 6) ctx.fillRect(x, y, 64, 2); }
      ctx.fillStyle = 'rgba(30,20,10,0.9)'; ctx.fillRect(x + 30, 0, 4, 64); ctx.fillRect(x, 30, 64, 3);
    });
  });
  return atlasCache.win;
}
function shopTex() {
  if (atlasCache.shop) return atlasCache.shop;
  atlasCache.shop = canvasTex(1024, 256, (ctx) => {
    for (let i = 0; i < 4; i++) {
      const x = i * 256;
      const g = ctx.createLinearGradient(x, 0, x, 256);
      const pal = [['#fff1d6', '#c08a50'], ['#e8f4ff', '#7a90a8'], ['#ffe2c8', '#a0603a'], ['#f8e8ff', '#8a6a9a']][i];
      g.addColorStop(0, pal[0]); g.addColorStop(1, pal[1]); ctx.fillStyle = g; ctx.fillRect(x, 0, 256, 256);
      const cols = ['#d6243a', '#1f6fd6', '#f2b21b', '#26a65b', '#ffffff', '#7a3cc2', '#ff6a00', '#333'];
      if (i === 0 || i === 1) for (let r = 0; r < 4; r++) {
        ctx.fillStyle = 'rgba(60,40,20,.55)'; ctx.fillRect(x + 10, 50 + r * 50, 236, 5);
        for (let k = 0; k < 14; k++) { ctx.fillStyle = cols[(k * 7 + r * 3 + i) % cols.length]; const h = 16 + ((k * 13 + r * 7) % 18); ctx.fillRect(x + 14 + k * 16.5, 50 + r * 50 - h, 12, h); }
      } else if (i === 2) {
        for (let k = 0; k < 3; k++) { ctx.fillStyle = 'rgba(70,40,20,.8)'; ctx.fillRect(x + 20 + k * 80, 170, 60, 8); ctx.fillRect(x + 46 + k * 80, 178, 8, 60); ctx.fillStyle = '#fff6e0'; ctx.beginPath(); ctx.arc(x + 50 + k * 80, 40, 14, 0, 7); ctx.fill(); }
        ctx.fillStyle = 'rgba(80,50,30,.7)'; ctx.fillRect(x, 120, 256, 6);
      } else {
        for (let k = 0; k < 6; k++) { ctx.fillStyle = cols[(k * 3) % cols.length]; ctx.beginPath(); ctx.moveTo(x + 22 + k * 38, 60); ctx.lineTo(x + 50 + k * 38, 60); ctx.lineTo(x + 56 + k * 38, 160); ctx.lineTo(x + 16 + k * 38, 160); ctx.fill(); }
        ctx.fillStyle = 'rgba(40,30,40,.7)'; ctx.fillRect(x + 10, 52, 236, 4);
      }
      const v = ctx.createRadialGradient(x + 128, 128, 40, x + 128, 128, 190); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.45)');
      ctx.fillStyle = v; ctx.fillRect(x, 0, 256, 256);
    }
  });
  return atlasCache.shop;
}

function vendingTex() {
  if (atlasCache.vend) return atlasCache.vend;
  atlasCache.vend = canvasTex(128, 256, (ctx) => {
    ctx.fillStyle = '#e8f2ff'; ctx.fillRect(0, 0, 128, 256);
    const can = ['#d6243a', '#1f6fd6', '#f2b21b', '#26a65b', '#ffffff', '#7a3cc2', '#ff6a00'];
    for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) {
      ctx.fillStyle = can[(r * 6 + c * 5) % can.length];
      ctx.fillRect(10 + c * 18, 20 + r * 34, 12, 24);
      ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(12 + c * 18, 22 + r * 34, 3, 20);
    }
    ctx.fillStyle = '#20242a'; ctx.fillRect(0, 160, 128, 96);
    ctx.fillStyle = '#ff3b30'; ctx.fillRect(96, 172, 20, 10);
    ctx.fillStyle = '#0b0d10'; ctx.fillRect(14, 210, 100, 30);
  });
  return atlasCache.vend;
}
function adsAtlas() {
  if (atlasCache.ads) return atlasCache.ads;
  const ads = [
    ['MAXI COLA', '#d6243a', '#fff', 'Освежает!'], ['STRIKE ENERGY', '#111', '#3ef0ff', 'NEW'], ['ТОКИО НОЧЬЮ', '#2b0b3f', '#ff3ea5', 'TOKYO NIGHTS'], ['SEASON 1', '#0e2a47', '#ffc23d', 'MAXI STRIKE'],
  ];
  atlasCache.ads = canvasTex(1024, 512, (ctx) => {
    ads.forEach(([t, bg, fg, sub], i) => {
      const x = (i % 2) * 512, y = Math.floor(i / 2) * 256;
      const g = ctx.createLinearGradient(x, y, x + 512, y + 256); g.addColorStop(0, bg); g.addColorStop(1, '#000');
      ctx.fillStyle = g; ctx.fillRect(x, y, 512, 256);
      ctx.fillStyle = fg; ctx.font = 'bold 64px Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.shadowColor = fg; ctx.shadowBlur = 18; ctx.fillText(t, x + 256, y + 110); ctx.shadowBlur = 0;
      ctx.font = 'bold 30px Arial, sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText(sub, x + 256, y + 180);
      ctx.strokeStyle = fg; ctx.lineWidth = 6; ctx.strokeRect(x + 10, y + 10, 492, 236);
    });
  });
  return atlasCache.ads;
}
function lanternTex() {
  if (atlasCache.lant) return atlasCache.lant;
  atlasCache.lant = canvasTex(128, 128, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 128, 0); g.addColorStop(0, '#7a0a0a'); g.addColorStop(0.5, '#ff3a20'); g.addColorStop(1, '#7a0a0a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = 'rgba(0,0,0,.25)'; for (let y = 8; y < 128; y += 10) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(128, y); ctx.stroke(); }
    ctx.fillStyle = '#1a0a05'; ctx.font = 'bold 54px "Noto Sans JP", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('祭', 64, 66);
  });
  return atlasCache.lant;
}
function clockTex() {
  if (atlasCache.clock) return atlasCache.clock;
  atlasCache.clock = canvasTex(256, 256, (ctx) => {
    ctx.fillStyle = '#f4ead2'; ctx.beginPath(); ctx.arc(128, 128, 120, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#2a2016'; ctx.lineWidth = 8; ctx.stroke();
    ctx.fillStyle = '#2a2016'; ctx.font = 'bold 30px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ['XII', 'III', 'VI', 'IX'].forEach((t, i) => { const a = i * Math.PI / 2 - Math.PI / 2; ctx.fillText(t, 128 + Math.cos(a) * 90, 128 + Math.sin(a) * 90); });
    ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(128, 128); ctx.lineTo(128, 60); ctx.stroke();
    ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(128, 128); ctx.lineTo(180, 140); ctx.stroke();
  });
  return atlasCache.clock;
}
function radialTex() {
  if (atlasCache.rad) return atlasCache.rad;
  atlasCache.rad = canvasTex(128, 128, (ctx) => {
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  }, false);
  return atlasCache.rad;
}
function roofTileTex(dark) {
  const key = dark ? 'rtd' : 'rt';
  if (atlasCache[key]) return atlasCache[key];
  atlasCache[key] = canvasTex(256, 256, (ctx) => {
    ctx.fillStyle = dark ? '#3b3e44' : '#9c4a2c'; ctx.fillRect(0, 0, 256, 256);
    for (let r = 0; r < 8; r++) for (let c = 0; c < 9; c++) {
      const x = c * 32 - (r % 2) * 16, y = r * 32;
      const v = (Math.sin(r * 7.1 + c * 3.3) * 0.5 + 0.5) * 30;
      const g = ctx.createLinearGradient(0, y, 0, y + 32);
      if (dark) { g.addColorStop(0, `rgb(${85 + v},${88 + v},${96 + v})`); g.addColorStop(1, `rgb(${40 + v},${42 + v},${48 + v})`); }
      else { g.addColorStop(0, `rgb(${190 + v},${100 + v * 0.5},${60})`); g.addColorStop(1, `rgb(${110 + v},${50},${30})`); }
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 32, y); ctx.lineTo(x + 32, y + 26); ctx.quadraticCurveTo(x + 16, y + 36, x, y + 26); ctx.closePath(); ctx.fill();
    }
  });
  atlasCache[key].wrapS = atlasCache[key].wrapT = THREE.RepeatWrapping;
  return atlasCache[key];
}

function skylineTex() {
  if (atlasCache.sky) return atlasCache.sky;
  atlasCache.sky = canvasTex(256, 256, (ctx) => {
    ctx.fillStyle = '#20252c'; ctx.fillRect(0, 0, 256, 256);
    for (let y = 4; y < 256; y += 16) for (let x = 4; x < 256; x += 12) {
      const r = Math.random();
      ctx.fillStyle = r < 0.35 ? (r < 0.1 ? '#cfe6ff' : '#ffd79a') : '#3a414b';
      ctx.fillRect(x, y, 8, 10);
    }
  });
  atlasCache.sky.wrapS = atlasCache.sky.wrapT = THREE.RepeatWrapping;
  return atlasCache.sky;
}

// ---------- Материалы ----------
const cache = {};
// Ключи вида 'T|plaster|f0d8b0|3' — PBR-текстура + тонировка + размер тайла
export function cityTile(key) {
  if (key.startsWith('T|')) return +key.split('|')[3] || 3;
  if (key === 'skyline') return 12;
  if (key === 'roofTile' || key === 'roofTileJp') return 1.6;
  return 1;
}
export function cityMaterial(key, night) {
  if (cache[key]) return cache[key];
  const std = (o) => new THREE.MeshStandardMaterial(o);
  let m = null;
  if (key.startsWith('T|')) {
    const [, set, col, , rough] = key.split('|');
    const t = texSet(set);
    m = std({ map: t.map, normalMap: t.normalMap, roughnessMap: t.roughnessMap, color: new THREE.Color('#' + col), roughness: rough ? +rough : 1 });
  } else if (key.startsWith('pool|')) {
    m = new THREE.MeshBasicMaterial({ map: radialTex(), color: new THREE.Color('#' + key.split('|')[1]), transparent: true, opacity: +(key.split('|')[2] || 0.5), blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6 });
  } else if (key.startsWith('paint|')) {
    m = std({ color: new THREE.Color('#' + key.split('|')[1]), metalness: 0.55, roughness: 0.3 });
  } else if (key.startsWith('leaf|')) {
    m = std({ color: new THREE.Color('#' + key.split('|')[1]), roughness: 0.85, flatShading: true });
  } else if (key.startsWith('flat|')) {
    m = std({ color: new THREE.Color('#' + key.split('|')[1]), roughness: +(key.split('|')[2] || 0.7), metalness: +(key.split('|')[3] || 0) });
  } else if (key.startsWith('glowc|')) {
    m = std({ color: 0x000000, emissive: new THREE.Color('#' + key.split('|')[1]), emissiveIntensity: +(key.split('|')[2] || 2) });
  } else switch (key) {
    case 'neonH': m = std({ color: 0x111111, emissive: 0xffffff, emissiveMap: neonAtlasH(), map: neonAtlasH(), emissiveIntensity: night ? 2.6 : 0.9, roughness: 0.4, side: THREE.DoubleSide }); break;
    case 'neonV': m = std({ color: 0x111111, emissive: 0xffffff, emissiveMap: neonAtlasV(), map: neonAtlasV(), emissiveIntensity: night ? 2.2 : 0.8, roughness: 0.4, side: THREE.DoubleSide }); break;
    case 'winLit': m = std({ color: 0x222222, emissive: 0xffffff, emissiveMap: windowTex(), emissiveIntensity: night ? 1.5 : 0.25, roughness: 0.2, metalness: 0.2 }); break;
    case 'glass': m = std({ color: 0x1a2430, metalness: 0.9, roughness: 0.08 }); break;
    case 'shopGlass': m = std({ map: shopTex(), emissiveMap: shopTex(), color: night ? 0x444444 : 0x8a8a8a, emissive: 0xffffff, emissiveIntensity: night ? 1.0 : 0.35, metalness: 0.4, roughness: 0.08 }); break;
    case 'vending': m = std({ color: 0x222222, emissive: 0xffffff, emissiveMap: vendingTex(), map: vendingTex(), emissiveIntensity: night ? 1.4 : 0.5, roughness: 0.3 }); break;
    case 'ads': m = std({ color: 0x222222, emissive: 0xffffff, emissiveMap: adsAtlas(), map: adsAtlas(), emissiveIntensity: night ? 1.6 : 0.6, roughness: 0.4 }); break;
    case 'lantern': m = std({ color: 0x331010, emissive: 0xffffff, emissiveMap: lanternTex(), map: lanternTex(), emissiveIntensity: night ? 2.2 : 0.4, roughness: 0.6 }); break;
    case 'clock': m = std({ map: clockTex(), roughness: 0.6 }); break;
    case 'roofTile': m = std({ map: roofTileTex(false), roughness: 0.75 }); break;
    case 'roofTileJp': m = std({ map: roofTileTex(true), roughness: 0.55, metalness: 0.2 }); break;
    case 'bulb': m = new THREE.MeshBasicMaterial({ color: night ? 0xfff0c0 : 0xd8d0b8 }); break;
    case 'chrome': m = std({ color: 0xcfd5db, metalness: 1, roughness: 0.15 }); break;
    case 'carGlass': m = std({ color: 0x0c1218, metalness: 0.9, roughness: 0.05 }); break;
    case 'tail': m = std({ color: 0x400000, emissive: 0xff1a1a, emissiveIntensity: night ? 2 : 0.3 }); break;
    case 'head': m = std({ color: 0x777777, emissive: 0xfff4d6, emissiveIntensity: night ? 2 : 0.2 }); break;
    case 'water': m = std({ color: 0x2b5d70, metalness: 0.5, roughness: 0.05, transparent: true, opacity: 0.85 }); break;
    case 'leafPalm': m = std({ color: 0x4f8a3a, roughness: 0.8, side: THREE.DoubleSide }); break;
    case 'bark': m = std({ color: 0x5a4330, roughness: 0.95 }); break;
    case 'iron': m = std({ color: 0x1b1d20, metalness: 0.7, roughness: 0.45 }); break;
    case 'skyline': { const t = skylineTex(); m = std({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: night ? 1.1 : 0.05, color: night ? 0x303540 : 0x9aa4b0, roughness: 0.6, metalness: 0.3 }); break; }
  }
  if (m) cache[key] = m;
  return m;
}
export function resetCityMaterials() { for (const k of Object.keys(cache)) delete cache[k]; }

// ---------- Геометрические помощники ----------
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
function place(B, mat, geo, x, y, z, ry = 0, rx = 0, rz = 0) {
  _q.setFromEuler(_e.set(rx, ry, rz, 'YXZ'));
  _m.compose(new THREE.Vector3(x, y, z), _q, new THREE.Vector3(1, 1, 1));
  geo.applyMatrix4(_m);
  B.push(mat, geo);
}
function ensureUV(g) { if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); return g; }
function planeUV(w, h, u0, v0, u1, v1) {
  const g = new THREE.PlaneGeometry(w, h);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + (u1 - u0) * uv.getX(i), v0 + (v1 - v0) * uv.getY(i));
  return g;
}
// Фасад: side 0..3 (N,E,S,W)
export function facade(x1, z1, x2, z2, side) {
  return [
    { len: x2 - x1, p: (a, o) => [x1 + a, z1 - o], n: [0, -1] },
    { len: z2 - z1, p: (a, o) => [x2 + o, z1 + a], n: [1, 0] },
    { len: x2 - x1, p: (a, o) => [x2 - a, z2 + o], n: [0, 1] },
    { len: z2 - z1, p: (a, o) => [x1 - o, z2 - a], n: [-1, 0] },
  ][side];
}
const ryOf = (f) => Math.atan2(f.n[0], f.n[1]);
export function fbox(B, f, a0, a1, y0, y1, o0, o1, mat, collide = false) {
  const [ax, az] = f.p(a0, o0), [bx, bz] = f.p(a1, o1);
  B.box(Math.min(ax, bx), y0, Math.min(az, bz), Math.max(ax, bx), y1, Math.max(az, bz), mat, collide);
}
// Плоскость на фасаде (смотрит наружу), с UV-клеткой атласа
function fplane(B, f, a, y, o, w, h, mat, uv = [0, 0, 1, 1], blade = false) {
  const g = planeUV(w, h, ...uv);
  const [x, z] = f.p(a, o);
  place(B, mat, g, x, y, z, ryOf(f) + (blade ? Math.PI / 2 : 0));
}
const hCell = (i) => { i = ((i % 32) + 32) % 32; const c = i % 4, r = Math.floor(i / 4); return [c / 4, 1 - (r + 1) / 8, (c + 1) / 4, 1 - r / 8]; };
const vCell = (i) => { i = ((i % 16) + 16) % 16; const c = i % 8, r = Math.floor(i / 8); return [c / 8, 1 - (r + 1) / 2, (c + 1) / 8, 1 - r / 2]; };
const SIGNS_ = { tokyo: [0, 1, 2, 3, 4, 5, 16, 17, 18, 20, 30, 6, 7, 11], euro: [8, 9, 10, 14, 21, 22, 24, 28, 29, 31, 7, 6, 13], ny: [12, 11, 13, 15, 21, 22, 23, 25, 26, 27, 9, 14, 29, 6, 7] };
const SIGNS = { ...SIGNS_, paris: SIGNS_.euro, kyoto: SIGNS_.tokyo, miami: SIGNS_.ny, santorini: SIGNS_.euro };
const winCell = (i) => [(i % 4) / 4, 0, (i % 4 + 1) / 4, 1];

// ---------- Стили домов ----------
export const STYLES = {
  tokyo: { floor: 3.1, walls: ['T|plaster2|d9d6cf|3', 'T|concrete2|c8c4ba|4', 'T|plaster3|e8e2d4|3', 'T|concrete|b5b0a6|3', 'T|metal2|c2c6cc|3'], trim: 'T|concrete|8a8780|3', roof: 'flat', night: true },
  euro: { floor: 3.2, walls: ['T|plaster|f2d79c|3.5', 'T|plaster|f0c0a8|3.5', 'T|plaster|c8dbe8|3.5', 'T|plaster|f3e7cf|3.5', 'T|plaster|d9e6c4|3.5', 'T|plaster3|e8c48a|3.5'], trim: 'T|plaster2|f6f1e6|3', roof: 'gable' },
  ny: { floor: 3.4, walls: ['T|bricks|b8836c|2.2', 'T|bricks3|c9907a|2.2', 'T|bricks|8f5a46|2.2', 'T|concrete3|d6c9b0|3'], trim: 'T|concrete3|e2d8c4|3', roof: 'flat' },
  paris: { floor: 3.3, walls: ['T|concrete3|f0e4c8|3', 'T|plaster2|ece0c4|3', 'T|concrete3|e8dcc0|3'], trim: 'T|concrete3|f6ecd8|3', roof: 'mansard' },
  kyoto: { floor: 3.0, walls: ['T|wood3|6a4528|1.5', 'T|plaster2|e9e2cf|3', 'T|wood3|5a3a22|1.5'], trim: 'T|wood3|3a2616|1.5', roof: 'gableJp' },
  miami: { floor: 3.2, walls: ['T|plaster2|f7c6d9|3', 'T|plaster2|bfe8dc|3', 'T|plaster2|fde8b0|3', 'T|plaster2|c8d8f8|3', 'T|plaster2|fbd2b8|3'], trim: 'T|plaster2|ffffff|3', roof: 'flat' },
  santorini: { floor: 3.0, walls: ['T|plaster2|ffffff|3', 'T|plaster2|fbfaf6|3', 'T|plaster3|ffffff|3', 'T|plaster3|f6dcc0|3', 'T|plaster2|f9eac8|3'], trim: 'T|plaster2|ffffff|3', roof: 'flatRound' },
};

// Дом. b = [x1,z1,x2,z2,h,'bld:style',y0]; opts: { exposed(side), night, R, lights }
export function cityBuilding(B, b, ctx) {
  const [x1, z1, x2, z2, h, kind, y0 = 0] = b;
  const style = kind.split(':')[1];
  const S = STYLES[style];
  const R = ctx.R;
  const wall = S.walls[Math.floor(R() * S.walls.length)];
  B.box(x1, y0, z1, x2, y0 + h, z2, wall, true);
  const floors = Math.max(1, Math.floor((h - 0.4) / S.floor));
  // цоколь
  B.box(x1 - 0.05, y0, z1 - 0.05, x2 + 0.05, y0 + 0.5, z2 + 0.05, style === 'ny' ? 'T|concrete3|bfb19a|3' : style === 'euro' ? 'T|bricks2|d8ccb8|2.4' : S.trim);
  // межэтажные пояса
  if (style !== 'santorini') for (let f = 1; f < floors; f++) {
    const y = y0 + f * S.floor;
    B.box(x1 - 0.06, y - 0.08, z1 - 0.06, x2 + 0.06, y + 0.06, z2 + 0.06, S.trim);
  }
  // крыша
  if (S.roof === 'gable') gableRoof(B, x1, z1, x2, z2, y0 + h, R);
  else if (S.roof === 'gableJp') gableRoof(B, x1, z1, x2, z2, y0 + h, R, 'roofTileJp', 0.8, 0.32);
  else if (S.roof === 'mansard') mansard(B, x1, z1, x2, z2, y0 + h, R);
  else {
    const pt = style === 'santorini' ? wall : S.trim;
    B.box(x1 - 0.12, y0 + h - 0.05, z1 - 0.12, x2 + 0.12, y0 + h + 0.35, z2 + 0.12, pt);
    B.colliders.push({ min: [x1, y0 + h, z1], max: [x2, y0 + h + 0.35, z2] });
    if (style === 'ny' && R() < 0.6 && h > 9) waterTower(B, x1 + 2 + R() * (x2 - x1 - 4), y0 + h + 0.35, z1 + 2 + R() * (z2 - z1 - 4));
    if (style === 'tokyo' || style === 'ny') for (let i = 0; i < 2; i++) { const ax = x1 + 1 + R() * Math.max(0.1, x2 - x1 - 3), az = z1 + 1 + R() * Math.max(0.1, z2 - z1 - 3); B.box(ax, y0 + h + 0.35, az, ax + 1.2, y0 + h + 1.2, az + 0.8, 'flat|9aa0a6|0.5|0.5'); }
    if (style === 'santorini' && R() < 0.45) dome(B, (x1 + x2) / 2, y0 + h + 0.35, (z1 + z2) / 2, Math.min(x2 - x1, z2 - z1) * 0.3);
  }
  // фасады
  for (let side = 0; side < 4; side++) {
    if (!ctx.exposed(side)) continue;
    const f = facade(x1, z1, x2, z2, side);
    if (f.len < 2.5) continue;
    const bays = Math.max(1, Math.floor(f.len / (style === 'tokyo' ? 2.6 : 3.0)));
    const step = f.len / bays;
    // первый этаж: витрины
    if (y0 === 0) shopfront(B, f, style, ctx, step, bays);
    for (let fl = (y0 === 0 ? 1 : 0); fl < floors; fl++) {
      const yb = y0 + fl * S.floor;
      for (let i = 0; i < bays; i++) {
        const c = step * (i + 0.5);
        cityWindow(B, f, c, yb + 0.9, style, ctx);
      }
      if (style === 'ny' && side % 2 === 0 && fl >= 1 && f.len > 7 && ctx.fireEscape !== false) fireEscape(B, f, step * 1.0, yb, step * 1.4);
      if (style === 'tokyo' && R() < 0.35) fbox(B, f, 0.3, f.len - 0.3, yb + 0.05, yb + 0.12, 0, 0.9, 'flat|c8ccd0|0.5|0.4'), fbox(B, f, 0.3, f.len - 0.3, yb + 0.12, yb + 1.0, 0.85, 0.9, 'flat|d0d4d8|0.6|0.3');
    }
    // токийские вертикальные вывески
    if (style === 'tokyo' && f.len > 4) {
      const n = Math.min(3, Math.floor(f.len / 5));
      for (let i = 0; i < n; i++) {
        const a = 1 + R() * (f.len - 2), y = y0 + 4 + R() * Math.max(0.5, h - 9);
        fplane(B, f, a, y + 2, 0.7, 0.9, 3.6, 'neonV', vCell(Math.floor(R() * 16)), true);
        fbox(B, f, a - 0.04, a + 0.04, y + 0.2, y + 3.8, 0, 0.75, 'iron');
      }
      if (R() < 0.6) fplane(B, f, f.len / 2, y0 + Math.min(h - 1.6, 4 + R() * 4), 0.06, Math.min(6, f.len * 0.7), Math.min(6, f.len * 0.7) / 2, 'neonH', hCell(Math.floor(R() * 32)));
    }
    // неоновые пояса Майами
    if (style === 'miami' && ctx.night) {
      const col = ['ff3ea5', '3ef0ff', 'b35cff', 'ffe14a'][Math.floor(R() * 4)];
      fbox(B, f, 0, f.len, y0 + h - 0.6, y0 + h - 0.5, 0, 0.08, 'glowc|' + col + '|3');
      if (R() < 0.6) fbox(B, f, f.len * 0.5 - 0.05, f.len * 0.5 + 0.05, y0 + 3.2, y0 + h - 0.6, 0, 0.08, 'glowc|' + col + '|3');
    }
    // фахверк
    if (style === 'euro' && ctx.R() < 0.45 && floors >= 2) timberFrame(B, f, y0 + S.floor, y0 + h, f.len);
    // балконы с цветами
    if ((style === 'euro' || style === 'santorini') && floors >= 2) for (let i = 0; i < bays; i++) if (R() < 0.35) {
      const c = step * (i + 0.5), yb = y0 + S.floor * (1 + Math.floor(R() * (floors - 1)));
      fbox(B, f, c - 0.9, c + 0.9, yb - 0.05, yb + 0.1, 0, 0.7, S.trim);
      for (let k = -0.85; k <= 0.85; k += 0.17) fbox(B, f, c + k - 0.015, c + k + 0.015, yb + 0.1, yb + 1.0, 0.66, 0.69, 'iron');
      fbox(B, f, c - 0.9, c + 0.9, yb + 0.95, yb + 1.0, 0.64, 0.7, 'iron');
      flowers(B, f, c, yb + 0.1, 0.55, 1.5, R);
    }
  }
}

function cityWindow(B, f, c, y, style, ctx) {
  const R = ctx.R;
  const w = style === 'tokyo' ? 1.3 : style === 'santorini' ? 0.9 : 1.0, h = style === 'ny' ? 1.6 : style === 'santorini' ? 1.2 : 1.5;
  const lit = ctx.night ? R() < 0.55 : R() < 0.08;
  // рама и откос
  const frame = style === 'santorini' ? 'flat|2f6fb3|0.5' : style === 'euro' ? 'flat|f4f0e6|0.6' : 'iron';
  fbox(B, f, c - w / 2 - 0.08, c + w / 2 + 0.08, y - 0.08, y + h + 0.08, 0, 0.04, frame);
  if (lit) fplane(B, f, c, y + h / 2, 0.045, w, h, 'winLit', winCell(Math.floor(R() * 4)));
  else fplane(B, f, c, y + h / 2, 0.045, w, h, 'glass');
  fbox(B, f, c - 0.025, c + 0.025, y, y + h, 0.04, 0.06, frame);
  // подоконник/перемычка
  const trim = STYLES[style].trim;
  fbox(B, f, c - w / 2 - 0.15, c + w / 2 + 0.15, y - 0.16, y - 0.06, 0, 0.14, trim);
  if (style === 'ny' || style === 'euro') fbox(B, f, c - w / 2 - 0.15, c + w / 2 + 0.15, y + h + 0.06, y + h + 0.24, 0, 0.1, trim);
  if (style === 'euro' && R() < 0.55) {
    const col = ['flat|2d5a3a|0.7', 'flat|3a5f8a|0.7', 'flat|8a3a2a|0.7'][Math.floor(R() * 3)];
    fbox(B, f, c - w / 2 - 0.55, c - w / 2 - 0.1, y, y + h, 0.02, 0.07, col);
    fbox(B, f, c + w / 2 + 0.1, c + w / 2 + 0.55, y, y + h, 0.02, 0.07, col);
  }
  if (style === 'euro' && R() < 0.3) flowers(B, f, c, y - 0.06, 0.25, w, R);
  if (style === 'santorini' && R() < 0.4) fbox(B, f, c - w / 2 - 0.4, c - w / 2 - 0.08, y, y + h, 0.02, 0.06, 'flat|2f6fb3|0.6');
  if (style === 'tokyo' && R() < 0.25) { fbox(B, f, c + w / 2 + 0.15, c + w / 2 + 0.85, y + 0.1, y + 0.6, 0, 0.3, 'flat|e6e8ea|0.5'); }
  if (style === 'paris') {
    fbox(B, f, c - w / 2 - 0.2, c + w / 2 + 0.2, y - 0.1, y - 0.02, 0, 0.45, trim);
    for (let k = -w / 2 - 0.15; k <= w / 2 + 0.16; k += 0.12) fbox(B, f, c + k - 0.01, c + k + 0.01, y - 0.02, y + 0.85, 0.4, 0.43, 'iron');
    fbox(B, f, c - w / 2 - 0.2, c + w / 2 + 0.2, y + 0.82, y + 0.88, 0.38, 0.45, 'iron');
  }
  if (style === 'kyoto') for (let k = -w / 2 + 0.08; k < w / 2; k += 0.1) fbox(B, f, c + k - 0.015, c + k + 0.015, y, y + h, 0.05, 0.09, 'T|wood3|3a2616|1.5');
  if (style === 'miami') fbox(B, f, c - w / 2 - 0.3, c + w / 2 + 0.3, y + h + 0.1, y + h + 0.2, 0, 0.6, trim);
}

function shopfront(B, f, style, ctx, step, bays) {
  const R = ctx.R, night = ctx.night;
  for (let i = 0; i < bays; i++) {
    const c = step * (i + 0.5), w = Math.min(step - 0.6, 3);
    const r = R();
    if (style === 'santorini') {
      if (R() < 0.4) {
        fbox(B, f, c - 0.55, c + 0.55, 0.05, 2.25, 0, 0.05, ['flat|1f5fbf|0.55', 'flat|2f8fbf|0.55', 'flat|b8402a|0.6'][Math.floor(R() * 3)]);
        fbox(B, f, c - 0.7, c + 0.7, 2.25, 2.4, 0, 0.12, 'T|plaster2|ffffff|3');
        fbox(B, f, c - 0.75, c + 0.75, 0, 0.12, 0, 0.5, 'T|plaster2|ffffff|3');
      } else cityWindow(B, f, c, 0.9, style, ctx);
      if (R() < 0.35) bougainvillea(B, f, c + (R() - 0.5) * step * 0.6, R);
      continue;
    }
    if (r < 0.2 && style !== 'euro') {
      // рольставни
      fbox(B, f, c - w / 2, c + w / 2, 0.5, 2.7, 0, 0.05, 'T|metal3|8a9098|1.2');
      continue;
    }
    // витрина
    const si = Math.floor(R() * 4);
    fplane(B, f, c, 1.55, 0.04, w, 2.1, 'shopGlass', [si / 4, 0, (si + 1) / 4, 1]);
    fbox(B, f, c - w / 2 - 0.12, c + w / 2 + 0.12, 2.6, 2.75, 0, 0.12, 'iron');
    fbox(B, f, c - w / 2 - 0.12, c - w / 2, 0.5, 2.6, 0, 0.12, 'iron');
    fbox(B, f, c + w / 2, c + w / 2 + 0.12, 0.5, 2.6, 0, 0.12, 'iron');
    // вывеска
    const pool = SIGNS[style] || SIGNS.ny;
    const sign = pool[Math.floor(R() * pool.length)];
    fplane(B, f, c, 3.05, 0.06, w, w / 2 > 0.6 ? 0.6 : w / 2, 'neonH', hCell(sign));
    // маркиза
    if (style === 'euro' || style === 'paris' || (style === 'miami' && R() < 0.6) || (style === 'ny' && R() < 0.5) || (style === 'tokyo' && R() < 0.3)) {
      const col = ['cloth', 'cloth_b', 'cloth_g'][Math.floor(R() * 3)];
      const g = new THREE.BoxGeometry(w + 0.3, 0.04, 1.3); g.rotateX(0.3);
      const [x, z] = f.p(c, 0.6);
      place(B, col, ensureUV(g), x, 2.62, z, ryOf(f));
    }
    if (night) ctx.pools.push([...f.p(c, 1.6), 'ffd9a0', 2.6, 0.35]);
    if ((style === 'tokyo' && R() < 0.4) || style === 'kyoto') noren(B, f, c, w);
  }
}

function bougainvillea(B, f, a, R) {
  const cols = ['leaf|e0338a', 'leaf|f04aa0', 'leaf|c42a78', 'leaf|3f7a32'];
  for (let k = 0; k < 14; k++) {
    const g = new THREE.IcosahedronGeometry(0.25 + R() * 0.25, 0);
    const [x, z] = f.p(a + (R() - 0.5) * 1.6, 0.15 + R() * 0.2);
    place(B, cols[Math.floor(R() * cols.length)], ensureUV(g), x, 0.3 + R() * 2.8 - (k < 4 ? 0 : 0) , z);
  }
}

function noren(B, f, c, w) {
  for (let k = 0; k < 3; k++) {
    const g = new THREE.PlaneGeometry(w / 3 - 0.04, 0.7);
    const [x, z] = f.p(c - w / 3 + k * w / 3, 0.08);
    place(B, 'flat|1d2a4a|0.9', g, x, 2.25, z, ryOf(f));
  }
}

function flowers(B, f, c, y, o, w, R) {
  fbox(B, f, c - w / 2, c + w / 2, y, y + 0.18, o - 0.12, o + 0.08, 'T|wood|8a5a3a|1');
  const cols = ['flat|e0284f|0.8', 'flat|ff7ab6|0.8', 'flat|ffd23d|0.8', 'flat|ffffff|0.8', 'flat|b04bd6|0.8'];
  for (let k = 0; k < Math.max(3, w * 5); k++) {
    const g = new THREE.IcosahedronGeometry(0.07 + R() * 0.05, 0);
    const [x, z] = f.p(c - w / 2 + 0.08 + R() * (w - 0.16), o - 0.02 + (R() - 0.5) * 0.12);
    place(B, R() < 0.4 ? 'leaf|3f7a32' : cols[Math.floor(R() * cols.length)], g, x, y + 0.22 + R() * 0.08, z);
  }
}

function timberFrame(B, f, yA, yB, L) {
  const m = 'T|wood3|4a3020|1.5';
  fbox(B, f, 0, L, yA - 0.1, yA + 0.08, 0, 0.06, m);
  fbox(B, f, 0, L, yB - 0.3, yB - 0.12, 0, 0.06, m);
  for (let a = 0; a <= L + 0.01; a += L / Math.max(2, Math.round(L / 2.4))) fbox(B, f, Math.max(0, a - 0.09), Math.min(L, a + 0.09), yA, yB - 0.2, 0, 0.06, m);
}

function fireEscape(B, f, a0, yb, w) {
  for (let a = a0; a < f.len - w; a += f.len) {
    fbox(B, f, a, a + w, yb - 0.05, yb + 0.03, 0, 1.0, 'iron');
    fbox(B, f, a, a + w, yb + 0.95, yb + 1.0, 0.95, 1.0, 'iron');
    for (let k = 0; k <= w; k += 0.25) fbox(B, f, a + k - 0.012, a + k + 0.012, yb, yb + 0.98, 0.96, 0.99, 'iron');
    // лестница
    const [x0, z0] = f.p(a + w * 0.15, 0.6), [x1, z1] = f.p(a + w * 0.85, 0.6);
    const len = Math.hypot(x1 - x0, z1 - z0, 3.4);
    const g = new THREE.BoxGeometry(0.5, 0.05, len);
    const ry = Math.atan2(x1 - x0, z1 - z0), rx = -Math.atan2(-3.4, Math.hypot(x1 - x0, z1 - z0));
    place(B, 'iron', g, (x0 + x1) / 2, yb - 1.7, (z0 + z1) / 2, ry, rx);
    break;
  }
}

function mansard(B, x1, z1, x2, z2, y, R) {
  const inset = 1.1, h1 = 2.6;
  const g = new THREE.CylinderGeometry(1, 1, 1, 4, 1); // заменим ниже на усечённую пирамиду
  void g;
  const pts = [[x1, z1], [x2, z1], [x2, z2], [x1, z2]];
  const pos = [];
  const top = [[x1 + inset, z1 + inset], [x2 - inset, z1 + inset], [x2 - inset, z2 - inset], [x1 + inset, z2 - inset]];
  for (let i = 0; i < 4; i++) {
    const a = pts[i], b = pts[(i + 1) % 4], c = top[(i + 1) % 4], d = top[i];
    pos.push(a[0], y, a[1], b[0], y, b[1], c[0], y + h1, c[1], a[0], y, a[1], c[0], y + h1, c[1], d[0], y + h1, d[1]);
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const uv = []; for (let i = 0; i < pos.length / 3; i++) uv.push((pos[i * 3] + pos[i * 3 + 2]) / 1.6, pos[i * 3 + 1] / 1.6);
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.computeVertexNormals();
  B.push('roofTileJp', geo);
  B.box(x1 + inset, y + h1, z1 + inset, x2 - inset, y + h1 + 0.25, z2 - inset, 'flat|5a6068|0.5|0.6');
  // мансардные окна
  const n = Math.max(1, Math.floor((x2 - x1) / 3.2));
  for (let i = 0; i < n; i++) for (const zz of [z1 + 0.55, z2 - 0.55]) {
    const x = x1 + (x2 - x1) * (i + 0.5) / n;
    B.box(x - 0.45, y + 0.3, zz - 0.35, x + 0.45, y + 1.6, zz + 0.35, 'T|concrete3|f6ecd8|3');
    B.box(x - 0.32, y + 0.45, zz - 0.37, x + 0.32, y + 1.35, zz + 0.37, 'glass');
  }
  for (let i = 0; i < 2; i++) { const cx = x1 + 1.5 + R() * (x2 - x1 - 3), cz = (z1 + z2) / 2; B.box(cx - 0.35, y, cz - 0.25, cx + 0.35, y + h1 + 1.1, cz + 0.25, 'T|bricks|b07a62|2'); }
  B.colliders.push({ min: [x1, y, z1], max: [x2, y + h1, z2] });
}

function gableRoof(B, x1, z1, x2, z2, y, R, mat = 'roofTile', over = 0.35, slope = 0.42) {
  const along = x2 - x1 >= z2 - z1;
  const L = along ? x2 - x1 : z2 - z1, W = along ? z2 - z1 : x2 - x1;
  const rh = Math.min(3.2, W * slope);
  const s = new THREE.Shape();
  s.moveTo(-W / 2 - over, 0); s.lineTo(W / 2 + over, 0); s.lineTo(0, rh); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: L + 0.5, bevelEnabled: false });
  g.translate(0, 0, -(L + 0.5) / 2);
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 1.6, uv.getY(i) / 1.6);
  if (along) g.rotateY(Math.PI / 2);
  place(B, mat, g, (x1 + x2) / 2, y, (z1 + z2) / 2);
  if (mat === 'roofTileJp') return B.colliders.push({ min: [x1, y, z1], max: [x2, y + rh * 0.6, z2] });
  // дымоходы
  for (let i = 0; i < 2; i++) if (R() < 0.6) {
    const cx = along ? x1 + 1 + R() * (L - 2) : (x1 + x2) / 2 + (R() - 0.5) * W * 0.4;
    const cz = along ? (z1 + z2) / 2 + (R() - 0.5) * W * 0.4 : z1 + 1 + R() * (L - 2);
    B.box(cx - 0.3, y, cz - 0.3, cx + 0.3, y + rh + 0.7, cz + 0.3, 'T|bricks|b07a62|2');
  }
  B.colliders.push({ min: [x1, y, z1], max: [x2, y + rh * 0.6, z2] });
}

function dome(B, x, y, z, r) {
  const g = new THREE.SphereGeometry(r, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  place(B, 'flat|1f5fbf|0.35|0.1', g, x, y + 0.3, z);
  B.box(x - r * 1.05, y, z - r * 1.05, x + r * 1.05, y + 0.32, z + r * 1.05, 'T|plaster2|ffffff|3');
  const c = new THREE.CylinderGeometry(0.05, 0.05, 0.8, 6); place(B, 'flat|f0f0f0|0.5', c, x, y + 0.3 + r + 0.4, z);
}

function waterTower(B, x, y, z) {
  for (const [dx, dz] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) B.box(x + dx - 0.07, y, z + dz - 0.07, x + dx + 0.07, y + 2.2, z + dz + 0.07, 'iron');
  const t = new THREE.CylinderGeometry(1.2, 1.2, 2.4, 16); place(B, 'T|wood3|7a5a40|1.5', ensureUV(t), x, y + 3.4, z);
  const c = new THREE.ConeGeometry(1.3, 0.9, 16); place(B, 'flat|3a3530|0.8', c, x, y + 5.05, z);
}

// ---------- Улица ----------
export function road(B, x1, z1, x2, z2, ctx, opt = {}) {
  const wet = ctx.night ? '0.35' : '0.9';
  B.box(x1, 0, z1, x2, 0.015, z2, `T|asphalt2|8a8c90|4|${wet}`);
  const along = x2 - x1 >= z2 - z1;
  // разметка
  const mid = along ? (z1 + z2) / 2 : (x1 + x2) / 2;
  const L = along ? x2 - x1 : z2 - z1;
  for (let a = 0; a < L; a += 4) {
    if (along) B.box(x1 + a, 0.016, mid - 0.07, x1 + a + 2, 0.02, mid + 0.07, opt.yellow ? 'flat|e0b020|0.6' : 'flat|e8e8e8|0.6');
    else B.box(mid - 0.07, 0.016, z1 + a, mid + 0.07, 0.02, z1 + a + 2, opt.yellow ? 'flat|e0b020|0.6' : 'flat|e8e8e8|0.6');
  }
  // зебра
  if (opt.zebra !== undefined) for (let k = 0; k < 7; k++) {
    if (along) { const zz = z1 + 0.6 + k * ((z2 - z1 - 1.2) / 7); B.box(opt.zebra - 1.6, 0.016, zz, opt.zebra + 1.6, 0.02, zz + 0.45, 'flat|e8e8e8|0.6'); }
    else { const xx = x1 + 0.6 + k * ((x2 - x1 - 1.2) / 7); B.box(xx, 0.016, opt.zebra - 1.6, xx + 0.45, 0.02, opt.zebra + 1.6, 'flat|e8e8e8|0.6'); }
  }
}
export function sidewalk(B, x1, z1, x2, z2, mat = 'T|concrete2|cfcac0|2.5') {
  B.box(x1, 0, z1, x2, 0.08, z2, mat);
}

export function streetLamp(B, x, z, ctx, kind = 'modern', ry = 0) {
  if (kind === 'euro') {
    B.box(x - 0.08, 0, z - 0.08, x + 0.08, 3.6, z + 0.08, 'iron');
    const g = new THREE.CylinderGeometry(0.22, 0.15, 0.5, 6); place(B, 'iron', g, x, 3.85, z);
    const gl = new THREE.CylinderGeometry(0.17, 0.12, 0.38, 6); place(B, 'bulb', gl, x, 3.85, z);
    const c = new THREE.ConeGeometry(0.3, 0.3, 6); place(B, 'iron', c, x, 4.25, z);
    if (ctx.night || ctx.evening) ctx.lamps.push([x, 3.8, z, 0xffc070]);
    if (ctx.night || ctx.evening) ctx.pools.push([x, z, 'ffb860', 5.5, 0.4]);
  } else {
    B.box(x - 0.07, 0, z - 0.07, x + 0.07, 5.2, z + 0.07, 'flat|6a6e72|0.5|0.6');
    const dx = Math.sin(ry) * 0.9, dz = Math.cos(ry) * 0.9;
    const arm = new THREE.BoxGeometry(0.08, 0.08, 1.2); place(B, 'flat|6a6e72|0.5|0.6', arm, x + dx * 0.5, 5.15, z + dz * 0.5, ry);
    const head = new THREE.BoxGeometry(0.35, 0.12, 0.6); place(B, 'flat|4a4e52|0.5|0.6', head, x + dx, 5.1, z + dz, ry);
    const bulb = new THREE.BoxGeometry(0.28, 0.02, 0.5); place(B, 'bulb', bulb, x + dx, 5.03, z + dz, ry);
    if (ctx.night || ctx.evening) { ctx.lamps.push([x + dx, 5.0, z + dz, 0xffe0b0]); ctx.pools.push([x + dx, z + dz, 'ffe0b0', 6, 0.35]); }
  }
  B.colliders.push({ min: [x - 0.1, 0, z - 0.1], max: [x + 0.1, 4, z + 0.1] });
}

export function tree(B, x, z, ctx, kind = 'green', s = 1) {
  const R = ctx.R;
  const H = (3.2 + R() * 1.5) * s;
  const t = new THREE.CylinderGeometry(0.12 * s, 0.2 * s, H, 8); place(B, 'bark', ensureUV(t), x, H / 2, z);
  const col = kind === 'maple' ? ['leaf|d2401e', 'leaf|e8702a', 'leaf|b8281a', 'leaf|f0a030'] : kind === 'sakura' ? ['leaf|f6b8cf', 'leaf|ffd0de', 'leaf|e98fb0'] : kind === 'olive' ? ['leaf|7d8a4a', 'leaf|6a7a3e'] : ['leaf|4f8a3a', 'leaf|3d7530', 'leaf|62a046'];
  const n = 6;
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2 + R(), r = (0.6 + R() * 0.8) * s;
    const g = new THREE.IcosahedronGeometry((0.9 + R() * 0.6) * s, 1);
    place(B, col[Math.floor(R() * col.length)], ensureUV(g), x + Math.cos(a) * r, H + (R() - 0.3) * 0.9 * s, z + Math.sin(a) * r, R() * 3);
  }
  const top = new THREE.IcosahedronGeometry(1.1 * s, 1); place(B, col[0], ensureUV(top), x, H + 0.9 * s, z);
  B.colliders.push({ min: [x - 0.25, 0, z - 0.25], max: [x + 0.25, H, z + 0.25] });
  // кадка/решётка у основания
  B.box(x - 0.7, 0, z - 0.7, x + 0.7, 0.1, z + 0.7, 'T|ground|9a8a70|2');
}

export function palmTree(B, x, z, ctx, H = 7) {
  const R = ctx.R;
  let px = x, pz = z, py = 0;
  const lean = (R() - 0.5) * 0.8, dir = R() * Math.PI * 2;
  for (let i = 0; i < 8; i++) {
    const t = (i + 1) / 8, nx = x + Math.cos(dir) * lean * t * t * 3, nz = z + Math.sin(dir) * lean * t * t * 3, ny = H * t;
    const len = Math.hypot(nx - px, ny - py, nz - pz);
    const g = new THREE.CylinderGeometry(0.16 - 0.06 * t, 0.2 - 0.06 * t, len + 0.04, 8);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(nx - px, ny - py, nz - pz).normalize()));
    g.translate((px + nx) / 2, (py + ny) / 2, (pz + nz) / 2); B.push('bark', ensureUV(g));
    px = nx; py = ny; pz = nz;
  }
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * Math.PI * 2 + R() * 0.3, len = 2.6 + R();
    const g = new THREE.PlaneGeometry(0.9, len, 1, 5);
    const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) { const yy = p.getY(k) + len / 2; p.setXYZ(k, p.getX(k) * (1 - yy / len * 0.7), yy, -Math.pow(yy / len, 2) * 1.5); }
    g.computeVertexNormals(); g.rotateX(-Math.PI / 2 + 0.45); g.rotateY(a); g.translate(px, py, pz);
    B.push('leafPalm', g);
  }
  B.colliders.push({ min: [x - 0.25, 0, z - 0.25], max: [x + 0.25, 3, z + 0.25] });
}

export function car(B, x, z, ry, ctx, kind = 'sedan') {
  const R = ctx.R;
  const paints = { taxiNY: 'paint|f2c200', taxiJP: 'paint|1b1d22', van: 'paint|e8e8e4', sedan: ['paint|8e1f22', 'paint|1f3f6b', 'paint|c8cbd0', 'paint|202226', 'paint|3d5a3a', 'paint|f0eee8'][Math.floor(R() * 6)], kei: ['paint|f0eee8', 'paint|6ab0d8', 'paint|e8a83a'][Math.floor(R() * 3)] };
  const paint = paints[kind] || paints.sedan;
  const L = kind === 'kei' ? 3.4 : kind === 'van' ? 4.8 : 4.4, W = kind === 'kei' ? 1.5 : 1.8;
  const c = Math.cos(ry), s = Math.sin(ry);
  const P = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
  const put = (mat, g, lx, y, lz) => { const [px, pz] = P(lx, lz); place(B, mat, ensureUV(g), px, y, pz, ry); };
  const rnd = (w, h, d, r) => { const g = new THREE.BoxGeometry(w, h, d, 2, 2, 2); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const vx = p.getX(i), vy = p.getY(i), vz = p.getZ(i); p.setXYZ(i, vx * (1 - r * Math.abs(vy) / h), vy, vz * (1 - r * 0.5 * Math.abs(vy) / h)); } g.computeVertexNormals(); return g; };
  if (kind === 'van') {
    put(paint, rnd(L, 1.9, W, 0.08), 0, 1.25, 0);
    put('carGlass', new THREE.BoxGeometry(0.05, 0.7, W * 0.9), L / 2 + 0.01, 1.7, 0);
  } else {
    put(paint, rnd(L, 0.7, W, 0.15), 0, 0.7, 0);
    put(paint, rnd(L * (kind === 'kei' ? 0.75 : 0.52), 0.62, W * 0.88, 0.25), kind === 'kei' ? -0.2 : -0.15, 1.35, 0);
    put('carGlass', rnd(L * (kind === 'kei' ? 0.76 : 0.53), 0.5, W * 0.9, 0.25), kind === 'kei' ? -0.2 : -0.15, 1.36, 0);
  }
  put('flat|111214|0.6', new THREE.BoxGeometry(L + 0.06, 0.18, W + 0.02), 0, 0.42, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const wg = new THREE.CylinderGeometry(0.34, 0.34, 0.24, 16); wg.rotateX(Math.PI / 2);
    put('flat|151515|0.9', wg, sx * L * 0.32, 0.34, sz * (W / 2 - 0.06));
    const rim = new THREE.CylinderGeometry(0.2, 0.2, 0.26, 12); rim.rotateX(Math.PI / 2);
    put('chrome', rim, sx * L * 0.32, 0.34, sz * (W / 2 - 0.05));
  }
  put('head', new THREE.BoxGeometry(0.05, 0.12, 0.3), L / 2, 0.8, W * 0.32); put('head', new THREE.BoxGeometry(0.05, 0.12, 0.3), L / 2, 0.8, -W * 0.32);
  put('tail', new THREE.BoxGeometry(0.05, 0.12, 0.3), -L / 2, 0.85, W * 0.33); put('tail', new THREE.BoxGeometry(0.05, 0.12, 0.3), -L / 2, 0.85, -W * 0.33);
  if (kind === 'taxiNY' || kind === 'taxiJP') put(kind === 'taxiJP' ? 'glowc|ffd040|1.2' : 'glowc|fff4d0|1', new THREE.BoxGeometry(0.5, 0.18, 0.2), -0.15, 1.75, 0);
  // коллайдер по габаритам (ось-ориентированный)
  const hw = Math.abs(L / 2 * c) + Math.abs(W / 2 * s), hd = Math.abs(L / 2 * s) + Math.abs(W / 2 * c);
  B.colliders.push({ min: [x - hw, 0, z - hd], max: [x + hw, kind === 'van' ? 2.2 : 1.1, z + hd] });
  if (kind !== 'van') B.colliders.push({ min: [x - hw * 0.6, 1.1, z - hd * 0.6], max: [x + hw * 0.6, 1.65, z + hd * 0.6] });
}

export function vending(B, x, z, ry, ctx) {
  const c = Math.cos(ry), s = Math.sin(ry);
  const g = new THREE.BoxGeometry(1.0, 1.85, 0.75); place(B, 'flat|d8dde2|0.4|0.3', ensureUV(g), x, 0.925, z, ry);
  const f = planeUV(0.82, 1.55, 0, 0, 1, 1); place(B, 'vending', f, x + s * 0.38, 0.95, z + c * 0.38, ry);
  if (ctx.night) ctx.pools.push([x + s * 1.0, z + c * 1.0, 'cfe6ff', 2.4, 0.45]);
  B.colliders.push({ min: [x - 0.55, 0, z - 0.55], max: [x + 0.55, 1.85, z + 0.55] });
}

export function powerPole(B, x, z, h = 9) {
  const g = new THREE.CylinderGeometry(0.13, 0.17, h, 10); place(B, 'T|concrete|b8b4ac|2', ensureUV(g), x, h / 2, z);
  B.box(x - 0.9, h - 0.6, z - 0.06, x + 0.9, h - 0.45, z + 0.06, 'iron');
  B.box(x - 0.7, h - 1.4, z - 0.06, x + 0.7, h - 1.28, z + 0.06, 'iron');
  const tr = new THREE.CylinderGeometry(0.28, 0.28, 0.8, 12); place(B, 'flat|8a9096|0.5|0.5', tr, x + 0.35, h - 2.3, z);
  B.colliders.push({ min: [x - 0.2, 0, z - 0.2], max: [x + 0.2, h, z + 0.2] });
  return [x, h - 0.5, z];
}
export function wires(B, a, b, n = 3, sag = 0.7) {
  for (let k = 0; k < n; k++) {
    const pts = [];
    const off = (k - (n - 1) / 2) * 0.55;
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      pts.push(new THREE.Vector3(a[0] + (b[0] - a[0]) * t + off * 0.2, a[1] + (b[1] - a[1]) * t - Math.sin(t * Math.PI) * sag - k * 0.25, a[2] + (b[2] - a[2]) * t + off));
    }
    B.push('iron', new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, 0.012, 3));
  }
}
export function lanternString(B, a, b, n, ctx) {
  wires(B, a, b, 1, 0.4);
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t - Math.sin(t * Math.PI) * 0.4 - 0.35, z = a[2] + (b[2] - a[2]) * t;
    const g = new THREE.SphereGeometry(0.22, 12, 10); g.scale(1, 1.35, 1);
    place(B, 'lantern', g, x, y, z);
    B.box(x - 0.12, y + 0.27, z - 0.12, x + 0.12, y + 0.33, z + 0.12, 'flat|1a1410|0.8');
    if (ctx.night && i % 3 === 0) ctx.pools.push([x, z, 'ff5a30', 2.2, 0.35]);
  }
}
export function torii(B, x, z, ry, s = 1) {
  const c = Math.cos(ry), sn = Math.sin(ry);
  const P = (l) => [x + l * c, z - l * sn];
  for (const l of [-1.6 * s, 1.6 * s]) {
    const [px, pz] = P(l);
    const g = new THREE.CylinderGeometry(0.18 * s, 0.22 * s, 4.2 * s, 14); place(B, 'flat|c8321e|0.5', ensureUV(g), px, 2.1 * s, pz);
    B.box(px - 0.26 * s, 0, pz - 0.26 * s, px + 0.26 * s, 0.3 * s, pz + 0.26 * s, 'flat|1a1a1a|0.6');
    B.colliders.push({ min: [px - 0.25, 0, pz - 0.25], max: [px + 0.25, 4.2 * s, pz + 0.25] });
  }
  const top = new THREE.BoxGeometry(4.9 * s, 0.3 * s, 0.4 * s); place(B, 'flat|1a1a1a|0.6', ensureUV(top), x, 4.45 * s, z, ry);
  const top2 = new THREE.BoxGeometry(4.6 * s, 0.25 * s, 0.32 * s); place(B, 'flat|c8321e|0.5', ensureUV(top2), x, 4.15 * s, z, ry);
  const mid = new THREE.BoxGeometry(3.9 * s, 0.2 * s, 0.25 * s); place(B, 'flat|c8321e|0.5', ensureUV(mid), x, 3.45 * s, z, ry);
}
export function stoneLantern(B, x, z, ctx) {
  B.box(x - 0.35, 0, z - 0.35, x + 0.35, 0.25, z + 0.35, 'T|concrete|b0ab9f|1');
  const p = new THREE.CylinderGeometry(0.12, 0.16, 0.9, 8); place(B, 'T|concrete|b0ab9f|1', ensureUV(p), x, 0.7, z);
  B.box(x - 0.3, 1.15, z - 0.3, x + 0.3, 1.6, z + 0.3, 'T|concrete|b0ab9f|1');
  B.box(x - 0.18, 1.22, z - 0.31, x + 0.18, 1.52, z + 0.31, ctx.night ? 'glowc|ffb060|2' : 'flat|222|0.9');
  const r = new THREE.ConeGeometry(0.5, 0.35, 4); place(B, 'T|concrete|b0ab9f|1', ensureUV(r), x, 1.78, z, Math.PI / 4);
  B.colliders.push({ min: [x - 0.35, 0, z - 0.35], max: [x + 0.35, 1.9, z + 0.35] });
  if (ctx.night) ctx.pools.push([x, z, 'ffb060', 2, 0.4]);
}
export function bench(B, x, z, ry) {
  const c = Math.cos(ry), s = Math.sin(ry);
  const put = (g, lx, y, lz, mat) => place(B, mat, ensureUV(g), x + lx * c + lz * s, y, z - lx * s + lz * c, ry);
  put(new THREE.BoxGeometry(1.8, 0.06, 0.45), 0, 0.45, 0, 'T|wood|b08860|1');
  put(new THREE.BoxGeometry(1.8, 0.4, 0.05), 0, 0.72, -0.22, 'T|wood|b08860|1');
  for (const l of [-0.75, 0.75]) put(new THREE.BoxGeometry(0.06, 0.45, 0.45), l, 0.22, 0, 'iron');
}
export function umbrellaTable(B, x, z, color, ctx) {
  const t = new THREE.CylinderGeometry(0.45, 0.45, 0.05, 16); place(B, 'flat|f0f0f0|0.5', t, x, 0.74, z);
  B.box(x - 0.04, 0, z - 0.04, x + 0.04, 2.3, z + 0.04, 'iron');
  const u = new THREE.ConeGeometry(1.4, 0.45, 8, 1, true); place(B, color, ensureUV(u), x, 2.35, z);
  for (let k = 0; k < 3; k++) { const a = k * 2.1 + 0.4; const cx = x + Math.cos(a) * 0.75, cz = z + Math.sin(a) * 0.75; B.box(cx - 0.18, 0.42, cz - 0.18, cx + 0.18, 0.47, cz + 0.18, 'iron'); B.box(cx - 0.02, 0, cz - 0.02, cx + 0.02, 0.45, cz + 0.02, 'iron'); }
  B.colliders.push({ min: [x - 0.5, 0, z - 0.5], max: [x + 0.5, 0.8, z + 0.5] });
}
export function fountain(B, x, z, r, ctx) {
  const ring = new THREE.CylinderGeometry(r, r + 0.15, 0.6, 32); place(B, 'T|concrete3|e0d6c2|2', ensureUV(ring), x, 0.3, z);
  const w = new THREE.CircleGeometry(r - 0.15, 32); place(B, 'water', w, x, 0.52, z, 0, -Math.PI / 2);
  const col = new THREE.CylinderGeometry(0.25, 0.35, 1.8, 16); place(B, 'T|concrete3|e0d6c2|2', ensureUV(col), x, 1.2, z);
  const bowl = new THREE.CylinderGeometry(0.9, 0.3, 0.35, 20); place(B, 'T|concrete3|e0d6c2|2', ensureUV(bowl), x, 2.1, z);
  const top = new THREE.SphereGeometry(0.22, 12, 10); place(B, 'T|concrete3|e0d6c2|2', ensureUV(top), x, 2.45, z);
  B.colliders.push({ min: [x - r, 0, z - r], max: [x + r, 0.6, z + r] });
  B.colliders.push({ min: [x - 0.9, 0.6, z - 0.9], max: [x + 0.9, 2.5, z + 0.9] });
}
export function bunting(B, a, b, n) {
  wires(B, a, b, 1, 0.5);
  const cols = ['flat|e63946|0.8', 'flat|f1c40f|0.8', 'flat|2e86de|0.8', 'flat|27ae60|0.8', 'flat|ffffff|0.8'];
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t - Math.sin(t * Math.PI) * 0.5, z = a[2] + (b[2] - a[2]) * t;
    const s = new THREE.Shape(); s.moveTo(-0.18, 0); s.lineTo(0.18, 0); s.lineTo(0, -0.4); s.closePath();
    const g = new THREE.ShapeGeometry(s);
    place(B, cols[i % cols.length], ensureUV(g), x, y, z, Math.atan2(b[0] - a[0], b[2] - a[2]) + Math.PI / 2);
  }
}
export function billboard(B, x, y, z, ry, w, h, cell) {
  const uv = [(cell % 2) / 2, 1 - (Math.floor(cell / 2) + 1) / 2, (cell % 2 + 1) / 2, 1 - Math.floor(cell / 2) / 2];
  const g = planeUV(w, h, ...uv); place(B, 'ads', g, x, y, z, ry);
  const back = new THREE.BoxGeometry(w + 0.2, h + 0.2, 0.15);
  const c = Math.cos(ry), s = Math.sin(ry);
  place(B, 'iron', ensureUV(back), x - s * 0.1, y, z - c * 0.1, ry);
  for (const l of [-w / 3, w / 3]) B.box(x + l * c - 0.06 - s * 0.3, y - h / 2 - 2, z - l * s - 0.06 - c * 0.3, x + l * c + 0.06 - s * 0.3, y - h / 2, z - l * s + 0.06 - c * 0.3, 'iron');
}
export function hydrant(B, x, z) {
  const g = new THREE.CylinderGeometry(0.13, 0.15, 0.65, 10); place(B, 'paint|c0281f', ensureUV(g), x, 0.33, z);
  const t = new THREE.SphereGeometry(0.14, 10, 8); place(B, 'paint|c0281f', ensureUV(t), x, 0.68, z);
  const s = new THREE.CylinderGeometry(0.05, 0.05, 0.45, 8); s.rotateZ(Math.PI / 2); place(B, 'paint|c0281f', ensureUV(s), x, 0.5, z);
}
export function dumpster(B, x, z, ry) {
  const g = new THREE.BoxGeometry(2, 1.3, 1.2); place(B, 'paint|2e5a3c', ensureUV(g), x, 0.75, z, ry);
  const l = new THREE.BoxGeometry(2.05, 0.08, 1.25); place(B, 'flat|1a1a1a|0.7', ensureUV(l), x, 1.43, z, ry, 0.05);
  const c = Math.abs(Math.cos(ry)), s = Math.abs(Math.sin(ry));
  B.colliders.push({ min: [x - c - 0.6 * s, 0, z - s - 0.6 * c], max: [x + c + 0.6 * s, 1.45, z + s + 0.6 * c] });
}

// Освещение ночью: «пятна» света на земле + пул динамических источников
export function finishLighting(group, ctx, quality) {
  // пятна света (одна геометрия на цвет)
  const byCol = {};
  for (const [x, z, col, r, a] of ctx.pools) {
    const key = col + '|' + (a || 0.4);
    const g = new THREE.PlaneGeometry(r * 2, r * 2); g.rotateX(-Math.PI / 2); g.translate(x, 0.03 + Math.random() * 0.005, z);
    (byCol[key] = byCol[key] || []).push(g);
  }
  return byCol;
}

export function makeLightPool(scene, anchors, count) {
  const lights = [];
  for (let i = 0; i < count; i++) { const l = new THREE.PointLight(0xffd9a0, 0, 14, 2); scene.add(l); lights.push(l); }
  let t = 0;
  return (camPos, dt = 0.016) => {
    t -= dt; if (t > 0) return; t = 0.25;
    const sorted = anchors.map(a => [a, (a[0] - camPos.x) ** 2 + (a[2] - camPos.z) ** 2]).sort((p, q) => p[1] - q[1]);
    for (let i = 0; i < lights.length; i++) {
      const s = sorted[i];
      if (!s) { lights[i].intensity = 0; continue; }
      lights[i].position.set(s[0][0], s[0][1], s[0][2]);
      lights[i].color.setHex(s[0][3]);
      lights[i].intensity = 10;
    }
  };
}

export { puffTexture };
