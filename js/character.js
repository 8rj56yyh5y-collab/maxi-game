// Модель бойца: экипировка, анимация бега/приседа, руки держат оружие (IK).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { buildWeaponModel } from './weapons.js';
import { mergeVertexColors } from './merge.js';
const RB = (w, h, d, r = 0.03) => new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001));

export const TEAM_STYLE = {
  A: { name: 'Спецназ', uniform: 0x45505e, pants: 0x3a4451, vest: 0x22262c, gear: 0x30353c, helmet: 0x2e353e, glove: 0x151515, boot: 0x181818, skin: 0xc99a76, face: 0x1c1c1e, accent: 0x3d8bff, helmetOn: true },
  B: { name: 'Наёмники', uniform: 0x5f5b42, pants: 0x7d6e52, vest: 0x6e5a3e, gear: 0x4a3d2b, helmet: 0x3d3a2c, glove: 0x3a2e22, boot: 0x4a3826, skin: 0xb98262, face: 0xb7a37f, accent: 0xd9452b, helmetOn: false },
};
const FFA_TINTS = [0x6e3434, 0x346e48, 0x5b346e, 0x6e6234, 0x346a6e, 0x6e4a34, 0x40446e, 0x6e346a, 0x4d6e34, 0x6e3448, 0x34406e];

// Точки хвата для рук (в координатах оружия)
const HOLD = {
  ar: { r: [0, -0.055, 0.07], l: [0, 0.035, -0.3] },
  smg: { r: [0, -0.055, 0.06], l: [0, -0.05, -0.155] },
  sniper: { r: [0, -0.055, 0.09], l: [0, 0.02, -0.3] },
  shotgun: { r: [0, -0.055, 0.08], l: [0, 0.02, -0.35] },
  pistol: { r: [0, -0.05, 0.03], l: [-0.03, -0.06, 0.05] },
  knife: { r: [0, 0, -0.04], l: null },
};
const GUN_POS = {
  ar: [0.1, -0.05, -0.3], smg: [0.1, -0.05, -0.3], sniper: [0.1, -0.05, -0.28], shotgun: [0.1, -0.05, -0.3],
  pistol: [0.04, 0.0, -0.42], knife: [0.18, -0.12, -0.3],
};

const matCache = new Map();
function mat(color, rough = 0.85, metal = 0) {
  const k = color + ':' + rough + ':' + metal;
  if (!matCache.has(k)) matCache.set(k, new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal }));
  return matCache.get(k);
}

// Сегмент конечности: вдоль +Z от начала координат
function limbGeo(r0, r1, len) {
  const g = new THREE.CylinderGeometry(r1, r0, len, 10, 1);
  g.rotateX(Math.PI / 2); g.translate(0, 0, len / 2);
  const cap = new THREE.SphereGeometry(r0, 10, 8); // сустав
  return [g, cap];
}
function mesh(geo, m, parent, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(geo, m);
  o.position.set(x, y, z); o.castShadow = true;
  parent.add(o);
  return o;
}

const ZF = new THREE.Vector3(0, 0, 1);
const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpC = new THREE.Vector3(), tmpP = new THREE.Vector3();

export class CharacterModel {
  constructor(team, ffaIndex = -1) {
    const st = { ...(TEAM_STYLE[team] || TEAM_STYLE.A) };
    if (ffaIndex >= 0) { st.uniform = FFA_TINTS[ffaIndex % FFA_TINTS.length]; st.pants = new THREE.Color(st.uniform).multiplyScalar(0.8).getHex(); }
    this.st = st;
    const root = new THREE.Group();
    this.root = root;
    this.hips = new THREE.Group(); this.hips.position.y = 0.95; root.add(this.hips);
    mesh(RB(0.34, 0.22, 0.22, 0.07), mat(st.pants), this.hips, 0, 0.02, 0);
    mesh(RB(0.36, 0.06, 0.24, 0.025), mat(st.gear, 0.7), this.hips, 0, 0.1, 0); // ремень
    mesh(RB(0.07, 0.16, 0.11, 0.02), mat(st.gear, 0.7), this.hips, 0.2, -0.04, 0.02); // кобура

    // Ноги
    this.legs = [];
    for (const sx of [-1, 1]) {
      const thigh = new THREE.Group(); thigh.position.set(sx * 0.1, -0.03, 0); this.hips.add(thigh);
      mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.44, 10), mat(st.pants), thigh, 0, -0.22, 0);
      mesh(RB(0.06, 0.14, 0.12, 0.02), mat(st.pants, 0.9), thigh, sx * 0.075, -0.24, 0); // карман
      const knee = new THREE.Group(); knee.position.y = -0.44; thigh.add(knee);
      mesh(new THREE.CylinderGeometry(0.065, 0.075, 0.42, 10), mat(st.pants), knee, 0, -0.21, 0);
      mesh(RB(0.12, 0.13, 0.06, 0.025), mat(st.gear, 0.6), knee, 0, -0.03, -0.065); // наколенник
      const boot = mesh(RB(0.13, 0.13, 0.28, 0.04), mat(st.boot, 0.6), knee, 0, -0.43, -0.04);
      mesh(RB(0.14, 0.035, 0.29, 0.012), mat(0x0e0e0e, 0.9), boot, 0, -0.06, 0);
      this.legs.push({ thigh, knee });
    }

    // Корпус
    this.spine = new THREE.Group(); this.spine.position.y = 0.1; this.hips.add(this.spine);
    const torso = new THREE.CapsuleGeometry(0.14, 0.26, 4, 10); torso.scale(1.3, 1, 0.8);
    mesh(torso, mat(st.uniform), this.spine, 0, 0.27, 0);
    mesh(RB(0.4, 0.38, 0.29, 0.06), mat(st.vest, 0.75), this.spine, 0, 0.3, 0);
    for (const sx of [-1, 1]) mesh(RB(0.1, 0.05, 0.3, 0.02), mat(st.vest, 0.75), this.spine, sx * 0.13, 0.5, 0);
    for (const px of [-0.12, 0, 0.12]) mesh(RB(0.1, 0.14, 0.07, 0.02), mat(st.gear, 0.7), this.spine, px, 0.2, -0.16);
    mesh(RB(0.12, 0.08, 0.05, 0.015), mat(st.gear, 0.7), this.spine, 0.1, 0.38, -0.155);
    mesh(RB(0.28, 0.3, 0.09, 0.035), mat(st.gear, 0.75), this.spine, 0, 0.3, 0.175); // рюкзак
    const patch = mesh(new THREE.BoxGeometry(0.08, 0.05, 0.01), new THREE.MeshStandardMaterial({ color: st.accent, emissive: st.accent, emissiveIntensity: 0.25 }), this.spine, -0.11, 0.4, -0.145);
    patch.castShadow = false;
    mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.1, 8), mat(st.face), this.spine, 0, 0.52, 0);

    // Голова
    this.head = new THREE.Group(); this.head.position.y = 0.56; this.spine.add(this.head);
    const headG = new THREE.SphereGeometry(0.105, 14, 12); headG.scale(0.92, 1.12, 1);
    mesh(headG, mat(st.skin, 0.8), this.head, 0, 0.1, 0);
    mesh(RB(0.03, 0.03, 0.03, 0.01), mat(st.skin, 0.8), this.head, 0, 0.1, -0.105);
    if (st.helmetOn) {
      const mask = new THREE.SphereGeometry(0.11, 14, 10, 0, Math.PI * 2, Math.PI * 0.52, Math.PI * 0.48); mask.scale(0.95, 1.12, 1.03);
      mesh(mask, mat(st.face, 0.95), this.head, 0, 0.1, 0);
      mesh(RB(0.2, 0.055, 0.06, 0.02), mat(0x0d0d0d, 0.15, 0.6), this.head, 0, 0.14, -0.085);
      const hel = new THREE.SphereGeometry(0.128, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55); hel.scale(1, 0.92, 1.08);
      mesh(hel, mat(st.helmet, 0.6, 0.1), this.head, 0, 0.12, 0.005);
      mesh(RB(0.05, 0.05, 0.05, 0.012), mat(0x1a1a1a, 0.5, 0.3), this.head, 0, 0.215, -0.12);
      for (const sx of [-1, 1]) mesh(RB(0.03, 0.07, 0.11, 0.012), mat(st.gear), this.head, sx * 0.125, 0.15, 0);
    } else {
      // шемаг и кепка
      const wrap = new THREE.SphereGeometry(0.112, 14, 10, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.5); wrap.scale(0.95, 1.1, 1.02);
      mesh(wrap, mat(st.face, 0.95), this.head, 0, 0.09, 0);
      const cap = new THREE.SphereGeometry(0.114, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.45);
      mesh(cap, mat(st.helmet, 0.8), this.head, 0, 0.115, 0);
      mesh(new THREE.BoxGeometry(0.14, 0.015, 0.09), mat(st.helmet, 0.8), this.head, 0, 0.17, -0.13);
      mesh(new THREE.BoxGeometry(0.17, 0.045, 0.04), mat(0x101010, 0.15, 0.7), this.head, 0, 0.13, -0.09); // очки
    }

    // Руки + оружие (всё вращается по вертикали прицела)
    this.aim = new THREE.Group(); this.aim.position.y = 0.42; this.spine.add(this.aim);
    this.gunHolder = new THREE.Group(); this.aim.add(this.gunHolder);
    this.arms = [];
    for (const sx of [1, -1]) {
      const shoulder = new THREE.Vector3(sx * 0.19, 0.02, sx > 0 ? 0.03 : -0.06);
      mesh(new THREE.SphereGeometry(0.075, 10, 8), mat(st.uniform), this.aim, shoulder.x, shoulder.y, shoulder.z);
      const [ug, ucap] = limbGeo(0.064, 0.056, 0.3);
      const upper = new THREE.Group(); this.aim.add(upper);
      mesh(ug, mat(st.uniform), upper); mesh(ucap, mat(st.uniform), upper);
      const [fg, fcap] = limbGeo(0.056, 0.047, 0.29);
      const fore = new THREE.Group(); this.aim.add(fore);
      mesh(fg, mat(st.uniform), fore); mesh(fcap, mat(st.uniform), fore);
      const hand = new THREE.Group(); this.aim.add(hand);
      mesh(RB(0.075, 0.09, 0.11, 0.025), mat(st.glove, 0.7), hand, 0, 0, 0.01);
      this.arms.push({ sx, shoulder, upper, fore, hand });
    }
    // склейка деталей: ~12 объектов вместо ~60
    for (const grp of [this.hips, this.spine, this.head, ...this.legs.flatMap(l => [l.thigh, l.knee]), ...this.arms.flatMap(a => [a.upper, a.fore, a.hand])]) mergeVertexColors(grp);
    mergeVertexColors(this.aim);
    this.weaponId = null;
    this.walkPhase = Math.random() * 10;
    this.deathT = 0;
    this.t = Math.random() * 10;
  }

  setWeapon(id, skin) {
    if (this.weaponId === id && this.skinId === (skin && skin.id)) return;
    this.weaponId = id; this.skinId = skin && skin.id;
    this.gunHolder.clear();
    const gun = buildWeaponModel(id, skin);
    this.gunHolder.add(gun);
    const gp = GUN_POS[id] || GUN_POS.ar;
    this.gunHolder.position.set(gp[0], gp[1], gp[2]);
    this.muzzle = gun.userData.muzzle;
  }

  // 2-звенная IK: плечо → локоть → кисть
  solveArm(arm, target, pole) {
    const S = arm.shoulder, a = 0.3, b = 0.29;
    tmpA.subVectors(target, S);
    let d = tmpA.length();
    d = Math.min(Math.max(d, 0.08), a + b - 0.001);
    const dir = tmpA.normalize();
    const cosA = (a * a + d * d - b * b) / (2 * a * d), sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
    tmpP.copy(pole).addScaledVector(dir, -pole.dot(dir)).normalize();
    const E = tmpB.copy(S).addScaledVector(dir, a * cosA).addScaledVector(tmpP, a * sinA);
    const T = tmpC.copy(S).addScaledVector(dir, d);
    arm.upper.position.copy(S);
    arm.upper.quaternion.setFromUnitVectors(ZF, tmpA.subVectors(E, S).normalize());
    arm.fore.position.copy(E);
    arm.fore.quaternion.setFromUnitVectors(ZF, tmpA.subVectors(T, E).normalize());
    arm.hand.position.copy(T);
    arm.hand.quaternion.copy(arm.fore.quaternion);
  }

  updateArms(knifeSwing = 0) {
    const hold = HOLD[this.weaponId] || HOLD.ar;
    const gp = this.gunHolder.position;
    for (const arm of this.arms) {
      const h = arm.sx > 0 ? hold.r : hold.l;
      let target;
      if (h) target = new THREE.Vector3(gp.x + h[0], gp.y + h[1], gp.z + h[2]);
      else target = new THREE.Vector3(arm.sx * 0.24, -0.38, -0.05); // свободная рука
      if (arm.sx > 0 && this.weaponId === 'knife' && knifeSwing > 0) target.z -= knifeSwing * 0.25;
      const pole = new THREE.Vector3(arm.sx * 0.8, -1, 0.4);
      this.solveArm(arm, target, pole);
    }
  }

  update(dt, a) {
    const r = this.root;
    this.t += dt;
    r.position.set(a.pos.x, a.pos.y, a.pos.z);
    if (!a.alive) {
      this.deathT = Math.min(1, this.deathT + dt * 2.4);
      const e = 1 - Math.pow(1 - this.deathT, 3);
      r.rotation.set(-e * Math.PI / 2 * (this.deathDir || 1) * 0.98, a.yaw, 0, 'YXZ');
      r.position.y = a.pos.y + Math.sin(e * Math.PI) * 0.1 + e * 0.12;
      this.legs[0].knee.rotation.x = -e * 0.5;
      return;
    }
    this.deathT = 0;
    r.rotation.set(0, a.yaw, 0, 'YXZ');
    const speed = Math.hypot(a.vel.x, a.vel.z);
    const c = a.crouchT || 0;
    const amt = Math.min(1, speed / 4.5);
    this.walkPhase += dt * (3 + speed * 1.55);
    const ph = this.walkPhase;
    // локальная скорость (бег назад/вбок)
    const fwd = -(Math.sin(a.yaw) * a.vel.x + Math.cos(a.yaw) * a.vel.z) >= -0.5 ? 1 : -1;
    this.hips.position.y = 0.95 - c * 0.37 + Math.abs(Math.sin(ph)) * 0.035 * amt;
    for (let i = 0; i < 2; i++) {
      const L = this.legs[i], p = ph + i * Math.PI;
      const swing = Math.sin(p) * 0.65 * amt * fwd;
      const bend = Math.max(0, Math.sin(p + Math.PI / 2 * fwd)) * 1.1 * amt + 0.08;
      L.thigh.rotation.x = swing + c * (i ? 1.35 : 0.5);
      L.knee.rotation.x = -bend - c * (i ? 1.7 : 1.9);
      L.thigh.rotation.z = 0;
    }
    if (c > 0.01) { this.legs[1].knee.rotation.x += 0; }
    this.spine.rotation.x = c * 0.18 + amt * 0.08;
    this.spine.position.y = 0.1 + Math.sin(this.t * 2) * 0.004;
    this.aim.rotation.x = a.pitch - this.spine.rotation.x;
    this.head.rotation.x = a.pitch * 0.5;
    // отдача
    const kick = Math.max(0, (a.lastShotT || -9) + 0.08 - (a.timeRef || 0)) * 3;
    this.gunHolder.position.z = (GUN_POS[this.weaponId] || GUN_POS.ar)[2] + kick * 0.04;
    this.updateArms(a.knifeSwing || 0);
  }
}
