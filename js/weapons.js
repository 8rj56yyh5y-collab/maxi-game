// 3D-модели оружия: GLB-модели (CC0) с PBR-материалами + процедурные ножи и гранаты.
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { A, texSet } from './assets.js';
import { WEAPONS, KNIVES } from './data.js';
import { skinTexture } from './textures.js';
import { buildKnifeModel } from './knives.js';
import { hasProcGun, procGunGeometry } from './guns.js';
import { applyFx } from './skinart.js';

export { WEAPONS };

// ---------- Материалы ----------
const M = {};
function mats() {
  if (M.ready) return M;
  const metalTex = texSet('metal2');
  const detail = (o) => new THREE.MeshStandardMaterial({ normalMap: metalTex.normalMap, normalScale: new THREE.Vector2(0.35, 0.35), ...o });
  // воронёный металл с потёртостями и чёрный полимер (фото-текстуры ambientCG, CC0)
  const gm = texSet('gun_metal'), gp = texSet('gun_poly');
  M.body = new THREE.MeshStandardMaterial({ map: gm.map, normalMap: gm.normalMap, roughnessMap: gm.roughnessMap, color: 0x55585e, metalness: 0.6, roughness: 0.55, normalScale: new THREE.Vector2(0.6, 0.6), envMapIntensity: 1.15 });
  M.poly = new THREE.MeshStandardMaterial({ map: gp.map, normalMap: gp.normalMap, roughnessMap: gp.roughnessMap, color: 0x8a8a8a, metalness: 0.05, roughness: 0.85, envMapIntensity: 0.9 });
  M.steelDark = new THREE.MeshStandardMaterial({ map: gm.map, normalMap: gm.normalMap, roughnessMap: gm.roughnessMap, color: 0x6a6c70, metalness: 0.85, roughness: 0.75, envMapIntensity: 1.1 });
  M.steel = new THREE.MeshStandardMaterial({ map: gm.map, normalMap: gm.normalMap, roughnessMap: gm.roughnessMap, color: 0xc8ccd0, metalness: 1, roughness: 0.55, envMapIntensity: 1.2 });
  const wood = texSet('wood2');
  M.wood = new THREE.MeshStandardMaterial({ map: wood.map, normalMap: wood.normalMap, roughnessMap: wood.roughnessMap, color: 0x55331d, metalness: 0, roughness: 0.42, envMapIntensity: 1.0 });
  M.brass = new THREE.MeshStandardMaterial({ color: 0xc9a043, metalness: 1, roughness: 0.3 });
  M.red = new THREE.MeshStandardMaterial({ color: 0x8e2a1e, metalness: 0.05, roughness: 0.6 });
  M.rubber = new THREE.MeshStandardMaterial({ color: 0x111214, roughness: 0.92 });
  M.lens = new THREE.MeshStandardMaterial({ color: 0x06121c, metalness: 1, roughness: 0.02, emissive: 0x0a2236, emissiveIntensity: 0.6 });
  M.blade = detail({ color: 0xb9bec4, metalness: 1, roughness: 0.18 });
  M.ready = true;
  return M;
}

// Сопоставление материалов модели (плоские цвета) с PBR
function mapMaterial(name, skinMat) {
  const m = mats();
  if (skinMat && skinMat.userData.art && /Black|Grey_Dark|Brown|Red/.test(name)) return skinMat;
  if (/Black/.test(name)) return skinMat || m.body;
  if (/Grey_Darker|Grey_Dark/.test(name)) return m.steelDark;
  if (/Grey_Light|Grey_Lighter|White/.test(name)) return m.steel;
  if (/Brown/.test(name)) return skinMat || m.wood;
  if (/Brass|Yellow/.test(name)) return m.brass;
  if (/Red/.test(name)) return skinMat || m.red;
  return m.body;
}

const skinMatCache = new Map();
export function skinMaterial(skin) {
  if (!skin) return null;
  if (skinMatCache.has(skin.id)) return skinMatCache.get(skin.id);
  const t = skinTexture(skin);
  const m = new THREE.MeshStandardMaterial({
    map: t, metalness: 0.35, roughness: 0.42,
    normalMap: texSet('metal2').normalMap, normalScale: new THREE.Vector2(0.25, 0.25),
    emissive: skin.glow ? new THREE.Color(skin.glow) : 0x000000, emissiveMap: skin.glow ? t : null, emissiveIntensity: skin.glow ? 0.45 : 0,
  });
  if (skin.pattern === 'art') {
    // рисунок растягиваем ровно на габариты оружия (боковая проекция UV)
    const w = WEAPONS[skin.weapon];
    if (w && (hasProcGun(skin.weapon) || A.gltf[w.model])) {
      const box = hasProcGun(skin.weapon) ? procGunGeometry(skin.weapon).meta.box : modelMeta(w.model).box;
      const u0 = -box.max.z * 3.2, u1 = -box.min.z * 3.2, v0 = box.min.y * 3.2 - 0.04, v1 = box.max.y * 3.2 + 0.04;
      const tt = t.clone(); tt.needsUpdate = true;
      tt.repeat.set(1 / (u1 - u0), 1 / (v1 - v0)); tt.offset.set(-u0 / (u1 - u0), -v0 / (v1 - v0));
      tt.wrapS = tt.wrapT = THREE.ClampToEdgeWrapping;
      m.map = tt;
    }
    m.userData.art = true;
    m.metalness = skin.fx === 'chameleon' ? 0.9 : 0.4; m.roughness = skin.fx === 'chameleon' ? 0.18 : 0.32;
    m.emissive.set(0x000000); m.emissiveMap = null; m.emissiveIntensity = 1; m.envMapIntensity = 1.2;
    applyFx(m, skin.fx);
  }
  skinMatCache.set(skin.id, m);
  return m;
}

// Боковая проекция UV (модели смотрят стволом в -Z)
const uvDone = new WeakSet();
function sideUV(geo) {
  if (uvDone.has(geo)) return;
  const p = geo.attributes.position, n = p.count;
  const uv = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) { uv[i * 2] = -p.getZ(i) * 3.2; uv[i * 2 + 1] = p.getY(i) * 3.2 + p.getX(i) * 0.5; }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  uvDone.add(geo);
}

// Метаданные модели (точки хвата, прицел, дуло)
const META = {};
function modelMeta(file) {
  if (META[file]) return META[file];
  const scene = A.gltf[file].scene;
  scene.updateMatrixWorld(true);
  const pos = (re) => { let v = null; scene.traverse(o => { if (!v && re.test(o.name)) v = o.getWorldPosition(new THREE.Vector3()); }); return v; };
  const box = new THREE.Box3().setFromObject(scene);
  const trig = pos(/^Trigger$/) || new THREE.Vector3(0, -0.02, 0.05);
  const muzzle = pos(/^Attach_Muzzle$/) || new THREE.Vector3(0, 0.02, box.min.z);
  const rail = pos(/^Attach_RailBottom$/) || new THREE.Vector3(0, -0.01, (box.min.z + trig.z) / 2);
  const pump = pos(/^Pump$/);
  const rear = pos(/^Rear_?Sights$/);
  const scope = pos(/^Attach_Scope$/) || new THREE.Vector3(0, box.max.y - 0.02, 0);
  const isPistol = /Pistol/.test(file);
  const m = {
    box, muzzle, scope,
    gripR: trig.clone().add(new THREE.Vector3(0, isPistol ? -0.035 : -0.045, isPistol ? 0.035 : 0.042)),
    gripL: isPistol ? trig.clone().add(new THREE.Vector3(-0.022, -0.05, 0.04)) : (pump || rail).clone().add(new THREE.Vector3(0, -0.012, 0)),
    sightY: rear ? rear.y + 0.012 : scope.y + 0.014,
    length: box.max.z - box.min.z,
  };
  META[file] = m;
  return m;
}

// Процедурный оптический прицел
function buildScope(parent, at, big) {
  const m = mats();
  const g = new THREE.Group();
  const L = big ? 0.3 : 0.2, R = big ? 0.019 : 0.016;
  const tube = new THREE.CylinderGeometry(R, R, L, 20); tube.rotateX(Math.PI / 2);
  g.add(new THREE.Mesh(tube, m.body));
  const bellF = new THREE.CylinderGeometry(R * 1.55, R, 0.07, 20); bellF.rotateX(-Math.PI / 2); const bf = new THREE.Mesh(bellF, m.body); bf.position.z = -L / 2 - 0.03; g.add(bf);
  const bellR = new THREE.CylinderGeometry(R * 1.25, R, 0.05, 20); bellR.rotateX(Math.PI / 2); const br = new THREE.Mesh(bellR, m.body); br.position.z = L / 2 + 0.02; g.add(br);
  const lensF = new THREE.Mesh(new THREE.CircleGeometry(R * 1.45, 20), m.lens); lensF.position.z = -L / 2 - 0.066; lensF.rotation.y = Math.PI; g.add(lensF);
  const lensR = new THREE.Mesh(new THREE.CircleGeometry(R * 1.15, 20), m.lens); lensR.position.z = L / 2 + 0.046; g.add(lensR);
  const turret = new THREE.CylinderGeometry(0.012, 0.012, 0.03, 12);
  const t1 = new THREE.Mesh(turret, m.steelDark); t1.position.set(0, R + 0.012, 0); g.add(t1);
  const t2 = new THREE.Mesh(turret, m.steelDark); t2.rotation.z = Math.PI / 2; t2.position.set(R + 0.012, 0, 0); g.add(t2);
  for (const z of [-L * 0.28, L * 0.28]) {
    const ring = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.034, 0.018), m.steelDark); ring.position.set(0, -R - 0.006, z); g.add(ring);
  }
  g.position.copy(at).add(new THREE.Vector3(0, R + 0.016, 0));
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  parent.add(g);
  return g.position.y;
}

// ---------- Ножи ----------
function extrude(shape, depth, bevel, mat) {
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 12 });
  geo.translate(0, 0, -depth / 2);
  geo.rotateY(Math.PI / 2); // x (вперёд) → -z
  const p = geo.attributes.position, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) { uv[i * 2] = -p.getZ(i) * 4; uv[i * 2 + 1] = p.getY(i) * 4; }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return new THREE.Mesh(geo, mat);
}
function shapeFrom(pts) { const s = new THREE.Shape(); pts.forEach(([x, y], i) => i ? s.lineTo(x, y) : s.moveTo(x, y)); return s; }

// Рукоять от 0 назад (до +z)
function handle(g, mat, len, w, h) {
  const m = mats();
  g.add(extrude(shapeFrom([[0, -h / 2], [-len, -h / 2 + 0.004], [-len - 0.01, 0], [-len, h / 2 - 0.003], [0, h / 2]]), w, 0.004, mat));
  for (let i = 0; i < 5; i++) {
    const r = new THREE.Mesh(new THREE.BoxGeometry(w + 0.006, h + 0.003, 0.005), m.rubber);
    r.position.set(0, 0, 0.02 + i * (len - 0.03) / 5); g.add(r);
  }
  const pommel = new THREE.Mesh(new THREE.CylinderGeometry(h * 0.42, h * 0.5, 0.014, 14), m.steelDark);
  pommel.rotation.x = Math.PI / 2; pommel.position.z = len + 0.008; g.add(pommel);
}

function buildKnife(type, skin) {
  const m = mats();
  const bladeMat = skinMaterial(skin) || m.blade;
  const g = new THREE.Group();
  switch (type) {
    case 'bayonet': {
      handle(g, m.poly, 0.12, 0.024, 0.03);
      const guard = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.07, 0.012), m.steelDark); guard.position.z = -0.006; g.add(guard);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.012, 0.004, 8, 16), m.steelDark); ring.position.set(0, 0.03, -0.006); ring.rotation.y = Math.PI / 2; g.add(ring);
      const b = new THREE.Shape(); b.moveTo(0, -0.014); b.lineTo(0.17, -0.012); b.quadraticCurveTo(0.21, -0.008, 0.225, 0.006); b.lineTo(0.15, 0.016); b.lineTo(0, 0.016);
      const bm = extrude(b, 0.004, 0.0015, bladeMat); bm.position.z = -0.012; g.add(bm);
      const fuller = new THREE.Mesh(new THREE.BoxGeometry(0.0064, 0.004, 0.11), m.steelDark); fuller.position.set(0, 0.004, -0.08); g.add(fuller);
      break;
    }
    case 'karambit': {
      const h = new THREE.Shape(); h.moveTo(0, -0.013); h.quadraticCurveTo(-0.06, -0.022, -0.1, -0.004); h.lineTo(-0.1, 0.02); h.quadraticCurveTo(-0.06, 0.008, 0, 0.013);
      g.add(extrude(h, 0.022, 0.004, m.poly));
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.006, 10, 24), m.steelDark); ring.position.set(0, 0.012, 0.118); ring.rotation.y = Math.PI / 2; g.add(ring);
      const b = new THREE.Shape(); b.moveTo(0, -0.012); b.quadraticCurveTo(0.08, -0.02, 0.125, -0.065); b.quadraticCurveTo(0.09, -0.008, 0, 0.014);
      g.add(extrude(b, 0.004, 0.0012, bladeMat));
      break;
    }
    case 'butterfly': {
      for (const sx of [-1, 1]) {
        const half = extrude(shapeFrom([[0, -0.012], [-0.13, -0.012], [-0.135, 0], [-0.13, 0.012], [0, 0.012]]), 0.011, 0.002, m.steelDark);
        half.position.x = sx * 0.008; g.add(half);
      }
      for (let i = 0; i < 6; i++) { const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.03, 10), m.rubber); hole.rotation.z = Math.PI / 2; hole.position.set(0, 0, 0.02 + i * 0.018); g.add(hole); }
      const b = new THREE.Shape(); b.moveTo(0, -0.011); b.lineTo(0.16, -0.009); b.quadraticCurveTo(0.2, -0.004, 0.205, 0.004); b.lineTo(0.13, 0.013); b.lineTo(0, 0.012);
      g.add(extrude(b, 0.0035, 0.001, bladeMat));
      break;
    }
    case 'kukri': {
      handle(g, m.wood, 0.12, 0.026, 0.032);
      const guard = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.045, 0.008), m.brass); guard.position.z = -0.004; g.add(guard);
      const b = new THREE.Shape(); b.moveTo(0, -0.014); b.quadraticCurveTo(0.12, -0.016, 0.2, -0.05); b.quadraticCurveTo(0.24, -0.062, 0.262, -0.04); b.quadraticCurveTo(0.2, 0.022, 0, 0.016);
      const bm = extrude(b, 0.005, 0.0015, bladeMat); bm.position.z = -0.008; g.add(bm);
      break;
    }
    case 'dagger': {
      handle(g, m.poly, 0.1, 0.022, 0.028);
      const guard = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.075, 0.01), m.steelDark); guard.position.z = -0.005; g.add(guard);
      const b = new THREE.Shape(); b.moveTo(0, -0.018); b.lineTo(0.17, -0.002); b.lineTo(0.175, 0); b.lineTo(0.17, 0.002); b.lineTo(0, 0.018);
      const bm = extrude(b, 0.005, 0.0018, bladeMat); bm.position.z = -0.01; g.add(bm);
      break;
    }
    default: { // боевой
      handle(g, m.poly, 0.12, 0.026, 0.032);
      const guard = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.06, 0.01), m.steelDark); guard.position.z = -0.005; g.add(guard);
      const b = new THREE.Shape(); b.moveTo(0, -0.016); b.lineTo(0.15, -0.016); b.quadraticCurveTo(0.2, -0.012, 0.215, 0.004); b.lineTo(0.17, 0.008); b.quadraticCurveTo(0.12, 0.018, 0.08, 0.018); b.lineTo(0, 0.018);
      const bm = extrude(b, 0.005, 0.0015, bladeMat); bm.position.z = -0.01; g.add(bm);
      for (let i = 0; i < 6; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.0062, 0.006, 0.006), m.blade); s.position.set(0, 0.0195, -0.03 - i * 0.01); s.rotation.x = Math.PI / 4; g.add(s); }
    }
  }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// ---------- Гранаты ----------
export function buildGrenade(type) {
  const m = mats();
  const g = new THREE.Group();
  const col = type === 'he' ? 0x4b5a32 : type === 'smoke' ? 0x5a6270 : 0x2f3a46;
  const bodyMat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.55, metalness: 0.35, normalMap: texSet('metal2').normalMap });
  const body = type === 'he' ? new THREE.Mesh(new THREE.SphereGeometry(0.033, 18, 14), bodyMat) : new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.09, 18), bodyMat);
  g.add(body);
  const topY = type === 'he' ? 0.04 : 0.055;
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.022, 12), m.steelDark); top.position.y = topY; g.add(top);
  const lever = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.06, 0.012), m.steel); lever.position.set(0.02, topY - 0.02, 0); lever.rotation.z = -0.15; g.add(lever);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.01, 0.002, 6, 16), m.steel); ring.position.set(-0.015, topY + 0.008, 0); g.add(ring);
  if (type !== 'he') { const band = new THREE.Mesh(new THREE.CylinderGeometry(0.0265, 0.0265, 0.012, 18), new THREE.MeshStandardMaterial({ color: type === 'smoke' ? 0xd9d9d9 : 0x2ec4ff, roughness: 0.5 })); band.position.y = 0.015; g.add(band); }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// ---------- Сборка оружия ----------
export function buildWeaponModel(id, skin) {
  if (KNIVES[id]) {
    const g = buildKnifeModel(KNIVES[id].type, skin);
    const mz = new THREE.Object3D(); mz.position.set(0, 0, -0.2); g.add(mz);
    Object.assign(g.userData, { muzzle: mz, gripR: new THREE.Vector3(0, 0, 0.055), gripL: null, sightY: 0, knife: true });
    return g;
  }
  if (['he', 'flash', 'smoke'].includes(id)) {
    const g = buildGrenade(id);
    Object.assign(g.userData, { muzzle: g, gripR: new THREE.Vector3(0, -0.01, 0.0), gripL: null, sightY: 0, grenade: true });
    return g;
  }
  const w = WEAPONS[id];
  if (w && hasProcGun(id)) return buildProcGun(id, skin);
  const src = w && A.gltf[w.model];
  const g = new THREE.Group();
  if (!src) return g;
  const meta = modelMeta(w.model);
  const model = cloneSkinned(src.scene);
  const sm = skinMaterial(skin);
  let mag = null, bolt = null;
  model.traverse(o => {
    if (o.isMesh) {
      sideUV(o.geometry);
      o.material = Array.isArray(o.material) ? o.material.map(mm => mapMaterial(mm.name, sm)) : mapMaterial(o.material.name, sm);
      o.castShadow = true; o.receiveShadow = true;
      o.frustumCulled = false;
    }
    if (o.name === 'Magazine') mag = o;
    if (o.name === 'Bolt') bolt = o;
  });
  g.add(model);
  let sightY = meta.sightY;
  if (w.scope >= 3) sightY = buildScope(g, meta.scope, w.id === 'awr');
  const muzzle = new THREE.Object3D(); muzzle.position.copy(meta.muzzle); g.add(muzzle);
  Object.assign(g.userData, {
    muzzle, gripR: meta.gripR.clone(), gripL: meta.gripL.clone(), sightY, mag, bolt,
    magRest: mag ? mag.position.clone() : null, boltRest: bolt ? bolt.position.clone() : null, length: meta.length, box: meta.box,
  });
  return g;
}

// ---------- Процедурные модели (guns.js) ----------
function roleMaterial(role, skinMat) {
  const m = mats();
  if (skinMat && (role === 'body' || role === 'wood' || (skinMat.userData.art && role === 'metal'))) return skinMat;
  return { body: m.body, metal: m.steelDark, steel: m.steel, wood: m.wood, rubber: m.rubber, lens: m.lens, brass: m.brass }[role] || m.body;
}
function buildProcGun(id, skin) {
  const { roles, meta } = procGunGeometry(id);
  const sm = skinMaterial(skin);
  const g = new THREE.Group();
  const targets = {};
  for (const [key, geo] of Object.entries(roles)) {
    const [tgt, role] = key.includes(':') ? key.split(':') : [null, key];
    const mesh = new THREE.Mesh(geo, roleMaterial(role, sm));
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
    if (tgt) { if (!targets[tgt]) { targets[tgt] = new THREE.Group(); targets[tgt].name = tgt; g.add(targets[tgt]); } targets[tgt].add(mesh); }
    else g.add(mesh);
  }
  const muzzle = new THREE.Object3D(); muzzle.position.copy(meta.muzzle); g.add(muzzle);
  const w = WEAPONS[id];
  Object.assign(g.userData, {
    muzzle, gripR: meta.gripR.clone(), gripL: meta.gripL.clone(),
    sightY: meta.sightY !== null ? meta.sightY : meta.gripR.y + 0.06,
    mag: targets.mag || null, bolt: targets.bolt || null, pump: targets.pump || null,
    magRest: targets.mag ? new THREE.Vector3() : null, boltRest: targets.bolt ? new THREE.Vector3() : null,
    length: meta.length, box: meta.box, proc: true, scoped: (w.scope || 0) >= 3,
  });
  return g;
}
