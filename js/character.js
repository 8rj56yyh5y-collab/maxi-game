// Боец: риггированная модель (Soldier.glb) + анимации + IK рук на оружии.
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { A } from './assets.js';
import { buildWeaponModel } from './weapons.js';

export const TEAM_STYLE = {
  A: { name: 'Спецназ', tint: 0x6a80a3, visor: 0x49a8ff, uniform: 0x3c4756, gear: 0x262b31, glove: 0x18191b, accent: 0x2ec4ff },
  B: { name: 'Наёмники', tint: 0xc9a77c, visor: 0xff7a3c, uniform: 0x6b5d45, gear: 0x3c3226, glove: 0x2e2419, accent: 0xff7a3c },
};
const FFA_TINTS = [0xc07070, 0x70c088, 0xa070c0, 0xc0b070, 0x70b8c0, 0xc09070, 0x8088c0, 0xc070b0, 0x98c070, 0xc07088, 0x7088c0];

const GUN_OFFSET = new THREE.Vector3(0.13, -0.1, -0.16);
const PISTOL_OFFSET = new THREE.Vector3(0.06, -0.06, -0.4);
const KNIFE_OFFSET = new THREE.Vector3(0.2, -0.25, -0.28);

const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _v4 = new THREE.Vector3();
const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion();
const _e = new THREE.Euler();
const X = new THREE.Vector3(1, 0, 0);

// Повернуть кость так, чтобы направление (кость → дочерняя точка) смотрело на target
function aimBone(bone, childWorld, targetWorld) {
  const origin = bone.getWorldPosition(_v1);
  const cur = _v2.subVectors(childWorld, origin).normalize();
  const want = _v3.subVectors(targetWorld, origin).normalize();
  const delta = _q1.setFromUnitVectors(cur, want);
  bone.getWorldQuaternion(_q2);
  _q2.premultiply(delta);
  bone.parent.getWorldQuaternion(_q3).invert();
  bone.quaternion.copy(_q3.multiply(_q2));
  bone.updateMatrixWorld(true);
}

// 2-звенная IK: upper → lower → end
function solveIK(upper, lower, end, target, pole, lenA, lenB) {
  const S = upper.getWorldPosition(new THREE.Vector3());
  const dir = new THREE.Vector3().subVectors(target, S);
  let d = dir.length();
  d = Math.min(Math.max(d, Math.abs(lenA - lenB) + 0.01), lenA + lenB - 0.005);
  dir.normalize();
  const cosA = (lenA * lenA + d * d - lenB * lenB) / (2 * lenA * d), sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  const bend = pole.clone().addScaledVector(dir, -pole.dot(dir)).normalize();
  const E = S.clone().addScaledVector(dir, lenA * cosA).addScaledVector(bend, lenA * sinA);
  const T = S.clone().addScaledVector(dir, d);
  aimBone(upper, lower.getWorldPosition(_v4), E);
  aimBone(lower, end.getWorldPosition(_v4), T);
}

export class CharacterModel {
  constructor(team, ffaIndex = -1) {
    const st = TEAM_STYLE[team] || TEAM_STYLE.A;
    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.root.add(this.body);
    const src = A.gltf.soldier;
    const model = cloneSkinned(src.scene);
    // модель Soldier уже смотрит в -Z (наше «вперёд»)
    this.body.add(model);
    const tint = ffaIndex >= 0 ? FFA_TINTS[ffaIndex % FFA_TINTS.length] : st.tint;
    model.traverse(o => {
      if (o.isMesh) {
        o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
        const m = o.material.clone();
        if (/Visor/.test(m.name)) { m.color.set(st.visor); m.emissive = new THREE.Color(st.visor); m.emissiveIntensity = 0.35; m.metalness = 0.6; m.roughness = 0.2; }
        else { m.color.set(tint); m.roughness = Math.max(0.45, m.roughness || 0.6); }
        o.material = m;
      }
    });
    const b = (n) => model.getObjectByName('mixamorig' + n);
    this.bones = {
      hips: b('Hips'), spine: b('Spine'), spine1: b('Spine1'), spine2: b('Spine2'), head: b('Head'),
      rArm: b('RightArm'), rFore: b('RightForeArm'), rHand: b('RightHand'), rFing: b('RightHandMiddle1'),
      lArm: b('LeftArm'), lFore: b('LeftForeArm'), lHand: b('LeftHand'), lFing: b('LeftHandMiddle1'),
      rUp: b('RightUpLeg'), rLeg: b('RightLeg'), rFoot: b('RightFoot'),
      lUp: b('LeftUpLeg'), lLeg: b('LeftLeg'), lFoot: b('LeftFoot'),
    };
    model.updateMatrixWorld(true);
    const dist = (p, q) => p.getWorldPosition(new THREE.Vector3()).distanceTo(q.getWorldPosition(new THREE.Vector3()));
    this.len = {
      ua: dist(this.bones.rArm, this.bones.rFore), fa: dist(this.bones.rFore, this.bones.rHand),
      th: dist(this.bones.rUp, this.bones.rLeg), sh: dist(this.bones.rLeg, this.bones.rFoot),
    };
    this.mixer = new THREE.AnimationMixer(model);
    const clip = (n) => src.animations.find(a => a.name === n);
    this.actions = { idle: this.mixer.clipAction(clip('Idle')), walk: this.mixer.clipAction(clip('Walk')), run: this.mixer.clipAction(clip('Run')) };
    for (const a of Object.values(this.actions)) { a.play(); a.setEffectiveWeight(0); }
    this.actions.idle.setEffectiveWeight(1);
    this.mixer.update(Math.random() * 2);
    this.model = model;
    this.gun = new THREE.Group();
    this.root.add(this.gun);
    this.weaponId = null;
    this.deathT = 0;
  }

  setWeapon(id, skin) {
    const sid = skin ? skin.id : '';
    if (this.weaponId === id && this.skinId === sid) return;
    this.weaponId = id; this.skinId = sid;
    this.gun.clear();
    const w = buildWeaponModel(id, skin);
    this.gun.add(w);
    this.gunModel = w;
    this.muzzle = w.userData.muzzle;
  }

  update(dt, a) {
    const r = this.root;
    r.position.set(a.pos.x, a.pos.y, a.pos.z);
    r.rotation.set(0, a.yaw, 0);
    const speed = Math.hypot(a.vel.x, a.vel.z);
    const wRun = THREE.MathUtils.clamp((speed - 2.6) / 1.6, 0, 1);
    const wWalk = THREE.MathUtils.clamp(speed / 2.2, 0, 1) * (1 - wRun);
    this.actions.idle.setEffectiveWeight(Math.max(0, 1 - wWalk - wRun));
    this.actions.walk.setEffectiveWeight(wWalk);
    this.actions.run.setEffectiveWeight(wRun);
    const fwd = -(Math.sin(a.yaw) * a.vel.x + Math.cos(a.yaw) * a.vel.z);
    const dirSign = fwd < -0.5 ? -1 : 1;
    this.actions.run.timeScale = dirSign * THREE.MathUtils.clamp(speed / 5.2, 0.6, 1.3);
    this.actions.walk.timeScale = dirSign * THREE.MathUtils.clamp(speed / 1.8, 0.6, 1.6);
    this.mixer.update(a.alive ? dt : 0);

    if (!a.alive) {
      this.deathT = Math.min(1, this.deathT + dt * 2.2);
      const e = 1 - Math.pow(1 - this.deathT, 3);
      this.body.rotation.x = e * Math.PI / 2 * (this.deathDir || 1) * 0.97;
      this.body.position.y = Math.sin(e * Math.PI) * 0.15 + e * 0.12;
      this.gun.visible = this.deathT < 0.15;
      return;
    }
    this.deathT = 0; this.body.rotation.x = 0; this.body.position.y = 0; this.gun.visible = true;
    r.updateMatrixWorld(true);
    const B = this.bones;
    const fwdV = new THREE.Vector3(-Math.sin(a.yaw), 0, -Math.cos(a.yaw));
    const right = new THREE.Vector3(Math.cos(a.yaw), 0, -Math.sin(a.yaw));

    // присед: опускаем таз, стопы остаются на земле (IK)
    const c = a.crouchT || 0;
    if (c > 0.02) {
      const lf = B.lFoot.getWorldPosition(new THREE.Vector3()), rf = B.rFoot.getWorldPosition(new THREE.Vector3());
      const hw = B.hips.getWorldPosition(new THREE.Vector3());
      const l0 = B.hips.parent.worldToLocal(hw.clone()), l1 = B.hips.parent.worldToLocal(hw.clone().add(new THREE.Vector3(0, -0.4 * c, 0)));
      B.hips.position.add(l1.sub(l0));
      B.hips.updateMatrixWorld(true);
      const pole = fwdV.clone().add(new THREE.Vector3(0, 0.3, 0));
      solveIK(B.lUp, B.lLeg, B.lFoot, lf.addScaledVector(fwdV, 0.15 * c), pole, this.len.th, this.len.sh);
      solveIK(B.rUp, B.rLeg, B.rFoot, rf.addScaledVector(fwdV, -0.1 * c), pole, this.len.th, this.len.sh);
    }

    // наклон корпуса по вертикали прицела (вокруг оси «вправо»)
    const pitch = a.pitch;
    for (const bone of [B.spine, B.spine1, B.spine2]) {
      bone.getWorldQuaternion(_q2);
      _q1.setFromAxisAngle(right, pitch / 3);
      _q2.premultiply(_q1);
      bone.parent.getWorldQuaternion(_q3).invert();
      bone.quaternion.copy(_q3.multiply(_q2));
      bone.updateMatrixWorld(true);
    }

    // оружие у плеча
    const ud = this.gunModel ? this.gunModel.userData : null;
    const chest = B.spine2.getWorldPosition(new THREE.Vector3());
    const isPistol = /^p\d/.test(this.weaponId || '');
    const off = (ud && (ud.knife || ud.grenade)) ? KNIFE_OFFSET : isPistol ? PISTOL_OFFSET : GUN_OFFSET;
    _e.set(pitch, a.yaw, 0, 'YXZ');
    _q2.setFromEuler(_e);
    const kickBack = Math.max(0, (a.lastShotT || -9) + 0.09 - (a.timeRef || 0)) * 0.5;
    const offW = off.clone().add(new THREE.Vector3(0, 0, kickBack)).applyQuaternion(_q2);
    const gunWorld = chest.add(offW).add(new THREE.Vector3(0, 0.1, 0));
    this.gun.position.copy(r.worldToLocal(gunWorld));
    this.gun.rotation.set(pitch, 0, 0);
    this.gun.updateMatrixWorld(true);

    // руки на оружии
    if (ud && ud.gripR) {
      const tR = this.gunModel.localToWorld(ud.gripR.clone());
      if ((ud.knife || ud.grenade) && a.knifeSwing) tR.addScaledVector(fwdV, a.knifeSwing * 0.3);
      solveIK(B.rArm, B.rFore, B.rHand, tR, right.clone().multiplyScalar(0.6).add(new THREE.Vector3(0, -1, 0)), this.len.ua, this.len.fa);
      const gq = this.gunModel.getWorldQuaternion(new THREE.Quaternion());
      const gLeft = new THREE.Vector3(-1, 0, 0).applyQuaternion(gq), gDown = new THREE.Vector3(0, -1, 0).applyQuaternion(gq), gFwd = new THREE.Vector3(0, 0, -1).applyQuaternion(gq);
      // пальцы обхватывают рукоять
      aimBone(B.rHand, B.rFing.getWorldPosition(new THREE.Vector3()), tR.clone().addScaledVector(gLeft, 0.1).addScaledVector(gDown, 0.05).addScaledVector(gFwd, 0.03));
      if (ud.gripL) {
        const tL = this.gunModel.localToWorld(ud.gripL.clone());
        solveIK(B.lArm, B.lFore, B.lHand, tL, right.clone().multiplyScalar(-0.8).add(new THREE.Vector3(0, -1, 0)), this.len.ua, this.len.fa);
        aimBone(B.lHand, B.lFing.getWorldPosition(new THREE.Vector3()), tL.clone().addScaledVector(gLeft, -0.1).addScaledVector(gFwd, 0.04));
      }
    }
  }

  dispose() { this.mixer.stopAllAction(); }
}
