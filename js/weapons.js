// Описание оружия и сборка 3D-моделей из примитивов.
import * as THREE from 'three';
import { skinTexture } from './textures.js';

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

const metal = new THREE.MeshLambertMaterial({ color: 0x24262a });
const metal2 = new THREE.MeshLambertMaterial({ color: 0x3a3d42 });
const wood = new THREE.MeshLambertMaterial({ color: 0x6b4a2b });
const glass = new THREE.MeshLambertMaterial({ color: 0x66ccff, emissive: 0x113344 });

export function skinMaterial(skin) {
  if (!skin) return new THREE.MeshLambertMaterial({ color: 0x4a4e55 });
  return new THREE.MeshLambertMaterial({ map: skinTexture(skin), emissive: skin.glow ? new THREE.Color(skin.glow) : 0x000000, emissiveIntensity: skin.glow ? 0.25 : 0 });
}

function box(w, h, d, mat, x, y, z, parent, rx = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); m.rotation.x = rx;
  parent.add(m);
  return m;
}
function cyl(r, len, mat, x, y, z, parent) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 8), mat);
  m.rotation.x = Math.PI / 2; m.position.set(x, y, z);
  parent.add(m);
  return m;
}

// Модель направлена стволом в -Z. Начало координат — у рукояти.
export function buildWeaponModel(id, skin) {
  const g = new THREE.Group();
  const s = skinMaterial(skin);
  const muzzle = new THREE.Object3D();
  switch (id) {
    case 'ar':
      box(0.07, 0.1, 0.46, s, 0, 0.05, -0.12, g);           // ствольная коробка
      box(0.06, 0.07, 0.26, s, 0, 0.04, -0.46, g);          // цевьё
      cyl(0.014, 0.22, metal, 0, 0.055, -0.68, g);          // ствол
      box(0.05, 0.16, 0.07, metal, 0, -0.06, -0.18, g, 0.25); // магазин
      box(0.045, 0.11, 0.05, metal2, 0, -0.04, 0.02, g, -0.3); // рукоять
      box(0.06, 0.09, 0.22, s, 0, 0.03, 0.2, g);            // приклад
      box(0.03, 0.04, 0.12, metal, 0, 0.12, -0.1, g);       // прицел
      muzzle.position.set(0, 0.055, -0.8);
      break;
    case 'smg':
      box(0.07, 0.1, 0.34, s, 0, 0.04, -0.08, g);
      cyl(0.016, 0.14, metal, 0, 0.05, -0.32, g);
      box(0.04, 0.2, 0.05, metal, 0, -0.1, -0.12, g);
      box(0.045, 0.1, 0.05, metal2, 0, -0.04, 0.03, g, -0.25);
      box(0.02, 0.05, 0.2, metal, 0, 0.05, 0.18, g);
      box(0.03, 0.03, 0.06, metal, 0, 0.1, -0.08, g);
      muzzle.position.set(0, 0.05, -0.4);
      break;
    case 'sniper':
      box(0.07, 0.1, 0.5, s, 0, 0.04, -0.1, g);
      cyl(0.016, 0.5, metal, 0, 0.06, -0.6, g);
      box(0.06, 0.12, 0.3, s, 0, 0.0, 0.26, g);
      box(0.045, 0.1, 0.05, metal2, 0, -0.04, 0.03, g, -0.3);
      box(0.05, 0.09, 0.07, metal, 0, -0.05, -0.12, g);
      cyl(0.03, 0.3, metal, 0, 0.15, -0.08, g);
      cyl(0.034, 0.02, glass, 0, 0.15, -0.24, g);
      muzzle.position.set(0, 0.06, -0.86);
      break;
    case 'shotgun':
      box(0.075, 0.1, 0.4, s, 0, 0.04, -0.1, g);
      cyl(0.022, 0.42, metal, 0, 0.07, -0.5, g);
      cyl(0.018, 0.34, metal2, 0, 0.02, -0.44, g);
      box(0.07, 0.06, 0.14, wood, 0, 0.02, -0.4, g);
      box(0.045, 0.1, 0.05, metal2, 0, -0.04, 0.03, g, -0.3);
      box(0.06, 0.1, 0.24, s, 0, 0.02, 0.22, g);
      muzzle.position.set(0, 0.07, -0.72);
      break;
    case 'pistol':
      box(0.045, 0.06, 0.2, s, 0, 0.07, -0.06, g);
      box(0.04, 0.12, 0.05, metal2, 0, -0.01, 0.01, g, -0.2);
      cyl(0.01, 0.03, metal, 0, 0.07, -0.17, g);
      muzzle.position.set(0, 0.07, -0.19);
      break;
    case 'knife': {
      box(0.03, 0.035, 0.12, metal2, 0, 0, 0.02, g);
      box(0.06, 0.02, 0.015, metal, 0, 0, -0.045, g);
      const blade = box(0.006, 0.04, 0.2, s, 0, 0.005, -0.15, g);
      blade.scale.set(1, 1, 1);
      box(0.006, 0.015, 0.06, s, 0, 0.02, -0.27, g, -0.5);
      muzzle.position.set(0, 0, -0.3);
      break;
    }
  }
  g.add(muzzle);
  g.userData.muzzle = muzzle;
  return g;
}
