// Простая физика: AABB-коллизии и лучи.
// Коллайдер: { min:[x,y,z], max:[x,y,z] }

export const GRAVITY = 20;
const STEP = 0.42;

function overlaps(px, py, pz, r, h, c) {
  return px + r > c.min[0] && px - r < c.max[0] &&
         pz + r > c.min[2] && pz - r < c.max[2] &&
         py + h > c.min[1] && py < c.max[1];
}

// body: { pos:{x,y,z}, vel:{x,y,z}, radius, height, onGround }
export function moveBody(body, dt, colliders) {
  const steps = Math.ceil(dt / 0.02);
  const h = dt / steps;
  for (let i = 0; i < steps; i++) step(body, h, colliders);
}

function step(b, dt, colliders) {
  const p = b.pos, v = b.vel, r = b.radius, hgt = b.height;
  // X
  p.x += v.x * dt;
  for (const c of colliders) {
    if (!overlaps(p.x, p.y, p.z, r, hgt, c)) continue;
    if (b.onGround && c.max[1] - p.y <= STEP && !blockedAt(p.x, c.max[1] + 0.001, p.z, r, hgt, colliders)) { p.y = c.max[1] + 0.001; continue; }
    if (v.x > 0) p.x = c.min[0] - r - 0.0001; else if (v.x < 0) p.x = c.max[0] + r + 0.0001;
    else p.x = (p.x < (c.min[0] + c.max[0]) / 2) ? c.min[0] - r - 0.0001 : c.max[0] + r + 0.0001;
    b.hitWall = true;
  }
  // Z
  p.z += v.z * dt;
  for (const c of colliders) {
    if (!overlaps(p.x, p.y, p.z, r, hgt, c)) continue;
    if (b.onGround && c.max[1] - p.y <= STEP && !blockedAt(p.x, c.max[1] + 0.001, p.z, r, hgt, colliders)) { p.y = c.max[1] + 0.001; continue; }
    if (v.z > 0) p.z = c.min[2] - r - 0.0001; else if (v.z < 0) p.z = c.max[2] + r + 0.0001;
    else p.z = (p.z < (c.min[2] + c.max[2]) / 2) ? c.min[2] - r - 0.0001 : c.max[2] + r + 0.0001;
    b.hitWall = true;
  }
  // Y
  v.y -= GRAVITY * dt;
  p.y += v.y * dt;
  b.onGround = false;
  if (p.y <= 0) { p.y = 0; v.y = 0; b.onGround = true; }
  for (const c of colliders) {
    if (!overlaps(p.x, p.y, p.z, r, hgt, c)) continue;
    if (v.y <= 0) { p.y = c.max[1]; v.y = 0; b.onGround = true; }
    else { p.y = c.min[1] - hgt - 0.0001; v.y = 0; }
  }
  // «Прилипание» к земле при спуске со ступеньки
  if (!b.onGround && v.y <= 0 && v.y > -2) {
    const below = groundBelow(p.x, p.y, p.z, r, colliders);
    if (p.y - below < 0.08) { p.y = below; v.y = 0; b.onGround = true; }
  }
}

export function blockedAt(x, y, z, r, h, colliders) {
  for (const c of colliders) if (overlaps(x, y, z, r, h, c)) return true;
  return false;
}

export function groundBelow(x, y, z, r, colliders) {
  let best = 0;
  for (const c of colliders) {
    if (x + r > c.min[0] && x - r < c.max[0] && z + r > c.min[2] && z - r < c.max[2] && c.max[1] <= y + 0.01 && c.max[1] > best) best = c.max[1];
  }
  return best;
}

// Луч против AABB. Возвращает t или -1. out.axis/out.sign — нормаль.
export function rayBox(ox, oy, oz, dx, dy, dz, min, max, maxT, out) {
  let tmin = 0, tmax = maxT, axis = -1, sign = 0;
  const o = [ox, oy, oz], d = [dx, dy, dz];
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-9) {
      if (o[i] < min[i] || o[i] > max[i]) return -1;
    } else {
      const inv = 1 / d[i];
      let t1 = (min[i] - o[i]) * inv, t2 = (max[i] - o[i]) * inv, s = -1;
      if (t1 > t2) { const tt = t1; t1 = t2; t2 = tt; s = 1; }
      if (t1 > tmin) { tmin = t1; axis = i; sign = s; }
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return -1;
    }
  }
  if (out) { out.axis = axis; out.sign = sign; }
  return tmin;
}

const tmp = { axis: 0, sign: 0 };
// Ближайшее пересечение с картой.
export function raycastWorld(o, d, maxT, colliders, out) {
  let best = maxT, hit = false;
  for (const c of colliders) {
    const t = rayBox(o.x, o.y, o.z, d.x, d.y, d.z, c.min, c.max, best, tmp);
    if (t >= 0 && t < best) { best = t; hit = true; if (out) { out.axis = tmp.axis; out.sign = tmp.sign; } }
  }
  // пол
  if (d.y < -1e-6) {
    const t = -o.y / d.y;
    if (t >= 0 && t < best) { best = t; hit = true; if (out) { out.axis = 1; out.sign = 1; } }
  }
  return hit ? best : -1;
}

export function lineOfSight(a, b, colliders) {
  const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
  const len = Math.hypot(dx, dy, dz);
  if (len < 1e-4) return true;
  const d = { x: dx / len, y: dy / len, z: dz / len };
  for (const c of colliders) {
    const t = rayBox(a.x, a.y, a.z, d.x, d.y, d.z, c.min, c.max, len, null);
    if (t >= 0 && t < len) return false;
  }
  return true;
}
