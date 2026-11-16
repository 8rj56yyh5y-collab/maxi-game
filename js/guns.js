// Процедурные модели оружия: профили с фасками, планки, вентиляция, магазины, прицелы.
// Строим в «реальных» метрах (ствол вперёд = −Z), затем масштабируем до размеров игры.
// Роли материалов: body (корпус/полимер — на него ложится скин), metal (воронёная сталь),
// steel (светлая сталь), wood, rubber, lens, brass.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const UVK = 3.2;
function prep(g) {
  let x = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(x.attributes)) if (!['position', 'normal', 'uv'].includes(k)) x.deleteAttribute(k);
  if (!x.attributes.uv) x.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(x.attributes.position.count * 2), 2));
  if (!x.attributes.normal) x.computeVertexNormals();
  return x;
}

class GB {
  constructor() { this.parts = {}; this.groups = {}; }
  push(role, g, target = null) {
    const key = target ? target + ':' + role : role;
    (this.parts[key] = this.parts[key] || []).push(prep(g));
  }
  // профиль сбоку: точки [вперёд, вверх] (+ ['q', cf, cy, f, y] — кривая), толщина по X
  prof(role, pts, thick, { x = 0, bevel = 0.0015, seg = 10, target, holes } = {}) {
    const trace = (s, pts) => pts.forEach((p, i) => { if (p[0] === 'q') s.quadraticCurveTo(p[1], p[2], p[3], p[4]); else if (i === 0) s.moveTo(p[0], p[1]); else s.lineTo(p[0], p[1]); });
    const s = new THREE.Shape(); trace(s, pts);
    if (holes) for (const h of holes) { const hp = new THREE.Path(); trace(hp, h); s.holes.push(hp); }
    const b = Math.min(bevel, thick * 0.45);
    const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.0005, thick - b * 2), bevelEnabled: b > 0, bevelThickness: b, bevelSize: b, bevelSegments: 2, curveSegments: seg });
    g.translate(0, 0, -(thick - b * 2) / 2); g.rotateY(Math.PI / 2); g.translate(x, 0, 0);
    this.push(role, g, target);
  }
  // скруглённый брусок: центр (вперёд f, высота y, бок x)
  box(role, w, h, len, f, y, { x = 0, r = 0.0015, target, rx = 0 } = {}) {
    const g = new RoundedBoxGeometry(w, h, len, 2, Math.min(r, w / 2.2, h / 2.2, len / 2.2));
    if (rx) g.rotateX(rx);
    g.translate(x, y, -f); this.push(role, g, target);
  }
  // цилиндр вдоль ствола от f0 вперёд на длину len
  cyl(role, r1, r2, len, f0, y, { x = 0, seg = 22, target, open = false } = {}) {
    const g = new THREE.CylinderGeometry(r2, r1, len, seg, 1, open); g.rotateX(-Math.PI / 2); g.translate(x, y, -(f0 + len / 2));
    this.push(role, g, target);
  }
  // тело вращения вдоль ствола: профиль [[радиус, вперёд], ...]
  lathe(role, pts, y, { x = 0, seg = 24, target } = {}) {
    const g = new THREE.LatheGeometry(pts.map(([r, f]) => new THREE.Vector2(r, f)), seg); g.rotateX(-Math.PI / 2); g.translate(x, y, 0);
    this.push(role, g, target);
  }
  // поперечный цилиндр (оси X)
  pin(role, r, w, f, y, { x = 0, target } = {}) { const g = new THREE.CylinderGeometry(r, r, w, 14); g.rotateZ(Math.PI / 2); g.translate(x, y, -f); this.push(role, g, target); }
  // планка Пикатинни
  rail(f0, len, y, w = 0.021, target) {
    this.box('metal', w, 0.006, len, f0 + len / 2, y + 0.003, { target, r: 0.001 });
    for (let f = f0 + 0.004; f < f0 + len - 0.003; f += 0.01) this.box('metal', w + 0.002, 0.004, 0.005, f, y + 0.008, { target, r: 0.0008 });
  }
}

// ---------- Общие детали ----------
function pistolGrip(G, f, y, { len = 0.11, ang = 0.32, w = 0.03, role = 'body', ribs = true } = {}) {
  const t = Math.tan(ang), dy = -len;
  const pts = [[f + 0.012, y], [f + 0.012 + dy * t * 0.2 + 0.004, y + dy * 0.35], ['q', f + 0.018 + dy * t, y + dy * 0.7, f + 0.012 + dy * t, y + dy], [f - 0.03 + dy * t, y + dy - 0.002], ['q', f - 0.05 + dy * t * 0.5, y + dy * 0.45, f - 0.036, y]];
  G.prof(role, pts, w, { bevel: 0.006 });
  if (ribs) for (let k = 1; k < 4; k++) { const yy = y + dy * (0.25 + k * 0.17), ff = f + 0.016 + dy * t * (0.25 + k * 0.17); G.box('rubber', w * 0.85, 0.006, 0.006, ff, yy, { r: 0.002 }); }
}
function triggerGroup(G, f, y) {
  // спусковая скоба и крючок
  G.prof('metal', [[f + 0.035, y], [f + 0.035, y - 0.03], ['q', f + 0.035, y - 0.038, f + 0.025, y - 0.038], [f - 0.02, y - 0.038], [f - 0.02, y - 0.032], [f + 0.024, y - 0.032], ['q', f + 0.029, y - 0.032, f + 0.029, y - 0.026], [f + 0.029, y]], 0.008, { bevel: 0.001 });
  G.prof('steel', [[f + 0.006, y], ['q', f + 0.012, y - 0.016, f + 0.001, y - 0.026], [f - 0.003, y - 0.025], ['q', f + 0.005, y - 0.014, f, y]], 0.005, { bevel: 0.0008 });
}
function stockAR(G, f0, y) { // буферная трубка + телескопический приклад
  G.cyl('metal', 0.016, 0.016, 0.2, f0 - 0.2, y);
  const s = f0 - 0.1;
  G.prof('body', [[s, y + 0.022], [s - 0.115, y + 0.027], [s - 0.125, y + 0.02], [s - 0.125, y - 0.072], [s - 0.105, y - 0.078], ['q', s - 0.05, y - 0.045, s - 0.012, y - 0.02], [s, y - 0.016]], 0.038, { bevel: 0.005 });
  G.box('rubber', 0.04, 0.1, 0.012, s - 0.127, y - 0.024, { r: 0.004 });
  G.box('rubber', 0.039, 0.012, 0.03, s - 0.06, y - 0.03, { r: 0.002 });
  G.box('metal', 0.01, 0.02, 0.012, s - 0.02, y - 0.022, { r: 0.002 });
}
function stockAKSolid(G, f0, y, role = 'wood') {
  G.prof(role, [[f0, y + 0.026], [f0 - 0.24, y + 0.012], [f0 - 0.255, y + 0.008], [f0 - 0.26, y - 0.105], [f0 - 0.24, y - 0.112], ['q', f0 - 0.14, y - 0.05, f0 - 0.02, y - 0.026], [f0, y - 0.024]], 0.036, { bevel: 0.007, seg: 14 });
  G.box('metal', 0.04, 0.12, 0.008, f0 - 0.255, y - 0.05, { r: 0.003 });
}
function stockSkeleton(G, f0, y) { // складной рамочный
  G.prof('metal', [[f0, y + 0.02], [f0 - 0.24, y + 0.012], [f0 - 0.24, y - 0.09], [f0 - 0.22, y - 0.09], [f0 - 0.22, y - 0.002], [f0 - 0.01, y + 0.004], [f0 - 0.01, y - 0.03], [f0, y - 0.03]], 0.014, { bevel: 0.002 });
  G.box('rubber', 0.03, 0.11, 0.01, f0 - 0.24, y - 0.035, { r: 0.003 });
}
function magStraight(G, f, y, { len = 0.12, w = 0.024, d = 0.06, ang = 0.12, role = 'metal' } = {}) {
  const t = Math.tan(ang);
  G.prof(role, [[f + d / 2, y], [f + d / 2 + len * t, y - len], [f - d / 2 + len * t, y - len], [f - d / 2, y]], w, { bevel: 0.002, target: 'mag' });
  G.box(role, w + 0.004, 0.008, d + 0.01, f + len * t, y - len - 0.002, { target: 'mag', r: 0.002 });
  for (let k = 1; k < 4; k++) G.box(role, w + 0.002, 0.004, d * 0.6, f + len * t * k / 4, y - len * k / 4, { target: 'mag', r: 0.0015 });
}
function magCurved(G, f, y, { len = 0.17, w = 0.026, d = 0.065, curve = 0.06, role = 'body', ribs = true } = {}) {
  G.prof(role, [[f + d / 2, y], ['q', f + d / 2 + curve * 0.6, y - len * 0.55, f + d / 2 + curve * 1.4, y - len], [f - d / 2 + curve * 1.5, y - len - 0.004], ['q', f - d / 2 + curve * 0.6, y - len * 0.5, f - d / 2, y]], w, { bevel: 0.003, target: 'mag', seg: 14 });
  if (ribs) for (let k = 1; k < 5; k++) { const tt = k / 5, ff = f + curve * 1.3 * tt * tt + d * 0.08, yy = y - len * tt; G.box(role, w + 0.003, 0.006, d * 0.9, ff, yy, { target: 'mag', r: 0.002 }); }
}
function muzzleBrake(G, f0, y, r, style) {
  if (style === 'flash') { G.lathe('metal', [[0, f0], [r * 1.25, f0], [r * 1.25, f0 + 0.05], [r * 1.05, f0 + 0.055], [0, f0 + 0.055]], y); for (let k = 0; k < 4; k++) G.box('rubber', 0.002, r * 1.2, 0.025, f0 + 0.035, y, { x: Math.cos(k * Math.PI / 2) * r * 1.2, r: 0.0005 }); }
  else if (style === 'slant') { G.lathe('metal', [[0, f0], [r * 1.5, f0], [r * 1.5, f0 + 0.05], [r * 1.25, f0 + 0.06], [0, f0 + 0.06]], y); G.box('rubber', r * 2.2, 0.004, 0.012, f0 + 0.03, y + r * 1.1, { r: 0.001 }); }
  else if (style === 'brake') { G.lathe('metal', [[0, f0], [r * 1.9, f0], [r * 2, f0 + 0.075], [r * 1.6, f0 + 0.085], [0, f0 + 0.085]], y); for (let k = 0; k < 3; k++) G.box('rubber', r * 4.1, r * 1.9, 0.008, f0 + 0.015 + k * 0.022, y, { r: 0.001 }); }
  else G.lathe('metal', [[0, f0], [r * 1.3, f0], [r * 1.3, f0 + 0.02], [0, f0 + 0.02]], y);
}
function handguardMLOK(G, f0, len, y, r = 0.024) {
  // восьмигранное цевьё со слотами
  const g = new THREE.CylinderGeometry(r, r, len, 8, 1, false); g.rotateX(-Math.PI / 2); g.rotateZ(Math.PI / 8); g.translate(0, y, -(f0 + len / 2)); G.push('body', g);
  for (let k = 0; k < Math.floor(len / 0.04); k++) for (const sx of [-1, 1]) G.box('rubber', 0.002, 0.008, 0.026, f0 + 0.02 + k * 0.04, y, { x: sx * (r - 0.0005), r: 0.0008 });
  G.rail(f0, len, y + r * 0.92, 0.021);
}
function frontSightPost(G, f, y, h = 0.045) {
  G.prof('metal', [[f + 0.012, y], [f + 0.006, y + h], [f - 0.006, y + h], [f - 0.012, y]], 0.018, { bevel: 0.002 });
  G.box('metal', 0.003, 0.012, 0.003, f, y + h + 0.006);
}
function rearSight(G, f, y) { G.box('metal', 0.022, 0.016, 0.02, f, y + 0.008, { r: 0.003 }); G.box('metal', 0.012, 0.012, 0.006, f, y + 0.02, { r: 0.002 }); }

export function buildScopeParts(G, f, y, big) { // оптика: тело вращения
  const L = big ? 0.32 : 0.22, R = big ? 0.0155 : 0.0135;
  const yy = y + R + 0.022;
  G.lathe('body', [[0, f - L / 2 - 0.03], [R * 1.75, f - L / 2 - 0.03], [R * 1.7, f - L / 2 + 0.01], [R, f - L / 2 + 0.04], [R, f + L / 2 - 0.03], [R * 2.25, f + L / 2 + 0.03], [R * 2.2, f + L / 2 + 0.06], [0, f + L / 2 + 0.06]], yy, { seg: 28 });
  G.cyl('metal', 0.011, 0.011, 0.03, f - 0.015, yy + R + 0.012, { seg: 16 }); G.box('metal', 0.022, 0.018, 0.018, f, yy + R + 0.004, { r: 0.004 });
  G.cyl('metal', 0.011, 0.011, 0.02, f - 0.01, yy, { x: R + 0.012 });
  for (const ff of [f - L * 0.28, f + L * 0.28]) { G.box('metal', 0.026, 0.024, 0.016, ff, yy - R - 0.008, { r: 0.003 }); }
  G.push('lens', (() => { const g = new THREE.CircleGeometry(R * 2.1, 24); g.rotateY(Math.PI); g.translate(0, yy, -(f + L / 2 + 0.061)); return g; })());
  G.push('lens', (() => { const g = new THREE.CircleGeometry(R * 1.6, 24); g.translate(0, yy, -(f - L / 2 - 0.031)); return g; })());
  return yy;
}

// ---------- Семейства ----------
function buildAR(G, o = {}) {
  const y = 0;
  // нижний ресивер с магазинной шахтой
  G.prof('body', [[-0.1, y], [0.12, y], [0.12, y - 0.028], [0.1, y - 0.03], [0.1, y - 0.055], [0.035, y - 0.058], [0.035, y - 0.03], [-0.07, y - 0.032], ['q', -0.1, y - 0.03, -0.1, y - 0.01]], 0.03, { bevel: 0.003 });
  // верхний ресивер + планка
  G.prof('body', [[-0.11, y], [0.13, y], [0.135, y + 0.032], [-0.09, y + 0.032], [-0.11, y + 0.02]], 0.028, { bevel: 0.003 });
  G.rail(-0.08, 0.2, y + 0.032);
  G.box('metal', 0.002, 0.016, 0.06, 0.03, y + 0.016, { x: 0.0145, r: 0.001 });              // крышка окна
  G.box('metal', 0.014, 0.012, 0.02, -0.07, y + 0.04, { r: 0.003 });                          // рукоять заряжания
  G.cyl('metal', 0.006, 0.006, 0.02, 0.0, y + 0.014, { x: 0.017 });                          // досылатель
  G.pin('steel', 0.004, 0.034, -0.02, y - 0.012); G.pin('steel', 0.004, 0.034, 0.06, y - 0.012);
  G.box('metal', 0.006, 0.01, 0.014, -0.02, y - 0.012, { x: -0.017, r: 0.002 });             // переводчик
  triggerGroup(G, 0.02, y - 0.03);
  pistolGrip(G, -0.035, y - 0.03, { len: 0.1, ang: 0.35 });
  const hgLen = o.hgLen || 0.25;
  handguardMLOK(G, 0.135, hgLen, y + 0.008, 0.024);
  const bEnd = 0.135 + hgLen + (o.barrelOut || 0.1);
  G.cyl('metal', 0.008, 0.007, bEnd - 0.135, 0.135, y + 0.008);
  G.cyl('metal', 0.011, 0.011, 0.012, 0.135 + hgLen + 0.03, y + 0.008);                      // газоблок
  muzzleBrake(G, bEnd, y + 0.008, 0.009, o.muzzle || 'flash');
  stockAR(G, -0.11, y + 0.015);
  if (o.mag !== false) magStraight(G, 0.068, y - 0.05, { len: o.magLen || 0.13, d: 0.062, ang: 0.15, role: 'metal' });
  if (!o.scope) { G.box('metal', 0.02, 0.026, 0.02, -0.06, y + 0.05, { r: 0.002 }); frontSightPost(G, 0.135 + hgLen - 0.02, y + 0.034, 0.03); }
  return { trigger: [0.02, y - 0.04], gripL: [0.135 + hgLen * 0.45, y - 0.018], muzzle: [bEnd + 0.06, y + 0.008], sight: o.scope ? null : y + 0.064, magTop: [0.068, y - 0.05], bolt: [-0.07, y + 0.04], scopeAt: [0.0, y + 0.038] };
}

function buildAK(G, o = {}) {
  const y = 0, wood = o.wood !== false ? 'wood' : 'body';
  G.prof('body', [[-0.12, y + 0.03], [0.17, y + 0.03], [0.17, y - 0.03], [0.12, y - 0.03], [0.12, y - 0.04], [0.05, y - 0.04], [0.05, y - 0.03], [-0.12, y - 0.03]], 0.032, { bevel: 0.002 });
  // крышка ствольной коробки с рёбрами
  G.prof('metal', [[-0.12, y + 0.03], [0.13, y + 0.03], ['q', 0.14, y + 0.046, 0.12, y + 0.05], [-0.1, y + 0.05], ['q', -0.125, y + 0.046, -0.12, y + 0.03]], 0.03, { bevel: 0.004 });
  for (let k = 0; k < 4; k++) G.box('metal', 0.031, 0.004, 0.004, -0.09 + k * 0.012, y + 0.05);
  G.box('metal', 0.004, 0.02, 0.12, 0.04, y + 0.012, { x: 0.017, r: 0.0015 });                 // переводчик-рычаг
  G.box('steel', 0.014, 0.012, 0.016, 0.1, y + 0.022, { x: 0.022, r: 0.004 });                 // рукоять затвора
  G.box('metal', 0.03, 0.024, 0.04, 0.19, y + 0.038, { r: 0.004 });                             // колодка прицела
  rearSight(G, 0.19, y + 0.05);
  // цевьё и газовая трубка
  G.prof(wood, [[0.19, y + 0.024], [0.4, y + 0.022], ['q', 0.41, y, 0.4, y - 0.022], [0.19, y - 0.026], ['q', 0.18, y, 0.19, y + 0.024]], 0.04, { bevel: 0.008 });
  for (let k = 0; k < 3; k++) G.box('rubber', 0.041, 0.006, 0.02, 0.23 + k * 0.05, y + 0.006, { r: 0.002 });
  G.prof(wood, [[0.2, y + 0.034], [0.4, y + 0.034], ['q', 0.41, y + 0.045, 0.4, y + 0.056], [0.2, y + 0.056]], 0.03, { bevel: 0.007 });
  G.cyl('metal', 0.01, 0.01, 0.06, 0.4, y + 0.045);
  G.box('metal', 0.02, 0.05, 0.02, 0.45, y + 0.025, { r: 0.003 });
  G.cyl('metal', 0.008, 0.0075, 0.2, 0.4, y + 0.005);
  frontSightPost(G, 0.55, y + 0.012, 0.05);
  muzzleBrake(G, 0.6, y + 0.005, 0.009, o.muzzle || 'slant');
  triggerGroup(G, 0.02, y - 0.03);
  pistolGrip(G, -0.035, y - 0.03, { len: 0.1, ang: 0.3, role: o.wood === false ? 'body' : 'body' });
  if (o.stock === 'skeleton') stockSkeleton(G, -0.12, y + 0.005); else stockAKSolid(G, -0.12, y + 0.0, wood);
  if (o.mag !== false) magCurved(G, 0.085, y - 0.04, { len: o.magLen || 0.17, curve: 0.085, d: 0.068, role: o.magRole || 'body' });
  for (const [ff, yy] of [[-0.1, -0.02], [-0.06, -0.02], [0.0, 0.02], [0.14, -0.02], [0.14, 0.018], [0.05, -0.034]]) G.pin('steel', 0.003, 0.034, ff, y + yy);
  G.box('rubber', 0.002, 0.016, 0.07, 0.06, y + 0.02, { x: 0.0165, r: 0.001 });
  return { trigger: [0.02, y - 0.04], gripL: [0.3, y - 0.03], muzzle: [0.66, y + 0.005], sight: y + 0.072, magTop: [0.085, y - 0.04], bolt: [0.1, y + 0.022], scopeAt: [0.06, y + 0.05] };
}

function buildPistol(G, style) {
  const y = 0;
  const L = style === 'deagle' ? 0.27 : style === 'beretta' ? 0.215 : 0.19;
  const H = style === 'deagle' ? 0.036 : 0.03;
  // затвор с насечками
  if (style === 'beretta') {
    G.prof('metal', [[-0.03, y], [L - 0.03, y], [L - 0.03, y + H], [L - 0.07, y + H], [L - 0.08, y + H * 0.55], [0.03, y + H * 0.55], [0.02, y + H], [-0.03, y + H]], 0.028, { bevel: 0.003, target: 'bolt' });
    G.cyl('steel', 0.007, 0.007, 0.09, L - 0.13, y + H * 0.6);
  } else if (style === 'deagle') {
    G.prof('metal', [[-0.03, y], [L - 0.03, y], [L - 0.03, y + H], [-0.03, y + H]], 0.032, { bevel: 0.003, target: 'bolt' });
    G.prof('metal', [[0.05, y + H], [L - 0.03, y + H], [L - 0.03, y + H + 0.012], [0.05, y + H + 0.008]], 0.012, { bevel: 0.002, target: 'bolt' });
  } else {
    const r = style === 'makarov' ? 0.012 : 0.004;
    G.box('metal', 0.026, H, L, -0.03 + L / 2, y + H / 2, { r, target: 'bolt' });
  }
  for (let k = 0; k < 7; k++) G.box('rubber', style === 'deagle' ? 0.0335 : 0.0275, H * 0.7, 0.0025, -0.02 + k * 0.006, y + H * 0.5, { target: 'bolt', r: 0.0005 });
  G.box('steel', 0.006, 0.006, 0.006, L - 0.04, y + H + 0.003, { target: 'bolt' }); G.box('steel', 0.016, 0.007, 0.006, -0.024, y + H + 0.003, { target: 'bolt' });
  G.cyl('metal', 0.0065, 0.0065, 0.008, L - 0.03, y + H * 0.55);
  // рамка, рукоять, скоба
  const role = style === 'beretta' || style === 'makarov' ? 'body' : 'body';
  G.prof(role, [[-0.032, y], [L - 0.05, y], [L - 0.05, y - 0.012], [0.06, y - 0.014], [0.05, y - 0.016], [0.0, y - 0.016]], 0.026, { bevel: 0.003 });
  G.rail(0.06, L - 0.12, y - 0.022, 0.018);
  G.prof(role, [[0.008, y - 0.012], ['q', 0.006, y - 0.06, -0.008, y - 0.108], [-0.046, y - 0.11], ['q', -0.046, y - 0.06, -0.036, y - 0.012], ['q', -0.04, y - 0.004, -0.046, y + 0.004], [-0.03, y + 0.002]], 0.028, { bevel: 0.006, seg: 14 });
  for (let k = 0; k < 6; k++) G.box('rubber', 0.029, 0.003, 0.026, -0.022 - k * 0.0022, y - 0.032 - k * 0.012, { r: 0.0012 });
  G.box('metal', 0.03, 0.007, 0.042, -0.027, y - 0.112, { r: 0.002, target: 'mag' });
  triggerGroup(G, 0.035, y - 0.012);
  if (style === 'beretta' || style === 'makarov') G.box('steel', 0.01, 0.014, 0.008, -0.036, y + 0.02, { r: 0.002 });
  return { trigger: [0.035, y - 0.022], gripL: [-0.01, y - 0.06], muzzle: [L - 0.02, y + H * 0.55], sight: y + H + 0.008, magTop: [-0.022, y - 0.1], bolt: [0.08, y + H / 2] };
}

function buildSMG(G, style) {
  const y = 0;
  if (style === 'mp5') {
    G.cyl('body', 0.022, 0.022, 0.26, -0.06, y + 0.012, { seg: 24 });
    G.prof('body', [[-0.06, y], [0.07, y], [0.07, y - 0.026], [-0.06, y - 0.026]], 0.03, { bevel: 0.003 });
    G.cyl('metal', 0.009, 0.009, 0.08, 0.15, y + 0.03); G.box('metal', 0.008, 0.014, 0.012, 0.18, y + 0.04, { x: -0.012 });
    G.prof('body', [[0.07, y - 0.004], [0.2, y - 0.004], ['q', 0.21, y - 0.03, 0.2, y - 0.04], [0.07, y - 0.04]], 0.044, { bevel: 0.009 });
    G.cyl('metal', 0.007, 0.007, 0.08, 0.2, y + 0.012); muzzleBrake(G, 0.28, y + 0.012, 0.008, 'flash');
    G.box('metal', 0.02, 0.035, 0.016, 0.2, y + 0.04, { r: 0.003 }); G.box('metal', 0.022, 0.02, 0.02, -0.04, y + 0.042, { r: 0.004 });
    magCurved(G, 0.03, y - 0.026, { len: 0.13, curve: 0.05, d: 0.04, w: 0.022, role: 'metal', ribs: false });
    triggerGroup(G, -0.01, y - 0.026); pistolGrip(G, -0.05, y - 0.026, { len: 0.095, ang: 0.25 });
    stockSkeleton(G, -0.06, y + 0.01);
    return { trigger: [-0.01, y - 0.036], gripL: [0.13, y - 0.04], muzzle: [0.34, y + 0.012], sight: y + 0.06, magTop: [0.03, y - 0.026], bolt: [0.17, y + 0.03] };
  }
  if (style === 'uzi') {
    G.box('body', 0.045, 0.06, 0.24, 0.05, y + 0.005, { r: 0.006 });
    for (let k = 0; k < 5; k++) G.box('rubber', 0.046, 0.004, 0.02, -0.02 + k * 0.03, y + 0.035, { r: 0.001 });
    G.cyl('metal', 0.008, 0.008, 0.06, 0.17, y + 0.005); muzzleBrake(G, 0.23, y + 0.005, 0.008, 'plain');
    G.prof('body', [[0.03, y - 0.024], ['q', 0.03, y - 0.08, 0.04, y - 0.14], [-0.01, y - 0.14], ['q', -0.02, y - 0.08, -0.02, y - 0.024]], 0.038, { bevel: 0.006 });
    G.box('metal', 0.036, 0.06, 0.03, 0.03, y - 0.16, { target: 'mag', r: 0.003 });
    triggerGroup(G, 0.07, y - 0.025);
    stockSkeleton(G, -0.07, y + 0.0);
    G.box('metal', 0.02, 0.02, 0.02, 0.15, y + 0.04, { r: 0.004 });
    return { trigger: [0.07, y - 0.035], gripL: [0.12, y - 0.03], muzzle: [0.25, y + 0.005], sight: y + 0.05, magTop: [0.03, y - 0.13], bolt: [0.05, y + 0.035] };
  }
  if (style === 'vector') {
    G.prof('body', [[-0.07, y + 0.04], [0.18, y + 0.04], [0.2, y + 0.01], [0.16, y - 0.02], [0.1, y - 0.07], [0.04, y - 0.07], [0.0, y - 0.03], [-0.07, y - 0.025]], 0.04, { bevel: 0.005 });
    G.rail(-0.05, 0.22, y + 0.04);
    G.cyl('metal', 0.009, 0.009, 0.06, 0.18, y + 0.02); muzzleBrake(G, 0.24, y + 0.02, 0.011, 'brake');
    magStraight(G, 0.07, y - 0.07, { len: 0.11, d: 0.04, w: 0.026, ang: 0.02, role: 'metal' });
    triggerGroup(G, 0.0, y - 0.03); pistolGrip(G, -0.035, y - 0.03, { len: 0.1, ang: 0.15 });
    stockAR(G, -0.07, y + 0.015);
    G.box('metal', 0.02, 0.026, 0.02, -0.03, y + 0.055); G.box('metal', 0.02, 0.026, 0.015, 0.16, y + 0.055);
    return { trigger: [0.0, y - 0.04], gripL: [0.12, y - 0.05], muzzle: [0.3, y + 0.02], sight: y + 0.07, magTop: [0.07, y - 0.07], bolt: [0.05, y + 0.04] };
  }
  // бизон: АК-коробка + шнековый магазин под стволом
  const r = buildAK(G, { mag: false, wood: false, stock: 'skeleton', muzzle: 'plain' });
  G.cyl('metal', 0.026, 0.026, 0.27, 0.12, y - 0.045, { seg: 24, target: 'mag' });
  for (let k = 0; k < 8; k++) G.cyl('rubber', 0.0265, 0.0265, 0.006, 0.14 + k * 0.03, y - 0.045, { target: 'mag' });
  r.magTop = [0.25, y - 0.045]; r.gripL = [0.3, y - 0.075];
  return r;
}

function buildSniper(G, style) {
  const y = 0;
  if (style === 'awp' || style === 'bolt') {
    // ложа-шасси с «дырой» под большой палец
    const role = style === 'awp' ? 'body' : 'wood';
    G.prof(role, [[0.32, y + 0.012], [0.32, y - 0.03], [0.08, y - 0.04], [0.04, y - 0.06], ['q', 0.0, y - 0.12, -0.04, y - 0.12], [-0.05, y - 0.07], [-0.1, y - 0.06], [-0.3, y - 0.11], [-0.33, y - 0.11], [-0.33, y + 0.03], [-0.12, y + 0.02], [-0.06, y + 0.01], [0.32, y + 0.012]], 0.042, { bevel: 0.008, seg: 12 });
    if (style === 'awp') G.box('rubber', 0.044, 0.035, 0.12, -0.2, y - 0.025, { r: 0.006 });
    G.box('rubber', 0.046, 0.14, 0.014, -0.335, y - 0.04, { r: 0.005 });
    G.prof('metal', [[-0.09, y + 0.012], [0.15, y + 0.012], [0.15, y + 0.04], [-0.09, y + 0.04]], 0.028, { bevel: 0.004 });
    const bL = style === 'awp' ? 0.42 : 0.38;
    G.cyl('metal', 0.012, 0.009, bL, 0.15, y + 0.026, { seg: 24 });
    for (let k = 0; k < 6; k++) G.box('rubber', 0.003, 0.003, 0.15, 0.2 + 0.075, y + 0.026 + Math.sin(k) * 0.0, { x: Math.cos(k * Math.PI / 3) * 0.0105, r: 0.0008 });
    muzzleBrake(G, 0.15 + bL, y + 0.026, 0.01, style === 'awp' ? 'brake' : 'plain');
    // затвор с рукоятью
    G.cyl('steel', 0.009, 0.009, 0.1, -0.06, y + 0.03, { target: 'bolt' });
    G.box('steel', 0.04, 0.006, 0.006, -0.03, y + 0.03, { x: 0.022, target: 'bolt' });
    const s = new THREE.SphereGeometry(0.009, 14, 10); s.translate(0.045, y + 0.03, 0.03); G.push('rubber', s, 'bolt');
    triggerGroup(G, 0.03, y - 0.04);
    G.box('metal', 0.028, 0.03, 0.06, 0.06, y - 0.055, { target: 'mag', r: 0.003 });
    if (style === 'awp') { for (const sx of [-1, 1]) G.box('metal', 0.008, 0.008, 0.16, 0.36, y - 0.04, { x: sx * 0.012, r: 0.002 }); }
    const sy = buildScopeParts(G, 0.03, y + 0.04, true);
    return { trigger: [0.03, y - 0.05], gripL: [0.24, y - 0.04], muzzle: [0.15 + bL + 0.085, y + 0.026], sight: sy, magTop: [0.06, y - 0.04], bolt: [-0.03, y + 0.03] };
  }
  if (style === 'dmr') {
    const r = buildAR(G, { hgLen: 0.32, barrelOut: 0.14, muzzle: 'brake', magLen: 0.1, scope: true });
    r.sight = buildScopeParts(G, 0.02, 0.038, false);
    return r;
  }
  // СВД: рамочный деревянный приклад, длинный ствол
  const r = buildAK(G, { muzzle: 'flash', magLen: 0.12, magRole: 'metal' });
  G.cyl('metal', 0.0075, 0.0075, 0.18, 0.6, 0.005); muzzleBrake(G, 0.78, 0.005, 0.009, 'flash');
  r.muzzle = [0.84, 0.005];
  r.sight = buildScopeParts(G, 0.05, 0.05, false);
  return r;
}

function buildShotgun(G, style) {
  const y = 0;
  if (style === 'aa12') {
    G.box('body', 0.05, 0.08, 0.36, 0.06, y + 0.0, { r: 0.008 });
    G.rail(-0.08, 0.24, y + 0.04);
    G.cyl('metal', 0.014, 0.014, 0.16, 0.24, y + 0.01); muzzleBrake(G, 0.4, y + 0.01, 0.014, 'brake');
    G.cyl('body', 0.075, 0.075, 0.06, 0.06, y - 0.11, { target: 'mag', seg: 30 });
    triggerGroup(G, -0.02, y - 0.04); pistolGrip(G, -0.06, y - 0.04, { len: 0.1, ang: 0.25 });
    G.prof('body', [[-0.12, y + 0.04], [-0.32, y + 0.035], [-0.33, y - 0.09], [-0.12, y - 0.03]], 0.046, { bevel: 0.007 });
    G.box('body', 0.03, 0.06, 0.03, 0.18, y - 0.06, { r: 0.006 });
    return { trigger: [-0.02, y - 0.05], gripL: [0.18, y - 0.09], muzzle: [0.49, y + 0.01], sight: y + 0.06, magTop: [0.06, y - 0.05], bolt: [0.06, y + 0.04] };
  }
  if (style === 'saiga') {
    const r = buildAK(G, { wood: false, muzzle: 'brake', mag: false });
    magStraight(G, 0.085, -0.04, { len: 0.11, d: 0.075, w: 0.03, ang: 0.08, role: 'body' });
    r.magTop = [0.085, -0.04];
    return r;
  }
  // помповые
  const wood = style === 'pumpWood' ? 'wood' : 'body';
  G.prof('body', [[-0.06, y - 0.03], [0.14, y - 0.03], [0.14, y + 0.035], [-0.04, y + 0.035], ['q', -0.07, y + 0.03, -0.06, y]], 0.034, { bevel: 0.004 });
  G.box('rubber', 0.0345, 0.02, 0.06, 0.07, y + 0.012, { r: 0.002 });
  G.cyl('metal', 0.012, 0.012, 0.42, 0.14, y + 0.02, { seg: 24 });
  G.cyl('metal', 0.011, 0.011, 0.36, 0.14, y - 0.012, { seg: 20 });
  G.box('metal', 0.03, 0.04, 0.02, 0.5, y + 0.004, { r: 0.004 });
  G.cyl('steel', 0.003, 0.003, 0.004, 0.555, y + 0.034);
  // цевьё-помпа (анимируется)
  G.prof(wood, [[0.2, y - 0.002], [0.36, y - 0.002], ['q', 0.37, y - 0.018, 0.36, y - 0.034], [0.2, y - 0.034], ['q', 0.19, y - 0.018, 0.2, y - 0.002]], 0.044, { bevel: 0.007, target: 'pump' });
  for (let k = 0; k < 6; k++) G.box('rubber', 0.045, 0.004, 0.005, 0.22 + k * 0.022, y - 0.018, { target: 'pump', r: 0.001 });
  triggerGroup(G, 0.02, y - 0.03);
  if (style === 'pumpTac') { pistolGrip(G, -0.02, y - 0.03, { len: 0.1, ang: 0.3 }); stockAR(G, -0.06, y + 0.015); G.rail(-0.02, 0.14, y + 0.035); }
  else G.prof(wood, [[-0.06, y + 0.03], [-0.36, y - 0.0], [-0.36, y - 0.11], [-0.32, y - 0.11], ['q', -0.12, y - 0.07, -0.02, y - 0.06], [0.0, y - 0.03], [-0.06, y - 0.03]], 0.04, { bevel: 0.008 });
  if (style !== 'pumpTac') G.box('rubber', 0.042, 0.115, 0.014, -0.365, y - 0.055, { r: 0.004 });
  return { trigger: [0.02, y - 0.04], gripL: [0.28, y - 0.035], muzzle: [0.56, y + 0.02], sight: y + 0.045, magTop: [0.06, y - 0.03], bolt: [0.06, y + 0.012], pump: true };
}


// ---------- АК-47: детальная модель ----------
function buildAK47(G, o = {}) {
  const y = 0, W = o.furn || 'wood';
  // ствольная коробка (штампованная) с вырезом под магазин
  G.prof('body', [[-0.13, y + 0.024], [0.185, y + 0.024], [0.185, y - 0.028], [0.125, y - 0.028], [0.125, y - 0.034], [0.055, y - 0.034], [0.055, y - 0.028], [-0.12, y - 0.028], ['q', -0.135, y - 0.02, -0.13, y + 0.024]], 0.031, { bevel: 0.0015 });
  // выштамповки (углубления) над магазином и заклёпки
  for (const [ff, yy] of [[0.07, -0.012], [0.11, -0.012]]) G.box('rubber', 0.0315, 0.012, 0.022, ff, y + yy, { r: 0.004 });
  for (const [ff, yy] of [[-0.11, -0.02], [-0.07, -0.02], [-0.03, -0.006], [0.01, -0.021], [0.04, -0.021], [0.16, -0.02], [0.16, 0.008], [0.17, -0.006], [0.135, -0.022]]) G.pin('steel', 0.0024, 0.0335, ff, y + yy);
  // крышка ствольной коробки: скруглённая, с рёбрами жёсткости и упором сзади
  G.prof('body', [[-0.125, y + 0.024], [0.15, y + 0.024], ['q', 0.162, y + 0.034, 0.148, y + 0.041], [-0.1, y + 0.043], ['q', -0.122, y + 0.042, -0.125, y + 0.024]], 0.029, { bevel: 0.006, seg: 12 });
  for (let k = 0; k < 3; k++) G.box('body', 0.0295, 0.003, 0.004, -0.085 + k * 0.013, y + 0.043, { r: 0.0012 });
  G.box('metal', 0.012, 0.012, 0.012, -0.128, y + 0.034, { r: 0.002 });
  // прицельная колодка и секторный прицел
  G.prof('metal', [[0.185, y + 0.024], [0.25, y + 0.024], [0.25, y + 0.036], [0.215, y + 0.05], [0.185, y + 0.046]], 0.026, { bevel: 0.003 });
  G.prof('metal', [[0.19, y + 0.05], [0.265, y + 0.043], [0.268, y + 0.047], [0.19, y + 0.056]], 0.012, { bevel: 0.001 });
  G.box('steel', 0.016, 0.008, 0.01, 0.235, y + 0.052, { r: 0.0015 });
  G.box('metal', 0.012, 0.008, 0.004, 0.266, y + 0.051, { r: 0.0008 });
  // рукоять затвора (справа) с шариком
  G.box('steel', 0.012, 0.009, 0.02, 0.135, y + 0.016, { x: 0.018, r: 0.003, target: 'bolt' });
  G.cyl('steel', 0.004, 0.004, 0.02, 0.13, y + 0.016, { x: 0.03, seg: 10, target: 'bolt' });
  { const s2 = new THREE.SphereGeometry(0.0065, 14, 10); s2.translate(0.035, y + 0.016, -0.14); G.push('steel', s2, 'bolt'); }
  // длинный рычаг переводчика (справа)
  G.prof('steel', [[-0.075, y + 0.018], [0.075, y + 0.012], [0.075, y + 0.004], [-0.06, y + 0.006], [-0.075, y - 0.004]], 0.003, { x: 0.017, bevel: 0.0008 });
  G.box('steel', 0.006, 0.006, 0.014, -0.07, y + 0.0, { x: 0.019, r: 0.0015 });
  // спусковая скоба AK (плоская) и крючок
  G.prof('metal', [[0.055, y - 0.028], [0.055, y - 0.036], ['q', 0.05, y - 0.05, 0.035, y - 0.05], [-0.025, y - 0.05], [-0.03, y - 0.044], [-0.03, y - 0.028], [-0.022, y - 0.028], [-0.022, y - 0.042], [0.033, y - 0.042], ['q', 0.046, y - 0.042, 0.047, y - 0.028]], 0.009, { bevel: 0.001 });
  G.prof('steel', [[0.014, y - 0.028], ['q', 0.02, y - 0.036, 0.008, y - 0.044], [0.004, y - 0.043], ['q', 0.012, y - 0.035, 0.008, y - 0.028]], 0.005, { bevel: 0.0008 });
  G.box('steel', 0.034, 0.006, 0.012, 0.058, y - 0.031, { r: 0.002 });     // защёлка магазина
  // пистолетная рукоять (бакелит) с насечкой
  G.prof(W, [[-0.012, y - 0.028], ['q', -0.014, y - 0.07, -0.04, y - 0.122], [-0.075, y - 0.118], ['q', -0.058, y - 0.07, -0.05, y - 0.028]], 0.028, { bevel: 0.006, seg: 14 });
  for (let k = 0; k < 7; k++) G.box('rubber', 0.0285, 0.0025, 0.03, -0.034 - k * 0.0045, y - 0.045 - k * 0.01, { r: 0.0008 });
  // приклад: дерево, сужение к шейке, металлический затыльник, антабка
  if (o.stock === 'fold') {
    // боковой складной рамочный приклад (трубчатый) с резиновым затыльником
    G.box('metal', 0.034, 0.03, 0.02, -0.14, y - 0.004, { r: 0.004 });
    G.cyl('metal', 0.007, 0.007, 0.25, -0.39, y + 0.008, { seg: 12 });
    G.prof('metal', [[-0.15, y - 0.018], [-0.37, y - 0.09], [-0.38, y - 0.082], [-0.16, y - 0.008]], 0.012, { bevel: 0.003 });
    G.prof('metal', [[-0.38, y + 0.016], [-0.395, y + 0.016], [-0.395, y - 0.1], [-0.38, y - 0.1]], 0.03, { bevel: 0.004 });
    G.box('rubber', 0.034, 0.12, 0.012, -0.4, y - 0.042, { r: 0.004 });
    G.box('rubber', 0.02, 0.03, 0.06, -0.3, y + 0.012, { r: 0.006 });   // щека
  } else {
    G.prof(W, [[-0.13, y + 0.02], [-0.37, y + 0.006], [-0.385, y + 0.004], [-0.39, y - 0.112], [-0.37, y - 0.118], ['q', -0.24, y - 0.07, -0.15, y - 0.032], [-0.13, y - 0.026]], 0.038, { bevel: 0.008, seg: 16 });
    G.prof('metal', [[-0.384, y + 0.007], [-0.394, y + 0.007], [-0.399, y - 0.114], [-0.388, y - 0.118]], 0.041, { bevel: 0.002 });
    G.box('metal', 0.006, 0.014, 0.022, -0.36, y - 0.122, { r: 0.002 });
    G.box('metal', 0.04, 0.012, 0.02, -0.14, y - 0.002, { r: 0.002 });
  }
  // нижнее цевьё: дерево с подпальцевыми выемками, стяжное кольцо спереди
  G.prof(W, [[0.25, y + 0.022], [0.445, y + 0.02], ['q', 0.452, y + 0.004, 0.445, y - 0.024], [0.34, y - 0.03], ['q', 0.31, y - 0.024, 0.28, y - 0.03], [0.25, y - 0.028], ['q', 0.243, y - 0.004, 0.25, y + 0.022]], 0.042, { bevel: 0.009, seg: 14 });
  G.cyl('metal', 0.0235, 0.0235, 0.012, 0.445, y - 0.002, { seg: 24 });
  G.box('metal', 0.044, 0.05, 0.008, 0.25, y - 0.003, { r: 0.003 });
  // ствольная накладка над газовой трубкой: дерево с металлическим колпачком
  G.prof(W, [[0.255, y + 0.03], [0.42, y + 0.03], ['q', 0.428, y + 0.044, 0.42, y + 0.058], [0.26, y + 0.058], ['q', 0.252, y + 0.044, 0.255, y + 0.03]], 0.032, { bevel: 0.008, seg: 12 });
  G.cyl('metal', 0.0175, 0.0175, 0.016, 0.415, y + 0.044, { seg: 20 });
  // газовая трубка, газовая камора с отводом
  G.cyl('metal', 0.0105, 0.0105, 0.08, 0.43, y + 0.044, { seg: 18 });
  G.prof('metal', [[0.5, y + 0.056], [0.535, y + 0.056], [0.545, y + 0.03], [0.545, y - 0.01], [0.5, y - 0.012], [0.49, y + 0.02]], 0.028, { bevel: 0.003 });
  G.box('metal', 0.012, 0.016, 0.02, 0.52, y - 0.018, { r: 0.002 });   // упор штыка
  // ствол, шомпол, мушка с намушником, косой компенсатор
  G.cyl('metal', 0.0095, 0.0085, 0.46, 0.24, y + 0.004, { seg: 22 });
  G.cyl('steel', 0.0028, 0.0028, 0.37, 0.3, y - 0.012, { seg: 10 });
  G.prof('metal', [[0.645, y - 0.004], [0.685, y - 0.004], [0.685, y + 0.024], [0.675, y + 0.03], [0.655, y + 0.03], [0.645, y + 0.02]], 0.022, { bevel: 0.003 });
  { const hood = new THREE.TorusGeometry(0.012, 0.0025, 10, 24, Math.PI * 1.2); hood.rotateZ(-0.1 * Math.PI); hood.translate(0, y + 0.04, -0.668); G.push('metal', hood); }
  G.box('metal', 0.003, 0.016, 0.003, 0.668, y + 0.038);
  if (o.brake === '74') {
    // дульный тормоз-компенсатор: цилиндр с окнами и крестовой прорезью
    G.lathe('metal', [[0, 0.7], [0.012, 0.7], [0.0135, 0.708], [0.0135, 0.778], [0.0115, 0.784], [0, 0.784]], y + 0.004, { seg: 24 });
    for (const sx of [-1, 1]) G.box('rubber', 0.004, 0.009, 0.012, 0.758, y + 0.004, { x: sx * 0.0125, r: 0.001 });
    G.box('rubber', 0.012, 0.004, 0.02, 0.73, y + 0.0165, { r: 0.001 });
    G.box('rubber', 0.03, 0.0035, 0.004, 0.782, y + 0.004, { r: 0.0005 });
  } else {
    G.lathe('metal', [[0, 0.7], [0.0125, 0.7], [0.0125, 0.745], [0.0105, 0.75], [0, 0.75]], y + 0.004, { seg: 22 });
    G.box('rubber', 0.026, 0.006, 0.018, 0.728, y + 0.016, { r: 0.002 });
  }
  // магазин-«рожок» с рёбрами жёсткости и затыльником
  const mf = 0.09, my = y - 0.032;
  G.prof(o.magRole || 'metal', [[mf + 0.035, my], ['q', mf + 0.08, my - 0.1, mf + 0.135, my - 0.185], [mf + 0.07, my - 0.205], ['q', mf + 0.015, my - 0.12, mf - 0.035, my]], 0.026, { bevel: 0.0025, target: 'mag', seg: 16 });
  for (let k = 0; k < 4; k++) { const t = 0.2 + k * 0.2, ff = mf + 0.012 + t * t * 0.1 + t * 0.03, yy = my - t * 0.19; G.box('metal', 0.0275, 0.032, 0.004, ff, yy, { target: 'mag', r: 0.0012, rx: -0.5 - t * 0.4 }); }
  G.box('metal', 0.03, 0.007, 0.07, mf + 0.102, my - 0.197, { target: 'mag', r: 0.0025, rx: -0.95 });
  return { trigger: [0.01, y - 0.034], gripL: [0.35, y - 0.032], muzzle: [o.brake === '74' ? 0.784 : 0.75, y + 0.004], sight: y + 0.06, magTop: [mf, my], bolt: [0.14, y + 0.016], scopeAt: [0.06, y + 0.045] };
}



// ---------- MP5 (MX-9): детальная модель ----------
function buildMP5(G) {
  const y = 0, ty = y + 0.012;
  // круглая штампованная ствольная коробка с торцевой крышкой и продольными рёбрами
  G.lathe('body', [[0, -0.085], [0.017, -0.085], [0.021, -0.078], [0.021, 0.2], [0.018, 0.205], [0, 0.205]], ty, { seg: 28 });
  for (const sx of [-1, 1]) G.box('body', 0.004, 0.006, 0.2, 0.06, ty - 0.006, { x: sx * 0.02, r: 0.0015 });
  G.box('body', 0.03, 0.014, 0.27, 0.06, ty - 0.02, { r: 0.003 });
  for (const ff of [-0.06, 0.0, 0.11, 0.17]) G.pin('steel', 0.0022, 0.044, ff, ty - 0.012);
  // окно выброса и зацеп
  G.box('rubber', 0.002, 0.012, 0.05, 0.075, ty + 0.006, { x: 0.0205, r: 0.001 });
  // трубка взвода сверху + рукоять взвода слева
  G.cyl('metal', 0.0085, 0.0085, 0.16, 0.12, ty + 0.03, { seg: 16 });
  G.box('metal', 0.012, 0.016, 0.06, 0.2, ty + 0.024, { r: 0.003 });
  G.box('steel', 0.03, 0.006, 0.006, 0.245, ty + 0.032, { x: -0.018, r: 0.002, target: 'bolt' });
  { const k = new THREE.SphereGeometry(0.0055, 12, 8); k.translate(-0.034, ty + 0.032, -0.245); G.push('rubber', k, 'bolt'); }
  // барабанный целик сзади и кольцевая мушка спереди
  G.box('metal', 0.026, 0.012, 0.02, -0.05, ty + 0.03, { r: 0.003 });
  G.pin('metal', 0.011, 0.024, -0.05, ty + 0.044);
  for (let k = 0; k < 4; k++) G.box('rubber', 0.025, 0.002, 0.002, -0.05 + Math.cos(k * 1.57) * 0.011, ty + 0.044 + Math.sin(k * 1.57) * 0.011, { r: 0.0004 });
  G.prof('metal', [[0.268, ty + 0.03], [0.292, ty + 0.03], [0.288, ty + 0.046], [0.272, ty + 0.046]], 0.018, { bevel: 0.002 });
  { const hood = new THREE.TorusGeometry(0.0115, 0.0022, 8, 22); hood.translate(0, ty + 0.056, -0.28); G.push('metal', hood); }
  G.box('metal', 0.0025, 0.012, 0.003, 0.28, ty + 0.052);
  // тонкое цевьё с подпальцевыми канавками
  G.prof('body', [[0.075, ty - 0.012], [0.215, ty - 0.012], ['q', 0.226, ty - 0.03, 0.215, y - 0.044], [0.085, y - 0.044], ['q', 0.075, y - 0.03, 0.075, ty - 0.012]], 0.05, { bevel: 0.01, seg: 14 });
  for (let k = 0; k < 6; k++) G.box('rubber', 0.051, 0.003, 0.004, 0.1 + k * 0.019, y - 0.03, { r: 0.0008 });
  // ствол с тремя шпильками под глушитель и пламегасителем
  G.cyl('metal', 0.007, 0.007, 0.1, 0.205, ty, { seg: 18 });
  for (let k = 0; k < 3; k++) { const a = k * 2.09; G.box('metal', 0.004, 0.004, 0.012, 0.3, ty + Math.sin(a) * 0.009, { x: Math.cos(a) * 0.009, r: 0.001 }); }
  G.lathe('metal', [[0, 0.305], [0.0095, 0.305], [0.0095, 0.335], [0.008, 0.34], [0, 0.34]], ty, { seg: 18 });
  // спусковая коробка с рукоятью и большой скобой
  G.prof('body', [[0.01, y - 0.026], [-0.075, y - 0.026], ['q', -0.08, y - 0.03, -0.075, y - 0.036], [0.025, y - 0.036]], 0.03, { bevel: 0.003 });
  G.prof('body', [[-0.04, y - 0.03], ['q', -0.044, y - 0.07, -0.058, y - 0.118], [-0.092, y - 0.114], ['q', -0.078, y - 0.07, -0.074, y - 0.032]], 0.03, { bevel: 0.007, seg: 14 });
  for (let k = 0; k < 6; k++) G.box('rubber', 0.0305, 0.0025, 0.02, -0.074 - k * 0.0025, y - 0.05 - k * 0.011, { r: 0.0008 });
  G.prof('body', [[0.03, y - 0.032], [0.03, y - 0.06], ['q', 0.02, y - 0.068, 0.0, y - 0.068], [-0.04, y - 0.068], [-0.04, y - 0.06], [-0.002, y - 0.06], ['q', 0.022, y - 0.06, 0.022, y - 0.036]], 0.014, { bevel: 0.002 });
  G.prof('steel', [[-0.004, y - 0.034], ['q', 0.002, y - 0.044, -0.008, y - 0.054], [-0.012, y - 0.053], ['q', -0.004, y - 0.044, -0.01, y - 0.034]], 0.005, { bevel: 0.0008 });
  G.box('steel', 0.006, 0.012, 0.018, -0.06, y - 0.03, { x: -0.017, r: 0.002 });   // переводчик
  // тонкий изогнутый магазин
  magCurved(G, 0.04, y - 0.006, { len: 0.155, curve: 0.04, d: 0.034, w: 0.022, role: 'metal', ribs: true });
  G.box('metal', 0.04, 0.026, 0.05, 0.045, y - 0.012, { r: 0.004 });   // шахта
  // выдвижной приклад: две тяги и затыльник
  for (const sx of [-1, 1]) G.cyl('steel', 0.0045, 0.0045, 0.21, -0.29, ty - 0.004, { x: sx * 0.016, seg: 10 });
  G.prof('metal', [[-0.285, ty + 0.012], [-0.3, ty + 0.012], [-0.305, y - 0.09], [-0.29, y - 0.094], ['q', -0.29, y - 0.04, -0.285, ty + 0.012]], 0.044, { bevel: 0.004 });
  G.box('rubber', 0.046, 0.11, 0.01, -0.307, y - 0.035, { r: 0.004 });
  return { trigger: [-0.004, y - 0.044], gripL: [0.15, y - 0.044], muzzle: [0.34, ty], sight: ty + 0.056, magTop: [0.04, y - 0.026], bolt: [0.245, ty + 0.032] };
}

// ---------- Пистолеты: «Кобра» (итальянская классика) и «Оса» (компактный) ----------
function buildBeretta(G) {
  const y = 0, L = 0.217;
  // затвор с открытым верхом: видна ствольная часть
  G.prof('metal', [[-0.034, y], [L - 0.035, y], [L - 0.035, y + 0.03], [L - 0.06, y + 0.03], [L - 0.07, y + 0.016], [0.035, y + 0.016], [0.028, y + 0.03], [-0.03, y + 0.03], ['q', -0.036, y + 0.026, -0.034, y]], 0.028, { bevel: 0.0025, target: 'bolt' });
  G.cyl('steel', 0.0075, 0.0075, 0.14, 0.035, y + 0.018, { seg: 18 });
  G.cyl('rubber', 0.0045, 0.0045, 0.004, L - 0.036, y + 0.02);
  for (let k = 0; k < 8; k++) G.box('rubber', 0.0285, 0.018, 0.002, -0.026 + k * 0.0052, y + 0.016, { target: 'bolt', r: 0.0004 });
  for (const sx of [-1, 1]) G.box('steel', 0.006, 0.01, 0.016, -0.02, y + 0.022, { x: sx * 0.016, r: 0.002, target: 'bolt' });   // флажки предохранителя
  G.box('metal', 0.004, 0.008, 0.006, L - 0.045, y + 0.034, { target: 'bolt' });
  G.box('metal', 0.016, 0.006, 0.007, -0.026, y + 0.033, { target: 'bolt', r: 0.001 });
  // рамка
  G.prof('body', [[-0.036, y], [L - 0.045, y], [L - 0.045, y - 0.014], [0.07, y - 0.016], [0.055, y - 0.018], [0.0, y - 0.018]], 0.026, { bevel: 0.0025 });
  // большая скоба с крюком под палец
  G.prof('body', [[0.06, y - 0.016], [0.07, y - 0.035], ['q', 0.066, y - 0.05, 0.05, y - 0.052], [0.005, y - 0.05], [0.0, y - 0.04], [0.008, y - 0.044], [0.048, y - 0.045], ['q', 0.058, y - 0.044, 0.06, y - 0.032], [0.052, y - 0.017]], 0.008, { bevel: 0.0012 });
  G.prof('steel', [[0.03, y - 0.016], ['q', 0.036, y - 0.03, 0.025, y - 0.04], [0.021, y - 0.039], ['q', 0.028, y - 0.03, 0.024, y - 0.016]], 0.005, { bevel: 0.0008 });
  // рукоять с деревянными накладками
  G.prof('body', [[0.006, y - 0.016], ['q', 0.004, y - 0.07, -0.008, y - 0.118], [-0.05, y - 0.12], ['q', -0.05, y - 0.07, -0.04, y - 0.016], ['q', -0.045, y - 0.006, -0.05, y + 0.002], [-0.034, y + 0.002]], 0.026, { bevel: 0.005, seg: 14 });
  for (const sx of [-1, 1]) {
    G.prof('wood', [[0.0, y - 0.024], ['q', -0.002, y - 0.07, -0.012, y - 0.108], [-0.044, y - 0.11], ['q', -0.044, y - 0.07, -0.036, y - 0.024]], 0.003, { x: sx * 0.0145, bevel: 0.0012, seg: 12 });
    G.pin('steel', 0.0028, 0.002, -0.022, y - 0.04, { x: sx * 0.0165 }); G.pin('steel', 0.0028, 0.002, -0.028, y - 0.095, { x: sx * 0.0165 });
  }
  // курок и защёлка
  G.prof('steel', [[-0.034, y + 0.012], [-0.044, y + 0.03], [-0.05, y + 0.028], [-0.042, y + 0.008]], 0.008, { bevel: 0.001 });
  G.cyl('steel', 0.004, 0.004, 0.006, 0.006, y - 0.022, { x: -0.014 });
  G.box('metal', 0.028, 0.008, 0.044, -0.025, y - 0.122, { target: 'mag', r: 0.002 });
  return { trigger: [0.026, y - 0.026], gripL: [-0.01, y - 0.06], muzzle: [L - 0.035, y + 0.018], sight: y + 0.038, magTop: [-0.02, y - 0.1], bolt: [0.08, y + 0.016] };
}
function buildMakarov(G) {
  const y = 0, L = 0.16;
  // скруглённый затвор с мелкой насечкой
  G.box('metal', 0.026, 0.028, L, -0.03 + L / 2, y + 0.014, { r: 0.011, target: 'bolt' });
  for (let k = 0; k < 9; k++) G.box('rubber', 0.0265, 0.016, 0.0018, -0.024 + k * 0.004, y + 0.014, { target: 'bolt', r: 0.0004 });
  G.box('steel', 0.004, 0.007, 0.006, L - 0.04, y + 0.03, { target: 'bolt', r: 0.001 });
  G.box('steel', 0.014, 0.006, 0.006, -0.024, y + 0.03, { target: 'bolt', r: 0.001 });
  G.box('steel', 0.004, 0.01, 0.014, -0.012, y + 0.016, { x: -0.014, target: 'bolt', r: 0.002 });   // флажок
  G.cyl('rubber', 0.0045, 0.0045, 0.003, L - 0.03, y + 0.014);
  // рамка, скоба (из одного целого), курок
  G.prof('body', [[-0.032, y], [L - 0.04, y], [L - 0.042, y - 0.01], [0.0, y - 0.012]], 0.024, { bevel: 0.003 });
  G.prof('body', [[0.07, y - 0.008], ['q', 0.07, y - 0.044, 0.04, y - 0.046], [0.0, y - 0.044], [0.0, y - 0.037], [0.038, y - 0.039], ['q', 0.062, y - 0.038, 0.062, y - 0.008]], 0.007, { bevel: 0.0012 });
  G.prof('steel', [[0.028, y - 0.01], ['q', 0.034, y - 0.025, 0.022, y - 0.034], [0.018, y - 0.033], ['q', 0.026, y - 0.024, 0.022, y - 0.01]], 0.005, { bevel: 0.0008 });
  G.prof('steel', [[-0.03, y + 0.008], [-0.04, y + 0.026], ['q', -0.048, y + 0.026, -0.046, y + 0.018], [-0.038, y + 0.004]], 0.008, { bevel: 0.001 });
  // рукоять: накладки из коричневого бакелита с насечкой и антабка
  G.prof('body', [[0.004, y - 0.01], ['q', 0.002, y - 0.06, -0.006, y - 0.1], [-0.046, y - 0.102], ['q', -0.046, y - 0.05, -0.034, y - 0.01]], 0.024, { bevel: 0.005, seg: 14 });
  for (const sx of [-1, 1]) G.prof('wood', [[-0.002, y - 0.016], ['q', -0.004, y - 0.06, -0.01, y - 0.094], [-0.042, y - 0.096], ['q', -0.042, y - 0.05, -0.032, y - 0.016]], 0.003, { x: sx * 0.0135, bevel: 0.0014, seg: 12 });
  for (let i = 0; i < 6; i++) for (const sx of [-1, 1]) G.box('rubber', 0.0012, 0.0025, 0.026, -0.02, y - 0.03 - i * 0.01, { x: sx * 0.0155, r: 0.0003 });
  { const r = new THREE.TorusGeometry(0.006, 0.0015, 6, 14); r.translate(0, y - 0.104, 0.044); G.push('steel', r); }
  G.box('metal', 0.026, 0.006, 0.04, -0.024, y - 0.104, { target: 'mag', r: 0.002 });
  return { trigger: [0.024, y - 0.02], gripL: [-0.016, y - 0.055], muzzle: [L - 0.03, y + 0.014], sight: y + 0.034, magTop: [-0.02, y - 0.09], bolt: [0.06, y + 0.014] };
}

// ---------- СВД: детальная модель ----------
function buildSVD(G) {
  const y = 0;
  // ствольная коробка AK-типа, удлинённая
  G.prof('body', [[-0.13, y + 0.024], [0.2, y + 0.024], [0.2, y - 0.028], [0.13, y - 0.028], [0.13, y - 0.034], [0.06, y - 0.034], [0.06, y - 0.028], [-0.12, y - 0.028], ['q', -0.135, y - 0.02, -0.13, y + 0.024]], 0.031, { bevel: 0.0015 });
  G.prof('body', [[-0.125, y + 0.024], [0.17, y + 0.024], ['q', 0.18, y + 0.034, 0.168, y + 0.04], [-0.1, y + 0.042], ['q', -0.122, y + 0.042, -0.125, y + 0.024]], 0.029, { bevel: 0.006, seg: 12 });
  for (const [ff, yy] of [[-0.1, -0.02], [-0.04, -0.02], [0.02, -0.021], [0.17, -0.02], [0.18, 0.006]]) G.pin('steel', 0.0024, 0.0335, ff, y + yy);
  G.box('steel', 0.012, 0.009, 0.02, 0.15, y + 0.016, { x: 0.018, r: 0.003, target: 'bolt' });
  { const s2 = new THREE.SphereGeometry(0.0065, 14, 10); s2.translate(0.03, y + 0.016, -0.16); G.push('steel', s2, 'bolt'); }
  G.prof('steel', [[-0.075, y + 0.018], [0.075, y + 0.012], [0.075, y + 0.004], [-0.075, y - 0.004]], 0.003, { x: 0.017, bevel: 0.0008 });
  // кронштейн оптики слева (ласточкин хвост)
  G.box('metal', 0.006, 0.03, 0.14, 0.02, y + 0.0, { x: -0.019, r: 0.0015 });
  // рамочный деревянный приклад с щекой и окном
  G.prof('wood', [[-0.13, y + 0.022], [-0.2, y + 0.034], [-0.33, y + 0.034], [-0.42, y + 0.02], [-0.43, y - 0.11], [-0.4, y - 0.118], ['q', -0.27, y - 0.09, -0.14, y - 0.034], [-0.13, y - 0.026]], 0.036, { bevel: 0.007, seg: 16, holes: [[[-0.16, y - 0.024], [-0.38, y - 0.008], [-0.392, y - 0.02], [-0.392, y - 0.088], [-0.36, y - 0.092], ['q', -0.26, y - 0.07, -0.16, y - 0.036]]] });
  G.box('rubber', 0.038, 0.025, 0.11, -0.3, y + 0.046, { r: 0.008 });    // съёмная щека
  G.prof('metal', [[-0.425, y + 0.022], [-0.435, y + 0.022], [-0.44, y - 0.114], [-0.43, y - 0.12]], 0.039, { bevel: 0.002 });
  // спусковая скоба, крючок
  G.prof('metal', [[0.06, y - 0.028], [0.06, y - 0.036], ['q', 0.055, y - 0.05, 0.04, y - 0.05], [-0.02, y - 0.05], [-0.025, y - 0.044], [-0.025, y - 0.028], [-0.017, y - 0.028], [-0.017, y - 0.042], [0.038, y - 0.042], ['q', 0.05, y - 0.042, 0.052, y - 0.028]], 0.009, { bevel: 0.001 });
  G.prof('steel', [[0.018, y - 0.028], ['q', 0.024, y - 0.036, 0.012, y - 0.044], [0.008, y - 0.043], ['q', 0.016, y - 0.035, 0.012, y - 0.028]], 0.005, { bevel: 0.0008 });
  // цевьё из двух накладок с вентиляционными окнами
  for (const yy of [y + 0.018, y - 0.012]) G.prof('wood', [[0.25, yy + 0.02], [0.47, yy + 0.02], ['q', 0.48, yy + 0.006, 0.47, yy - 0.012], [0.25, yy - 0.012], ['q', 0.243, yy + 0.004, 0.25, yy + 0.02]], 0.046, { bevel: 0.009, seg: 12 });
  for (let k = 0; k < 6; k++) for (const sx of [-1, 1]) G.box('rubber', 0.002, 0.014, 0.022, 0.275 + k * 0.034, y + 0.022, { x: sx * 0.0225, r: 0.0015 });
  G.cyl('metal', 0.0255, 0.0255, 0.012, 0.248, y + 0.006, { seg: 24 }); G.cyl('metal', 0.0255, 0.0255, 0.01, 0.47, y + 0.006, { seg: 24 });
  // газовый блок, длинный тонкий ствол, мушка и щелевой пламегаситель
  G.prof('metal', [[0.5, y + 0.05], [0.54, y + 0.05], [0.55, y + 0.026], [0.55, y - 0.012], [0.5, y - 0.014], [0.49, y + 0.02]], 0.028, { bevel: 0.003 });
  G.cyl('metal', 0.0105, 0.008, 0.48, 0.24, y + 0.004, { seg: 22 });
  G.prof('metal', [[0.69, y - 0.004], [0.72, y - 0.004], [0.72, y + 0.026], [0.69, y + 0.026]], 0.02, { bevel: 0.002 });
  { const hood = new THREE.TorusGeometry(0.011, 0.0022, 8, 22, Math.PI * 1.2); hood.rotateZ(-0.1 * Math.PI); hood.translate(0, y + 0.034, -0.705); G.push('metal', hood); }
  G.lathe('metal', [[0, 0.72], [0.0115, 0.72], [0.0115, 0.8], [0.0095, 0.805], [0, 0.805]], y + 0.004, { seg: 22 });
  for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; G.box('rubber', 0.0022, 0.004, 0.06, 0.765, y + 0.004 + Math.sin(a) * 0.011, { x: Math.cos(a) * 0.011, r: 0.0006 }); }
  // магазин на 10 патронов
  const mf = 0.095, my = y - 0.032;
  G.prof('metal', [[mf + 0.033, my], ['q', mf + 0.05, my - 0.05, mf + 0.07, my - 0.1], [mf + 0.0, my - 0.11], ['q', mf - 0.02, my - 0.05, mf - 0.033, my]], 0.026, { bevel: 0.0025, target: 'mag', seg: 12 });
  for (let k = 1; k < 3; k++) G.box('metal', 0.0275, 0.03, 0.004, mf + 0.01 + k * 0.012, my - k * 0.035, { target: 'mag', r: 0.0012, rx: -0.3 });
  const sy = buildScopeParts(G, 0.04, y + 0.05, false);
  return { trigger: [0.016, y - 0.034], gripL: [0.38, y - 0.03], muzzle: [0.805, y + 0.004], sight: sy, magTop: [mf, my], bolt: [0.15, y + 0.016] };
}

// ---------- Помповый дробовик (SG-12): детальная модель ----------
function buildPump(G, tac) {
  const y = 0, W = tac ? 'body' : 'wood';
  // ствольная коробка с окном выброса и скруглёнными гранями
  G.prof('body', [[-0.07, y - 0.034], [0.16, y - 0.034], [0.16, y + 0.036], [-0.045, y + 0.036], ['q', -0.07, y + 0.032, -0.07, y + 0.0]], 0.036, { bevel: 0.006, seg: 10 });
  G.box('rubber', 0.0365, 0.022, 0.07, 0.08, y + 0.008, { x: 0.001, r: 0.002 });
  G.box('steel', 0.002, 0.016, 0.06, 0.08, y + 0.008, { x: 0.0185, r: 0.0008, target: 'pump' });   // затвор в окне
  for (const ff of [-0.02, 0.12]) G.pin('steel', 0.003, 0.038, ff, y - 0.024);
  G.cyl('steel', 0.004, 0.004, 0.04, 0.02, y - 0.025, { x: 0 }); // предохранитель-кнопка
  // ствол с вентилируемой планкой и мушкой-бусиной
  G.cyl('metal', 0.0125, 0.0115, 0.46, 0.16, y + 0.02, { seg: 26 });
  G.box('metal', 0.008, 0.003, 0.44, 0.38, y + 0.036, { r: 0.001 });
  for (let f = 0.18; f < 0.6; f += 0.03) G.box('metal', 0.004, 0.006, 0.006, f, y + 0.032, { r: 0.0008 });
  { const b = new THREE.SphereGeometry(0.003, 10, 8); b.translate(0, y + 0.041, -0.6); G.push('brass', b); }
  // подствольный магазин с заглушкой и кольцом-креплением
  G.cyl('metal', 0.0115, 0.0115, 0.4, 0.16, y - 0.012, { seg: 20 });
  G.lathe('metal', [[0, 0.56], [0.0125, 0.56], [0.0125, 0.585], [0.009, 0.592], [0, 0.592]], y - 0.012, { seg: 20 });
  G.box('metal', 0.026, 0.05, 0.016, 0.54, y + 0.004, { r: 0.004 });
  // цевьё-помпа с продольными канавками (анимируется)
  G.prof(W, [[0.21, y + 0.004], [0.37, y + 0.004], ['q', 0.382, y - 0.016, 0.37, y - 0.038], [0.21, y - 0.038], ['q', 0.198, y - 0.016, 0.21, y + 0.004]], 0.05, { bevel: 0.009, seg: 12, target: 'pump' });
  for (let k = 0; k < 7; k++) for (const sx of [-1, 1]) G.box('rubber', 0.002, 0.004, 0.13, 0.29, y - 0.03 + k * 0.0045, { x: sx * 0.0255, r: 0.0008, target: 'pump' });
  for (const sx of [-1, 1]) G.box('steel', 0.002, 0.004, 0.16, 0.12, y - 0.012, { x: sx * 0.014, r: 0.0008, target: 'pump' });   // штанги помпы
  // спусковая скоба, крючок
  G.prof('metal', [[0.05, y - 0.034], [0.05, y - 0.052], ['q', 0.045, y - 0.062, 0.03, y - 0.062], [-0.02, y - 0.062], [-0.03, y - 0.05], [-0.03, y - 0.034], [-0.022, y - 0.034], [-0.022, y - 0.054], [0.03, y - 0.054], ['q', 0.042, y - 0.054, 0.042, y - 0.034]], 0.01, { bevel: 0.0012 });
  G.prof('steel', [[0.012, y - 0.034], ['q', 0.018, y - 0.044, 0.006, y - 0.054], [0.002, y - 0.053], ['q', 0.01, y - 0.044, 0.006, y - 0.034]], 0.005, { bevel: 0.0008 });
  if (tac) { pistolGrip(G, -0.03, y - 0.034, { len: 0.1, ang: 0.3 }); stockAR(G, -0.07, y + 0.012); G.rail(-0.04, 0.18, y + 0.036); }
  else {
    // классический приклад с шейкой и резиновым затыльником
    G.prof(W, [[-0.07, y + 0.032], [-0.38, y + 0.004], [-0.385, y - 0.006], [-0.385, y - 0.118], [-0.365, y - 0.124], ['q', -0.2, y - 0.09, -0.07, y - 0.068], ['q', -0.03, y - 0.06, -0.03, y - 0.034], [-0.07, y - 0.034]], 0.042, { bevel: 0.009, seg: 16 });
    G.box('rubber', 0.044, 0.13, 0.018, -0.393, y - 0.06, { r: 0.005 });
    for (let k = 0; k < 5; k++) G.box('rubber', 0.0425, 0.002, 0.024, -0.06 - k * 0.006, y - 0.048 + k * 0.004, { r: 0.0005 });
  }
  return { trigger: [0.01, y - 0.044], gripL: [0.29, y - 0.04], muzzle: [0.62, y + 0.02], sight: y + 0.045, magTop: [0.06, y - 0.03], bolt: [0.08, y + 0.008], pump: true };
}

// ---------- M4 (AR-4): детальная модель ----------
function buildM4(G) {
  const y = 0;
  // нижний ресивер: шахта магазина с расширением, вставка под спуск
  G.prof('body', [[-0.1, y], [0.125, y], [0.128, y - 0.012], [0.112, y - 0.016], [0.112, y - 0.05], [0.104, y - 0.056], [0.036, y - 0.056], [0.03, y - 0.048], [0.03, y - 0.022], [-0.07, y - 0.024], ['q', -0.098, y - 0.02, -0.1, y - 0.006]], 0.03, { bevel: 0.0025 });
  G.box('body', 0.034, 0.008, 0.08, 0.072, y - 0.054, { r: 0.003 });                        // раструб шахты
  G.cyl('steel', 0.004, 0.004, 0.006, 0.08, y - 0.03, { x: 0.016 });                         // кнопка магазина
  G.box('metal', 0.003, 0.016, 0.012, 0.11, y - 0.012, { x: -0.016, r: 0.001 });             // затворная задержка
  G.prof('steel', [[-0.035, y - 0.008], [-0.012, y - 0.004], [-0.012, y - 0.01], [-0.035, y - 0.012]], 0.003, { x: -0.016, bevel: 0.0006 }); // переводчик
  for (const ff of [-0.03, 0.01, 0.105]) G.pin('steel', 0.0028, 0.032, ff, y - 0.012);
  // спусковая скоба и крючок
  G.prof('body', [[0.03, y - 0.024], [0.03, y - 0.044], [-0.026, y - 0.044], ['q', -0.036, y - 0.044, -0.036, y - 0.036], [-0.036, y - 0.024], [-0.03, y - 0.024], [-0.03, y - 0.037], [0.024, y - 0.037], [0.024, y - 0.024]], 0.008, { bevel: 0.0012 });
  G.prof('steel', [[0.002, y - 0.024], ['q', 0.008, y - 0.032, -0.002, y - 0.04], [-0.006, y - 0.039], ['q', 0.002, y - 0.032, -0.004, y - 0.024]], 0.005, { bevel: 0.0008 });
  // пистолетная рукоять A2 с выступом под палец и насечкой
  G.prof('body', [[-0.036, y - 0.024], ['q', -0.04, y - 0.06, -0.056, y - 0.098], [-0.08, y - 0.11], [-0.092, y - 0.104], ['q', -0.08, y - 0.06, -0.072, y - 0.026]], 0.028, { bevel: 0.006, seg: 14 });
  G.box('body', 0.029, 0.008, 0.006, -0.05, y - 0.06, { r: 0.002 });
  for (let k = 0; k < 7; k++) G.box('rubber', 0.0285, 0.003, 0.016, -0.074 - k * 0.0018, y - 0.04 - k * 0.009, { r: 0.0008 });
  // верхний ресивер: плоский верх с планкой, окно выброса, отражатель, досылатель
  G.prof('body', [[-0.108, y], [0.135, y], [0.135, y + 0.034], [-0.09, y + 0.034], [-0.108, y + 0.024]], 0.027, { bevel: 0.0025 });
  G.rail(-0.085, 0.215, y + 0.034);
  G.box('rubber', 0.002, 0.014, 0.055, 0.035, y + 0.016, { x: 0.0137, r: 0.001 });            // окно выброса
  G.box('metal', 0.0025, 0.016, 0.06, 0.035, y + 0.016, { x: 0.0152, r: 0.0008 });            // шторка
  G.box('body', 0.008, 0.016, 0.014, -0.02, y + 0.022, { x: 0.016, r: 0.003 });               // отражатель гильз
  G.cyl('metal', 0.0065, 0.0065, 0.018, -0.045, y + 0.022, { x: 0.017, seg: 14 });            // досылатель
  { const k = new THREE.CylinderGeometry(0.0085, 0.0085, 0.006, 16); k.rotateZ(Math.PI / 2); k.translate(0.027, y + 0.022, 0.054); G.push('metal', k); }
  G.box('metal', 0.03, 0.006, 0.012, -0.108, y + 0.028, { r: 0.0015, target: 'bolt' });       // рукоять заряжания
  G.box('metal', 0.008, 0.006, 0.03, -0.095, y + 0.028, { r: 0.0012, target: 'bolt' });
  // откидной целик
  G.prof('metal', [[-0.07, y + 0.044], [-0.05, y + 0.044], [-0.052, y + 0.066], [-0.068, y + 0.066]], 0.022, { bevel: 0.002 });
  G.box('rubber', 0.008, 0.008, 0.004, -0.06, y + 0.062, { r: 0.002 });
  // цевьё RIS: четыре планки
  const hf = 0.137, hl = 0.18, hy = y + 0.01;
  G.box('body', 0.044, 0.044, hl, hf + hl / 2, hy, { r: 0.008 });
  G.rail(hf, hl, hy + 0.022, 0.021);
  for (const sx of [-1, 1]) for (let f = hf + 0.004; f < hf + hl - 0.003; f += 0.01) G.box('metal', 0.008, 0.021, 0.005, f, hy, { x: sx * 0.024, r: 0.0008 });
  for (let f = hf + 0.004; f < hf + hl - 0.003; f += 0.01) G.box('metal', 0.021, 0.008, 0.005, f, hy - 0.024, { r: 0.0008 });
  G.cyl('metal', 0.026, 0.026, 0.012, hf - 0.006, hy, { seg: 24 });                          // гайка цевья
  // ствол, газовый блок с треугольной мушкой (A-frame), штык-упор, антабка
  G.cyl('metal', 0.0085, 0.0075, 0.22, hf + hl, hy, { seg: 22 });
  const fs = hf + hl + 0.04;
  G.prof('metal', [[fs - 0.016, hy - 0.012], [fs + 0.016, hy - 0.012], [fs + 0.012, hy + 0.012], [fs + 0.006, hy + 0.052], [fs - 0.006, hy + 0.052], [fs - 0.012, hy + 0.012]], 0.02, { bevel: 0.002 });
  G.box('rubber', 0.021, 0.022, 0.014, fs, hy + 0.034, { r: 0.002 });
  G.box('metal', 0.003, 0.012, 0.003, fs, hy + 0.046);
  G.box('metal', 0.012, 0.014, 0.016, fs, hy - 0.02, { r: 0.002 });
  { const sw = new THREE.TorusGeometry(0.009, 0.0018, 8, 16); sw.translate(0, hy - 0.032, -fs); G.push('steel', sw); }
  // пламегаситель «птичья клетка»
  const mz = hf + hl + 0.22;
  G.lathe('metal', [[0, mz], [0.0108, mz], [0.0108, mz + 0.045], [0.0098, mz + 0.05], [0, mz + 0.05]], hy, { seg: 22 });
  for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2 + 0.6; G.box('rubber', 0.0022, 0.0036, 0.026, mz + 0.03, hy + Math.sin(a) * 0.0102, { x: Math.cos(a) * 0.0102, r: 0.0006 }); }
  // буферная трубка с гайкой и телескопический приклад
  G.cyl('metal', 0.0145, 0.0145, 0.19, -0.3, y + 0.016, { seg: 20 });
  G.cyl('steel', 0.017, 0.017, 0.008, -0.118, y + 0.016, { seg: 8 });
  const s0 = -0.215;
  G.prof('body', [[s0, y + 0.034], [s0 - 0.105, y + 0.036], [s0 - 0.11, y + 0.03], [s0 - 0.11, y - 0.07], [s0 - 0.094, y - 0.074], ['q', s0 - 0.05, y - 0.04, s0 - 0.012, y - 0.004], [s0, y]], 0.034, { bevel: 0.005, seg: 12 });
  G.box('rubber', 0.036, 0.098, 0.012, s0 - 0.112, y - 0.018, { r: 0.004 });
  for (let k = 0; k < 4; k++) G.box('body', 0.035, 0.003, 0.012, s0 - 0.03 - k * 0.018, y + 0.036, { r: 0.001 });
  G.box('body', 0.012, 0.02, 0.03, s0 - 0.03, y - 0.03, { r: 0.002 });
  { const sl = new THREE.TorusGeometry(0.008, 0.0018, 8, 16); sl.rotateY(Math.PI / 2); sl.translate(0, y - 0.07, -(s0 - 0.08)); G.push('steel', sl); }
  // магазин STANAG: лёгкий изгиб, рёбра, пятка
  magCurved(G, 0.072, y - 0.056, { len: 0.125, curve: 0.022, d: 0.06, w: 0.023, role: 'metal', ribs: true });
  return { trigger: [0.0, y - 0.034], gripL: [hf + hl * 0.5, hy - 0.03], muzzle: [mz + 0.05, hy], sight: y + 0.068, magTop: [0.072, y - 0.056], bolt: [-0.1, y + 0.028], scopeAt: [0.0, y + 0.04] };
}


// ---------- AWP (AWR): детальная модель ----------
function buildAWP(G) {
  const y = 0;
  // ложа-шасси: широкая, с вырезом под палец, регулируемой щекой и затыльником
  G.prof('body', [[0.34, y + 0.014], [0.34, y - 0.028], [0.1, y - 0.034], [0.07, y - 0.05], ['q', 0.04, y - 0.06, 0.03, y - 0.075], [0.01, y - 0.13], ['q', -0.01, y - 0.14, -0.04, y - 0.132], [-0.052, y - 0.075], ['q', -0.07, y - 0.06, -0.09, y - 0.058], [-0.28, y - 0.098], [-0.31, y - 0.11], [-0.33, y - 0.11], [-0.335, y + 0.016], [-0.24, y + 0.022], [-0.1, y + 0.014]], 0.044, { bevel: 0.009, seg: 14 });
  G.prof('rubber', [[-0.02, y - 0.07], ['q', -0.035, y - 0.11, -0.03, y - 0.12], [0.0, y - 0.12], ['q', 0.012, y - 0.085, 0.01, y - 0.062]], 0.046, { bevel: 0.004 });   // вырез «дыра под палец»
  G.box('body', 0.03, 0.022, 0.13, -0.24, y + 0.034, { r: 0.006 });                                  // щека
  G.cyl('steel', 0.003, 0.003, 0.03, -0.215, y + 0.012, { seg: 10 }); G.cyl('steel', 0.003, 0.003, 0.03, -0.265, y + 0.012, { seg: 10 });
  G.box('rubber', 0.047, 0.15, 0.016, -0.34, y - 0.045, { r: 0.006 });                               // затыльник
  G.box('metal', 0.012, 0.02, 0.04, -0.3, y - 0.11, { r: 0.004 });                                    // моноопора
  for (const ff of [0.14, 0.2, 0.26]) G.box('rubber', 0.045, 0.008, 0.03, ff, y - 0.012, { r: 0.002 }); // вентиляция цевья
  // ствольная коробка, затвор с рукоятью-шаром, спуск
  G.cyl('metal', 0.016, 0.016, 0.24, -0.09, y + 0.026, { seg: 24 });
  G.rail(-0.08, 0.22, y + 0.042, 0.022);
  G.cyl('steel', 0.0105, 0.0105, 0.1, -0.13, y + 0.026, { seg: 18, target: 'bolt' });
  G.box('steel', 0.045, 0.007, 0.007, -0.06, y + 0.024, { x: 0.024, target: 'bolt' });
  { const kb = new THREE.SphereGeometry(0.011, 16, 12); kb.translate(0.05, y + 0.02, 0.06); G.push('rubber', kb, 'bolt'); }
  G.prof('metal', [[0.06, y - 0.034], [0.06, y - 0.046], ['q', 0.05, y - 0.06, 0.03, y - 0.06], [-0.02, y - 0.06], [-0.02, y - 0.034], [-0.012, y - 0.034], [-0.012, y - 0.052], [0.035, y - 0.052], ['q', 0.05, y - 0.052, 0.052, y - 0.034]], 0.01, { bevel: 0.0012 });
  G.prof('steel', [[0.02, y - 0.034], ['q', 0.026, y - 0.044, 0.014, y - 0.052], [0.009, y - 0.051], ['q', 0.018, y - 0.043, 0.013, y - 0.034]], 0.006, { bevel: 0.0008 });
  G.box('metal', 0.03, 0.05, 0.075, 0.1, y - 0.06, { target: 'mag', r: 0.004 });                      // магазин
  // ствол с проточками, дульный тормоз
  G.cyl('metal', 0.0135, 0.0105, 0.44, 0.15, y + 0.026, { seg: 24 });
  for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; G.box('rubber', 0.0025, 0.0025, 0.2, 0.3, y + 0.026 + Math.sin(a) * 0.0118, { x: Math.cos(a) * 0.0118, r: 0.0006 }); }
  const mz = 0.59;
  G.lathe('metal', [[0, mz], [0.017, mz], [0.019, mz + 0.012], [0.019, mz + 0.072], [0.016, mz + 0.08], [0, mz + 0.08]], y + 0.026, { seg: 24 });
  for (let k = 0; k < 4; k++) G.box('rubber', 0.039, 0.016, 0.009, mz + 0.016 + k * 0.016, y + 0.026, { r: 0.001 });
  // сошки (сложены)
  G.box('metal', 0.03, 0.014, 0.02, 0.31, y - 0.034, { r: 0.004 });
  for (const sx of [-1, 1]) G.cyl('metal', 0.004, 0.004, 0.17, 0.32, y - 0.042, { x: sx * 0.011, seg: 10 });
  const sy = buildScopeParts(G, 0.03, y + 0.044, true);
  return { trigger: [0.02, y - 0.044], gripL: [0.24, y - 0.04], muzzle: [mz + 0.08, y + 0.026], sight: sy, magTop: [0.1, y - 0.04], bolt: [-0.08, y + 0.026] };
}

// ---------- Desert Eagle (P50): детальная модель ----------
function buildDeagle(G) {
  const y = 0;
  // массивный затвор с треугольным стволом и насечками
  G.prof('metal', [[-0.04, y], [0.215, y], [0.215, y + 0.028], [0.07, y + 0.03], [-0.04, y + 0.03]], 0.032, { bevel: 0.0025, target: 'bolt' });
  G.prof('metal', [[0.03, y + 0.03], [0.215, y + 0.03], [0.215, y + 0.042], [0.04, y + 0.042]], 0.018, { bevel: 0.0018, target: 'bolt' });
  G.box('metal', 0.012, 0.006, 0.16, 0.13, y + 0.045, { r: 0.0012, target: 'bolt' });
  for (let k = 0; k < 9; k++) G.box('rubber', 0.0335, 0.022, 0.0028, -0.03 + k * 0.0055, y + 0.016, { r: 0.0005, target: 'bolt' });
  G.box('steel', 0.016, 0.009, 0.008, -0.034, y + 0.034, { r: 0.002, target: 'bolt' });             // целик
  G.box('steel', 0.004, 0.009, 0.008, 0.2, y + 0.05, { target: 'bolt' });                              // мушка
  G.cyl('metal', 0.0085, 0.0085, 0.006, 0.212, y + 0.02, { seg: 18 });
  G.box('steel', 0.01, 0.008, 0.016, -0.02, y + 0.026, { x: 0.018, r: 0.002, target: 'bolt' });     // предохранитель
  // рамка, спусковая скоба, курок
  G.prof('body', [[-0.045, y], [0.15, y], [0.15, y - 0.016], [0.06, y - 0.018], [0.05, y - 0.022], [-0.01, y - 0.022]], 0.03, { bevel: 0.0025 });
  G.prof('body', [[0.05, y - 0.018], [0.055, y - 0.05], [0.04, y - 0.058], [-0.004, y - 0.058], [-0.004, y - 0.05], [0.036, y - 0.05], [0.042, y - 0.022]], 0.012, { bevel: 0.0015 });
  G.prof('steel', [[0.024, y - 0.022], ['q', 0.028, y - 0.034, 0.018, y - 0.044], [0.014, y - 0.043], ['q', 0.022, y - 0.034, 0.018, y - 0.022]], 0.006, { bevel: 0.0008 });
  G.prof('steel', [[-0.046, y + 0.004], [-0.058, y + 0.02], [-0.054, y + 0.026], [-0.044, y + 0.012]], 0.012, { bevel: 0.0012 });
  // рукоять с резиновыми щёчками
  G.prof('body', [[0.0, y - 0.02], ['q', -0.002, y - 0.075, -0.016, y - 0.13], [-0.066, y - 0.13], ['q', -0.064, y - 0.07, -0.05, y - 0.016]], 0.03, { bevel: 0.006, seg: 14 });
  for (const sx of [-1, 1]) G.prof('rubber', [[-0.006, y - 0.03], ['q', -0.008, y - 0.075, -0.02, y - 0.12], [-0.058, y - 0.12], ['q', -0.056, y - 0.07, -0.046, y - 0.03]], 0.004, { x: sx * 0.016, bevel: 0.0015 });
  G.box('metal', 0.032, 0.008, 0.052, -0.04, y - 0.134, { r: 0.002, target: 'mag' });
  return { trigger: [0.02, y - 0.03], gripL: [-0.02, y - 0.07], muzzle: [0.225, y + 0.02], sight: y + 0.044, magTop: [-0.034, y - 0.12], bolt: [0.08, y + 0.02] };
}

// ---------- Глок (P9): детальная модель ----------
function buildGlock(G) {
  const y = 0;
  G.box('metal', 0.0255, 0.03, 0.188, 0.054, y + 0.015, { r: 0.0035, target: 'bolt' });
  for (let k = 0; k < 7; k++) G.box('rubber', 0.0262, 0.022, 0.0026, -0.032 + k * 0.0052, y + 0.016, { r: 0.0005, target: 'bolt' });
  G.box('rubber', 0.0006, 0.012, 0.045, 0.06, y + 0.019, { x: 0.0128, target: 'bolt' });              // окно выброса
  G.box('steel', 0.016, 0.007, 0.008, -0.034, y + 0.033, { r: 0.0015, target: 'bolt' }); G.box('steel', 0.004, 0.006, 0.006, 0.14, y + 0.033, { target: 'bolt' });
  G.cyl('metal', 0.0065, 0.0065, 0.006, 0.146, y + 0.016, { seg: 16 });
  // рамка из полимера с планкой и выступом под указательный
  G.prof('body', [[-0.042, y], [0.145, y], [0.145, y - 0.012], [0.07, y - 0.014], [0.055, y - 0.018], [-0.008, y - 0.018]], 0.024, { bevel: 0.003 });
  G.rail(0.075, 0.06, y - 0.02, 0.016);
  G.prof('body', [[0.052, y - 0.014], ['q', 0.054, y - 0.04, 0.042, y - 0.044], [-0.002, y - 0.044], [-0.002, y - 0.038], [0.04, y - 0.038], ['q', 0.046, y - 0.036, 0.046, y - 0.014]], 0.012, { bevel: 0.0015 });
  G.prof('steel', [[0.022, y - 0.018], ['q', 0.026, y - 0.028, 0.017, y - 0.036], [0.013, y - 0.035], ['q', 0.02, y - 0.028, 0.016, y - 0.018]], 0.0055, { bevel: 0.0008 });
  // рукоять с текстурой и подпальцевыми выемками
  G.prof('body', [[0.004, y - 0.016], ['q', 0.004, y - 0.03, -0.002, y - 0.04], ['q', 0.004, y - 0.052, -0.004, y - 0.064], ['q', 0.002, y - 0.078, -0.01, y - 0.106], [-0.054, y - 0.108], ['q', -0.054, y - 0.06, -0.044, y - 0.012], ['q', -0.05, y - 0.004, -0.054, y + 0.004], [-0.04, y + 0.002]], 0.026, { bevel: 0.005, seg: 14 });
  for (let k = 0; k < 6; k++) for (const sx of [-1, 1]) G.box('rubber', 0.002, 0.008, 0.034, -0.026 - k * 0.0012, y - 0.03 - k * 0.012, { x: sx * 0.0128, r: 0.0008 });
  G.box('metal', 0.026, 0.006, 0.046, -0.03, y - 0.11, { r: 0.002, target: 'mag' });
  return { trigger: [0.02, y - 0.026], gripL: [-0.02, y - 0.06], muzzle: [0.15, y + 0.016], sight: y + 0.038, magTop: [-0.028, y - 0.1], bolt: [0.05, y + 0.015] };
}

// ---------- Каталог ----------
const SPEC = {
  p9: ['glock', {}, 0.88], p18: ['makarov', {}, 0.92], p92: ['beretta', {}, 0.9], p50: ['deagle', {}, 0.86],
  mx9: ['mp5', {}, 0.78], uz9: ['smg', 'uzi', 0.8], vx45: ['smg', 'vector', 0.8], pp19: ['smg', 'bizon', 0.72],
  ar4: ['m4', {}, 0.8], br17: ['ar', { hgLen: 0.3, barrelOut: 0.08, muzzle: 'brake', magLen: 0.1 }, 0.78],
  ak: ['ak47', {}, 0.74], akb: ['ak47', { furn: 'body', stock: 'fold', brake: '74', magRole: 'body' }, 0.74],
  sv98: ['sniper', 'bolt', 0.78], awr: ['awp', {}, 0.78], dmr: ['sniper', 'dmr', 0.76], svd: ['svd', {}, 0.7],
  sg12: ['pump', false, 0.8], dp12: ['pump', true, 0.8], as20: ['shotgun', 'aa12', 0.82], sai12: ['shotgun', 'saiga', 0.76],
};
export const hasProcGun = (id) => !!SPEC[id];

const GEO_CACHE = new Map();
// Геометрия по ролям (кэш на id): { roles: { 'role' | 'mag:role' ... : geometry }, meta }
export function procGunGeometry(id) {
  if (GEO_CACHE.has(id)) return GEO_CACHE.get(id);
  const [fam, opt, S] = SPEC[id];
  const G = new GB();
  const r = fam === 'ak47' ? buildAK47(G, opt) : fam === 'm4' ? buildM4(G) : fam === 'awp' ? buildAWP(G) : fam === 'deagle' ? buildDeagle(G) : fam === 'glock' ? buildGlock(G) : fam === 'mp5' ? buildMP5(G) : fam === 'beretta' ? buildBeretta(G) : fam === 'makarov' ? buildMakarov(G) : fam === 'svd' ? buildSVD(G) : fam === 'pump' ? buildPump(G, opt) : fam === 'pistol' ? buildPistol(G, opt) : fam === 'smg' ? buildSMG(G, opt) : fam === 'ar' ? buildAR(G, opt) : fam === 'ak' ? buildAK(G, opt) : fam === 'sniper' ? buildSniper(G, opt) : buildShotgun(G, opt);
  // точка отсчёта — спусковой крючок; масштаб до размеров игры
  const [tf, ty] = r.trigger;
  const isPistolFam = ['pistol', 'deagle', 'glock', 'beretta', 'makarov'].includes(fam);
  const m = new THREE.Matrix4().makeScale(S, S, S).multiply(new THREE.Matrix4().makeTranslation(0, -ty, tf));
  const roles = {};
  const box = new THREE.Box3();
  for (const [key, list] of Object.entries(G.parts)) {
    const g = mergeGeometries(list, false); g.applyMatrix4(m); g.computeBoundingBox(); box.union(g.boundingBox);
    const p = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, -p.getZ(i) * UVK, p.getY(i) * UVK + p.getX(i) * 0.5);
    uv.needsUpdate = true;
    roles[key] = g;
  }
  const P = (a, b = 0) => new THREE.Vector3(0, a[1], -a[0]).applyMatrix4(m).add(new THREE.Vector3(0, b, 0));
  const meta = {
    box, length: box.max.z - box.min.z,
    muzzle: P(r.muzzle), gripR: P([tf - 0.045 * (isPistolFam ? 0.6 : 1), ty - (isPistolFam ? 0.04 : 0.05)]),
    gripL: P(r.gripL), sightY: r.sight !== null && r.sight !== undefined ? (r.sight - ty) * S : null,
    magTop: r.magTop ? P(r.magTop) : null, bolt: r.bolt ? P(r.bolt) : null, scopeAt: r.scopeAt ? P(r.scopeAt) : null,
  };
  const res = { roles, meta };
  GEO_CACHE.set(id, res);
  return res;
}
