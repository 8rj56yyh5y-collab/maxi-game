// Боец: риггированная модель (Soldier.glb) + анимации + IK рук на оружии.
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { A, texSet } from './assets.js';
import { buildWeaponModel } from './weapons.js';

export const TEAM_STYLE = {
  A: { name: 'Спецназ', tint: 0x55606e, visor: 0x49a8ff, uniform: 0x3c4756, gear: 0x262b31, glove: 0x18191b, accent: 0x2ec4ff },
  B: { name: 'Наёмники', tint: 0x6f6b52, visor: 0xff7a3c, uniform: 0x6b5d45, gear: 0x3c3226, glove: 0x2e2419, accent: 0xff7a3c },
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
export function aimBone(bone, childWorld, targetWorld) {
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
export function solveIK(upper, lower, end, target, pole, lenA, lenB) {
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

// ---------- Рэгдолл (Верле): частицы в суставах, связи, земля и стены ----------
const RAG_BONES = ['hips', 'spine2', 'head', 'lArm', 'lFore', 'lHand', 'rArm', 'rFore', 'rHand', 'lUp', 'lLeg', 'lFoot', 'rUp', 'rLeg', 'rFoot'];
const RAG_LINKS = [
  ['hips', 'spine2'], ['spine2', 'head'], ['spine2', 'lArm'], ['spine2', 'rArm'], ['lArm', 'rArm'], ['lArm', 'lFore'], ['lFore', 'lHand'], ['rArm', 'rFore'], ['rFore', 'rHand'],
  ['hips', 'lUp'], ['hips', 'rUp'], ['lUp', 'rUp'], ['lUp', 'lLeg'], ['lLeg', 'lFoot'], ['rUp', 'rLeg'], ['rLeg', 'rFoot'],
  // жёсткость торса
  ['lArm', 'lUp'], ['rArm', 'rUp'], ['lArm', 'rUp'], ['rArm', 'lUp'], ['head', 'lArm'], ['head', 'rArm'], ['hips', 'lArm'], ['hips', 'rArm'],
];
// ограничители (мин. расстояние) — не даём суставам складываться внутрь
const RAG_MIN = [['hips', 'head', 0.85], ['lUp', 'lFoot', 0.45], ['rUp', 'rFoot', 0.45], ['lArm', 'lHand', 0.2], ['rArm', 'rHand', 0.2], ['head', 'lFoot', 0.6], ['head', 'rFoot', 0.6]];
const _rv = new THREE.Vector3(), _rw = new THREE.Vector3();
class Ragdoll {
  constructor(ch, impulse, head, colliders) {
    this.ch = ch;
    const B = ch.bones;
    this.p = {}; this.o = {};
    const dt = 1 / 60;
    for (const n of RAG_BONES) {
      const w = B[n].getWorldPosition(new THREE.Vector3());
      this.p[n] = w; this.o[n] = w.clone();
      // начальная скорость: импульс сильнее в верхней части тела (и в голове при хедшоте)
      const up = ['head', 'spine2', 'lArm', 'rArm'].includes(n) ? 1 : ['hips', 'lFore', 'rFore', 'lHand', 'rHand'].includes(n) ? 0.6 : 0.25;
      const hk = head && n === 'head' ? 1.8 : 1;
      this.o[n].addScaledVector(impulse, -dt * up * hk);
    }
    // небольшой подгиб коленей, чтобы тело оседало, а не падало столбом
    for (const n of ['lLeg', 'rLeg']) this.o[n].addScaledVector(ch.root.getWorldDirection(new THREE.Vector3()), dt * 1.2);
    this.links = RAG_LINKS.map(([a, b]) => [a, b, this.p[a].distanceTo(this.p[b])]);
    this.mins = RAG_MIN.map(([a, b, f]) => [a, b, this.p[a].distanceTo(this.p[b]) * f]);
    const c = this.p.hips;
    this.cols = (colliders || []).filter(k => c.x > k.min[0] - 3 && c.x < k.max[0] + 3 && c.z > k.min[2] - 3 && c.z < k.max[2] + 3 && k.max[1] > 0.05);
    // кадр торса и исходные ориентации костей
    this.f0 = { hips: this.frame('hips'), spine2: this.frame('spine2') };
    this.q0 = { hips: B.hips.getWorldQuaternion(new THREE.Quaternion()), spine2: B.spine2.getWorldQuaternion(new THREE.Quaternion()), head: B.head.getWorldQuaternion(new THREE.Quaternion()) };
    this.t = 0; this.sleep = false;
  }
  frame(which) {
    const P = this.p;
    const up = which === 'hips' ? _rv.subVectors(P.spine2, P.hips) : _rv.subVectors(P.head, P.spine2);
    const side = which === 'hips' ? _rw.subVectors(P.rUp, P.lUp) : _rw.subVectors(P.rArm, P.lArm);
    const y = up.clone().normalize(), x = side.clone().addScaledVector(y, -side.dot(y)).normalize(), z = new THREE.Vector3().crossVectors(x, y);
    return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
  }
  step(dt) {
    if (this.sleep) return;
    this.t += dt;
    const g = -9.8 * dt * dt, P = this.p, O = this.o;
    let motion = 0;
    for (const n of RAG_BONES) {
      const p = P[n], o = O[n];
      const vx = (p.x - o.x) * 0.985, vy = (p.y - o.y) * 0.985, vz = (p.z - o.z) * 0.985;
      o.copy(p);
      p.x += vx; p.y += vy + g; p.z += vz;
      motion += Math.abs(vx) + Math.abs(vy) + Math.abs(vz);
    }
    for (let it = 0; it < 10; it++) {
      for (const [a, b, L] of this.links) this.solve(P[a], P[b], L, false);
      for (const [a, b, L] of this.mins) this.solve(P[a], P[b], L, true);
      for (const n of RAG_BONES) this.collide(n);
    }
    if (this.t > 2.5 && motion < 0.002) this.sleep = true;
  }
  solve(a, b, L, minOnly) {
    _rv.subVectors(b, a); const d = _rv.length() || 1e-6;
    if (minOnly && d >= L) return;
    const k = (d - L) / d * 0.5;
    a.addScaledVector(_rv, k); b.addScaledVector(_rv, -k);
  }
  collide(n) {
    const p = this.p[n], o = this.o[n];
    const r = n === 'head' ? 0.12 : n === 'hips' || n === 'spine2' ? 0.14 : 0.07;
    if (p.y < r) { p.y = r; o.x += (p.x - o.x) * 0.35; o.z += (p.z - o.z) * 0.35; } // трение о землю
    for (const c of this.cols) {
      if (p.x < c.min[0] - r || p.x > c.max[0] + r || p.z < c.min[2] - r || p.z > c.max[2] + r || p.y < c.min[1] - r || p.y > c.max[1] + r) continue;
      const dx1 = p.x - (c.min[0] - r), dx2 = (c.max[0] + r) - p.x, dz1 = p.z - (c.min[2] - r), dz2 = (c.max[2] + r) - p.z, dy = (c.max[1] + r) - p.y;
      const m = Math.min(dx1, dx2, dz1, dz2, dy);
      if (m === dy) p.y = c.max[1] + r; else if (m === dx1) p.x = c.min[0] - r; else if (m === dx2) p.x = c.max[0] + r; else if (m === dz1) p.z = c.min[2] - r; else p.z = c.max[2] + r;
    }
  }
  setWorldQ(bone, q) {
    bone.parent.getWorldQuaternion(_q3).invert();
    bone.quaternion.copy(_q3.multiply(q));
    bone.updateMatrixWorld(true);
  }
  apply() {
    const B = this.ch.bones, P = this.p;
    // таз: позиция и ориентация по кадру
    const hp = B.hips.parent.worldToLocal(P.hips.clone());
    B.hips.position.copy(hp);
    const fq = this.frame('hips');
    this.setWorldQ(B.hips, fq.clone().multiply(this.f0.hips.clone().invert()).multiply(this.q0.hips));
    const fc = this.frame('spine2');
    this.setWorldQ(B.spine2, fc.clone().multiply(this.f0.spine2.clone().invert()).multiply(this.q0.spine2));
    this.setWorldQ(B.head, fc.clone().multiply(this.f0.spine2.clone().invert()).multiply(this.q0.head));
    const chain = [['lArm', 'lFore', 'lFore'], ['lFore', 'lHand', 'lHand'], ['rArm', 'rFore', 'rFore'], ['rFore', 'rHand', 'rHand'],
      ['lUp', 'lLeg', 'lLeg'], ['lLeg', 'lFoot', 'lFoot'], ['rUp', 'rLeg', 'rLeg'], ['rLeg', 'rFoot', 'rFoot']];
    for (const [bn, child, target] of chain) { B[bn].updateMatrixWorld(true); aimBone(B[bn], B[child].getWorldPosition(new THREE.Vector3()), P[target]); }
  }
}

let _clothN = null;
function clothNormal() {
  if (_clothN) return _clothN;
  _clothN = texSet('cloth').normalMap.clone();
  _clothN.wrapS = _clothN.wrapT = THREE.RepeatWrapping; _clothN.repeat.set(10, 10); _clothN.needsUpdate = true;
  return _clothN;
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
    this.shade = 0.82 + Math.random() * 0.3;
    model.traverse(o => {
      if (o.isMesh) {
        o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
        const m = o.material.clone();
        if (/Visor/.test(m.name)) { m.color.set(st.visor); m.emissive = new THREE.Color(st.visor); m.emissiveIntensity = 0.35; m.metalness = 0.6; m.roughness = 0.2; }
        else {
          m.color.set(tint).multiplyScalar(this.shade); m.roughness = Math.max(0.6, m.roughness || 0.7);
          // микрорельеф ткани поверх исходной текстуры
          m.normalMap = clothNormal(); m.normalScale = new THREE.Vector2(0.7, 0.7);
        }
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
    this.gun.scale.setScalar(w.userData && w.userData.proc ? 1.3 : 1);
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
      if (this.rag) { this.rag.step(Math.min(dt, 0.05)); this.rag.apply(); this.updateDropped(Math.min(dt, 0.05)); return; }
      // запасной вариант (модель без рэгдолла)
      this.deathT = Math.min(1, this.deathT + dt * 2.2);
      const e = 1 - Math.pow(1 - this.deathT, 3);
      this.body.rotation.x = e * Math.PI / 2 * (this.deathDir || 1) * 0.97;
      this.gun.visible = this.deathT < 0.15;
      return;
    }
    if (this.rag) { this.rag = null; this.dropped = null; this.gun.visible = true; this.gun.matrixAutoUpdate = true; }
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

    // наклон корпуса при стрейфе
    const lat = right.x * a.vel.x + right.z * a.vel.z;
    this.lean = (this.lean || 0) + (THREE.MathUtils.clamp(-lat * 0.035, -0.16, 0.16) - (this.lean || 0)) * Math.min(1, dt * 8);
    if (Math.abs(this.lean) > 0.002) {
      B.spine.getWorldQuaternion(_q2); _q1.setFromAxisAngle(fwdV, this.lean); _q2.premultiply(_q1);
      B.spine.parent.getWorldQuaternion(_q3).invert(); B.spine.quaternion.copy(_q3.multiply(_q2)); B.spine.updateMatrixWorld(true);
    }

    // рывок от попадания
    if (this.hitT > 0) {
      this.hitT = Math.max(0, this.hitT - dt * 5);
      const k = Math.sin(this.hitT * Math.PI) * this.hitAmp;
      const axis = new THREE.Vector3(0, 1, 0).cross(this.hitDir).normalize();
      for (const [bone, amt] of [[B.spine1, 0.18], [B.spine2, 0.22], [B.head, this.hitHead ? 0.7 : 0.25]]) {
        bone.getWorldQuaternion(_q2);
        _q1.setFromAxisAngle(axis, k * amt);
        _q2.premultiply(_q1);
        bone.parent.getWorldQuaternion(_q3).invert();
        bone.quaternion.copy(_q3.multiply(_q2));
        bone.updateMatrixWorld(true);
      }
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
    let gunWorld = chest.clone().add(offW).add(new THREE.Vector3(0, 0.1, 0));
    // винтовки и ПП: приклад упирается в правое плечо
    if (ud && ud.box && !isPistol && !ud.knife && !ud.grenade) {
      const sc = this.gun.scale.x;
      const pocket = B.spine2.getWorldPosition(new THREE.Vector3()).addScaledVector(right, 0.13).add(new THREE.Vector3(0, 0.125, 0)).addScaledVector(fwdV, 0.06 - kickBack);
      const anchor = new THREE.Vector3(0, (ud.gripR ? ud.gripR.y : 0) + 0.06, ud.box.max.z).multiplyScalar(sc).applyQuaternion(_q2);
      gunWorld = pocket.sub(anchor);
    }
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

  // Реакция на попадание (живой): короткий рывок корпуса и головы
  hit(dir, head, amount) {
    this.hitT = 1; this.hitHead = head;
    this.hitDir = dir.clone().setY(0).normalize();
    this.hitAmp = Math.min(1, 0.35 + amount / 60);
  }

  // Смерть: включаем рэгдолл
  die(impulse, head, colliders, pos) {
    if (pos) this.root.position.copy(pos);
    this.root.updateMatrixWorld(true);
    this.rag = new Ragdoll(this, impulse, head, colliders);
    this.dropGun(impulse);
  }

  dropGun(impulse) {
    if (!this.gunModel) return;
    this.gun.updateMatrixWorld(true);
    const wp = this.gun.getWorldPosition(new THREE.Vector3()), wq = this.gun.getWorldQuaternion(new THREE.Quaternion());
    this.dropped = { pos: wp, q: wq, v: impulse.clone().multiplyScalar(0.6).add(new THREE.Vector3(0, 1.2, 0)), w: new THREE.Vector3((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 8), rest: false };
  }

  updateDropped(dt) {
    const d = this.dropped; if (!d) return;
    if (!d.rest) {
      d.v.y -= 9.8 * dt; d.pos.addScaledVector(d.v, dt);
      const e = new THREE.Euler(d.w.x * dt, d.w.y * dt, d.w.z * dt); d.q.multiply(new THREE.Quaternion().setFromEuler(e));
      if (d.pos.y < 0.05) {
        d.pos.y = 0.05; d.v.multiplyScalar(0.35); d.v.y = Math.abs(d.v.y) * 0.3; d.w.multiplyScalar(0.4);
        if (d.v.length() < 0.4) {
          // лечь плашмя: обнуляем наклон по X/Z
          const yaw = new THREE.Euler().setFromQuaternion(d.q, 'YXZ').y;
          d.q.setFromEuler(new THREE.Euler(0, yaw, Math.PI / 2, 'YXZ')); d.pos.y = 0.04; d.rest = true;
        }
      }
    }
    const inv = new THREE.Matrix4().copy(this.root.matrixWorld).invert();
    const m = new THREE.Matrix4().compose(d.pos, d.q, new THREE.Vector3(1, 1, 1)).premultiply(inv);
    this.gun.matrixAutoUpdate = false; this.gun.matrix.copy(m); this.gun.matrixWorldNeedsUpdate = true; this.gun.visible = true;
  }

  dispose() { this.mixer.stopAllAction(); }
}
