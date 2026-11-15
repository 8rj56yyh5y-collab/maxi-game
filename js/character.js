// Модель бойца из примитивов + простая анимация.
import * as THREE from 'three';
import { buildWeaponModel } from './weapons.js';

export const TEAM_STYLE = {
  A: { name: 'Спецназ', body: 0x34506e, vest: 0x22313f, skin: 0xd9a77c, helmet: 0x1d2a36, accent: 0x4da3ff },
  B: { name: 'Наёмники', body: 0x8a6a45, vest: 0x5a4128, skin: 0xc58b62, helmet: 0x3b2a1a, accent: 0xff5a3c },
};
// В режиме «каждый сам за себя» — разные цвета
const FFA_COLORS = [0x6e3434, 0x346e48, 0x5b346e, 0x6e6234, 0x346a6e, 0x6e4a34, 0x40446e, 0x6e346a, 0x4d6e34, 0x6e3448, 0x34406e];

function part(w, h, d, color, parent, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color }));
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}

export class CharacterModel {
  constructor(team, ffaIndex = -1) {
    const st = { ...TEAM_STYLE[team] || TEAM_STYLE.A };
    if (ffaIndex >= 0) { st.body = FFA_COLORS[ffaIndex % FFA_COLORS.length]; st.vest = 0x2a2a2a; }
    const root = new THREE.Group();
    this.root = root;
    // Ноги — с шарниром у бедра
    this.legL = new THREE.Group(); this.legL.position.set(-0.12, 0.85, 0); root.add(this.legL);
    this.legR = new THREE.Group(); this.legR.position.set(0.12, 0.85, 0); root.add(this.legR);
    part(0.17, 0.85, 0.2, st.body, this.legL, 0, -0.42, 0);
    part(0.17, 0.85, 0.2, st.body, this.legR, 0, -0.42, 0);
    part(0.18, 0.1, 0.28, 0x1b1b1b, this.legL, 0, -0.8, -0.04);
    part(0.18, 0.1, 0.28, 0x1b1b1b, this.legR, 0, -0.8, -0.04);
    // Торс
    this.torso = new THREE.Group(); this.torso.position.set(0, 0.85, 0); root.add(this.torso);
    part(0.46, 0.6, 0.26, st.body, this.torso, 0, 0.3, 0);
    part(0.5, 0.42, 0.32, st.vest, this.torso, 0, 0.34, 0);
    // Голова
    this.head = new THREE.Group(); this.head.position.set(0, 0.62, 0); this.torso.add(this.head);
    part(0.24, 0.26, 0.24, st.skin, this.head, 0, 0.13, 0);
    part(0.28, 0.12, 0.29, st.helmet, this.head, 0, 0.27, 0.01);
    part(0.2, 0.05, 0.02, 0x111111, this.head, 0, 0.16, -0.125);
    const stripe = part(0.29, 0.03, 0.3, st.accent, this.head, 0, 0.22, 0.01);
    stripe.castShadow = false;
    // Руки держат оружие
    this.arms = new THREE.Group(); this.arms.position.set(0, 0.5, 0); this.torso.add(this.arms);
    const armR = part(0.12, 0.12, 0.45, st.body, this.arms, 0.2, -0.05, -0.15);
    const armL = part(0.12, 0.12, 0.5, st.body, this.arms, -0.1, -0.05, -0.28);
    armL.rotation.y = 0.5; armR.rotation.y = -0.1;
    this.gunHolder = new THREE.Group(); this.gunHolder.position.set(0.08, -0.02, -0.38); this.arms.add(this.gunHolder);
    this.weaponId = null;
    this.walkPhase = Math.random() * 10;
    this.deathT = 0;
  }

  setWeapon(id, skin) {
    if (this.weaponId === id) return;
    this.weaponId = id;
    this.gunHolder.clear();
    const gun = buildWeaponModel(id, skin);
    gun.traverse(o => { if (o.isMesh) o.castShadow = true; });
    this.gunHolder.add(gun);
    this.muzzle = gun.userData.muzzle;
  }

  update(dt, a) {
    const r = this.root;
    r.position.set(a.pos.x, a.pos.y, a.pos.z);
    if (!a.alive) {
      this.deathT = Math.min(1, this.deathT + dt * 3);
      r.rotation.x = -this.deathT * Math.PI / 2 * (this.deathDir || 1);
      r.position.y = a.pos.y + this.deathT * 0.15;
      return;
    }
    this.deathT = 0; r.rotation.x = 0;
    r.rotation.y = a.yaw;
    const speed = Math.hypot(a.vel.x, a.vel.z);
    const crouch = a.crouchT || 0;
    this.walkPhase += dt * speed * 1.6;
    const swing = Math.sin(this.walkPhase) * Math.min(1, speed / 4) * 0.7;
    this.legL.rotation.x = swing - crouch * 0.9;
    this.legR.rotation.x = -swing - crouch * 0.9;
    this.legL.position.y = this.legR.position.y = 0.85 - crouch * 0.3;
    this.torso.position.y = 0.85 - crouch * 0.45;
    this.torso.rotation.x = crouch * 0.15;
    // наклон рук по вертикали прицела
    this.arms.rotation.x = a.pitch;
    this.head.rotation.x = a.pitch * 0.6;
  }
}
