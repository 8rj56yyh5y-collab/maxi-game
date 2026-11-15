// Оружие в руках (вид от первого лица). Рендерится поверх мира отдельной сценой.
import * as THREE from 'three';
import { buildWeaponModel, SIGHT } from './weapons.js';
import { TEAM_STYLE } from './character.js';

const VM_SCALE = 0.56;
const HIP = {
  ar: [0.105, -0.11, -0.25], smg: [0.1, -0.1, -0.25], sniper: [0.105, -0.105, -0.23], shotgun: [0.105, -0.1, -0.25],
  pistol: [0.085, -0.085, -0.27], knife: [0.1, -0.09, -0.2],
};
const ADS_Z = { ar: -0.07, smg: -0.09, sniper: -0.1, shotgun: -0.1, pistol: -0.17, knife: -0.2 };
const HOLD = {
  ar: { r: [0, -0.055, 0.07], l: [0, 0.03, -0.33] },
  smg: { r: [0, -0.055, 0.06], l: [0, -0.05, -0.155] },
  sniper: { r: [0, -0.055, 0.09], l: [0, 0.015, -0.3] },
  shotgun: { r: [0, -0.055, 0.08], l: [0, 0.015, -0.35] },
  pistol: { r: [0, -0.05, 0.03], l: [-0.025, -0.06, 0.035] },
  knife: { r: [0, 0, 0.0], l: null },
};

export class ViewModel {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(54, 1, 0.01, 10);
    this.hemi = new THREE.HemisphereLight(0xdfe8f5, 0x5a4a3a, 1.1);
    this.scene.add(this.hemi);
    this.key = new THREE.DirectionalLight(0xfff2dc, 2.2); this.key.position.set(0.6, 1, 0.4); this.scene.add(this.key);
    const rim = new THREE.DirectionalLight(0xbcd2ff, 0.9); rim.position.set(-0.8, 0.3, -0.6); this.scene.add(rim);
    this.holder = new THREE.Group();
    this.scene.add(this.holder);
    this.pivot = new THREE.Group();
    this.pivot.scale.setScalar(VM_SCALE);
    this.holder.add(this.pivot);
    const flashMat = new THREE.MeshBasicMaterial({ color: 0xffc36b, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    this.flash = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.06), flashMat);
      p.rotation.z = i * Math.PI / 3; this.flash.add(p);
    }
    const side = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.18), flashMat); side.rotation.y = Math.PI / 2; side.position.z = -0.06; this.flash.add(side);
    const side2 = side.clone(); side2.rotation.set(Math.PI / 2, Math.PI / 2, 0); this.flash.add(side2);
    this.flash.visible = false;
    this.flashLight = new THREE.PointLight(0xffb060, 0, 1.5, 2);
    this.scene.add(this.flashLight);
    this.id = null;
    this.t = 0; this.kick = 0; this.kickRot = 0; this.swayX = 0; this.swayY = 0;
    this.switchT = 0; this.reloadT = 0; this.reloadDur = 1; this.knifeT = 0; this.flashT = 0; this.aimT = 0;
  }

  setEnvironment(env, sunColor) {
    this.scene.environment = env;
    this.scene.environmentIntensity = 0.7;
    if (sunColor !== undefined) this.key.color.set(sunColor);
  }

  setWeapon(id, skin, team) {
    this.id = id;
    this.pivot.clear();
    const gun = buildWeaponModel(id, skin);
    gun.traverse(o => { if (o.isMesh) o.castShadow = false; });
    this.pivot.add(gun);
    const st = TEAM_STYLE[team] || TEAM_STYLE.A;
    const sleeve = new THREE.MeshStandardMaterial({ color: st.uniform, roughness: 0.9 });
    const cuff = new THREE.MeshStandardMaterial({ color: st.gear, roughness: 0.8 });
    const glove = new THREE.MeshStandardMaterial({ color: st.glove, roughness: 0.65 });
    const watch = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3, metalness: 0.6 });
    const hold = HOLD[id] || HOLD.ar;
    const seg = (a, b, r0, r1, m) => {
      const len = a.distanceTo(b);
      const g = new THREE.CylinderGeometry(r1, r0, len, 12); g.rotateX(Math.PI / 2); g.translate(0, 0, len / 2);
      const mesh = new THREE.Mesh(g, m);
      mesh.position.copy(a); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), b.clone().sub(a).normalize());
      this.pivot.add(mesh);
    };
    const mkArm = (hand, elbow, shoulder, right) => {
      const H = new THREE.Vector3(...hand), E = new THREE.Vector3(...elbow), S = new THREE.Vector3(...shoulder);
      const dirFore = E.clone().sub(H).normalize();
      const handG = new THREE.Group(); handG.position.copy(H);
      handG.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dirFore);
      const palm = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.085, 0.09), glove); palm.position.z = 0.03; handG.add(palm);
      for (let f = 0; f < 4; f++) {
        const fing = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.02, 0.05), glove);
        fing.position.set((right ? -1 : 1) * 0.045, 0.03 - f * 0.021, -0.005); fing.rotation.y = (right ? 1 : -1) * 0.6;
        handG.add(fing);
      }
      const thumb = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.06), glove); thumb.position.set((right ? 1 : -1) * 0.04, 0.04, 0.0); handG.add(thumb);
      this.pivot.add(handG);
      const wrist = H.clone().addScaledVector(dirFore, 0.08);
      seg(wrist, wrist.clone().addScaledVector(dirFore, 0.03), 0.044, 0.044, right ? watch : cuff);
      seg(wrist.clone().addScaledVector(dirFore, 0.03), E, 0.047, 0.058, sleeve);
      seg(wrist.clone().addScaledVector(dirFore, 0.025), wrist.clone().addScaledVector(dirFore, 0.075), 0.062, 0.062, cuff);
      seg(E, S, 0.062, 0.07, sleeve);
    };
    const R = hold.r;
    if (id === 'knife') mkArm([0, 0, 0.02], [0.05, -0.12, 0.3], [0.1, -0.35, 0.6], true);
    else mkArm(R, [R[0] + 0.07, R[1] - 0.16, R[2] + 0.24], [0.12, -0.45, 0.6], true);
    if (hold.l) {
      const L = hold.l;
      if (id === 'pistol') mkArm(L, [-0.1, -0.16, 0.24], [-0.2, -0.45, 0.6], false);
      else mkArm(L, [L[0] - 0.17, L[1] - 0.17, L[2] + 0.2], [-0.28, -0.45, 0.35], false);
    }
    this.muzzle = gun.userData.muzzle;
    this.muzzle.add(this.flash);
    this.switchT = 1;
    this.reloadT = 0;
  }

  shoot(recoilAmount) {
    this.kick = Math.min(1, this.kick + 0.55 + recoilAmount * 8);
    this.kickRot = Math.min(1, this.kickRot + 0.45 + recoilAmount * 6);
    if (this.id === 'knife') { this.knifeT = 1; return; }
    this.flashT = 0.045;
    this.flash.rotation.z = Math.random() * Math.PI;
    this.flash.scale.setScalar(0.7 + Math.random() * 0.6);
  }

  startReload(dur) { this.reloadT = dur; this.reloadDur = dur; }
  cancelReload() { this.reloadT = 0; }

  update(dt, { moveSpeed, onGround, lookDX, lookDY, aiming, scoped, crouch }) {
    this.t += dt;
    this.aimT += ((aiming ? 1 : 0) - this.aimT) * Math.min(1, dt * 14);
    if (Math.abs((aiming ? 1 : 0) - this.aimT) < 0.01) this.aimT = aiming ? 1 : 0;
    const hip = HIP[this.id] || HIP.ar;
    const ads = this.id === 'knife' ? hip : [0, -(SIGHT[this.id] || 0.1) * VM_SCALE, ADS_Z[this.id] || -0.15];
    const a = this.aimT;
    const bobAmt = Math.min(1, moveSpeed / 5.5) * (onGround ? 1 : 0.25) * (1 - a * 0.85);
    const bx = Math.sin(this.t * 8.5) * 0.009 * bobAmt;
    const by = -Math.abs(Math.cos(this.t * 8.5)) * 0.008 * bobAmt + Math.sin(this.t * 1.5) * 0.0015 * (1 - a);
    this.swayX += (-lookDX * 0.5 - this.swayX) * Math.min(1, dt * 10);
    this.swayY += (lookDY * 0.5 - this.swayY) * Math.min(1, dt * 10);
    this.swayX = Math.max(-0.03, Math.min(0.03, this.swayX)); this.swayY = Math.max(-0.03, Math.min(0.03, this.swayY));
    this.kick = Math.max(0, this.kick - dt * 10);
    this.kickRot = Math.max(0, this.kickRot - dt * 8);
    this.switchT = Math.max(0, this.switchT - dt * 3.2);
    let rx = this.kickRot * 0.09 * (1 - a * 0.6), ry = 0, rz = bx * 2;
    let drop = this.switchT * this.switchT * 0.3;
    if (this.reloadT > 0) {
      this.reloadT -= dt;
      const p = 1 - Math.max(0, this.reloadT) / this.reloadDur;
      const s = Math.sin(Math.min(1, p) * Math.PI);
      drop += s * 0.07; rx += s * 0.25; rz += s * 0.6; ry += s * 0.25;
    }
    if (this.knifeT > 0) {
      this.knifeT = Math.max(0, this.knifeT - dt * 4);
      const s = Math.sin(this.knifeT * Math.PI);
      ry += s * 1.0; rx -= s * 0.5; rz -= s * 0.6;
    }
    const crouchOff = crouch ? 0.006 : 0;
    const sx = this.swayX * (1 - a * 0.8), sy = this.swayY * (1 - a * 0.8);
    this.holder.position.set(
      hip[0] + (ads[0] - hip[0]) * a + bx + sx,
      hip[1] + (ads[1] - hip[1]) * a + by + sy - drop - crouchOff,
      hip[2] + (ads[2] - hip[2]) * a + this.kick * 0.035 * (1 - a * 0.5),
    );
    this.holder.rotation.set(0, (1 - a) * 0.04, (1 - a) * 0.02);
    this.pivot.rotation.set(rx, ry, rz);
    this.holder.visible = !scoped;
    this.flashT -= dt;
    this.flash.visible = this.flashT > 0;
    this.flashLight.intensity = this.flashT > 0 ? 2.5 : 0;
    if (this.flash.visible) this.flash.getWorldPosition(this.flashLight.position);
  }

  muzzleWorld(target) {
    this.scene.updateMatrixWorld();
    return this.muzzle.getWorldPosition(target);
  }

  resize(aspect) { this.camera.aspect = aspect; this.camera.updateProjectionMatrix(); }
}
