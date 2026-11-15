// Точка входа: лобби, арсенал, кейсы, настройки, запуск матча, игровой цикл.
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { settings, saveSettings, getLayout, DEFAULT_LAYOUT, BUTTON_LABELS, isTouchMode, hadSavedSettings } from './settings.js';
import { Input, BTN_ICONS } from './input.js';
import { HUD } from './hud.js';
import { Game } from './game.js';
import { MAPS, buildMap } from './maps.js';
import { WEAPONS, PRIMARIES, buildWeaponModel } from './weapons.js';
import { DIFFICULTY } from './bots.js';
import { profile, saveProfile, SKINS, SKIN_WEAPONS, RARITY, CASES, equip, equippedSkin, openCase, randomFiller } from './skins.js';
import { skinPreviewURL, surface } from './textures.js';
import { CharacterModel } from './character.js';
import { setupAtmosphere } from './render.js';
import { buildWeaponIcons, iconImg } from './icons.js';
import { sound } from './audio.js';

const $ = (id) => document.getElementById(id);
const canvas = $('game');
const nextFrame = () => new Promise(r => requestAnimationFrame(() => r()));

if (!hadSavedSettings && isTouchMode()) settings.quality = 'low';

// ---------- Рендер ----------
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', stencil: false });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.autoClear = false;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
function applyPixelRatio() {
  const q = settings.quality === 'low' ? 0.75 : settings.quality === 'medium' ? 1 : 1.15;
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1) * settings.renderScale * q * (isTouchMode() ? 0.85 : 1));
}
applyPixelRatio();
renderer.setSize(innerWidth, innerHeight, false);

const input = new Input(canvas);
const hud = new HUD();
let game = null;

// ---------- Сцена лобби ----------
const lobby = { scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 0.05, 100), t: 0, mode: 'char' };
function buildLobby() {
  const sc = lobby.scene;
  sc.background = new THREE.Color(0x0a0d11);
  sc.fog = new THREE.Fog(0x0a0d11, 6, 16);
  // отражения от «неба»
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  const sky = new Sky(); sky.scale.setScalar(1000);
  const u = sky.material.uniforms; u.turbidity.value = 6; u.rayleigh.value = 2; u.sunPosition.value.set(0.3, 0.2, -1);
  envScene.add(sky);
  sc.environment = pmrem.fromScene(envScene, 0.04).texture;
  sc.environmentIntensity = 0.35;
  pmrem.dispose();
  sc.add(new THREE.HemisphereLight(0x7f9bc4, 0x20160e, 0.5));
  const key = new THREE.SpotLight(0xffe2c0, 60, 14, 0.5, 0.6, 1.6);
  key.position.set(2.2, 4.2, 3.2); key.target.position.set(0, 1, 0);
  key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -0.0005;
  sc.add(key, key.target);
  const rim = new THREE.DirectionalLight(0xff7a18, 3.2); rim.position.set(-3, 2.5, -3); sc.add(rim);
  const rim2 = new THREE.DirectionalLight(0x5aa9ff, 1.6); rim2.position.set(3, 1.5, -2.5); sc.add(rim2);
  // пол
  const floor = new THREE.Mesh(new THREE.CircleGeometry(9, 64), new THREE.MeshStandardMaterial({ color: 0x14181d, roughness: 0.32, metalness: 0.4 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; sc.add(floor);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 0.9, 64), new THREE.MeshBasicMaterial({ color: 0xff7a18 }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.003; sc.add(ring);
  const ring2 = new THREE.Mesh(new THREE.RingGeometry(1.15, 1.17, 64), new THREE.MeshBasicMaterial({ color: 0x553015 }));
  ring2.rotation.x = -Math.PI / 2; ring2.position.y = 0.003; sc.add(ring2);
  // декорации: контейнеры и ящики в полутьме
  const box = (w, h, d, x, y, z, name, ry = 0) => {
    const s = surface(name);
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ map: s.map, normalMap: s.normalMap, roughness: s.roughness, metalness: s.metalness }));
    m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = m.receiveShadow = true; sc.add(m);
  };
  box(6, 2.6, 2.4, -1.5, 1.3, -3.6, 'container_b', 0.1);
  box(6, 2.6, 2.4, -1.2, 3.9, -3.9, 'container_o', 0.05);
  box(2.4, 2.6, 6, 4.2, 1.3, -2.6, 'container_r', -0.3);
  box(1, 1, 1, 1.6, 0.5, -1.3, 'wood', 0.4); box(1, 1, 1, 2.2, 0.5, -0.4, 'wood', -0.2); box(0.8, 0.8, 0.8, 1.9, 1.4, -0.9, 'wood', 0.7);
  box(1, 1, 1, -2.4, 0.5, -1.2, 'wood', 0.2);
  // боец
  lobby.char = new CharacterModel('A');
  lobby.char.root.traverse(o => { if (o.isMesh) o.castShadow = true; });
  sc.add(lobby.char.root);
  lobby.actor = { pos: new THREE.Vector3(0, 0, 0), vel: new THREE.Vector3(), yaw: Math.PI - 0.45, pitch: -0.12, alive: true, crouchT: 0 };
  // витрина оружия
  lobby.weaponHolder = new THREE.Group(); lobby.weaponHolder.position.set(0, 1.1, 0); sc.add(lobby.weaponHolder);
  // частицы пыли в свете
  const pg = new THREE.BufferGeometry(); const pts = new Float32Array(300 * 3);
  for (let i = 0; i < 300; i++) { pts[i * 3] = (Math.random() - 0.5) * 6; pts[i * 3 + 1] = Math.random() * 3.5; pts[i * 3 + 2] = (Math.random() - 0.5) * 5; }
  pg.setAttribute('position', new THREE.BufferAttribute(pts, 3));
  lobby.dust = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0xffd9b0, size: 0.012, transparent: true, opacity: 0.5 }));
  sc.add(lobby.dust);
}

function setLobbyCharacter() {
  const w = primaryOf();
  lobby.char.setWeapon(w, equippedSkin(w));
}

function setShowcase(weaponId, skin) {
  if (lobby.weapon) lobby.weaponHolder.remove(lobby.weapon);
  const m = buildWeaponModel(weaponId, skin);
  m.traverse(o => { if (o.isMesh) o.castShadow = true; });
  const b = new THREE.Box3().setFromObject(m);
  const size = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3());
  const s = 1.35 / Math.max(size.x, size.y, size.z);
  m.scale.setScalar(s); m.position.copy(c).multiplyScalar(-s);
  const wrap = new THREE.Group(); wrap.add(m);
  lobby.weapon = wrap; lobby.weaponHolder.add(wrap);
}

function layoutLobby() {
  const aspect = innerWidth / innerHeight;
  lobby.camera.aspect = aspect; lobby.camera.updateProjectionMatrix();
}

function setLobbyMode(mode) {
  lobby.mode = mode;
  lobby.char.root.visible = mode === 'char';
  lobby.weaponHolder.visible = mode === 'weapon';
}

function renderLobby(dt) {
  lobby.t += dt;
  const aspect = innerWidth / innerHeight;
  if (lobby.mode === 'char') {
    lobby.char.update(dt, lobby.actor);
    const off = aspect > 1.3 ? -0.55 : 0;
    lobby.camera.position.set(0.15 + off + Math.sin(lobby.t * 0.15) * 0.08, 1.35, 4.6);
    lobby.camera.lookAt(off, 1.0, 0);
  } else {
    if (lobby.weapon) { lobby.weapon.rotation.y = Math.sin(lobby.t * 0.45) * 0.7 - Math.PI / 2 + 0.3; lobby.weapon.position.y = Math.sin(lobby.t * 1.2) * 0.02; }
    const off = aspect > 1.3 ? -0.75 : 0;
    lobby.camera.position.set(off, 1.25, 3.3);
    lobby.camera.lookAt(off, 1.05, 0);
  }
  lobby.dust.rotation.y += dt * 0.02;
  renderer.toneMappingExposure = 1.0;
  renderer.clear();
  renderer.render(lobby.scene, lobby.camera);
}

// ---------- Превью карт (рендер настоящей карты) ----------
const mapThumbs = {};
const THUMB_CAM = { oasis: [[-38, 10, 16], [0, 0, -4]], port: [[-30, 13, -35], [2, 0, 4]] };
function renderMapThumb(id) {
  const sc = new THREE.Scene();
  buildMap(sc, id, 'medium');
  const at = setupAtmosphere(renderer, sc, MAPS[id], 'medium');
  const cam = new THREE.PerspectiveCamera(60, canvas.width / canvas.height, 0.1, 1000);
  const [p, t] = THUMB_CAM[id];
  cam.position.set(...p); cam.lookAt(...t);
  at.sky.position.copy(cam.position);
  renderer.toneMappingExposure = at.exposure;
  renderer.clear();
  renderer.render(sc, cam);
  const out = document.createElement('canvas'); out.width = 480; out.height = 240;
  const ctx = out.getContext('2d');
  const sw = canvas.width, sh = canvas.height, ta = 2;
  let cw = sw, ch = sw / ta; if (ch > sh) { ch = sh; cw = sh * ta; }
  ctx.drawImage(canvas, (sw - cw) / 2, (sh - ch) / 2, cw, ch, 0, 0, 480, 240);
  mapThumbs[id] = out.toDataURL('image/jpeg', 0.85);
  sc.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  at.env.dispose();
}

// ---------- Навигация ----------
function goto(name) {
  sound.init(); sound.ui();
  if (name === 'main' && game) { $('menu').classList.add('hidden'); $('pause').classList.remove('hidden'); return; }
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === 'screen-' + name));
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('on', b.dataset.goto === name || (name === 'play' && b.dataset.goto === 'main')));
  setLobbyMode(name === 'arsenal' || name === 'cases' ? 'weapon' : 'char');
  if (name === 'main') { setLobbyCharacter(); renderProfile(); renderSummary(); }
  if (name === 'arsenal') renderArsenal();
  if (name === 'cases') { renderCases(); setShowcase(primaryOf(), equippedSkin(primaryOf())); }
  if (name === 'settings') renderSettings();
  if (name === 'play') renderPlay();
}
document.querySelectorAll('[data-goto]').forEach(b => b.addEventListener('click', () => goto(b.dataset.goto)));
const primaryOf = () => settings.match.primary || 'ar';

const level = () => Math.floor((profile.xp || 0) / 1000) + 1;
function renderProfile() {
  const s = profile.stats;
  const kd = s.deaths ? (s.kills / s.deaths).toFixed(2) : s.kills.toFixed(0);
  const hs = s.kills ? Math.round(s.headshots / s.kills * 100) : 0;
  $('profile-card').innerHTML = `<div>Убийства<b>${s.kills}</b></div><div>K/D<b>${kd}</b></div><div>Хедшоты<b>${hs}%</b></div><div>Победы<b>${s.wins}/${s.matches}</b></div>`;
  $('credits').textContent = profile.credits;
  $('lvl-text').textContent = `Уровень ${level()}`;
  $('xp-fill').style.width = ((profile.xp || 0) % 1000) / 10 + '%';
}
function renderSummary() {
  const m = settings.match, map = MAPS[m.map];
  $('match-summary').innerHTML = `${mapThumbs[m.map] ? `<img src="${mapThumbs[m.map]}">` : ''}
    <div><div class="ms-title">${m.mode === 'ffa' ? 'Каждый сам за себя' : 'Командный бой'}</div>
    <div class="ms-sub">Карта: ${map.name}<br>${m.mode === 'ffa' ? `${m.perTeam * 2} игроков` : `${m.perTeam} на ${m.perTeam}`} · боты «${DIFFICULTY[m.difficulty].name}» · ${WEAPONS[m.primary].short}</div></div>`;
}

// ---------- Настройка матча ----------
const OPTIONS = {
  mode: [['tdm', 'Командный бой'], ['ffa', 'Каждый за себя']],
  perTeam: [[1, '1×1'], [2, '2×2'], [3, '3×3'], [4, '4×4'], [5, '5×5']],
  difficulty: Object.entries(DIFFICULTY).map(([k, v]) => [k, v.name]),
  primary: PRIMARIES.map(id => [id, WEAPONS[id].short]),
  killsToWin: [[10, '10'], [20, '20'], [40, '40'], [60, '60']],
  minutes: [[4, '4 мин'], [8, '8 мин'], [12, '12 мин']],
};
function renderPlay() {
  document.querySelectorAll('#screen-play .seg').forEach(seg => {
    const key = seg.dataset.opt;
    seg.innerHTML = '';
    for (const [val, label] of OPTIONS[key]) {
      const b = document.createElement('button');
      b.innerHTML = key === 'primary' ? `${iconImg(val)}<span>${label}</span>` : label;
      b.classList.toggle('on', settings.match[key] === val);
      b.onclick = () => { settings.match[key] = val; saveSettings(); sound.ui(); renderPlay(); if (key === 'primary') setLobbyCharacter(); };
      seg.appendChild(b);
    }
  });
  $('per-team-label').textContent = settings.match.mode === 'ffa' ? 'Количество игроков (×2)' : 'Игроков в команде';
  const mc = $('map-cards'); mc.innerHTML = '';
  for (const m of Object.values(MAPS)) {
    const b = document.createElement('button');
    b.className = 'map-card' + (settings.match.map === m.id ? ' on' : '');
    b.innerHTML = `${mapThumbs[m.id] ? `<img class="thumb" src="${mapThumbs[m.id]}">` : '<div class="thumb"></div>'}<div class="info"><b>${m.name}</b><small>${m.desc}</small></div>`;
    b.onclick = () => { settings.match.map = m.id; saveSettings(); sound.ui(); renderPlay(); };
    mc.appendChild(b);
  }
}

// ---------- Арсенал ----------
let arsenalWeapon = 'ar';
const WEAPON_TAB = { ar: 'AR-7', smg: 'VX-9', sniper: 'LR-50', shotgun: 'SG-12', pistol: 'P-12', knife: 'Нож' };
function skinInfo(s) {
  const el = $('skin-info');
  if (!s) { el.innerHTML = `<div class="si-rar" style="color:#888">Базовый</div><div class="si-name">${WEAPONS[arsenalWeapon].name}</div>`; return; }
  const r = RARITY[s.rarity];
  el.innerHTML = `<div class="si-rar" style="color:${r.color}">${r.name}</div><div class="si-name">${WEAPON_TAB[s.weapon]} | ${s.name}</div>${profile.owned.includes(s.id) ? '' : '<div class="hint">Можно получить из кейса</div>'}`;
}
function renderArsenal() {
  const tabs = $('arsenal-tabs'); tabs.innerHTML = '';
  for (const w of SKIN_WEAPONS) {
    const b = document.createElement('button'); b.innerHTML = `${iconImg(w)}<span>${WEAPON_TAB[w]}</span>`;
    b.classList.toggle('on', w === arsenalWeapon);
    b.onclick = () => { arsenalWeapon = w; sound.ui(); renderArsenal(); };
    tabs.appendChild(b);
  }
  const grid = $('skin-grid'); grid.innerHTML = '';
  const eq = profile.equipped[arsenalWeapon] || null;
  const order = Object.keys(RARITY);
  const items = [{ id: null, name: 'Стандарт', rarity: null }, ...Object.values(SKINS).filter(s => s.weapon === arsenalWeapon)
    .sort((a, b) => (profile.owned.includes(b.id) - profile.owned.includes(a.id)) || order.indexOf(b.rarity) - order.indexOf(a.rarity))];
  for (const s of items) {
    const owned = s.id === null || profile.owned.includes(s.id);
    const el = document.createElement('button');
    el.className = 'skin' + (eq === s.id ? ' on' : '') + (owned ? '' : ' locked');
    if (s.rarity) el.style.setProperty('--rc', RARITY[s.rarity].color);
    el.innerHTML = `${s.id ? `<img class="sw" src="${skinPreviewURL(s)}">` : '<div class="sw def"></div>'}<div class="nm">${s.name}</div>
      <div class="rr" style="color:${s.rarity ? RARITY[s.rarity].color : '#888'}">${s.rarity ? RARITY[s.rarity].name : 'Базовый'}${owned ? '' : ' · нет'}</div>${eq === s.id ? '<span class="eq">ВЫБРАН</span>' : ''}`;
    el.onmouseenter = () => { setShowcase(arsenalWeapon, s.id ? s : null); skinInfo(s.id ? s : null); };
    el.onclick = () => {
      setShowcase(arsenalWeapon, s.id ? s : null); skinInfo(s.id ? s : null);
      if (!owned) { sound.click(); return; }
      equip(arsenalWeapon, s.id); sound.ui(); renderArsenal();
    };
    grid.appendChild(el);
  }
  const cur = equippedSkin(arsenalWeapon);
  setShowcase(arsenalWeapon, cur); skinInfo(cur);
}

// ---------- Кейсы ----------
function renderCases() {
  renderProfile();
  const list = $('case-list'); list.innerHTML = '';
  for (const c of CASES) {
    const total = Object.values(c.weights).reduce((a, b) => a + b, 0);
    const odds = Object.entries(c.weights).map(([r, w]) => `<span style="color:${RARITY[r].color}">${RARITY[r].name}: ${(w / total * 100).toFixed(1)}%</span>`).join('<br>');
    const el = document.createElement('div');
    el.className = 'case'; el.style.setProperty('--cc', c.color);
    el.innerHTML = `<div class="box"><div class="crate3d"></div></div><h3>${c.name}</h3><div class="odds">${odds}</div>
      <button ${profile.credits < c.price ? 'disabled' : ''}>Открыть · ◆ ${c.price}</button>`;
    el.querySelector('button').onclick = () => startCaseOpen(c);
    list.appendChild(el);
  }
}
function skinCard(s) {
  return `<div class="skin" style="--rc:${RARITY[s.rarity].color}"><img class="sw" src="${skinPreviewURL(s)}"><div class="nm">${s.name}</div><div class="rr" style="color:${RARITY[s.rarity].color}">${WEAPON_TAB[s.weapon]}</div></div>`;
}
function startCaseOpen(c) {
  sound.init();
  const res = openCase(c);
  if (!res) return;
  renderProfile();
  const N = 50, WIN = 42;
  const items = [];
  for (let i = 0; i < N; i++) items.push(i === WIN ? res.skin : randomFiller(c));
  const strip = $('roulette-strip');
  strip.innerHTML = items.map(skinCard).join('');
  strip.style.transition = 'none'; strip.style.transform = 'translateX(0)';
  $('case-open-title').textContent = c.name;
  $('case-result').innerHTML = '';
  $('case-close').classList.add('hidden');
  $('case-open').classList.remove('hidden');
  const cardW = 126, boxW = strip.parentElement.clientWidth;
  const offset = WIN * cardW + 60 - boxW / 2 + (Math.random() - 0.5) * 90;
  let lastIdx = -1;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    strip.style.transition = 'transform 5.2s cubic-bezier(0.1, 0.7, 0.12, 1)';
    strip.style.transform = `translateX(${-offset}px)`;
  }));
  const tick = setInterval(() => {
    const m = new DOMMatrix(getComputedStyle(strip).transform);
    const idx = Math.floor((-m.m41 + boxW / 2) / cardW);
    if (idx !== lastIdx) { lastIdx = idx; sound.click(); }
  }, 30);
  setTimeout(() => {
    clearInterval(tick);
    sound.reward();
    const r = RARITY[res.skin.rarity];
    $('case-result').innerHTML = `<span style="color:${r.color}">${WEAPON_TAB[res.skin.weapon]} | ${res.skin.name}</span>
      <small>${r.name}${res.duplicate ? ` · уже есть, продано за ◆ ${r.sell}` : ' · добавлено в арсенал'}</small>`;
    $('case-close').classList.remove('hidden');
    renderProfile();
    setShowcase(res.skin.weapon, res.skin);
  }, 5400);
}
$('case-close').onclick = () => { $('case-open').classList.add('hidden'); renderCases(); };

// ---------- Настройки ----------
let refreshHz = 60;
const SETTINGS_TABS = {
  'Управление': [
    { key: 'sens', label: 'Чувствительность мыши', type: 'range', min: 0.1, max: 5, step: 0.05 },
    { key: 'touchSens', label: 'Чувствительность сенсора', type: 'range', min: 0.1, max: 5, step: 0.05 },
    { key: 'aimSens', label: 'Множитель в прицеле', type: 'range', min: 0.2, max: 2, step: 0.05 },
    { key: 'invertY', label: 'Инверсия по вертикали', type: 'bool' },
    { key: 'controls', label: 'Тип управления', type: 'select', options: [['auto', 'Авто'], ['touch', 'Сенсор'], ['mouse', 'Мышь']] },
    { key: 'aimToggle', label: 'Прицел нажатием (а не удержанием)', type: 'bool' },
    { type: 'button', label: 'Расстановка кнопок (сенсор)', action: () => openLayoutEditor() },
  ],
  'Графика': [
    { key: 'fpsCap', label: 'Лимит FPS', type: 'select', options: [[30, '30'], [60, '60'], [90, '90'], [120, '120'], [144, '144'], [0, 'Без лимита']],
      note: () => (refreshHz >= 30 ? `Частота вашего экрана: ~${refreshHz} Гц. ` : '') + '120 FPS возможны на экранах 120 Гц и выше (телефоны с 120 Гц, игровые мониторы).' },
    { key: 'quality', label: 'Качество графики', type: 'select', options: [['low', 'Низкое'], ['medium', 'Среднее'], ['high', 'Высокое']],
      note: () => 'Низкое — без теней (макс. FPS на телефонах). Высокое — тени 4K, bloom, сглаживание MSAA.' },
    { key: 'fov', label: 'Поле зрения (FOV)', type: 'range', min: 60, max: 110, step: 1 },
    { key: 'renderScale', label: 'Масштаб рендера', type: 'range', min: 0.5, max: 1.5, step: 0.05 },
    { key: 'showFps', label: 'Показывать FPS', type: 'bool' },
  ],
  'Звук': [
    { key: 'volume', label: 'Громкость', type: 'range', min: 0, max: 1, step: 0.05 },
  ],
  'Прицел': [
    { key: 'crosshair.color', label: 'Цвет', type: 'color' },
    { key: 'crosshair.size', label: 'Длина линий', type: 'range', min: 1, max: 20, step: 1 },
    { key: 'crosshair.gap', label: 'Отступ', type: 'range', min: -2, max: 16, step: 1 },
    { key: 'crosshair.thick', label: 'Толщина', type: 'range', min: 1, max: 6, step: 1 },
    { key: 'crosshair.dot', label: 'Точка в центре', type: 'bool' },
    { key: 'crosshair.outline', label: 'Обводка', type: 'bool' },
    { type: 'preview' },
  ],
};
let settingsTab = 'Управление';
const getK = (k) => k.split('.').reduce((o, p) => o[p], settings);
const setK = (k, v) => { const parts = k.split('.'); const last = parts.pop(); parts.reduce((o, p) => o[p], settings)[last] = v; };

function renderSettings() {
  const tabs = $('settings-tabs'); tabs.innerHTML = '';
  for (const t of Object.keys(SETTINGS_TABS)) {
    const b = document.createElement('button'); b.textContent = t; b.classList.toggle('on', t === settingsTab);
    b.onclick = () => { settingsTab = t; sound.ui(); renderSettings(); };
    tabs.appendChild(b);
  }
  const body = $('settings-body'); body.innerHTML = '';
  for (const item of SETTINGS_TABS[settingsTab]) {
    const row = document.createElement('div'); row.className = 'set-row';
    if (item.type === 'button') {
      const b = document.createElement('button'); b.className = 'act'; b.textContent = item.label; b.onclick = item.action; row.appendChild(b);
    } else if (item.type === 'preview') {
      row.innerHTML = '<label>Предпросмотр</label><div class="ch-preview"><div class="crosshair" id="ch-prev"><i class="t"></i><i class="b"></i><i class="l"></i><i class="r"></i><i class="d"></i></div></div>';
    } else {
      const lab = document.createElement('label'); lab.textContent = item.label; row.appendChild(lab);
      const v = getK(item.key);
      if (item.type === 'range') {
        const inp = document.createElement('input'); Object.assign(inp, { type: 'range', min: item.min, max: item.max, step: item.step, value: v });
        const val = document.createElement('span'); val.className = 'val'; val.textContent = (+v).toFixed(item.step < 1 ? 2 : 0);
        inp.oninput = () => { setK(item.key, +inp.value); val.textContent = (+inp.value).toFixed(item.step < 1 ? 2 : 0); onSettingChanged(item.key); };
        row.append(inp, val);
      } else if (item.type === 'bool') {
        const inp = document.createElement('input'); inp.type = 'checkbox'; inp.checked = !!v;
        inp.onchange = () => { setK(item.key, inp.checked); onSettingChanged(item.key); };
        row.appendChild(inp);
      } else if (item.type === 'color') {
        const inp = document.createElement('input'); inp.type = 'color'; inp.value = v;
        inp.oninput = () => { setK(item.key, inp.value); onSettingChanged(item.key); };
        row.appendChild(inp);
      } else if (item.type === 'select') {
        const seg = document.createElement('div'); seg.className = 'seg';
        for (const [val, label] of item.options) {
          const b = document.createElement('button'); b.textContent = label; b.classList.toggle('on', v === val);
          b.onclick = () => { setK(item.key, val); onSettingChanged(item.key); sound.ui(); renderSettings(); };
          seg.appendChild(b);
        }
        row.appendChild(seg);
      }
      if (item.note) { const n = document.createElement('div'); n.className = 'note'; n.textContent = item.note(); row.appendChild(n); }
    }
    body.appendChild(row);
  }
  if (settingsTab === 'Прицел') updateCrossPreview();
  if (settingsTab === 'Графика' && game) { const h = document.createElement('p'); h.className = 'hint'; h.textContent = 'Тени и пост-обработка применятся со следующего матча.'; body.appendChild(h); }
}
function updateCrossPreview() {
  const el = $('ch-prev'); if (!el) return;
  const c = settings.crosshair;
  el.style.setProperty('--ch-color', c.color); el.style.setProperty('--ch-size', c.size + 'px');
  el.style.setProperty('--ch-thick', c.thick + 'px'); el.style.setProperty('--ch-gap', c.gap + 'px');
  el.style.setProperty('--ch-outline', c.outline ? '0 0 0 1px rgba(0,0,0,.8)' : 'none');
  el.classList.toggle('dot', !!c.dot);
}
let saveTimer = 0;
function onSettingChanged(key) {
  clearTimeout(saveTimer); saveTimer = setTimeout(saveSettings, 200);
  if (key.startsWith('crosshair') || key === 'showFps') { hud.applyCrosshair(); updateCrossPreview(); }
  if (key === 'volume') sound.setVolume(settings.volume);
  if (key === 'renderScale' || key === 'quality') { applyPixelRatio(); renderer.setSize(innerWidth, innerHeight, false); if (game) game.resize(innerWidth, innerHeight); }
  if (key === 'fov' && game) game.curFov = settings.fov;
  if (key === 'controls' && game) { input.touch = isTouchMode(); input.buildTouchUI($('touch-ui')); $('hud').classList.toggle('touch', input.touch); }
}

// ---------- Редактор кнопок ----------
let leLayout = null, leSel = null;
function openLayoutEditor() {
  leLayout = JSON.parse(JSON.stringify(getLayout()));
  leSel = null;
  $('layout-editor').classList.remove('hidden');
  $('le-firel').checked = leLayout.fireL.enabled !== false;
  renderLayoutEditor();
}
function renderLayoutEditor() {
  const area = $('le-area'); area.innerHTML = '';
  for (const [name, l] of Object.entries(leLayout)) {
    if (name === 'fireL' && l.enabled === false) continue;
    const el = document.createElement('div');
    el.className = 'tbtn' + (name === 'joystick' ? ' joy' : '') + (leSel === name ? ' sel' : '');
    el.dataset.btn = name;
    Object.assign(el.style, { left: l.x + '%', top: l.y + '%', width: l.size + 'px', height: l.size + 'px', opacity: Math.max(0.35, l.opacity) });
    el.innerHTML = (name === 'joystick' ? '<div class="knob"></div>' : BTN_ICONS[name]) + `<span class="lbl">${BUTTON_LABELS[name]}</span>`;
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault(); el.setPointerCapture(e.pointerId);
      selectLe(name);
      const move = (ev) => {
        l.x = Math.max(2, Math.min(98, ev.clientX / innerWidth * 100));
        l.y = Math.max(2, Math.min(98, ev.clientY / innerHeight * 100));
        el.style.left = l.x + '%'; el.style.top = l.y + '%';
      };
      const up = () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); };
      el.addEventListener('pointermove', move); el.addEventListener('pointerup', up);
    });
    area.appendChild(el);
  }
}
function selectLe(name) {
  leSel = name;
  document.querySelectorAll('#le-area .tbtn').forEach(e => e.classList.toggle('sel', e.dataset.btn === name));
  $('le-selected').textContent = BUTTON_LABELS[name];
  $('le-size').value = leLayout[name].size;
  $('le-opacity').value = leLayout[name].opacity;
}
$('le-size').oninput = () => { if (!leSel) return; leLayout[leSel].size = +$('le-size').value; const el = document.querySelector(`#le-area [data-btn=${leSel}]`); el.style.width = el.style.height = leLayout[leSel].size + 'px'; };
$('le-opacity').oninput = () => { if (!leSel) return; leLayout[leSel].opacity = +$('le-opacity').value; };
$('le-firel').onchange = () => { leLayout.fireL.enabled = $('le-firel').checked; renderLayoutEditor(); };
$('le-reset').onclick = () => { leLayout = JSON.parse(JSON.stringify(DEFAULT_LAYOUT)); leSel = null; $('le-firel').checked = true; renderLayoutEditor(); };
$('le-cancel').onclick = () => $('layout-editor').classList.add('hidden');
$('le-save').onclick = () => {
  settings.layout = leLayout; saveSettings();
  $('layout-editor').classList.add('hidden');
  if (game) input.buildTouchUI($('touch-ui'));
};

// ---------- Матч ----------
function startMatch() {
  sound.init();
  if (game) { game.dispose(); game = null; }
  $('menu').classList.add('hidden');
  ['pause', 'end'].forEach(id => $(id).classList.add('hidden'));
  $('load-text').textContent = 'Загрузка карты…';
  $('loading').classList.remove('hidden');
  setTimeout(() => {
    applyPixelRatio();
    renderer.setSize(innerWidth, innerHeight, false);
    renderer.shadowMap.enabled = settings.quality !== 'low';
    input.touch = isTouchMode();
    input.reset();
    input.enabled = true;
    $('hud').classList.toggle('touch', input.touch);
    input.buildTouchUI($('touch-ui'));
    hud.applyCrosshair();
    game = new Game(renderer, input, hud, { ...settings.match }, { onEnd: onMatchEnd });
    game.resize(innerWidth, innerHeight);
    game.update(0.001); game.render(); // прогрев шейдеров
    hud.show(true);
    $('loading').classList.add('hidden');
    hud.center(settings.match.mode === 'ffa' ? 'КАЖДЫЙ САМ ЗА СЕБЯ' : `ДО ${settings.match.killsToWin} УБИЙСТВ`, 2.2);
    if (input.touch) { try { document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }).catch(() => {}); } catch (e) { /* ignore */ } }
    else input.requestLock();
  }, 40);
}
$('start-btn').onclick = startMatch;
$('quick-play').onclick = startMatch;

function pauseGame() {
  if (!game || game.over || game.paused) return;
  game.paused = true;
  input.reset();
  $('pause').classList.remove('hidden');
  $('pause-hint').textContent = input.touch ? '' : 'Esc — пауза · Tab — счёт · R — перезарядка · 1/2/3 — оружие · Q — прошлое оружие · Ctrl/C — присесть · Shift — шаг';
}
input.onPause = pauseGame;
function resumeGame() {
  if (!game) return;
  $('pause').classList.add('hidden');
  $('menu').classList.add('hidden');
  game.paused = false;
  input.reset(); input.enabled = true;
  hud.applyCrosshair();
  if (!input.touch) input.requestLock();
}
$('resume-btn').onclick = resumeGame;
$('pause-settings').onclick = () => { $('pause').classList.add('hidden'); $('menu').classList.remove('hidden'); goto('settings'); };
$('quit-btn').onclick = () => quitToMenu();

function quitToMenu() {
  if (game) { game.dispose(); game = null; }
  input.enabled = false; input.reset(); input.exitLock();
  hud.show(false);
  ['pause', 'end'].forEach(id => $(id).classList.add('hidden'));
  $('menu').classList.remove('hidden');
  renderer.shadowMap.enabled = true;
  goto('main');
}

function onMatchEnd({ win, draw, earned, player, game: g }) {
  input.enabled = false; input.exitLock();
  profile.credits += earned;
  profile.xp = (profile.xp || 0) + earned * 5 + player.kills * 20;
  const st = profile.stats;
  st.kills += player.kills; st.deaths += player.deaths; st.headshots += player.headshots; st.matches++; if (win) st.wins++;
  saveProfile();
  $('end-title').textContent = draw ? 'Ничья' : win ? 'Победа' : 'Поражение';
  $('end-title').style.color = draw ? '#ddd' : win ? 'var(--ok)' : 'var(--danger)';
  $('end-score').innerHTML = g.cfg.mode === 'ffa' ? `Место: ${[...g.actors].sort((a, b) => b.kills - a.kills).indexOf(player) + 1} из ${g.actors.length}`
    : `<span style="color:var(--a)">${g.score.A}</span> : <span style="color:var(--b)">${g.score.B}</span>`;
  const kd = (player.kills / Math.max(1, player.deaths)).toFixed(2);
  $('end-stats').innerHTML = `<div class="end-stats"><div>Убийства<b>${player.kills}</b></div><div>Смерти<b>${player.deaths}</b></div><div>K/D<b>${kd}</b></div><div>Хедшоты<b>${player.headshots}</b></div></div>
    <div class="reward">Награда: <span style="color:var(--accent2)">◆ ${earned}</span> · <span style="color:var(--muted)">+${earned * 5 + player.kills * 20} опыта</span></div>`;
  $('end').classList.remove('hidden');
}
$('end-again').onclick = startMatch;
$('end-menu').onclick = quitToMenu;

// ---------- Цикл с лимитом FPS ----------
let last = performance.now(), lastFrame = 0, fpsAcc = 0, fpsN = 0, fps = 0;
const hzSamples = [];
function frame(now) {
  requestAnimationFrame(frame);
  if (hzSamples.length < 90) { hzSamples.push(now); if (hzSamples.length === 90) { const d = (hzSamples[89] - hzSamples[10]) / 79; refreshHz = Math.round(1000 / d / 5) * 5 || 60; } }
  const cap = settings.fpsCap | 0;
  if (cap > 0) {
    const min = 1000 / cap;
    if (now - lastFrame < min - 1.5) return;
    lastFrame = Math.max(lastFrame + min, now - min);
  }
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  fpsAcc += dt; fpsN++;
  if (fpsAcc >= 0.5) { fps = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0; }
  if (game) {
    game.update(dt);
    game.render();
    hud.update(dt, fps);
  } else renderLobby(dt);
}

function onResize() {
  renderer.setSize(innerWidth, innerHeight, false);
  layoutLobby();
  if (game) game.resize(innerWidth, innerHeight);
}
window.addEventListener('resize', onResize);

// ---------- Старт ----------
async function boot() {
  const lt = $('load-text');
  lt.textContent = 'Генерация текстур…'; await nextFrame();
  buildWeaponIcons(renderer);
  buildLobby();
  layoutLobby();
  for (const id of Object.keys(MAPS)) {
    lt.textContent = `Подготовка карты «${MAPS[id].name}»…`; await nextFrame();
    try { renderMapThumb(id); } catch (e) { console.error(e); }
  }
  setLobbyCharacter();
  setLobbyMode('char');
  renderProfile(); renderSummary();
  $('loading').classList.add('hidden');
  requestAnimationFrame(frame);
}
boot();

window.__maxi = { get game() { return game; }, settings, profile };
