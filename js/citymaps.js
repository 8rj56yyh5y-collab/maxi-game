// Городские карты: Токио, Старый город, Бруклин, Санторини, Париж, Киото, Майами.
import * as THREE from 'three';
import {
  cityBuilding, road, sidewalk, streetLamp, tree, car, vending, powerPole, wires, lanternString, torii, stoneLantern,
  bench, umbrellaTable, fountain, bunting, billboard, hydrant, dumpster, facade, fbox, palmTree,
} from './city.js';

const BOUNDS = [-40, -30, 40, 30];
const SPAWNS = {
  A: [[-37, -6], [-37, -2], [-37, 2], [-37, 6], [-35, 0], [-38, 4], [-38, -4]],
  B: [[37, -6], [37, -2], [37, 2], [37, 6], [35, 0], [38, 4], [38, -4]],
};
const POINTS = [[0, 22], [0, -21], [0, 0], [-20, 0], [20, 0], [-20, 22], [20, 22], [-20, -21], [20, -21], [-10, 11], [10, 11], [-10, -11], [10, -11]];

// Периметр: ряд домов за границей карты, фасадами внутрь
function perimeterBuildings(style, R, hMin, hMax, opts = {}) {
  const list = [];
  const [x1, z1, x2, z2] = BOUNDS;
  const run = (from, to, mk) => { let a = from; while (a < to) { const w = Math.min(to - a, 7 + R() * 7); if (to - a - w < 4) { mk(a, to); break; } mk(a, a + w); a += w; } };
  if (!opts.skipNorth) run(x1 - 9, x2 + 9, (a, b) => list.push([a, z2, b, z2 + 9, hMin + R() * (hMax - hMin), 'bld:' + style]));
  if (!opts.skipSouth) run(x1 - 9, x2 + 9, (a, b) => list.push([a, z1 - 9, b, z1, hMin + R() * (hMax - hMin), 'bld:' + style]));
  run(z1, z2, (a, b) => list.push([x1 - 9, a, x1, b, hMin + R() * (hMax - hMin), 'bld:' + style]));
  run(z1, z2, (a, b) => list.push([x2, a, x2 + 9, b, hMin + R() * (hMax - hMin), 'bld:' + style]));
  return list;
}

// Дальний горизонт: силуэты высоток
function skyline(B, R, count, hMin, hMax, dist = 70) {
  for (let i = 0; i < count; i++) {
    const a = i / count * Math.PI * 2 + R() * 0.1, r = dist + R() * 40;
    const x = Math.cos(a) * r * 1.25, z = Math.sin(a) * r;
    const w = 8 + R() * 14, d = 8 + R() * 14, h = hMin + R() * (hMax - hMin);
    B.box(x - w / 2, 0, z - d / 2, x + w / 2, h, z + d / 2, 'skyline');
  }
}

function placeBuildings(B, list, ctx) {
  const inside = (px, pz) => px > BOUNDS[0] && px < BOUNDS[2] && pz > BOUNDS[1] && pz < BOUNDS[3];
  for (const b of list) {
    const exposed = (side) => {
      const [x1, z1, x2, z2] = b;
      const probe = [[(x1 + x2) / 2, z1 - 0.6], [x2 + 0.6, (z1 + z2) / 2], [(x1 + x2) / 2, z2 + 0.6], [x1 - 0.6, (z1 + z2) / 2]][side];
      if (!inside(probe[0], probe[1])) return false;
      for (const o of list) if (o !== b && probe[0] > o[0] && probe[0] < o[2] && probe[1] > o[1] && probe[1] < o[3]) return false;
      return true;
    };
    cityBuilding(B, b, { ...ctx, exposed });
  }
}

// =============== ТОКИО ===============
function buildTokyo(B, group, ctx) {
  const R = ctx.R;
  const inner = [
    [-27, 7, -12, 15, 13, 'bld:tokyo'], [-8, 7, 8, 15, 20, 'bld:tokyo'], [12, 7, 27, 15, 11, 'bld:tokyo'],
    [-27, -15, -13, -7, 10, 'bld:tokyo'], [-8, -15, 8, -7, 15, 'bld:tokyo'], [13, -15, 27, -7, 12, 'bld:tokyo'],
    [-40, -30, -32, -22, 8, 'bld:tokyo'], [32, 22, 40, 30, 8, 'bld:tokyo'], [-40, 22, -33, 30, 9, 'bld:tokyo'], [33, -30, 40, -22, 9, 'bld:tokyo'],
  ];
  const list = [...inner, ...perimeterBuildings('tokyo', R, 9, 24)];
  placeBuildings(B, list, ctx);
  skyline(B, R, 40, 30, 90);
  // главная улица
  road(B, -40, -3.6, 40, 3.6, ctx, { zebra: -10 });
  road(B, -40, -3.6, 40, 3.6, ctx, { zebra: 10 });
  sidewalk(B, -40, 3.6, 40, 7); sidewalk(B, -40, -7, 40, -3.6);
  const cars = [[-22, 2, 0, 'taxiJP'], [-6, -2.1, Math.PI, 'kei'], [5, 2.1, 0, 'van'], [19, -2, Math.PI, 'sedan'], [28, 2.2, 0, 'taxiJP']];
  for (const [x, z, ry, k] of cars) car(B, x, z, ry, ctx, k);
  // автоматы, столбы, провода
  for (const [x, z, ry] of [[-30, 6.4, Math.PI], [-29, 6.4, Math.PI], [16, -6.4, 0], [17.1, -6.4, 0], [-15, -6.4, 0], [24, 6.4, Math.PI]]) vending(B, x, z, ry, ctx);
  const tops = [];
  for (let x = -34; x <= 34; x += 12) tops.push(powerPole(B, x, 6.6, 9));
  for (let i = 1; i < tops.length; i++) wires(B, tops[i - 1], tops[i], 3, 0.8);
  const tops2 = [];
  for (let x = -28; x <= 34; x += 14) tops2.push(powerPole(B, x, -6.6, 8.5));
  for (let i = 1; i < tops2.length; i++) wires(B, tops2[i - 1], tops2[i], 2, 0.7);
  for (let i = 0; i < Math.min(tops.length, 4); i++) wires(B, tops[i], [tops[i][0] + 2, 8, -6.6], 1, 0.9);
  for (const x of [-26, -2, 22]) streetLamp(B, x, -4.2, ctx, 'modern', 0);
  for (const x of [-14, 10, 34]) streetLamp(B, x, 4.2, ctx, 'modern', Math.PI);
  // переулок «ёкотё» (север)
  for (let x = -34; x <= 34; x += 5) lanternString(B, [x, 4.2, 15], [x + 1.5, 4.4, 30], 8, ctx);
  for (const [x, z] of [[-18, 25], [-5, 20], [8, 26], [22, 19], [30, 24]]) B.box(x - 0.6, 0, z - 0.6, x + 0.6, 1.1, z + 0.6, 'T|wood|c09060|1', true);
  for (const [x, z] of [[-24, 19], [15, 27]]) { B.box(x - 1.4, 0, z - 0.5, x + 1.4, 1.0, z + 0.5, 'T|wood3|6a4a30|1.5', true); }
  for (const x of [-30, 0, 30]) streetLamp(B, x, 29, ctx, 'modern', Math.PI);
  // святилище (юг)
  B.box(-40, 0, -30, 40, 0.03, -15, 'T|ground3|b8ab94|4');
  B.box(-40, 0, -16, 40, 0.05, -15, 'T|concrete|a8a49a|2');
  for (const x of [-26, -10, 10, 26]) torii(B, x, -21, Math.PI / 2, 1);
  for (const x of [-30, -18, -4, 4, 18, 30]) { stoneLantern(B, x, -18, ctx); stoneLantern(B, x, -24.5, ctx); }
  for (const [x, z] of [[-33, -27], [-22, -27.5], [-14, -18], [14, -27], [24, -18], [33, -27], [-6, -28], [6, -18]]) tree(B, x, z, ctx, 'sakura', 1.1);
  // маленький храм
  B.box(-3, 0, -29.5, 3, 3.2, -25, 'T|wood3|7a4a2a|1.5', true);
  B.box(-3.5, 3.2, -30, 3.5, 3.5, -24.5, 'flat|1a1a1a|0.6');
  const roofS = new THREE.Shape(); roofS.moveTo(-4, 0); roofS.lineTo(4, 0); roofS.lineTo(0, 2); roofS.closePath();
  const rg = new THREE.ExtrudeGeometry(roofS, { depth: 6.4, bevelEnabled: false }); rg.translate(0, 0, -3.2); rg.rotateY(Math.PI / 2);
  const uv = rg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 1.6, uv.getY(i) / 1.6);
  rg.translate(0, 3.5, -27.25); B.push('roofTileJp', rg);
  // рекламные щиты на крышах
  billboard(B, 0, 23.5, 7.5, 0, 10, 4.5, 2);
  billboard(B, -20, 17, 15.4, Math.PI, 8, 3.5, 0);
  billboard(B, 20, 15.5, -15.4, 0, 8, 3.5, 1);
}

// =============== СТАРЫЙ ГОРОД ===============
function buildOldTown(B, group, ctx) {
  const R = ctx.R;
  const inner = [
    [-27, 7, -12, 15, 11, 'bld:euro'], [12, 7, 27, 15, 10, 'bld:euro'],
    [-27, -15, -13, -7, 9, 'bld:euro'], [-8, -15, 8, -7, 12, 'bld:euro'], [13, -15, 27, -7, 10, 'bld:euro'],
    [-40, 22, -32, 30, 9, 'bld:euro'], [32, 22, 40, 30, 9, 'bld:euro'],
  ];
  const list = [...inner, ...perimeterBuildings('euro', R, 8, 14, { skipSouth: true })];
  placeBuildings(B, list, ctx);
  // церковь с башней
  B.box(-7, 0, 8, 7, 9, 15, 'T|bricks2|e0d4c0|2.4', true);
  const s = new THREE.Shape(); s.moveTo(-3.9, 0); s.lineTo(3.9, 0); s.lineTo(0, 4); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 14.6, bevelEnabled: false }); g.translate(0, 0, -7.3); g.rotateY(Math.PI / 2);
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 1.6, uv.getY(i) / 1.6);
  g.translate(0, 9, 11.5); B.push('roofTile', g);
  B.colliders.push({ min: [-7, 9, 8], max: [7, 11, 15] });
  B.box(-2.5, 0, 6.2, 2.5, 21, 9.5, 'T|bricks2|e8dcc8|2.4', true);
  const spire = new THREE.ConeGeometry(2.4, 8, 4); spire.rotateY(Math.PI / 4); spire.translate(0, 25, 7.85); B.push('roofTileJp', spire);
  const cf = new THREE.CircleGeometry(1.1, 32); cf.rotateY(Math.PI); cf.translate(0, 17.5, 6.15); B.push('clock', cf);
  const fN = facade(-2.5, 6.2, 2.5, 9.5, 0);
  fbox(B, fN, 1.6, 3.4, 0, 3.6, 0, 0.1, 'T|wood3|5a3a24|1.5');
  for (const y of [7, 11]) fbox(B, fN, 2.1, 2.9, y, y + 2, 0, 0.05, 'glass');
  // брусчатка
  B.box(-40, 0, -30, 40, 0.02, 30, 'T|bricks2|cfc6b8|1.6');
  fountain(B, 0, 0, 2.6, ctx);
  for (const [x, z, c] of [[-14, 4.5, 'cloth'], [-10, 4.5, 'cloth_g'], [10, 4.5, 'cloth_b'], [14, 4.5, 'cloth'], [-14, -4.5, 'cloth_b'], [14, -4.5, 'cloth_g']]) umbrellaTable(B, x, z, c, ctx);
  for (const x of [-30, -20, 20, 30]) for (const z of [-5.5, 5.5]) streetLamp(B, x, z, ctx, 'euro');
  for (const [x, z] of [[-6, 4], [6, -4], [-6, -4], [6, 4]]) B.box(x - 0.5, 0, z - 0.5, x + 0.5, 0.7, z + 0.5, 'T|concrete3|e0d6c2|1', true);
  for (const [x, z] of [[-6, 4], [6, -4], [-6, -4], [6, 4]]) tree(B, x, z, ctx, 'green', 0.7);
  // северная улочка: флажки, бочки, ящики
  for (let x = -32; x <= 32; x += 8) bunting(B, [x, 6.5, 15], [x + 3, 6.8, 30], 9);
  for (const [x, z] of [[-20, 24], [-6, 19.5], [8, 26], [20, 20], [28, 25]]) B.box(x - 0.6, 0, z - 0.6, x + 0.6, 1.1, z + 0.6, 'T|wood|b88a5a|1', true);
  for (const [x, z] of [[-14, 27], [14, 18]]) { const bg = new THREE.CylinderGeometry(0.4, 0.4, 1.1, 14); bg.translate(x, 0.55, z); B.push('T|wood3|6a4a30|1.5', bg); B.colliders.push({ min: [x - 0.4, 0, z - 0.4], max: [x + 0.4, 1.1, z + 0.4] }); }
  for (const x of [-25, 0, 25]) streetLamp(B, x, 28.6, ctx, 'euro');
  // набережная (юг): канал и деревья
  B.box(-60, -2, -60, 60, -0.6, -25.6, 'T|bricks2|8a8274|2');
  const water = new THREE.PlaneGeometry(140, 40); water.rotateX(-Math.PI / 2); water.translate(0, -0.5, -45); B.push('water', water);
  B.box(-40, 0, -25.8, 40, 1.0, -25.2, 'T|concrete3|e0d6c2|2', true);
  B.colliders.push({ min: [-40, 0, -31], max: [40, 3, -25.8] });
  for (let x = -34; x <= 34; x += 10) { tree(B, x, -18, ctx, 'green', 1.1); streetLamp(B, x + 5, -24.6, ctx, 'euro'); }
  for (const x of [-28, -8, 12, 30]) bench(B, x, -23.6, 0);
  // дома за каналом
  for (let x = -60; x < 60; x += 9 + R() * 4) B.box(x, -0.6, -70, x + 8, 8 + R() * 8, -60, ['T|plaster|f2d79c|3.5', 'T|plaster|f0c0a8|3.5', 'T|plaster|c8dbe8|3.5', 'T|plaster3|e8c48a|3.5'][Math.floor(R() * 4)]);
  skyline(B, R, 0, 0, 0);
}

// =============== БРУКЛИН ===============
function buildBrooklyn(B, group, ctx) {
  const R = ctx.R;
  const inner = [
    [-27, 7, -12, 15, 16, 'bld:ny'], [-8, 7, 8, 15, 22, 'bld:ny'], [12, 7, 27, 15, 15, 'bld:ny'],
    [-27, -15, -13, -7, 14, 'bld:ny'], [-8, -15, 8, -7, 18, 'bld:ny'], [13, -15, 27, -7, 13, 'bld:ny'],
    [-40, 22, -32, 30, 12, 'bld:ny'], [32, 22, 40, 30, 12, 'bld:ny'], [-40, -30, -33, -22, 12, 'bld:ny'], [33, -30, 40, -22, 12, 'bld:ny'],
  ];
  const list = [...inner, ...perimeterBuildings('ny', R, 14, 34)];
  placeBuildings(B, list, ctx);
  skyline(B, R, 46, 50, 140, 80);
  road(B, -40, -4, 40, 4, ctx, { yellow: true, zebra: -10 });
  road(B, -40, -4, 40, 4, ctx, { yellow: true, zebra: 10 });
  sidewalk(B, -40, 4, 40, 7, 'T|concrete|c8c2b6|2.5'); sidewalk(B, -40, -7, 40, -4, 'T|concrete|c8c2b6|2.5');
  for (const [x, z, ry, k] of [[-24, 2.3, 0, 'taxiNY'], [-14, -2.3, Math.PI, 'sedan'], [-2, 2.3, 0, 'taxiNY'], [6, -2.3, Math.PI, 'van'], [17, 2.3, 0, 'sedan'], [27, -2.3, Math.PI, 'taxiNY']]) car(B, x, z, ry, ctx, k);
  for (const x of [-32, -18, -4, 12, 26]) { hydrant(B, x, 4.6); }
  for (const x of [-28, -8, 14, 30]) streetLamp(B, x, 4.4, ctx, 'modern', Math.PI);
  for (const x of [-20, 2, 22]) streetLamp(B, x, -4.4, ctx, 'modern', 0);
  for (const x of [-26, 8, 22]) tree(B, x, -5.6, ctx, 'green', 0.8);
  // переулок (север)
  for (const [x, z, ry] of [[-20, 17, 0], [-2, 28.4, 0], [16, 17, 0], [26, 28.4, 0]]) dumpster(B, x, z, ry);
  for (const [x, z] of [[-30, 24], [-10, 21], [6, 24], [30, 19]]) B.box(x - 0.6, 0, z - 0.6, x + 0.6, 1.2, z + 0.6, 'T|wood|a08060|1', true);
  for (const x of [-34, -14, 10, 34]) streetLamp(B, x, 29, ctx, 'modern', Math.PI);
  // забор из сетки
  for (const x of [-12, 12]) { B.box(x - 0.05, 0, 15, x + 0.05, 3, 19, 'iron', true); }
  // парк (юг)
  B.box(-32, 0, -29, 32, 0.04, -16, 'T|ground2|9ab070|4');
  for (let x = -28; x <= 28; x += 8) { tree(B, x, -19.5, ctx, 'green', 1.25); tree(B, x + 4, -26, ctx, 'green', 1.1); }
  for (const x of [-24, -8, 8, 24]) bench(B, x, -22.8, Math.PI);
  for (const x of [-30, 0, 30]) streetLamp(B, x, -16.5, ctx, 'euro');
  billboard(B, 0, 27, 7.4, 0, 12, 5, 0);
  billboard(B, -20, 19.5, -15.4, 0, 9, 4, 3);
}

// =============== САНТОРИНИ ===============
function buildSantorini(B, group, ctx) {
  const R = ctx.R;
  const inner = [];
  const row = (z1, z2, from, to, gaps) => { let a = from; for (const [g0, g1] of [...gaps, [to, to]]) { while (a < g0 - 2) { const w = Math.min(g0 - a, 4 + R() * 4); inner.push([a, z1, a + w, z2, 3.4 + R() * 4.5, 'bld:santorini']); a += w; } a = g1; } };
  row(7, 15, -27, 27, [[-12, -8], [8, 12]]);
  row(-15, -7, -27, 27, [[-13, -8], [8, 13]]);
  inner.push([-40, 22, -32, 30, 6, 'bld:santorini'], [32, 22, 40, 30, 6, 'bld:santorini'], [-40, -30, -33, -24, 5, 'bld:santorini'], [33, -30, 40, -24, 5, 'bld:santorini']);
  const per = perimeterBuildings('santorini', R, 4, 9, { skipSouth: true });
  placeBuildings(B, [...inner, ...per], ctx);
  B.box(-40, 0, -30, 40, 0.02, 30, 'T|concrete2|f2efe8|3');
  // каменные дорожки
  B.box(-40, 0.02, -2.2, 40, 0.04, 2.2, 'T|bricks2|f4efe4|1.6');
  // южный край — обрыв к морю с белым парапетом
  B.box(-40, 0, -30.6, 40, 1.1, -30, 'T|plaster2|ffffff|3', true);
  B.colliders.push({ min: [-40, 0, -31], max: [40, 3, -30] });
  const sea = new THREE.PlaneGeometry(900, 500); sea.rotateX(-Math.PI / 2); sea.translate(0, -60, -280); B.push('water', sea);
  B.box(-80, -60, -60, 80, -0.5, -31, 'T|rock|a89880|6');
  for (let i = 0; i < 6; i++) { const x = -60 + i * 25 + R() * 8; B.box(x, -60, -130 - R() * 60, x + 20 + R() * 15, -40 + R() * 12, -110 - R() * 30, 'T|rock|8a7a68|8'); }
  // ветряная мельница
  const mill = new THREE.CylinderGeometry(2, 2.4, 8, 16); mill.translate(48, 4, 40); B.push('T|plaster2|ffffff|3', mill);
  const mc = new THREE.ConeGeometry(2.4, 2.4, 16); mc.translate(48, 9.2, 40); B.push('roofTile', mc);
  for (let k = 0; k < 4; k++) { const bl = new THREE.BoxGeometry(0.3, 6, 0.05); bl.rotateZ(k * Math.PI / 2 + 0.3); bl.translate(48, 8, 37.4); B.push('T|wood3|c0a080|1.5', bl); }
  // укрытия: низкие белые стены, кадки, оливы, бугенвиллея
  for (const [x1, z1, x2, z2] of [[-20, -2.5, -16, -1.8], [16, 1.8, 20, 2.5], [-4, 4, 4, 4.6], [-4, -4.6, 4, -4], [-28, 3, -27.4, 6], [27.4, -6, 28, -3]]) B.box(x1, 0, z1, x2, 1.1, z2, 'T|plaster2|ffffff|3', true);
  for (const [x, z] of [[-24, 21], [-8, 26], [10, 19], [24, 25], [-18, -20], [0, -24], [18, -19], [30, -26], [-30, -26]]) tree(B, x, z, ctx, R() < 0.5 ? 'olive' : 'sakura', 0.9);
  for (const [x, z, c] of [[-14, 22, 'cloth_b'], [14, 22, 'cloth_b'], [-10, -22, 'cloth_b'], [10, -22, 'cloth_b'], [-24, -22, 'cloth_b']]) umbrellaTable(B, x, z, c, ctx);
  for (const x of [-26, 0, 26]) { const p = new THREE.CylinderGeometry(0.45, 0.35, 0.8, 12); p.translate(x, 0.4, 5.5); B.push('flat|c06a40|0.8', p); }
  for (const x of [-30, -10, 10, 30]) streetLamp(B, x, -29.5, ctx, 'euro');
}


// =============== ПАРИЖ ===============
function eiffel(B, x, z, s) {
  const lvl = [[0, 9, 2.6], [2.6, 5.2, 5.6], [5.6, 2.4, 9.2], [9.2, 1.1, 14.5], [14.5, 0.25, 16.5]];
  for (const [y0, w0, y1] of lvl) {
    const w1 = w0 * (y1 >= 14.5 ? 0.25 : 0.62);
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const a = new THREE.Vector3(x + sx * w0 * s, y0 * s, z + sz * w0 * s), b = new THREE.Vector3(x + sx * w1 * s, y1 * s, z + sz * w1 * s);
      const len = a.distanceTo(b), g = new THREE.BoxGeometry(0.9 * s * (w0 / 9 + 0.15), len, 0.9 * s * (w0 / 9 + 0.15));
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()));
      g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2); B.push('flat|5a4a3a|0.7|0.5', g);
    }
    if (y1 < 14) B.box(x - w1 * s * 1.15, y1 * s - 0.3 * s, z - w1 * s * 1.15, x + w1 * s * 1.15, y1 * s, z + w1 * s * 1.15, 'flat|5a4a3a|0.7|0.5');
  }
  const ar = new THREE.TorusGeometry(5.2 * s, 0.35 * s, 6, 24, Math.PI); ar.translate(x, 0, z - 7 * s); B.push('flat|5a4a3a|0.7|0.5', ar);
  const ar2 = ar.clone(); ar2.translate(0, 0, 14 * s); B.push('flat|5a4a3a|0.7|0.5', ar2);
  const tip = new THREE.SphereGeometry(0.5 * s, 8, 6); tip.translate(x, 16.6 * s, z); B.push('glowc|fff0c0|6', tip);
}
function buildParis(B, group, ctx) {
  const R = ctx.R;
  const inner = [
    [-27, 7, -12, 15, 16, 'bld:paris'], [-8, 7, 8, 15, 18, 'bld:paris'], [12, 7, 27, 15, 16, 'bld:paris'],
    [-27, -15, -13, -7, 15, 'bld:paris'], [13, -15, 27, -7, 15, 'bld:paris'],
    [-40, 22, -32, 30, 15, 'bld:paris'], [32, 22, 40, 30, 15, 'bld:paris'], [-40, -30, -33, -22, 14, 'bld:paris'], [33, -30, 40, -22, 14, 'bld:paris'],
  ];
  placeBuildings(B, [...inner, ...perimeterBuildings('paris', R, 15, 19)], ctx);
  eiffel(B, -30, 150, 9);
  skyline(B, R, 30, 14, 26, 90);
  // бульвар с платанами
  road(B, -40, -3.4, 40, 3.4, ctx, { zebra: -10 });
  road(B, -40, -3.4, 40, 3.4, ctx, { zebra: 10 });
  sidewalk(B, -40, 3.4, 40, 7, 'T|concrete3|d8d0c0|2.5'); sidewalk(B, -40, -7, 40, -3.4, 'T|concrete3|d8d0c0|2.5');
  for (let x = -34; x <= 34; x += 9) { tree(B, x, 5.6, ctx, 'green', 1.15); tree(B, x + 4.5, -5.6, ctx, 'green', 1.1); }
  for (let x = -30; x <= 30; x += 12) { streetLamp(B, x, 4.0, ctx, 'euro'); streetLamp(B, x + 6, -4.0, ctx, 'euro'); }
  for (const [x, z, ry, k] of [[-20, 1.9, 0, 'sedan'], [-4, -1.9, Math.PI, 'kei'], [8, 1.9, 0, 'van'], [24, -1.9, Math.PI, 'sedan']]) car(B, x, z, ry, ctx, k);
  // кафе на тротуаре (север)
  for (const [x, c] of [[-24, 'cloth'], [-20, 'cloth'], [14, 'cloth_g'], [18, 'cloth_g'], [22, 'cloth_g']]) umbrellaTable(B, x, 18, c, ctx);
  // площадь с фонтаном и газонами (юг)
  B.box(-12, 0, -30, 12, 0.03, -7, 'T|ground3|d8c8a0|4');
  fountain(B, 0, -18, 3, ctx);
  for (const [x1, z1, x2, z2] of [[-11, -28, -5, -24], [5, -28, 11, -24], [-11, -12, -5, -8.5], [5, -12, 11, -8.5]]) { B.box(x1, 0, z1, x2, 0.6, z2, 'T|concrete3|e8e0cc|1', true); B.box(x1 + 0.2, 0.6, z1 + 0.2, x2 - 0.2, 0.7, z2 - 0.2, 'T|ground2|7aa050|3'); }
  for (const x of [-8, 8]) for (const z of [-26, -10]) tree(B, x, z, ctx, 'green', 0.8);
  for (const x of [-10, 10]) bench(B, x, -18, Math.PI / 2 * Math.sign(x));
  for (const x of [-28, -18, 18, 28]) { B.box(x - 0.5, 0, -22 - 0.5, x + 0.5, 1.2, -22 + 0.5, 'T|wood|b88a5a|1', true); }
  // колонна Морриса и киоски
  for (const [x, z] of [[-14, 5.2], [14, -5.2]]) { const c = new THREE.CylinderGeometry(0.7, 0.7, 3, 16); c.translate(x, 1.5, z); B.push('flat|2e5a3a|0.5|0.3', c); const d = new THREE.SphereGeometry(0.75, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2); d.translate(x, 3, z); B.push('flat|2e5a3a|0.5|0.3', d); B.colliders.push({ min: [x - 0.7, 0, z - 0.7], max: [x + 0.7, 3.6, z + 0.7] }); }
  for (const x of [-30, 0, 30]) streetLamp(B, x, 28.6, ctx, 'euro');
  for (let x = -32; x <= 32; x += 8) bunting(B, [x, 6, 15], [x + 3, 6.4, 30], 9);
  billboard(B, 0, 21, -15.4, 0, 8, 3.5, 2);
}

// =============== КИОТО ===============
function pagoda(B, x, z, floors, s) {
  let w = 5 * s, y = 0;
  for (let i = 0; i < floors; i++) {
    const h = 2.6 * s;
    B.box(x - w / 2, y, z - w / 2, x + w / 2, y + h, z + w / 2, i === 0 ? 'T|wood3|7a3a20|1.5' : 'T|plaster2|efe6d2|3', i === 0);
    const rw = w + 2.6 * s, roof = new THREE.CylinderGeometry(rw * 0.2, rw * 0.72, 0.9 * s, 4, 1);
    roof.rotateY(Math.PI / 4); roof.translate(x, y + h + 0.45 * s, z); B.push('roofTileJp', roof);
    y += h + 0.9 * s; w *= 0.84;
  }
  const sp = new THREE.CylinderGeometry(0.08 * s, 0.14 * s, 4 * s, 6); sp.translate(x, y + 2 * s, z); B.push('flat|b08a3a|0.4|0.8', sp);
}
function buildKyoto(B, group, ctx) {
  const R = ctx.R;
  const inner = [];
  const row = (z1, z2, from, to, gaps) => { let a = from; for (const [g0, g1] of [...gaps, [to, to]]) { while (a < g0 - 2) { const w = Math.min(g0 - a, 4.5 + R() * 3.5); inner.push([a, z1, a + w, z2, 5.5 + R() * 2.8, 'bld:kyoto']); a += w; } a = g1; } };
  row(7, 15, -27, 27, [[-12, -8], [8, 12]]);
  row(-15, -7, -27, 27, [[-13, -8], [8, 13]]);
  inner.push([-40, 22, -32, 30, 6, 'bld:kyoto'], [32, 22, 40, 30, 6, 'bld:kyoto']);
  placeBuildings(B, [...inner, ...perimeterBuildings('kyoto', R, 5.5, 8.5, { skipSouth: true })], ctx);
  // каменная улица Гион
  B.box(-40, 0, -6, 40, 0.03, 6, 'T|bricks2|b8b0a4|1.4');
  for (let x = -36; x <= 36; x += 6) { lanternString(B, [x, 4.5, 6.5], [x + 3, 4.5, 6.5], 3, ctx); lanternString(B, [x + 3, 4.5, -6.5], [x + 6, 4.5, -6.5], 3, ctx); }
  for (const x of [-26, -6, 14, 30]) stoneLantern(B, x, 5.6, ctx);
  for (const x of [-18, 4, 22]) stoneLantern(B, x, -5.6, ctx);
  for (const [x, z] of [[-30, 0], [-10, 2.5], [10, -2.5], [28, 1]]) { B.box(x - 1.2, 0, z - 0.45, x + 1.2, 0.5, z + 0.45, 'T|wood3|5a3a22|1.5', true); }
  for (const [x, z] of [[-16, -2], [18, 2.2]]) { B.box(x - 0.6, 0, z - 0.6, x + 0.6, 1.1, z + 0.6, 'T|wood|b88a5a|1', true); }
  // храмовый сад и пагода (север)
  B.box(-40, 0, 15, 40, 0.03, 30, 'T|ground3|c8bca0|4');
  pagoda(B, 0, 24, 5, 1);
  for (const x of [-22, 22]) torii(B, x, 20, Math.PI / 2, 1.1);
  for (const [x, z] of [[-30, 19], [-14, 27], [-8, 19], [8, 27], [14, 19], [30, 26], [-34, 26], [34, 19]]) tree(B, x, z, ctx, R() < 0.5 ? 'maple' : 'sakura', 1.05);
  for (const x of [-26, -6, 6, 26]) stoneLantern(B, x, 23, ctx);
  // пруд и мостик (юг)
  B.box(-40, 0, -30, 40, 0.03, -15, 'T|ground2|7a9a5a|4');
  const pond = new THREE.PlaneGeometry(26, 9); pond.rotateX(-Math.PI / 2); pond.translate(0, 0.05, -24); B.push('water', pond);
  B.colliders.push({ min: [-13, 0, -28.5], max: [-1.6, 1.2, -19.5] }, { min: [1.6, 0, -28.5], max: [13, 1.2, -19.5] });
  for (let i = 0; i < 9; i++) { const t = i / 8, bx = -1.6, z = -28.5 + t * 9; void bx; B.box(-1.6, 0, z - 0.6, 1.6, 0.35 + Math.sin(t * Math.PI) * 0.7, z + 0.6, 'flat|b8361e|0.6', true); }
  for (const sx of [-1, 1]) B.box(sx * 1.6 - 0.08, 0, -28.5, sx * 1.6 + 0.08, 1.9, -19.5, 'flat|b8361e|0.6');
  for (const [x, z] of [[-18, -22], [18, -26], [-26, -27], [26, -19], [-8, -17], [8, -29]]) tree(B, x, z, ctx, 'maple', 1.0);
  for (const [x, z] of [[-14, -18], [14, -29], [-30, -18], [30, -28]]) { const r = new THREE.DodecahedronGeometry(0.9, 0); r.scale(1.3, 0.7, 1); r.translate(x, 0.4, z); B.push('T|rock|8a8478|2', r); B.colliders.push({ min: [x - 1, 0, z - 0.8], max: [x + 1, 0.9, z + 0.8] }); }
  skyline(B, R, 0, 0, 0);
  // далёкие горы
  for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2, r = 160, h = 30 + R() * 40; const m = new THREE.ConeGeometry(50 + R() * 30, h, 7); m.translate(Math.cos(a) * r, h / 2 - 2, Math.sin(a) * r); B.push('skyline', m); }
}

// =============== МАЙАМИ ===============
function buildMiami(B, group, ctx) {
  const R = ctx.R;
  const inner = [
    [-27, 7, -12, 15, 12, 'bld:miami'], [-8, 7, 8, 15, 15, 'bld:miami'], [12, 7, 27, 15, 11, 'bld:miami'],
    [-40, 22, -32, 30, 10, 'bld:miami'], [32, 22, 40, 30, 10, 'bld:miami'],
  ];
  placeBuildings(B, [...inner, ...perimeterBuildings('miami', R, 9, 16, { skipSouth: true })], ctx);
  skyline(B, R, 22, 40, 110, 95);
  // Оушен-драйв
  road(B, -40, -3.4, 40, 3.4, ctx, { yellow: true, zebra: 0 });
  sidewalk(B, -40, 3.4, 40, 7, 'T|concrete2|f0e6d6|2.5'); sidewalk(B, -40, -7, 40, -3.4, 'T|concrete2|f0e6d6|2.5');
  for (const [x, z, ry, k] of [[-24, 1.9, 0, 'sedan'], [-10, -1.9, Math.PI, 'van'], [12, 1.9, 0, 'sedan'], [26, -1.9, Math.PI, 'sedan']]) car(B, x, z, ry, ctx, k);
  for (let x = -34; x <= 34; x += 8) palmTree(B, x, 5.4, ctx, 6 + R() * 2.5);
  for (let x = -30; x <= 30; x += 8) palmTree(B, x, -5.4, ctx, 7 + R() * 3);
  for (const x of [-20, 4, 28]) streetLamp(B, x, 4.0, ctx, 'modern', Math.PI);
  for (const x of [-30, -6, 18]) streetLamp(B, x, -4.0, ctx, 'modern', 0);
  // переулок (север)
  for (const [x, z, ry] of [[-18, 17, 0], [16, 28.4, 0]]) dumpster(B, x, z, ry);
  for (const [x, z] of [[-28, 24], [-6, 20], [8, 25], [28, 19]]) B.box(x - 0.6, 0, z - 0.6, x + 0.6, 1.2, z + 0.6, 'T|wood|c0a070|1', true);
  for (const x of [-32, 0, 32]) streetLamp(B, x, 29, ctx, 'modern', Math.PI);
  billboard(B, 0, 22.5, 7.4, 0, 10, 4, 1);
  // пляж (юг): песок, спасательная вышка, лежаки, океан
  B.box(-40, 0, -30, 40, 0.03, -7, 'T|ground3|eed9b0|5');
  B.box(-40, 0, -7.4, 40, 0.9, -7, 'T|plaster2|f4ecd8|3', true);
  const tower = (x, z) => {
    for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) B.box(x + dx * 1.1 - 0.1, 0, z + dz * 1.1 - 0.1, x + dx * 1.1 + 0.1, 2.4, z + dz * 1.1 + 0.1, 'flat|f4f0e8|0.6');
    B.box(x - 1.5, 2.4, z - 1.5, x + 1.5, 4.4, z + 1.5, 'flat|ff7aa8|0.5', true);
    B.box(x - 1.8, 4.4, z - 1.8, x + 1.8, 4.6, z + 1.8, 'flat|3ec8d8|0.5');
    B.colliders.push({ min: [x - 1.2, 0, z - 1.2], max: [x + 1.2, 2.4, z + 1.2] });
  };
  tower(-16, -21); tower(18, -20);
  for (const [x, z, c] of [[-28, -16, 'cloth'], [-4, -24, 'cloth_b'], [4, -14, 'cloth_g'], [28, -25, 'cloth'], [-24, -27, 'cloth_b']]) umbrellaTable(B, x, z, c, ctx);
  for (const [x, z] of [[-8, -12], [8, -27], [-30, -22], [30, -14], [0, -19]]) B.box(x - 1.3, 0, z - 0.5, x + 1.3, 0.9, z + 0.5, 'T|wood3|c09868|1.5', true);
  B.colliders.push({ min: [-40, 0, -31], max: [40, 3, -30] });
  const sea = new THREE.PlaneGeometry(900, 400); sea.rotateX(-Math.PI / 2); sea.translate(0, -0.15, -230); B.push('water', sea);
}

const common = { bounds: BOUNDS, spawns: SPAWNS, points: POINTS, boxes: [], decor: [], paths: [] };

export const CITY_MAPS = {
  tokyo: {
    ...common, id: 'tokyo', name: 'Токио', desc: 'Ночной квартал: неон, переулки, святилище', build: buildTokyo, night: true, ground: 'T|asphalt2|6a6c70|4|0.4',
    sky: { elevation: 30, azimuth: 200, turbidity: 2, rayleigh: 0.5, mie: 0.003, exposure: 0.85 },
    sun: 0x8fa8ff, sunI: 0.55, hemi: [0x3a4a7a, 0x1a1020, 0.6], fog: [0x1a1530, 0.012], hdri: 'moonless_golf_1k', envI: 0.6,
    sites: { A: [-20, 22, 5], B: [-20, -21, 5] }, lightCount: 6,
  },
  oldtown: {
    ...common, id: 'oldtown', name: 'Старый город', desc: 'Европейская площадь на закате', build: buildOldTown, evening: true, ground: 'T|bricks2|cfc6b8|1.6',
    sky: { elevation: 9, azimuth: 250, turbidity: 6, rayleigh: 2.2, mie: 0.006, exposure: 0.48 },
    sun: 0xffc48a, sunI: 3.2, hemi: [0xb8c8e8, 0x6a5040, 0.45], fog: [0xd9b9a0, 0.006], hdri: 'venice_sunset_1k', envI: 0.75,
    sites: { A: [-20, 22, 5], B: [-22, -20, 5] }, lightCount: 4,
  },
  brooklyn: {
    ...common, id: 'brooklyn', name: 'Бруклин', desc: 'Нью-Йорк: авеню, переулки, парк', build: buildBrooklyn, ground: 'T|asphalt2|8a8c90|4',
    sky: { elevation: 22, azimuth: 115, turbidity: 4, rayleigh: 1.4, mie: 0.005, exposure: 0.5 },
    sun: 0xffe2c0, sunI: 3.0, hemi: [0xbcd0ec, 0x6a6058, 0.45], fog: [0xc8d0d8, 0.006], hdri: 'blouberg_sunrise_2_1k', envI: 0.7,
    sites: { A: [-21, 22, 5], B: [-20, -21, 5] },
  },
  santorini: {
    ...common, id: 'santorini', name: 'Санторини', desc: 'Белые домики над морем', build: buildSantorini, ground: 'T|concrete2|f2efe8|3',
    sky: { elevation: 55, azimuth: 160, turbidity: 2.5, rayleigh: 0.8, mie: 0.003, exposure: 0.42 },
    sun: 0xfff6e8, sunI: 3.4, hemi: [0xb8d8ff, 0xd8ccb8, 0.5], fog: [0xbfd8f0, 0.003], hdri: 'quarry_01_1k', envI: 0.8,
    sites: { A: [-20, 22, 5], B: [-20, -21, 5] },
  },
  paris: {
    ...common, id: 'paris', name: 'Париж', desc: 'Бульвар, кафе и Эйфелева башня', build: buildParis, evening: true, ground: 'T|asphalt2|7a7c80|4',
    sky: { elevation: 7, azimuth: 120, turbidity: 5, rayleigh: 2.6, mie: 0.006, exposure: 0.5 },
    sun: 0xffb27a, sunI: 3.0, hemi: [0xc0c8f0, 0x6a5048, 0.45], fog: [0xe0b8a8, 0.005], hdri: 'venice_sunset_1k', envI: 0.75,
    sites: { A: [-20, 22, 5], B: [-20, -21, 5] }, lightCount: 4,
  },
  kyoto: {
    ...common, id: 'kyoto', name: 'Киото', desc: 'Гион, пагода и осенний сад', build: buildKyoto, ground: 'T|ground3|c8bca0|4',
    sky: { elevation: 28, azimuth: 210, turbidity: 3, rayleigh: 1.2, mie: 0.005, exposure: 0.48 },
    sun: 0xfff0d8, sunI: 3.1, hemi: [0xc8d8f0, 0x7a6a50, 0.5], fog: [0xd8dce0, 0.005], hdri: 'quarry_01_1k', envI: 0.75,
    sites: { A: [-20, 22, 5], B: [-20, -21, 5] },
  },
  miami: {
    ...common, id: 'miami', name: 'Майами', desc: 'Ночной Оушен-драйв: ар-деко и неон', build: buildMiami, night: true, ground: 'T|asphalt2|6a6c70|4|0.4',
    sky: { elevation: 30, azimuth: 200, turbidity: 2, rayleigh: 0.5, mie: 0.003, exposure: 0.85 },
    sun: 0xa0b0ff, sunI: 0.6, hemi: [0x5a3a8a, 0x201030, 0.65], fog: [0x2a1840, 0.01], hdri: 'moonless_golf_1k', envI: 0.6,
    sites: { A: [-20, 22, 5], B: [-20, -20, 5] }, lightCount: 6,
  },
};
