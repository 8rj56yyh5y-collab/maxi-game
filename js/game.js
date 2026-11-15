// Матч: игроки, боты, стрельба, счёт.
import * as THREE from 'three';
import { buildMap, MAPS, nearestFree, cellCenter } from './maps.js';
import { moveBody, raycastWorld, rayBox, blockedAt, lineOfSight } from './physics.js';
import { WEAPONS, PRIMARIES } from './weapons.js';
import { CharacterModel } from './character.js';
import { ViewModel } from './viewmodel.js';
import { Effects } from './effects.js';
import { makeBrain, updateBot, hearShot } from './bots.js';
import { equippedSkin, SKINS } from './skins.js';
import { settings } from './settings.js';
import { sound } from './audio.js';

const BOT_NAMES = ['Ястреб', 'Гром', 'Тень', 'Кобра', 'Север', 'Шаман', 'Бизон', 'Фантом', 'Рысь', 'Дизель', 'Вектор', 'Призрак', 'Медведь', 'Сокол', 'Танкист', 'Буран', 'Жук', 'Кэп', 'Волк', 'Сапёр'];

const RUN_SPEED = 5.6;
const EYE = 1.62;
const RESPAWN = 3;

export class Game {
  constructor(renderer, input, hud, cfg, callbacks) {
    this.renderer = renderer; this.input = input; this.hud = hud; this.cfg = cfg; this.cb = callbacks;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(settings.fov, innerWidth / innerHeight, 0.05, 400);
    this.camera.rotation.order = 'YXZ';
    this.map = buildMap(this.scene, cfg.map, settings.quality);
    this.colliders = this.map.colliders;
    this.nav = this.map.nav;
    this.effects = new Effects(this.scene);
    this.vm = new ViewModel();
    this.time = 0;
    this.timeLeft = cfg.minutes * 60;
    this.score = { A: 0, B: 0 };
    this.actors = [];
    this.over = false;
    this.paused = false;
    this.curFov = settings.fov;
    this.recoilPunch = 0;
    this.stepT = 0;
    this.lastShotByPlayer = -9;
    this.streak = 0; this.lastKillT = -9; this.multi = 0;
    this.earned = 0;
    this.tmpV = new THREE.Vector3();

    this.createActors();
    this.hud.buildMinimapBase(this.map);
    for (const a of this.actors) this.respawn(a, true);
    this.equipPlayerView();
    this.updateHudStatic();
  }

  // ---------- создание ----------
  createActors() {
    const { mode, perTeam, difficulty } = this.cfg;
    const names = [...BOT_NAMES].sort(() => Math.random() - 0.5);
    let ni = 0, ffa = 0;
    const mk = (team, isPlayer) => {
      const a = {
        id: this.actors.length, name: isPlayer ? 'Вы' : names[ni++ % names.length], team, isPlayer,
        pos: new THREE.Vector3(), vel: new THREE.Vector3(), yaw: 0, pitch: 0,
        radius: 0.35, height: 1.8, onGround: true, crouchT: 0,
        health: 100, alive: false, kills: 0, deaths: 0, headshots: 0, score: 0,
        slots: [isPlayer ? this.cfg.primary : pickBotPrimary(), 'pistol', 'knife'], cur: 0, lastSlot: 1,
        ammo: {}, nextFire: 0, reloadUntil: 0, switchUntil: 0, bloom: 0, shotsInRow: 0,
        respawnAt: 0, protectUntil: 0, spottedUntil: 0, triggerHeld: false, killer: null,
        ffaIndex: mode === 'ffa' ? ffa++ : -1,
      };
      a.weaponId = a.slots[0];
      if (!isPlayer) {
        a.brain = makeBrain(difficulty);
        a.model = new CharacterModel(team === 'F' ? 'B' : team, a.ffaIndex);
        this.scene.add(a.model.root);
      }
      this.actors.push(a);
      return a;
    };
    if (mode === 'ffa') {
      this.player = mk('F', true);
      for (let i = 0; i < perTeam * 2 - 1; i++) mk('F', false);
    } else {
      this.player = mk('A', true);
      for (let i = 0; i < perTeam - 1; i++) mk('A', false);
      for (let i = 0; i < perTeam; i++) mk('B', false);
    }
  }

  isEnemy(a, b) { return a !== b && (a.team === 'F' || a.team !== b.team); }

  eyePos(a) { return { x: a.pos.x, y: a.pos.y + EYE - a.crouchT * 0.45, z: a.pos.z }; }

  spot(e, by) {
    if (!this.isEnemy(this.player, e)) return;
    if (this.cfg.mode === 'ffa' && by !== this.player) return;
    if (by.team === this.player.team || by === this.player) e.spottedUntil = this.time + 1.2;
  }

  skinFor(a, weaponId) {
    if (a.isPlayer) return equippedSkin(weaponId);
    // у ботов иногда тоже есть скины
    if (!a.skins) a.skins = {};
    if (!(weaponId in a.skins)) {
      const list = Object.values(SKINS).filter(s => s.weapon === weaponId);
      a.skins[weaponId] = Math.random() < 0.45 ? list[Math.floor(Math.random() * list.length)] : null;
    }
    return a.skins[weaponId];
  }

  resetLoadout(a) {
    for (const id of a.slots) { const w = WEAPONS[id]; a.ammo[id] = { mag: w.mag, res: w.reserve }; }
    a.cur = 0; a.weaponId = a.slots[0]; a.lastSlot = 1;
    a.reloadUntil = 0; a.switchUntil = 0; a.bloom = 0;
    if (a.model) a.model.setWeapon(a.weaponId, this.skinFor(a, a.weaponId));
  }

  spawnPoint(a) {
    const def = this.map.def;
    let pts;
    if (this.cfg.mode === 'ffa') pts = [...def.spawns.A, ...def.spawns.B, ...def.points];
    else pts = def.spawns[a.team];
    // выбираем точку подальше от врагов
    let best = pts[0], bestScore = -Infinity;
    for (const p of pts) {
      let minD = 999;
      for (const o of this.actors) {
        if (o === a || !o.alive) continue;
        const dd = Math.hypot(o.pos.x - p[0], o.pos.z - p[1]);
        if (this.isEnemy(a, o)) minD = Math.min(minD, dd);
        else if (dd < 1.2) minD = Math.min(minD, -50); // занято своим
      }
      const sc = minD + Math.random() * 6;
      if (sc > bestScore) { bestScore = sc; best = p; }
    }
    let x = best[0] + (Math.random() - 0.5) * 1.5, z = best[1] + (Math.random() - 0.5) * 1.5;
    if (blockedAt(x, 0.01, z, 0.36, 1.8, this.colliders)) {
      const c = nearestFree(this.nav, best[0], best[1]);
      if (c >= 0) ({ x, z } = cellCenter(this.nav, c));
    }
    return { x, z };
  }

  respawn(a, initial) {
    const p = this.spawnPoint(a);
    a.pos.set(p.x, 0, p.z); a.vel.set(0, 0, 0);
    const cx = (this.map.def.bounds[0] + this.map.def.bounds[2]) / 2, cz = (this.map.def.bounds[1] + this.map.def.bounds[3]) / 2;
    a.yaw = Math.atan2(-(cx - p.x), -(cz - p.z)); a.pitch = 0;
    a.health = 100; a.alive = true; a.crouchT = 0; a.height = 1.8;
    a.protectUntil = this.time + (initial ? 0 : 2);
    a.killer = null;
    this.resetLoadout(a);
    if (a.brain) Object.assign(a.brain, makeBrain(this.cfg.difficulty));
    if (a.model) { a.model.root.visible = true; a.model.deathT = 0; }
    if (a.isPlayer) { this.equipPlayerView(); this.aiming = false; this.hud.deathScreen(false); this.input.crouchToggle = false; }
  }

  equipPlayerView() {
    const p = this.player;
    this.vm.setWeapon(p.weaponId, equippedSkin(p.weaponId), p.team === 'F' ? 'A' : p.team);
    this.hud.setAmmo(p.weaponId, p.ammo[p.weaponId]);
    this.hud.setSlots(p.slots, p.cur);
  }

  roamPoint(a) {
    const def = this.map.def;
    let pts = def.points;
    if (this.cfg.mode !== 'ffa' && Math.random() < 0.3) pts = def.spawns[a.team === 'A' ? 'B' : 'A'];
    const p = pts[Math.floor(Math.random() * pts.length)];
    return { x: p[0] + (Math.random() - 0.5) * 4, z: p[1] + (Math.random() - 0.5) * 4 };
  }

  // ---------- оружие ----------
  switchTo(a, slot) {
    if (slot === a.cur || slot < 0 || slot >= a.slots.length) return;
    a.lastSlot = a.cur;
    a.cur = slot; a.weaponId = a.slots[slot];
    a.reloadUntil = 0; a.switchUntil = this.time + 0.45; a.bloom = 0; a.shotsInRow = 0;
    if (a.model) a.model.setWeapon(a.weaponId, this.skinFor(a, a.weaponId));
    if (a.isPlayer) { this.aiming = false; this.equipPlayerView(); sound.click(); }
  }

  startReload(a) {
    const w = WEAPONS[a.weaponId], am = a.ammo[a.weaponId];
    if (w.melee || a.reloadUntil || am.mag >= w.mag) return;
    if (am.res <= 0) { if (!a.isPlayer) am.res = w.reserve; else return; }
    a.reloadUntil = this.time + w.reload;
    if (a.isPlayer) { this.vm.startReload(w.reload); sound.reload(); if (WEAPONS[a.weaponId].scope) this.aiming = false; }
  }

  finishReload(a) {
    const w = WEAPONS[a.weaponId], am = a.ammo[a.weaponId];
    const need = w.mag - am.mag, take = Math.min(need, am.res);
    am.mag += take; am.res -= take; a.reloadUntil = 0;
    if (a.isPlayer) this.hud.setAmmo(a.weaponId, am);
  }

  currentSpread(a, w) {
    const speed = Math.hypot(a.vel.x, a.vel.z);
    let s = w.spread;
    if (w.scope && !(a.isPlayer && this.aiming && this.vm.aimT > 0.85)) s = w.unscoped;
    s += Math.min(1, speed / RUN_SPEED) * w.moveSpread;
    if (!a.onGround) s += w.airSpread;
    s += a.bloom;
    s *= 1 - a.crouchT * 0.35;
    if (a.isPlayer && this.aiming && !w.scope) s *= 0.6;
    if (a.brain) s += a.brain.d.spread;
    return s;
  }

  tryFire(a, wantFire) {
    const w = WEAPONS[a.weaponId];
    if (!wantFire) { a.triggerHeld = false; return; }
    if (a.reloadUntil || this.time < a.switchUntil || this.time < a.nextFire) return;
    if (!w.auto && a.triggerHeld) return;
    const am = a.ammo[a.weaponId];
    if (!w.melee && am.mag <= 0) {
      if (a.isPlayer && !a.triggerHeld) sound.click();
      a.triggerHeld = true;
      this.startReload(a);
      return;
    }
    a.triggerHeld = true;
    a.nextFire = this.time + 60 / w.rpm;
    if (!w.melee) am.mag--;
    this.fire(a, w);
    if (!w.melee && am.mag <= 0 && am.res > 0) a.autoReloadAt = this.time + 0.25;
    if (a.isPlayer) this.hud.setAmmo(a.weaponId, am);
  }

  fire(a, w) {
    const eye = this.eyePos(a);
    const isP = a.isPlayer;
    let yaw = a.yaw, pitch = a.pitch;
    const spread = this.currentSpread(a, w);
    const pellets = w.pellets || 1;
    const hits = new Map();
    let firstEnd = null;
    for (let i = 0; i < pellets; i++) {
      const sp = w.pellets ? w.pelletSpread + spread : spread;
      const r = sp * Math.sqrt(Math.random()), ang = Math.random() * Math.PI * 2;
      const py = pitch + Math.sin(ang) * r, yy = yaw + Math.cos(ang) * r;
      const dir = { x: -Math.sin(yy) * Math.cos(py), y: Math.sin(py), z: -Math.cos(yy) * Math.cos(py) };
      const res = this.trace(a, eye, dir, w.range);
      if (res.actor) {
        const h = hits.get(res.actor) || { dmg: 0, head: false, point: res.point, dist: res.t };
        let dmg = w.damage * Math.pow(w.falloff || 1, res.t / 25);
        if (res.part === 'head') { dmg *= w.headMul; h.head = true; }
        else if (res.part === 'legs') dmg *= w.legMul;
        if (w.melee) {
          // удар в спину
          const bf = { x: -Math.sin(res.actor.yaw), z: -Math.cos(res.actor.yaw) };
          if (bf.x * dir.x + bf.z * dir.z > 0.5) dmg = 120;
        }
        h.dmg += dmg;
        hits.set(res.actor, h);
        this.effects.blood(res.point);
      } else if (res.hitWorld && !w.melee) {
        this.effects.impact(res.point, res.axis, res.sign);
      }
      if (!firstEnd) firstEnd = res.point;
    }
    for (const [victim, h] of hits) this.damage(victim, h.dmg, a, h.head, a.weaponId);

    // звук, трассер, отдача
    const from = this.muzzleWorld(a);
    if (!w.melee && firstEnd && (Math.random() < 0.6 || isP)) this.effects.tracer(from, firstEnd);
    this.playAt(a, () => (vol, pan) => sound.shot(w.sound, vol, pan));
    if (!w.melee) {
      a.bloom = Math.min(w.maxBloom, a.bloom + w.bloomPerShot);
      a.shotsInRow++;
      if (a.team !== this.player.team || this.cfg.mode === 'ffa') a.spottedUntil = Math.max(a.spottedUntil, this.time + 1.5);
      hearShot(this, a);
    }
    if (isP) {
      this.lastShotByPlayer = this.time;
      this.vm.shoot(w.recoil.up);
      const mult = 1 + Math.min(a.shotsInRow, 10) * 0.06;
      const up = w.recoil.up * mult * (this.aiming ? 0.8 : 1) * (1 - a.crouchT * 0.2);
      a.pitch = Math.min(1.5, a.pitch + up * 0.55);
      this.recoilPunch += up * 0.45;
      a.yaw += (Math.random() - 0.5) * 2 * w.recoil.side;
    } else if (a.brain) {
      a.pitch += w.recoil.up * 0.4 * (1 - a.brain.d.turn / 14);
      a.yaw += (Math.random() - 0.5) * w.recoil.side;
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
    const legsTop = 0.85 - c * 0.3, bodyTop = 1.45 - c * 0.45, headTop = bodyTop + 0.34;
    const fx = -Math.sin(e.yaw) * 0.04, fz = -Math.cos(e.yaw) * 0.04;
    return [
      { part: 'head', min: [x + fx - 0.15, y + bodyTop, z + fz - 0.15], max: [x + fx + 0.15, y + headTop, z + fz + 0.15] },
      { part: 'body', min: [x - 0.27, y + legsTop, z - 0.27], max: [x + 0.27, y + bodyTop, z + 0.27] },
      { part: 'legs', min: [x - 0.22, y, z - 0.22], max: [x + 0.22, y + legsTop, z + 0.22] },
    ];
  }

  trace(shooter, o, d, range) {
    const n = { axis: 1, sign: 1 };
    let tWorld = raycastWorld(o, d, range, this.colliders, n);
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

  damage(victim, amount, attacker, head, weaponId) {
    if (!victim.alive || this.time < victim.protectUntil || this.over) return;
    victim.health -= amount;
    if (victim.brain && !victim.brain.target) {
      victim.brain.heard = { x: attacker.pos.x, z: attacker.pos.z }; victim.brain.heardAt = this.time;
      // разворачиваемся на урон
      victim.brain.lastPos = { x: attacker.pos.x, z: attacker.pos.z }; victim.brain.lastSeen = this.time - 1;
    }
    const killed = victim.health <= 0;
    if (attacker.isPlayer) { this.hud.hitmarker(head, killed); sound.hit(head); }
    if (victim.isPlayer) {
      sound.hurt();
      // угол относительно взгляда: 0 — впереди, по часовой стрелке
      const ang = Math.atan2(-(attacker.pos.x - victim.pos.x), -(attacker.pos.z - victim.pos.z));
      this.hud.damage(victim.yaw - ang);
      this.hud.setHealth(victim.health);
    }
    if (killed) this.kill(victim, attacker, weaponId, head);
  }

  kill(victim, killer, weaponId, head) {
    victim.alive = false; victim.health = 0; victim.deaths++;
    victim.respawnAt = this.time + (victim.isPlayer ? RESPAWN + 1 : RESPAWN);
    victim.killer = killer;
    if (victim.model) victim.model.deathDir = Math.random() < 0.5 ? 1 : -1;
    killer.kills++; killer.score += head ? 120 : 100;
    if (head) killer.headshots++;
    if (this.cfg.mode !== 'ffa') this.score[killer.team]++;
    this.hud.feed(killer.name, victim.name, weaponId, head, killer.isPlayer, victim.isPlayer,
      this.cfg.mode === 'ffa' ? 'F' : killer.team, this.cfg.mode === 'ffa' ? 'F' : victim.team);
    if (killer.isPlayer) {
      sound.kill();
      this.earned += head ? 15 : 10;
      this.multi = this.time - this.lastKillT < 4 ? this.multi + 1 : 1;
      this.lastKillT = this.time;
      this.streak++;
      const msgs = { 2: 'ДВОЙНОЕ УБИЙСТВО', 3: 'ТРОЙНОЕ УБИЙСТВО', 4: 'УЛЬТРА!', 5: 'НЕУДЕРЖИМ!' };
      if (this.multi >= 2) this.hud.center(msgs[Math.min(5, this.multi)], 1.6, 'multi');
      else if (head) this.hud.center('ХЕДШОТ', 1, 'hs');
    }
    if (victim.isPlayer) { this.streak = 0; this.aiming = false; this.hud.setScope(false); }
    this.updateHudStatic();
    this.checkWin();
  }

  checkWin() {
    if (this.over) return;
    const k = this.cfg.killsToWin;
    if (this.cfg.mode === 'ffa') {
      const top = this.actors.reduce((m, a) => a.kills > m.kills ? a : m, this.actors[0]);
      if (top.kills >= k) this.endMatch();
    } else if (this.score.A >= k || this.score.B >= k) this.endMatch();
  }

  endMatch() {
    this.over = true;
    let win;
    if (this.cfg.mode === 'ffa') {
      const sorted = [...this.actors].sort((a, b) => b.kills - a.kills);
      win = sorted[0] === this.player;
    } else win = this.score[this.player.team] > this.score[this.player.team === 'A' ? 'B' : 'A'];
    const draw = this.cfg.mode !== 'ffa' && this.score.A === this.score.B;
    this.earned += win ? 100 : draw ? 60 : 40;
    setTimeout(() => this.cb.onEnd({ win, draw, earned: this.earned, player: this.player, game: this }), 1800);
    this.hud.center(draw ? 'НИЧЬЯ' : win ? 'ПОБЕДА' : 'ПОРАЖЕНИЕ', 3, win ? 'win' : 'lose');
  }

  playAt(a, mk) {
    const fn = mk();
    if (a.isPlayer) { fn(0.9, 0); return; }
    const dx = a.pos.x - this.camera.position.x, dz = a.pos.z - this.camera.position.z;
    const dist = Math.hypot(dx, dz);
    const vol = Math.min(1, 1.6 / (1 + dist * 0.08));
    const rx = Math.cos(this.player.yaw), rz = -Math.sin(this.player.yaw);
    const pan = dist > 0.1 ? (dx * rx + dz * rz) / dist : 0;
    fn(vol, pan * 0.8);
  }

  updateHudStatic() {
    const p = this.player;
    const top = this.actors.reduce((m, a) => a !== p && a.kills > m ? a.kills : m, 0);
    this.hud.setScores(this.score.A, this.score.B, this.cfg.mode, p.kills, top);
    this.hud.setHealth(p.health);
  }

  // ---------- обновление ----------
  update(dt) {
    if (this.paused) return;
    this.time += dt;
    if (!this.over) {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) { this.timeLeft = 0; this.endMatch(); }
    }
    this.updatePlayer(dt);
    for (const a of this.actors) {
      if (a.isPlayer) continue;
      if (!a.alive) {
        if (this.time >= a.respawnAt && !this.over) this.respawn(a);
      } else if (!this.over) updateBot(this, a, dt);
      else a.ctrl = { wishX: 0, wishZ: 0, speedMul: 1 };
      if (a.alive) this.simulate(a, dt, a.ctrl || {});
      if (a.model) {
        a.model.update(dt, a);
        if (!a.alive && this.time > a.respawnAt - 1) a.model.root.visible = false;
      }
    }
    this.effects.update(dt);
    this.hud.setTimer(this.timeLeft);
    if (this.input.scoreboard) this.hud.scoreboard(true, this);
    else this.hud.scoreboard(false);
    this.hud.drawMinimap(this, this.player);
  }

  // Общая физика + оружие для любого бойца
  simulate(a, dt, c) {
    const w = WEAPONS[a.weaponId];
    // приседание
    const wantC = c.crouch ? 1 : 0;
    if (wantC < a.crouchT && blockedAt(a.pos.x, a.pos.y + 0.01, a.pos.z, a.radius, 1.8, this.colliders)) { /* нет места встать */ }
    else a.crouchT += (wantC - a.crouchT) * Math.min(1, dt * 10);
    a.height = 1.8 - a.crouchT * 0.6;
    // скорость
    let speed = RUN_SPEED * w.speed * (c.speedMul || 1);
    if (c.walk) speed *= 0.52;
    speed *= 1 - a.crouchT * 0.55;
    if (a.isPlayer && this.aiming) speed *= WEAPONS[a.weaponId].scope ? 0.55 : 0.75;
    const tx = (c.wishX || 0) * speed, tz = (c.wishZ || 0) * speed;
    const acc = a.onGround ? 12 : 2.5;
    a.vel.x += (tx - a.vel.x) * Math.min(1, acc * dt);
    a.vel.z += (tz - a.vel.z) * Math.min(1, acc * dt);
    if (c.jump && a.onGround && a.crouchT < 0.5) { a.vel.y = 6.4; a.onGround = false; }
    moveBody(a, dt, this.colliders);
    // ограничение картой
    const [x1, z1, x2, z2] = this.map.def.bounds;
    a.pos.x = Math.max(x1 + 0.4, Math.min(x2 - 0.4, a.pos.x));
    a.pos.z = Math.max(z1 + 0.4, Math.min(z2 - 0.4, a.pos.z));
    // оружие
    a.bloom = Math.max(0, a.bloom - dt * (w.maxBloom * 3 + 0.01));
    if (!c.fire) a.shotsInRow = Math.max(0, a.shotsInRow - dt * 12);
    if (a.reloadUntil && this.time >= a.reloadUntil) this.finishReload(a);
    if (a.autoReloadAt && this.time >= a.autoReloadAt) { a.autoReloadAt = 0; this.startReload(a); }
    this.tryFire(a, c.fire);
  }

  updatePlayer(dt) {
    const p = this.player, inp = this.input;
    inp.updateMove();
    if (!p.alive) {
      inp.endFrame();
      const left = p.respawnAt - this.time;
      this.hud.deathScreen(true, p.killer ? p.killer.name : '', Math.max(0, left));
      this.hud.setScope(false); this.hud.setCrossVisible(false);
      // камера смотрит на убийцу
      const k = p.killer;
      this.camera.position.lerp(this.tmpV.set(p.pos.x, p.pos.y + 3.2, p.pos.z + 0.01), Math.min(1, dt * 3));
      if (k && k.alive) this.camera.lookAt(k.pos.x, k.pos.y + 1.4, k.pos.z);
      if (left <= 0 && !this.over) this.respawn(p);
      return;
    }
    const w = WEAPONS[p.weaponId];
    // взгляд
    const zoomK = this.aiming ? settings.aimSens / (w.scope && this.vm.aimT > 0.85 ? w.zoom * 0.6 : 1) : 1;
    p.yaw -= inp.lookX * zoomK;
    p.pitch -= inp.lookY * zoomK;
    p.pitch = Math.max(-1.5, Math.min(1.5, p.pitch));
    // возврат отдачи
    const rec = Math.min(this.recoilPunch, dt * (inp.fire ? 0.08 : 0.35));
    if (!inp.fire || !w.auto) { p.pitch -= rec * 0.9; this.recoilPunch -= rec; }
    this.recoilPunch = Math.max(0, this.recoilPunch - dt * 0.02);

    // действия
    if (!this.over) {
      if (inp.was('slot0')) this.switchTo(p, 0);
      if (inp.was('slot1')) this.switchTo(p, 1);
      if (inp.was('slot2')) this.switchTo(p, 2);
      if (inp.was('lastWeapon')) this.switchTo(p, p.lastSlot);
      if (inp.was('nextWeapon')) this.switchTo(p, (p.cur + 1) % p.slots.length);
      if (inp.was('prevWeapon')) this.switchTo(p, (p.cur + p.slots.length - 1) % p.slots.length);
      if (inp.was('reload')) this.startReload(p);
      if (inp.was('aim') && !w.melee && !p.reloadUntil) this.aiming = !this.aiming;
    }
    if (w.melee) this.aiming = false;

    const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw), rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw);
    const mx = inp.moveX, mz = inp.moveZ;
    const ctrl = {
      wishX: fx * mz + rx * mx, wishZ: fz * mz + rz * mx,
      speedMul: Math.min(1, Math.hypot(mx, mz)) > 0 ? 1 : 0,
      walk: inp.walk, crouch: inp.crouch, jump: inp.was('jump'), fire: inp.fire && !this.over,
    };
    const l = Math.hypot(ctrl.wishX, ctrl.wishZ);
    if (l > 1) { ctrl.wishX /= l; ctrl.wishZ /= l; }
    const wasGround = p.onGround;
    this.simulate(p, dt, ctrl);
    if (!wasGround && p.onGround) sound.step(0.4);

    // шаги
    const sp = Math.hypot(p.vel.x, p.vel.z);
    if (p.onGround && sp > 3.5 && !inp.walk) {
      this.stepT -= dt;
      if (this.stepT <= 0) { this.stepT = 0.36; sound.step(0.18); }
    }

    // камера
    const eye = this.eyePos(p);
    this.camera.position.set(eye.x, eye.y, eye.z);
    this.camera.rotation.set(p.pitch + this.recoilPunch * 0.25, p.yaw, 0);
    const scoped = w.scope && this.aiming && this.vm.aimT > 0.85;
    const targetFov = this.aiming ? settings.fov / w.zoom : settings.fov;
    this.curFov += (targetFov - this.curFov) * Math.min(1, dt * 15);
    if (Math.abs(this.camera.fov - this.curFov) > 0.01) { this.camera.fov = this.curFov; this.camera.updateProjectionMatrix(); }

    // оружие в руках
    if (!p.reloadUntil && this.vm.reloadT > 0) this.vm.cancelReload();
    this.vm.update(dt, { moveSpeed: sp, onGround: p.onGround, lookDX: inp.lookX, lookDY: inp.lookY, aiming: this.aiming, scoped, crouch: p.crouchT > 0.5 });
    this.vm.camera.position.set(0, 0, 0);

    // HUD
    const spread = this.currentSpread(p, w);
    const px = spread / Math.tan(this.camera.fov * Math.PI / 360) * (innerHeight / 2);
    this.hud.setCrossGap(Math.min(60, px));
    this.hud.setCrossVisible(!scoped);
    this.hud.setScope(scoped);
    this.hud.setReload(p.reloadUntil ? 1 - (p.reloadUntil - this.time) / w.reload : -1);
    this.hud.setProtect(this.time < p.protectUntil);
    // засвет врагов, которых видит игрок
    if (Math.floor(this.time * 5) !== this._spotTick) {
      this._spotTick = Math.floor(this.time * 5);
      for (const e of this.actors) {
        if (!e.alive || !this.isEnemy(p, e)) continue;
        const dx = e.pos.x - p.pos.x, dz = e.pos.z - p.pos.z;
        if (fx * dx + fz * dz < 0) continue;
        if (lineOfSight(eye, { x: e.pos.x, y: e.pos.y + 1.3, z: e.pos.z }, this.colliders)) e.spottedUntil = this.time + 0.5;
      }
    }
    inp.endFrame();
  }

  render() {
    const r = this.renderer;
    r.clear();
    r.render(this.scene, this.camera);
    if (this.player.alive) {
      r.clearDepth();
      r.render(this.vm.scene, this.vm.camera);
    }
  }

  resize(w, h) {
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.vm.resize(w / h);
  }

  dispose() {
    this.scene.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose());
    });
    this.vm.scene.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  }
}

function pickBotPrimary() {
  const r = Math.random();
  return r < 0.45 ? 'ar' : r < 0.7 ? 'smg' : r < 0.85 ? 'sniper' : 'shotgun';
}

export { MAPS, PRIMARIES };
