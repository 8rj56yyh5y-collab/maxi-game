// Реалистичные карты из фотограмметрических наборов Poly Haven (CC0).
import * as THREE from 'three';
import { facadeModule, piece, prop, nodeProp, KitBuilder } from './kit.js';

// ---------- Описание наборов фасадов ----------
const FACTORY = 'modular_factory_facade', APTS = 'modular_urban_apartments_facade';
const KITS = {
  factory: {
    kit: FACTORY,
    ground: [['wall_door_garage_door_01', 6], ['wall_door_garage_centered_01', 6], ['wall_door_recessed_large_01', 3], ['wall_door_recessed_small_01', 3], ['wall_door_centered_small_01', 3], ['wall_door_centered_large_01', 3], ['wall_standard_standard_01', 3], ['wall_window_tall_small_01', 3]],
    columns: [
      (f, top) => `wall_window_centered_large_0${Math.min(f, 6)}`,
      (f, top) => `wall_window_centered_medium_0${Math.min(f, 6)}`,
      (f) => `wall_window_centered_small_0${Math.min(f, 4)}`,
      (f) => `wall_window_centered_double_0${Math.min(f, 4)}`,
      (f, top) => top ? 'wall_window_tall_large_05' : `wall_window_tall_large_0${Math.min(f, 4)}`,
      (f, top) => top ? 'wall_window_tall_small_05' : `wall_window_tall_small_0${Math.min(f, 4)}`,
      (f) => `wall_window_offset_small_0${[1, 3, 5, 7][Math.min(f, 4) - 1]}`,
    ],
    plain: 'wall_standard_standard_01',
    dado: 'dado_standard_standard_01', band: 'cornice03_standard_standard_01', top: 'cornice02_standard_standard_01', crown: 'crown_standard_standard_01',
    pier: 'wall_pier_corner_01', crownPier: 'crown_pier_corner_01', dadoPier: 'dado_pier_corner_01',
    roof: 'T|concrete|8a8680|3',
  },
  apts: {
    kit: APTS,
    ground: [['wall_door_centered_large_01', 3], ['wall_door_centered_small_01', 3], ['wall_door_centered_small_02', 3], ['wall_standard_standard_01', 3], ['wall_window_centered_small_01', 3]],
    columns: [
      (f) => `wall_window_centered_large_0${Math.min(f, 3)}`,
      (f) => `wall_window_centered_small_0${Math.min(f, 3)}`,
      (f) => `wall_window_centered_double_0${Math.min(f, 3)}`,
      (f) => `wall_window_offset_small_0${[1, 3, 5][Math.min(f, 3) - 1]}`,
    ],
    plain: 'wall_standard_standard_01',
    dado: 'dado_standard_standard_01', band: 'cornice_standard_standard_01', top: null, crown: 'crown_standard_standard_01',
    pier: 'wall_pier_corner_01', crownPier: 'crown_pier_corner_01', dadoPier: 'dado_pier_corner_01',
    roof: 'T|concrete|8a8680|3',
  },
};
export const REAL_KITS = [FACTORY, APTS];

// Стороны: 0 — юг (z1, нормаль −z), 1 — восток (x2), 2 — север (z2), 3 — запад (x1)
function sideFrame(b, side) {
  const [x1, z1, x2, z2] = b;
  // начало, направление вдоль фасада, угол поворота модуля (локальный +z → нормаль)
  if (side === 2) return { o: [x1, z2], d: [1, 0], ry: 0, len: x2 - x1 };
  if (side === 0) return { o: [x2, z1], d: [-1, 0], ry: Math.PI, len: x2 - x1 };
  if (side === 1) return { o: [x2, z2], d: [0, -1], ry: Math.PI / 2, len: z2 - z1 };
  return { o: [x1, z1], d: [0, 1], ry: -Math.PI / 2, len: z2 - z1 };
}

// Дом из модулей. b = [x1, z1, x2, z2], floors — этажей (по 3 м)
export function kitBuilding(K, B, b, floors, style, R, exposed, opts = {}) {
  const S = KITS[style];
  const H = floors * 3;
  const [x1, z1, x2, z2] = b;
  const colType = Math.floor(R() * S.columns.length);
  const colType2 = Math.floor(R() * S.columns.length);
  for (let side = 0; side < 4; side++) {
    if (exposed && !exposed(side)) continue;
    const F = sideFrame(b, side);
    const n = Math.round(F.len / 3);
    const at = (u) => [F.o[0] + F.d[0] * u, F.o[1] + F.d[1] * u];
    // первый этаж: двери/ворота/витрины
    let u = 0, i = 0;
    while (u < n * 3 - 0.01) {
      let [name, w] = S.ground[Math.floor(R() * S.ground.length)];
      if (opts.groundPlain && R() < 0.5) [name, w] = [S.plain, 3];
      if (u + w > n * 3 + 0.01) [name, w] = [S.plain, 3];
      const [x, z] = at(u);
      K.add(facadeModule(S.kit, name), x, 0, z, F.ry);
      u += w; i++;
    }
    // этажи
    for (let f = 1; f < floors; f++) {
      for (let c = 0; c < n; c++) {
        const [x, z] = at(c * 3);
        const pattern = (c % 4 === 3 && n > 4) ? null : (c % 2 ? colType2 : colType);
        const name = pattern === null ? S.plain : S.columns[pattern](f, f === floors - 1);
        K.add(facadeModule(S.kit, name) || facadeModule(S.kit, S.plain), x, f * 3, z, F.ry);
      }
    }
    // карнизы, цоколь, венец
    for (let c = 0; c < n; c++) {
      const [x, z] = at(c * 3);
      K.add(piece(S.kit, S.dado), x, 0, z, F.ry);
      for (let f = 1; f < floors; f++) K.add(piece(S.kit, S.band), x, f * 3 - 0.06, z, F.ry);
      if (S.top) K.add(piece(S.kit, S.top), x, H - 0.2, z, F.ry);
      K.add(piece(S.kit, S.crown), x, H, z, F.ry);
    }
  }
  // угловые пилястры
  for (const [cx, cz] of [[x1, z1], [x2, z1], [x2, z2], [x1, z2]]) {
    for (let f = 0; f < floors; f++) K.add(piece(S.kit, S.pier, 'center'), cx, f * 3, cz, 0);
    K.add(piece(S.kit, S.crownPier, 'center'), cx, H, cz, 0);
    K.add(piece(S.kit, S.dadoPier, 'center'), cx, 0, cz, 0);
  }
  // крыша и «нутро» (тёмная коробка за стёклами)
  B.box(x1 + 0.02, H - 0.02, z1 + 0.02, x2 - 0.02, H + 0.12, z2 - 0.02, S.roof);
  B.box(x1 + 0.45, 0.05, z1 + 0.45, x2 - 0.45, H - 0.1, z2 - 0.45, 'flat|17181a|0.9');
  B.colliders.push({ min: [x1, 0, z1], max: [x2, H + 0.6, z2] });
  // на крыше: вентиляция, кондиционеры
  if (opts.roofProps !== false) {
    for (let k = 0; k < 2; k++) {
      const px = x1 + 2 + R() * (x2 - x1 - 4), pz = z1 + 2 + R() * (z2 - z1 - 4);
      K.add(prop('exterior_aircon_unit'), px, H + 0.12, pz, R() * 4);
    }
  }
}

// Реквизит с коллайдером
export function P(K, name, x, z, ry = 0, s = 1, y = 0) { K.solid(prop(name), x, z, ry, s, y); }
export function Pn(K, name, x, z, ry = 0, s = 1, y = 0) { K.add(prop(name), x, y, z, ry, s); } // без коллайдера
export { KitBuilder, nodeProp };

// =============== КАРТА «ФАБРИКА» ===============
import { groupProp } from './kit.js';
const FB = [-48, -36, 48, 36];

function exposedBy(list, b, bounds) {
  return (side) => {
    const [x1, z1, x2, z2] = b;
    const p = [[(x1 + x2) / 2, z1 - 0.6], [x2 + 0.6, (z1 + z2) / 2], [(x1 + x2) / 2, z2 + 0.6], [x1 - 0.6, (z1 + z2) / 2]][side];
    if (p[0] < bounds[0] - 0.5 || p[0] > bounds[2] + 0.5 || p[1] < bounds[1] - 0.5 || p[1] > bounds[3] + 0.5) return false;
    for (const o of list) if (o !== b && p[0] > o[0] && p[0] < o[2] && p[1] > o[1] && p[1] < o[3]) return false;
    return true;
  };
}

function fireEscape(K, x, z, ry, floors) {
  const plat = groupProp('modular_fire_escape', /platform_middle|railing_middle/, 'back');
  const stairs = groupProp('modular_fire_escape', /stairs/, 'back');
  for (let f = 1; f < floors; f++) {
    K.add(plat, x, f * 3 - 0.75, z, ry);
    if (f < floors - 1) K.add(stairs, x, f * 3, z, ry, [1, 0.75, 1]);
  }
}

function fence(K, B, x1, z1, x2, z2) {
  const panel = groupProp('modular_chainlink_fence', /^modular_chainlink_fence_double$/, 'center');
  const post = groupProp('modular_chainlink_fence', /^modular_chainlink_post_middle$/, 'center');
  const len = Math.hypot(x2 - x1, z2 - z1), n = Math.round(len / 2), ry = -Math.atan2(z2 - z1, x2 - x1);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    K.add(panel, x1 + (x2 - x1) * t, 0, z1 + (z2 - z1) * t, ry);
    K.add(post, x1 + (x2 - x1) * i / n, 0, z1 + (z2 - z1) * i / n, ry);
  }
  K.add(post, x2, 0, z2, ry);
  const pad = 0.12;
  B.colliders.push({ min: [Math.min(x1, x2) - pad, 0, Math.min(z1, z2) - pad], max: [Math.max(x1, x2) + pad, 2.5, Math.max(z1, z2) + pad] });
}

function pole(K, x, z) { K.solid(groupProp('modular_electricity_poles', /^preset_01_/, 'center'), x, z, 0, 1, 0, 6); }

function buildFactory(B, group, ctx) {
  const R = ctx.R, K = new KitBuilder();
  const inner = [
    [-33, 6, -15, 18, 4, 'factory'], [-9, 9, 9, 21, 5, 'factory'], [15, 6, 30, 18, 4, 'apts'],
    [-33, -18, -18, -6, 4, 'apts'], [-9, -21, 9, -9, 3, 'factory'], [15, -18, 33, -6, 4, 'factory'],
    [3, 27, 12, 33, 2, 'apts'], [0, -33, 9, -27, 2, 'factory'],
  ];
  const per = [];
  const chunks = (a, b, step) => { const out = []; let x = a; while (x < b) { const w = Math.min(b - x, step[Math.floor(R() * step.length)]); out.push([x, x + w]); x += w; } return out; };
  for (const [a, b] of chunks(-60, 60, [12, 15, 18])) { per.push([a, 36, b, 48, 4 + Math.floor(R() * 3), R() < 0.55 ? 'factory' : 'apts']); per.push([a, -48, b, -36, 4 + Math.floor(R() * 3), R() < 0.55 ? 'factory' : 'apts']); }
  for (const [a, b] of chunks(-36, 36, [12, 15, 18])) { per.push([-60, a, -48, b, 4 + Math.floor(R() * 2), R() < 0.5 ? 'factory' : 'apts']); per.push([48, a, 60, b, 4 + Math.floor(R() * 2), R() < 0.5 ? 'factory' : 'apts']); }
  const all = [...inner, ...per];
  for (const b of all) kitBuilding(K, B, b, b[4], b[5], R, exposedBy(all, b, FB), { roofProps: inner.includes(b) });

  // ---- покрытия ----
  B.box(-48, 0, 18, 48, 0.012, 36, 'T|ph_concrete_floor_damaged_01|d8d4cc|5');      // северный двор
  B.box(-48, 0, -36, 48, 0.012, -18, 'T|ph_cobblestone_floor_08|ffffff|3');       // южный двор
  for (const [x1, z1, x2, z2] of [[-15, 6, -9, 18], [9, 6, 15, 18], [-18, -18, -9, -6], [9, -18, 15, -6], [-9, 6, 9, 9], [-9, -9, 9, -6]]) B.box(x1, 0, z1, x2, 0.014, z2, 'T|ph_cobblestone_floor_08|e8e4dc|3');
  // тротуары вдоль центральной улицы
  B.box(-48, 0, 3.6, 48, 0.02, 6, 'T|ph_concrete_pavement|ffffff|3');
  B.box(-48, 0, -6, 48, 0.02, -3.6, 'T|ph_concrete_pavement|ffffff|3');
  B.box(-48, 0, 3.55, 48, 0.14, 3.75, 'T|ph_concrete_floor_02|c8c4bc|2');
  B.box(-48, 0, -3.75, 48, 0.14, -3.55, 'T|ph_concrete_floor_02|c8c4bc|2');
  for (let x = -46; x < 48; x += 6) B.box(x, 0, -0.07, x + 3, 0.016, 0.07, 'flat|e8e4d8|0.7');
  for (const [x, z] of [[-18, 1.5], [10, -1.5], [30, 1.5], [-30, 26], [24, 26]]) K.add(prop('water_manhole_cover'), x, 0.02, z, R() * 3);

  // ---- центральная улица ----
  P(K, 'covered_car', -24, 2.0, 0.05); P(K, 'covered_car', -5, -2.0, Math.PI + 0.08); P(K, 'covered_car', 21, 2.1, -0.04);
  P(K, 'concrete_road_barrier', -13, 0.4, Math.PI / 2); P(K, 'concrete_road_barrier', 6, 0.2, 0.15); P(K, 'concrete_road_barrier_02', 32, -1.6, Math.PI / 2 + 0.2);
  P(K, 'concrete_road_barrier_02', -36, -1.2, 0.3);
  for (let x = -42; x <= 42; x += 14) { P(K, 'street_lamp_01', x, 5.3, Math.PI); P(K, 'street_lamp_01', x + 7, -5.3, 0); }
  for (const [x, z] of [[-27, 5.0], [12, -5.0], [36, 5.0]]) P(K, 'fire_hydrant', x, z);
  for (const [x, z, r] of [[-15.6, 5.2, 0], [9.6, -5.2, 2], [29, 5.2, 1]]) P(K, 'metal_trash_can', x, z, r);
  for (const [x, z, r] of [[-31, 5.4, Math.PI], [17, -5.4, 0]]) P(K, 'utility_box_01', x, z, r);
  for (const [x, z] of [[-39, 5.6], [-3, 5.6], [27, -5.6]]) pole(K, x, z);

  // ---- точка A: северо-западный двор ----
  P(K, 'covered_car', -21.5, 23.2, 1.35);
  for (const [x, z, y] of [[-30, 24.5, 0], [-30, 24.5, 1], [-28.9, 24.6, 0], [-30.1, 25.7, 0]]) P(K, 'wooden_crate_01', x, z, R() * 0.3, 1, y * prop('wooden_crate_01').size.y);
  P(K, 'wooden_crate_02', -23, 30.5, 0.4); P(K, 'wooden_crate_02', -23, 30.5, 0.1, 1, prop('wooden_crate_02').size.y);
  for (const [x, z] of [[-34, 30], [-33.2, 30.6], [-34.3, 31.2]]) P(K, 'Barrel_01', x, z, R() * 3);
  P(K, 'barrel_stove', -19, 33.5); P(K, 'industrial_pastic_container', -36, 21.5, 0.2);
  P(K, 'concrete_road_barrier', -14.5, 24, Math.PI / 2); P(K, 'concrete_road_barrier', -14.5, 29.5, Math.PI / 2);
  fence(K, B, -12, 31, -12, 36);
  for (const [x, z, r] of [[-40, 34, 0], [-6, 34.5, 0.3]]) P(K, 'metal_trash_can', x, z, r);
  P(K, 'wooden_barrels_01', -42, 22, 0.5);
  // ---- северный двор, восток ----
  P(K, 'covered_car', 20, 24, -0.2); P(K, 'old_tyre', 23.5, 22, 0); P(K, 'Barrel_02', 31, 30); P(K, 'Barrel_02', 31.8, 30.6);
  for (const [x, z] of [[38, 22], [38, 23.2]]) P(K, 'wooden_crate_01', x, z, 0.2);
  fence(K, B, 33, 26, 41, 26);

  // ---- точка B: юго-западный двор ----
  P(K, 'covered_car', -28.5, -23.5, 0.35);
  P(K, 'wooden_barrels_01', -21, -30.5, 0.1);
  for (const [x, z, y] of [[-24, -31, 0], [-24, -31, 1], [-25.1, -31.1, 0]]) P(K, 'wooden_crate_02', x, z, R() * 0.3, 1, y * prop('wooden_crate_02').size.y);
  for (const [x, z] of [[-33.5, -29], [-33.6, -30.2]]) P(K, 'cardboard_box_01', x, z, R());
  P(K, 'metal_jerrycan', -31.6, -22.1, 0.4); P(K, 'old_tyre', -19.5, -23, 1);
  P(K, 'concrete_road_barrier_02', -14, -26, Math.PI / 2); P(K, 'concrete_road_barrier_02', -14, -31.5, Math.PI / 2);
  P(K, 'barrel_stove', -40, -32); P(K, 'industrial_pastic_container', -42, -22, 1.2);
  // ---- южный двор, восток ----
  P(K, 'covered_car', 22, -24, 0.5); P(K, 'concrete_road_barrier', 30, -30, 0.1); P(K, 'Barrel_01', 38, -22); P(K, 'Barrel_01', 38.8, -22.6);
  fence(K, B, 33, -26, 41, -26);
  // ---- западная площадь (спецназ) и восточная (наёмники) ----
  P(K, 'modular_street_seating', -40, 10, Math.PI / 2); P(K, 'modular_street_seating', -40, -10, Math.PI / 2);
  P(K, 'utility_box_02', -46, 15, Math.PI / 2); P(K, 'metal_trash_can', -46, -14, 0);
  P(K, 'covered_car', 40, 11, Math.PI / 2 + 0.1); P(K, 'wooden_barrels_01', 41, -12, 0); P(K, 'concrete_road_barrier', 36, 14, 0);
  // ---- переулки ----
  for (const [x, z, r] of [[-12, 13, 0], [12, 10, 1.4], [-13.5, -12, 0.3], [12, -13, 2]]) P(K, 'metal_trash_can', x, z, r);
  for (const [x, z] of [[-10.5, 16.5], [13.8, 15.5], [-16.5, -16.3], [10.2, -16.5]]) P(K, 'cardboard_box_01', x, z, R() * 3);
  // ---- пожарные лестницы ----
  fireEscape(K, 22.5, 6, Math.PI, 4); fireEscape(K, -25.5, -6, 0, 4); fireEscape(K, 0, 21, 0, 5); fireEscape(K, 24, -6, 0, 4);

  K.build(group, ctx.quality !== 'low');
  for (const c of K.colliders) B.colliders.push(c);
}


// =============== КАРТА «КВАРТАЛ» ===============
const QB = [-40, -32, 40, 32];
function perimeter(R, bounds, aptsShare = 0.5) {
  const [x1, z1, x2, z2] = bounds, per = [];
  const chunks = (a, b) => { const out = []; let x = a; while (x < b - 0.1) { const w = Math.min(b - x, [12, 15, 18][Math.floor(R() * 3)]); out.push([x, x + w]); x += w; } return out; };
  const st = () => R() < aptsShare ? 'apts' : 'factory';
  for (const [a, b] of chunks(x1 - 12, x2 + 12)) { per.push([a, z2, b, z2 + 12, 4 + Math.floor(R() * 3), st()]); per.push([a, z1 - 12, b, z1, 4 + Math.floor(R() * 3), st()]); }
  for (const [a, b] of chunks(z1, z2)) { per.push([x1 - 12, a, x1, b, 4 + Math.floor(R() * 2), st()]); per.push([x2, a, x2 + 12, b, 4 + Math.floor(R() * 2), st()]); }
  return per;
}
function planter(K, B, x, z) {
  B.box(x - 0.9, 0, z - 0.9, x + 0.9, 0.55, z + 0.9, 'T|ph_concrete_floor_02|d8d4cc|2', true);
  K.add(prop(Math.random() < 0.5 ? 'shrub_01' : 'shrub_02'), x, 0.5, z, Math.random() * 6, 0.8);
}
function buildQuarter(B, group, ctx) {
  const R = ctx.R, K = new KitBuilder();
  const inner = [
    [-30, 9, -12, 21, 5, 'apts'], [6, 12, 24, 24, 4, 'apts'], [-27, -24, -12, -12, 3, 'factory'], [9, -21, 27, -9, 5, 'apts'],
    [-6, -6, 3, 3, 2, 'factory'],
  ];
  const all = [...inner, ...perimeter(R, QB, 0.75)];
  for (const b of all) kitBuilding(K, B, b, b[4], b[5], R, exposedBy(all, b, QB), { roofProps: inner.includes(b) });
  // покрытия: брусчатка повсюду, асфальтовая улица по центру, плитка на площадях
  B.box(-40, 0, -3.5, 40, 0.012, 3.5, 'T|ph_asphalt_02|ffffff|6');
  B.box(-40, 0, 3.5, 40, 0.02, 6, 'T|ph_concrete_pavement|ffffff|3'); B.box(-40, 0, -6, 40, 0.02, -3.5, 'T|ph_concrete_pavement|ffffff|3');
  B.box(-40, 0, 3.45, 40, 0.14, 3.65, 'T|ph_concrete_floor_02|c8c4bc|2'); B.box(-40, 0, -3.65, 40, 0.14, -3.45, 'T|ph_concrete_floor_02|c8c4bc|2');
  B.box(-12, 0, 21, 6, 0.016, 32, 'T|ph_concrete_pavement|f0ece4|2.5');      // площадь (A)
  B.box(-40, 0, -32, -12, 0.016, -24, 'T|ph_concrete_floor_damaged_01|d8d4cc|5'); // парковка (B)
  for (let x = -38; x < 40; x += 6) B.box(x, 0, -0.07, x + 3, 0.016, 0.07, 'flat|e8e4d8|0.7');
  // ---- площадь A ----
  for (const [x, z] of [[-9, 24], [3, 24], [-9, 30], [3, 30]]) planter(K, B, x, z);
  P(K, 'modular_street_seating', -3, 27, 0); P(K, 'modular_street_seating', -3, 29.5, Math.PI);
  for (const [x, z] of [[-11, 27.5], [5, 27.5]]) P(K, 'street_lamp_02', x, z);
  P(K, 'covered_car', -18, 25, 1.4); P(K, 'concrete_road_barrier', -24, 29, 0.2); P(K, 'concrete_road_barrier', 12, 27, Math.PI / 2);
  for (const [x, z, y] of [[-27, 24.5, 0], [-27, 24.5, 1], [-25.9, 24.4, 0]]) P(K, 'wooden_crate_01', x, z, 0.2, 1, y * prop('wooden_crate_01').size.y);
  P(K, 'metal_trash_can', 9, 30, 0); P(K, 'utility_box_02', -36, 26, Math.PI / 2);
  // ---- парковка B ----
  fence(K, B, -40, -24, -30, -24); fence(K, B, -21, -24, -12, -24);
  for (const [x, z, r] of [[-35, -27.5, Math.PI / 2], [-31.5, -28, Math.PI / 2 + 0.1], [-19, -28.5, Math.PI / 2 - 0.08]]) P(K, 'covered_car', x, z, r);
  P(K, 'Barrel_01', -25, -30.5); P(K, 'Barrel_02', -24.2, -31); P(K, 'old_tyre', -27, -26.5, 0.4); P(K, 'industrial_pastic_container', -14.5, -30, 0.3);
  P(K, 'barrel_stove', -38, -31);
  // ---- центральная улица ----
  P(K, 'covered_car', -22, -2, Math.PI + 0.05); P(K, 'covered_car', 14, 2, 0.04); P(K, 'concrete_road_barrier_02', 30, 0, Math.PI / 2);
  P(K, 'concrete_road_barrier', -32, 1, 0.3);
  for (let x = -36; x <= 36; x += 12) { P(K, 'street_lamp_01', x, 5.3, Math.PI); P(K, 'street_lamp_01', x + 6, -5.3, 0); }
  for (const [x, z] of [[-16, 5.0], [20, -5.0]]) P(K, 'fire_hydrant', x, z);
  for (const [x, z] of [[-28, 4.8], [-4, -4.8], [24, 4.8]]) planter(K, B, x, z);
  for (const [x, z] of [[-10, 0], [22, 1.5]]) K.add(prop('water_manhole_cover'), x, 0.02, z, R() * 3);
  // ---- юго-восток и северо-восток ----
  P(K, 'covered_car', 30, -26, 0.4); P(K, 'wooden_barrels_01', 20, -27, 0.3); P(K, 'metal_trash_can', 4, -12, 0); P(K, 'cardboard_box_01', 5, -14, 0.5);
  P(K, 'covered_car', 30, 27, -0.3); P(K, 'concrete_road_barrier_02', 26, 29, 0.1); P(K, 'metal_jerrycan', 33, 25, 0);
  fireEscape(K, -21, 9, Math.PI, 5); fireEscape(K, 15, 12, Math.PI, 4); fireEscape(K, 18, -9, 0, 5);
  K.build(group, ctx.quality !== 'low');
  for (const c of K.colliders) B.colliders.push(c);
}

const FACTORY_POINTS = [[0, 0], [-20, 0], [20, 0], [-26, 27], [-26, -27], [0, 24], [0, -24], [24, 27], [24, -27], [-12, 12], [12, 12], [-13, -12], [12, -12], [-40, 0], [40, 0]];

export const REAL_MAPS = {
  factory: {
    id: 'factory', name: 'Фабрика', desc: 'Промышленный квартал: кирпичные цеха, дворы, переулки',
    bounds: FB, spawns: {
      A: [[-44, -4], [-44, -1.5], [-44, 1.5], [-44, 4], [-42, 0], [-46, 2.5], [-46, -2.5]],
      B: [[44, -4], [44, -1.5], [44, 1.5], [44, 4], [42, 0], [46, 2.5], [46, -2.5]],
    },
    points: FACTORY_POINTS, boxes: [], decor: [], paths: [],
    build: buildFactory, kits: [
      'modular_factory_facade', 'modular_urban_apartments_facade', 'modular_fire_escape', 'modular_chainlink_fence', 'modular_electricity_poles',
      'exterior_aircon_unit', 'covered_car', 'concrete_road_barrier', 'concrete_road_barrier_02', 'street_lamp_01', 'fire_hydrant', 'metal_trash_can',
      'utility_box_01', 'utility_box_02', 'water_manhole_cover', 'wooden_crate_01', 'wooden_crate_02', 'Barrel_01', 'Barrel_02', 'barrel_stove',
      'industrial_pastic_container', 'wooden_barrels_01', 'cardboard_box_01', 'metal_jerrycan', 'old_tyre', 'modular_street_seating',
    ],
    ground: 'T|ph_asphalt_02|ffffff|6',
    skyImage: 'assets/hdri/sky_partly_cloudy.jpg', hdri: 'kloofendal_48d_partly_cloudy_puresky_1k',
    sky: { elevation: 48, azimuth: 56, turbidity: 3, rayleigh: 1, mie: 0.005, exposure: 0.8 },
    sun: 0xfff1de, sunI: 3.8, hemi: [0xc4d4ea, 0x8a7a68, 0.7], fog: [0xc4d0dc, 0.0035], envI: 1.15,
    sites: { A: [-26, 27, 5], B: [-26, -27, 5] },
  },
  quarter: {
    id: 'quarter', name: 'Квартал', desc: 'Жилые дома, площадь, парковка во дворе',
    bounds: QB, spawns: {
      A: [[-37, -3], [-37, -1], [-37, 1], [-37, 3], [-35, 0], [-38.5, 2], [-38.5, -2]],
      B: [[37, -3], [37, -1], [37, 1], [37, 3], [35, 0], [38.5, 2], [38.5, -2]],
    },
    points: [[0, 9], [0, -10], [-20, 0], [20, 0], [-20, 27], [-22, -28], [16, 28], [18, -26], [-8, 13], [4, -15], [-34, 0], [34, 0]],
    boxes: [], decor: [], paths: [], build: buildQuarter,
    kits: ['modular_factory_facade', 'modular_urban_apartments_facade', 'modular_fire_escape', 'modular_chainlink_fence', 'exterior_aircon_unit', 'covered_car',
      'concrete_road_barrier', 'concrete_road_barrier_02', 'street_lamp_01', 'street_lamp_02', 'fire_hydrant', 'metal_trash_can', 'utility_box_02', 'water_manhole_cover',
      'wooden_crate_01', 'Barrel_01', 'Barrel_02', 'barrel_stove', 'industrial_pastic_container', 'wooden_barrels_01', 'cardboard_box_01', 'metal_jerrycan', 'old_tyre',
      'modular_street_seating', 'shrub_01', 'shrub_02'],
    ground: 'T|ph_cobblestone_floor_08|ffffff|3',
    skyImage: 'assets/hdri/sky_clear.jpg', hdri: 'kloofendal_43d_clear_puresky_1k',
    sky: { elevation: 43, azimuth: 54, turbidity: 3, rayleigh: 1, mie: 0.005, exposure: 0.8 },
    sun: 0xfff3e2, sunI: 3.9, hemi: [0xc8d8f0, 0x8a7a68, 0.7], fog: [0xc8d6e8, 0.0032], envI: 1.15,
    sites: { A: [-3, 27, 5], B: [-26, -28, 5] },
  },
};
