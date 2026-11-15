// Именные скины: художественные рисунки на всё оружие, «живые» эффекты (шейдеры), коллекции с историей.
import * as THREE from 'three';

// ---------- Коллекции и их история ----------
export const COLLECTIONS = {
  base:     { name: 'Арсенал', lore: 'Стандартные заводские покраски. С них начинает каждый боец.' },
  elements: { name: 'Операция «Пепел»', lore: 'Промзона за рекой горела трое суток. Отряд, вышедший из огня, расписал оружие тем, что видел: пламя, угли и птицу, которая не сгорает.' },
  deep:     { name: 'Глубина', lore: 'Списанную подлодку «Касатка» нашли на мели с пустыми отсеками. В оружейной остались только стволы, покрытые узорами, которые светились в темноте.' },
  tokyo:    { name: 'Неоновая ночь', lore: 'Квартал Сибуя никогда не спит. Подпольные мастерские красят оружие в цвета вывесок — по одной на каждый район.' },
  kyoto:    { name: 'Путь самурая', lore: 'Коллекция старого оружейника из Киото. Он верил, что у клинка и ствола должна быть душа, и рисовал её тушью.' },
  north:    { name: 'Северный фронт', lore: 'Зимовка на полярной станции «Кольцо». Полгода ночи, минус сорок и сияние, которое меняет цвет каждую минуту.' },
  cyber:    { name: 'Призрак', lore: 'Экспериментальные покрытия лаборатории «Призрак»: металл, который меняет цвет от угла взгляда, и проекции поверх ствола.' },
  street:   { name: 'Улицы', lore: 'Граффити-команды рисуют на стволах так же, как на стенах: быстро, ярко и без разрешения.' },
  europe:   { name: 'Старый Свет', lore: 'Мрамор, золото и королевская лазурь. Оружие для тех, кто привык к дворцам.' },
  miami:    { name: 'Вайс-Сити', lore: 'Ночной пляж, ретро-синтезатор и розовые закаты. Восьмидесятые никогда не заканчивались.' },
};

// ---------- Именные скины (рисунок на всё оружие + эффект) ----------
export const SIGNATURES = [
  { weapon: 'ak',   key: 'phoenix',   name: 'Феникс',            rarity: 'mythic',    theme: 'elements', art: 'phoenix',   fx: 'lava',
    story: 'Нарисован выжившим из горящего цеха. Говорят, огонь на нём не гаснет — и правда, присмотритесь.' },
  { weapon: 'p9',   key: 'ember',     name: 'Тлеющий уголь',     rarity: 'legendary', theme: 'elements', art: 'embers',    fx: 'lava',
    story: 'Пистолет нашли в пепле на третий день пожара. Трещины на корпусе до сих пор светятся.' },
  { weapon: 'awr',  key: 'kraken',    name: 'Кракен',            rarity: 'mythic',    theme: 'deep',     art: 'kraken',    fx: 'caustic',
    story: 'Единственная винтовка из оружейной «Касатки», которую не смогли отмыть. Щупальца проступают сквозь любую краску.' },
  { weapon: 'ar4',  key: 'abyss',     name: 'Бездна',            rarity: 'legendary', theme: 'deep',     art: 'abyss',     fx: 'pulse',
    story: 'Медузы со дна Марианской впадины светятся в такт сердцу стрелка.' },
  { weapon: 'ar4',  key: 'neocity',   name: 'Неоновый город',    rarity: 'mythic',    theme: 'tokyo',    art: 'skyline',   fx: 'pulse',
    story: 'Весь ночной Токио на одном стволе. Вывески мигают, пока вы целитесь.' },
  { weapon: 'p18',  key: 'ronin',     name: 'Ронин',             rarity: 'legendary', theme: 'kyoto',    art: 'samurai',   fx: null,
    story: 'Последняя работа мастера из Киото: восходящее солнце, сакура и иероглиф «самурай», выведенный одним движением кисти.' },
  { weapon: 'sv98', key: 'aurora',    name: 'Северное сияние',   rarity: 'mythic',    theme: 'north',    art: 'aurora',    fx: 'aurora',
    story: 'Снайпер станции «Кольцо» полгода смотрел на небо через прицел. Небо осталось на винтовке и до сих пор переливается.' },
  { weapon: 'ak',   key: 'frostbite', name: 'Обморожение',       rarity: 'legendary', theme: 'north',    art: 'frost',     fx: 'stars',
    story: 'Автомат пролежал ночь в снегу при минус пятидесяти. Иней так и не сошёл.' },
  { weapon: 'p9',   key: 'hologram',  name: 'Голограмма',        rarity: 'mythic',    theme: 'cyber',    art: 'hologram',  fx: 'hologram',
    story: 'Прототип лаборатории «Призрак»: проекция поверх ствола, которая показывает схему оружия в реальном времени.' },
  { weapon: 'br17', key: 'chameleon', name: 'Хамелеон',          rarity: 'mythic',    theme: 'cyber',    art: 'pearl',     fx: 'chameleon',
    story: 'Плёнка толщиной в несколько нанометров. Цвет зависит от того, под каким углом вы смотрите.' },
  { weapon: 'awr',  key: 'samurai',   name: 'Катана',            rarity: 'legendary', theme: 'kyoto',    art: 'samurai',   fx: null,
    story: 'Мастер считал снайперскую винтовку продолжением меча: один выстрел — одно движение.' },
  { weapon: 'uz9',  key: 'synthwave', name: 'Синтвейв',          rarity: 'legendary', theme: 'miami',    art: 'skyline',   fx: 'pulse',
    story: 'Сетка до горизонта, розовое солнце и кассета в магнитоле. Стреляет в ритме 120 ударов в минуту.' },
];

// ---------- Рисунки ----------
const R = (seed) => { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
function glow(ctx, color, blur) { ctx.shadowColor = color; ctx.shadowBlur = blur; }
function lin(ctx, x0, y0, x1, y1, stops) { const g = ctx.createLinearGradient(x0, y0, x1, y1); stops.forEach(([t, c]) => g.addColorStop(t, c)); return g; }

const ART = {
  phoenix(ctx, W, H, r) {
    ctx.fillStyle = lin(ctx, 0, 0, W, H, [[0, '#1a0302'], [0.5, '#5a0a04'], [1, '#120201']]); ctx.fillRect(0, 0, W, H);
    // языки пламени снизу
    for (let i = 0; i < 40; i++) { const x = r() * W, h = 80 + r() * 200; ctx.fillStyle = lin(ctx, 0, H, 0, H - h, [[0, 'rgba(255,200,40,.9)'], [0.5, 'rgba(255,80,10,.6)'], [1, 'rgba(120,0,0,0)']]); ctx.beginPath(); ctx.moveTo(x - 30, H); ctx.quadraticCurveTo(x - 20, H - h * 0.6, x + (r() - 0.5) * 30, H - h); ctx.quadraticCurveTo(x + 25, H - h * 0.5, x + 30, H); ctx.fill(); }
    // крылья: веер перьев
    const cx = W * 0.55, cy = H * 0.5;
    for (const side of [-1, 1]) for (let i = 0; i < 16; i++) {
      const a = -Math.PI / 2 + side * (0.25 + i * 0.09), L = 150 + i * 14;
      glow(ctx, '#ff7a00', 18);
      ctx.fillStyle = lin(ctx, cx, cy, cx + Math.cos(a) * L, cy + Math.sin(a) * L, [[0, '#fff2a0'], [0.4, '#ffb000'], [1, '#d82000']]);
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.quadraticCurveTo(cx + Math.cos(a - side * 0.15) * L * 0.6, cy + Math.sin(a - side * 0.15) * L * 0.6, cx + Math.cos(a) * L, cy + Math.sin(a) * L);
      ctx.quadraticCurveTo(cx + Math.cos(a + side * 0.1) * L * 0.5, cy + Math.sin(a + side * 0.1) * L * 0.5, cx, cy + 8); ctx.fill();
    }
    // хвост влево
    for (let i = 0; i < 9; i++) { glow(ctx, '#ff5000', 14); ctx.strokeStyle = lin(ctx, cx, cy, 60, cy, [[0, '#ffd040'], [1, 'rgba(200,20,0,0)']]); ctx.lineWidth = 10 - i * 0.6; ctx.beginPath(); ctx.moveTo(cx - 20, cy + 20); ctx.bezierCurveTo(cx - 200, cy + 60 + i * 12, cx - 300, cy - 80 + i * 18, 40 + i * 20, cy - 40 + i * 22); ctx.stroke(); }
    // тело и голова
    glow(ctx, '#ffe080', 30); ctx.fillStyle = '#fff4c0'; ctx.beginPath(); ctx.ellipse(cx, cy + 10, 26, 60, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 6, cy - 62, 20, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx + 22, cy - 66); ctx.lineTo(cx + 52, cy - 58); ctx.lineTo(cx + 22, cy - 54); ctx.fill();
    ctx.shadowBlur = 0;
    for (let i = 0; i < 300; i++) { ctx.fillStyle = `rgba(255,${150 + r() * 100},40,${r()})`; ctx.fillRect(r() * W, r() * H, 2 + r() * 3, 2 + r() * 3); }
  },
  embers(ctx, W, H, r) {
    ctx.fillStyle = '#141110'; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 2600; i++) { const g = 20 + r() * 25; ctx.fillStyle = `rgb(${g},${g * 0.9},${g * 0.85})`; ctx.fillRect(r() * W, r() * H, 3, 3); }
    glow(ctx, '#ff5a00', 14); ctx.lineCap = 'round';
    for (let i = 0; i < 60; i++) { let x = r() * W, y = r() * H; ctx.strokeStyle = r() < 0.5 ? '#ffb030' : '#ff4a00'; ctx.lineWidth = 1.5 + r() * 3; ctx.beginPath(); ctx.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (r() - 0.5) * 90; y += (r() - 0.5) * 60; ctx.lineTo(x, y); } ctx.stroke(); }
    ctx.shadowBlur = 0;
  },
  kraken(ctx, W, H, r) {
    ctx.fillStyle = lin(ctx, 0, 0, 0, H, [[0, '#04232c'], [1, '#010a10']]); ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 9; i++) {
      const x0 = W * 0.35 + (r() - 0.5) * 80, y0 = H * 0.55, x1 = r() * W, y1 = r() * H;
      const pts = []; for (let t = 0; t <= 1.001; t += 0.02) { const x = x0 + (x1 - x0) * t + Math.sin(t * 7 + i) * 60 * t, y = y0 + (y1 - y0) * t + Math.cos(t * 6 + i * 2) * 50 * t; pts.push([x, y, 34 * (1 - t) + 3]); }
      glow(ctx, '#00ffd0', 10);
      for (const [x, y, w] of pts) { ctx.fillStyle = '#6a1f3a'; ctx.beginPath(); ctx.arc(x, y, w, 0, Math.PI * 2); ctx.fill(); }
      ctx.shadowBlur = 0;
      for (let k = 2; k < pts.length; k += 3) { const [x, y, w] = pts[k]; ctx.fillStyle = '#f0b4c8'; ctx.beginPath(); ctx.arc(x + w * 0.4, y + w * 0.3, w * 0.28, 0, Math.PI * 2); ctx.fill(); }
    }
    glow(ctx, '#ffe040', 30); ctx.fillStyle = '#ffd400'; ctx.beginPath(); ctx.ellipse(W * 0.35, H * 0.5, 34, 22, 0, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0; ctx.fillStyle = '#000'; ctx.fillRect(W * 0.35 - 4, H * 0.5 - 18, 8, 36);
    for (let i = 0; i < 80; i++) { ctx.strokeStyle = 'rgba(160,255,240,.5)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(r() * W, r() * H, 2 + r() * 8, 0, Math.PI * 2); ctx.stroke(); }
  },
  abyss(ctx, W, H, r) {
    ctx.fillStyle = lin(ctx, 0, 0, 0, H, [[0, '#02081a'], [1, '#000208']]); ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 14; i++) {
      const x = r() * W, y = r() * H * 0.8, s = 20 + r() * 40, col = ['#3ef0ff', '#b35cff', '#ff3ea5'][i % 3];
      glow(ctx, col, 26); ctx.fillStyle = col; ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.arc(x, y, s, Math.PI, 0); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = col; ctx.lineWidth = 2; for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.moveTo(x - s + k * s * 0.4, y); ctx.bezierCurveTo(x - s + k * s * 0.4 + 10, y + 40, x - s + k * s * 0.4 - 10, y + 80, x - s + k * s * 0.4, y + 120); ctx.stroke(); }
    }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  },
  skyline(ctx, W, H, r) {
    ctx.fillStyle = lin(ctx, 0, 0, 0, H, [[0, '#14062a'], [0.55, '#5a1660'], [0.7, '#ff4f8a'], [1, '#14062a']]); ctx.fillRect(0, 0, W, H);
    glow(ctx, '#ff8a3a', 40); ctx.fillStyle = lin(ctx, 0, H * 0.25, 0, H * 0.65, [[0, '#ffe14a'], [1, '#ff2d7a']]); ctx.beginPath(); ctx.arc(W * 0.5, H * 0.62, 150, Math.PI, 0); ctx.fill(); ctx.shadowBlur = 0;
    for (let y = H * 0.4; y < H * 0.62; y += 14) { ctx.fillStyle = '#5a1660'; ctx.fillRect(W * 0.5 - 160, y, 320, 4 + (y - H * 0.4) / 20); }
    let x = 0; while (x < W) { const w = 30 + r() * 60, h = 60 + r() * 200; ctx.fillStyle = '#0a0414'; ctx.fillRect(x, H * 0.66 - h, w, h + 4);
      for (let wy = H * 0.66 - h + 8; wy < H * 0.66 - 6; wy += 12) for (let wx = x + 5; wx < x + w - 6; wx += 10) if (r() < 0.35) { ctx.fillStyle = r() < 0.5 ? '#ffd96a' : '#7ae6ff'; ctx.fillRect(wx, wy, 5, 6); }
      if (r() < 0.35) { const c = ['#ff3ea5', '#3ef0ff', '#ffe14a'][Math.floor(r() * 3)]; glow(ctx, c, 16); ctx.strokeStyle = c; ctx.lineWidth = 3; ctx.strokeRect(x + 4, H * 0.66 - h + 10, w - 8, 18); ctx.shadowBlur = 0; }
      x += w + 2; }
    ctx.strokeStyle = '#ff3ea5'; glow(ctx, '#ff3ea5', 10); ctx.lineWidth = 2;
    for (let i = 0; i < 12; i++) { const y = H * 0.66 + Math.pow(i / 12, 2) * H * 0.34; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    for (let i = -16; i <= 16; i++) { ctx.beginPath(); ctx.moveTo(W / 2 + i * 12, H * 0.66); ctx.lineTo(W / 2 + i * 110, H); ctx.stroke(); }
    ctx.shadowBlur = 0;
  },
  samurai(ctx, W, H, r) {
    ctx.fillStyle = '#efe6d2'; ctx.fillRect(0, 0, W, H);
    const cx = W * 0.62, cy = H * 0.5;
    for (let i = 0; i < 24; i++) { if (i % 2) continue; const a0 = i / 24 * Math.PI * 2, a1 = (i + 1) / 24 * Math.PI * 2; ctx.fillStyle = 'rgba(200,30,30,.85)'; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a0) * 900, cy + Math.sin(a0) * 900); ctx.lineTo(cx + Math.cos(a1) * 900, cy + Math.sin(a1) * 900); ctx.fill(); }
    ctx.fillStyle = '#c8101e'; ctx.beginPath(); ctx.arc(cx, cy, 120, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#111'; ctx.lineCap = 'round';
    for (let k = 0; k < 40; k++) { const a = -0.4 + k / 40 * Math.PI * 1.85; ctx.lineWidth = 26 - k * 0.4; ctx.beginPath(); ctx.arc(cx, cy, 170, a, a + 0.08); ctx.stroke(); }
    ctx.fillStyle = '#111'; ctx.font = 'bold 230px "Noto Serif JP", "Yu Mincho", serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('侍', W * 0.24, H * 0.52);
    for (let i = 0; i < 60; i++) { const x = r() * W, y = r() * H, s = 6 + r() * 10; ctx.fillStyle = r() < 0.5 ? '#f6a8c4' : '#ffd0de'; ctx.save(); ctx.translate(x, y); ctx.rotate(r() * 6); for (let p = 0; p < 5; p++) { ctx.rotate(Math.PI * 2 / 5); ctx.beginPath(); ctx.ellipse(0, s * 0.7, s * 0.45, s * 0.8, 0, 0, Math.PI * 2); ctx.fill(); } ctx.restore(); }
  },
  aurora(ctx, W, H, r) {
    ctx.fillStyle = lin(ctx, 0, 0, 0, H, [[0, '#020614'], [1, '#0a1a2a']]); ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 300; i++) { ctx.fillStyle = `rgba(255,255,255,${r()})`; ctx.fillRect(r() * W, r() * H * 0.7, 2, 2); }
    for (let band = 0; band < 3; band++) for (let x = 0; x < W; x += 3) {
      const y0 = H * (0.15 + band * 0.12) + Math.sin(x * 0.008 + band) * 50, h = 120 + Math.sin(x * 0.02 + band * 3) * 60;
      ctx.fillStyle = lin(ctx, 0, y0, 0, y0 + h, [[0, 'rgba(120,60,255,0)'], [0.4, band === 1 ? 'rgba(80,255,170,.55)' : 'rgba(60,220,255,.45)'], [1, 'rgba(40,255,120,0)']]);
      ctx.fillRect(x, y0, 3, h);
    }
    ctx.fillStyle = '#e8f2ff'; ctx.beginPath(); ctx.moveTo(0, H); for (let x = 0; x <= W; x += 40) ctx.lineTo(x, H * 0.78 - Math.abs(Math.sin(x * 0.006)) * 90 - r() * 20); ctx.lineTo(W, H); ctx.fill();
  },
  frost(ctx, W, H, r) {
    ctx.fillStyle = lin(ctx, 0, 0, W, H, [[0, '#cfe8f8'], [1, '#6aa8d8']]); ctx.fillRect(0, 0, W, H);
    const branch = (x, y, a, L, d) => { if (d > 5 || L < 4) return; const x2 = x + Math.cos(a) * L, y2 = y + Math.sin(a) * L; ctx.lineWidth = Math.max(0.6, 3 - d * 0.5); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke(); branch(x2, y2, a - 0.6, L * 0.6, d + 1); branch(x2, y2, a + 0.6, L * 0.6, d + 1); branch(x2, y2, a, L * 0.7, d + 1); };
    ctx.strokeStyle = 'rgba(255,255,255,.85)'; glow(ctx, '#ffffff', 6);
    for (let i = 0; i < 14; i++) branch(r() * W, r() * H, r() * Math.PI * 2, 40 + r() * 40, 0);
    ctx.shadowBlur = 0;
  },
  hologram(ctx, W, H, r) {
    ctx.fillStyle = '#020c14'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(40,220,255,.35)'; ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 32) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    glow(ctx, '#3ef0ff', 12); ctx.strokeStyle = '#7af6ff'; ctx.lineWidth = 2.5;
    ctx.strokeRect(W * 0.1, H * 0.3, W * 0.8, H * 0.25); ctx.beginPath(); ctx.moveTo(W * 0.62, H * 0.55); ctx.lineTo(W * 0.66, H * 0.85); ctx.lineTo(W * 0.74, H * 0.85); ctx.lineTo(W * 0.7, H * 0.55); ctx.stroke();
    ctx.beginPath(); ctx.arc(W * 0.3, H * 0.42, 40, 0, Math.PI * 2); ctx.stroke();
    ctx.font = '22px monospace'; ctx.fillStyle = '#7af6ff';
    for (let i = 0; i < 18; i++) ctx.fillText(['ID-7', '0x3F', 'SYNC', '▲▲', '98%', 'PRTX'][i % 6], r() * W, r() * H);
    ctx.shadowBlur = 0;
  },
  pearl(ctx, W, H, r) {
    ctx.fillStyle = '#d8d8e0'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(80,80,100,.35)'; ctx.lineWidth = 2;
    const s = 26;
    for (let y = 0; y < H + s; y += s * 1.5) for (let x = 0; x < W + s * 2; x += s * Math.sqrt(3)) { const ox = (Math.round(y / (s * 1.5)) % 2) * s * Math.sqrt(3) / 2; ctx.beginPath(); for (let k = 0; k < 6; k++) { const a = Math.PI / 3 * k + Math.PI / 6; k ? ctx.lineTo(x + ox + Math.cos(a) * s, y + Math.sin(a) * s) : ctx.moveTo(x + ox + Math.cos(a) * s, y + Math.sin(a) * s); } ctx.closePath(); ctx.stroke(); }
    void r;
  },
};

export function artCanvas(art, seed, size = 1024) {
  const c = document.createElement('canvas'); c.width = size; c.height = size / 2;
  const ctx = c.getContext('2d');
  ctx.save(); ctx.scale(size / 1024, size / 1024);
  (ART[art] || ART.pearl)(ctx, 1024, 512, R(seed || 7));
  ctx.restore();
  return c;
}

// ---------- «Живые» эффекты ----------
export const fxTime = { value: 0 };
const LUM = 'float lum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));';
const FX = {
  lava: `${LUM} float f = sin(vMapUv.x * 14.0 - uTime * 1.6 + sin(vMapUv.y * 9.0 + uTime * 0.7) * 2.0) * 0.5 + 0.5;
    totalEmissiveRadiance += vec3(1.0, 0.38, 0.06) * (0.35 + pow(f, 3.0)) * smoothstep(0.35, 0.8, lum) * 2.2;`,
  pulse: `${LUM} totalEmissiveRadiance += diffuseColor.rgb * smoothstep(0.42, 0.9, lum) * (1.0 + 0.8 * sin(uTime * 2.6 + vMapUv.x * 3.0));`,
  aurora: `float band = smoothstep(0.25, 0.8, diffuseColor.g - diffuseColor.r * 0.5);
    vec3 c = 0.5 + 0.5 * cos(6.2831 * (vec3(0.3, 0.5, 0.7) + vMapUv.x * 0.7 + uTime * 0.07));
    totalEmissiveRadiance += c * band * 1.6 * (0.7 + 0.3 * sin(uTime * 1.3 + vMapUv.x * 9.0));`,
  hologram: `${LUM} float sl = smoothstep(0.42, 0.5, fract(vMapUv.y * 40.0 - uTime * 1.5)) * (1.0 - smoothstep(0.5, 0.58, fract(vMapUv.y * 40.0 - uTime * 1.5)));
    totalEmissiveRadiance += vec3(0.25, 0.9, 1.0) * (smoothstep(0.25, 0.7, lum) * 1.6 + sl * 0.5) * (0.85 + 0.15 * sin(uTime * 37.0));`,
  chameleon: `float fr = 1.0 - abs(dot(normalize(normal), normalize(vViewPosition)));
    vec3 ir = 0.5 + 0.5 * cos(6.2831 * (fr * 1.6 + vec3(0.0, 0.33, 0.67) + uTime * 0.04));
    diffuseColor.rgb = mix(diffuseColor.rgb * 0.4, ir, 0.85);`,
  stars: `vec2 g = floor(vMapUv * vec2(220.0, 110.0)); float h = fract(sin(dot(g, vec2(12.9898, 78.233))) * 43758.5453);
    totalEmissiveRadiance += vec3(0.85, 0.95, 1.0) * step(0.988, h) * (0.5 + 0.5 * sin(uTime * 3.0 + h * 40.0)) * 2.5;`,
  caustic: `float c1 = sin(vMapUv.x * 30.0 + uTime * 1.2) + sin(vMapUv.y * 26.0 - uTime * 0.9) + sin((vMapUv.x + vMapUv.y) * 22.0 + uTime);
    totalEmissiveRadiance += vec3(0.1, 0.85, 0.75) * pow(max(0.0, c1 / 3.0), 3.0) * 1.4;`,
};
export function applyFx(mat, fx) {
  if (!fx || !FX[fx]) return mat;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = fxTime;
    sh.fragmentShader = 'uniform float uTime;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + FX[fx]);
  };
  mat.customProgramCacheKey = () => 'fx_' + fx;
  return mat;
}
