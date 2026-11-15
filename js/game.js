// Матч: режимы, раунды, экономика, бомба, гранаты, стрельба, урон.
import * as THREE from 'three';
import { buildMap, nearestFree, cellCenter } from './maps.js';
import { moveBody, raycastWorld, rayBox, blockedAt, lineOfSight } from './physics.js';
import { WEAPONS, KNIVES, KNIFE_STATS, GRENADES, ECON, GUNGAME_ORDER, SKINS } from './data.js';
import { buildWeaponModel } from './weapons.js';
import { CharacterModel } from './character.js';
import { ViewModel } from './viewmodel.js';
import { Effects } from './effects.js';
import { makeBrain, updateBot, hearShot, botBuy } from './bots.js';
import { profile, equippedSkin } from './skins.js';
import { settings } from './settings.js';
import { sound } from './audio.js';
import { setupAtmosphere, followShadow, Pipeline } from './render.js';

const BOT_NAMES = ['Ястреб', 'Гром', 'Тень', 'Кобра', 'Север', 'Шаман', 'Бизон', 'Фантом', 'Рысь', 'Дизель', 'Вектор', 'Призрак', 'Медведь', 'Сокол', 'Танкист', 'Буран', 'Жук', 'Кэп', 'Волк', 'Сапёр', 'Ворон', 'Гюрза', 'Сармат', 'Кречет'];
const RUN_SPEED = 5.6;
const EYE = 1.62;
const TEAM_NAME = { A: 'Спецназ', B: 'Наёмники' };
const isGrenade = (id) => id === 'he' || id === 'flash' || id === 'smoke';

export function weaponStats(id) {
  if (WEAPONS[id]) return WEAPONS[id];
  if (KNIVES[id]) return { id, name: KNIVES[id].name, cat: 'knife', melee: true, damage: KNIFE_STATS.damage, rpm: KNIFE_STATS.rpm, range: KNIFE_STATS.range, speed: KNIFE_STATS.speed, auto: true, mag: 0, reserve: 0, recoil: 0, sound: 'knife', reward: ECON.knife, spread: 0, moveSpread: 0, bloom: 0, maxBloom: 0, headMul: 1.5, legMul: 1, pen: 1 };
  if (isGrenade(id)) return { id, name: GRENADES[id].name, cat: 'grenade', throwable: true, rpm: 60, speed: 1.05, mag: 0, reserve: 0, recoil: 0, spread: 0, moveSpread: 0, bloom: 0, maxBloom: 0, reward: 300 };
  if (id === 'bomb') return { id, name: 'Бомба', cat: 'bomb', rpm: 60, speed: 1.0, mag: 0, reserve: 0, recoil: 0, spread: 0, moveSpread: 0, bloom: 0, maxBloom: 0 };
  return WEAPONS.p9;
}

function buildBombModel() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.09, 0.15), new THREE.MeshStandardMaterial({ color: 0x3b3a33, roughness: 0.7 }));
  g.add(body);
  for (let i = 0; i < 3; i++) { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.2, 10), new THREE.MeshStandardMaterial({ color: 0x8a5a2a, roughness: 0.6 })); t.rotation.z = Math.PI / 2; t.position.set(0, 0.06, -0.045 + i * 0.045); g.add(t); }
  const pad = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.02, 0.07), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4 })); pad.position.set(0.04, 0.1, 0); g.add(pad);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.025), new THREE.MeshBasicMaterial({ color: 0xff3020 })); scr.rotation.x = -Math.PI / 2; scr.position.set(0.04, 0.111, 0.01); g.add(scr);
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2020 })); led.position.set(-0.07, 0.1, 0.04); g.add(led);
  g.userData.led = led;
  for (const w of [[0.02, 0.03], [-0.03, 0.05]]) { const wire = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.004, 6, 12, Math.PI), new THREE.MeshStandardMaterial({ color: w[0] > 0 ? 0xc0392b : 0x2980b9 })); wire.position.set(w[0], 0.06, w[1]); g.add(wire); }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}

export class Game {
  constructor(renderer, input, hud, cfg, callbacks, hdri) {
    this.renderer = renderer; this.input = input; this.hud = hud; this.cfg = cfg; this.cb = callbacks;
    this.mode = cfg.mode;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(settings.fov, innerWidth / innerHeight, 0.05, settings.viewDist === 'low' ? 250 : 1000);
    this.camera.rotation.order = 'YXZ';
    this.map = buildMap(this.scene, cfg.map, settings.quality);
    this.colliders = this.map.colliders;
    this.nav = this.map.nav;
    this.atmo = setupAtmosphere(renderer, this.scene, this.map.def, settings.quality, hdri);
    if (settings.viewDist === 'low') this.scene.fog.density *= 1.8;
    this.effects = new Effects(this.scene);
    this.vm = new ViewModel();
    this.vm.camera.fov = settings.vmFov || 58;
    this.vm.setEnvironment(this.atmo.env, this.map.def.sun, 0.55);
    this.pipeline = new Pipeline(renderer);
    this.pipeline.setup(this.scene, this.camera, this.vm.scene, this.vm.camera, this.atmo.exposure);
    this.time = 0;
    this.timeLeft = (cfg.minutes || 8) * 60;
    this.score = { A: 0, B: 0 };
    this.actors = [];
    this.projectiles = [];
    this.smokes = [];
    this.over = false; this.paused = false;
    this.curFov = settings.fov;
    this.recoilPunch = 0;
    this.stepT = 0;
    this.earned = 0; this.xpEarned = 0;
    this.multi = 0; this.lastKillT = -9;
    this.flashAlpha = 0;
    this.tmpV = new THREE.Vector3();
    this.round = 0; this.roundState = 'none'; this.roundTimer = 0; this.buyLeft = 0; this.freezeLeft = 0;
    this.lossStreak = { A: 0, B: 0 };
    this.half = Math.floor((cfg.rounds || 12) / 2);
    this.winRounds = this.half + 1;
    this.bomb = null;
    this.bombMesh = buildBombModel();
    this.bombMesh.visible = false;
    this.scene.add(this.bombMesh);
    this.roundStats = [];

    this.createActors();
    this.hud.buildMinimapBase(this.map);
    if (this.mode === 'defuse') this.startRound(true);
    else for (const a of this.actors) this.respawn(a, true);
    this.equipPlayerView();
    this.updateHudStatic();
    this.warmup();
    const goal = { defuse: `до ${this.winRounds} побед`, tdm: `до ${cfg.killsToWin}`, ffa: `FFA · до ${cfg.killsToWin}`, gungame: 'Гонка вооружений' }[this.mode];
    this.hud.setGoal(goal);
  }

  warmup() {
    const hidden = [];
    const show = (o) => o.traverse(c => { if (!c.visible) { hidden.push(c); c.visible = true; } });
    show(this.scene); show(this.vm.scene);
    try { this.renderer.compile(this.scene, this.camera); this.renderer.compile(this.vm.scene, this.vm.camera); } catch (e) { /* ignore */ }
    for (const c of hidden) c.visible = false;
  }

  // ---------- создание ----------
  createActors() {
    const { mode, perTeam, difficulty } = this.cfg;
    const names = [...BOT_NAMES].sort(() => Math.random() - 0.5);
    let ni = 0, ffa = 0;
    const playerTeam = this.cfg.side === 'B' ? 'B' : this.cfg.side === 'A' ? 'A' : (Math.random() < 0.5 ? 'A' : 'B');
    const mk = (team, isPlayer) => {
      const a = {
        id: this.actors.length, name: isPlayer ? (settings.nickname || 'Игрок') : names[ni++ % names.length], team, isPlayer,
        pos: new THREE.Vector3(), vel: new THREE.Vector3(), yaw: 0, pitch: 0,
        radius: 0.35, height: 1.8, onGround: true, crouchT: 0,
        health: 100, armor: 0, helmet: false, defuseKit: false, alive: false,
        kills: 0, deaths: 0, assists: 0, headshots: 0, score: 0, damage: 0, money: ECON.start, mvp: 0,
        inv: { primary: null, secondary: null, knife: 'knife', grenades: { he: 0, flash: 0, smoke: 0 }, bomb: false },
        slot: 'secondary', lastSlot: 'knife', grenadeSel: 'he', ammo: {},
        nextFire: 0, reloadUntil: 0, switchUntil: 0, bloom: 0, shotsInRow: 0, triggerHeld: false,
        respawnAt: 0, protectUntil: 0, spottedUntil: 0, killer: null, dmgFrom: new Map(),
        flashUntil: 0, flashStart: 0, plantT: 0, defuseT: 0, ggLevel: 0,
        ffaIndex: mode === 'ffa' ? ffa++ : -1,
      };
      if (isPlayer) a.inv.knife = profile.knife || 'knife';
      else a.inv.knife = Math.random() < 0.15 ? ['bayonet', 'karambit', 'butterfly', 'kukri', 'dagger'][Math.floor(Math.random() * 5)] : 'knife';
      if (!isPlayer) {
        a.brain = makeBrain(difficulty);
        a.model = new CharacterModel(team === 'F' ? (a.ffaIndex % 2 ? 'B' : 'A') : team, a.ffaIndex);
        this.scene.add(a.model.root);
      }
      this.actors.push(a);
      return a;
    };
    if (mode === 'ffa') {
      this.player = mk('F', true);
      for (let i = 0; i < perTeam * 2 - 1; i++) mk('F', false);
    } else {
      this.player = mk(playerTeam, true);
      const other = playerTeam === 'A' ? 'B' : 'A';
      for (let i = 0; i < perTeam - 1; i++) mk(playerTeam, false);
      for (let i = 0; i < perTeam; i++) mk(other, false);
    }
  }

  isEnemy(a, b) { return a !== b && (a.team === 'F' || a.team !== b.team); }
  eyePos(a) { return { x: a.pos.x, y: a.pos.y + EYE - a.crouchT * 0.4, z: a.pos.z }; }
  heldId(a) {
    switch (a.slot) {
      case 'primary': return a.inv.primary;
      case 'secondary': return a.inv.secondary;
      case 'grenade': return a.grenadeSel;
      case 'bomb': return 'bomb';
      default: return a.inv.knife;
    }
  }
  get playerTeamLabel() { return this.player.team; }

  spot(e, by) {
    if (!this.isEnemy(this.player, e)) return;
    if (this.mode === 'ffa' && by !== this.player) return;
    if (by === this.player || by.team === this.player.team) e.spottedUntil = this.time + 1.2;
  }

  skinFor(a, id) {
    if (a.isPlayer) return equippedSkin(id);
    if (!a.skins) a.skins = {};
    if (!(id in a.skins)) {
      const list = Object.values(SKINS).filter(s => s.weapon === id);
      a.skins[id] = list.length && Math.random() < 0.4 ? list[Math.floor(Math.random() * list.length)] : null;
    }
    return a.skins[id];
  }

  // ---------- инвентарь ----------
  giveWeapon(a, id, select = true) {
    const w = WEAPONS[id]; if (!w) return;
    const slot = w.cat === 'pistol' ? 'secondary' : 'primary';
    a.inv[slot] = id;
    a.ammo[id] = { mag: w.mag, res: w.reserve };
    if (select) this.selectSlot(a, slot, true);
    else if (a.isPlayer) this.hud.setSlots(a);
  }

  selectSlot(a, slot, force = false) {
    if (slot === 'primary' && !a.inv.primary) return;
    if (slot === 'secondary' && !a.inv.secondary) return;
    if (slot === 'grenade') {
      const types = ['he', 'flash', 'smoke'].filter(t => a.inv.grenades[t] > 0);
      if (!types.length) return;
      if (a.slot === 'grenade' && !force) a.grenadeSel = types[(types.indexOf(a.grenadeSel) + 1) % types.length];
      else if (!types.includes(a.grenadeSel)) a.grenadeSel = types[0];
    }
    if (slot === 'bomb' && !a.inv.bomb) return;
    if (a.slot === slot && !force && slot !== 'grenade') return;
    if (a.slot !== slot) a.lastSlot = a.slot;
    a.slot = slot;
    a.reloadUntil = 0; a.switchUntil = this.time + 0.45; a.bloom = 0; a.shotsInRow = 0;
    const id = this.heldId(a);
    if (a.model) this.updateModelWeapon(a);
    if (a.isPlayer) { this.aiming = false; this.equipPlayerView(); sound.click(); }
    void id;
  }

  updateModelWeapon(a) {
    const id = this.heldId(a);
    if (id === 'bomb') { a.model.setWeapon('he', null); return; }
    a.model.setWeapon(id, this.skinFor(a, id));
  }

  bestSlot(a) { return a.inv.primary ? 'primary' : a.inv.secondary ? 'secondary' : 'knife'; }

  nextSlot(a, dir) {
    const order = ['primary', 'secondary', 'knife', 'grenade', 'bomb'].filter(s => s === 'knife' || (s === 'grenade' ? Object.values(a.inv.grenades).some(n => n > 0) : s === 'bomb' ? a.inv.bomb : a.inv[s]));
    const i = order.indexOf(a.slot);
    this.selectSlot(a, order[(i + dir + order.length) % order.length], true);
  }

  resetLoadout(a, keepWeapons) {
    if (!keepWeapons) {
      a.inv.primary = null; a.inv.secondary = null;
      a.inv.grenades = { he: 0, flash: 0, smoke: 0 };
      a.armor = 0; a.helmet = false; a.defuseKit = false;
    }
    a.inv.bomb = false;
    if (this.mode === 'defuse') {
      if (!a.inv.secondary) { const p = a.team === 'A' ? 'p9' : 'p18'; a.inv.secondary = p; }
    } else if (this.mode === 'gungame') {
      const id = GUNGAME_ORDER[Math.min(a.ggLevel, GUNGAME_ORDER.length - 1)];
      a.inv.primary = null; a.inv.secondary = null;
      if (WEAPONS[id]) { const slot = WEAPONS[id].cat === 'pistol' ? 'secondary' : 'primary'; a.inv[slot] = id; }
      a.armor = 100; a.helmet = true;
    } else {
      const team = a.team === 'F' ? (a.ffaIndex % 2 ? 'B' : 'A') : a.team;
      if (a.isPlayer) {
        const lo = profile.loadout[team] || profile.loadout.A;
        a.inv.primary = lo.primary; a.inv.secondary = lo.secondary;
      } else {
        const pool = team === 'A' ? ['ar4', 'ar4', 'br17', 'vx45', 'mx9', 'awr', 'sv98', 'dp12', 'dmr'] : ['ak', 'ak', 'akb', 'pp19', 'uz9', 'awr', 'sv98', 'sg12', 'svd'];
        a.inv.primary = pool[Math.floor(Math.random() * pool.length)];
        a.inv.secondary = Math.random() < 0.3 ? 'p50' : team === 'A' ? 'p9' : 'p18';
      }
      a.armor = 100; a.helmet = true;
      a.inv.grenades = { he: 1, flash: 1, smoke: 1 };
    }
    for (const id of [a.inv.primary, a.inv.secondary]) if (id && (!keepWeapons || !a.ammo[id])) a.ammo[id] = { mag: WEAPONS[id].mag, res: WEAPONS[id].reserve };
    if (keepWeapons) for (const id of [a.inv.primary, a.inv.secondary]) if (id) a.ammo[id].res = Math.max(a.ammo[id].res, WEAPONS[id].reserve);
    a.slot = this.bestSlot(a); a.lastSlot = 'knife';
    a.reloadUntil = 0; a.switchUntil = 0; a.bloom = 0;
    if (a.model) this.updateModelWeapon(a);
  }

  spawnPoint(a) {
    const def = this.map.def;
    let pts;
    if (this.mode === 'ffa') pts = [...def.spawns.A, ...def.spawns.B, ...def.points];
    else pts = def.spawns[a.team];
    let best = pts[0], bestScore = -Infinity;
    for (const p of pts) {
      let minD = 999;
      for (const o of this.actors) {
        if (o === a || !o.alive) continue;
        const dd = Math.hypot(o.pos.x - p[0], o.pos.z - p[1]);
        if (this.isEnemy(a, o)) minD = Math.min(minD, dd);
        else if (dd < 1.2) minD = Math.min(minD, -50);
      }
      const sc = minD + Math.random() * 6;
      if (sc > bestScore) { bestScore = sc; best = p; }
    }
    let x = best[0] + (Math.random() - 0.5) * 1.6, z = best[1] + (Math.random() - 0.5) * 1.6;
    if (blockedAt(x, 0.01, z, 0.36, 1.8, this.colliders)) {
      const c = nearestFree(this.nav, best[0], best[1]);
      if (c >= 0) ({ x, z } = cellCenter(this.nav, c));
    }
    return { x, z };
  }

  respawn(a, initial, keepWeapons = false) {
    const p = this.spawnPoint(a);
    a.pos.set(p.x, 0, p.z); a.vel.set(0, 0, 0);
    const [bx1, bz1, bx2, bz2] = this.map.def.bounds;
    const cx = (bx1 + bx2) / 2, cz = (bz1 + bz2) / 2;
    a.yaw = Math.atan2(-(cx - p.x), -(cz - p.z)); a.pitch = 0;
    a.health = 100; a.alive = true; a.crouchT = 0; a.height = 1.8;
    a.protectUntil = this.time + (initial || this.mode === 'defuse' ? 0 : 2);
    a.killer = null; a.dmgFrom.clear(); a.flashUntil = 0; a.plantT = 0; a.defuseT = 0;
    this.resetLoadout(a, keepWeapons);
    if (a.brain) Object.assign(a.brain, makeBrain(this.cfg.difficulty));
    if (a.model) { a.model.root.visible = true; a.model.deathT = 0; }
    if (a.isPlayer) { this.equipPlayerView(); this.aiming = false; this.hud.deathScreen(false); this.hud.spectate(null); this.input.crouchToggle = false; }
  }

  equipPlayerView() {
    const p = this.player;
    const id = this.heldId(p);
    this.vm.setWeapon(id === 'bomb' ? 'he' : id, equippedSkin(id), p.team === 'F' ? 'A' : p.team);
    this.hud.setAmmo(id, p.ammo[id], p);
    this.hud.setSlots(p);
  }

  roamPoint(a) {
    const def = this.map.def;
    let pts = def.points;
    if (this.mode !== 'ffa' && Math.random() < 0.3) pts = def.spawns[a.team === 'A' ? 'B' : 'A'];
    const p = pts[Math.floor(Math.random() * pts.length)];
    return { x: p[0] + (Math.random() - 0.5) * 4, z: p[1] + (Math.random() - 0.5) * 4 };
  }

  // ---------- Раунды («Закладка бомбы») ----------
  startRound(first = false) {
    this.round++;
    this.roundState = 'freeze';
    this.freezeLeft = ECON.freeze;
    this.buyLeft = ECON.buyTime;
    this.roundTimer = ECON.roundTime;
    this.roundWinner = null;
    this.bomb = null;
    this.bombMesh.visible = false;
    for (const s of this.smokes) this.effects.removeSmoke(s);
    this.smokes = []; this.projectiles.forEach(p => this.scene.remove(p.mesh)); this.projectiles = [];
    this.effects.clearDecals();
    for (const a of this.actors) {
      const keep = !first && a.alive;
      this.respawn(a, true, keep);
      a.plantT = 0; a.defuseT = 0;
    }
    // бомба случайному наёмнику
    const ts = this.actors.filter(a => a.team === 'B');
    if (ts.length) {
      const carrier = ts[Math.floor(Math.random() * ts.length)];
      carrier.inv.bomb = true;
      this.bomb = { state: 'carried', carrier, pos: new THREE.Vector3(), plantedAt: 0, beepT: 0 };
      this.chooseBotSite();
    }
    for (const a of this.actors) if (!a.isPlayer) botBuy(this, a);
    this.equipPlayerView();
    this.updateHudStatic();
    this.hud.setMoney(this.player.money);
    const half = this.round === this.half + 1 ? ' · СМЕНА СТОРОН' : '';
    this.hud.banner(`РАУНД ${this.round}`, (this.player.team === 'A' ? 'Защитите точки A и B' : 'Заложите бомбу на точке A или B') + half, 'round');
    sound.roundStart();
  }

  chooseBotSite() {
    const sites = Object.keys(this.map.def.sites || {});
    this.botSite = sites[Math.floor(Math.random() * sites.length)] || 'A';
  }

  siteAt(pos) {
    for (const [name, [x, z, r]] of Object.entries(this.map.def.sites || {})) if (Math.hypot(pos.x - x, pos.z - z) < r) return name;
    return null;
  }

  endRound(winner, reason) {
    if (this.roundState === 'end' || this.over) return;
    this.roundState = 'end';
    this.roundWinner = winner;
    this.roundEndAt = this.time + 5;
    this.score[winner]++;
    const loser = winner === 'A' ? 'B' : 'A';
    this.lossStreak[winner] = 0;
    const lossBonus = Math.min(ECON.lossMax, ECON.lossBase + ECON.lossStep * this.lossStreak[loser]);
    this.lossStreak[loser]++;
    const planted = this.bomb && (this.bomb.state === 'planted' || this.bomb.state === 'exploded' || this.bomb.state === 'defused');
    for (const a of this.actors) {
      if (a.team === winner) a.money += reason === 'bomb' || reason === 'defuse' ? ECON.winBomb : ECON.win;
      else a.money += lossBonus + (a.team === 'B' && planted ? ECON.plantLoss : 0);
      a.money = Math.min(ECON.max, a.money);
    }
    const ok = winner === this.player.team;
    const texts = { elim: winner === 'A' ? 'Наёмники уничтожены' : 'Спецназ уничтожен', bomb: 'Бомба взорвана', defuse: 'Бомба обезврежена', time: 'Время вышло' };
    this.hud.banner(ok ? 'РАУНД ВЫИГРАН' : 'РАУНД ПРОИГРАН', `${TEAM_NAME[winner]}: ${texts[reason] || ''}`, ok ? 'win' : 'lose');
    sound.win(ok);
    if (ok) this.earned += 20;
    this.roundStats.push(winner);
    this.updateHudStatic();
    this.hud.setMoney(this.player.money);
  }

  nextRoundOrEnd() {
    const playedRounds = this.round;
    const total = this.cfg.rounds || 12;
    if (this.score.A >= this.winRounds || this.score.B >= this.winRounds || playedRounds >= total) { this.endMatch(); return; }
    if (playedRounds === this.half) this.swapSides();
    this.startRound();
  }

  swapSides() {
    for (const a of this.actors) {
      a.team = a.team === 'A' ? 'B' : 'A';
      a.money = ECON.start;
      a.inv.primary = null; a.inv.secondary = null; a.inv.grenades = { he: 0, flash: 0, smoke: 0 };
      a.armor = 0; a.helmet = false; a.defuseKit = false; a.alive = false;
      if (a.model) { this.scene.remove(a.model.root); a.model = new CharacterModel(a.team); this.scene.add(a.model.root); }
    }
    const s = this.score.A; this.score.A = this.score.B; this.score.B = s;
    const l = this.lossStreak.A; this.lossStreak.A = this.lossStreak.B; this.lossStreak.B = l;
    this.lossStreak = { A: 0, B: 0 };
    this.hud.center('СМЕНА СТОРОН', 2.5, 'multi');
  }

  updateRound(dt) {
    if (this.roundState === 'freeze') {
      this.freezeLeft -= dt;
      if (this.freezeLeft <= 0) { this.roundState = 'live'; }
    }
    if (this.roundState === 'live' || this.roundState === 'planted' || this.roundState === 'freeze') this.buyLeft -= dt;
    if (this.roundState === 'live') {
      this.roundTimer -= dt;
      if (this.roundTimer <= 0) this.endRound('A', 'time');
    }
    if (this.roundState === 'end' && this.time >= this.roundEndAt) { this.nextRoundOrEnd(); return; }
    // бомба
    const b = this.bomb;
    if (b && b.state === 'planted') {
      const left = b.explodeAt - this.time;
      b.beepT -= dt;
      if (b.beepT <= 0) {
        b.beepT = Math.max(0.12, left / ECON.bombTime * 1.0);
        this.playAtPos(b.pos, (v, p) => sound.beep(v * 0.6, p), 40);
        this.bombMesh.userData.led.visible = true;
        setTimeout(() => { if (this.bombMesh) this.bombMesh.userData.led.visible = false; }, 80);
      }
      if (left <= 0 && this.roundState !== 'end') this.explodeBomb();
      else if (left <= 0) this.explodeBomb();
    }
    if (b && b.state === 'dropped') {
      for (const a of this.actors) if (a.alive && a.team === 'B' && Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z) < 1.0) {
        b.state = 'carried'; b.carrier = a; a.inv.bomb = true; this.bombMesh.visible = false;
        if (a.isPlayer) { this.hud.center('ВЫ ПОДОБРАЛИ БОМБУ', 1.5); this.hud.setSlots(a); }
        break;
      }
    }
    // победа по уничтожению
    if (this.roundState === 'live' || this.roundState === 'planted') {
      const aliveA = this.actors.some(a => a.alive && a.team === 'A');
      const aliveB = this.actors.some(a => a.alive && a.team === 'B');
      if (!aliveA) this.endRound('B', 'elim');
      else if (!aliveB && !(b && b.state === 'planted')) this.endRound('A', 'elim');
    }
  }

  // Закладка / разминирование
  updateUse(a, dt, use) {
    if (this.mode !== 'defuse' || !a.alive || this.roundState === 'freeze' || this.roundState === 'end' && this.roundWinner) { a.plantT = 0; a.defuseT = 0; return false; }
    const b = this.bomb;
    if (!b) return false;
    // закладка
    if (a.team === 'B' && a.inv.bomb && use && a.onGround && this.siteAt(a.pos)) {
      if (a.plantT === 0) sound.plant();
      a.plantT += dt;
      if (a.isPlayer) this.hud.progress('Закладка бомбы', a.plantT / ECON.plantTime);
      if (a.plantT >= ECON.plantTime) this.plantBomb(a);
      return true;
    }
    a.plantT = 0;
    // разминирование
    if (a.team === 'A' && b.state === 'planted' && use && a.pos.distanceTo(b.pos) < 1.8) {
      if (!b.defuser || b.defuser === a) {
        b.defuser = a;
        a.defuseT += dt;
        const need = a.defuseKit ? ECON.defuseKit : ECON.defuseTime;
        if (a.isPlayer) this.hud.progress(a.defuseKit ? 'Разминирование (набор сапёра)' : 'Разминирование', a.defuseT / need);
        if (a.defuseT >= need) this.defuseBomb(a);
        return true;
      }
    }
    if (b.defuser === a) b.defuser = null;
    a.defuseT = 0;
    return false;
  }

  plantBomb(a) {
    const b = this.bomb;
    b.state = 'planted'; b.carrier = null; b.site = this.siteAt(a.pos);
    b.pos.set(a.pos.x - Math.sin(a.yaw) * 0.4, 0.05, a.pos.z - Math.cos(a.yaw) * 0.4);
    b.explodeAt = this.time + ECON.bombTime; b.beepT = 0;
    a.inv.bomb = false; a.plantT = 0;
    a.money = Math.min(ECON.max, a.money + ECON.plant);
    if (a.isPlayer) { profile.stats.plants++; this.earned += 15; }
    this.bombMesh.position.copy(b.pos); this.bombMesh.rotation.y = a.yaw; this.bombMesh.visible = true;
    this.roundState = 'planted';
    this.hud.banner('БОМБА ЗАЛОЖЕНА', `Точка ${b.site} · ${ECON.bombTime} секунд`, 'bomb');
    if (a.slot === 'bomb') this.selectSlot(a, this.bestSlot(a), true);
    if (a.isPlayer) this.hud.setSlots(a);
    for (const o of this.actors) if (o.brain) o.brain.bombKnown = true;
  }

  defuseBomb(a) {
    const b = this.bomb;
    b.state = 'defused'; a.defuseT = 0;
    a.money = Math.min(ECON.max, a.money + ECON.defuse);
    if (a.isPlayer) { profile.stats.defuses++; this.earned += 20; }
    this.endRound('A', 'defuse');
  }

  explodeBomb() {
    const b = this.bomb;
    if (!b || b.state !== 'planted') return;
    b.state = 'exploded';
    this.bombMesh.visible = false;
    this.effects.explosion(b.pos.clone().setY(1), 3.5);
    this.playAtPos(b.pos, (v, p) => sound.explosion(1.2, p), 200);
    for (const a of this.actors) {
      if (!a.alive) continue;
      const d = a.pos.distanceTo(b.pos);
      if (d < 18) this.damage(a, 500 * Math.pow(1 - d / 18, 1.4), null, false, 'bomb', true);
    }
    this.cameraShake = 1;
    if (this.roundState !== 'end') this.endRound('B', 'bomb');
  }

  dropBomb(a) {
    if (!a.inv.bomb || !this.bomb) return;
    a.inv.bomb = false;
    const b = this.bomb;
    b.state = 'dropped'; b.carrier = null;
    b.pos.set(a.pos.x, 0.05, a.pos.z);
    this.bombMesh.position.copy(b.pos); this.bombMesh.visible = true;
  }

  // ---------- закупка ----------
  canBuy(a) {
    if (this.mode !== 'defuse') return false;
    if (!a.alive || this.buyLeft <= 0 || this.roundState === 'end') return false;
    const sp = this.map.def.spawns[a.team];
    return sp.some(p => Math.hypot(a.pos.x - p[0], a.pos.z - p[1]) < 14);
  }

  buy(a, item) {
    if (!this.canBuy(a)) return false;
    let price = 0;
    if (WEAPONS[item]) {
      const w = WEAPONS[item];
      if (w.team && w.team !== a.team) return false;
      price = w.price;
      if (a.money < price) return false;
      const slot = w.cat === 'pistol' ? 'secondary' : 'primary';
      if (a.inv[slot] === item) return false;
      a.money -= price;
      this.giveWeapon(a, item, true);
    } else if (GRENADES[item]) {
      const g = GRENADES[item];
      const total = Object.values(a.inv.grenades).reduce((x, y) => x + y, 0);
      if (a.inv.grenades[item] >= g.max || total >= 4 || a.money < g.price) return false;
      a.money -= g.price; a.inv.grenades[item]++;
    } else if (item === 'kevlar') {
      if (a.armor >= 100 || a.money < 650) return false;
      a.money -= 650; a.armor = 100;
    } else if (item === 'helmet') {
      const cost = a.armor >= 100 ? 350 : 1000;
      if (a.helmet && a.armor >= 100) return false;
      if (a.money < cost) return false;
      a.money -= cost; a.armor = 100; a.helmet = true;
    } else if (item === 'defuse') {
      if (a.team !== 'A' || a.defuseKit || a.money < 400) return false;
      a.money -= 400; a.defuseKit = true;
    } else return false;
    if (a.isPlayer) { sound.buy(); this.hud.setMoney(a.money, -price); this.hud.setSlots(a); this.hud.setHealth(a.health, a.armor, a.helmet); this.equipPlayerView(); }
    return true;
  }

  // ---------- оружие ----------
  startReload(a) {
    const id = this.heldId(a); const w = WEAPONS[id];
    if (!w) return;
    const am = a.ammo[id];
    if (a.reloadUntil || am.mag >= w.mag) return;
    if (am.res <= 0) { if (!a.isPlayer && this.mode !== 'defuse') am.res = w.reserve; else return; }
    a.reloadUntil = this.time + w.reload;
    if (a.isPlayer) { this.vm.startReload(w.reload); sound.reload(); if (w.scope >= 3) this.aiming = false; }
  }

  finishReload(a) {
    const id = this.heldId(a); const w = WEAPONS[id];
    a.reloadUntil = 0;
    if (!w) return;
    const am = a.ammo[id];
    const take = Math.min(w.mag - am.mag, am.res);
    am.mag += take; am.res -= take;
    if (a.isPlayer) this.hud.setAmmo(id, am, a);
  }

  currentSpread(a, w) {
    const speed = Math.hypot(a.vel.x, a.vel.z);
    let s = w.spread || 0;
    if (w.scope >= 3 && !(a.isPlayer ? (this.aiming && this.vm.aimT > 0.85) : a.scoped)) s = w.unscoped;
    s += Math.min(1, speed / RUN_SPEED) * (w.moveSpread || 0);
    if (!a.onGround) s += (w.moveSpread || 0) * 2 + 0.05;
    s += a.bloom;
    s *= 1 - a.crouchT * 0.3;
    if (a.isPlayer && this.aiming && !(w.scope >= 3)) s *= 0.65;
    if (a.brain) s += a.brain.d.spread;
    return s;
  }

  tryFire(a, wantFire) {
    const id = this.heldId(a);
    const w = weaponStats(id);
    if (!wantFire) { a.triggerHeld = false; return; }
    if (a.reloadUntil || this.time < a.switchUntil || this.time < a.nextFire) return;
    if (!w.auto && a.triggerHeld) return;
    if (w.cat === 'bomb') { a.triggerHeld = true; return; }
    if (w.throwable) { a.triggerHeld = true; this.throwGrenade(a, id); return; }
    const am = a.ammo[id];
    if (!w.melee && (!am || am.mag <= 0)) {
      if (a.isPlayer && !a.triggerHeld) sound.click();
      a.triggerHeld = true;
      this.startReload(a);
      return;
    }
    a.triggerHeld = true;
    a.nextFire = this.time + 60 / w.rpm;
    if (!w.melee) am.mag--;
    this.fire(a, w, id);
    if (!w.melee && am.mag <= 0 && am.res > 0 && (settings.autoReload || !a.isPlayer)) a.autoReloadAt = this.time + 0.3;
    if (a.isPlayer) this.hud.setAmmo(id, am, a);
  }

  fire(a, w, id) {
    const eye = this.eyePos(a);
    const isP = a.isPlayer;
    const spread = this.currentSpread(a, w);
    const pellets = w.pellets || 1;
    const hits = new Map();
    let firstEnd = null;
    for (let i = 0; i < pellets; i++) {
      const sp = w.pellets ? w.pelletSpread + spread : spread;
      const r = sp * Math.sqrt(Math.random()), ang = Math.random() * Math.PI * 2;
      const py = a.pitch + Math.sin(ang) * r, yy = a.yaw + Math.cos(ang) * r;
      const dir = { x: -Math.sin(yy) * Math.cos(py), y: Math.sin(py), z: -Math.cos(yy) * Math.cos(py) };
      const res = this.trace(a, eye, dir, w.range);
      if (res.actor) {
        const h = hits.get(res.actor) || { dmg: 0, head: false };
        let dmg = w.damage * Math.pow(w.falloff || 1, res.t / 25);
        if (res.part === 'head') { dmg *= w.headMul; h.head = true; }
        else if (res.part === 'legs') dmg *= w.legMul;
        if (w.melee) {
          const bf = { x: -Math.sin(res.actor.yaw), z: -Math.cos(res.actor.yaw) };
          if (bf.x * dir.x + bf.z * dir.z > 0.5) dmg = KNIFE_STATS.backstab;
        }
        h.dmg += dmg;
        hits.set(res.actor, h);
        this.effects.blood(res.point);
      } else if (res.hitWorld && !w.melee) this.effects.impact(res.point, res.axis, res.sign);
      if (!firstEnd) firstEnd = res.point;
    }
    for (const [victim, h] of hits) this.damage(victim, h.dmg, a, h.head, id, false, w.pen);
    const from = this.muzzleWorld(a);
    if (!w.melee && firstEnd && (Math.random() < 0.5 || isP)) this.effects.tracer(from, firstEnd);
    if (!w.melee && settings.effects !== 'low' && Math.random() < 0.4) this.effects.muzzleSmoke(from);
    a.lastShotT = this.time;
    if (w.melee) a.knifeSwing = 1;
    this.playAt(a, (vol, pan) => sound.shot(w.sound, vol, pan));
    if (!w.melee) {
      a.bloom = Math.min(w.maxBloom, a.bloom + w.bloom);
      a.shotsInRow++;
      if (this.isEnemy(this.player, a)) a.spottedUntil = Math.max(a.spottedUntil, this.time + 1.5);
      hearShot(this, a);
    }
    if (isP) {
      this.vm.shoot(w.recoil);
      // отдача: подъём + горизонтальный «узор»
      const n = Math.min(a.shotsInRow, 12);
      const mult = 1 + n * 0.07;
      const up = w.recoil * mult * (this.aiming ? 0.8 : 1) * (1 - a.crouchT * 0.2);
      a.pitch = Math.min(1.5, a.pitch + up * 0.55);
      this.recoilPunch += up * 0.45;
      const side = n > 4 ? Math.sin(n * 0.7) * w.recoil * 0.6 : (Math.random() - 0.5) * w.recoil * 0.4;
      a.yaw += side;
      if (w.scope >= 3 && w.bolt) this.aimResumeAt = this.time + 60 / w.rpm * 0.9, this.aiming = false, this.wasScoped = true;
    } else if (a.brain) {
      a.pitch += w.recoil * 0.35 * (1 - a.brain.d.turn / 14);
    }
  }

  muzzleWorld(a) {
    if (a.isPlayer) {
      const v = this.vm.muzzleWorld(this.tmpV.set(0, 0, 0)).clone();
      return this.camera.localToWorld(v);
    }
    if (a.model && a.model.muzzle) { a.model.root.updateMatrixWorld(); return a.model.muzzle.getWorldPosition(new THREE.Vector3()); }
    const e = this.eyePos(a); return new THREE.Vector3(e.x, e.y - 0.2, e.z);
  }

  hitboxes(e) {
    const c = e.crouchT, x = e.pos.x, y = e.pos.y, z = e.pos.z;
    const legsTop = 0.85 - c * 0.3, bodyTop = 1.5 - c * 0.38, headTop = bodyTop + 0.34;
    const fx = -Math.sin(e.yaw) * 0.04, fz = -Math.cos(e.yaw) * 0.04;
    return [
      { part: 'head', min: [x + fx - 0.15, y + bodyTop, z + fz - 0.15], max: [x + fx + 0.15, y + headTop, z + fz + 0.15] },
      { part: 'body', min: [x - 0.28, y + legsTop, z - 0.28], max: [x + 0.28, y + bodyTop, z + 0.28] },
      { part: 'legs', min: [x - 0.22, y, z - 0.22], max: [x + 0.22, y + legsTop, z + 0.22] },
    ];
  }

  trace(shooter, o, d, range) {
    const n = { axis: 1, sign: 1 };
    const tWorld = raycastWorld(o, d, range, this.colliders, n);
    const wallT = tWorld < 0 ? range : tWorld;
    let best = wallT, actor = null, part = null;
    for (const e of this.actors) {
      if (!e.alive || !this.isEnemy(shooter, e)) continue;
      const dx = e.pos.x - o.x, dz = e.pos.z - o.z;
      if (dx * dx + dz * dz > (best + 2) * (best + 2)) continue;
      for (const hb of this.hitboxes(e)) {
        const t = rayBox(o.x, o.y, o.z, d.x, d.y, d.z, hb.min, hb.max, best, null);
        if (t >= 0 && t < best) { best = t; actor = e; part = hb.part; }
      }
    }
    const point = new THREE.Vector3(o.x + d.x * best, o.y + d.y * best, o.z + d.z * best);
    return { t: best, actor, part, point, hitWorld: !actor && tWorld >= 0, axis: n.axis, sign: n.sign };
  }

  damage(victim, amount, attacker, head, weaponId, explosive = false, pen = 0.5) {
    if (!victim.alive || this.time < victim.protectUntil || this.over) return;
    // броня
    if (!explosive && victim.armor > 0 && (!head || victim.helmet)) {
      const absorbed = amount * (1 - pen);
      amount -= absorbed;
      victim.armor = Math.max(0, victim.armor - absorbed * 0.5);
    } else if (explosive && victim.armor > 0) { amount *= 0.6; victim.armor = Math.max(0, victim.armor - amount * 0.3); }
    amount = Math.min(amount, victim.health);
    victim.health -= amount;
    if (attacker && attacker !== victim) { victim.dmgFrom.set(attacker, (victim.dmgFrom.get(attacker) || 0) + amount); attacker.damage += amount; }
    if (victim.brain && attacker && !victim.brain.target) {
      victim.brain.heard = { x: attacker.pos.x, z: attacker.pos.z }; victim.brain.heardAt = this.time;
      victim.brain.lastPos = { x: attacker.pos.x, z: attacker.pos.z }; victim.brain.lastSeen = this.time - 1;
    }
    const killed = victim.health <= 0.5;
    if (victim.model) {
      const from = attacker && attacker !== victim ? attacker.pos : victim.pos.clone().add(new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5));
      const dir = victim.pos.clone().sub(from).setY(0); if (dir.lengthSq() < 1e-4) dir.set(Math.random() - 0.5, 0, Math.random() - 0.5); dir.normalize();
      victim.lastHitDir = dir; victim.lastHitPow = explosive ? 7 : Math.min(4.5, 1.6 + amount / 30);
      if (!killed) victim.model.hit(dir, head, amount);
    }
    if (attacker && attacker.isPlayer && attacker !== victim) {
      this.hud.hitmarker(head, killed); sound.hit(head);
      if (settings.damageNumbers) this.hud.damageNumber(Math.round(amount), head, victim.pos, this.camera);
    }
    if (victim.isPlayer) {
      sound.hurt();
      if (attacker) { const ang = Math.atan2(-(attacker.pos.x - victim.pos.x), -(attacker.pos.z - victim.pos.z)); this.hud.damage(victim.yaw - ang); }
      this.hud.setHealth(victim.health, victim.armor, victim.helmet);
      this.recoilPunch += 0.01;
    }
    if (killed) this.kill(victim, attacker, weaponId, head);
  }

  kill(victim, killer, weaponId, head) {
    victim.alive = false; victim.health = 0; victim.deaths++;
    victim.respawnAt = this.time + (this.mode === 'gungame' ? 2 : victim.isPlayer ? 4 : 3);
    victim.killer = killer; victim.killerWeapon = weaponId;
    if (victim.model) {
      victim.model.deathDir = Math.random() < 0.5 ? 1 : -1;
      const imp = (victim.lastHitDir || new THREE.Vector3(0, 0, 1)).clone().multiplyScalar(victim.lastHitPow || 2.5).add(new THREE.Vector3(victim.vel.x * 0.8, victim.lastHitPow > 5 ? 3 : 0.3, victim.vel.z * 0.8));
      try { victim.model.die(imp, head, this.map.colliders, victim.pos); } catch (e) { console.error(e); }
    }
    if (victim.inv.bomb) this.dropBomb(victim);
    if (victim.plantT || victim.defuseT) { victim.plantT = 0; victim.defuseT = 0; if (this.bomb && this.bomb.defuser === victim) this.bomb.defuser = null; }
    // ассист
    let assister = null;
    for (const [att, dmg] of victim.dmgFrom) if (att !== killer && dmg >= 40 && this.isEnemy(att, victim)) assister = att;
    if (assister) { assister.assists++; assister.score += 50; if (assister.isPlayer) this.earned += 5; }
    if (killer && killer !== victim) {
      killer.kills++; killer.score += head ? 120 : 100;
      if (head) killer.headshots++;
      if (this.mode === 'tdm') this.score[killer.team]++;
      if (this.mode === 'defuse') {
        const reward = weaponStats(weaponId).reward || 300;
        killer.money = Math.min(ECON.max, killer.money + reward);
        if (killer.isPlayer) this.hud.setMoney(killer.money, reward);
      }
      if (this.mode === 'gungame') this.gunGameAdvance(killer, weaponId);
    }
    const kt = this.mode === 'ffa' ? 'F' : killer ? killer.team : victim.team, vt = this.mode === 'ffa' ? 'F' : victim.team;
    this.hud.feed(killer ? killer.name : '', victim.name, weaponId, head, killer && killer.isPlayer, victim.isPlayer, kt, vt, assister ? assister.name : null);
    if (killer && killer.isPlayer && killer !== victim) {
      sound.kill();
      this.earned += head ? 8 : 5;
      this.xpEarned += 20;
      this.multi = this.time - this.lastKillT < 4 ? this.multi + 1 : 1;
      this.lastKillT = this.time;
      const msgs = { 2: 'ДВОЙНОЕ УБИЙСТВО', 3: 'ТРОЙНОЕ УБИЙСТВО', 4: 'УЛЬТРА', 5: 'ЭЙС!' };
      if (this.multi >= 2) this.hud.center(msgs[Math.min(5, this.multi)], 1.6, 'multi');
      else if (head) this.hud.center('ХЕДШОТ', 1, 'hs');
      const st = profile.stats.perWeapon;
      st[weaponId] = (st[weaponId] || 0) + 1;
    }
    if (victim.isPlayer) { this.aiming = false; this.hud.setScope(false); }
    this.updateHudStatic();
    this.checkWin();
  }

  gunGameAdvance(a, weaponId) {
    if (KNIVES[weaponId] && GUNGAME_ORDER[a.ggLevel] !== 'knife') { /* нож вне очереди — без повышения */ }
    if (GUNGAME_ORDER[a.ggLevel] === 'knife' || a.ggLevel >= GUNGAME_ORDER.length - 1) { a.ggLevel = GUNGAME_ORDER.length; return; }
    a.ggLevel++;
    const id = GUNGAME_ORDER[a.ggLevel];
    a.inv.primary = null; a.inv.secondary = null;
    if (id === 'knife') { a.slot = 'knife'; }
    else this.giveWeapon(a, id, true);
    if (id === 'knife' && a.model) this.updateModelWeapon(a);
    if (a.isPlayer) { this.equipPlayerView(); this.hud.center(id === 'knife' ? 'ФИНАЛ: НОЖ' : `УРОВЕНЬ ${a.ggLevel + 1}`, 1.2, 'multi'); }
  }

  checkWin() {
    if (this.over || this.mode === 'defuse') return;
    const k = this.cfg.killsToWin;
    if (this.mode === 'gungame') { if (this.actors.some(a => a.ggLevel >= GUNGAME_ORDER.length)) this.endMatch(); return; }
    if (this.mode === 'ffa') { if (this.actors.some(a => a.kills >= k)) this.endMatch(); }
    else if (this.score.A >= k || this.score.B >= k) this.endMatch();
  }

  ranking() {
    if (this.mode === 'gungame') return [...this.actors].sort((a, b) => b.ggLevel - a.ggLevel || b.kills - a.kills);
    return [...this.actors].sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
  }

  endMatch() {
    if (this.over) return;
    this.over = true;
    let win, draw = false;
    if (this.mode === 'ffa' || this.mode === 'gungame') win = this.ranking()[0] === this.player;
    else { const my = this.score[this.player.team], th = this.score[this.player.team === 'A' ? 'B' : 'A']; win = my > th; draw = my === th; }
    this.earned += win ? 150 : draw ? 80 : 50;
    this.xpEarned += win ? 300 : 150;
    setTimeout(() => this.cb.onEnd({ win, draw, earned: this.earned, xp: this.xpEarned, player: this.player, game: this }), 2200);
    this.hud.banner(draw ? 'НИЧЬЯ' : win ? 'ПОБЕДА' : 'ПОРАЖЕНИЕ', 'Матч окончен', win ? 'win' : 'lose');
  }

  // ---------- гранаты ----------
  throwGrenade(a, type) {
    if (a.inv.grenades[type] <= 0) return;
    a.inv.grenades[type]--;
    a.nextFire = this.time + 0.8;
    const eye = this.eyePos(a);
    const dir = new THREE.Vector3(-Math.sin(a.yaw) * Math.cos(a.pitch), Math.sin(a.pitch), -Math.cos(a.yaw) * Math.cos(a.pitch));
    const mesh = buildWeaponModel(type, null);
    mesh.scale.setScalar(1.2);
    mesh.position.set(eye.x + dir.x * 0.5, eye.y + dir.y * 0.5 - 0.1, eye.z + dir.z * 0.5);
    this.scene.add(mesh);
    const v = dir.multiplyScalar(17).add(new THREE.Vector3(a.vel.x * 0.6, 3, a.vel.z * 0.6));
    this.projectiles.push({ type, owner: a, mesh, v, fuse: this.time + (type === 'he' ? 1.6 : type === 'flash' ? 1.4 : 1.8), rest: 0 });
    a.knifeSwing = 1;
    if (a.isPlayer) { this.vm.shoot(0); sound.click(); }
    this.playAt(a, (vol, pan) => sound.shot('knife', vol * 0.6, pan));
    if (a.inv.grenades[type] <= 0) {
      const types = ['he', 'flash', 'smoke'].filter(t => a.inv.grenades[t] > 0);
      if (types.length) a.grenadeSel = types[0];
      else this.selectSlot(a, a.lastSlot !== 'grenade' && (a.lastSlot === 'knife' || a.inv[a.lastSlot]) ? a.lastSlot : this.bestSlot(a), true);
    }
    if (a.isPlayer) { this.hud.setSlots(a); this.equipPlayerView(); }
  }

  updateProjectiles(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      const m = p.mesh.position;
      p.v.y -= 15 * dt;
      for (const ax of ['x', 'y', 'z']) {
        const prev = m[ax];
        m[ax] += p.v[ax] * dt;
        let hit = m.y < 0.05;
        if (!hit) for (const c of this.colliders) if (m.x > c.min[0] && m.x < c.max[0] && m.y > c.min[1] && m.y < c.max[1] && m.z > c.min[2] && m.z < c.max[2]) { hit = true; break; }
        if (hit) {
          m[ax] = prev;
          if (ax === 'y' && m.y < 0.05) m.y = 0.05;
          p.v[ax] *= -0.4; p.v.x *= 0.75; p.v.z *= 0.75;
          if (Math.abs(p.v[ax]) > 2) this.playAtPos(m, (v, pn) => sound.click(), 15);
        }
      }
      p.mesh.rotation.x += dt * 6; p.mesh.rotation.z += dt * 4;
      if (this.time >= p.fuse) { this.detonate(p); this.scene.remove(p.mesh); this.projectiles.splice(i, 1); }
    }
  }

  detonate(p) {
    const pos = p.mesh.position.clone();
    if (p.type === 'he') {
      this.effects.explosion(pos, 1.5);
      this.playAtPos(pos, (v, pn) => sound.explosion(v, pn), 80);
      const r = GRENADES.he.radius;
      for (const a of this.actors) {
        if (!a.alive) continue;
        const chest = { x: a.pos.x, y: a.pos.y + 1.1, z: a.pos.z };
        const d = Math.hypot(chest.x - pos.x, chest.y - pos.y, chest.z - pos.z);
        if (d > r || !lineOfSight(pos, chest, this.colliders)) continue;
        if (a !== p.owner && !this.isEnemy(p.owner, a)) continue;
        this.damage(a, GRENADES.he.damage * Math.pow(1 - d / r, 1.2), p.owner, false, 'he', true);
      }
      if (this.player.alive && this.camera.position.distanceTo(pos) < 12) this.cameraShake = 0.6;
    } else if (p.type === 'flash') {
      this.effects.flashPop(pos);
      this.playAtPos(pos, (v, pn) => sound.flashbang(v, pn), 60);
      for (const a of this.actors) {
        if (!a.alive) continue;
        const eye = this.eyePos(a);
        const d = Math.hypot(eye.x - pos.x, eye.y - pos.y, eye.z - pos.z);
        if (d > GRENADES.flash.radius || !lineOfSight(pos, eye, this.colliders) || this.smokeBlocks(pos, eye)) continue;
        const fx = -Math.sin(a.yaw) * Math.cos(a.pitch), fy = Math.sin(a.pitch), fz = -Math.cos(a.yaw) * Math.cos(a.pitch);
        const dot = ((pos.x - eye.x) * fx + (pos.y - eye.y) * fy + (pos.z - eye.z) * fz) / Math.max(0.01, d);
        const strength = (dot > 0.3 ? 1 : dot > -0.2 ? 0.45 : 0.15) * (1 - d / GRENADES.flash.radius * 0.6);
        const dur = 0.4 + strength * 3.2;
        if (this.time + dur > a.flashUntil) { a.flashUntil = this.time + dur; a.flashStart = this.time; a.flashDur = dur; }
      }
    } else if (p.type === 'smoke') {
      const s = { pos: pos.clone().setY(1.2), r: GRENADES.smoke.radius, until: this.time + GRENADES.smoke.duration, born: this.time };
      s.fx = this.effects.smoke(s.pos, s.r, GRENADES.smoke.duration);
      this.smokes.push(s);
      this.playAtPos(pos, (v, pn) => sound.smokePop(v, pn), 40);
    }
  }

  // Дым блокирует видимость
  smokeBlocks(a, b) {
    for (const s of this.smokes) {
      if (this.time > s.until - 1.5 || this.time < s.born + 0.8) continue;
      const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
      const len2 = dx * dx + dy * dy + dz * dz;
      let t = ((s.pos.x - a.x) * dx + (s.pos.y - a.y) * dy + (s.pos.z - a.z) * dz) / Math.max(1e-6, len2);
      t = Math.max(0, Math.min(1, t));
      const px = a.x + dx * t - s.pos.x, py = a.y + dy * t - s.pos.y, pz = a.z + dz * t - s.pos.z;
      if (px * px + py * py * 2 + pz * pz < s.r * s.r * 0.8) return true;
    }
    return false;
  }

  canSee(a, b) { return lineOfSight(a, b, this.colliders) && !this.smokeBlocks(a, b); }

  // ---------- звук в пространстве ----------
  playAt(a, fn) {
    if (a.isPlayer) { fn(0.9, 0); return; }
    this.playAtPos(a.pos, fn, 120);
  }
  playAtPos(pos, fn, maxD = 120) {
    const dx = pos.x - this.camera.position.x, dz = pos.z - this.camera.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist > maxD) return;
    const vol = Math.min(1, 1.6 / (1 + dist * 0.07));
    const yaw = this.player.yaw;
    const rx = Math.cos(yaw), rz = -Math.sin(yaw);
    const pan = dist > 0.1 ? (dx * rx + dz * rz) / dist : 0;
    fn(vol, pan * 0.85);
  }

  updateHudStatic() {
    const p = this.player;
    const enemyTeam = p.team === 'A' ? 'B' : 'A';
    if (this.mode === 'ffa' || this.mode === 'gungame') {
      const rank = this.ranking();
      const top = rank[0] === p ? rank[1] : rank[0];
      const val = (x) => this.mode === 'gungame' ? x.ggLevel + 1 : x.kills;
      this.hud.setScores(val(p), top ? val(top) : 0, 'Вы', 'Лидер', p.team);
    } else this.hud.setScores(this.score[p.team], this.score[enemyTeam], TEAM_NAME[p.team], TEAM_NAME[enemyTeam], p.team);
    this.hud.setHealth(p.health, p.armor, p.helmet);
  }

  // ---------- обновление ----------
  update(dt) {
    if (this.paused) return;
    this.time += dt;
    if (this.mode === 'defuse') this.updateRound(dt);
    else if (!this.over) {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) { this.timeLeft = 0; this.endMatch(); }
    }
    this.updatePlayer(dt);
    for (const a of this.actors) {
      if (a.isPlayer) continue;
      if (!a.alive) {
        if (this.mode !== 'defuse' && this.time >= a.respawnAt && !this.over) this.respawn(a);
      } else if (!this.over && this.roundState !== 'freeze' && !(this.roundState === 'end' && this.mode === 'defuse' && false)) updateBot(this, a, dt);
      else a.ctrl = { wishX: 0, wishZ: 0, speedMul: 1 };
      if (a.alive) {
        const c = a.ctrl || {};
        const using = this.updateUse(a, dt, c.use);
        if (using) { c.wishX = 0; c.wishZ = 0; c.fire = false; }
        this.simulate(a, dt, c);
        const sp = Math.hypot(a.vel.x, a.vel.z);
        if (a.onGround && sp > 3.2) {
          a.stepT = (a.stepT || 0) - dt;
          if (a.stepT <= 0) {
            a.stepT = 0.36;
            const d = Math.hypot(a.pos.x - this.camera.position.x, a.pos.z - this.camera.position.z);
            if (d < 25) this.playAtPos(a.pos, (vol, pan) => sound.step(Math.min(0.5, vol * 0.55) * (1 - d / 25), pan, this.map.def.ground === 'sand' ? 'sand' : 'stone'));
          }
        }
      }
      if (a.model) {
        a.timeRef = this.time;
        if (a.knifeSwing) a.knifeSwing = Math.max(0, a.knifeSwing - dt * 4);
        const dist = a.pos.distanceTo(this.camera.position);
        // экономия: дальние модели анимируются реже
        a.animAcc = (a.animAcc || 0) + dt;
        if (dist < 40 || a.animAcc > 0.06 || !a.alive) { a.model.update(a.animAcc, a); a.animAcc = 0; }
        if (!a.alive && this.time > a.respawnAt - 0.6 && this.mode !== 'defuse') a.model.root.visible = false;
      }
    }
    this.updateProjectiles(dt);
    this.effects.update(dt, this.time);
    for (let i = this.smokes.length - 1; i >= 0; i--) if (this.time > this.smokes[i].until) { this.effects.removeSmoke(this.smokes[i]); this.smokes.splice(i, 1); }
    // HUD
    if (this.mode === 'defuse') {
      const t = this.roundState === 'freeze' ? this.freezeLeft : this.roundState === 'planted' ? Math.max(0, this.bomb.explodeAt - this.time) : this.roundState === 'end' ? 0 : this.roundTimer;
      this.hud.setTimer(t, this.roundState);
      this.hud.setBomb(this.bomb ? this.bomb.state : null, this.bomb && this.bomb.carrier === this.player);
      this.hud.setBuyHint(this.canBuy(this.player) ? Math.ceil(this.buyLeft) : -1);
    } else this.hud.setTimer(this.timeLeft, 'live');
    if (this.input.scoreboard) this.hud.scoreboard(true, this); else this.hud.scoreboard(false);
    this.hud.drawMinimap(this, this.spectating || this.player);
    this.hud.setPips(this);
  }

  simulate(a, dt, c) {
    const id = this.heldId(a);
    const w = weaponStats(id);
    const frozen = this.mode === 'defuse' && this.roundState === 'freeze';
    const wantC = c.crouch ? 1 : 0;
    if (!(wantC < a.crouchT && blockedAt(a.pos.x, a.pos.y + 0.01, a.pos.z, a.radius, 1.8, this.colliders))) a.crouchT += (wantC - a.crouchT) * Math.min(1, dt * 10);
    a.height = 1.8 - a.crouchT * 0.6;
    let speed = RUN_SPEED * (w.speed || 1) * (c.speedMul ?? 1);
    if (c.walk) speed *= 0.52;
    speed *= 1 - a.crouchT * 0.55;
    if (a.isPlayer && this.aiming) speed *= w.scope >= 3 ? 0.55 : 0.75;
    if (frozen) speed = 0;
    const tx = (c.wishX || 0) * speed, tz = (c.wishZ || 0) * speed;
    const acc = a.onGround ? 12 : 2.5;
    a.vel.x += (tx - a.vel.x) * Math.min(1, acc * dt);
    a.vel.z += (tz - a.vel.z) * Math.min(1, acc * dt);
    if (c.jump && a.onGround && a.crouchT < 0.5 && !frozen) { a.vel.y = 6.4; a.onGround = false; }
    moveBody(a, dt, this.colliders);
    const [x1, z1, x2, z2] = this.map.def.bounds;
    a.pos.x = Math.max(x1 + 0.4, Math.min(x2 - 0.4, a.pos.x));
    a.pos.z = Math.max(z1 + 0.4, Math.min(z2 - 0.4, a.pos.z));
    a.bloom = Math.max(0, a.bloom - dt * ((w.maxBloom || 0) * 3 + 0.01));
    if (!c.fire) a.shotsInRow = Math.max(0, a.shotsInRow - dt * 12);
    if (a.reloadUntil && this.time >= a.reloadUntil) this.finishReload(a);
    if (a.autoReloadAt && this.time >= a.autoReloadAt) { a.autoReloadAt = 0; this.startReload(a); }
    this.tryFire(a, c.fire && !frozen && !(this.mode === 'defuse' && this.roundState === 'end' && false));
  }

  updatePlayer(dt) {
    const p = this.player, inp = this.input;
    inp.updateMove();
    // ослепление
    const fl = p.flashUntil > this.time ? Math.min(1, (p.flashUntil - this.time) / Math.min(1.2, p.flashDur || 1)) : 0;
    this.hud.setFlash(fl);
    if (!p.alive) {
      inp.endFrame();
      this.hud.setScope(false); this.hud.setCrossVisible(false); this.hud.progress(null);
      if (this.mode === 'defuse') {
        // наблюдение за союзником
        const mates = this.actors.filter(a => a.alive && a.team === p.team && a !== p);
        if (!this.spectating || !this.spectating.alive) this.spectating = mates[0] || null;
        if (inp.was('nextWeapon') || inp.was('slot0')) { const i = mates.indexOf(this.spectating); this.spectating = mates[(i + 1) % Math.max(1, mates.length)] || null; }
        this.hud.deathScreen(false);
        const s = this.spectating;
        this.hud.spectate(s ? s.name : null);
        if (s) {
          const back = new THREE.Vector3(Math.sin(s.yaw) * 2.6, 2.1, Math.cos(s.yaw) * 2.6);
          this.camera.position.lerp(this.tmpV.copy(s.pos).add(back), Math.min(1, dt * 6));
          this.camera.lookAt(s.pos.x - Math.sin(s.yaw) * 3, s.pos.y + 1.4, s.pos.z - Math.cos(s.yaw) * 3);
        }
        return;
      }
      const left = p.respawnAt - this.time;
      this.hud.deathScreen(true, p.killer ? p.killer.name : '', Math.max(0, left), p.killerWeapon, p.killer ? p.killer.health : 0);
      const k = p.killer;
      this.camera.position.lerp(this.tmpV.set(p.pos.x, p.pos.y + 3.2, p.pos.z + 0.01), Math.min(1, dt * 3));
      if (k && k.alive) this.camera.lookAt(k.pos.x, k.pos.y + 1.4, k.pos.z);
      if (left <= 0 && !this.over) this.respawn(p);
      return;
    }
    this.spectating = null;
    const id = this.heldId(p);
    const w = weaponStats(id);
    const scopedNow = w.scope >= 3 && this.aiming && this.vm.aimT > 0.85;
    const sensK = this.aiming ? (scopedNow ? (inp.touch ? settings.touchAimSens : settings.scopeSens) : (inp.touch ? settings.touchAimSens : settings.aimSens)) * (scopedNow ? 1 / (w.scope * 0.5) : 1) : 1;
    p.yaw -= inp.lookX * sensK;
    p.pitch -= inp.lookY * sensK;
    p.pitch = Math.max(-1.5, Math.min(1.5, p.pitch));
    const rec = Math.min(this.recoilPunch, dt * (inp.fire ? 0.08 : 0.35));
    if (!inp.fire || !w.auto) { p.pitch -= rec * 0.9; this.recoilPunch -= rec; }
    this.recoilPunch = Math.max(0, this.recoilPunch - dt * 0.02);

    if (!this.over) {
      if (inp.was('slot0')) this.selectSlot(p, 'primary');
      if (inp.was('slot1')) this.selectSlot(p, 'secondary');
      if (inp.was('slot2')) this.selectSlot(p, 'knife');
      if (inp.was('slot3')) this.selectSlot(p, 'grenade');
      if (inp.was('slot4')) this.selectSlot(p, 'bomb');
      if (inp.was('grenade')) this.selectSlot(p, 'grenade');
      if (inp.was('lastWeapon')) this.selectSlot(p, p.lastSlot);
      if (inp.was('nextWeapon')) this.nextSlot(p, 1);
      if (inp.was('prevWeapon')) this.nextSlot(p, -1);
      if (inp.was('reload')) this.startReload(p);
      if (inp.was('inspect')) this.vm.inspect();
      if (inp.was('drop') && p.inv.bomb) { this.dropBomb(p); this.selectSlot(p, this.bestSlot(p), true); this.hud.setSlots(p); }
      if (inp.was('aim') && !w.melee && !w.throwable && w.cat !== 'bomb' && !p.reloadUntil) { this.aiming = !this.aiming; this.wasScoped = false; }
      if (inp.was('buy') && this.cb.onBuyMenu) this.cb.onBuyMenu();
    }
    if (this.wasScoped && this.aimResumeAt && this.time >= this.aimResumeAt) { this.aimResumeAt = 0; if (inp.touch || !settings.aimToggle || true) this.aiming = true; this.wasScoped = false; }
    if (w.melee || w.throwable || w.cat === 'bomb') this.aiming = false;

    const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw), rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw);
    const mx = inp.moveX, mz = inp.moveZ;
    const ctrl = {
      wishX: fx * mz + rx * mx, wishZ: fz * mz + rz * mx, speedMul: Math.min(1, Math.hypot(mx, mz)) > 0 ? Math.min(1, Math.hypot(mx, mz) * 1.2) : 0,
      walk: inp.walk, crouch: inp.crouch, jump: inp.was('jump'), fire: inp.fire && !this.over && !(this.cb.isBuyOpen && this.cb.isBuyOpen()),
    };
    const l = Math.hypot(ctrl.wishX, ctrl.wishZ);
    if (l > 1) { ctrl.wishX /= l; ctrl.wishZ /= l; }
    // действие (закладка/разминирование)
    const using = this.updateUse(p, dt, inp.useHeld);
    if (!using) this.hud.progress(null);
    if (using) { ctrl.wishX = 0; ctrl.wishZ = 0; ctrl.fire = false; }
    this.hud.setUseHint(this.useHint(p));
    const wasGround = p.onGround;
    this.simulate(p, dt, ctrl);
    if (!wasGround && p.onGround) sound.step(0.45, 0, this.map.def.ground === 'sand' ? 'sand' : 'stone');
    const sp = Math.hypot(p.vel.x, p.vel.z);
    if (p.onGround && sp > 3.5 && !inp.walk) {
      this.stepT -= dt;
      if (this.stepT <= 0) { this.stepT = 0.36; sound.step(0.28, 0, this.map.def.ground === 'sand' ? 'sand' : 'stone'); }
    }
    // камера
    const eye = this.eyePos(p);
    this.camera.position.set(eye.x, eye.y, eye.z);
    let shakeX = 0, shakeY = 0;
    if (this.cameraShake > 0) { this.cameraShake = Math.max(0, this.cameraShake - dt * 1.5); shakeX = (Math.random() - 0.5) * this.cameraShake * 0.05; shakeY = (Math.random() - 0.5) * this.cameraShake * 0.05; }
    this.camera.rotation.set(p.pitch + this.recoilPunch * 0.25 + shakeY, p.yaw + shakeX, 0);
    const scoped = w.scope >= 3 && this.aiming && this.vm.aimT > 0.85;
    const zoom = this.aiming ? (w.scope || 1.3) : 1;
    const targetFov = settings.fov / zoom;
    this.curFov += (targetFov - this.curFov) * Math.min(1, dt * 15);
    if (Math.abs(this.camera.fov - this.curFov) > 0.01) { this.camera.fov = this.curFov; this.camera.updateProjectionMatrix(); }
    if (!p.reloadUntil && this.vm.reloadT > 0) this.vm.cancelReload();
    this.vm.update(dt, { moveSpeed: settings.bobbing ? sp : 0, onGround: p.onGround, lookDX: inp.lookX, lookDY: inp.lookY, aiming: this.aiming, scoped, crouch: p.crouchT > 0.5 });
    // HUD
    const spread = this.currentSpread(p, w);
    const px = spread / Math.tan(this.camera.fov * Math.PI / 360) * (innerHeight / 2);
    this.hud.setCrossGap(settings.crosshair.dynamic ? Math.min(60, px) : 0);
    this.hud.setCrossVisible(!scoped && !(this.vm.aimT > 0.6 && !w.melee && w.cat !== 'shotgun'));
    this.hud.setScope(scoped);
    this.hud.setReload(p.reloadUntil && WEAPONS[id] ? 1 - (p.reloadUntil - this.time) / WEAPONS[id].reload : -1);
    this.hud.setProtect(this.time < p.protectUntil);
    if (Math.floor(this.time * 5) !== this._spotTick) {
      this._spotTick = Math.floor(this.time * 5);
      for (const e of this.actors) {
        if (!e.alive || !this.isEnemy(p, e)) continue;
        const dx = e.pos.x - p.pos.x, dz = e.pos.z - p.pos.z;
        if (fx * dx + fz * dz < 0) continue;
        if (this.canSee(eye, { x: e.pos.x, y: e.pos.y + 1.3, z: e.pos.z })) e.spottedUntil = this.time + 0.5;
      }
    }
    inp.endFrame();
  }

  useHint(p) {
    if (this.mode !== 'defuse' || !p.alive) return null;
    if (p.team === 'B' && p.inv.bomb && this.siteAt(p.pos)) return 'plant';
    if (p.team === 'A' && this.bomb && this.bomb.state === 'planted' && p.pos.distanceTo(this.bomb.pos) < 1.8) return 'defuse';
    return null;
  }

  render() {
    if (this.map.updateLights) this.map.updateLights(this.camera.position);
    followShadow(this.atmo.sun, this.atmo.sunDir, this.camera.position);
    this.atmo.sky.position.copy(this.camera.position);
    this.pipeline.render(this.player.alive);
  }

  resize(w, h) {
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.vm.resize(w / h);
    this.pipeline.resize();
  }

  dispose() {
    this.pipeline.dispose();
    for (const a of this.actors) if (a.model) a.model.dispose();
    this.scene.traverse(o => { if (o.geometry && !o.isSkinnedMesh) o.geometry.dispose(); });
  }
}
