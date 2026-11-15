// Оружие в руках (вид от первого лица). Рендерится отдельной сценой поверх мира.
import * as THREE from 'three';
import { buildWeaponModel } from './weapons.js';
import { TEAM_STYLE } from './character.js';

const SCALE = 0.55;
const HIP = { ar: [0.16, -0.16, -0.36], smg: [0.16, -0.15, -0.34], sniper: [0.16, -0.16, -0.34], shotgun: [0.16, -0.16, -0.36], pistol: [0.14, -0.14, -0.34], knife: [0.16, -0.15, -0.3] };
const ADS = { ar: [0, -0.072, -0.26], smg: [0, -0.06, -0.24], sniper: [0, -0.083, -0.24], shotgun: [0, -0.052, -0.26], pistol: [0, -0.055, -0.28], knife: [0.16, -0.15, -0.3] };

export class ViewModel {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(58, 1, 0.01, 10);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x666655, 1.6));
    const dl = new THREE.DirectionalLight(0xffffff, 1.4); dl.position.set(0.5, 1, 0.3); this.scene.add(dl);
    this.holder = new THREE.Group();
    this.scene.add(this.holder);
    this.pivot = new THREE.Group();
    this.holder.add(this.pivot);
    this.pivot.scale.setScalar(SCALE);
    // вспышка выстрела
    const flashMat = new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
    this.flash = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.05), flashMat);
      p.rotation.z = i * Math.PI / 3;
      this.flash.add(p);
    }
    const core = new THREE.Mesh(new THREE.CircleGeometry(0.035, 8), flashMat); this.flash.add(core);
    this.flash.visible = false;
    this.flashLight = new THREE.PointLight(0xffc070, 0, 2);
    this.scene.add(this.flashLight);
    this.id = null;
    this.t = 0; this.kick = 0; this.kickRot = 0; this.swayX = 0; this.swayY = 0;
    this.switchT = 0; this.reloadT = 0; this.reloadDur = 1; this.knifeT = 0; this.flashT = 0;
    this.aimT = 0;
  }

  setWeapon(id, skin, team) {
    this.id = id;
    this.pivot.clear();
    const gun = buildWeaponModel(id, skin);
    this.pivot.add(gun);
    const st = TEAM_STYLE[team] || TEAM_STYLE.A;
    const sleeve = new THREE.MeshLambertMaterial({ color: st.body });
    const glove = new THREE.MeshLambertMaterial({ color: 0x1d1d1d });
    const armR = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.4), sleeve);
    armR.position.set(0.03, -0.09, 0.26); armR.rotation.x = 0.35; this.pivot.add(armR);
    const handR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.07, 0.08), glove);
    handR.position.set(0, -0.04, 0.03); this.pivot.add(handR);
    if (id !== 'knife' && id !== 'pistol') {
      const armL = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.42), sleeve);
      armL.position.set(-0.1, -0.08, -0.15); armL.rotation.set(0.25, -0.7, 0); this.pivot.add(armL);
      const handL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.08), glove);
      handL.position.set(0, 0, id === 'sniper' ? -0.3 : -0.36); this.pivot.add(handL);
    } else if (id === 'pistol') {
      const handL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.08), glove);
      handL.position.set(-0.035, -0.04, 0.02); this.pivot.add(handL);
    }
    this.muzzle = gun.userData.muzzle;
    this.muzzle.add(this.flash);
    this.switchT = 1;
    this.reloadT = 0;
  }

  shoot(recoilAmount) {
    this.kick = Math.min(1, this.kick + 0.6 + recoilAmount * 8);
    this.kickRot = Math.min(1, this.kickRot + 0.5 + recoilAmount * 6);
    if (this.id === 'knife') { this.knifeT = 1; return; }
    this.flashT = 0.05;
    this.flash.rotation.z = Math.random() * Math.PI;
    this.flash.scale.setScalar(0.8 + Math.random() * 0.6);
  }

  startReload(dur) { this.reloadT = dur; this.reloadDur = dur; }
  cancelReload() { this.reloadT = 0; }

  update(dt, { moveSpeed, onGround, lookDX, lookDY, aiming, scoped, crouch }) {
    this.t += dt;
    this.aimT += ((aiming ? 1 : 0) - this.aimT) * Math.min(1, dt * 14);
    const hip = HIP[this.id] || HIP.ar, ads = ADS[this.id] || ADS.ar;
    const a = this.aimT;
    const bobAmt = Math.min(1, moveSpeed / 6) * (onGround ? 1 : 0.2) * (1 - a * 0.85);
    const bx = Math.sin(this.t * 9) * 0.012 * bobAmt;
    const by = -Math.abs(Math.cos(this.t * 9)) * 0.012 * bobAmt + Math.sin(this.t * 1.6) * 0.002;
    this.swayX += (-lookDX * 0.6 - this.swayX) * Math.min(1, dt * 10);
    this.swayY += (lookDY * 0.6 - this.swayY) * Math.min(1, dt * 10);
    this.swayX = Math.max(-0.04, Math.min(0.04, this.swayX)); this.swayY = Math.max(-0.04, Math.min(0.04, this.swayY));
    this.kick = Math.max(0, this.kick - dt * 9);
    this.kickRot = Math.max(0, this.kickRot - dt * 7);
    this.switchT = Math.max(0, this.switchT - dt * 3.2);
    let rx = this.kickRot * 0.12 * (1 - a * 0.5), ry = 0, rz = 0;
    let drop = this.switchT * this.switchT * 0.35;
    if (this.reloadT > 0) {
      this.reloadT -= dt;
      const p = 1 - Math.max(0, this.reloadT) / this.reloadDur;
      const s = Math.sin(Math.min(1, p) * Math.PI);
      drop += s * 0.12; rx -= s * 0.5; rz += s * 0.4;
    }
    if (this.knifeT > 0) {
      this.knifeT = Math.max(0, this.knifeT - dt * 4);
      const s = Math.sin(this.knifeT * Math.PI);
      ry += s * 0.9; rx -= s * 0.4; rz -= s * 0.5;
    }
    const crouchOff = crouch ? 0.01 : 0;
    this.holder.position.set(
      hip[0] + (ads[0] - hip[0]) * a + bx + this.swayX * (1 - a * 0.7),
      hip[1] + (ads[1] - hip[1]) * a + by + this.swayY * (1 - a * 0.7) - drop - crouchOff,
      hip[2] + (ads[2] - hip[2]) * a + this.kick * 0.045 * (1 - a * 0.4),
    );
    this.pivot.rotation.set(rx, ry, rz);
    this.holder.visible = !scoped;
    // вспышка
    this.flashT -= dt;
    this.flash.visible = this.flashT > 0;
    this.flashLight.intensity = this.flashT > 0 ? 3 : 0;
    if (this.flash.visible) this.flash.getWorldPosition(this.flashLight.position);
  }

  muzzleWorld(target) {
    // позиция дула в пространстве камеры вида (для трассеров переводится в мир снаружи)
    this.scene.updateMatrixWorld();
    return this.muzzle.getWorldPosition(target);
  }

  resize(aspect) { this.camera.aspect = aspect; this.camera.updateProjectionMatrix(); }
}
