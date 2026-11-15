// Иконки оружия (силуэты), отрендеренные из 3D-моделей.
import * as THREE from 'three';
import { buildWeaponModel } from './weapons.js';
import { WEAPONS, KNIVES } from './data.js';

export const ICONS = {};

export function buildWeaponIcons(renderer) {
  const W = 256, H = 96;
  const rt = new THREE.WebGLRenderTarget(W, H);
  const scene = new THREE.Scene();
  const white = new THREE.MeshBasicMaterial({ color: 0xffffff });
  scene.overrideMaterial = white;
  const buf = new Uint8Array(W * H * 4);
  const prevTM = renderer.toneMapping;
  renderer.toneMapping = THREE.NoToneMapping;
  for (const id of [...Object.keys(WEAPONS), ...Object.keys(KNIVES), 'he', 'flash', 'smoke']) {
    scene.clear();
    const m = buildWeaponModel(id, null);
    scene.add(m);
    const box = new THREE.Box3().setFromObject(m);
    const size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
    const aspect = W / H;
    let hw = size.z / 2 * 1.06, hh = size.y / 2 * 1.06;
    if (hw / hh < aspect) hw = hh * aspect; else hh = hw / aspect;
    const cam = new THREE.OrthographicCamera(-hw, hw, hh, -hh, 0.01, 10);
    cam.position.set(c.x - 2, c.y, c.z); cam.lookAt(c);
    renderer.setRenderTarget(rt);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(scene, cam);
    renderer.readRenderTargetPixels(rt, 0, 0, W, H, buf);
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(W, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const si = ((H - 1 - y) * W + x) * 4, di = (y * W + x) * 4;
      const a = buf[si];
      img.data[di] = img.data[di + 1] = img.data[di + 2] = 255; img.data[di + 3] = a;
    }
    ctx.putImageData(img, 0, 0);
    ICONS[id] = cv.toDataURL();
  }
  renderer.setRenderTarget(null);
  renderer.setClearColor(0x000000, 1);
  renderer.toneMapping = prevTM;
  rt.dispose();
}

export function iconImg(id, cls = '') {
  return ICONS[id] ? `<img class="wicon ${cls}" src="${ICONS[id]}" alt="">` : '';
}

// ---------- Картинки предметов (3D-рендер оружия в скине), как в инвентаре CS ----------
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
const ITEM_IMG = new Map();
const itemQueue = [];
let itemCtx = null;
export function initItemRenderer(renderer) {
  const W = 320, H = 160;
  const scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose();
  scene.environmentIntensity = 0.9;
  const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(-1.5, 2, 1.2); scene.add(key);
  const rim = new THREE.DirectionalLight(0xffd8a0, 1.4); rim.position.set(1, 0.6, -1.5); scene.add(rim);
  itemCtx = { renderer, scene, W, H, rt: new THREE.WebGLRenderTarget(W, H, { samples: 4 }), buf: new Uint8Array(W * H * 4) };
}
// Возвращает dataURL, если готово; иначе ставит в очередь (onReady вызовется позже)
export function itemImage(skin, onReady) {
  if (ITEM_IMG.has(skin.id)) return ITEM_IMG.get(skin.id);
  if (!itemQueue.find(q => q.skin.id === skin.id)) itemQueue.push({ skin, onReady });
  return null;
}
export function pumpItemImages(budget = 2) {
  if (!itemCtx) return 0;
  let n = 0;
  while (itemQueue.length && n < budget) {
    const { skin, onReady } = itemQueue.shift();
    try { ITEM_IMG.set(skin.id, renderItem(skin)); } catch (e) { console.warn(e); ITEM_IMG.set(skin.id, ''); }
    n++;
    if (onReady) onReady(skin.id, ITEM_IMG.get(skin.id));
  }
  return n;
}
function renderItem(skin) {
  const { renderer, scene, W, H, rt, buf } = itemCtx;
  const m = buildWeaponModel(skin.weapon, skin);
  scene.add(m);
  const knife = !!KNIVES[skin.weapon];
  m.rotation.set(0, Math.PI / 2, knife ? 0.35 : 0.12);
  m.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(m), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  const aspect = W / H;
  let hw = size.x / 2 * 1.12, hh = size.y / 2 * 1.12;
  if (hw / hh < aspect) hw = hh * aspect; else hh = hw / aspect;
  const cam = new THREE.OrthographicCamera(-hw, hw, hh, -hh, 0.01, 20);
  cam.position.set(c.x, c.y, c.z + 3); cam.lookAt(c);
  const prevTM = renderer.toneMapping, prevExp = renderer.toneMappingExposure;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
  renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear();
  renderer.render(scene, cam);
  renderer.readRenderTargetPixels(rt, 0, 0, W, H, buf);
  renderer.setRenderTarget(null); renderer.setClearColor(0x000000, 1);
  renderer.toneMapping = prevTM; renderer.toneMappingExposure = prevExp;
  scene.remove(m);
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d'), img = ctx.createImageData(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const si = ((H - 1 - y) * W + x) * 4, di = (y * W + x) * 4;
    // рендер-таргет линейный → приблизительно в sRGB
    for (let k = 0; k < 3; k++) img.data[di + k] = Math.min(255, Math.pow(buf[si + k] / 255, 1 / 2.2) * 255);
    img.data[di + 3] = buf[si + 3];
  }
  ctx.putImageData(img, 0, 0);
  return cv.toDataURL('image/webp', 0.9);
}
