// Точка входа: загрузка, лобби, экраны меню, закупка, настройки, матч, игровой цикл.
import * as THREE from 'three';
import { settings, saveSettings, getLayout, DEFAULT_LAYOUT, LAYOUT_PRESETS, BUTTON_LABELS, isTouchMode, hadSavedSettings, applyPreset, resetSettings } from './settings.js';
import { Input, BTN_ICONS } from './input.js';
import { HUD } from './hud.js';
import { Game } from './game.js';
import { MAPS, buildMap, prepareMap } from './maps.js';
import { WEAPONS, KNIVES, GRENADES, CATS, CAT_ORDER, MODES, MAP_INFO, RARITY, RARITY_ORDER, CASES, STORE, levelInfo, itemName, rankOf, rankBadge, SEASON, PASS, PASS_XP, SKINS as ALL_SKINS, COLLECTIONS } from './data.js';
import { DIFFICULTY } from './bots.js';
import { profile, saveProfile, SKINS, equip, equippedSkin, openCase, buyCase, casePrice, caseContents, sellSkin, ownedKnives, buyStoreItem, dailyAvailable, claimDaily, weaponAvailableFor, passLevel, claimPass } from './skins.js';
import { skinPreviewURL, setInstanceResolver } from './textures.js';
import { instanceOf, specialPattern, skinValue, instanceHTML, finishClass, wearGrade } from './skinvalue.js';
import { fxTime } from './skinart.js';
import { claimName, releaseName, publishClan, initRegistry, playerClans } from './registry.js';
import { avatarHTML, setAvatarFromFile, setAvatarEmblem, emblemSVG, EMBLEM_ICONS, EMBLEM_COLORS, CLAN_LIST, CLAN_ROLES, createClan, joinClan, leaveClan, clanXpNeed, clanMatchXp, clanTag, cwState, cwOpponents, cwDifficulty, cwApply, cwLeague } from './social.js';
import { CharacterModel } from './character.js';
import { buildWeaponModel } from './weapons.js';
import { setupAtmosphere, followShadow, Pipeline } from './render.js';
import { buildWeaponIcons, iconImg, initItemRenderer, itemImage, pumpItemImages } from './icons.js';
import { loadCore, loadHDRI, texSet, texturesReady, A } from './assets.js';
import { sound } from './audio.js';

const $ = (id) => document.getElementById(id);
const canvas = $('game');
const nextFrame = () => new Promise(r => requestAnimationFrame(() => r()));
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

if (!hadSavedSettings && isTouchMode()) applyPreset('low');

// ---------- Рендер ----------
const renderer = new THREE.WebGLRenderer({ canvas, antialias: settings.antialias !== false, powerPreference: 'high-performance', stencil: false });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.autoClear = false;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
function applyPixelRatio() {
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1) * settings.renderScale * (isTouchMode() ? 0.85 : 1));
}
applyPixelRatio();
renderer.setSize(innerWidth, innerHeight, false);

const input = new Input(canvas);
const hud = new HUD();
let game = null;

function toast(text) {
  const t = $('toast'); t.textContent = text; t.className = 'show';
  clearTimeout(toast._t); toast._t = setTimeout(() => t.className = '', 2200);
}

// ---------- Лобби ----------
const lobby = { scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.05, 100), t: 0, mode: 'char' };
async function buildLobby() {
  const sc = lobby.scene;
  sc.background = new THREE.Color(0x0a1119);
  sc.fog = new THREE.Fog(0x0a1119, 7, 18);
  const pmrem = new THREE.PMREMGenerator(renderer);
  sc.environment = pmrem.fromEquirectangular(await loadHDRI('quarry_01_1k')).texture;
  sc.environmentIntensity = 0.35;
  pmrem.dispose();
  sc.add(new THREE.HemisphereLight(0x7f9bc4, 0x20160e, 0.4));
  const key = new THREE.SpotLight(0xffe7cc, 70, 16, 0.5, 0.6, 1.5);
  key.position.set(2.2, 4.4, 3.4); key.target.position.set(0, 1, 0);
  key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -0.0005;
  sc.add(key, key.target);
  const rim = new THREE.DirectionalLight(0x29b6f6, 3.5); rim.position.set(-3, 2.5, -3); sc.add(rim);
  const rim2 = new THREE.DirectionalLight(0xffa860, 1.6); rim2.position.set(3, 1.5, -2.5); sc.add(rim2);
  const fl = texSet('concrete');
  const floorGeo = new THREE.CircleGeometry(10, 64);
  const uv = floorGeo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 6, uv.getY(i) * 6);
  const floor = new THREE.Mesh(floorGeo, new THREE.MeshStandardMaterial({ map: fl.map, normalMap: fl.normalMap, roughnessMap: fl.roughnessMap, color: 0x6a7480, metalness: 0.1 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; sc.add(floor);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 0.89, 64), new THREE.MeshBasicMaterial({ color: 0x29b6f6 }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.004; sc.add(ring);
  const box = (w, h, d, x, y, z, set, ry = 0, color = 0xffffff) => {
    const s = texSet(set);
    const g = new THREE.BoxGeometry(w, h, d);
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: s.map, normalMap: s.normalMap, roughnessMap: s.roughnessMap, color }));
    m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = m.receiveShadow = true; sc.add(m);
  };
  void box;
  // студийный фон: вертикальный градиент с тёплым пятном
  { const c = document.createElement('canvas'); c.width = 16; c.height = 512; const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 512); g.addColorStop(0, '#05070a'); g.addColorStop(0.55, '#141820'); g.addColorStop(0.75, '#1c1610'); g.addColorStop(1, '#05070a');
    x.fillStyle = g; x.fillRect(0, 0, 16, 512); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; sc.background = t; }
  sc.fog = new THREE.Fog(0x0a0c10, 6, 14);
  lobby.weaponHolder = new THREE.Group(); lobby.weaponHolder.position.set(0, 1.15, 0); sc.add(lobby.weaponHolder);
  const pg = new THREE.BufferGeometry(); const pts = new Float32Array(300 * 3);
  for (let i = 0; i < 300; i++) { pts[i * 3] = (Math.random() - 0.5) * 6; pts[i * 3 + 1] = Math.random() * 3.5; pts[i * 3 + 2] = (Math.random() - 0.5) * 5; }
  pg.setAttribute('position', new THREE.BufferAttribute(pts, 3));
  lobby.dust = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0xbfe6ff, size: 0.012, transparent: true, opacity: 0.45 }));
  sc.add(lobby.dust);
  setLobbyTeam('A');
}

function setLobbyTeam(team) {
  if (lobby.team === team && lobby.char) return;
  lobby.team = team;
  if (lobby.char) lobby.scene.remove(lobby.char.root);
  lobby.char = new CharacterModel(team, -1, equippedSkin('agent' + team));
  lobby.scene.add(lobby.char.root);
  lobby.actor = { pos: new THREE.Vector3(0, 0, 0), vel: new THREE.Vector3(), yaw: Math.PI - 0.5, pitch: -0.08, alive: true, crouchT: 0 };
  lobby.charWeapon = null;
  setLobbyCharacter();
}

function setLobbyCharacter() {
  const lo = profile.loadout[lobby.team] || profile.loadout.A;
  const w = lo.primary;
  lobby.char.setWeapon(w, equippedSkin(w));
}

function setShowcase(id, skin) {
  if (lobby.weapon) lobby.weaponHolder.remove(lobby.weapon);
  const m = buildWeaponModel(id, skin);
  const b = new THREE.Box3().setFromObject(m);
  const size = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3());
  const s = (KNIVES[id] ? 0.9 : 1.35) / Math.max(size.x, size.y, size.z);
  m.scale.setScalar(s); m.position.copy(c).multiplyScalar(-s);
  const wrap = new THREE.Group(); wrap.add(m);
  lobby.weapon = wrap; lobby.weaponHolder.add(wrap);
}

function setLobbyMode(mode) {
  lobby.mode = mode;
  if (lobby.char) lobby.char.root.visible = mode === 'char';
  if (lobby.weaponHolder) lobby.weaponHolder.visible = mode === 'weapon';
}

// ---------- Живой фон: выбранная карта ----------
const lobbyMap = { scene: null, id: null, cam: new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.05, 1000), building: null };
const LOBBY_SPOT = { factory: [-38, 1.5], quarter: [-31, 1.5], oasis: [-24, -1], port: [0, -28], tokyo: [-24, 0.5], oldtown: [-22, 0], brooklyn: [-24, 5.4], santorini: [-24, 0], paris: [-24, 0], kyoto: [-24, 0], miami: [-24, 0], amsterdam: [-24, 0], hongkong: [-24, 0.5] };
async function setLobbyMap(id) {
  if (lobbyMap.id === id) return;
  if (lobbyMap.building) { lobbyMap.pending = id; return; }
  lobbyMap.building = id;
  try {
    await prepareMap(id);
    const sc = new THREE.Scene();
    const m = buildMap(sc, id, settings.quality);
    const at = setupAtmosphere(renderer, sc, MAPS[id], settings.quality, await loadHDRI(MAPS[id].hdri));
    disposeLobbyMap();
    const pipe = new Pipeline(renderer);
    pipe.setup(sc, lobbyMap.cam, null, null, at.exposure);
    const key = new THREE.SpotLight(0xfff1e0, MAPS[id].night ? 40 : 22, 12, 0.5, 0.6, 1.6);
    const rim = new THREE.PointLight(MAPS[id].night ? 0x6ad0ff : 0xffd6a0, MAPS[id].night ? 14 : 8, 6, 1.6);
    sc.add(key, key.target, rim);
    Object.assign(lobbyMap, { scene: sc, map: m, atmo: at, pipe, id, key, rim });
    if (lobby.char && lobby.mode === 'char') sc.add(lobby.char.root);
  } catch (e) { console.error(e); }
  lobbyMap.building = null;
  if (lobbyMap.pending && lobbyMap.pending !== id) { const n = lobbyMap.pending; lobbyMap.pending = null; setLobbyMap(n); }
}
function disposeLobbyMap() {
  if (!lobbyMap.scene) return;
  if (lobby.char && lobby.char.root.parent === lobbyMap.scene) lobby.scene.add(lobby.char.root);
  if (lobby.squad) for (const m of lobby.squad) if (m.ch.root.parent) m.ch.root.parent.remove(m.ch.root);
  lobbyMap.pipe.dispose();
  lobbyMap.scene.traverse(o => { if (o.geometry && !o.isSkinnedMesh) o.geometry.dispose(); });
  lobbyMap.atmo.env.dispose();
  lobbyMap.scene = null; lobbyMap.id = null;
}

// Отряд за спиной игрока в лобби
const SQUAD_GUNS = { A: ['ar4', 'awr', 'mp7', 'br17'], B: ['ak', 'sv98', 'pp19', 'uz9'] };
const SQUAD_POS = [[1.5, 1.2, 0.35], [1.6, -1.25, 0.6], [2.9, 0.4, 0.2], [3.0, -0.75, 0.75]];
function updateSquad(dt, cx, cz) {
  if (!lobbyMap.scene) return;
  if (!lobby.squad || lobby.squadTeam !== lobby.team) {
    if (lobby.squad) for (const m of lobby.squad) m.ch.root.parent && m.ch.root.parent.remove(m.ch.root);
    lobby.squadTeam = lobby.team;
    lobby.squad = SQUAD_POS.map((p, i) => {
      const agents = Object.values(ALL_SKINS).filter(x => x.weapon === 'agent' + lobby.team);
      const ch = new CharacterModel(lobby.team, -1, Math.random() < 0.75 && agents.length ? agents[(i * 3 + 1) % agents.length] : null);
      const gun = SQUAD_GUNS[lobby.team][i];
      try { ch.setWeapon(WEAPONS[gun] ? gun : (lobby.team === 'A' ? 'ar4' : 'ak'), null); } catch (e) { /* ignore */ }
      ch.mixer.update(i * 1.7);
      return { ch, p, actor: { pos: new THREE.Vector3(), vel: new THREE.Vector3(), yaw: 0, pitch: -0.12 - i * 0.03, alive: true, crouchT: i === 2 ? 0.55 : 0 } };
    });
  }
  const cam = lobbyMap.cam;
  for (const m of lobby.squad) {
    if (m.ch.root.parent !== lobbyMap.scene) lobbyMap.scene.add(m.ch.root);
    m.actor.pos.set(cx + m.p[0], 0, cz + m.p[1]);
    m.actor.yaw = Math.atan2(-(cam.position.x - m.actor.pos.x), -(cam.position.z - m.actor.pos.z)) + m.p[2];
    m.ch.update(dt, m.actor);
  }
}

// Вращение предмета в витрине (осмотр)
{
  let drag = null, pinch = 0;
  const bgTarget = (t) => t === canvas || t.id === 'menu' || (t.classList && (t.classList.contains('screen') || t.classList.contains('lo-info')));
  document.addEventListener('pointerdown', (e) => { if (game || lobby.mode !== 'weapon' || !bgTarget(e.target)) return; drag = { x: e.clientX, y: e.clientY }; });
  window.addEventListener('pointermove', (e) => { if (!drag) return; lobby.rotY = (lobby.rotY || 0) + (e.clientX - drag.x) * 0.012; lobby.rotX = Math.max(-1.2, Math.min(1.2, (lobby.rotX || 0) + (e.clientY - drag.y) * 0.008)); drag = { x: e.clientX, y: e.clientY }; lobby.dragAt = performance.now(); });
  window.addEventListener('pointerup', () => { drag = null; });
  document.addEventListener('wheel', (e) => { if (game || lobby.mode !== 'weapon' || !bgTarget(e.target)) return; lobby.zoom = Math.max(0.45, Math.min(1.3, (lobby.zoom || 1) * (e.deltaY > 0 ? 1.08 : 0.92))); lobby.dragAt = performance.now(); }, { passive: true });
  document.addEventListener('touchmove', (e) => { if (game || lobby.mode !== 'weapon' || e.touches.length !== 2 || !bgTarget(e.target)) return; const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); if (pinch) lobby.zoom = Math.max(0.45, Math.min(1.3, (lobby.zoom || 1) * pinch / d)); pinch = d; }, { passive: true });
  document.addEventListener('touchend', () => { pinch = 0; });
}

function renderLobby(dt) {
  lobby.t += dt;
  const aspect = innerWidth / innerHeight;
  lobby.camera.aspect = aspect; lobby.camera.updateProjectionMatrix();
  if (lobby.mode === 'char' && lobby.char && lobbyMap.scene) {
    const [cx, cz] = LOBBY_SPOT[lobbyMap.id] || [-24, 0];
    if (lobby.char.root.parent !== lobbyMap.scene) lobbyMap.scene.add(lobby.char.root);
    const o = Math.sin(lobby.t * 0.08) * 0.35;
    const cam = lobbyMap.cam;
    cam.aspect = aspect; cam.updateProjectionMatrix();
    cam.position.set(cx - 5.6 * Math.cos(o), 1.55 + Math.sin(lobby.t * 0.11) * 0.08, cz + 5.6 * Math.sin(o));
    cam.lookAt(cx + 0.6, 1.25, cz);
    lobby.actor.pos.set(cx, 0, cz);
    if (lobbyMap.key) { lobbyMap.key.position.set(cam.position.x + 0.6, 3.2, cam.position.z + 1.5); lobbyMap.key.target.position.set(cx, 1.1, cz); lobbyMap.rim.position.set(cx + 1.6, 2.2, cz - 1.2); }
    lobby.actor.yaw = Math.atan2(-(cam.position.x - cx), -(cam.position.z - cz)) + 0.45;
    lobby.char.update(dt, lobby.actor);
    updateSquad(dt, cx, cz);
    if (lobbyMap.map.updateLights) lobbyMap.map.updateLights(cam.position);
    followShadow(lobbyMap.atmo.sun, lobbyMap.atmo.sunDir, cam.position);
    lobbyMap.atmo.sky.position.copy(cam.position);
    renderer.toneMappingExposure = lobbyMap.atmo.exposure;
    lobbyMap.pipe.render(false);
    return;
  }
  if (lobby.char && lobby.char.root.parent !== lobby.scene) lobby.scene.add(lobby.char.root);
  if (lobby.mode === 'char' && lobby.char) {
    lobby.char.update(dt, lobby.actor);
    lobby.camera.position.set(0.1 + Math.sin(lobby.t * 0.15) * 0.08, 1.45, 5.6);
    lobby.camera.lookAt(0, 1.0, 0);
  } else {
    if (lobby.weapon) {
      // осмотр: тянуть пальцем/мышью — вращать, колесо/щипок — приблизить; без касаний — плавное покачивание
      const idle = performance.now() - (lobby.dragAt || 0) > 2500;
      if (idle) lobby.rotY = (lobby.rotY ?? 0) * 0.97 + (Math.sin(lobby.t * 0.45) * 0.6) * 0.03, lobby.rotX = (lobby.rotX ?? 0) * 0.95;
      lobby.weapon.rotation.set(lobby.rotX || 0, (lobby.rotY || 0) - Math.PI / 2 + 0.25, 0);
      lobby.weapon.position.y = Math.sin(lobby.t * 1.2) * 0.02;
    }
    const off = aspect > 1.3 ? -0.42 : 0;
    lobby.camera.position.set(off, 1.25, 3.4 * (lobby.zoom || 1));
    lobby.camera.lookAt(off, 1.1, 0);
  }
  lobby.dust.rotation.y += dt * 0.02;
  renderer.toneMappingExposure = 1.0;
  renderer.clear();
  renderer.render(lobby.scene, lobby.camera);
}

// ---------- Превью карт ----------
const mapThumbs = {};
const THUMB_CAM = { factory: [[-46, 3.5, 1], [0, 6, 0]], quarter: [[-38, 3.5, 1], [0, 6, 0]], oasis: [[-38, 10, 16], [0, 0, -4]], port: [[-30, 13, -35], [2, 0, 4]] };
async function renderMapThumb(id) {
  await prepareMap(id);
  const sc = new THREE.Scene();
  buildMap(sc, id, 'medium');
  const at = setupAtmosphere(renderer, sc, MAPS[id], 'medium', await loadHDRI(MAPS[id].hdri));
  await texturesReady();
  const cam = new THREE.PerspectiveCamera(60, canvas.width / canvas.height, 0.1, 1000);
  const [p, t] = THUMB_CAM[id] || [[-37, 6, 5], [0, 4, -1]];
  cam.position.set(...p); cam.lookAt(...t);
  at.sky.position.copy(cam.position);
  renderer.toneMappingExposure = at.exposure;
  renderer.clear();
  renderer.render(sc, cam);
  const out = document.createElement('canvas'); out.width = 480; out.height = 240;
  const ctx = out.getContext('2d');
  const sw = canvas.width, sh = canvas.height;
  let cw = sw, ch = sw / 2; if (ch > sh) { ch = sh; cw = sh * 2; }
  ctx.drawImage(canvas, (sw - cw) / 2, (sh - ch) / 2, cw, ch, 0, 0, 480, 240);
  mapThumbs[id] = out.toDataURL('image/jpeg', 0.85);
  sc.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  at.env.dispose();
}

// ---------- Навигация ----------
let screen = 'play';
function goto(name) {
  sound.init(); sound.uiClick();
  if (game && name !== 'settings') { $('menu').classList.add('hidden'); $('pause').classList.remove('hidden'); return; }
  screen = name;
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === 'screen-' + name));
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('on', b.dataset.goto === name));
  setLobbyMode(['loadout', 'inventory', 'cases'].includes(name) ? 'weapon' : 'char');
  renderTopbar();
  ({ pass: renderPass, play: renderPlay, loadout: renderLoadout, inventory: renderInventory, cases: renderCases, store: renderStore, profile: renderProfile, clan: renderClan, settings: renderSettings }[name] || (() => {}))();
}
document.querySelectorAll('[data-goto]').forEach(b => b.addEventListener('click', () => goto(b.dataset.goto)));

function renderTopbar() {
  const li = levelInfo(profile.xp || 0);
  $('credits').textContent = profile.credits.toLocaleString('ru');
  $('gold').textContent = profile.gold.toLocaleString('ru');
  $('lvl').textContent = 'Ур. ' + li.level; $('rank').textContent = li.rank;
  $('xp-fill').style.width = (li.cur / li.need * 100) + '%';
  $('tb-rank').innerHTML = rankBadge(profile.rating || 0, 40);
  $('nick').textContent = clanTag() + settings.nickname; $('avatar').innerHTML = avatarHTML(settings.nickname, 42);
}

// ---------- Экран «Играть» ----------
const OPTIONS = {
  side: [['auto', 'Случайно'], ['A', 'Спецназ'], ['B', 'Наёмники']],
  perTeam: [[1, '1×1'], [2, '2×2'], [3, '3×3'], [4, '4×4'], [5, '5×5']],
  difficulty: Object.entries(DIFFICULTY).map(([k, v]) => [k, v.name]),
  rounds: [[6, 'MR6'], [12, 'MR12'], [16, 'MR16'], [24, 'MR24']],
  killsToWin: [[20, '20'], [40, '40'], [60, '60'], [100, '100']],
  minutes: [[5, '5 мин'], [8, '8 мин'], [12, '12 мин']],
};
function renderPlayWidgets() {
  const lvl = passLevel(), xpIn = (profile.passXp || 0) % PASS_XP;
  const rk = rankOf(profile.rating || 0), li = levelInfo(profile.xp || 0);
  const owned = profile.owned.length, total = Object.keys(ALL_SKINS).length;
  const cases = Object.values(profile.cases || {}).reduce((a, b) => a + b, 0);
  $('play-widgets').innerHTML = `
    <button class="pw pw-pass" data-goto="pass"><small>${SEASON.name}</small><b>Боевой пропуск · ур. ${lvl}</b><div class="pw-bar"><i style="width:${xpIn / PASS_XP * 100}%"></i></div></button>
    <button class="pw pw-rank" data-mode="ranked">${rankBadge(rk.rating, 40)}<div><small>Рейтинг</small><b style="color:${rk.color}">${rk.name}</b><span>${rk.rating} RP</span></div></button>
    <button class="pw pw-cases" data-goto="cases"><small>Кейсы</small><b>${cases ? cases + ' к открытию' : 'Новые коллекции'}</b><span>Собрано скинов: ${owned} / ${total}</span></button>
    ${dailyAvailable() ? `<button class="pw pw-daily" data-goto="store"><small>Награда дня</small><b>Забрать</b></button>` : ''}`;
  $('play-widgets').querySelectorAll('[data-goto]').forEach(b => b.onclick = () => goto(b.dataset.goto));
  $('play-widgets').querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { settings.match.mode = b.dataset.mode; saveSettings(); renderPlay(); });
  void li;
}

function renderPlay() {
  const m = settings.match;
  renderPlayWidgets();
  $('modes').innerHTML = Object.values(MODES).map(md => `<button class="mode-card ${md.id === 'ranked' ? 'ranked' : ''} ${m.mode === md.id ? 'on' : ''}" data-mode="${md.id}" style="--mc:${md.color}"><b>${md.name}</b><small>${md.id === 'ranked' ? rankOf(profile.rating || 0).name + ' · ' + (profile.rating || 0) + ' RP' : md.desc}</small>${md.id === 'ranked' ? `<span class="mc-rank">${rankBadge(profile.rating || 0, 44)}</span>` : ''}</button>`).join('');
  $('modes').querySelectorAll('.mode-card').forEach(b => b.onclick = () => { m.mode = b.dataset.mode; saveSettings(); sound.uiClick(); renderPlay(); });
  const seg = (key, opts) => `<div class="seg" data-opt="${key}">${opts.map(([v, l]) => `<button data-v="${v}" class="${m[key] == v ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  const rows = [];
  rows.push(`<div class="row"><label>Карта</label><div class="maps">${Object.values(MAPS).filter(mp => !mp.hidden).map(mp => `<button class="map-card ${m.map === mp.id ? 'on' : ''}" data-map="${mp.id}">${mapThumbs[mp.id] ? `<img class="thumb" src="${mapThumbs[mp.id]}">` : '<div class="thumb"></div>'}<div class="info"><b>${mp.name}</b></div></button>`).join('')}</div></div>`);
  if (m.mode === 'ranked') {
    const rk = rankOf(profile.rating || 0);
    const prev = rk.next ? (rk.next - 100) : rk.rating;
    const prog = rk.next ? Math.max(0, Math.min(1, (rk.rating - prev) / 100)) : 1;
    rows.unshift(`<div class="rank-box">${rankBadge(rk.rating, 64)}<div style="flex:1"><b style="color:${rk.color}">${rk.name}</b><div class="hint">${rk.rating} RP${rk.next ? ` · до следующего ${rk.next - rk.rating} RP` : ''}</div><div class="rank-bar"><i style="width:${prog * 100}%"></i></div></div></div>
      <div class="hint">${SEASON.name} · ${SEASON.ends}<br>Матчей: ${profile.rankedPlayed || 0} · побед: ${profile.rankedWins || 0} · лучший: ${rankOf(profile.bestRating || 0).name}<br>Закладка бомбы 5×5, MR12. Сила ботов зависит от звания.</div>`);
    $('match-card').innerHTML = `<div class="card-title">${MODES[m.mode].name}</div>` + rows.join('');
    $('match-card').querySelectorAll('.map-card').forEach(b => b.onclick = () => { m.map = b.dataset.map; saveSettings(); sound.uiClick(); renderPlay(); setLobbyMap(m.map); });
    $('start-sub').textContent = `${MAPS[m.map].name} · рейтинг · ${rk.name}`;
    return;
  }
  if (m.mode !== 'ffa') rows.push(`<div class="row"><label>Сторона</label>${seg('side', OPTIONS.side)}</div>`);
  rows.push(`<div class="row"><label>${m.mode === 'ffa' || m.mode === 'gungame' ? 'Игроков (×2)' : 'Игроков в команде'}</label>${seg('perTeam', OPTIONS.perTeam)}</div>`);
  rows.push(`<div class="row"><label>Сложность ботов</label>${seg('difficulty', OPTIONS.difficulty)}</div>`);
  if (m.mode === 'defuse') rows.push(`<div class="row"><label>Количество раундов</label>${seg('rounds', OPTIONS.rounds)}</div>`);
  if (m.mode === 'tdm' || m.mode === 'ffa') { rows.push(`<div class="row"><label>Убийств до победы</label>${seg('killsToWin', OPTIONS.killsToWin)}</div>`); rows.push(`<div class="row"><label>Время</label>${seg('minutes', OPTIONS.minutes)}</div>`); }
  $('match-card').innerHTML = `<div class="card-title">${MODES[m.mode].name}</div>` + rows.join('');
  $('match-card').querySelectorAll('.seg').forEach(s => s.querySelectorAll('button').forEach(b => b.onclick = () => {
    const key = s.dataset.opt, v = b.dataset.v;
    m[key] = isNaN(+v) ? v : +v; saveSettings(); sound.uiClick(); renderPlay();
    if (key === 'side' && v !== 'auto') setLobbyTeam(v);
  }));
  $('match-card').querySelectorAll('.map-card').forEach(b => b.onclick = () => { m.map = b.dataset.map; saveSettings(); sound.uiClick(); renderPlay(); setLobbyMap(m.map); });
  $('start-sub').textContent = `${MAPS[m.map].name} · ${m.mode === 'ffa' || m.mode === 'gungame' ? m.perTeam * 2 + ' игроков' : m.perTeam + ' на ' + m.perTeam} · ${DIFFICULTY[m.difficulty].name}`;
}

// ---------- Снаряжение ----------
let loTeam = 'A', loSlot = 'primary';
const SLOT_NAMES = { primary: 'Основное', secondary: 'Пистолет', knife: 'Нож' };
function weaponStatsBars(id) {
  const w = WEAPONS[id];
  if (!w) return '';
  const dmg = Math.min(100, w.damage * (w.pellets || 1) / 1.2), rate = Math.min(100, w.rpm / 9), acc = Math.max(5, 100 - w.spread * 9000 - w.moveSpread * 300), mob = Math.min(100, w.speed * 85), mag = Math.min(100, w.mag / 0.45);
  const bar = (n, v, t) => `<div>${n}<i style="--v:${v}%"></i><em>${t}</em></div>`;
  return `<div class="stat-bars">${bar('Урон', dmg, w.damage + (w.pellets ? '×' + w.pellets : ''))}${bar('Скорострельность', rate, w.rpm)}${bar('Точность', acc, Math.round(acc))}${bar('Мобильность', mob, Math.round(w.speed * 100))}${bar('Магазин', mag, w.mag)}${bar('Бронепробитие', w.pen * 100, Math.round(w.pen * 100) + '%')}</div>`;
}
function renderLoadout() {
  const lo = profile.loadout[loTeam];
  $('lo-team').innerHTML = ['A', 'B'].map(t => `<button data-t="${t}" class="${loTeam === t ? 'on' : ''}">${t === 'A' ? 'Спецназ' : 'Наёмники'}</button>`).join('');
  $('lo-team').querySelectorAll('button').forEach(b => b.onclick = () => { loTeam = b.dataset.t; sound.uiClick(); renderLoadout(); });
  const cur = { primary: lo.primary, secondary: lo.secondary, knife: profile.knife };
  $('lo-slots').innerHTML = Object.entries(SLOT_NAMES).map(([s, n]) => `<button class="lo-slot ${loSlot === s ? 'on' : ''}" data-s="${s}"><small>${n}</small><b>${itemName(cur[s])}</b>${iconImg(cur[s])}</button>`).join('');
  $('lo-slots').querySelectorAll('.lo-slot').forEach(b => b.onclick = () => { loSlot = b.dataset.s; sound.uiClick(); renderLoadout(); });
  let list;
  if (loSlot === 'knife') list = Object.keys(KNIVES);
  else list = Object.values(WEAPONS).filter(w => (loSlot === 'secondary') === (w.cat === 'pistol') && weaponAvailableFor(loTeam, w.id)).map(w => w.id);
  const owned = ownedKnives();
  $('lo-list').innerHTML = list.map(id => {
    const locked = loSlot === 'knife' && !owned.includes(id);
    const w = WEAPONS[id];
    return `<button class="wcard ${cur[loSlot] === id ? 'on' : ''} ${locked ? 'locked' : ''}" data-id="${id}">${iconImg(id)}<b>${itemName(id)}</b><small>${w ? CATS[w.cat] : locked ? 'Из кейса «Клинок»' : 'Нож'}</small>${w ? `<span class="price">$${w.price}</span>` : ''}</button>`;
  }).join('');
  $('lo-list').querySelectorAll('.wcard').forEach(b => {
    b.onclick = () => {
      const id = b.dataset.id;
      if (b.classList.contains('locked')) { toast('Этот нож можно получить из кейса «Клинок»'); return; }
      if (loSlot === 'knife') profile.knife = id; else lo[loSlot] = id;
      saveProfile(); sound.uiClick(); renderLoadout();
      if (loSlot === 'primary' && lobby.team === loTeam) setLobbyCharacter();
    };
  });
  loInfo(cur[loSlot]);
}
function loInfo(id) {
  const skin = equippedSkin(id);
  setShowcase(id, skin);
  const w = WEAPONS[id];
  const skins = Object.values(SKINS).filter(s => s.weapon === id && profile.owned.includes(s.id));
  $('lo-info').innerHTML = `<div class="card"><div class="wsub">${w ? CATS[w.cat] : 'Нож'}${w ? ` · $${w.price}` : ''}</div><div class="wname">${itemName(id)}</div>
    ${skin ? `<div style="color:${RARITY[skin.rarity].color};font-weight:700">${skin.name}</div>` : ''}
    <div style="margin-top:10px">${weaponStatsBars(id)}</div>
    <div class="card-title" style="margin-top:12px">Скины (${skins.length})</div>
    <div class="skin-grid" style="max-height:170px">${[{ id: '', name: 'Стандарт' }, ...skins].map(s => `<button class="skin ${(profile.equipped[id] || '') === s.id ? 'on' : ''}" data-sk="${s.id}" ${s.rarity ? `style="--rc:${RARITY[s.rarity].color}"` : ''}>${s.id ? itemPic(s) : '<div class="sw" style="background:#2a313a"></div>'}<div class="nm">${s.name}</div></button>`).join('')}</div></div>`;
  $('lo-info').querySelectorAll('[data-sk]').forEach(b => b.onclick = () => { equip(id, b.dataset.sk || null); sound.uiClick(); loInfo(id); if (lobby.char) setLobbyCharacter(); });
}

// ---------- Инвентарь ----------
let invFilter = 'all', invRarity = 'all', invSel = null;
function renderInventory() {
  const cats = [['all', 'Все'], ...CAT_ORDER.map(c => [c, CATS[c]]), ['knife', 'Ножи'], ['agent', 'Агенты']];
  $('inv-filter').innerHTML = cats.map(([k, n]) => `<button data-k="${k}" class="${invFilter === k ? 'on' : ''}">${n}</button>`).join('');
  $('inv-filter').querySelectorAll('button').forEach(b => b.onclick = () => { invFilter = b.dataset.k; renderInventory(); });
  $('inv-rarity').innerHTML = [['all', 'Любая'], ...RARITY_ORDER.map(r => [r, RARITY[r].name])].map(([k, n]) => `<button data-k="${k}" class="${invRarity === k ? 'on' : ''}" ${k !== 'all' ? `style="color:${RARITY[k].color}"` : ''}>${n}</button>`).join('');
  $('inv-rarity').querySelectorAll('button').forEach(b => b.onclick = () => { invRarity = b.dataset.k; renderInventory(); });
  const items = profile.owned.map(id => SKINS[id]).filter(Boolean)
    .filter(s => invFilter === 'all' || (invFilter === 'knife' ? KNIVES[s.weapon] : invFilter === 'agent' ? s.agent : WEAPONS[s.weapon] && WEAPONS[s.weapon].cat === invFilter))
    .filter(s => invRarity === 'all' || s.rarity === invRarity)
    .sort((a, b) => RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity));
  $('inv-count').textContent = `${profile.owned.length} предметов`;
  $('inv-grid').innerHTML = items.length ? items.map(s => `<button class="skin ${invSel === s.id ? 'on' : ''}" data-id="${s.id}" style="--rc:${RARITY[s.rarity].color}">${itemPic(s)}<div class="nm">${itemName(s.weapon).split(' «')[0]} | ${s.name}</div><div class="rr" style="color:${RARITY[s.rarity].color}">${RARITY[s.rarity].name}</div>${profile.equipped[s.weapon] === s.id ? '<span class="eq">ВЫБРАН</span>' : ''}</button>`).join('')
    : '<p class="hint">Пусто. Открывайте кейсы, чтобы получить скины и ножи.</p>';
  $('inv-grid').querySelectorAll('.skin').forEach(b => b.onclick = () => { invSel = b.dataset.id; sound.uiClick(); renderInventory(); });
  invInfo();
}
function previewAgent(s) {
  const team = s.agent.team;
  if (lobby.char) { lobby.char.root.parent && lobby.char.root.parent.remove(lobby.char.root); }
  lobby.team = team; lobby.char = new CharacterModel(team, -1, s); lobby.scene.add(lobby.char.root);
  lobby.charWeapon = null; setLobbyCharacter(); setLobbyMode('char');
}

function invInfo() {
  const s = SKINS[invSel];
  if (!s || !profile.owned.includes(s.id)) { $('inv-info').innerHTML = ''; return; }
  if (s.agent) previewAgent(s); else setShowcase(s.weapon, s);
  const eq = profile.equipped[s.weapon] === s.id;
  const col = s.collection === 'blades' ? { name: 'Клинки', lore: 'Ножи выпадают редко: из кейсов с особым шансом и из кейса «Самоцветы».' } : COLLECTIONS[s.collection] || COLLECTIONS.base;
  $('inv-info').innerHTML = `<div class="card inv-card" style="--rc:${RARITY[s.rarity].color}"><div class="wsub" style="color:${RARITY[s.rarity].color}">${RARITY[s.rarity].name}${s.fx ? ' · <span class="live">ЖИВОЙ СКИН</span>' : ''}${s.signature ? ' · ИМЕННОЙ' : ''}</div><div class="wname">${itemName(s.weapon).split(' «')[0]} | ${s.name}</div>
    <div class="coll"><small>Коллекция</small><b>${col.name}</b></div>
    ${instanceHTML(s)}
    ${s.story ? `<p class="story">«${s.story}»</p>` : `<p class="story dim">${col.lore}</p>`}
    <div class="btn-row" style="margin-top:12px"><button class="btn" id="inv-eq">${eq ? 'Снять' : 'Экипировать'}</button><button class="btn danger" id="inv-sell">Продать · ◈ ${sellPrice(s)}</button></div></div>`;
  $('inv-eq').onclick = () => { equip(s.weapon, eq ? null : s.id); if (s.agent) { lobby.team = null; setLobbyTeam(s.agent.team); } if (!eq && KNIVES[s.weapon]) profile.knife = s.weapon; saveProfile(); sound.uiClick(); renderInventory(); };
  $('inv-sell').onclick = () => { const v = sellSkin(s.id, sellPrice(s)); toast(`Продано за ◈ ${v}`); invSel = null; renderTopbar(); renderInventory(); };
}

function dropInfo(s) {
  const it = instanceOf(s), sp = specialPattern(it.seed, s), fc = finishClass(s), wg = wearGrade(it.f);
  return `<div class="drop-inst"><span>${fc.name}</span>${s.agent || s.pattern === 'art' ? '' : `<span>${wg.name} · ${it.f.toFixed(3)}</span>`}<span>Узор #${it.seed}</span>${sp ? `<span class="sp-tag" style="--sc:${sp.color}">${sp.name}!</span>` : ''}<span>◈ ${skinValue(s).toLocaleString('ru')}</span></div>`;
}
function sellPrice(s) { return Math.max(RARITY[s.rarity].sell * 10, Math.round(skinValue(s) * 0.12 / 5) * 5); }
// Экземпляры скинов: износ и номер узора влияют на текстуру
setInstanceResolver((id) => { if (!profile.owned.includes(id)) return null; const s = ALL_SKINS[id]; if (!s) return null; const it = instanceOf(s); return { ...it, special: specialPattern(it.seed, s) }; });

// Картинка предмета: 3D-рендер (готовится в фоне), пока — образец узора
function onItemReady(id, url) { if (!url) return; document.querySelectorAll(`img[data-item="${id}"]`).forEach(img => { img.src = url; img.classList.add('r3d'); img.removeAttribute('data-item'); }); }
function itemPic(s) {
  const url = itemImage(s, onItemReady);
  return url ? `<img class="ipic r3d" src="${url}" alt="">` : `<img class="ipic" data-item="${s.id}" src="${skinPreviewURL(s)}" alt="">`;
}

// ---------- Кейсы ----------
function renderCases() {
  renderTopbar();
  setShowcase(profile.loadout.A.primary, equippedSkin(profile.loadout.A.primary));
  $('case-list').innerHTML = CASES.filter(c => !c.reward || profile.cases[c.id]).map(c => {
    const pr = casePrice(c);
    const total = Object.values(c.weights).reduce((a, b) => a + b, 0);
    const odds = Object.entries(c.weights).map(([r, w]) => `<span style="color:${RARITY[r].color}">${RARITY[r].name} ${(w / total * 100).toFixed(1)}%</span>`).join(' · ');
    const n = profile.cases[c.id] || 0;
    const loreKey = c.lore || (COLLECTIONS[c.id] ? c.id : null);
    const best = caseContents(c).sort((a, b) => ((b.collection === loreKey) - (a.collection === loreKey)) || ((b.signature ? 1 : 0) - (a.signature ? 1 : 0)) || RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity))[0];
    const loreTxt = COLLECTIONS[loreKey] && COLLECTIONS[loreKey] !== COLLECTIONS.base ? COLLECTIONS[loreKey].name : '';
    return `<div class="case" style="--cc:${c.color}"><div class="box">${best ? `<div class="case-hero">${itemPic(best)}</div>` : '<div class="crate3d"></div>'}${n ? `<span class="count">×${n}</span>` : ''}</div><h3>${c.name}</h3>${loreTxt ? `<div class="case-coll">Коллекция «${loreTxt}»</div>` : ''}
      <div class="hint" style="font-size:11px;line-height:1.5">${odds}</div>
      <div class="btn-row"><button class="btn ghost" data-view="${c.id}">Содержимое</button></div>
      <div class="btn-row">${c.reward ? '<span class="hint">Награда клановых битв</span>' : `<button class="btn ghost" data-buy="${c.id}">Купить · ${pr.cur === 'gold' ? '●' : '◈'} ${pr.amount}</button>`}<button class="btn" data-open="${c.id}" ${n ? '' : 'disabled'}>Открыть</button></div></div>`;
  }).join('');
  $('case-list').querySelectorAll('[data-buy]').forEach(b => b.onclick = () => { const c = CASES.find(x => x.id === b.dataset.buy); if (buyCase(c)) { sound.buy(); toast(`${c.name} добавлен в инвентарь`); renderCases(); } else toast('Недостаточно валюты — загляните в магазин'); });
  $('case-list').querySelectorAll('[data-open]').forEach(b => b.onclick = () => startCaseOpen(CASES.find(x => x.id === b.dataset.open)));
  $('case-list').querySelectorAll('[data-view]').forEach(b => b.onclick = () => {
    const c = CASES.find(x => x.id === b.dataset.view);
    const items = caseContents(c).sort((a, b) => RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity));
    $('modal-title').textContent = c.name;
    items.sort((a, b) => (b.signature ? 1 : 0) - (a.signature ? 1 : 0));
    const lk = c.lore || (COLLECTIONS[c.id] ? c.id : null);
    const col = COLLECTIONS[lk];
    $('modal-body').innerHTML = `${col && lk !== 'base' ? `<div class="case-lore"><b>${col.name}</b><p>${col.lore}</p></div>` : ''}<div class="skin-grid">${items.map(skinCard).join('')}</div>`;
    $('modal').classList.remove('hidden');
  });
}
$('modal-close').onclick = () => $('modal').classList.add('hidden');
function skinCard(s) {
  return `<div class="skin ${s.signature ? 'sig' : ''}" style="--rc:${RARITY[s.rarity].color}" ${s.story ? `title="${s.story.replace(/"/g, '&quot;')}"` : ''}>${s.fx ? '<span class="live-tag">ЖИВОЙ</span>' : ''}${itemPic(s)}<div class="nm">${s.name}</div><div class="rr" style="color:${RARITY[s.rarity].color}">${itemName(s.weapon).split(' «')[0]}</div></div>`;
}
let lastOpened = null;
function startCaseOpen(c) {
  sound.init();
  const res = openCase(c);
  if (!res) return;
  lastOpened = res;
  renderTopbar();
  const pool = caseContents(c);
  const N = 50, WIN = 42;
  const items = [];
  for (let i = 0; i < N; i++) items.push(i === WIN ? res.skin : pool[Math.floor(Math.random() * pool.length)]);
  const strip = $('roulette-strip');
  for (const it of items) itemImage(it, onItemReady);
  pumpItemImages(64);
  strip.innerHTML = items.map(skinCard).join('');
  strip.style.transition = 'none'; strip.style.transform = 'translateX(0)';
  $('case-open-title').textContent = c.name;
  $('case-result').innerHTML = '';
  $('case-close').parentElement.classList.add('hidden');
  $('case-open').classList.remove('hidden');
  const cardW = 130, boxW = strip.parentElement.clientWidth;
  const offset = WIN * cardW + 62 - boxW / 2 + (Math.random() - 0.5) * 90;
  let lastIdx = -1;
  requestAnimationFrame(() => requestAnimationFrame(() => { strip.style.transition = 'transform 5.2s cubic-bezier(0.1, 0.7, 0.12, 1)'; strip.style.transform = `translateX(${-offset}px)`; }));
  const tick = setInterval(() => {
    const m = new DOMMatrix(getComputedStyle(strip).transform);
    const idx = Math.floor((-m.m41 + boxW / 2) / cardW);
    if (idx !== lastIdx) { lastIdx = idx; sound.click(); }
  }, 30);
  setTimeout(() => {
    clearInterval(tick);
    sound.reward();
    const r = RARITY[res.skin.rarity];
    $('case-result').innerHTML = `<span style="color:${r.color}">${itemName(res.skin.weapon).split(' «')[0]} | ${res.skin.name}</span><small>${r.name}${res.duplicate ? ` · дубликат, продан за ◈ ${r.sell * 10}` : ''}</small>${res.duplicate ? '' : dropInfo(res.skin)}`;
    $('case-sell').style.display = res.duplicate ? 'none' : '';
    $('case-close').parentElement.classList.remove('hidden');
    renderTopbar();
    setShowcase(res.skin.weapon, res.skin);
  }, 5400);
}
$('case-close').onclick = () => { $('case-open').classList.add('hidden'); renderCases(); };
$('case-sell').onclick = () => { if (lastOpened && !lastOpened.duplicate) { const v = sellSkin(lastOpened.skin.id); toast(`Продано за ◈ ${v}`); } $('case-open').classList.add('hidden'); renderCases(); };

// ---------- Боевой пропуск ----------
function rewardHtml(it) {
  if (it.skin) { const sk = ALL_SKINS[it.skin]; return `<div class="ic">${iconImg(sk.weapon)}</div><div style="color:${RARITY[sk.rarity].color};font-weight:700">${itemName(sk.weapon).split(' «')[0]} | ${sk.name}</div>`; }
  if (it.cases) { const [c] = Object.keys(it.cases); return `<div class="ic">📦</div><div>${CASES.find(x => x.id === c).name}</div>`; }
  if (it.gold) return `<div class="ic" style="color:var(--gold)">●</div><div>${it.gold} золота</div>`;
  return `<div class="ic" style="color:var(--cr)">◈</div><div>${it.credits} кредитов</div>`;
}
function renderPass() {
  setLobbyMode('char');
  const lvl = passLevel(), xp = (profile.passXp || 0) % PASS_XP;
  $('pass-season').textContent = SEASON.name + ' · ' + SEASON.ends;
  $('pass-top').innerHTML = `<div class="lvl">${lvl}/${PASS.length}</div><div style="flex:1"><div class="hint">Опыт за матчи открывает уровни. ${lvl < PASS.length ? `До следующего: ${PASS_XP - xp} опыта` : 'Пропуск пройден!'}</div><div class="bar"><i style="width:${lvl >= PASS.length ? 100 : xp / PASS_XP * 100}%"></i></div></div>
    ${profile.passPremium ? '<span class="btn ghost">Премиум активен ✓</span>' : '<button class="btn" id="pass-buy" style="background:var(--gold)">Премиум-пропуск · 0 ₴</button>'}`;
  const pb = $('pass-buy'); if (pb) pb.onclick = () => { profile.passPremium = true; saveProfile(); sound.reward(); toast('Премиум-пропуск активирован'); renderPass(); };
  $('pass-track').innerHTML = PASS.map(p => {
    const got = lvl >= p.lvl;
    const cell = (it, tr) => {
      const claimed = profile.passClaimed[p.lvl + tr];
      const lock = tr === 'p' && !profile.passPremium;
      return `<div class="pcell ${tr === 'p' ? 'prem' : ''} ${lock ? 'lock' : ''}">${rewardHtml(it)}${claimed ? '<span class="done">Получено</span>' : `<button data-l="${p.lvl}" data-t="${tr}" ${got && !lock ? '' : 'disabled'}>Забрать</button>`}</div>`;
    };
    return `<div class="pass-col ${got ? 'got' : ''}"><div class="num">${p.lvl}</div>${cell(p.free, 'f')}${cell(p.prem, 'p')}</div>`;
  }).join('');
  $('pass-track').querySelectorAll('button[data-l]').forEach(b => b.onclick = () => { const it = claimPass(+b.dataset.l, b.dataset.t); if (it) { sound.reward(); toast('Награда получена'); renderTopbar(); renderPass(); } });
}

// ---------- Магазин ----------
function renderStore() {
  const avail = dailyAvailable();
  $('daily').innerHTML = `<div><b>Ежедневная награда</b><div class="hint">Заходите каждый день: серия до 7 дней, каждый третий день — кейс.</div></div>
    <div class="days">${[1, 2, 3, 4, 5, 6, 7].map(d => `<i class="${d <= profile.streak ? 'got' : ''}">${d}</i>`).join('')}</div>
    <button class="btn" id="daily-btn" ${avail ? '' : 'disabled'}>${avail ? 'Забрать' : 'Завтра'}</button>`;
  $('daily-btn').onclick = () => { const r = claimDaily(); if (r) { sound.reward(); toast(`+◈ ${r.credits} и +● ${r.gold} (день ${r.streak})`); renderTopbar(); renderStore(); } };
  $('store-grid').innerHTML = STORE.map(it => {
    const done = it.once && profile.purchases[it.id];
    const art = it.gold && !it.credits ? `<div class="art gd">●</div>` : it.credits && !it.gold ? `<div class="art cr">◈</div>` : `<div class="art gd">🎁</div>`;
    const what = [it.gold ? `● ${it.gold} золота` : '', it.credits ? `◈ ${it.credits.toLocaleString('ru')} кредитов` : '', ...Object.entries(it.cases || {}).map(([c, n]) => `${CASES.find(x => x.id === c).name} ×${n}`)].filter(Boolean).join('<br>');
    return `<div class="store-item">${it.tag ? `<span class="tag">${it.tag}</span>` : ''}${art}<h3>${it.title}</h3><div class="hint">${what}</div>
      <button class="btn" data-id="${it.id}" ${done ? 'disabled' : ''}><span>${done ? 'Куплено' : 'Купить'}</span><span>${it.price} ₴</span></button></div>`;
  }).join('');
  $('store-grid').querySelectorAll('[data-id]').forEach(b => b.onclick = () => { const it = STORE.find(x => x.id === b.dataset.id); if (buyStoreItem(it)) { sound.reward(); toast(`Получено: ${it.title}`); renderTopbar(); renderStore(); } });
}

// ---------- Профиль ----------
// ---------- Клан ----------
let clanForm = { icon: 'shield', color: 0 };
function renderClan() {
  setLobbyMode('char');
  const c = profile.clan;
  if (!c) {
    $('clan-panel').innerHTML = `<div class="panel-head"><h2>Кланы</h2><span class="hint">Играйте вместе, качайте клан, носите тег перед ником</span></div>
      <div class="clan-cols"><div class="card clan-create"><div class="card-title">Создать клан</div>
        <div class="clan-preview">${emblemSVG(clanForm.icon, EMBLEM_COLORS[clanForm.color], 72, 'shield')}<div><b id="cp-name">${esc(clanForm.name || 'New Clan')}</b><small>[${esc(clanForm.tag || 'TAG')}]</small></div></div>
        <input id="cl-name" maxlength="24" placeholder="Clan name (A–Z, 3–24)" value="${esc(clanForm.name || '')}">
        <input id="cl-tag" maxlength="5" placeholder="TAG (2–5)" value="${esc(clanForm.tag || '')}">
        <input id="cl-motto" maxlength="60" placeholder="Motto (English)" value="${esc(clanForm.motto || '')}">
        <div class="card-title" style="margin-top:6px">Эмблема</div>
        <div class="av-pick">${Object.keys(EMBLEM_ICONS).map(ic => `<button class="av-em ${clanForm.icon === ic ? 'on' : ''}" data-ic="${ic}">${emblemSVG(ic, EMBLEM_COLORS[clanForm.color], 38, 'shield')}</button>`).join('')}</div>
        <div class="seg" style="margin:8px 0">${EMBLEM_COLORS.map((cc, i) => `<button class="clr ${clanForm.color === i ? 'on' : ''}" data-c="${i}" style="background:linear-gradient(135deg,${cc[0]},${cc[1]})"></button>`).join('')}</div>
        <button class="play-btn small" id="cl-create">Создать · 0 ₴</button></div>
      <div class="card clan-join"><div class="card-title">Вступить в клан</div>${CLAN_LIST.map((k, i) => `<div class="clan-row">${emblemSVG(k.icon, EMBLEM_COLORS[k.color], 46, 'shield')}<div class="cr-info"><b>${esc(k.name)} <small>[${k.tag}]</small></b><span>«${esc(k.motto)}»</span><small>Ур. ${k.level} · ${k.size}/50 · от ${k.minRank}</small></div><button class="btn" data-join="${i}">Вступить</button></div>`).join('')}</div></div>`;
    const keep = () => { clanForm.name = $('cl-name').value; clanForm.tag = $('cl-tag').value.toUpperCase(); clanForm.motto = $('cl-motto').value; };
    ['cl-name', 'cl-tag'].forEach(id => $(id).oninput = () => { keep(); $('cp-name').textContent = clanForm.name || 'New Clan'; $('cp-name').nextElementSibling.textContent = `[${clanForm.tag || 'TAG'}]`; });
    $('clan-panel').querySelectorAll('.av-em').forEach(b => b.onclick = () => { keep(); clanForm.icon = b.dataset.ic; renderClan(); });
    $('clan-panel').querySelectorAll('.clr').forEach(b => b.onclick = () => { keep(); clanForm.color = +b.dataset.c; renderClan(); });
    $('cl-create').onclick = async () => {
      keep();
      const name = (clanForm.name || '').trim(), tag = (clanForm.tag || '').trim().toUpperCase();
      if (name.length >= 3 && tag.length >= 2) {
        toast('Проверяем название и тег…');
        const a = await claimName('clan', name); if (!a.ok) { toast(`Клан «${name}» уже существует`); return; }
        const b = await claimName('tag', tag); if (!b.ok) { releaseName('clan', name); toast(`Тег [${tag}] уже занят`); return; }
      }
      try { const c = createClan(clanForm); publishClan(c); sound.reward(); toast('Клан создан'); renderTopbar(); renderClan(); } catch (e) { toast(e.message); }
    };
    playerClans().then(list => {
      const box = document.querySelector('#clan-panel .clan-join'); if (!box || !list.length) return;
      box.insertAdjacentHTML('beforeend', `<div class="card-title" style="margin-top:10px">Кланы игроков</div>` + list.map((k, i) => `<div class="clan-row">${emblemSVG(k.icon || 'shield', EMBLEM_COLORS[k.color] || EMBLEM_COLORS[0], 46, 'shield')}<div class="cr-info"><b>${esc(k.name)} <small>[${esc(k.tag)}]</small></b><span>${k.motto ? '«' + esc(k.motto) + '»' : ''}</span><small>Ур. ${k.level | 0} · ${k.size | 0}/50 · игроки</small></div><button class="btn" data-pjoin="${i}">Вступить</button></div>`).join(''));
      box.querySelectorAll('[data-pjoin]').forEach(b => b.onclick = () => { const k = list[+b.dataset.pjoin]; joinClan({ name: k.name, tag: k.tag, motto: k.motto || '', icon: k.icon || 'shield', color: k.color | 0, level: k.level | 0 || 1, size: k.size | 0 || 1 }); sound.reward(); toast('Вы вступили в клан'); renderTopbar(); renderClan(); });
    });
    $('clan-panel').querySelectorAll('[data-join]').forEach(b => b.onclick = () => { joinClan(CLAN_LIST[+b.dataset.join]); sound.reward(); toast('Вы вступили в клан'); renderTopbar(); renderClan(); });
    return;
  }
  const need = clanXpNeed(c.level);
  const cw = cwState(); saveProfile();
  const opps = cwOpponents(window.__playerClans || []);
  const ladder = [...opps, { name: c.name, tag: c.tag, icon: c.icon, color: c.color, rating: cw.rating, me: true }].sort((a, b) => b.rating - a.rating);
  const members = [{ name: settings.nickname, role: c.role, rating: profile.rating || 0, online: true, contrib: 0, me: true }, ...c.members].sort((a, b) => Object.keys(CLAN_ROLES).indexOf(a.role) - Object.keys(CLAN_ROLES).indexOf(b.role));
  $('clan-panel').innerHTML = `<div class="clan-head">${emblemSVG(c.icon, EMBLEM_COLORS[c.color], 96, 'shield')}<div class="ch-info"><h2>${esc(c.name)} <small>[${esc(c.tag)}]</small></h2><p>«${esc(c.motto || 'No motto')}»</p>
      <div class="ch-lvl"><b>Уровень ${c.level}</b><div class="pw-bar"><i style="width:${c.xp / need * 100}%"></i></div><small>${c.xp} / ${need} опыта клана · за каждый матч клан получает опыт</small></div></div>
      <div class="ch-stats"><div>Участников<b>${members.length}</b></div><div>В сети<b>${members.filter(m => m.online).length}</b></div><div>Ваша роль<b>${CLAN_ROLES[c.role]}</b></div></div></div>
    <div class="card cw-card"><div class="cw-head"><div><div class="card-title">Клановые битвы · сезон</div><div class="cw-rating"><b style="color:${cwLeague(cw.rating).color}">${cwLeague(cw.rating).name}</b> <span>${cw.rating} CWR</span></div>
        <small>${cw.wins} побед · ${cw.losses} поражений${cw.streak > 1 ? ` · серия ${cw.streak} 🔥` : ''}</small></div>
        <button class="play-btn small" id="cw-quick">Найти клан-бой</button></div>
      <div class="cw-cols"><div class="cw-ladder"><div class="hint">Таблица сезона · бой 5×5, «Закладка бомбы», до 7 побед</div>${ladder.map((o, i) => `<div class="cw-row ${o.me ? 'me' : ''}"><span class="cw-pos">${i + 1}</span>${emblemSVG(o.icon || 'shield', EMBLEM_COLORS[o.color] || EMBLEM_COLORS[0], 30, 'shield')}<b>${esc(o.name)} <small>[${esc(o.tag)}]</small></b><span class="cw-r" style="color:${cwLeague(o.rating).color}">${o.rating}</span>${o.me ? '<span class="cw-you">ВЫ</span>' : `<button class="btn" data-cw="${opps.indexOf(o)}">Вызов</button>`}</div>`).join('')}</div>
        <div class="cw-hist"><div class="hint">Последние бои</div>${cw.history.length ? cw.history.map(h => `<div class="cw-h ${h.draw ? '' : h.win ? 'w' : 'l'}"><b>${h.draw ? 'Н' : h.win ? 'П' : 'П'}</b><span>[${esc(h.tag)}] ${esc(h.opp)}</span><small>${h.score} · ${h.delta >= 0 ? '+' : ''}${h.delta}</small></div>`).join('') : '<div class="hint">Пока боёв не было. Вызовите клан из таблицы!</div>'}
        <div class="hint" style="margin-top:8px">Награды за победу: +400 ₴, +150 опыта клану, клановый кейс каждые 3 победы.</div></div></div></div>
    <div class="clan-cols"><div class="card"><div class="card-title">Состав</div><div class="clan-members">${members.map(m => `<div class="cm ${m.me ? 'me' : ''}"><i class="dot ${m.online ? 'on' : ''}"></i><b>${esc(m.name)}</b><span class="role r-${m.role}">${CLAN_ROLES[m.role]}</span><span class="cm-rank">${rankBadge(m.rating, 22)}${rankOf(m.rating).name}</span></div>`).join('')}</div></div>
      <div class="card"><div class="card-title">Журнал клана</div><div class="clan-log">${c.log.slice().reverse().map(l => `<div><small>${new Date(l.t).toLocaleDateString('ru')}</small> ${esc(l.text)}</div>`).join('')}</div>
        <div class="card-title" style="margin-top:12px">Бонусы уровня</div><div class="hint">Ур. 5: +5% кредитов за матч · Ур. 10: клановый кейс раз в день · Ур. 20: золотая рамка тега</div>
        <button class="btn danger" id="cl-leave" style="margin-top:14px">${c.role === 'leader' ? 'Распустить клан' : 'Покинуть клан'}</button></div></div>`;
  $('clan-panel').querySelectorAll('[data-cw]').forEach(b => b.onclick = () => startClanWar(opps[+b.dataset.cw]));
  $('cw-quick').onclick = () => { const near = opps.slice().sort((a, b) => Math.abs(a.rating - cw.rating) - Math.abs(b.rating - cw.rating)).slice(0, 3); startClanWar(near[Math.floor(Math.random() * near.length)]); };
  if (!window.__playerClans) playerClans().then(l => { window.__playerClans = l; if (l.length && profile.clan && !$('clan-panel').classList.contains('hidden')) renderClan(); });
  $('cl-leave').onclick = () => { const c = profile.clan; if (c && c.role === 'leader' && c.own) { releaseName('clan', c.name); releaseName('tag', c.tag); } leaveClan(); toast('Вы покинули клан'); renderTopbar(); renderClan(); };
}

function renderProfile() {
  setLobbyMode('char');
  const s = profile.stats, li = levelInfo(profile.xp || 0);
  const kd = s.deaths ? (s.kills / s.deaths).toFixed(2) : s.kills;
  const hs = s.kills ? Math.round(s.headshots / s.kills * 100) : 0;
  const wr = s.matches ? Math.round(s.wins / s.matches * 100) : 0;
  const top = Object.entries(s.perWeapon || {}).sort((a, b) => b[1] - a[1]).slice(0, 5);
  $('profile-panel').innerHTML = `<div class="prof-head"><div class="avatar big">${avatarHTML(settings.nickname, 72)}</div><div><h2>${esc(clanTag() + settings.nickname)}</h2><div class="hint">Уровень ${li.level} · ${li.rank} · ${li.cur}/${li.need} опыта</div></div></div>
    <div class="nick-row" style="margin-bottom:14px"><input id="nick-in" maxlength="16" value="${esc(settings.nickname)}"><button class="btn ghost" id="nick-save">Сменить ник</button></div>
    <div class="card-title">Аватар</div>
    <div class="av-pick"><label class="btn ghost av-up">Загрузить фото<input type="file" id="av-file" accept="image/*" hidden></label>
      ${Object.keys(EMBLEM_ICONS).map((ic, i) => `<button class="av-em ${profile.avatarEmblem && profile.avatarEmblem.icon === ic ? 'on' : ''}" data-ic="${ic}" data-c="${i % EMBLEM_COLORS.length}">${emblemSVG(ic, EMBLEM_COLORS[i % EMBLEM_COLORS.length], 44, 'circle')}</button>`).join('')}</div>
    <div class="stat-grid"><div>Матчей<b>${s.matches}</b></div><div>Победы<b>${wr}%</b></div><div>Убийства<b>${s.kills}</b></div><div>Смерти<b>${s.deaths}</b></div><div>K/D<b>${kd}</b></div><div>Хедшоты<b>${hs}%</b></div><div>Урон<b>${Math.round(s.damage || 0)}</b></div><div>Закладок<b>${s.plants}</b></div><div>Разминирований<b>${s.defuses}</b></div><div>Скинов<b>${profile.owned.length}</b></div></div>
    <div class="card-title">Любимое оружие</div>
    <div class="lo-list">${top.length ? top.map(([id, n]) => `<div class="wcard">${iconImg(id)}<b>${itemName(id)}</b><small>${n} убийств</small></div>`).join('') : '<p class="hint">Сыграйте матч, чтобы появилась статистика.</p>'}</div>
    <div class="card-title" style="margin-top:14px">Последние матчи</div>
    <div>${(profile.history || []).slice(-8).reverse().map(h => `<div class="set-row"><span style="width:110px;color:${h.win ? 'var(--ok)' : h.draw ? '#ccc' : 'var(--danger)'};font-weight:700">${h.win ? 'Победа' : h.draw ? 'Ничья' : 'Поражение'}</span><span style="width:170px">${MODES[h.mode] ? MODES[h.mode].name : h.mode}</span><span style="width:90px">${MAPS[h.map] ? MAPS[h.map].name : ''}</span><span>${h.k}/${h.d} · ${h.score}</span></div>`).join('') || '<p class="hint">История пуста.</p>'}</div>`;
  $('nick-save').onclick = async () => {
    const raw = $('nick-in').value.trim(); if (/[^A-Za-z0-9_.\-]/.test(raw)) { toast('Ник — только латиница, цифры, _ . -'); return; }
    const v = raw.slice(0, 16); if (v.length < 3) { toast('Ник — от 3 символов'); return; }
    if (v === settings.nickname) return;
    $('nick-save').disabled = true; toast('Проверяем, свободен ли ник…');
    const r = await claimName('nick', v, settings.nickname); $('nick-save').disabled = false;
    if (!r.ok) { toast(`Ник «${v}» уже занят другим игроком`); return; }
    settings.nickname = v; saveSettings(); renderTopbar(); renderProfile(); toast('Ник изменён');
  };
  $('av-file').onchange = (e) => { setAvatarFromFile(e.target.files[0]).then(() => { renderTopbar(); renderProfile(); toast('Аватар обновлён'); }).catch(err => toast(err.message)); };
  $('profile-panel').querySelectorAll('.av-em').forEach(b => b.onclick = () => { setAvatarEmblem(b.dataset.ic, +b.dataset.c); sound.uiClick(); renderTopbar(); renderProfile(); });
}

// ---------- Настройки ----------
let refreshHz = 60;
const opt = (key, label, type, extra = {}) => ({ key, label, type, ...extra });
const SETTINGS_TABS = {
  'Графика': [
    { group: 'Общее' },
    opt('preset', 'Пресет качества', 'select', { options: [['low', 'Низкий'], ['medium', 'Средний'], ['high', 'Высокий'], ['ultra', 'Ультра']], apply: (v) => applyPreset(v), note: () => 'Пресет меняет все параметры ниже.' }),
    opt('fpsCap', 'Лимит FPS', 'select', { options: [[30, '30'], [60, '60'], [90, '90'], [120, '120'], [144, '144'], [0, 'Без лимита']], note: () => (refreshHz >= 30 ? `Частота экрана: ~${refreshHz} Гц. ` : '') + '120 FPS — на экранах 120 Гц и выше.' }),
    opt('renderScale', 'Разрешение рендера', 'range', { min: 0.5, max: 1.5, step: 0.05, fmt: v => Math.round(v * 100) + '%' }),
    opt('fov', 'Поле зрения (FOV)', 'range', { min: 60, max: 110, step: 1 }),
    opt('vmFov', 'FOV оружия в руках', 'range', { min: 45, max: 75, step: 1 }),
    { group: 'Детали' },
    opt('shadows', 'Тени', 'select', { options: [['off', 'Выкл'], ['medium', 'Средние'], ['high', 'Высокие'], ['ultra', 'Ультра']] }),
    opt('texQuality', 'Текстуры', 'select', { options: [['low', 'Низкие'], ['high', 'Высокие']] }),
    opt('antialias', 'Сглаживание (MSAA)', 'bool', { note: () => 'Применяется после перезапуска игры.' }),
    opt('grade', 'Цветокоррекция и резкость', 'bool'),
    opt('bloom', 'Свечение (Bloom)', 'bool'),
    opt('ao', 'Затенение (GTAO)', 'bool', { note: () => 'Реалистичные тени в углах. Требовательно к видеокарте.' }),
    opt('effects', 'Эффекты', 'select', { options: [['low', 'Низкие'], ['high', 'Высокие']] }),
    opt('viewDist', 'Дальность прорисовки', 'select', { options: [['low', 'Низкая'], ['high', 'Высокая']] }),
  ],
  'Управление': [
    { group: 'Мышь' },
    opt('sens', 'Чувствительность', 'range', { min: 0.1, max: 5, step: 0.05 }),
    opt('aimSens', 'Множитель при прицеливании', 'range', { min: 0.2, max: 2, step: 0.05 }),
    opt('scopeSens', 'Множитель в оптике', 'range', { min: 0.2, max: 2, step: 0.05 }),
    opt('invertY', 'Инверсия по вертикали', 'bool'),
    { group: 'Поведение' },
    opt('controls', 'Тип управления', 'select', { options: [['auto', 'Авто'], ['touch', 'Сенсор'], ['mouse', 'Мышь и клавиатура']] }),
    opt('aimToggle', 'Прицел нажатием (а не удержанием)', 'bool'),
    opt('autoReload', 'Автоперезарядка', 'bool'),
    { type: 'keys' },
  ],
  'Сенсор': [
    opt('touchSens', 'Чувствительность обзора', 'range', { min: 0.1, max: 5, step: 0.05 }),
    opt('touchAimSens', 'Множитель при прицеливании', 'range', { min: 0.2, max: 2, step: 0.05 }),
    opt('gyro', 'Гироскоп', 'bool', { note: () => 'Поворачивайте телефон для точного прицеливания.' }),
    opt('gyroSens', 'Чувствительность гироскопа', 'range', { min: 0.2, max: 3, step: 0.05 }),
    opt('gyroAimOnly', 'Гироскоп только в прицеле', 'bool'),
    { type: 'button', label: 'Расстановка кнопок', action: () => openLayoutEditor() },
  ],
  'Интерфейс': [
    opt('hudScale', 'Размер интерфейса', 'range', { min: 0.7, max: 1.3, step: 0.05, fmt: v => Math.round(v * 100) + '%' }),
    opt('radarSize', 'Размер радара', 'range', { min: 0.6, max: 1.5, step: 0.05, fmt: v => Math.round(v * 100) + '%' }),
    opt('radarZoom', 'Масштаб радара', 'range', { min: 0.5, max: 2, step: 0.05 }),
    opt('radarRotate', 'Вращать радар', 'bool'),
    opt('showFps', 'Показывать FPS', 'bool'),
    opt('hitmarkers', 'Хитмаркеры', 'bool'),
    opt('damageNumbers', 'Цифры урона', 'bool'),
    opt('killfeed', 'Лента убийств', 'bool'),
    opt('bobbing', 'Покачивание оружия', 'bool'),
  ],
  'Прицел': [
    opt('crosshair.style', 'Стиль', 'select', { options: [['cross', 'Крест'], ['t', 'T-образный'], ['dot', 'Точка'], ['circle', 'Круг']] }),
    opt('crosshair.color', 'Цвет', 'color'),
    opt('crosshair.size', 'Длина линий', 'range', { min: 1, max: 20, step: 1 }),
    opt('crosshair.gap', 'Отступ', 'range', { min: -2, max: 16, step: 1 }),
    opt('crosshair.thick', 'Толщина', 'range', { min: 1, max: 6, step: 1 }),
    opt('crosshair.alpha', 'Прозрачность', 'range', { min: 0.2, max: 1, step: 0.05 }),
    opt('crosshair.dot', 'Точка в центре', 'bool'),
    opt('crosshair.outline', 'Обводка', 'bool'),
    opt('crosshair.dynamic', 'Динамический (разброс)', 'bool'),
    { type: 'preview' },
  ],
  'Звук': [
    opt('volume', 'Общая громкость', 'range', { min: 0, max: 1, step: 0.05, fmt: v => Math.round(v * 100) + '%' }),
    opt('sfxVolume', 'Эффекты', 'range', { min: 0, max: 1, step: 0.05, fmt: v => Math.round(v * 100) + '%' }),
    opt('uiVolume', 'Интерфейс', 'range', { min: 0, max: 1, step: 0.05, fmt: v => Math.round(v * 100) + '%' }),
  ],
  'Игра': [
    { type: 'button', label: 'Сбросить все настройки', action: () => { resetSettings(); hud.applyCrosshair(); renderSettings(); toast('Настройки сброшены'); } },
    { type: 'button', label: 'Сбросить прогресс (профиль)', action: () => { if (confirm('Удалить весь прогресс, скины и валюту?')) { localStorage.removeItem('maxi_profile_v2'); location.reload(); } } },
    { type: 'about' },
  ],
};
let settingsTab = 'Графика';
const getK = (k) => k.split('.').reduce((o, p) => o[p], settings);
const setK = (k, v) => { const parts = k.split('.'); const last = parts.pop(); parts.reduce((o, p) => o[p], settings)[last] = v; };

function renderSettings() {
  const tabs = $('settings-tabs'); tabs.innerHTML = '';
  for (const t of Object.keys(SETTINGS_TABS)) {
    const b = document.createElement('button'); b.textContent = t; b.classList.toggle('on', t === settingsTab);
    b.onclick = () => { settingsTab = t; sound.uiClick(); renderSettings(); };
    tabs.appendChild(b);
  }
  if (game) { const back = document.createElement('button'); back.textContent = '‹ Назад к игре'; back.onclick = () => { $('menu').classList.add('hidden'); $('pause').classList.remove('hidden'); }; tabs.appendChild(back); }
  const body = $('settings-body'); body.innerHTML = '';
  for (const item of SETTINGS_TABS[settingsTab]) {
    if (item.group) { const g = document.createElement('div'); g.className = 'set-group'; g.textContent = item.group; body.appendChild(g); continue; }
    const row = document.createElement('div'); row.className = 'set-row';
    if (item.type === 'button') {
      const b = document.createElement('button'); b.className = 'act'; b.textContent = item.label; b.onclick = item.action; row.appendChild(b);
    } else if (item.type === 'preview') {
      row.innerHTML = '<label>Предпросмотр</label><div class="ch-preview"><div class="crosshair" id="ch-prev"><i class="t"></i><i class="b"></i><i class="l"></i><i class="r"></i><i class="d"></i></div></div>';
    } else if (item.type === 'keys') {
      row.innerHTML = `<div class="hint" style="line-height:2"><kbd>WASD</kbd> движение · <kbd>ЛКМ</kbd> огонь · <kbd>ПКМ</kbd> прицел · <kbd>R</kbd> перезарядка · <kbd>Пробел</kbd> прыжок · <kbd>Ctrl</kbd> присед · <kbd>Shift</kbd> шаг · <kbd>1-5</kbd> оружие/гранаты/бомба · <kbd>Q</kbd> прошлое оружие · <kbd>B</kbd> закупка · <kbd>E</kbd> заложить/обезвредить · <kbd>G</kbd> бросить бомбу · <kbd>F</kbd> осмотр · <kbd>Tab</kbd> счёт · <kbd>Esc</kbd> пауза</div>`;
    } else if (item.type === 'about') {
      row.innerHTML = `<div class="hint" style="line-height:1.7">MAXI STRIKE · браузерный тактический шутер.<br>Ассеты: модели оружия Flat Guns, текстуры ambientCG, HDRI Poly Haven, звуки Free Firearm Sound Library — CC0. Персонаж — из примеров three.js.</div>`;
    } else {
      const lab = document.createElement('label'); lab.textContent = item.label; row.appendChild(lab);
      const v = getK(item.key);
      if (item.type === 'range') {
        const inp = document.createElement('input'); Object.assign(inp, { type: 'range', min: item.min, max: item.max, step: item.step, value: v });
        const val = document.createElement('span'); val.className = 'val';
        const fmt = item.fmt || ((x) => (+x).toFixed(item.step < 1 ? 2 : 0));
        val.textContent = fmt(+v);
        inp.oninput = () => { setK(item.key, +inp.value); val.textContent = fmt(+inp.value); onSettingChanged(item.key); };
        row.append(inp, val);
      } else if (item.type === 'bool') {
        const t = document.createElement('button'); t.className = 'toggle' + (v ? ' on' : '');
        t.onclick = () => { setK(item.key, !getK(item.key)); t.classList.toggle('on'); sound.uiClick(); onSettingChanged(item.key); };
        row.appendChild(t);
      } else if (item.type === 'color') {
        const inp = document.createElement('input'); inp.type = 'color'; inp.value = v;
        inp.oninput = () => { setK(item.key, inp.value); onSettingChanged(item.key); };
        row.appendChild(inp);
      } else if (item.type === 'select') {
        const seg = document.createElement('div'); seg.className = 'seg';
        for (const [val, label] of item.options) {
          const b = document.createElement('button'); b.textContent = label; b.classList.toggle('on', v === val);
          b.onclick = () => { if (item.apply) item.apply(val); else setK(item.key, val); if (item.key !== 'preset') settings.preset = 'custom'; onSettingChanged(item.key); sound.uiClick(); renderSettings(); };
          seg.appendChild(b);
        }
        row.appendChild(seg);
      }
      if (item.note) { const n = document.createElement('div'); n.className = 'note'; n.textContent = item.note(); row.appendChild(n); }
    }
    body.appendChild(row);
  }
  if (settingsTab === 'Прицел') updateCrossPreview();
}
function updateCrossPreview() {
  const el = $('ch-prev'); if (!el) return;
  const c = settings.crosshair;
  el.style.setProperty('--ch-color', c.color); el.style.setProperty('--ch-size', c.size + 'px');
  el.style.setProperty('--ch-thick', c.thick + 'px'); el.style.setProperty('--ch-gap', c.gap + 'px');
  el.style.setProperty('--ch-outline', c.outline ? '0 0 0 1px rgba(0,0,0,.8)' : 'none');
  el.style.opacity = c.alpha ?? 1;
  el.className = 'crosshair ' + (c.dot ? 'dot ' : '') + 'style-' + (c.style || 'cross');
}
let saveTimer = 0;
function onSettingChanged(key) {
  clearTimeout(saveTimer); saveTimer = setTimeout(saveSettings, 200);
  hud.applyCrosshair(); updateCrossPreview();
  if (key.startsWith('volume') || key.endsWith('Volume')) sound.setVolume();
  if (['renderScale', 'quality', 'preset'].includes(key)) { applyPixelRatio(); renderer.setSize(innerWidth, innerHeight, false); if (game) game.resize(innerWidth, innerHeight); }
  if (key === 'fov' && game) game.curFov = settings.fov;
  if (key === 'vmFov' && game) { game.vm.camera.fov = settings.vmFov; game.vm.camera.updateProjectionMatrix(); }
  if (key === 'gyro') input.enableGyro(settings.gyro);
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
  $('le-presets').innerHTML = Object.entries(LAYOUT_PRESETS).map(([k, p]) => `<button data-pre="${k}">${p.name}</button>`).join('');
  $('le-presets').querySelectorAll('[data-pre]').forEach(b => b.onclick = () => { leLayout = JSON.parse(JSON.stringify(LAYOUT_PRESETS[b.dataset.pre].layout)); leSel = null; $('le-firel').checked = leLayout.fireL.enabled !== false; renderLayoutEditor(); toast('Раскладка: ' + LAYOUT_PRESETS[b.dataset.pre].name); });
  const area = $('le-area'); area.innerHTML = '';
  for (const [name, l] of Object.entries(leLayout)) {
    if (name === 'fireL' && l.enabled === false) continue;
    const el = document.createElement('div');
    el.className = 'tbtn' + (name === 'joystick' ? ' joy' : '') + (leSel === name ? ' sel' : '');
    el.dataset.btn = name;
    Object.assign(el.style, { left: l.x + '%', top: l.y + '%', width: l.size + 'px', height: l.size + 'px', opacity: Math.max(0.35, l.opacity) });
    el.innerHTML = (name === 'joystick' ? '<div class="knob"></div>' : BTN_ICONS[name] || '') + `<span class="lbl">${BUTTON_LABELS[name]}</span>`;
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault(); el.setPointerCapture(e.pointerId);
      selectLe(name);
      const move = (ev) => { l.x = Math.max(2, Math.min(98, ev.clientX / innerWidth * 100)); l.y = Math.max(2, Math.min(98, ev.clientY / innerHeight * 100)); el.style.left = l.x + '%'; el.style.top = l.y + '%'; };
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
  $('le-size').value = leLayout[name].size; $('le-opacity').value = leLayout[name].opacity;
}
$('le-size').oninput = () => { if (!leSel) return; leLayout[leSel].size = +$('le-size').value; const el = document.querySelector(`#le-area [data-btn=${leSel}]`); el.style.width = el.style.height = leLayout[leSel].size + 'px'; };
$('le-opacity').oninput = () => { if (!leSel) return; leLayout[leSel].opacity = +$('le-opacity').value; };
$('le-firel').onchange = () => { leLayout.fireL.enabled = $('le-firel').checked; renderLayoutEditor(); };
$('le-reset').onclick = () => { leLayout = JSON.parse(JSON.stringify(DEFAULT_LAYOUT)); leSel = null; $('le-firel').checked = true; renderLayoutEditor(); };
$('le-cancel').onclick = () => $('layout-editor').classList.add('hidden');
$('pause-layout').onclick = () => openLayoutEditor();
$('le-save').onclick = () => { settings.layout = leLayout; saveSettings(); $('layout-editor').classList.add('hidden'); if (game) input.buildTouchUI($('touch-ui')); toast('Расстановка сохранена'); };

// ---------- Меню закупки ----------
let buyCat = 'rifle';
const BUY_CATS = [['pistol', 'Пистолеты'], ['smg', 'ПП'], ['rifle', 'Винтовки'], ['sniper', 'Снайперские'], ['shotgun', 'Дробовики'], ['grenade', 'Гранаты'], ['gear', 'Снаряжение']];
function isBuyOpen() { return !$('buy-menu').classList.contains('hidden'); }
function toggleBuy(force) {
  if (!game) return;
  const open = force !== undefined ? force : !isBuyOpen();
  if (open && !game.canBuy(game.player)) { if (game.mode === 'defuse') hud.center('ЗАКУПКА НЕДОСТУПНА', 1.2); return; }
  $('buy-menu').classList.toggle('hidden', !open);
  if (open) { input.exitLock(); renderBuy(); }
  else if (!input.touch && game && !game.paused) input.requestLock();
}
function renderBuy() {
  if (!game) return;
  const p = game.player;
  $('buy-money').textContent = '$' + p.money;
  $('buy-time').textContent = game.buyLeft > 0 ? `Осталось ${Math.ceil(game.buyLeft)} с` : '';
  $('buy-cats').innerHTML = BUY_CATS.map(([k, n]) => `<button data-k="${k}" class="${buyCat === k ? 'on' : ''}">${n}</button>`).join('');
  $('buy-cats').querySelectorAll('button').forEach(b => b.onclick = () => { buyCat = b.dataset.k; renderBuy(); });
  let items = [];
  if (CAT_ORDER.includes(buyCat)) items = Object.values(WEAPONS).filter(w => w.cat === buyCat && (!w.team || w.team === p.team)).map(w => ({ id: w.id, name: w.name, price: w.price, icon: iconImg(w.id), sub: `${w.damage}${w.pellets ? '×' + w.pellets : ''} урона · ${w.rpm} в/м`, owned: p.inv.primary === w.id || p.inv.secondary === w.id }));
  else if (buyCat === 'grenade') items = Object.values(GRENADES).map(g => ({ id: g.id, name: g.name, price: g.price, icon: iconImg(g.id), sub: `Максимум ${g.max} · есть ${p.inv.grenades[g.id]}`, owned: p.inv.grenades[g.id] >= g.max }));
  else items = [
    { id: 'kevlar', name: 'Бронежилет', price: 650, icon: '<div class="gi">🦺</div>', sub: 'Броня 100', owned: p.armor >= 100 },
    { id: 'helmet', name: 'Бронежилет + шлем', price: p.armor >= 100 ? 350 : 1000, icon: '<div class="gi">⛑️</div>', sub: 'Защита головы', owned: p.helmet && p.armor >= 100 },
    ...(p.team === 'A' ? [{ id: 'defuse', name: 'Набор сапёра', price: 400, icon: '<div class="gi">🧰</div>', sub: 'Разминирование за 5 с', owned: p.defuseKit }] : []),
  ];
  $('buy-items').innerHTML = items.map(it => `<button class="bitem ${p.money < it.price ? 'no' : ''} ${it.owned ? 'owned' : ''}" data-id="${it.id}">${it.icon}<b>${it.name}</b><small>${it.sub}</small><span class="price">$${it.price}</span></button>`).join('');
  $('buy-items').querySelectorAll('.bitem').forEach(b => b.onclick = () => { if (game.buy(p, b.dataset.id)) renderBuy(); else { sound.click(); } });
}
$('buy-close').onclick = () => toggleBuy(false);

// ---------- Матч ----------
// Экран загрузки: шкала, проценты, советы, превью карты
const TIPS = ['Стреляйте короткими очередями — разброс растёт с каждой пулей.', 'В прыжке и на бегу точность сильно падает.', 'Присед уменьшает разброс и делает вас тише.', 'Покупайте броню раньше оружия — она спасает от хедшотов.', 'Дымовая граната перекрывает обзор снайперу на 15 секунд.', 'Слушайте шаги: тихий шаг (Shift) не слышен противнику.', 'Нож в спину наносит смертельный урон.', 'Закладка на точке B дальше от спавна спецназа — используйте это.', 'Агентов и скины можно надеть в инвентаре — их видно в лобби и в бою.', 'Кланы получают опыт за каждый матч их участников.'];
let tipTimer = 0;
function setLoad(w) { const v = typeof w === 'string' ? parseFloat(w) : w; $('load-fill').style.width = v + '%'; $('ld-pct').textContent = Math.round(v) + '%'; }
function loadingFor(mapId, modeName) {
  const art = $('ld-art'), th = mapId && mapThumbs[mapId];
  if (th && th.length > 30) { art.style.backgroundImage = `url(${th})`; art.classList.add('has'); } else { art.style.backgroundImage = ''; art.classList.remove('has'); }
  $('ld-map').textContent = mapId && MAPS[mapId] ? MAPS[mapId].name : '';
  $('ld-mode').textContent = modeName || '';
  const showTip = () => { $('ld-tip').textContent = TIPS[Math.floor(Math.random() * TIPS.length)]; };
  showTip(); clearInterval(tipTimer); tipTimer = setInterval(showTip, 4500);
}

let pendingClanWar = null;
function startClanWar(opp) {
  const c = profile.clan; if (!c || !opp) return;
  const ally = [...(c.members || []).filter(m => m.online).map(m => m.name), ...(c.members || []).map(m => m.name)];
  pendingClanWar = { opp, cfg: { mode: 'defuse', rounds: 12, perTeam: 5, side: 'auto', difficulty: cwDifficulty(opp), clanWar: { ally: { tag: c.tag, names: [...new Set(ally)] }, enemy: { tag: opp.tag, name: opp.name, names: opp.roster } } } };
  toast(`Клановая битва: [${c.tag}] против [${opp.tag}] ${opp.name}`);
  startMatch();
}

async function startMatch() {
  sound.init();
  disposeLobbyMap();
  if (game) { game.dispose(); game = null; }
  $('menu').classList.add('hidden');
  ['pause', 'end', 'modal'].forEach(id => $(id).classList.add('hidden'));
  $('load-text').textContent = 'Загрузка карты…'; setLoad('10%');
  loadingFor(settings.match.map, pendingClanWar ? `Клановая битва · [${profile.clan.tag}] vs [${pendingClanWar.opp.tag}]` : (MODES[settings.match.mode] || {}).name);
  $('loading').classList.remove('hidden');
  await nextFrame();
  const m = settings.match;
  await prepareMap(m.map, (p) => { setLoad((20 + p * 60) + '%'); });
  const hdri = await loadHDRI(MAPS[m.map].hdri);
  applyPixelRatio();
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.shadowMap.enabled = settings.shadows !== 'off';
  input.touch = isTouchMode();
  input.reset(); input.enabled = true;
  input.enableGyro(settings.gyro);
  $('hud').classList.toggle('touch', input.touch); document.body.classList.toggle('is-touch', input.touch);
  input.buildTouchUI($('touch-ui'));
  hud.applyCrosshair();
  settings.matchName = clanTag() + (settings.nickname || 'Player');
  const cw = pendingClanWar; pendingClanWar = null;
  const cfg = cw ? { ...m, ...cw.cfg, cwOpp: cw.opp } : m.mode === 'ranked' ? { ...m, mode: 'defuse', ranked: true, rounds: 12, perTeam: 5, side: 'auto', difficulty: rankOf(profile.rating || 0).bots } : { ...m };
  game = new Game(renderer, input, hud, cfg, { onEnd: onMatchEnd, onBuyMenu: () => toggleBuy(), isBuyOpen }, hdri);
  hud.setMoney(cfg.mode === 'defuse' ? game.player.money : null);
  game.resize(innerWidth, innerHeight);
  await texturesReady();
  game.update(0.001); game.render();
  setLoad('100%');
  hud.show(true);
  $('loading').classList.add('hidden');
  if (input.touch) { try { document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }).catch(() => {}); } catch (e) { /* ignore */ } }
  else input.requestLock();
}
$('start-btn').onclick = startMatch;

function pauseGame() {
  if (!game || game.over || game.paused) return;
  if (isBuyOpen()) { toggleBuy(false); return; }
  game.paused = true;
  input.reset();
  $('pause').classList.remove('hidden');
  $('pause-hint').textContent = input.touch ? '' : 'Esc — пауза · Tab — счёт · B — закупка · E — бомба';
}
input.onPause = pauseGame;
function resumeGame() {
  if (!game) return;
  $('pause').classList.add('hidden'); $('menu').classList.add('hidden');
  game.paused = false;
  input.reset(); input.enabled = true;
  hud.applyCrosshair();
  if (!input.touch) input.requestLock();
}
$('resume-btn').onclick = resumeGame;
$('pause-settings').onclick = () => { $('pause').classList.add('hidden'); $('menu').classList.remove('hidden'); settingsTab = 'Графика'; screen = 'settings'; document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === 'screen-settings')); renderSettings(); };
$('quit-btn').onclick = () => quitToMenu();

function quitToMenu() {
  if (game) { game.dispose(); game = null; }
  input.enabled = false; input.reset(); input.exitLock();
  hud.show(false);
  ['pause', 'end', 'buy-menu'].forEach(id => $(id).classList.add('hidden'));
  $('menu').classList.remove('hidden');
  renderer.shadowMap.enabled = true;
  goto('play');
  setLobbyMap(settings.match.map);
}

function onMatchEnd({ win, draw, earned, xp, player, game: g }) {
  input.enabled = false; input.exitLock();
  toggleBuy(false);
  const before = levelInfo(profile.xp || 0).level;
  profile.credits += earned * 10;
  profile.xp = (profile.xp || 0) + xp;
  const after = levelInfo(profile.xp).level;
  const lvlReward = after > before ? (after - before) : 0;
  if (lvlReward) { profile.gold += 50 * lvlReward; profile.cases.field = (profile.cases.field || 0) + lvlReward; }
  profile.passXp = (profile.passXp || 0) + xp;
  const clanXp = clanMatchXp(!!win, player ? player.kills : 0);
  let rankHtml = clanXp ? `<div class="hint" style="margin-top:6px">Клан [${esc(profile.clan.tag)}]: +${clanXp} опыта</div>` : '';
  if (g.cfg.clanWar && g.cfg.cwOpp && profile.clan) {
    const sc = `${g.score[player.team]}:${g.score[player.team === 'A' ? 'B' : 'A']}`;
    const r = cwApply(g.cfg.cwOpp, !!win, !!draw, sc);
    if (win) { profile.credits += 400; clanMatchXp(true, 15); const w = profile.clan.cw.wins; if (w % 3 === 0) { profile.cases.clan = (profile.cases.clan || 0) + 1; } }
    if (r) rankHtml += `<div class="rank-box" style="justify-content:center"><div style="text-align:center"><div class="hint">Клановая битва против [${esc(g.cfg.cwOpp.tag)}] ${esc(g.cfg.cwOpp.name)}</div><b style="color:${cwLeague(r.rating).color}">${cwLeague(r.rating).name} · ${r.rating} CWR</b><div class="rank-delta ${r.delta >= 0 ? 'up' : 'down'}">${r.delta >= 0 ? '+' : ''}${r.delta} CWR</div>${win ? '<div class="hint">+400 ₴ · +150 опыта клану' + (profile.clan.cw.wins % 3 === 0 ? ' · клановый кейс!' : '') + '</div>' : ''}</div></div>`;
  }
  if (g.cfg.ranked) {
    const before = profile.rating || 0;
    const perf = Math.min(10, player.kills) + Math.min(5, player.assists);
    const delta = draw ? 3 : win ? 20 + Math.round(perf * 0.8) : -Math.max(12, 26 - Math.round(perf * 0.8));
    profile.rating = Math.max(0, before + delta);
    profile.rankedPlayed = (profile.rankedPlayed || 0) + 1; if (win) profile.rankedWins = (profile.rankedWins || 0) + 1;
    profile.bestRating = Math.max(profile.bestRating || 0, profile.rating);
    const r0 = rankOf(before), r1 = rankOf(profile.rating);
    rankHtml += `<div class="rank-box" style="justify-content:center">${rankBadge(profile.rating, 72)}<div style="text-align:left"><b style="color:${r1.color}">${r1.name}</b><div class="rank-delta ${delta >= 0 ? 'up' : 'down'}">${delta >= 0 ? '+' : ''}${delta} RP</div>${r0.name !== r1.name ? `<div class="hint">${r1.tier > r0.tier || (r1.tier === r0.tier && r1.div < r0.div) ? 'Повышение звания!' : 'Понижение звания'}</div>` : ''}</div></div>`;
  }
  const st = profile.stats;
  st.kills += player.kills; st.deaths += player.deaths; st.headshots += player.headshots; st.matches++; st.damage = (st.damage || 0) + player.damage; if (win) st.wins++;
  profile.history = [...(profile.history || []), { win, draw, mode: g.mode, map: g.cfg.map, k: player.kills, d: player.deaths, score: g.mode === 'defuse' || g.mode === 'tdm' ? `${g.score[player.team]}:${g.score[player.team === 'A' ? 'B' : 'A']}` : '' }].slice(-30);
  saveProfile();
  $('end-title').textContent = draw ? 'Ничья' : win ? 'Победа' : 'Поражение';
  $('end-title').style.color = draw ? '#ddd' : win ? 'var(--ok)' : 'var(--danger)';
  $('end-score').innerHTML = g.mode === 'ffa' || g.mode === 'gungame' ? `Место: ${g.ranking().indexOf(player) + 1} из ${g.actors.length}`
    : `<span style="color:var(--a)">${g.score[player.team]}</span> : <span style="color:var(--b)">${g.score[player.team === 'A' ? 'B' : 'A']}</span>`;
  const kd = (player.kills / Math.max(1, player.deaths)).toFixed(2);
  $('end-stats').innerHTML = rankHtml + `<div class="end-stats"><div>Убийства<b>${player.kills}</b></div><div>Ассисты<b>${player.assists}</b></div><div>Смерти<b>${player.deaths}</b></div><div>K/D<b>${kd}</b></div><div>Урон<b>${Math.round(player.damage)}</b></div></div>
    <div class="reward">Награда: <span style="color:var(--cr)">◈ ${earned * 10}</span> · <span style="color:var(--accent2)">+${xp} опыта</span>${lvlReward ? ` · <span style="color:var(--gold)">Новый уровень! +● ${50 * lvlReward} и кейс</span>` : ''}</div>`;
  $('end').classList.remove('hidden');
  renderTopbar();
}
$('end-again').onclick = startMatch;
$('end-menu').onclick = quitToMenu;

// ---------- Цикл ----------
let last = performance.now(), lastFrame = 0, fpsAcc = 0, fpsN = 0, fps = 0;
const hzSamples = [];
function frame(now) {
  requestAnimationFrame(frame);
  fxTime.value = now / 1000;
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
    if (isBuyOpen()) { if (!game.canBuy(game.player)) toggleBuy(false); else if ((now | 0) % 10 === 0) { $('buy-money').textContent = '$' + game.player.money; $('buy-time').textContent = `Осталось ${Math.ceil(game.buyLeft)} с`; } }
  } else { pumpItemImages(2); if (lobby.char) renderLobby(dt); }
}
window.addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight, false); if (game) game.resize(innerWidth, innerHeight); });

// ---------- Старт ----------
// Ники и кланы — латиницей (перевод старых сохранений)
function migrateLatin() {
  if (!settings.nickname || settings.nickname === 'Player' || /[^A-Za-z0-9_.\-]/.test(settings.nickname)) { settings.nickname = 'Player' + (1000 + Math.floor(Math.random() * 9000)); saveSettings(); }
  const c = profile.clan;
  if (c && /[^\x20-\x7e]/.test(c.name + c.motto)) {
    const k = CLAN_LIST.find(x => x.tag === c.tag);
    if (k) { c.name = k.name; c.motto = k.motto; } else { c.name = c.name.replace(/[^\x20-\x7e]/g, '').trim() || c.tag; c.motto = ''; }
    c.log = (c.log || []).filter(l => !/[^\x20-\x7e]/.test(l.text));
    for (const m of c.members || []) if (/[^\x20-\x7e]/.test(m.name)) m.name = 'Soldier' + Math.floor(Math.random() * 99);
    saveProfile();
  }
}

async function boot() {
  migrateLatin();
  initRegistry().then(ok => { if (ok) claimName('nick', settings.nickname).then(r => { if (!r.ok) toast(`Ник «${settings.nickname}» занят другим игроком — смените его в профиле`); }); });
  const lt = $('load-text');
  loadingFor(null, ''); $('ld-tip').textContent = '';
  lt.textContent = 'Загрузка моделей и звуков…';
  await loadCore((p) => { setLoad((p * 70) + '%'); });
  lt.textContent = 'Подготовка оружия…'; await nextFrame();
  buildWeaponIcons(renderer);
  initItemRenderer(renderer);
  lt.textContent = 'Подготовка лобби…'; setLoad('78%');
  await buildLobby();
  try { Object.assign(mapThumbs, JSON.parse(localStorage.getItem(THUMB_KEY) || '{}')); } catch (e) { /* ignore */ }
  setLoad('100%');
  if (settings.match.side && settings.match.side !== 'auto') setLobbyTeam(settings.match.side);
  lt.textContent = 'Подготовка лобби…';
  if (!MAPS[settings.match.map] || MAPS[settings.match.map].hidden) settings.match.map = 'factory';
  await setLobbyMap(settings.match.map);
  goto('play');
  $('loading').classList.add('hidden');
  if (dailyAvailable()) setTimeout(() => toast('Доступна ежедневная награда — загляните в магазин'), 1200);
  requestAnimationFrame(frame);
  setTimeout(fillThumbs, 1500);
}

// Превью карт догружаются в фоне и кэшируются
const THUMB_KEY = 'maxi_thumbs_v4';
async function fillThumbs() {
  for (const id of Object.keys(MAPS)) {
    if (mapThumbs[id] || MAPS[id].hidden) continue;
    while (game) await new Promise(r => setTimeout(r, 2000));
    try { await renderMapThumb(id); } catch (e) { console.error(e); continue; }
    try { localStorage.setItem(THUMB_KEY, JSON.stringify(mapThumbs)); } catch (e) { /* ignore */ }
    const card = document.querySelector(`.map-card[data-map="${id}"] .thumb`);
    if (card && card.tagName !== 'IMG') { const img = document.createElement('img'); img.className = 'thumb'; img.src = mapThumbs[id]; card.replaceWith(img); }
    await new Promise(r => setTimeout(r, 400));
  }
}
boot().catch(e => { console.error(e); $('load-text').textContent = 'Ошибка загрузки: ' + e.message; });

window.__maxi = { get game() { return game; }, settings, profile, A, quit: () => quitToMenu() };
