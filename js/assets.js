// Загрузка ассетов: модели GLB, PBR-текстуры, HDRI, звуки.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { settings } from './settings.js';

const gltfLoader = new GLTFLoader();
const texLoader = new THREE.TextureLoader();
const rgbeLoader = new RGBELoader();

export const A = { gltf: {}, tex: {}, sfx: {}, hdri: {}, ready: false };

const WEAPON_FILES = [
  'Pistol_Compact_West', 'Pistol_Compact_East', 'Pistol_Full_West', 'Pistol_Full_East',
  'SMG_Compact_West', 'SMG_Compact_East', 'SMG_Full_West', 'SMG_Full_East',
  'Rifle_Assault_West', 'Rifle_Assault_East', 'Rifle_Battle_West', 'Rifle_Battle_East',
  'Sniper_Rifle_West', 'Sniper_Rifle_East', 'Sniper_Material_West', 'Sniper_Material_East',
  'Shotgun_Pump_West', 'Shotgun_Pump_East', 'Shotgun_Auto_West', 'Shotgun_Auto_East',
];
const SFX = ['rifle_w', 'rifle_e', 'battle', 'smg', 'smg2', 'pistol', 'pistol_h', 'pistol_c', 'shotgun', 'shotgun2', 'sniper', 'sniper2'];
const STEPS = ['sandl1', 'sandl2', 'sandl3', 'sandr1', 'sandr2', 'sandr3', 'stonel1', 'stonel2', 'stonel3', 'stoner1', 'stoner2', 'stoner3'];

let audioCtx = null;
export function getAudioContext() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) audioCtx = new AC();
  }
  return audioCtx;
}

async function loadSound(url) {
  const ctx = getAudioContext();
  if (!ctx) return null;
  try {
    const buf = await (await fetch(url)).arrayBuffer();
    return await new Promise((res) => ctx.decodeAudioData(buf, res, () => res(null)));
  } catch (e) { return null; }
}

// Основная загрузка при старте
export async function loadCore(onProgress) {
  const jobs = [];
  for (const f of WEAPON_FILES) jobs.push(() => gltfLoader.loadAsync(`assets/weapons/${f}.glb`).then(g => { A.gltf[f] = g; }));
  jobs.push(() => gltfLoader.loadAsync('assets/chars/soldier.glb').then(g => { A.gltf.soldier = g; }));
  for (const s of SFX) jobs.push(() => loadSound(`assets/sfx/shot_${s}.mp3`).then(b => { A.sfx['shot_' + s] = b; }));
  for (const s of STEPS) jobs.push(() => loadSound(`assets/sfx/step_${s}.mp3`).then(b => { A.sfx['step_' + s] = b; }));
  let done = 0;
  const total = jobs.length;
  // ограничиваем параллельность
  const queue = [...jobs];
  const worker = async () => {
    while (queue.length) {
      const j = queue.shift();
      try { await j(); } catch (e) { console.warn('asset', e); }
      done++; onProgress && onProgress(done / total);
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  A.ready = true;
}

// PBR-текстуры (по требованию)
export function texSet(name) {
  const small = settings.quality === 'low' || settings.texQuality === 'low';
  const key = name + (small ? '_s' : '');
  if (A.tex[key]) return A.tex[key];
  const sfx = small ? '_s' : '';
  const ld = (suffix, srgb) => {
    const t = texLoader.load(`assets/tex/${name}_${suffix}${sfx}.jpg`);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = small ? 2 : 8;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  A.tex[key] = { map: ld('c', true), normalMap: ld('n', false), roughnessMap: ld('r', false) };
  return A.tex[key];
}

// Дождаться загрузки всех запрошенных текстур
export function texturesReady() {
  const list = [];
  for (const s of Object.values(A.tex)) for (const t of Object.values(s)) if (!t.image || !t.image.complete) list.push(t);
  if (!list.length) return Promise.resolve();
  return new Promise((res) => {
    const check = () => { if (list.every(t => t.image && t.image.complete)) res(); else setTimeout(check, 50); };
    check();
  });
}

export async function loadHDRI(name) {
  if (A.hdri[name]) return A.hdri[name];
  const t = await rgbeLoader.loadAsync(`assets/hdri/${name}.hdr`);
  t.mapping = THREE.EquirectangularReflectionMapping;
  A.hdri[name] = t;
  return t;
}
