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
