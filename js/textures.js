// Процедурные текстуры (без внешних файлов): поверхности карт и скины оружия.
import * as THREE from 'three';

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; };
}

function canvas(size = 128) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return [c, c.getContext('2d')];
}

function noise(ctx, size, amount, r, alpha = 0.18) {
  for (let i = 0; i < amount; i++) {
    const x = r() * size, y = r() * size, s = 1 + r() * 3;
    const v = r() > 0.5 ? 255 : 0;
    ctx.fillStyle = `rgba(${v},${v},${v},${alpha * r()})`;
    ctx.fillRect(x, y, s, s);
  }
}

function toTexture(c) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

const cache = new Map();

// Поверхности карт. tile — сколько метров занимает одна текстура.
export const SURFACES = {
  sand:     { base: '#d8b98a', kind: 'ground', tile: 4 },
  asphalt:  { base: '#4b4f55', kind: 'ground', tile: 4 },
  wall:     { base: '#d9c39d', kind: 'brick', tile: 3 },
  wall2:    { base: '#c89f72', kind: 'plaster', tile: 3 },
  concrete: { base: '#9a9a96', kind: 'plaster', tile: 2.5 },
  crate:    { base: '#a8773f', kind: 'crate', tile: 0.9 },
  metal_r:  { base: '#a8382e', kind: 'container', tile: 2.6 },
  metal_b:  { base: '#2f5d8a', kind: 'container', tile: 2.6 },
  metal_g:  { base: '#3f7a4a', kind: 'container', tile: 2.6 },
  metal_o:  { base: '#c9772a', kind: 'container', tile: 2.6 },
  border:   { base: '#7c6a55', kind: 'brick', tile: 3 },
  dark:     { base: '#3a3d42', kind: 'plaster', tile: 3 },
};

export function surfaceTexture(name) {
  if (cache.has(name)) return cache.get(name);
  const def = SURFACES[name] || SURFACES.concrete;
  const size = 128;
  const [c, ctx] = canvas(size);
  const r = rng(name.length * 977 + name.charCodeAt(0) * 31);
  ctx.fillStyle = def.base; ctx.fillRect(0, 0, size, size);
  if (def.kind === 'ground') {
    noise(ctx, size, 1400, r, 0.22);
    ctx.strokeStyle = 'rgba(0,0,0,0.08)';
    for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(r() * size, r() * size); ctx.lineTo(r() * size, r() * size); ctx.stroke(); }
  } else if (def.kind === 'brick') {
    noise(ctx, size, 900, r, 0.15);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    const bh = 16;
    for (let y = 0; y < size; y += bh) {
      ctx.fillRect(0, y, size, 2);
      const off = (y / bh) % 2 ? 16 : 0;
      for (let x = off; x < size + 32; x += 32) ctx.fillRect(x, y, 2, bh);
    }
  } else if (def.kind === 'plaster') {
    noise(ctx, size, 1600, r, 0.16);
    ctx.fillStyle = 'rgba(0,0,0,0.07)';
    for (let i = 0; i < 5; i++) ctx.fillRect(r() * size, r() * size, 10 + r() * 30, 6 + r() * 20);
  } else if (def.kind === 'crate') {
    noise(ctx, size, 600, r, 0.15);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    for (let y = 0; y < size; y += 21) ctx.fillRect(0, y, size, 2);
    ctx.strokeStyle = '#5a3c1c'; ctx.lineWidth = 10; ctx.strokeRect(5, 5, size - 10, size - 10);
    ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(8, 8); ctx.lineTo(size - 8, size - 8); ctx.stroke();
  } else if (def.kind === 'container') {
    const g = ctx.createLinearGradient(0, 0, size, 0);
    for (let i = 0; i <= 8; i++) { g.addColorStop(i / 8, i % 2 ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.06)'); }
    ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
    noise(ctx, size, 500, r, 0.12);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(0, 0, size, 4); ctx.fillRect(0, size - 4, size, 4);
  }
  const tex = toTexture(c);
  cache.set(name, { tex, tile: def.tile });
  return cache.get(name);
}

// ---------- Скины оружия ----------
// pattern: solid | stripes | camo | gradient | carbon | hex | tiger | galaxy | neon | dragon
export function skinCanvas(skin, size = 128) {
  const [c, ctx] = canvas(size);
  const r = rng(hash(skin.id));
  const [a, b, d] = skin.colors;
  ctx.fillStyle = a; ctx.fillRect(0, 0, size, size);
  switch (skin.pattern) {
    case 'solid':
      noise(ctx, size, 400, r, 0.08);
      break;
    case 'stripes':
      ctx.fillStyle = b;
      for (let i = -size; i < size * 2; i += 22) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + 10, 0); ctx.lineTo(i + 10 - size, size); ctx.lineTo(i - size, size); ctx.fill();
      }
      break;
    case 'camo':
      for (const col of [b, d || b]) {
        ctx.fillStyle = col;
        for (let i = 0; i < 14; i++) {
          ctx.beginPath();
          const x = r() * size, y = r() * size, rad = 8 + r() * 18;
          for (let k = 0; k < 7; k++) {
            const ang = k / 7 * Math.PI * 2, rr = rad * (0.6 + r() * 0.6);
            const px = x + Math.cos(ang) * rr, py = y + Math.sin(ang) * rr;
            k ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
          }
          ctx.fill();
        }
      }
      break;
    case 'gradient': {
      const g = ctx.createLinearGradient(0, 0, size, size);
      g.addColorStop(0, a); g.addColorStop(0.55, b); g.addColorStop(1, d || a);
      ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
      noise(ctx, size, 300, r, 0.06);
      break;
    }
    case 'carbon':
      for (let y = 0; y < size; y += 8) for (let x = 0; x < size; x += 8) {
        ctx.fillStyle = ((x + y) / 8) % 2 ? b : a; ctx.fillRect(x, y, 8, 4);
        ctx.fillStyle = ((x + y) / 8) % 2 ? a : b; ctx.fillRect(x, y + 4, 8, 4);
      }
      if (d) { ctx.fillStyle = d; ctx.fillRect(0, size * 0.45, size, size * 0.1); }
      break;
    case 'hex': {
      ctx.strokeStyle = b; ctx.lineWidth = 2;
      const s = 10;
      for (let y = 0; y < size + s * 2; y += s * 1.5) for (let x = 0; x < size + s * 2; x += s * Math.sqrt(3)) {
        const ox = ((y / (s * 1.5)) % 2) * s * Math.sqrt(3) / 2;
        ctx.beginPath();
        for (let k = 0; k < 6; k++) {
          const ang = Math.PI / 3 * k + Math.PI / 6;
          const px = x + ox + Math.cos(ang) * s, py = y + Math.sin(ang) * s;
          k ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        }
        ctx.closePath(); ctx.stroke();
        if (d && r() < 0.12) { ctx.fillStyle = d; ctx.fill(); }
      }
      break;
    }
    case 'tiger':
      ctx.fillStyle = b;
      for (let i = 0; i < 12; i++) {
        const y = r() * size;
        ctx.beginPath(); ctx.moveTo(0, y);
        ctx.quadraticCurveTo(size * 0.5, y + (r() - 0.5) * 40, size, y + (r() - 0.5) * 20);
        ctx.lineTo(size, y + 6); ctx.quadraticCurveTo(size * 0.5, y + 10, 0, y + 4); ctx.fill();
      }
      break;
    case 'galaxy': {
      const g = ctx.createRadialGradient(size * 0.3, size * 0.4, 4, size * 0.5, size * 0.5, size * 0.8);
      g.addColorStop(0, b); g.addColorStop(0.5, d || a); g.addColorStop(1, a);
      ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
      for (let i = 0; i < 90; i++) { ctx.fillStyle = `rgba(255,255,255,${r()})`; ctx.fillRect(r() * size, r() * size, 1 + r() * 1.5, 1 + r() * 1.5); }
      break;
    }
    case 'neon':
      ctx.strokeStyle = b; ctx.lineWidth = 3; ctx.shadowColor = b; ctx.shadowBlur = 8;
      for (let i = 0; i < 9; i++) {
        ctx.beginPath(); let x = r() * size, y = r() * size; ctx.moveTo(x, y);
        for (let k = 0; k < 4; k++) { if (r() > 0.5) x += (r() - 0.5) * 60; else y += (r() - 0.5) * 60; ctx.lineTo(x, y); }
        ctx.stroke();
      }
      if (d) { ctx.strokeStyle = d; ctx.shadowColor = d; ctx.strokeRect(10, 10, size - 20, size - 20); }
      ctx.shadowBlur = 0;
      break;
    case 'dragon': {
      const g = ctx.createLinearGradient(0, 0, 0, size);
      g.addColorStop(0, a); g.addColorStop(1, d || a);
      ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = b;
      for (let y = 0; y < size + 12; y += 12) for (let x = 0; x < size + 12; x += 14) {
        const ox = (y / 12) % 2 ? 7 : 0;
        ctx.beginPath(); ctx.arc(x + ox, y, 7, 0, Math.PI); ctx.lineWidth = 1.5; ctx.strokeStyle = b; ctx.stroke();
      }
      break;
    }
  }
  return c;
}

const skinTexCache = new Map();
export function skinTexture(skin) {
  if (skinTexCache.has(skin.id)) return skinTexCache.get(skin.id);
  const t = toTexture(skinCanvas(skin));
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
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

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
