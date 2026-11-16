// Руки от первого лица: тактические перчатки, обхватывающие рукоять/цевьё, и рукава с манжетами.
// Кисти — дочерние объекты оружия (двигаются вместе с ним), предплечья решаются двухзвенным IK от плеч.
import * as THREE from 'three';
import { texSet } from './assets.js';

const UP = new THREE.Vector3(0, 1, 0);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();

let MATS = null;
function mats(team) {
  if (!MATS) {
    const gl = texSet('glove'), cl = texSet('cloth'), gp = texSet('gun_poly');
    const tile = (t, n) => { const c = t.clone(); c.wrapS = c.wrapT = THREE.RepeatWrapping; c.repeat.set(n, n); c.needsUpdate = true; return c; };
    MATS = {
      glove: new THREE.MeshStandardMaterial({ map: tile(gl.map, 3), normalMap: tile(gl.normalMap, 3), color: 0x3a3a3c, roughness: 0.78, metalness: 0.02 }),
      pad: new THREE.MeshStandardMaterial({ map: tile(gp.map, 2), normalMap: tile(gp.normalMap, 2), color: 0x2a2b2e, roughness: 0.6, metalness: 0.1 }),
      cuff: new THREE.MeshStandardMaterial({ map: tile(gl.map, 2), color: 0x1e1f21, roughness: 0.85 }),
      sleeve: {},
      clothN: tile(cl.normalMap, 4), clothC: tile(cl.map, 4),
    };
  }
  if (!MATS.sleeve[team]) MATS.sleeve[team] = new THREE.MeshStandardMaterial({ map: MATS.clothC, normalMap: MATS.clothN, color: team === 'B' ? 0x6a6448 : 0x4a5462, roughness: 0.95 });
  return MATS;
}

function tube(points, r, mat, closed = false) {
  const curve = new THREE.CatmullRomCurve3(points, closed);
  const g = new THREE.TubeGeometry(curve, Math.max(8, points.length * 4), r, 10, closed);
  const m = new THREE.Mesh(g, mat);
  // скругление концов
  for (const p of [points[0], points[points.length - 1]]) { const s = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), mat); s.position.copy(p); m.add(s); }
  return m;
}

// Кисть, обхватывающая цилиндр (рукоять/цевьё).
// o — центр хвата, axis — ось цилиндра (вдоль пальцев сверху вниз), r0 — «правая» опорная ось, R — радиус хвата
function wrapHand({ o, axis, r0, R, from = 0.15, to = 3.4, fingers = 4, spacing = 0.021, thumb = 'over', palmAt = -0.6, flip = 1 }, M) {
  const g = new THREE.Group();
  const a = axis.clone().normalize(), r = r0.clone().addScaledVector(a, -r0.dot(a)).normalize(), f = new THREE.Vector3().crossVectors(r, a).multiplyScalar(flip);
  const ring = (c, rad, th) => c.clone().addScaledVector(r, Math.cos(th) * rad).addScaledVector(f, Math.sin(th) * rad);
  const fr = 0.0088;
  for (let k = 0; k < fingers; k++) {
    const c = o.clone().addScaledVector(a, (k - (fingers - 1) / 2) * spacing);
    const len = k === fingers - 1 ? 0.82 : 1;
    const pts = []; for (let i = 0; i <= 8; i++) pts.push(ring(c, R + fr, from + (to - from) * len * i / 8));
    g.add(tube(pts, fr * (k === fingers - 1 ? 0.88 : 1), M.glove));
    // костяшки — накладки
    const kn = new THREE.Mesh(new THREE.SphereGeometry(fr * 1.25, 10, 8), M.pad); kn.position.copy(ring(c, R + fr * 1.6, from + 0.35)); kn.scale.set(1, 1, 1); g.add(kn);
  }
  // ладонь: скруглённая пластина на стороне хвата
  const pc = ring(o, R + 0.016, palmAt);
  const palm = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, spacing * (fingers - 1) + 0.01, 6, 12), M.glove);
  palm.position.copy(pc); palm.quaternion.setFromUnitVectors(UP, a); palm.scale.set(1, 1, 0.55);
  const nrm = pc.clone().sub(o).addScaledVector(a, -pc.clone().sub(o).dot(a)).normalize();
  const q2 = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1).applyQuaternion(palm.quaternion), nrm); palm.quaternion.premultiply(q2);
  g.add(palm);
  const pad = new THREE.Mesh(new THREE.BoxGeometry(0.03, spacing * (fingers - 1) + 0.016, 0.01), M.pad); pad.position.copy(ring(o, R + 0.034, palmAt + 0.25)); pad.quaternion.copy(palm.quaternion); g.add(pad);
  // большой палец
  const tc = o.clone().addScaledVector(a, -(fingers / 2) * spacing - 0.008);
  const tp = thumb === 'over' ? [ring(tc, R + 0.02, palmAt), ring(tc, R + 0.012, palmAt - 0.9), ring(tc, R + 0.01, palmAt - 1.6), ring(tc, R + 0.01, palmAt - 2.1)]
    : [ring(tc, R + 0.02, palmAt), ring(tc.clone().addScaledVector(a, -0.012), R + 0.014, palmAt + 0.7), ring(tc.clone().addScaledVector(a, -0.02), R + 0.012, palmAt + 1.3)];
  g.add(tube(tp, 0.0098, M.glove));
  // запястье (точка крепления предплечья) — за ладонью, по оси «вниз»
  const wrist = ring(o.clone().addScaledVector(a, (fingers / 2) * spacing + 0.035), R + 0.028, palmAt);
  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.031, 0.034, 0.03, 16), M.cuff); cuff.position.copy(wrist); g.add(cuff);
  g.userData.wrist = wrist; g.userData.cuff = cuff;
  g.traverse(m => { if (m.isMesh) { m.castShadow = false; m.receiveShadow = false; } });
  return g;
}

export class FPArms {
  constructor(scene) {
    this.scene = scene;
    this.hands = [];
    this.sleeves = [];
    this.team = 'A';
  }
  clear() {
    for (const h of this.hands) h.parent && h.parent.remove(h);
    for (const s of this.sleeves) this.scene.remove(s.root);
    this.hands = []; this.sleeves = [];
  }
  // Построить кисти для оружия (gun — объект в pivot, ud — userData, cat — категория)
  build(gun, ud, cat, team) {
    this.clear();
    this.team = team;
    const M = mats(team);
    const gR = ud.gripR.clone(), gL = ud.gripL ? ud.gripL.clone() : null;
    if (cat === 'knife') {
      this.right = wrapHand({ o: gR.clone().add(new THREE.Vector3(0, 0, 0.005)), axis: new THREE.Vector3(0, 0, 1), r0: new THREE.Vector3(1, 0, 0), R: 0.016, from: -0.5, to: 2.9, spacing: 0.02, thumb: 'over', palmAt: -0.9 }, M);
    } else if (cat === 'grenade') {
      this.right = wrapHand({ o: gR.clone(), axis: new THREE.Vector3(0, -1, 0.2), r0: new THREE.Vector3(1, 0, 0), R: 0.028, from: -0.3, to: 3.0, spacing: 0.02, thumb: 'over', palmAt: -1.2 }, M);
    } else {
      // правая: обхват пистолетной рукоятки (ось вниз-назад)
      const axis = new THREE.Vector3(0, -1, cat === 'pistol' ? 0.28 : 0.38);
      this.right = wrapHand({ o: gR.clone().add(new THREE.Vector3(0, 0.004, -0.004)), axis, r0: new THREE.Vector3(1, 0, 0), R: cat === 'pistol' ? 0.015 : 0.016, from: 0.05, to: 3.2, spacing: 0.0215, thumb: 'over', palmAt: -0.75 }, M);
      if (cat === 'pistol') {
        // левая ладонь поддерживает снизу, пальцы обнимают правую кисть
        this.left = wrapHand({ o: gR.clone().add(new THREE.Vector3(-0.004, -0.028, -0.006)), axis, r0: new THREE.Vector3(-1, 0, 0), R: 0.03, from: 0.2, to: 2.6, spacing: 0.02, fingers: 4, thumb: 'side', palmAt: -0.5, flip: -1 }, M);
      } else if (gL) {
        // левая: под цевьём, пальцы снизу-справа, большой палец сверху слева
        this.left = wrapHand({ o: gL.clone().add(new THREE.Vector3(0, 0.002, 0)), axis: new THREE.Vector3(0, 0, -1), r0: new THREE.Vector3(-1, 0, 0), R: 0.022, from: -0.3, to: 2.7, spacing: 0.02, thumb: 'over', palmAt: -0.2, flip: -1 }, M);
      }
    }
    for (const h of [this.right, this.left]) if (h) { gun.add(h); this.hands.push(h); }
    // рукава
    const mk = (side) => {
      const root = new THREE.Group();
      const fore = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.046, 1, 18, 1, true), M.sleeve[team]);
      const roll = new THREE.Mesh(new THREE.TorusGeometry(0.038, 0.009, 8, 20), M.sleeve[team]);
      const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.058, 1, 18, 1, true), M.sleeve[team]);
      const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.048, 14, 10), M.sleeve[team]);
      root.add(fore, roll, upper, elbow);
      root.traverse(m => { if (m.isMesh) { m.castShadow = false; m.receiveShadow = false; } });
      this.scene.add(root);
      return { root, fore, roll, upper, elbow, side };
    };
    if (this.right) this.sleeves.push({ ...mk(1), hand: this.right });
    if (this.left) this.sleeves.push({ ...mk(-1), hand: this.left });
  }
  // Левая рука во время перезарядки уходит к магазину
  setLeftOffset(v) { if (this.left) this.left.position.copy(v); }

  update(visible) {
    for (const s of this.sleeves) {
      s.root.visible = visible;
      if (!visible) continue;
      s.hand.updateMatrixWorld(true);
      const W = s.hand.localToWorld(_a.copy(s.hand.userData.wrist));
      const S = _b.set(0.2 * s.side, -0.34, 0.16);
      const L1 = 0.3, L2 = 0.29;
      const dir = _c.subVectors(W, S); let d = dir.length(); d = Math.min(Math.max(d, 0.08), L1 + L2 - 0.002); dir.normalize();
      const cosA = (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
      const pole = new THREE.Vector3(0.6 * s.side, -1, 0.25); pole.addScaledVector(dir, -pole.dot(dir)).normalize();
      const E = S.clone().addScaledVector(dir, L1 * cosA).addScaledVector(pole, L1 * sinA);
      const place = (mesh, p0, p1) => { const v = p1.clone().sub(p0); mesh.position.copy(p0).add(p1).multiplyScalar(0.5); mesh.quaternion.setFromUnitVectors(UP, v.clone().normalize()); mesh.scale.set(1, v.length(), 1); };
      // предплечье от локтя к запястью (узкий конец у запястья)
      place(s.fore, W, E);
      place(s.upper, E, S);
      s.elbow.position.copy(E);
      const wd = E.clone().sub(W).normalize();
      s.roll.position.copy(W).addScaledVector(wd, 0.05); s.roll.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), wd);
    }
  }
}
