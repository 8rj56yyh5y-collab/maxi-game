// Искусственный интеллект ботов: поиск целей, навигация, стрельба.
import { findPath } from './maps.js';
import { lineOfSight } from './physics.js';
import { WEAPONS } from './weapons.js';

export const DIFFICULTY = {
  easy:   { name: 'Новичок', react: 0.8,  turn: 3.0, spread: 0.045, head: 0.08, see: 55,  strafe: 0.0, err: 0.10, burst: [0.2, 0.45], pause: [0.5, 0.9] },
  normal: { name: 'Боец',    react: 0.5,  turn: 5.0, spread: 0.024, head: 0.2,  see: 75,  strafe: 0.5, err: 0.06, burst: [0.3, 0.6],  pause: [0.3, 0.6] },
  hard:   { name: 'Ветеран', react: 0.3,  turn: 8.0, spread: 0.012, head: 0.35, see: 100, strafe: 0.8, err: 0.035, burst: [0.4, 0.8], pause: [0.2, 0.4] },
  pro:    { name: 'Профи',   react: 0.18, turn: 12,  spread: 0.005, head: 0.55, see: 140, strafe: 1.0, err: 0.018, burst: [0.5, 1.0], pause: [0.12, 0.3] },
};

const rand = (a, b) => a + Math.random() * (b - a);

export function makeBrain(diffKey) {
  return {
    d: DIFFICULTY[diffKey] || DIFFICULTY.normal,
    target: null, reactAt: 0, lastSeen: -99, lastPos: null, heard: null, heardAt: -99,
    path: null, pathI: 0, goal: null, repathAt: 0, nextScan: 0,
    strafeDir: 1, strafeUntil: 0, burstUntil: 0, pauseUntil: 0,
    errYaw: 0, errPitch: 0, trackT: 0, aimHead: false,
    stuckCheck: 0, stuckPos: null, crouchUntil: 0,
  };
}

function angDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function updateBot(game, a, dt) {
  const b = a.brain, d = b.d, t = game.time;
  const w = WEAPONS[a.weaponId];

  // --- поиск целей ---
  if (t >= b.nextScan) {
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
      if (!lineOfSight(eye, chest, game.colliders)) {
        const head = { x: e.pos.x, y: e.pos.y + 1.62 - e.crouchT * 0.45, z: e.pos.z };
        if (!lineOfSight(eye, head, game.colliders)) continue;
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
    } else if (b.target && t - b.lastSeen > 0.4) {
      b.target = null;
      b.path = null;
    }
  }
  if (b.target && !b.target.alive) { b.target = null; b.path = null; }

  let wishX = 0, wishZ = 0, speedMul = 1, wantCrouch = false;
  let firing = false;

  if (b.target) {
    const e = b.target;
    b.trackT += dt;
    const eye = game.eyePos(a);
    const aimY = b.aimHead ? e.pos.y + 1.6 - e.crouchT * 0.45 : e.pos.y + 1.15 - e.crouchT * 0.4;
    // упреждение по движению
    const lead = 0.06;
    const tx = e.pos.x + e.vel.x * lead, tz = e.pos.z + e.vel.z * lead;
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

    // перемещение в бою
    const melee = w.melee || w.type === 'shotgun';
    if (melee && dist > 2) {
      const fx = -Math.sin(a.yaw), fz = -Math.cos(a.yaw);
      wishX = fx; wishZ = fz;
    } else if (d.strafe > 0 && Math.random() < d.strafe * dt * 3 + 0.0001 || t < b.strafeUntil) {
      if (t >= b.strafeUntil) { b.strafeUntil = t + rand(0.35, 0.9); b.strafeDir = Math.random() < 0.5 ? -1 : 1; }
      wishX = Math.cos(a.yaw) * b.strafeDir; wishZ = -Math.sin(a.yaw) * b.strafeDir;
      speedMul = 0.75;
    }
    if (d.strafe >= 0.8 && t < b.crouchUntil) wantCrouch = true;
    else if (d.strafe >= 0.8 && Math.random() < dt * 0.4) b.crouchUntil = t + rand(0.5, 1.2);

    // стрельба
    if (t >= b.reactAt) {
      const tol = Math.max(0.03, 0.5 / Math.max(1, dist));
      if (aimErr < tol * 1.8) {
        if (w.melee) firing = dist < w.range;
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
    // --- патрулирование / поиск ---
    let goal = null;
    if (b.lastPos && t - b.lastSeen < 5) goal = b.lastPos;
    else if (b.heard && t - b.heardAt < 6) goal = b.heard;
    if (goal && (!b.goal || Math.hypot(goal.x - b.goal.x, goal.z - b.goal.z) > 3)) { b.goal = goal; b.path = null; }
    if (!b.path || t >= b.repathAt) {
      if (!b.goal || !b.path || b.pathI >= (b.path ? b.path.length : 0)) b.goal = goal || game.roamPoint(a);
      b.path = findPath(game.nav, a.pos.x, a.pos.z, b.goal.x, b.goal.z) || [];
      b.pathI = 0;
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
    // смотрим по ходу движения
    if (wishX || wishZ) {
      const wantYaw = Math.atan2(-wishX, -wishZ);
      a.yaw += angDiff(wantYaw, a.yaw) * Math.min(1, dt * 6);
    }
    a.pitch += (0 - a.pitch) * Math.min(1, dt * 4);
    // перезарядка в спокойной обстановке
    const am = a.ammo[a.weaponId];
    if (am && w.mag && am.mag < w.mag * 0.5 && !a.reloadUntil) game.startReload(a);

    // проверка «застревания»
    if (t >= b.stuckCheck) {
      if (b.stuckPos && (wishX || wishZ) && Math.hypot(a.pos.x - b.stuckPos.x, a.pos.z - b.stuckPos.z) < 0.4) {
        b.goal = game.roamPoint(a); b.path = null;
        if (a.onGround) a.vel.y = 6.2;
      }
      b.stuckPos = { x: a.pos.x, z: a.pos.z };
      b.stuckCheck = t + 1.2;
    }
  }

  a.ctrl = { wishX, wishZ, speedMul, crouch: wantCrouch, fire: firing, walk: false };
}

// Боты «слышат» выстрелы
export function hearShot(game, shooter) {
  for (const a of game.actors) {
    if (!a.brain || !a.alive || !game.isEnemy(a, shooter)) continue;
    const dist = Math.hypot(a.pos.x - shooter.pos.x, a.pos.z - shooter.pos.z);
    if (dist < 35 && !a.brain.target) { a.brain.heard = { x: shooter.pos.x, z: shooter.pos.z }; a.brain.heardAt = game.time; }
  }
}
