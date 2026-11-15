// Интерфейс во время боя.
import { settings } from './settings.js';
import { WEAPONS } from './weapons.js';

const $ = (id) => document.getElementById(id);

export class HUD {
  constructor() {
    this.el = {
      hud: $('hud'), hp: $('hp'), hpFill: $('hp-fill'), mag: $('ammo-mag'), res: $('ammo-res'), wname: $('weapon-name'),
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

  setHealth(hp) {
    this.el.hp.textContent = Math.max(0, Math.ceil(hp));
    this.el.hpFill.style.width = Math.max(0, hp) + '%';
    this.el.hpFill.style.background = hp > 60 ? '#5be37d' : hp > 30 ? '#ffc14d' : '#ff4d4d';
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
    this.el.slots.innerHTML = slots.map((id, i) => `<div class="slot ${i === cur ? 'on' : ''}"><b>${i + 1}</b>${WEAPONS[id].short}</div>`).join('');
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
    row.innerHTML = `<span class="t${killerTeam}">${esc(killer)}</span><span class="kw">${w ? w.short : ''}${head ? ' <span class="hs">◉</span>' : ''}</span><span class="t${victimTeam}">${esc(victim)}</span>`;
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

  deathScreen(show, killer, seconds) {
    this.el.death.classList.toggle('hidden', !show);
    if (show) { this.el.killer.textContent = killer || ''; this.el.respawn.textContent = seconds > 0 ? `Возрождение через ${seconds.toFixed(1)}` : ''; }
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
    const scale = 4; // px на метр в базовом изображении
    const c = document.createElement('canvas');
    c.width = (x2 - x1) * scale; c.height = (z2 - z1) * scale;
    const ctx = c.getContext('2d');
    ctx.fillStyle = 'rgba(30,34,40,0.9)'; ctx.fillRect(0, 0, c.width, c.height);
    for (const col of map.colliders) {
      const h = col.max[1];
      ctx.fillStyle = h > 2 ? 'rgba(160,170,180,0.9)' : 'rgba(110,118,126,0.9)';
      ctx.fillRect((col.min[0] - x1) * scale, (col.min[2] - z1) * scale, (col.max[0] - col.min[0]) * scale, (col.max[2] - col.min[2]) * scale);
    }
    this.mmBase = { c, x1, z1, scale };
  }

  drawMinimap(game, player) {
    const ctx = this.mm, W = this.el.minimap.width, R = W / 2;
    const base = this.mmBase; if (!base) return;
    const pxm = 2.2; // пиксели на метр
    ctx.clearRect(0, 0, W, W);
    ctx.save();
    ctx.beginPath(); ctx.arc(R, R, R - 2, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = 'rgba(10,12,16,0.75)'; ctx.fillRect(0, 0, W, W);
    ctx.translate(R, R); ctx.rotate(player.yaw); ctx.scale(pxm / base.scale, pxm / base.scale);
    ctx.translate(-(player.pos.x - base.x1) * base.scale, -(player.pos.z - base.z1) * base.scale);
    ctx.drawImage(base.c, 0, 0);
    // точки
    for (const a of game.actors) {
      if (a === player || !a.alive) continue;
      const enemy = game.isEnemy(player, a);
      if (enemy && game.time > a.spottedUntil) continue;
      ctx.fillStyle = enemy ? '#ff4040' : '#4da3ff';
      ctx.beginPath(); ctx.arc((a.pos.x - base.x1) * base.scale, (a.pos.z - base.z1) * base.scale, 2.4 * base.scale / pxm * 1.0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    // игрок — стрелка в центре
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.moveTo(R, R - 7); ctx.lineTo(R + 5, R + 5); ctx.lineTo(R, R + 2); ctx.lineTo(R - 5, R + 5); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(R, R, R - 2, 0, Math.PI * 2); ctx.stroke();
  }

  update(dt, fps) {
    if (this.hitT > 0) { this.hitT -= dt; if (this.hitT <= 0) this.el.hit.className = ''; }
    if (this.flashT > 0) { this.flashT -= dt; this.el.flash.style.opacity = Math.max(0, this.flashT / 0.35 * 0.45); }
    if (this.centerT > 0) { this.centerT -= dt; if (this.centerT <= 0) this.el.center.className = ''; }
    if (fps !== undefined && settings.showFps) this.el.fps.textContent = fps + ' FPS';
  }
}

function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
