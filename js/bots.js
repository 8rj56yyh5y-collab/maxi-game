// ИИ ботов: цели, навигация, стрельба, закупка, задачи режима «Закладка бомбы».
import { findPath } from './maps.js';
import { WEAPONS } from './data.js';

export const DIFFICULTY = {
  easy:   { name: 'Новичок', react: 0.8,  turn: 3.0, spread: 0.045, head: 0.08, see: 55,  strafe: 0.0, err: 0.10, burst: [0.2, 0.45], pause: [0.5, 0.9], nade: 0.0 },
  normal: { name: 'Боец',    react: 0.5,  turn: 5.0, spread: 0.024, head: 0.2,  see: 75,  strafe: 0.5, err: 0.06, burst: [0.3, 0.6],  pause: [0.3, 0.6], nade: 0.15 },
  hard:   { name: 'Ветеран', react: 0.3,  turn: 8.0, spread: 0.012, head: 0.35, see: 100, strafe: 0.8, err: 0.035, burst: [0.4, 0.8], pause: [0.2, 0.4], nade: 0.25 },
  pro:    { name: 'Профи',   react: 0.18, turn: 12,  spread: 0.005, head: 0.55, see: 140, strafe: 1.0, err: 0.018, burst: [0.5, 1.0], pause: [0.12, 0.3], nade: 0.35 },
};

const rand = (a, b) => a + Math.random() * (b - a);

export function makeBrain(diffKey) {
  return {
    d: DIFFICULTY[diffKey] || DIFFICULTY.normal,
    target: null, reactAt: 0, lastSeen: -99, lastPos: null, heard: null, heardAt: -99,
    path: null, pathI: 0, goal: null, repathAt: 0, nextScan: 0,
    strafeDir: 1, strafeUntil: 0, burstUntil: 0, pauseUntil: 0,
    errYaw: 0, errPitch: 0, trackT: 0, aimHead: false,
    stuckCheck: 0, stuckPos: null, crouchUntil: 0, holdUntil: 0, objective: null, nadeCd: 0,
  };
}

function angDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Закупка в начале раунда
export function botBuy(game, a) {
  const m = () => a.money;
  const team = a.team;
  const rifle = team === 'A' ? (Math.random() < 0.8 ? 'ar4' : 'br17') : (Math.random() < 0.8 ? 'ak' : 'akb');
  const sniper = Math.random() < 0.18 ? 'awr' : null;
  if (!a.inv.primary) {
    if (sniper && m() >= 4750 + 1000) game.buy(a, sniper);
    else if (m() >= WEAPONS[rifle].price + 1000) game.buy(a, rifle);
    else if (m() >= 2000 && Math.random() < 0.5) game.buy(a, team === 'A' ? 'vx45' : 'uz9');
    else if (m() >= 1500 && Math.random() < 0.3) game.buy(a, 'sg12');
    else if (m() >= 900 && game.round > 1 && Math.random() < 0.4) game.buy(a, 'p50');
  }
  if (m() >= 1000) game.buy(a, 'helmet');
  else if (m() >= 650) game.buy(a, 'kevlar');
  if (team === 'A' && m() >= 400 && Math.random() < 0.6) game.buy(a, 'defuse');
  for (const g of ['smoke', 'flash', 'he']) if (m() >= 600 && Math.random() < 0.5) game.buy(a, g);
  a.slot = game.bestSlot(a);
  if (a.model) game.updateModelWeapon(a);
}

// Задача в режиме «Закладка бомбы»
function objective(game, a) {
  if (game.mode !== 'defuse') return null;
  const sites = game.map.def.sites;
  const b = game.bomb;
  if (!sites || !b) return null;
  if (a.team === 'B') {
    if (b.state === 'dropped') return { x: b.pos.x, z: b.pos.z, kind: 'pickup' };
    if (b.state === 'planted') { const s = sites[b.site]; return { x: s[0] + rand(-4, 4), z: s[1] + rand(-4, 4), kind: 'guard' }; }
    const s = sites[game.botSite];
    if (a.inv.bomb) return { x: s[0], z: s[1], kind: 'plant' };
    return { x: s[0] + rand(-3, 3), z: s[1] + rand(-3, 3), kind: 'push' };
  }
  // спецназ
  if (b.state === 'planted') return { x: b.pos.x, z: b.pos.z, kind: 'defuse' };
  // распределяемся по точкам
  const names = Object.keys(sites);
  const s = sites[names[a.id % names.length]];
  return { x: s[0] + rand(-3, 3), z: s[1] + rand(-3, 3), kind: 'hold' };
}

export function updateBot(game, a, dt) {
  const b = a.brain, d = b.d, t = game.time;
  const id = game.heldId(a);
  const w = WEAPONS[id] || { melee: true, range: 2.2, auto: true };
  const blind = a.flashUntil > t;

  // выбор оружия
  if (a.slot !== 'knife' || game.mode !== 'gungame') {
    const best = game.bestSlot(a);
    if (a.slot !== best && a.slot !== 'grenade' && t > a.switchUntil) game.selectSlot(a, best, true);
    if (a.slot === 'primary' || a.slot === 'secondary') {
      const am = a.ammo[id];
      if (am && am.mag === 0 && am.res === 0 && a.slot === 'primary' && a.inv.secondary) game.selectSlot(a, 'secondary', true);
    }
  }

  // поиск целей
  if (t >= b.nextScan && !blind) {
    b.nextScan = t + 0.15 + Math.random() * 0.05;
    const eye = game.eyePos(a);
    let best = null, bestD = Infinity;
    for (const e of game.actors) {
      if (!e.alive || !game.isEnemy(a, e)) continue;
      const dx = e.pos.x - a.pos.x, dz = e.pos.z - a.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist > d.see) continue;
      const ang = Math.abs(angDiff(Math.atan2(-dx, -dz), a.yaw));
      if (ang > 1.15 && dist > 7 && e !== b.target) continue;
      const chest = { x: e.pos.x, y: e.pos.y + 1.2 - e.crouchT * 0.4, z: e.pos.z };
      if (!game.canSee(eye, chest)) {
        const head = { x: e.pos.x, y: e.pos.y + 1.62 - e.crouchT * 0.4, z: e.pos.z };
        if (!game.canSee(eye, head)) continue;
      }
      const score = dist + (e === b.target ? -8 : 0);
      if (score < bestD) { bestD = score; best = e; }
    }
    if (best) {
      if (best !== b.target) {
        b.target = best;
        const rt = (t - b.lastSeen < 1.5) ? d.react * 0.4 : d.react;
        b.reactAt = t + rt * rand(0.75, 1.3);
        b.errYaw = rand(-1, 1) * d.err * 2.2;
        b.errPitch = rand(-1, 1) * d.err * 1.6;
        b.trackT = 0;
        b.aimHead = Math.random() < d.head;
      }
      b.lastSeen = t;
      b.lastPos = { x: best.pos.x, z: best.pos.z };
      game.spot(best, a);
    } else if (b.target && t - b.lastSeen > 0.4) { b.target = null; b.path = null; }
  }
  if (b.target && (!b.target.alive || blind)) { b.target = null; b.path = null; }

  let wishX = 0, wishZ = 0, speedMul = 1, wantCrouch = false, firing = false, use = false;

  if (b.target) {
    const e = b.target;
    b.trackT += dt;
    const eye = game.eyePos(a);
    const aimY = b.aimHead ? e.pos.y + 1.6 - e.crouchT * 0.4 : e.pos.y + 1.15 - e.crouchT * 0.38;
    const tx = e.pos.x + e.vel.x * 0.06, tz = e.pos.z + e.vel.z * 0.06;
    const dx = tx - eye.x, dy = aimY - eye.y, dz = tz - eye.z;
    const horiz = Math.hypot(dx, dz);
    const decay = Math.exp(-b.trackT * 1.8);
    const wantYaw = Math.atan2(-dx, -dz) + b.errYaw * (0.15 + 0.85 * decay);
    const wantPitch = Math.atan2(dy, horiz) + b.errPitch * (0.15 + 0.85 * decay);
    const k = Math.min(1, d.turn * dt);
    const dyaw = angDiff(wantYaw, a.yaw);
    a.yaw += dyaw * k;
    a.pitch += (wantPitch - a.pitch) * k;
    const aimErr = Math.abs(dyaw) + Math.abs(wantPitch - a.pitch);
    const dist = Math.hypot(e.pos.x - a.pos.x, e.pos.z - a.pos.z);
    a.scoped = w.scope >= 3;

    const melee = w.melee || w.cat === 'shotgun';
    if (melee && dist > 2) { wishX = -Math.sin(a.yaw); wishZ = -Math.cos(a.yaw); }
    else if ((d.strafe > 0 && Math.random() < d.strafe * dt * 3) || t < b.strafeUntil) {
      if (t >= b.strafeUntil) { b.strafeUntil = t + rand(0.35, 0.9); b.strafeDir = Math.random() < 0.5 ? -1 : 1; }
      wishX = Math.cos(a.yaw) * b.strafeDir; wishZ = -Math.sin(a.yaw) * b.strafeDir;
      speedMul = 0.75;
    }
    if (w.cat === 'sniper') { wishX = 0; wishZ = 0; }
    if (d.strafe >= 0.8 && t < b.crouchUntil) wantCrouch = true;
    else if (d.strafe >= 0.8 && Math.random() < dt * 0.4) b.crouchUntil = t + rand(0.5, 1.2);

    // граната
    if (d.nade > 0 && t > b.nadeCd && dist > 8 && dist < 26 && a.inv.grenades.he > 0 && Math.random() < d.nade * dt) {
      b.nadeCd = t + 8;
      a.grenadeSel = 'he';
      game.selectSlot(a, 'grenade', true);
      a.switchUntil = t;
      a.pitch = Math.max(a.pitch, 0.15 + dist * 0.004);
      game.throwGrenade(a, 'he');
    }

    if (t >= b.reactAt) {
      const tol = Math.max(0.03, 0.5 / Math.max(1, dist));
      if (aimErr < tol * 1.8) {
        if (w.melee) firing = dist < (w.range || 2.2);
        else if (w.auto) {
          if (t < b.burstUntil) firing = true;
          else if (t >= b.pauseUntil) {
            const longRange = dist > 30 ? 0.5 : 1;
            b.burstUntil = t + rand(...d.burst) * longRange;
            b.pauseUntil = b.burstUntil + rand(...d.pause);
            firing = true;
          }
        } else firing = true;
      }
    }
  } else {
    a.scoped = false;
    let goal = null;
    const obj = objective(game, a);
    // задачи бомбы важнее патруля
    if (obj && (obj.kind === 'plant' || obj.kind === 'defuse' || obj.kind === 'pickup')) {
      const dd = Math.hypot(obj.x - a.pos.x, obj.z - a.pos.z);
      if ((obj.kind === 'plant' && game.siteAt(a.pos)) || (obj.kind === 'defuse' && dd < 1.4)) use = true;
      else goal = obj;
    } else if (b.lastPos && t - b.lastSeen < 5) goal = b.lastPos;
    else if (b.heard && t - b.heardAt < 6) goal = b.heard;
    else if (obj) {
      const dd = Math.hypot(obj.x - a.pos.x, obj.z - a.pos.z);
      if (dd > 3 || !b.objective) { goal = b.objective && Math.hypot(b.objective.x - obj.x, b.objective.z - obj.z) < 6 ? b.objective : obj; b.objective = goal; }
    }
    if (goal && (!b.goal || Math.hypot(goal.x - b.goal.x, goal.z - b.goal.z) > 3)) { b.goal = goal; b.path = null; }
    if (!use) {
      if (!b.path || t >= b.repathAt) {
        if (!b.goal || !b.path || b.pathI >= (b.path ? b.path.length : 0)) b.goal = goal || (obj ? null : game.roamPoint(a));
        if (b.goal) {
          b.path = findPath(game.nav, a.pos.x, a.pos.z, b.goal.x, b.goal.z) || [];
          b.pathI = 0;
        } else b.path = [];
        b.repathAt = t + rand(4, 7);
      }
      const wp = b.path[b.pathI];
      if (wp) {
        const dx = wp.x - a.pos.x, dz = wp.z - a.pos.z;
        const l = Math.hypot(dx, dz);
        if (l < 0.7) b.pathI++;
        else { wishX = dx / l; wishZ = dz / l; }
        if (b.pathI >= b.path.length) { if (b.goal === b.lastPos) b.lastPos = null; if (b.goal === b.heard) b.heard = null; b.goal = null; b.path = null; }
      } else { b.path = null; b.goal = null; }
      // на позиции — держим угол
      if (obj && obj.kind !== 'plant' && Math.hypot(obj.x - a.pos.x, obj.z - a.pos.z) < 3.5 && !(wishX || wishZ)) {
        if (t > b.holdUntil) { b.holdUntil = t + rand(2, 4); b.holdYaw = a.yaw + rand(-2, 2); }
        a.yaw += angDiff(b.holdYaw || a.yaw, a.yaw) * Math.min(1, dt * 3);
      }
    }
    if (wishX || wishZ) {
      const wantYaw = Math.atan2(-wishX, -wishZ);
      a.yaw += angDiff(wantYaw, a.yaw) * Math.min(1, dt * 6);
    }
    a.pitch += (0 - a.pitch) * Math.min(1, dt * 4);
    const am = a.ammo[id];
    if (am && w.mag && am.mag < w.mag * 0.5 && !a.reloadUntil) game.startReload(a);
    if (t >= b.stuckCheck) {
      if (b.stuckPos && (wishX || wishZ) && Math.hypot(a.pos.x - b.stuckPos.x, a.pos.z - b.stuckPos.z) < 0.4) {
        b.goal = game.roamPoint(a); b.path = null;
        if (a.onGround) a.vel.y = 6.2;
      }
      b.stuckPos = { x: a.pos.x, z: a.pos.z };
      b.stuckCheck = t + 1.2;
    }
  }
  if (blind) { firing = Math.random() < 0.05; wishX *= 0.3; wishZ *= 0.3; }
  a.ctrl = { wishX, wishZ, speedMul, crouch: wantCrouch, fire: firing, walk: false, use };
}

export function hearShot(game, shooter) {
  for (const a of game.actors) {
    if (!a.brain || !a.alive || !game.isEnemy(a, shooter)) continue;
    const dist = Math.hypot(a.pos.x - shooter.pos.x, a.pos.z - shooter.pos.z);
    if (dist < 35 && !a.brain.target) { a.brain.heard = { x: shooter.pos.x, z: shooter.pos.z }; a.brain.heardAt = game.time; }
  }
}
