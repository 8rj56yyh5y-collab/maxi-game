// Точка входа: меню, арсенал, кейсы, настройки, запуск матча.
import * as THREE from 'three';
import { settings, saveSettings, getLayout, DEFAULT_LAYOUT, BUTTON_LABELS, isTouchMode } from './settings.js';
import { Input, BTN_ICONS } from './input.js';
import { HUD } from './hud.js';
import { Game } from './game.js';
import { MAPS } from './maps.js';
import { WEAPONS, PRIMARIES, buildWeaponModel } from './weapons.js';
import { DIFFICULTY } from './bots.js';
import { profile, saveProfile, SKINS, SKIN_WEAPONS, RARITY, CASES, equip, equippedSkin, openCase, randomFiller } from './skins.js';
import { skinPreviewURL } from './textures.js';
import { sound } from './audio.js';

const $ = (id) => document.getElementById(id);
const canvas = $('game');

// ---------- Рендер ----------
const renderer = new THREE.WebGLRenderer({ canvas, antialias: settings.quality !== 'low', powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.autoClear = false;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
function applyPixelRatio() {
  const q = settings.quality === 'low' ? 0.7 : settings.quality === 'medium' ? 1 : 1.25;
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1) * settings.renderScale * q * (isTouchMode() ? 0.8 : 1));
}
applyPixelRatio();
renderer.setSize(innerWidth, innerHeight, false);

const input = new Input(canvas);
const hud = new HUD();
let game = null;

// ---------- Витрина оружия в меню ----------
const showcase = {
  scene: new THREE.Scene(),
  camera: new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 0.05, 50),
  holder: new THREE.Group(),
  weapon: 'ar', skin: null, t: 0,
};
showcase.scene.background = new THREE.Color(0x10151c);
showcase.scene.add(new THREE.HemisphereLight(0xcfe3ff, 0x30261a, 1.5));
const sl = new THREE.DirectionalLight(0xffffff, 2.2); sl.position.set(2, 3, 2); showcase.scene.add(sl);
const rim = new THREE.DirectionalLight(0xff8a1f, 1.6); rim.position.set(-3, 1, -2); showcase.scene.add(rim);
showcase.scene.add(showcase.holder);
// «пол» с подсветкой
const glow = new THREE.Mesh(new THREE.CircleGeometry(0.9, 48), new THREE.MeshBasicMaterial({ color: 0xff8a1f, transparent: true, opacity: 0.12 }));
glow.rotation.x = -Math.PI / 2; glow.position.y = -0.32; showcase.holder.add(glow);
showcase.camera.position.set(0, 0.12, 1.9);

function setShowcase(weaponId, skin) {
  showcase.weapon = weaponId; showcase.skin = skin;
  if (showcase.model) showcase.holder.remove(showcase.model);
  const m = buildWeaponModel(weaponId, skin);
  const box = new THREE.Box3().setFromObject(m);
  const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
  const s = 1.05 / Math.max(size.x, size.y, size.z);
  m.scale.setScalar(s);
  m.position.copy(center).multiplyScalar(-s);
  const wrap = new THREE.Group(); wrap.add(m);
  showcase.model = wrap;
  showcase.holder.add(wrap);
}

function layoutShowcase() {
  const aspect = innerWidth / innerHeight;
  showcase.camera.aspect = aspect; showcase.camera.updateProjectionMatrix();
  const halfW = Math.tan(THREE.MathUtils.degToRad(showcase.camera.fov / 2)) * 1.9 * aspect;
  showcase.holder.position.x = halfW * (aspect > 1.2 ? 0.42 : 0.1);
}

// ---------- Навигация по меню ----------
let currentScreen = 'main';
function goto(name) {
  sound.init(); sound.ui();
  if (name === 'main' && game) { $('menu').classList.add('hidden'); $('pause').classList.remove('hidden'); return; }
  currentScreen = name;
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === 'screen-' + name));
  if (name === 'main') { setShowcase(primaryOf(), equippedSkin(primaryOf())); renderProfile(); }
  if (name === 'arsenal') renderArsenal();
  if (name === 'cases') renderCases();
  if (name === 'settings') renderSettings();
  if (name === 'play') renderPlay();
}
document.querySelectorAll('[data-goto]').forEach(b => b.addEventListener('click', () => goto(b.dataset.goto)));
const primaryOf = () => settings.match.primary || 'ar';

function updateCredits() { $('credits').textContent = profile.credits; }
function renderProfile() {
  const s = profile.stats;
  const kd = s.deaths ? (s.kills / s.deaths).toFixed(2) : s.kills;
  $('profile-card').innerHTML = `<div>Убийства<b>${s.kills}</b></div><div>K/D<b>${kd}</b></div><div>Победы<b>${s.wins}/${s.matches}</b></div>`;
  updateCredits();
}

// ---------- Настройка матча ----------
const OPTIONS = {
  mode: [['tdm', 'Командный бой'], ['ffa', 'Каждый за себя']],
  perTeam: [[1, '1'], [2, '2'], [3, '3'], [4, '4'], [5, '5']],
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
      b.textContent = label;
      b.classList.toggle('on', settings.match[key] === val);
      b.onclick = () => { settings.match[key] = val; saveSettings(); sound.ui(); renderPlay(); if (key === 'primary') setShowcase(val, equippedSkin(val)); };
      seg.appendChild(b);
    }
  });
  $('per-team-label').textContent = settings.match.mode === 'ffa' ? 'Игроков (×2)' : 'Игроков в команде';
  const mc = $('map-cards'); mc.innerHTML = '';
  for (const m of Object.values(MAPS)) {
    const b = document.createElement('button');
    b.className = 'map-card' + (settings.match.map === m.id ? ' on' : '');
    const cv = document.createElement('canvas'); cv.width = 150; cv.height = 80;
    drawMapPreview(cv, m);
    b.appendChild(cv);
    const d = document.createElement('div'); d.innerHTML = `<b>${m.name}</b>${m.desc}`; b.appendChild(d);
    b.onclick = () => { settings.match.map = m.id; saveSettings(); sound.ui(); renderPlay(); };
    mc.appendChild(b);
  }
}
function drawMapPreview(cv, m) {
  const ctx = cv.getContext('2d');
  const [x1, z1, x2, z2] = m.bounds;
  const s = Math.min(cv.width / (x2 - x1), cv.height / (z2 - z1));
  const ox = (cv.width - (x2 - x1) * s) / 2, oz = (cv.height - (z2 - z1) * s) / 2;
  ctx.fillStyle = '#' + new THREE.Color(m.fog).getHexString(); ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.globalAlpha = 0.85;
  for (const b of m.boxes) {
    ctx.fillStyle = b[4] > 2 ? '#3a3f47' : '#6c7178';
    ctx.fillRect(ox + (b[0] - x1) * s, oz + (b[1] - z1) * s, (b[2] - b[0]) * s, (b[3] - b[1]) * s);
  }
  ctx.globalAlpha = 1;
  for (const [team, col] of [['A', '#4da3ff'], ['B', '#ff5a3c']]) {
    ctx.fillStyle = col;
    for (const p of m.spawns[team]) ctx.fillRect(ox + (p[0] - x1) * s - 1.5, oz + (p[1] - z1) * s - 1.5, 3, 3);
  }
}

// ---------- Арсенал ----------
let arsenalWeapon = 'ar';
const WEAPON_TAB = { ar: 'AR-7', smg: 'VX-9', sniper: 'LR-50', shotgun: 'SG-12', pistol: 'P-12', knife: 'Нож' };
function renderArsenal() {
  const tabs = $('arsenal-tabs'); tabs.innerHTML = '';
  for (const w of SKIN_WEAPONS) {
    const b = document.createElement('button'); b.textContent = WEAPON_TAB[w];
    b.classList.toggle('on', w === arsenalWeapon);
    b.onclick = () => { arsenalWeapon = w; sound.ui(); renderArsenal(); };
    tabs.appendChild(b);
  }
  const grid = $('skin-grid'); grid.innerHTML = '';
  const eq = profile.equipped[arsenalWeapon] || null;
  const items = [{ id: null, name: 'Стандарт', rarity: null }, ...Object.values(SKINS).filter(s => s.weapon === arsenalWeapon)];
  const order = Object.keys(RARITY);
  items.sort((a, b) => (a.id === null ? -1 : b.id === null ? 1 : order.indexOf(b.rarity) - order.indexOf(a.rarity)));
  for (const s of items) {
    const owned = s.id === null || profile.owned.includes(s.id);
    const el = document.createElement('button');
    el.className = 'skin' + (eq === s.id ? ' on' : '') + (owned ? '' : ' locked');
    if (s.rarity) el.style.setProperty('--rc', RARITY[s.rarity].color);
    el.innerHTML = `${s.id ? `<img src="${skinPreviewURL(s)}">` : '<div class="sw"></div>'}<div class="nm">${s.name}</div>
      <div class="rr" style="color:${s.rarity ? RARITY[s.rarity].color : '#888'}">${s.rarity ? RARITY[s.rarity].name : 'Базовый'}${owned ? '' : ' · нет'}</div>${eq === s.id ? '<span class="eq">ВЫБРАН</span>' : ''}`;
    el.onmouseenter = () => setShowcase(arsenalWeapon, s.id ? s : null);
    el.onclick = () => {
      setShowcase(arsenalWeapon, s.id ? s : null);
      if (!owned) { sound.click(); return; }
      equip(arsenalWeapon, s.id); sound.ui(); renderArsenal();
    };
    grid.appendChild(el);
  }
  setShowcase(arsenalWeapon, equippedSkin(arsenalWeapon));
}

// ---------- Кейсы ----------
function renderCases() {
  updateCredits();
  const list = $('case-list'); list.innerHTML = '';
  for (const c of CASES) {
    const total = Object.values(c.weights).reduce((a, b) => a + b, 0);
    const odds = Object.entries(c.weights).map(([r, w]) => `<span style="color:${RARITY[r].color}">${RARITY[r].name}: ${(w / total * 100).toFixed(1)}%</span>`).join('<br>');
    const el = document.createElement('div');
    el.className = 'case';
    el.style.setProperty('--cc', c.color);
    el.innerHTML = `<div class="box">${c.weapon === 'knife' ? '🗡' : '▣'}</div><h3>${c.name}</h3><div class="odds">${odds}</div>
      <button ${profile.credits < c.price ? 'disabled' : ''}>Открыть · ◆ ${c.price}</button>`;
    el.querySelector('button').onclick = () => startCaseOpen(c);
    list.appendChild(el);
  }
}

function skinCard(s) {
  return `<div class="skin" style="--rc:${RARITY[s.rarity].color}"><img src="${skinPreviewURL(s)}"><div class="nm">${s.name}</div><div class="rr" style="color:${RARITY[s.rarity].color}">${WEAPON_TAB[s.weapon]}</div></div>`;
}

function startCaseOpen(c) {
  sound.init();
  const res = openCase(c);
  if (!res) return;
  updateCredits();
  const N = 50, WIN = 42;
  const items = [];
  for (let i = 0; i < N; i++) items.push(i === WIN ? res.skin : randomFiller(c));
  const strip = $('roulette-strip');
  strip.innerHTML = items.map(skinCard).join('');
  strip.style.transition = 'none';
  strip.style.transform = 'translateX(0)';
  $('case-result').innerHTML = '';
  $('case-close').classList.add('hidden');
  $('case-open').classList.remove('hidden');
  const cardW = 126; // 120 + gap 6
  const boxW = strip.parentElement.clientWidth;
  const offset = WIN * cardW + 60 - boxW / 2 + (Math.random() - 0.5) * 90;
  let lastIdx = -1;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    strip.style.transition = 'transform 5.2s cubic-bezier(0.1, 0.7, 0.12, 1)';
    strip.style.transform = `translateX(${-offset}px)`;
  }));
  // щелчки при прокрутке
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
    updateCredits();
    setShowcase(res.skin.weapon, res.skin);
  }, 5400);
}
$('case-close').onclick = () => { $('case-open').classList.add('hidden'); renderCases(); };

// ---------- Настройки ----------
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
    { key: 'quality', label: 'Качество', type: 'select', options: [['low', 'Низкое'], ['medium', 'Среднее'], ['high', 'Высокое']] },
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
      row.innerHTML = '<label>Предпросмотр</label><div class="ch-preview"><div class="crosshair" id="ch-prev" style="left:50%;top:50%"><i class="t"></i><i class="b"></i><i class="l"></i><i class="r"></i><i class="d"></i></div></div>';
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
    }
    body.appendChild(row);
  }
  if (settingsTab === 'Прицел') updateCrossPreview();
  if (settingsTab === 'Графика') { const h = document.createElement('p'); h.className = 'hint'; h.textContent = 'Качество теней применяется со следующего матча.'; body.appendChild(h); }
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
  if (key === 'renderScale' || key === 'quality') { applyPixelRatio(); renderer.setSize(innerWidth, innerHeight, false); }
  if (key === 'fov' && game) game.curFov = settings.fov;
  if (key === 'controls' && game) { input.touch = isTouchMode(); input.buildTouchUI($('touch-ui')); $('hud').classList.toggle('touch', input.touch); }
}

// ---------- Редактор расположения кнопок ----------
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
    hud.show(true);
    $('loading').classList.add('hidden');
    hud.center(settings.match.mode === 'ffa' ? 'КАЖДЫЙ САМ ЗА СЕБЯ' : `ДО ${settings.match.killsToWin} УБИЙСТВ`, 2.2);
    if (input.touch) { try { document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }).catch(() => {}); } catch (e) { /* ignore */ } }
    else input.requestLock();
  }, 30);
}
$('start-btn').onclick = startMatch;

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
  input.reset();
  input.enabled = true;
  hud.applyCrosshair();
  if (!input.touch) input.requestLock();
}
$('resume-btn').onclick = resumeGame;
$('pause-settings').onclick = () => {
  $('pause').classList.add('hidden');
  $('menu').classList.remove('hidden');
  goto('settings');
};
$('quit-btn').onclick = () => quitToMenu();

function quitToMenu() {
  if (game) { game.dispose(); game = null; }
  input.enabled = false; input.reset(); input.exitLock();
  hud.show(false);
  ['pause', 'end'].forEach(id => $(id).classList.add('hidden'));
  $('menu').classList.remove('hidden');
  goto('main');
}

function onMatchEnd({ win, draw, earned, player }) {
  input.enabled = false; input.exitLock();
  profile.credits += earned;
  const st = profile.stats;
  st.kills += player.kills; st.deaths += player.deaths; st.headshots += player.headshots; st.matches++; if (win) st.wins++;
  saveProfile();
  $('end-title').textContent = draw ? 'Ничья' : win ? 'Победа!' : 'Поражение';
  $('end-title').style.color = draw ? '#ddd' : win ? '#5be37d' : '#ff4d4d';
  const acc = player.kills + player.deaths ? (player.kills / Math.max(1, player.deaths)).toFixed(2) : '0';
  $('end-stats').innerHTML = `<div class="profile-card" style="width:100%;display:grid;grid-template-columns:repeat(4,1fr)">
    <div>Убийства<b>${player.kills}</b></div><div>Смерти<b>${player.deaths}</b></div><div>K/D<b>${acc}</b></div><div>Хедшоты<b>${player.headshots}</b></div></div>
    <p style="font-size:20px;font-weight:800">Награда: <span style="color:var(--accent2)">◆ ${earned}</span></p>`;
  $('end').classList.remove('hidden');
}
$('end-again').onclick = startMatch;
$('end-menu').onclick = quitToMenu;

// ---------- Цикл ----------
let last = performance.now(), fpsAcc = 0, fpsN = 0, fps = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  fpsAcc += dt; fpsN++;
  if (fpsAcc >= 0.5) { fps = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0; }
  if (game) {
    game.update(dt);
    game.render();
    hud.update(dt, fps);
  } else {
    showcase.t += dt;
    if (showcase.model) { showcase.model.rotation.y = Math.sin(showcase.t * 0.5) * 0.9 - 1.2; showcase.model.position.y = Math.sin(showcase.t * 1.3) * 0.02; }
    renderer.clear();
    renderer.render(showcase.scene, showcase.camera);
  }
}

function onResize() {
  renderer.setSize(innerWidth, innerHeight, false);
  layoutShowcase();
  if (game) game.resize(innerWidth, innerHeight);
}
window.addEventListener('resize', onResize);

// ---------- Старт ----------
layoutShowcase();
setShowcase(primaryOf(), equippedSkin(primaryOf()));
renderProfile();
$('loading').classList.add('hidden');
requestAnimationFrame(frame);

// для отладки из консоли
window.__maxi = { get game() { return game; }, settings, profile };
