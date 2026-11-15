// Описание оружия и сборка 3D-моделей из примитивов.
import * as THREE from 'three';
import { skinTexture } from './textures.js';
import { mergeByMaterial } from './merge.js';


// spread — разброс в радианах. recoil — подброс прицела за выстрел.
export const WEAPONS = {
  ar: {
    id: 'ar', name: 'AR-7 «Шторм»', short: 'AR-7', slot: 0, type: 'rifle',
    damage: 32, headMul: 3.6, legMul: 0.8, rpm: 620, auto: true, mag: 30, reserve: 90, reload: 2.3,
    spread: 0.003, moveSpread: 0.045, airSpread: 0.14, bloomPerShot: 0.0055, maxBloom: 0.045,
    recoil: { up: 0.016, side: 0.006 }, range: 150, falloff: 0.92, zoom: 1.35, speed: 1.0, sound: 'rifle',
  },
  smg: {
    id: 'smg', name: 'VX-9 «Оса»', short: 'VX-9', slot: 0, type: 'smg',
    damage: 23, headMul: 3.2, legMul: 0.85, rpm: 880, auto: true, mag: 28, reserve: 112, reload: 2.0,
    spread: 0.006, moveSpread: 0.02, airSpread: 0.08, bloomPerShot: 0.004, maxBloom: 0.04,
    recoil: { up: 0.009, side: 0.007 }, range: 70, falloff: 0.8, zoom: 1.2, speed: 1.1, sound: 'smg',
  },
  sniper: {
    id: 'sniper', name: 'LR-50 «Сокол»', short: 'LR-50', slot: 0, type: 'sniper',
    damage: 115, headMul: 2.5, legMul: 0.75, rpm: 44, auto: false, mag: 5, reserve: 20, reload: 3.1,
    spread: 0.0004, unscoped: 0.09, moveSpread: 0.1, airSpread: 0.25, bloomPerShot: 0, maxBloom: 0,
    recoil: { up: 0.05, side: 0.01 }, range: 300, falloff: 1, zoom: 4.5, scope: true, speed: 0.88, sound: 'sniper',
  },
  shotgun: {
    id: 'shotgun', name: 'SG-12 «Таран»', short: 'SG-12', slot: 0, type: 'shotgun',
    damage: 17, pellets: 9, pelletSpread: 0.055, headMul: 2.0, legMul: 0.9, rpm: 72, auto: false, mag: 7, reserve: 28, reload: 2.7,
    spread: 0.01, moveSpread: 0.01, airSpread: 0.04, bloomPerShot: 0, maxBloom: 0,
    recoil: { up: 0.045, side: 0.012 }, range: 40, falloff: 0.55, zoom: 1.15, speed: 1.0, sound: 'shotgun',
  },
  pistol: {
    id: 'pistol', name: 'P-12 «Гадюка»', short: 'P-12', slot: 1, type: 'pistol',
    damage: 28, headMul: 3.5, legMul: 0.8, rpm: 380, auto: false, mag: 12, reserve: 48, reload: 1.6,
    spread: 0.004, moveSpread: 0.025, airSpread: 0.1, bloomPerShot: 0.012, maxBloom: 0.04,
    recoil: { up: 0.022, side: 0.006 }, range: 90, falloff: 0.82, zoom: 1.2, speed: 1.06, sound: 'pistol',
  },
  knife: {
    id: 'knife', name: 'Нож «Клык»', short: 'Нож', slot: 2, type: 'knife', melee: true,
    damage: 55, headMul: 1.6, legMul: 1, rpm: 120, auto: true, mag: 0, reserve: 0, reload: 0, range: 2.3,
    spread: 0, moveSpread: 0, airSpread: 0, bloomPerShot: 0, maxBloom: 0, recoil: { up: 0, side: 0 },
    speed: 1.15, sound: 'knife',
  },
};

export const PRIMARIES = ['ar', 'smg', 'sniper', 'shotgun'];

// Высота линии прицеливания (для режима прицела от первого лица)
export const SIGHT = { ar: 0.15, smg: 0.106, sniper: 0.137, shotgun: 0.079, pistol: 0.083, knife: 0 };

const M = {};
function mats() {
  if (M.gun) return M;
  M.gun = new THREE.MeshStandardMaterial({ color: 0x2b2d31, metalness: 0.75, roughness: 0.38 });
  M.dark = new THREE.MeshStandardMaterial({ color: 0x18191b, metalness: 0.6, roughness: 0.45 });
  M.poly = new THREE.MeshStandardMaterial({ color: 0x1e2023, metalness: 0.05, roughness: 0.72 });
  M.rubber = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0, roughness: 0.95 });
  M.wood = new THREE.MeshStandardMaterial({ color: 0x6a4224, metalness: 0, roughness: 0.6 });
  M.steel = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, metalness: 0.95, roughness: 0.22 });
  M.glass = new THREE.MeshStandardMaterial({ color: 0x3a6a8a, metalness: 0.2, roughness: 0.1, transparent: true, opacity: 0.12, depthWrite: false, envMapIntensity: 0.2 });
  M.dot = new THREE.MeshBasicMaterial({ color: 0xff2020 });
  M.brass = new THREE.MeshStandardMaterial({ color: 0xc9a043, metalness: 0.9, roughness: 0.3 });
  M.tube = new THREE.MeshStandardMaterial({ color: 0x1d1e20, metalness: 0.6, roughness: 0.4, side: THREE.DoubleSide });
  return M;
}

export function skinMaterial(skin, weaponId) {
  if (!skin) {
    const base = { ar: 0x3d3a33, smg: 0x2a2c2f, sniper: 0x4a4636, shotgun: 0x2e2f31, pistol: 0x28292c, knife: 0xb8bcc0 }[weaponId] || 0x333333;
    return new THREE.MeshStandardMaterial({ color: base, metalness: weaponId === 'knife' ? 0.95 : 0.35, roughness: weaponId === 'knife' ? 0.25 : 0.55 });
  }
  return new THREE.MeshStandardMaterial({
    map: skinTexture(skin), metalness: weaponId === 'knife' ? 0.7 : 0.3, roughness: 0.42,
    emissive: skin.glow ? new THREE.Color(skin.glow) : 0x000000, emissiveIntensity: skin.glow ? 0.35 : 0,
    emissiveMap: skin.glow ? skinTexture(skin) : null,
  });
}

// Профиль в координатах (u — вперёд, v — вверх), выдавленный по ширине
function prof(parent, mat, pts, width, bevel = 0.003, x = 0) {
  const shape = new THREE.Shape(pts.map(([u, v]) => new THREE.Vector2(u, v)));
  const depth = Math.max(0.001, width - bevel * 2);
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 8 });
  geo.translate(0, 0, -depth / 2);
  geo.rotateY(Math.PI / 2);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 3, uv.getY(i) * 3);
  const m = new THREE.Mesh(geo, mat);
  m.position.x = x;
  parent.add(m);
  return m;
}
// Цилиндр вдоль оси ствола
function cyl(parent, mat, r, u0, u1, v, x = 0, r2 = r, seg = 14, open = false) {
  const g = new THREE.CylinderGeometry(r2, r, Math.abs(u1 - u0), seg, 1, open);
  g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, mat);
  m.position.set(x, v, -(u0 + u1) / 2);
  parent.add(m);
  return m;
}
function bx(parent, mat, u0, u1, v0, v1, w, x = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, v1 - v0, u1 - u0), mat);
  m.position.set(x, (v0 + v1) / 2, -(u0 + u1) / 2);
  parent.add(m);
  return m;
}
function rail(g, u0, u1, v, w = 0.024) {
  const { gun } = mats();
  bx(g, gun, u0, u1, v, v + 0.012, w);
  for (let u = u0 + 0.006; u < u1 - 0.004; u += 0.014) bx(g, gun, u, u + 0.007, v + 0.012, v + 0.018, w * 1.15);
}
function grip(g, mat, u = 0) {
  prof(g, mat, [[-0.06 + u, 0.0], [-0.02 + u, 0.0], [-0.042 + u, -0.06], [-0.05 + u, -0.115], [-0.098 + u, -0.118], [-0.09 + u, -0.06]], 0.033, 0.004);
  // насечки
  for (let k = 0; k < 4; k++) bx(g, mats().rubber, -0.085 + u + k * 0.005, -0.08 + u + k * 0.005, -0.1 + k * 0.022, -0.095 + k * 0.022, 0.035);
}
function trigger(g, u = 0) {
  const { gun, dark } = mats();
  prof(g, gun, [[-0.02 + u, -0.003], [0.045 + u, -0.003], [0.045 + u, -0.04], [-0.02 + u, -0.04], [-0.02 + u, -0.035], [0.04 + u, -0.035], [0.04 + u, -0.008], [-0.02 + u, -0.008]], 0.01, 0.001);
  prof(g, dark, [[0.008 + u, -0.004], [0.016 + u, -0.004], [0.012 + u, -0.028], [0.006 + u, -0.026]], 0.006, 0.001);
}

export function buildWeaponModel(id, skin) {
  const { gun, dark, poly, rubber, wood, steel, glass, dot, tube } = mats();
  const s = skinMaterial(skin, id);
  const g = new THREE.Group();
  const muzzle = new THREE.Object3D();
  switch (id) {
    case 'ar': {
      prof(g, s, [[-0.13, -0.005], [0.13, -0.005], [0.15, 0.02], [0.15, 0.056], [-0.13, 0.056]], 0.048);       // нижний ресивер
      prof(g, s, [[-0.145, 0.056], [0.2, 0.056], [0.2, 0.1], [-0.12, 0.1], [-0.145, 0.088]], 0.052);          // верхний ресивер
      prof(g, s, [[0.19, 0.03], [0.5, 0.036], [0.5, 0.098], [0.19, 0.1]], 0.058, 0.005);                       // цевьё
      for (let u = 0.24; u < 0.47; u += 0.045) for (const sx of [-1, 1]) bx(g, dark, u, u + 0.028, 0.055, 0.075, 0.004, sx * 0.03);
      rail(g, -0.12, 0.49, 0.1);
      cyl(g, gun, 0.0115, 0.49, 0.67, 0.07);
      bx(g, gun, 0.52, 0.55, 0.055, 0.085, 0.03);                                                             // газовый блок
      cyl(g, dark, 0.017, 0.64, 0.71, 0.07, 0, 0.017, 8);                                                       // ДТК
      prof(g, s, [[0.02, 0.0], [0.115, 0.0], [0.115, -0.032], [0.02, -0.032]], 0.044);                          // приёмник магазина
      prof(g, poly, [[0.03, -0.02], [0.105, -0.02], [0.12, -0.09], [0.145, -0.19], [0.08, -0.205], [0.055, -0.1]], 0.03, 0.003); // магазин
      for (let k = 0; k < 5; k++) bx(g, rubber, 0.06 + k * 0.012, 0.064 + k * 0.012, -0.05 - k * 0.025, -0.045 - k * 0.025, 0.032);
      grip(g, poly);
      trigger(g);
      cyl(g, gun, 0.016, -0.32, -0.13, 0.065);                                                                  // буферная трубка
      prof(g, poly, [[-0.2, 0.09], [-0.2, 0.03], [-0.33, -0.035], [-0.395, -0.045], [-0.4, 0.095], [-0.3, 0.1]], 0.042, 0.005); // приклад
      bx(g, rubber, -0.41, -0.395, -0.045, 0.095, 0.044);
      bx(g, dark, 0.0, 0.08, 0.062, 0.09, 0.003, 0.027);                                                        // окно экстракции
      bx(g, gun, -0.15, -0.12, 0.085, 0.1, 0.03);                                                               // рукоять затвора
      // коллиматор
      bx(g, gun, -0.01, 0.07, 0.118, 0.13, 0.03);
      cyl(g, tube, 0.022, 0.0, 0.075, 0.152, 0, 0.022, 20, true);
      const lens = cyl(g, glass, 0.02, 0.06, 0.062, 0.152, 0, 0.02, 20);
      lens.renderOrder = 2;
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.0012, 8, 6), dot); d.position.set(0, 0.15, -0.061); g.add(d);
      muzzle.position.set(0, 0.07, -0.72);
      break;
    }
    case 'smg': {
      prof(g, s, [[-0.09, 0.0], [0.2, 0.0], [0.225, 0.02], [0.225, 0.088], [-0.09, 0.088]], 0.05, 0.005);
      cyl(g, gun, 0.019, 0.22, 0.31, 0.058, 0, 0.019, 14);
      for (let u = 0.235; u < 0.3; u += 0.02) cyl(g, dark, 0.02, u, u + 0.006, 0.058);
      cyl(g, gun, 0.009, 0.3, 0.335, 0.058);
      prof(g, poly, [[0.035, -0.005], [0.085, -0.005], [0.095, -0.17], [0.045, -0.17]], 0.028, 0.003);
      bx(g, rubber, 0.04, 0.1, -0.175, -0.165, 0.032);
      grip(g, poly, 0.01);
      trigger(g, 0.01);
      prof(g, poly, [[0.135, -0.002], [0.175, -0.002], [0.17, -0.085], [0.14, -0.085]], 0.03, 0.004);    // передняя рукоять
      bx(g, gun, -0.32, -0.09, 0.068, 0.078, 0.012, 0.016); bx(g, gun, -0.32, -0.09, 0.068, 0.078, 0.012, -0.016);
      bx(g, gun, -0.32, -0.09, 0.005, 0.015, 0.012, 0.016); bx(g, gun, -0.32, -0.09, 0.005, 0.015, 0.012, -0.016);
      bx(g, rubber, -0.335, -0.315, -0.005, 0.09, 0.046);
      rail(g, -0.07, 0.19, 0.088, 0.022);
      // механический прицел
      bx(g, gun, -0.07, -0.055, 0.1, 0.112, 0.006, 0.008); bx(g, gun, -0.07, -0.055, 0.1, 0.112, 0.006, -0.008);
      bx(g, gun, 0.18, 0.19, 0.1, 0.108, 0.0035);
      bx(g, dark, 0.0, 0.07, 0.05, 0.075, 0.003, 0.026);
      muzzle.position.set(0, 0.058, -0.34);
      break;
    }
    case 'sniper': {
      prof(g, s, [[-0.12, 0.0], [0.42, 0.005], [0.42, 0.062], [-0.12, 0.068]], 0.058, 0.006);                           // шасси
      prof(g, s, [[-0.12, 0.068], [-0.12, -0.0], [-0.24, -0.03], [-0.47, -0.075], [-0.5, -0.075], [-0.5, 0.085], [-0.3, 0.08], [-0.2, 0.07]], 0.05, 0.006);
      bx(g, rubber, -0.515, -0.5, -0.075, 0.085, 0.052);
      prof(g, poly, [[-0.33, 0.085], [-0.22, 0.073], [-0.22, 0.095], [-0.33, 0.1]], 0.03, 0.004);                       // щека
      grip(g, poly, -0.02);
      trigger(g, -0.02);
      cyl(g, gun, 0.016, 0.4, 0.98, 0.04, 0, 0.012, 14);
      bx(g, dark, 0.95, 1.02, 0.022, 0.058, 0.036);
      for (const sx of [-1, 1]) bx(g, gun, 0.96, 1.01, 0.03, 0.05, 0.002, sx * 0.019);
      prof(g, poly, [[0.04, 0.0], [0.11, 0.0], [0.11, -0.06], [0.04, -0.06]], 0.04, 0.003);
      // затвор
      cyl(g, steel, 0.012, -0.08, 0.06, 0.08, 0.012);
      const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.06, 8), steel); bolt.rotation.z = Math.PI / 2; bolt.position.set(0.045, 0.075, 0.06); g.add(bolt);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.011, 10, 8), dark); knob.position.set(0.075, 0.072, 0.06); g.add(knob);
      // оптика
      cyl(g, gun, 0.02, -0.11, 0.2, 0.137);
      cyl(g, gun, 0.021, 0.2, 0.28, 0.137, 0, 0.03);
      cyl(g, gun, 0.021, -0.2, -0.11, 0.137, 0, 0.024);
      cyl(g, glass, 0.028, 0.278, 0.282, 0.137); cyl(g, glass, 0.022, -0.202, -0.198, 0.137);
      const t1 = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.025, 12), gun); t1.position.set(0, 0.168, -0.04); g.add(t1);
      const t2 = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.025, 12), gun); t2.rotation.z = Math.PI / 2; t2.position.set(0.032, 0.137, -0.04); g.add(t2);
      bx(g, dark, -0.07, -0.04, 0.068, 0.125, 0.026); bx(g, dark, 0.1, 0.13, 0.068, 0.125, 0.026);
      // сошки
      for (const sx of [-1, 1]) { const l = cyl(g, dark, 0.005, 0.32, 0.55, 0.005, sx * 0.012); l.rotation.z = 0; }
      muzzle.position.set(0, 0.04, -1.02);
      break;
    }
    case 'shotgun': {
      prof(g, s, [[-0.11, 0.0], [0.16, 0.0], [0.16, 0.076], [-0.09, 0.076], [-0.11, 0.06]], 0.054, 0.005);
      cyl(g, gun, 0.0145, 0.15, 0.64, 0.057);
      cyl(g, gun, 0.0135, 0.15, 0.56, 0.022);
      bx(g, gun, 0.55, 0.57, 0.015, 0.065, 0.02);
      const pump = cyl(g, s, 0.024, 0.26, 0.44, 0.022, 0, 0.024, 16);
      for (let u = 0.275; u < 0.43; u += 0.018) cyl(g, rubber, 0.0255, u, u + 0.007, 0.022);
      void pump;
      grip(g, poly, -0.01);
      trigger(g, -0.01);
      prof(g, s, [[-0.11, 0.07], [-0.11, 0.0], [-0.24, -0.03], [-0.43, -0.065], [-0.45, -0.065], [-0.45, 0.075], [-0.3, 0.075]], 0.046, 0.006);
      bx(g, rubber, -0.465, -0.45, -0.065, 0.075, 0.05);
      const bead = new THREE.Mesh(new THREE.SphereGeometry(0.004, 8, 6), steel); bead.position.set(0, 0.075, -0.63); g.add(bead);
      bx(g, dark, 0.0, 0.08, 0.035, 0.06, 0.003, 0.027);
      bx(g, gun, -0.06, 0.15, 0.076, 0.082, 0.008);
      muzzle.position.set(0, 0.057, -0.65);
      break;
    }
    case 'pistol': {
      prof(g, s, [[-0.035, 0.04], [0.165, 0.04], [0.165, 0.074], [-0.028, 0.076], [-0.038, 0.066]], 0.028, 0.003);   // затвор
      for (let k = 0; k < 6; k++) bx(g, dark, -0.03 + k * 0.007, -0.027 + k * 0.007, 0.045, 0.07, 0.03);
      prof(g, poly, [[-0.025, 0.002], [0.15, 0.012], [0.15, 0.04], [-0.03, 0.04]], 0.026, 0.003);                     // рамка
      prof(g, poly, [[-0.03, 0.01], [0.02, 0.01], [0.006, -0.1], [-0.046, -0.104], [-0.048, -0.03]], 0.03, 0.004);    // рукоять
      for (let k = 0; k < 6; k++) bx(g, rubber, -0.04 + k * 0.004, -0.036 + k * 0.004, -0.09 + k * 0.016, -0.084 + k * 0.016, 0.032);
      trigger(g, 0.015);
      cyl(g, steel, 0.006, 0.16, 0.168, 0.058);
      bx(g, dark, -0.028, -0.018, 0.076, 0.086, 0.004, 0.007); bx(g, dark, -0.028, -0.018, 0.076, 0.086, 0.004, -0.007);
      bx(g, dark, 0.148, 0.156, 0.076, 0.085, 0.004);
      bx(g, dark, 0.03, 0.07, 0.056, 0.072, 0.003, 0.0145);
      muzzle.position.set(0, 0.058, -0.17);
      break;
    }
    case 'knife': {
      prof(g, poly, [[-0.12, -0.011], [-0.005, -0.014], [-0.005, 0.014], [-0.12, 0.012], [-0.13, 0.0]], 0.024, 0.004);
      for (let k = 0; k < 5; k++) bx(g, rubber, -0.105 + k * 0.02, -0.095 + k * 0.02, -0.015, 0.015, 0.026);
      prof(g, gun, [[-0.005, -0.026], [0.006, -0.026], [0.006, 0.024], [-0.005, 0.024]], 0.03, 0.002);
      prof(g, s, [[0.006, -0.012], [0.17, -0.012], [0.235, 0.004], [0.245, 0.016], [0.2, 0.016], [0.17, 0.012], [0.006, 0.014]], 0.005, 0.0012);
      bx(g, dark, 0.02, 0.15, 0.0, 0.004, 0.0062);
      cyl(g, gun, 0.012, -0.14, -0.125, 0.0);
      muzzle.position.set(0, 0, -0.25);
      break;
    }
  }
  mergeByMaterial(g);
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; } });
  g.add(muzzle);
  g.userData.muzzle = muzzle;
  return g;
}
