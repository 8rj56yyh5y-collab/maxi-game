// Интерфейс во время боя.
import { settings } from './settings.js';
import { WEAPONS } from './weapons.js';
import { iconImg } from './icons.js';

const $ = (id) => document.getElementById(id);

export class HUD {
  constructor() {
    this.el = {
      hud: $('hud'), hp: $('hp'), hpFill: $('hp-fill'), armor: $('armor'), arFill: $('ar-fill'), pipsA: $('pips-a'), pipsB: $('pips-b'), goal: $('goal'), mapName: $('radar-map-name'), kweapon: $('killer-weapon'), mag: $('ammo-mag'), res: $('ammo-res'), wname: $('weapon-name'),
      reload: $('reload-bar'), reloadFill: $('reload-fill'), cross: $('crosshair'), hit: $('hitmarker'), scope: $('scope'),
      flash: $('damage-flash'), indicators: $('dmg-indicators'), scoreA: $('score-a'), scoreB: $('score-b'), timer: $('timer'),
      feed: $('killfeed'), center: $('center-msg'), death: $('death-screen'), killer: $('killer-name'), respawn: $('respawn-timer'),
      board: $('scoreboard'), fps: $('fps'), minimap: $('minimap'), slots: $('weapon-slots'), protect: $('protect'),
    };
    this.mm = this.el.minimap.getContext('2d');
    this.hitT = 0; this.flashT = 0; this.centerT = 0;
    this.applyCrosshair();
  }

  show(v) { this.el.hud.classList.toggle('hidden', !v); }

  applyCrosshair() {
    const c = settings.crosshair, el = this.el.cross;
    el.style.setProperty('--ch-color', c.color);
    el.style.setProperty('--ch-size', c.size + 'px');
    el.style.setProperty('--ch-thick', c.thick + 'px');
    el.style.setProperty('--ch-outline', c.outline ? '0 0 0 1px rgba(0,0,0,.8)' : 'none');
    el.classList.toggle('dot', !!c.dot);
    this.el.fps.style.display = settings.showFps ? 'block' : 'none';
  }

  setCrossGap(px) { this.el.cross.style.setProperty('--ch-gap', (settings.crosshair.gap + px).toFixed(1) + 'px'); }
  setCrossVisible(v) { this.el.cross.style.display = v ? 'block' : 'none'; }
  setScope(v) { this.el.scope.classList.toggle('hidden', !v); }

  setHealth(hp, armor = 0) {
    this.el.hp.textContent = Math.max(0, Math.ceil(hp));
    this.el.hpFill.style.width = Math.max(0, hp) + '%';
    this.el.hp.parentElement.classList.toggle('low', hp <= 30);
    this.el.armor.textContent = Math.max(0, Math.ceil(armor));
    this.el.arFill.style.width = Math.max(0, armor) + '%';
  }

  setAmmo(weaponId, ammo) {
    const w = WEAPONS[weaponId];
    this.el.wname.textContent = w.name;
    if (w.melee) { this.el.mag.textContent = '∞'; this.el.res.textContent = ''; return; }
    this.el.mag.textContent = ammo.mag;
    this.el.mag.classList.toggle('low', ammo.mag <= Math.ceil(w.mag * 0.25));
    this.el.res.textContent = '/ ' + ammo.res;
  }

  setSlots(slots, cur) {
    this.el.slots.innerHTML = slots.map((id, i) => `<div class="slot ${i === cur ? 'on' : ''}">${iconImg(id)}<b>${i + 1}</b></div>`).join('');
  }

  setReload(p) {
    this.el.reload.style.display = p >= 0 ? 'block' : 'none';
    if (p >= 0) this.el.reloadFill.style.width = (p * 100) + '%';
  }

  setProtect(v) { this.el.protect.style.display = v ? 'block' : 'none'; }

  hitmarker(head, kill) {
    const h = this.el.hit;
    h.className = 'show' + (head ? ' head' : '') + (kill ? ' kill' : '');
    this.hitT = 0.18;
  }

  damage(angle) {
    this.flashT = 0.35;
    this.el.flash.style.opacity = 0.45;
    const d = document.createElement('div');
    d.className = 'dmg-ind';
    d.style.transform = `translate(-50%,-50%) rotate(${angle}rad) translateY(-130px)`;
    this.el.indicators.appendChild(d);
    setTimeout(() => d.remove(), 900);
  }

  setPips(game) {
    if (game.cfg.mode === 'ffa') { this.el.pipsA.innerHTML = this.el.pipsB.innerHTML = ''; return; }
    const html = (t) => game.actors.filter(a => a.team === t).map(a => `<i class="${a.alive ? '' : 'dead'}"></i>`).join('');
    const ha = html('A'), hb = html('B');
    if (ha !== this._pa) { this._pa = ha; this.el.pipsA.innerHTML = ha; }
    if (hb !== this._pb) { this._pb = hb; this.el.pipsB.innerHTML = hb; }
  }

  setScores(a, b, mode, myScore, topScore) {
    if (mode === 'ffa') { this.el.scoreA.textContent = myScore; this.el.scoreB.textContent = topScore; }
    else { this.el.scoreA.textContent = a; this.el.scoreB.textContent = b; }
  }

  setTimer(sec) {
    sec = Math.max(0, Math.ceil(sec));
    this.el.timer.textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  }

  feed(killer, victim, weaponId, head, killerMine, victimMine, killerTeam, victimTeam) {
    const row = document.createElement('div');
    row.className = 'kf' + (killerMine || victimMine ? ' mine' : '');
    const w = WEAPONS[weaponId];
    row.innerHTML = `<span class="t${killerTeam}">${esc(killer)}</span>${iconImg(weaponId) || (w ? w.short : '')}${head ? '<span class="hs">◉</span>' : ''}<span class="t${victimTeam}">${esc(victim)}</span>`;
    this.el.feed.prepend(row);
    while (this.el.feed.children.length > 6) this.el.feed.lastChild.remove();
    setTimeout(() => row.classList.add('fade'), 5000);
    setTimeout(() => row.remove(), 5600);
  }

  center(text, dur = 1.6, cls = '') {
    this.el.center.textContent = text;
    this.el.center.className = 'show ' + cls;
    this.centerT = dur;
  }

  deathScreen(show, killer, seconds, weaponId) {
    this.el.death.classList.toggle('hidden', !show);
    if (show) {
      if (this._kw !== weaponId) { this._kw = weaponId; this.el.kweapon.innerHTML = weaponId ? iconImg(weaponId) : ''; }
      this.el.killer.textContent = killer || ''; this.el.respawn.textContent = seconds > 0 ? `Возрождение через ${seconds.toFixed(1)}` : ''; }
  }

  scoreboard(show, game) {
    this.el.board.classList.toggle('hidden', !show);
    if (!show) return;
    const rows = (list) => list.sort((x, y) => y.kills - x.kills || x.deaths - y.deaths).map(a =>
      `<tr class="${a.isPlayer ? 'me' : ''} ${a.alive ? '' : 'dead'}"><td>${esc(a.name)}</td><td>${a.kills}</td><td>${a.deaths}</td><td>${a.headshots}</td><td>${a.score}</td></tr>`).join('');
    const head = '<tr><th>Игрок</th><th>У</th><th>С</th><th>ГШ</th><th>Очки</th></tr>';
    if (game.cfg.mode === 'ffa') {
      this.el.board.innerHTML = `<div class="sb-title">Каждый сам за себя · до ${game.cfg.killsToWin}</div><table>${head}${rows([...game.actors])}</table>`;
    } else {
      const A = game.actors.filter(a => a.team === 'A'), B = game.actors.filter(a => a.team === 'B');
      this.el.board.innerHTML = `<div class="sb-title">Командный бой · до ${game.cfg.killsToWin}</div>
        <div class="sb-teams"><div class="sb-team ta"><h3>Спецназ <b>${game.score.A}</b></h3><table>${head}${rows(A)}</table></div>
        <div class="sb-team tb"><h3>Наёмники <b>${game.score.B}</b></h3><table>${head}${rows(B)}</table></div></div>`;
    }
  }

  // Мини-карта (радар), повёрнута по взгляду игрока
  buildMinimapBase(map) {
    const [x1, z1, x2, z2] = map.def.bounds;
    const scale = 6;
    const c = document.createElement('canvas');
    c.width = (x2 - x1) * scale; c.height = (z2 - z1) * scale;
    const ctx = c.getContext('2d');
    ctx.fillStyle = 'rgba(48,54,62,0.95)'; ctx.fillRect(0, 0, c.width, c.height);
    const list = [...map.colliders].sort((a, b) => a.max[1] - b.max[1]);
    for (const col of list) {
      if (col.max[0] < x1 || col.min[0] > x2 || col.max[2] < z1 || col.min[2] > z2) continue;
      const h = col.max[1];
      ctx.fillStyle = h > 2.5 ? '#9aa6b2' : h > 1.3 ? '#6f7a85' : '#5b646d';
      const rx = (col.min[0] - x1) * scale, rz = (col.min[2] - z1) * scale, rw = (col.max[0] - col.min[0]) * scale, rh = (col.max[2] - col.min[2]) * scale;
      ctx.fillRect(rx, rz, rw, rh);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1; ctx.strokeRect(rx + 0.5, rz + 0.5, rw - 1, rh - 1);
    }
    // зоны возрождения
    for (const [t, col] of [['A', 'rgba(90,169,255,0.25)'], ['B', 'rgba(255,90,60,0.25)']]) {
      ctx.fillStyle = col;
      for (const p of map.def.spawns[t]) { ctx.beginPath(); ctx.arc((p[0] - x1) * scale, (p[1] - z1) * scale, 2.2 * scale, 0, Math.PI * 2); ctx.fill(); }
    }
    this.mmBase = { c, x1, z1, scale };
    this.el.mapName.textContent = map.def.name;
  }

  drawMinimap(game, player) {
    const ctx = this.mm, W = this.el.minimap.width, R = W / 2;
    const base = this.mmBase; if (!base) return;
    const pxm = 4.4; // пикселей канваса на метр
    ctx.clearRect(0, 0, W, W);
    ctx.save();
    ctx.beginPath(); ctx.arc(R, R, R - 3, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = 'rgba(14,17,22,0.85)'; ctx.fillRect(0, 0, W, W);
    ctx.translate(R, R); ctx.rotate(player.yaw); ctx.scale(pxm / base.scale, pxm / base.scale);
    ctx.translate(-(player.pos.x - base.x1) * base.scale, -(player.pos.z - base.z1) * base.scale);
    ctx.globalAlpha = 0.95;
    ctx.drawImage(base.c, 0, 0);
    ctx.globalAlpha = 1;
    const r = 4.2 * base.scale / pxm;
    for (const a of game.actors) {
      if (a === player || !a.alive) continue;
      const enemy = game.isEnemy(player, a);
      if (enemy && game.time > a.spottedUntil) continue;
      const x = (a.pos.x - base.x1) * base.scale, y = (a.pos.z - base.z1) * base.scale;
      ctx.fillStyle = enemy ? '#ff4433' : '#5aa9ff';
      ctx.strokeStyle = '#000'; ctx.lineWidth = r * 0.35;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      if (!enemy) { // направление взгляда союзника
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - Math.sin(a.yaw) * r * 2.4, y - Math.cos(a.yaw) * r * 2.4); ctx.strokeStyle = '#5aa9ff'; ctx.stroke();
      }
    }
    ctx.restore();
    // конус обзора и стрелка игрока
    const g = ctx.createRadialGradient(R, R, 0, R, R, R * 0.7);
    g.addColorStop(0, 'rgba(255,255,255,0.18)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(R, R); ctx.arc(R, R, R * 0.7, -Math.PI / 2 - 0.6, -Math.PI / 2 + 0.6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(R, R - 12); ctx.lineTo(R + 8, R + 8); ctx.lineTo(R, R + 3); ctx.lineTo(R - 8, R + 8); ctx.closePath(); ctx.stroke(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(R, R, R - 3, 0, Math.PI * 2); ctx.stroke();
  }

  update(dt, fps) {
    if (this.hitT > 0) { this.hitT -= dt; if (this.hitT <= 0) this.el.hit.className = ''; }
    if (this.flashT > 0) { this.flashT -= dt; this.el.flash.style.opacity = Math.max(0, this.flashT / 0.35 * 0.45); }
    if (this.centerT > 0) { this.centerT -= dt; if (this.centerT <= 0) this.el.center.className = ''; }
    if (fps !== undefined && settings.showFps) this.el.fps.textContent = fps + ' FPS';
  }
}

function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
