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
  prof(role, pts, thick, { x = 0, bevel = 0.0015, seg = 10, target } = {}) {
    const s = new THREE.Shape();
    pts.forEach((p, i) => { if (p[0] === 'q') s.quadraticCurveTo(p[1], p[2], p[3], p[4]); else if (i === 0) s.moveTo(p[0], p[1]); else s.lineTo(p[0], p[1]); });
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

// ---------- Каталог ----------
const SPEC = {
  p9: ['pistol', 'glock', 0.88], p18: ['pistol', 'makarov', 0.86], p92: ['pistol', 'beretta', 0.9], p50: ['pistol', 'deagle', 0.86],
  mx9: ['smg', 'mp5', 0.78], uz9: ['smg', 'uzi', 0.8], vx45: ['smg', 'vector', 0.8], pp19: ['smg', 'bizon', 0.72],
  ar4: ['ar', {}, 0.78], br17: ['ar', { hgLen: 0.3, barrelOut: 0.08, muzzle: 'brake', magLen: 0.1 }, 0.78],
  ak: ['ak', {}, 0.74], akb: ['ak', { wood: false, stock: 'skeleton', muzzle: 'brake' }, 0.74],
  sv98: ['sniper', 'bolt', 0.78], awr: ['sniper', 'awp', 0.78], dmr: ['sniper', 'dmr', 0.76], svd: ['sniper', 'svd', 0.7],
  sg12: ['shotgun', 'pumpWood', 0.8], dp12: ['shotgun', 'pumpTac', 0.8], as20: ['shotgun', 'aa12', 0.82], sai12: ['shotgun', 'saiga', 0.76],
};
export const hasProcGun = (id) => !!SPEC[id];

const GEO_CACHE = new Map();
// Геометрия по ролям (кэш на id): { roles: { 'role' | 'mag:role' ... : geometry }, meta }
export function procGunGeometry(id) {
  if (GEO_CACHE.has(id)) return GEO_CACHE.get(id);
  const [fam, opt, S] = SPEC[id];
  const G = new GB();
  const r = fam === 'pistol' ? buildPistol(G, opt) : fam === 'smg' ? buildSMG(G, opt) : fam === 'ar' ? buildAR(G, opt) : fam === 'ak' ? buildAK(G, opt) : fam === 'sniper' ? buildSniper(G, opt) : buildShotgun(G, opt);
  // точка отсчёта — спусковой крючок; масштаб до размеров игры
  const [tf, ty] = r.trigger;
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
    muzzle: P(r.muzzle), gripR: P([tf - 0.045 * (fam === 'pistol' ? 0.6 : 1), ty - (fam === 'pistol' ? 0.04 : 0.05)]),
    gripL: P(r.gripL), sightY: r.sight !== null && r.sight !== undefined ? (r.sight - ty) * S : null,
    magTop: r.magTop ? P(r.magTop) : null, bolt: r.bolt ? P(r.bolt) : null, scopeAt: r.scopeAt ? P(r.scopeAt) : null,
  };
  const res = { roles, meta };
  GEO_CACHE.set(id, res);
  return res;
}
