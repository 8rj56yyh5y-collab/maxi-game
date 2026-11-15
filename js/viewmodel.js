// Оружие в руках (вид от первого лица). Отдельная сцена поверх мира.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { buildWeaponModel } from './weapons.js';
import { WEAPONS, KNIVES } from './data.js';
import { TEAM_STYLE } from './character.js';
import { surface } from './textures.js';

// Положение точки хвата относительно глаза
const HIP = { pistol: [0.09, -0.105, -0.3], smg: [0.105, -0.13, -0.24], rifle: [0.105, -0.135, -0.22], sniper: [0.105, -0.13, -0.2], shotgun: [0.105, -0.13, -0.23], knife: [0.12, -0.12, -0.24], grenade: [0.12, -0.12, -0.25] };
const ADS_Z = { pistol: -0.3, smg: -0.15, rifle: -0.14, sniper: -0.1, shotgun: -0.16 };

function category(id) {
  if (KNIVES[id]) return 'knife';
  if (['he', 'flash', 'smoke'].includes(id)) return 'grenade';
  return WEAPONS[id] ? WEAPONS[id].cat : 'rifle';
}

let clothMat = null;
function sleeveMaterial(color) {
  if (!clothMat) clothMat = surface('cloth');
  return new THREE.MeshStandardMaterial({ color, normalMap: clothMat.normalMap, roughness: 0.92 });
}

export class ViewModel {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(58, 1, 0.01, 10);
    this.hemi = new THREE.HemisphereLight(0xdfe8f5, 0x5a4a3a, 0.9);
    this.scene.add(this.hemi);
    this.key = new THREE.DirectionalLight(0xfff2dc, 2.2); this.key.position.set(0.6, 1, 0.4); this.scene.add(this.key);
    const rim = new THREE.DirectionalLight(0xbcd2ff, 0.8); rim.position.set(-0.8, 0.3, -0.6); this.scene.add(rim);
    this.holder = new THREE.Group(); this.scene.add(this.holder);
    this.pivot = new THREE.Group(); this.holder.add(this.pivot);
    // вспышка
    const flashMat = new THREE.MeshBasicMaterial({ color: 0xffc36b, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    this.flash = new THREE.Group();
    for (let i = 0; i < 3; i++) { const p = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.05), flashMat); p.rotation.z = i * Math.PI / 3; this.flash.add(p); }
    const side = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 0.16), flashMat); side.rotation.y = Math.PI / 2; side.position.z = -0.05; this.flash.add(side);
    const side2 = side.clone(); side2.rotation.set(Math.PI / 2, Math.PI / 2, 0); this.flash.add(side2);
    this.flash.visible = false;
    this.flashLight = new THREE.PointLight(0xffb060, 0, 1.5, 2);
    this.scene.add(this.flashLight);
    // гильзы
    this.shells = [];
    const shellGeo = new THREE.CylinderGeometry(0.0045, 0.0045, 0.022, 8);
    const shellMat = new THREE.MeshStandardMaterial({ color: 0xc9a043, metalness: 1, roughness: 0.3 });
    for (let i = 0; i < 10; i++) { const m = new THREE.Mesh(shellGeo, shellMat); m.visible = false; this.scene.add(m); this.shells.push({ m, v: new THREE.Vector3(), w: new THREE.Vector3(), t: 0 }); }
    this.si = 0;
    this.id = null;
    this.t = 0; this.kick = 0; this.kickRot = 0; this.swayX = 0; this.swayY = 0;
    this.switchT = 0; this.reloadT = 0; this.reloadDur = 1; this.knifeT = 0; this.flashT = 0; this.aimT = 0; this.boltT = 0; this.throwT = 0;
    this.inspectT = 0;
  }

  setEnvironment(env, sunColor, intensity = 0.6) {
    this.scene.environment = env;
    this.scene.environmentIntensity = intensity;
    if (sunColor !== undefined) this.key.color.set(sunColor);
  }

  setWeapon(id, skin, team) {
    this.id = id; this.cat = category(id);
    this.pivot.clear();
    const gun = buildWeaponModel(id, skin);
    const ud = gun.userData;
    gun.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
    // хват правой руки — в начале координат pivot
    gun.position.copy(ud.gripR).multiplyScalar(-1);
    this.pivot.add(gun);
    this.gun = gun;
    this.ud = ud;
    this.sightOff = (ud.sightY || 0) - (ud.gripR ? ud.gripR.y : 0);
    const st = TEAM_STYLE[team] || TEAM_STYLE.A;
    const sleeve = sleeveMaterial(st.uniform);
    const cuff = new THREE.MeshStandardMaterial({ color: st.gear, roughness: 0.8 });
    const glove = new THREE.MeshStandardMaterial({ color: st.glove, roughness: 0.62, metalness: 0.05 });
    const knuckle = new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.5 });
    const seg = (a, b, r0, r1, m, parent = this.pivot) => {
      const len = a.distanceTo(b);
      const g = new THREE.CylinderGeometry(r1, r0, len, 14); g.rotateX(Math.PI / 2); g.translate(0, 0, len / 2);
      const mesh = new THREE.Mesh(g, m);
      mesh.position.copy(a); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), b.clone().sub(a).normalize());
      parent.add(mesh);
      return mesh;
    };
    const hand = (H, dir, right, parent) => {
      const g = new THREE.Group(); g.position.copy(H);
      g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
      const palm = new THREE.Mesh(new RoundedBoxGeometry(0.07, 0.085, 0.09, 2, 0.02), glove); palm.position.set(right ? 0.012 : -0.012, 0, 0.03); g.add(palm);
      const k = new THREE.Mesh(new RoundedBoxGeometry(0.02, 0.07, 0.03, 2, 0.008), knuckle); k.position.set(right ? 0.044 : -0.044, 0.005, 0.025); g.add(k);
      for (let f = 0; f < 4; f++) {
        const f1 = new THREE.Mesh(new RoundedBoxGeometry(0.02, 0.019, 0.04, 2, 0.008), glove);
        f1.position.set((right ? -1 : 1) * 0.028, 0.03 - f * 0.02, 0.0); f1.rotation.y = (right ? 1 : -1) * 0.9; g.add(f1);
      }
      const th = new THREE.Mesh(new RoundedBoxGeometry(0.022, 0.022, 0.06, 2, 0.009), glove); th.position.set((right ? 1 : -1) * 0.03, 0.045, -0.005); th.rotation.x = 0.3; g.add(th);
      parent.add(g);
      return g;
    };
    const mkArm = (H, E, S, right) => {
      const dirFore = E.clone().sub(H).normalize();
      const grp = new THREE.Group(); this.pivot.add(grp);
      hand(H, dirFore, right, grp);
      const wrist = H.clone().addScaledVector(dirFore, 0.075);
      seg(wrist, wrist.clone().addScaledVector(dirFore, 0.03), 0.042, 0.042, right ? knuckle : cuff, grp);
      seg(wrist.clone().addScaledVector(dirFore, 0.03), E, 0.05, 0.062, sleeve, grp);
      seg(wrist.clone().addScaledVector(dirFore, 0.02), wrist.clone().addScaledVector(dirFore, 0.07), 0.058, 0.058, cuff, grp);
      const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.064, 14, 10), sleeve); elbow.position.copy(E); grp.add(elbow);
      seg(E, S, 0.064, 0.075, sleeve, grp);
      return grp;
    };
    const R = new THREE.Vector3(0, 0, 0);
    this.rightArm = mkArm(R, new THREE.Vector3(0.08, -0.17, 0.25), new THREE.Vector3(0.14, -0.45, 0.62), true);
    this.leftArm = null;
    if (ud.gripL) {
      const L = ud.gripL.clone().sub(ud.gripR);
      const E = this.cat === 'pistol' ? new THREE.Vector3(-0.1, -0.17, 0.22) : new THREE.Vector3(L.x - 0.16, L.y - 0.2, L.z + 0.2);
      this.leftArm = mkArm(L, E, new THREE.Vector3(-0.3, -0.48, 0.4), false);
      this.leftRest = this.leftArm.position.clone();
    }
    this.muzzle = ud.muzzle;
    this.muzzle.add(this.flash);
    this.switchT = 1; this.reloadT = 0; this.boltT = 0; this.throwT = 0;
  }

  shoot(recoil) {
    this.kick = Math.min(1, this.kick + 0.5 + recoil * 9);
    this.kickRot = Math.min(1, this.kickRot + 0.4 + recoil * 7);
    if (this.cat === 'knife') { this.knifeT = 1; return; }
    if (this.cat === 'grenade') { this.throwT = 1; return; }
    this.flashT = 0.045;
    this.flash.rotation.z = Math.random() * Math.PI;
    this.flash.scale.setScalar(0.7 + Math.random() * 0.6);
    if (WEAPONS[this.id] && WEAPONS[this.id].bolt) this.boltT = 1;
    // гильза
    const s = this.shells[this.si++ % this.shells.length];
    this.gun.updateMatrixWorld(true);
    s.m.position.copy(this.gun.localToWorld(new THREE.Vector3(0.02, this.ud.gripR.y + 0.06, this.ud.gripR.z - 0.07)));
    s.v.set(0.9 + Math.random() * 0.5, 0.9 + Math.random() * 0.4, 0.3);
    s.w.set(Math.random() * 20, Math.random() * 20, 0);
    s.t = 0.6; s.m.visible = this.cat !== 'shotgun' || true;
  }

  startReload(dur) { this.reloadT = dur; this.reloadDur = dur; }
  cancelReload() { this.reloadT = 0; }
  inspect() { if (this.reloadT <= 0) this.inspectT = 2.2; }

  update(dt, { moveSpeed, onGround, lookDX, lookDY, aiming, scoped, crouch }) {
    this.t += dt;
    const target = aiming && this.cat !== 'knife' && this.cat !== 'grenade' ? 1 : 0;
    this.aimT += (target - this.aimT) * Math.min(1, dt * 14);
    if (Math.abs(target - this.aimT) < 0.01) this.aimT = target;
    const hip = HIP[this.cat] || HIP.rifle;
    const ads = [0, -this.sightOff, ADS_Z[this.cat] || -0.06];
    const a = this.aimT;
    const bobAmt = Math.min(1, moveSpeed / 5.5) * (onGround ? 1 : 0.25) * (1 - a * 0.85);
    const bx = Math.sin(this.t * 8.5) * 0.01 * bobAmt;
    const by = -Math.abs(Math.cos(this.t * 8.5)) * 0.009 * bobAmt + Math.sin(this.t * 1.5) * 0.0015 * (1 - a);
    this.swayX += (-lookDX * 0.45 - this.swayX) * Math.min(1, dt * 10);
    this.swayY += (lookDY * 0.45 - this.swayY) * Math.min(1, dt * 10);
    this.swayX = Math.max(-0.025, Math.min(0.025, this.swayX)); this.swayY = Math.max(-0.025, Math.min(0.025, this.swayY));
    this.kick = Math.max(0, this.kick - dt * 10);
    this.kickRot = Math.max(0, this.kickRot - dt * 8);
    this.switchT = Math.max(0, this.switchT - dt * 3.2);
    let rx = this.kickRot * 0.08 * (1 - a * 0.6), ry = 0, rz = bx * 1.5;
    let drop = this.switchT * this.switchT * 0.3;
    // перезарядка: наклон, магазин вниз и обратно, левая рука к магазину
    let magOff = 0;
    if (this.reloadT > 0) {
      this.reloadT -= dt;
      const p = 1 - Math.max(0, this.reloadT) / this.reloadDur;
      const s = Math.sin(Math.min(1, p) * Math.PI);
      drop += s * 0.04; rx += s * 0.2; rz += s * 0.55; ry += s * 0.15;
      magOff = p < 0.25 ? p / 0.25 : p < 0.55 ? 1 : p < 0.8 ? 1 - (p - 0.55) / 0.25 : 0;
      if (this.leftArm) {
        const mp = this.ud.mag ? this.ud.mag.getWorldPosition(new THREE.Vector3()) : null;
        this.leftArm.position.set(this.leftRest.x + 0.02 * s, this.leftRest.y - 0.08 * magOff, this.leftRest.z + 0.12 * s);
        void mp;
      }
    } else if (this.leftArm) this.leftArm.position.copy(this.leftRest);
    if (this.ud && this.ud.mag && this.ud.magRest) {
      this.ud.mag.position.copy(this.ud.magRest);
      this.ud.mag.position.y -= magOff * 0.25;
      this.ud.mag.visible = magOff < 0.98;
    }
    // затвор снайперки
    if (this.boltT > 0) {
      this.boltT = Math.max(0, this.boltT - dt * 1.6);
      const s = Math.sin((1 - this.boltT) * Math.PI);
      if (a < 0.5) { rz += s * 0.25; drop += s * 0.02; }
      if (this.ud.bolt && this.ud.boltRest) { this.ud.bolt.position.copy(this.ud.boltRest); this.ud.bolt.position.z += s * 0.08; }
    }
    if (this.knifeT > 0) {
      this.knifeT = Math.max(0, this.knifeT - dt * 4);
      const s = Math.sin(this.knifeT * Math.PI);
      ry += s * 1.0; rx -= s * 0.5; rz -= s * 0.6;
    }
    if (this.throwT > 0) {
      this.throwT = Math.max(0, this.throwT - dt * 3);
      const s = Math.sin(this.throwT * Math.PI);
      rx -= s * 1.2; drop -= s * 0.08;
    }
    if (this.inspectT > 0) {
      this.inspectT = Math.max(0, this.inspectT - dt);
      const s = Math.sin((1 - this.inspectT / 2.2) * Math.PI);
      ry -= s * 0.9; rz += s * 0.4; rx += s * 0.2;
    }
    const crouchOff = crouch ? 0.006 : 0;
    const sx = this.swayX * (1 - a * 0.8), sy = this.swayY * (1 - a * 0.8);
    this.holder.position.set(
      hip[0] + (ads[0] - hip[0]) * a + bx + sx,
      hip[1] + (ads[1] - hip[1]) * a + by + sy - drop - crouchOff,
      hip[2] + (ads[2] - hip[2]) * a + this.kick * 0.03 * (1 - a * 0.5),
    );
    this.holder.rotation.set(0, (1 - a) * 0.05, (1 - a) * 0.03);
    this.pivot.rotation.set(rx, ry, rz);
    this.holder.visible = !scoped;
    this.flashT -= dt;
    this.flash.visible = this.flashT > 0;
    this.flashLight.intensity = this.flashT > 0 ? 2.5 : 0;
    if (this.flash.visible) this.flash.getWorldPosition(this.flashLight.position);
    for (const s of this.shells) {
      if (!s.m.visible) continue;
      s.t -= dt; s.v.y -= 6 * dt;
      s.m.position.addScaledVector(s.v, dt);
      s.m.rotation.x += s.w.x * dt; s.m.rotation.y += s.w.y * dt;
      if (s.t <= 0) s.m.visible = false;
    }
  }

  muzzleWorld(target) {
    this.scene.updateMatrixWorld();
    return this.muzzle.getWorldPosition(target);
  }

  resize(aspect) { this.camera.aspect = aspect; this.camera.updateProjectionMatrix(); }
}
