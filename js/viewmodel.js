// Оружие в руках (вид от первого лица). Отдельная сцена поверх мира.
import * as THREE from 'three';
import { buildWeaponModel } from './weapons.js';
import { WEAPONS, KNIVES } from './data.js';
import { CharacterModel, solveIK, aimBone } from './character.js';
import { surface } from './textures.js';

// Положение точки хвата относительно глаза
const HIP = { pistol: [0.1, -0.12, -0.38], smg: [0.105, -0.13, -0.24], rifle: [0.105, -0.135, -0.22], sniper: [0.105, -0.13, -0.2], shotgun: [0.105, -0.13, -0.23], knife: [0.13, -0.13, -0.34], grenade: [0.12, -0.12, -0.3] };
const ADS_Z = { pistol: -0.38, smg: -0.15, rifle: -0.14, sniper: -0.1, shotgun: -0.16 };

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
    this.ensureBody(team);
    this.leftOffset = new THREE.Vector3();
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
      this.leftOffset.set(0.02 * s, -0.12 * magOff, 0.18 * s);
    } else this.leftOffset.set(0, 0, 0);
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
    this.holder.rotation.set(0, (1 - a) * 0.06, (1 - a) * 0.03);
    this.pivot.rotation.set(rx, ry, rz);
    this.holder.visible = !scoped;
    this.poseBody(dt, scoped);
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

  // Тело бойца (руки в броне и перчатках) от первого лица
  ensureBody(team) {
    if (this.body && this.bodyTeam === team) return;
    if (this.body) this.scene.remove(this.body.root);
    this.body = new CharacterModel(team);
    this.bodyTeam = team;
    this.body.gun.visible = false;
    const B = this.body.bones;
    B.head.scale.setScalar(0.001);
    this.body.root.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; if (/visor/i.test(o.name) || /Visor/.test(o.material.name)) o.visible = false; } });
    B.neck = this.body.model.getObjectByName('mixamorigNeck');
    if (B.neck) B.neck.scale.setScalar(0.001);
    this.scene.add(this.body.root);
    this.body.model.updateMatrixWorld(true);
    this.eyeY = B.head.getWorldPosition(new THREE.Vector3()).y + 0.06;
    // удлиняем руки (кисти остаются прежнего размера), чтобы дотягиваться до цевья
    const K = 1.15;
    this.armK = K;
    B.lSh = this.body.model.getObjectByName('mixamorigLeftShoulder');
    B.rSh = this.body.model.getObjectByName('mixamorigRightShoulder');
    this.shRest = [B.lSh && B.lSh.position.clone(), B.rSh && B.rSh.position.clone()];
    this.armLen = { ua: this.body.len.ua * K, fa: this.body.len.fa * K };
  }

  poseBody(dt, scoped) {
    const ch = this.body; if (!ch) return;
    const B = ch.bones;
    ch.root.visible = !scoped && this.holder.visible;
    if (!ch.root.visible) return;
    ch.mixer.update(dt * 0.6);
    for (const [a, h] of [[B.lArm, B.lHand], [B.rArm, B.rHand]]) { a.scale.setScalar(this.armK); h.scale.setScalar(1 / this.armK); }
    ch.root.position.set(0.02, -this.eyeY - 0.1, 0.32);
    ch.root.rotation.set(0, 0, 0);
    ch.root.updateMatrixWorld(true);
    // плечи выносим вперёд-вниз (торс остаётся за камерой)
    const offs = [[0.07, -0.16, -0.4], [-0.01, -0.1, -0.16]];
    [B.lSh, B.rSh].forEach((sh, i) => {
      if (!sh) return;
      sh.position.copy(this.shRest[i]); sh.updateMatrixWorld(true);
      const w = sh.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(...offs[i]));
      sh.position.copy(sh.parent.worldToLocal(w));
    });
    ch.root.updateMatrixWorld(true);
    this.gun.updateMatrixWorld(true);
    const ud = this.ud;
    const tR = this.gun.localToWorld(ud.gripR.clone());
    const right = new THREE.Vector3(1, 0, 0);
    solveIK(B.rArm, B.rFore, B.rHand, tR, new THREE.Vector3(0.7, -1, 0.3), this.armLen.ua, this.armLen.fa);
    const gq = this.gun.getWorldQuaternion(new THREE.Quaternion());
    const gLeft = new THREE.Vector3(-1, 0, 0).applyQuaternion(gq), gDown = new THREE.Vector3(0, -1, 0).applyQuaternion(gq), gFwd = new THREE.Vector3(0, 0, -1).applyQuaternion(gq);
    aimBone(B.rHand, B.rFing.getWorldPosition(new THREE.Vector3()), tR.clone().addScaledVector(gLeft, 0.1).addScaledVector(gDown, 0.05).addScaledVector(gFwd, 0.03));
    let tL;
    if (ud.gripL) tL = this.gun.localToWorld(ud.gripL.clone()).add(this.leftOffset);
    else tL = new THREE.Vector3(-0.32, -0.55, -0.05);
    solveIK(B.lArm, B.lFore, B.lHand, tL, new THREE.Vector3(-0.8, -1, 0.2), this.armLen.ua, this.armLen.fa);
    if (ud.gripL) aimBone(B.lHand, B.lFing.getWorldPosition(new THREE.Vector3()), tL.clone().addScaledVector(gLeft, -0.1).addScaledVector(gFwd, 0.04));
    void right;
  }

  muzzleWorld(target) {
    this.scene.updateMatrixWorld();
    return this.muzzle.getWorldPosition(target);
  }

  resize(aspect) { this.camera.aspect = aspect; this.camera.updateProjectionMatrix(); }
}
