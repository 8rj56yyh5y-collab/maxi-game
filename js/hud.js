// Интерфейс во время боя.
import * as THREE from 'three';
import { settings } from './settings.js';
import { WEAPONS, KNIVES, GRENADES } from './data.js';
import { iconImg } from './icons.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const nameOf = (id) => WEAPONS[id] ? WEAPONS[id].name : KNIVES[id] ? KNIVES[id].name : GRENADES[id] ? GRENADES[id].name : id === 'bomb' ? 'Бомба' : '';

export class HUD {
  constructor() {
    const ids = ['hud', 'hp', 'hp-fill', 'armor', 'ar-fill', 'helmet', 'ammo-mag', 'ammo-res', 'weapon-name', 'weapon-icon', 'reload-bar', 'reload-fill', 'crosshair', 'hitmarker', 'scope',
      'damage-flash', 'dmg-indicators', 'score-a', 'score-b', 'label-a', 'label-b', 'timer', 'goal', 'killfeed', 'center-msg', 'death-screen', 'killer-name', 'killer-weapon', 'killer-hp',
      'respawn-timer', 'scoreboard', 'fps', 'minimap', 'weapon-slots', 'protect', 'pips-a', 'pips-b', 'radar-map-name', 'money', 'money-delta', 'bomb-icon', 'buy-hint', 'use-hint',
      'progress', 'progress-label', 'progress-fill', 'flash-overlay', 'banner', 'banner-title', 'banner-sub', 'spectate', 'dmg-numbers', 'grenades'];
    this.el = {};
    for (const id of ids) this.el[id.replace(/-(\w)/g, (_, c) => c.toUpperCase())] = $(id);
    this.mm = this.el.minimap.getContext('2d');
    this.hitT = 0; this.flashT = 0; this.centerT = 0; this.bannerT = 0;
    this.numbers = [];
    this.applyCrosshair();
  }

  show(v) { this.el.hud.classList.toggle('hidden', !v); }

  applyCrosshair() {
    const c = settings.crosshair, el = this.el.crosshair;
    el.style.setProperty('--ch-color', c.color);
    el.style.setProperty('--ch-size', c.size + 'px');
    el.style.setProperty('--ch-thick', c.thick + 'px');
    el.style.setProperty('--ch-outline', c.outline ? '0 0 0 1px rgba(0,0,0,.8)' : 'none');
    el.style.opacity = c.alpha ?? 1;
    el.className = (c.dot ? 'dot ' : '') + 'style-' + (c.style || 'cross');
    this.el.fps.style.display = settings.showFps ? 'block' : 'none';
    document.documentElement.style.setProperty('--hud-scale', settings.hudScale || 1);
    const r = 180 * (settings.radarSize || 1);
    this.el.minimap.style.width = this.el.minimap.style.height = r + 'px';
    this.el.killfeed.style.display = settings.killfeed === false ? 'none' : '';
  }

  setGoal(t) { this.el.goal.textContent = t; }
  setCrossGap(px) { this.el.crosshair.style.setProperty('--ch-gap', (settings.crosshair.gap + px).toFixed(1) + 'px'); }
  setCrossVisible(v) { this.el.crosshair.style.display = v ? 'block' : 'none'; }
  setScope(v) { this.el.scope.classList.toggle('hidden', !v); }

  setHealth(hp, armor = 0, helmet = false) {
    hp = Math.max(0, Math.ceil(hp));
    this.el.hp.textContent = hp;
    this.el.hpFill.style.width = hp + '%';
    this.el.hp.parentElement.classList.toggle('low', hp <= 30);
    this.el.armor.textContent = Math.max(0, Math.ceil(armor));
    this.el.arFill.style.width = Math.max(0, armor) + '%';
    this.el.helmet.style.opacity = helmet ? 1 : 0.25;
  }

  setAmmo(id, ammo, actor) {
    this.el.weaponName.textContent = nameOf(id);
    this.el.weaponIcon.innerHTML = iconImg(id === 'bomb' ? 'he' : id);
    if (!WEAPONS[id] || !ammo) {
      if (GRENADES[id] && actor) { this.el.ammoMag.textContent = actor.inv.grenades[id]; this.el.ammoRes.textContent = ''; }
      else { this.el.ammoMag.textContent = '∞'; this.el.ammoRes.textContent = ''; }
      this.el.ammoMag.classList.remove('low');
      return;
    }
    this.el.ammoMag.textContent = ammo.mag;
    this.el.ammoMag.classList.toggle('low', ammo.mag <= Math.ceil(WEAPONS[id].mag * 0.25));
    this.el.ammoRes.textContent = '/ ' + ammo.res;
  }

  setSlots(a) {
    const rows = [];
    const add = (slot, id, key) => { if (id) rows.push(`<div class="slot ${a.slot === slot ? 'on' : ''}">${iconImg(id)}<b>${key}</b></div>`); };
    add('primary', a.inv.primary, 1); add('secondary', a.inv.secondary, 2); add('knife', a.inv.knife, 3);
    const g = a.inv.grenades;
    const gl = ['he', 'flash', 'smoke'].filter(t => g[t] > 0);
    if (gl.length) rows.push(`<div class="slot ${a.slot === 'grenade' ? 'on' : ''}"><span class="nades">${gl.map(t => `<i class="gn ${t} ${a.slot === 'grenade' && a.grenadeSel === t ? 'sel' : ''}">${g[t] > 1 ? g[t] : ''}</i>`).join('')}</span><b>4</b></div>`);
    if (a.inv.bomb) rows.push(`<div class="slot bomb ${a.slot === 'bomb' ? 'on' : ''}"><span class="bomb-ico"></span><b>5</b></div>`);
    this.el.weaponSlots.innerHTML = rows.join('');
    const gtxt = gl.map(t => `<i class="gn ${t}"></i>`).join('');
    this.el.grenades.innerHTML = gtxt;
  }

  setMoney(m, delta) {
    if (m === null) { this.el.money.parentElement.style.display = 'none'; return; }
    this.el.money.parentElement.style.display = '';
    this.el.money.textContent = '$' + m;
    if (delta) {
      const d = this.el.moneyDelta;
      d.textContent = (delta > 0 ? '+' : '−') + '$' + Math.abs(delta);
      d.className = delta > 0 ? 'show plus' : 'show minus';
      clearTimeout(this._md); this._md = setTimeout(() => d.className = '', 1500);
    }
  }

  setTimer(sec, state) {
    sec = Math.max(0, Math.ceil(sec));
    this.el.timer.textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
    this.el.timer.className = state === 'planted' ? 'planted' : state === 'freeze' ? 'freeze' : sec <= 10 && state === 'live' ? 'low' : '';
  }

  setBomb(state, carrying) {
    const el = this.el.bombIcon;
    el.className = state === 'planted' ? 'planted' : carrying ? 'carry' : '';
    el.style.display = state === 'planted' || carrying ? 'block' : 'none';
  }

  setBuyHint(sec) {
    const el = this.el.buyHint;
    if (sec < 0) { el.style.display = 'none'; return; }
    el.style.display = 'block';
    el.innerHTML = `<kbd>B</kbd> Закупка · ${sec} с`;
  }

  setUseHint(kind) {
    const el = this.el.useHint;
    el.style.display = kind ? 'block' : 'none';
    if (kind) el.innerHTML = kind === 'plant' ? 'Удерживайте <kbd>E</kbd>, чтобы заложить бомбу' : 'Удерживайте <kbd>E</kbd>, чтобы обезвредить';
    document.body.classList.toggle('can-use', !!kind);
  }

  progress(label, frac) {
    const el = this.el.progress;
    if (label === null || label === undefined) { el.style.display = 'none'; return; }
    el.style.display = 'block';
    this.el.progressLabel.textContent = label;
    this.el.progressFill.style.width = Math.min(100, frac * 100) + '%';
  }

  setFlash(a) { this.el.flashOverlay.style.opacity = a; }

  setScores(my, their, myLabel, theirLabel, team) {
    this.el.scoreA.textContent = my; this.el.scoreB.textContent = their;
    this.el.labelA.textContent = myLabel; this.el.labelB.textContent = theirLabel;
    this.el.hud.dataset.team = team;
  }

  setPips(game) {
    if (game.mode === 'ffa' || game.mode === 'gungame') { this.el.pipsA.innerHTML = this.el.pipsB.innerHTML = ''; return; }
    const my = game.player.team, other = my === 'A' ? 'B' : 'A';
    const html = (t) => game.actors.filter(a => a.team === t).map(a => `<i class="${a.alive ? '' : 'dead'} ${a.isPlayer ? 'me' : ''}"></i>`).join('');
    const ha = html(my), hb = html(other);
    if (ha !== this._pa) { this._pa = ha; this.el.pipsA.innerHTML = ha; }
    if (hb !== this._pb) { this._pb = hb; this.el.pipsB.innerHTML = hb; }
  }

  setReload(p) {
    this.el.reloadBar.style.display = p >= 0 ? 'block' : 'none';
    if (p >= 0) this.el.reloadFill.style.width = (p * 100) + '%';
  }
  setProtect(v) { this.el.protect.style.display = v ? 'block' : 'none'; }

  hitmarker(head, kill) {
    if (settings.hitmarkers === false) return;
    this.el.hitmarker.className = 'show' + (head ? ' head' : '') + (kill ? ' kill' : '');
    this.hitT = 0.18;
  }

  damage(angle) {
    this.flashT = 0.35;
    this.el.damageFlash.style.opacity = 0.45;
    const d = document.createElement('div');
    d.className = 'dmg-ind';
    d.style.transform = `translate(-50%,-50%) rotate(${angle}rad) translateY(-130px)`;
    this.el.dmgIndicators.appendChild(d);
    setTimeout(() => d.remove(), 900);
  }

  damageNumber(n, head, pos, camera) {
    const v = new THREE.Vector3(pos.x, pos.y + 1.9, pos.z).project(camera);
    if (v.z > 1) return;
    const el = document.createElement('div');
    el.className = 'dmg-num' + (head ? ' head' : '');
    el.textContent = n;
    el.style.left = ((v.x * 0.5 + 0.5) * innerWidth + (Math.random() - 0.5) * 30) + 'px';
    el.style.top = ((-v.y * 0.5 + 0.5) * innerHeight) + 'px';
    this.el.dmgNumbers.appendChild(el);
    setTimeout(() => el.remove(), 800);
  }

  feed(killer, victim, weaponId, head, killerMine, victimMine, kt, vt, assist) {
    if (settings.killfeed === false) return;
    const row = document.createElement('div');
    row.className = 'kf' + (killerMine || victimMine ? ' mine' : '');
    const ic = weaponId === 'bomb' ? '<span class="bomb-ico sm"></span>' : (iconImg(weaponId) || nameOf(weaponId));
    row.innerHTML = `${killer ? `<span class="t${kt}">${esc(killer)}</span>` : ''}${assist ? `<span class="as">+ ${esc(assist)}</span>` : ''}${ic}${head ? '<span class="hs">◉</span>' : ''}<span class="t${vt}">${esc(victim)}</span>`;
    this.el.killfeed.prepend(row);
    while (this.el.killfeed.children.length > 6) this.el.killfeed.lastChild.remove();
    setTimeout(() => row.classList.add('fade'), 6000);
    setTimeout(() => row.remove(), 6600);
  }

  center(text, dur = 1.6, cls = '') {
    this.el.centerMsg.textContent = text;
    this.el.centerMsg.className = 'show ' + cls;
    this.centerT = dur;
  }

  banner(title, sub, cls = '') {
    this.el.bannerTitle.textContent = title;
    this.el.bannerSub.textContent = sub || '';
    this.el.banner.className = 'show ' + cls;
    this.bannerT = 3.2;
  }

  deathScreen(show, killer, seconds, weaponId, killerHp) {
    this.el.deathScreen.classList.toggle('hidden', !show);
    if (show) {
      if (this._kw !== weaponId) { this._kw = weaponId; this.el.killerWeapon.innerHTML = weaponId ? iconImg(weaponId) : ''; }
      this.el.killerName.textContent = killer || '';
      this.el.killerHp.textContent = killer ? `HP ${Math.ceil(killerHp || 0)}` : '';
      this.el.respawnTimer.textContent = seconds > 0 ? `Возрождение через ${seconds.toFixed(1)}` : '';
    }
  }

  spectate(name) {
    this.el.spectate.style.display = name ? 'block' : 'none';
    if (name) this.el.spectate.innerHTML = `Наблюдение: <b>${esc(name)}</b> <span>· <kbd>Колесо</kbd> следующий</span>`;
  }

  scoreboard(show, game) {
    this.el.scoreboard.classList.toggle('hidden', !show);
    if (!show) return;
    if (this._sbT && performance.now() - this._sbT < 250) return;
    this._sbT = performance.now();
    const defuse = game.mode === 'defuse';
    const head = `<tr><th>Игрок</th>${defuse ? '<th>$</th>' : ''}<th>У</th><th>П</th><th>С</th><th>ГШ</th><th>Урон</th><th>Очки</th></tr>`;
    const rows = (list) => list.map(a => `<tr class="${a.isPlayer ? 'me' : ''} ${a.alive ? '' : 'dead'}"><td>${a.alive ? '' : '<span class="skull">✕</span>'}${esc(a.name)}${a.inv.bomb ? ' <span class="bomb-ico sm"></span>' : ''}</td>${defuse ? `<td class="money">${a.team === game.player.team ? '$' + a.money : '—'}</td>` : ''}<td>${a.kills}</td><td>${a.assists}</td><td>${a.deaths}</td><td>${a.headshots}</td><td>${Math.round(a.damage)}</td><td>${a.score}</td></tr>`).join('');
    const sorted = (t) => game.actors.filter(a => a.team === t).sort((x, y) => y.score - x.score);
    if (game.mode === 'ffa' || game.mode === 'gungame') {
      this.el.scoreboard.innerHTML = `<div class="sb-title">${game.mode === 'ffa' ? 'Каждый сам за себя' : 'Гонка вооружений'} · ${game.map.def.name}</div><table>${head}${rows(game.ranking())}</table>`;
    } else {
      const my = game.player.team, ot = my === 'A' ? 'B' : 'A';
      const N = { A: 'Спецназ', B: 'Наёмники' };
      const rounds = defuse ? `<div class="sb-rounds">${game.roundStats.map(w => `<i class="${w === my ? 'w' : 'l'}"></i>`).join('')}</div>` : '';
      this.el.scoreboard.innerHTML = `<div class="sb-title">${defuse ? `Закладка бомбы · раунд ${game.round}` : 'Командный бой'} · ${game.map.def.name}</div>${rounds}
        <div class="sb-teams"><div class="sb-team t${my}"><h3>${N[my]} <b>${game.score[my]}</b></h3><table>${head}${rows(sorted(my))}</table></div>
        <div class="sb-team t${ot}"><h3>${N[ot]} <b>${game.score[ot]}</b></h3><table>${head}${rows(sorted(ot))}</table></div></div>`;
    }
  }

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
    }
    if (map.def.sites) for (const [n, [sx, sz, sr]] of Object.entries(map.def.sites)) {
      ctx.fillStyle = 'rgba(255,190,40,0.25)'; ctx.beginPath(); ctx.arc((sx - x1) * scale, (sz - z1) * scale, sr * scale, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffc828'; ctx.font = `bold ${scale * 4}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(n, (sx - x1) * scale, (sz - z1) * scale);
    }
    this.mmBase = { c, x1, z1, scale };
    this.el.radarMapName.textContent = map.def.name;
  }

  drawMinimap(game, viewer) {
    const ctx = this.mm, W = this.el.minimap.width, R = W / 2;
    const base = this.mmBase; if (!base) return;
    const pxm = 4.4 / (settings.radarZoom || 1);
    const rot = settings.radarRotate !== false ? viewer.yaw : 0;
    ctx.clearRect(0, 0, W, W);
    ctx.save();
    ctx.beginPath(); ctx.arc(R, R, R - 3, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = 'rgba(14,17,22,0.85)'; ctx.fillRect(0, 0, W, W);
    ctx.translate(R, R); ctx.rotate(rot); ctx.scale(pxm / base.scale, pxm / base.scale);
    ctx.translate(-(viewer.pos.x - base.x1) * base.scale, -(viewer.pos.z - base.z1) * base.scale);
    ctx.globalAlpha = 0.95; ctx.drawImage(base.c, 0, 0); ctx.globalAlpha = 1;
    const r = 4.2 * base.scale / pxm;
    const P = (x, z) => [(x - base.x1) * base.scale, (z - base.z1) * base.scale];
    const me = game.player;
    for (const a of game.actors) {
      if (a === viewer || !a.alive) continue;
      const enemy = game.isEnemy(me, a);
      if (enemy && game.time > a.spottedUntil) continue;
      const [x, y] = P(a.pos.x, a.pos.z);
      ctx.fillStyle = enemy ? '#ff4433' : '#2ec4ff';
      ctx.strokeStyle = '#000'; ctx.lineWidth = r * 0.35;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      if (!enemy) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - Math.sin(a.yaw) * r * 2.4, y - Math.cos(a.yaw) * r * 2.4); ctx.strokeStyle = '#2ec4ff'; ctx.stroke(); }
      if (a.inv.bomb && !enemy) { ctx.fillStyle = '#ff3b30'; ctx.fillRect(x - r * 0.5, y - r * 2.4, r, r); }
    }
    const b = game.bomb;
    if (b && (b.state === 'planted' || b.state === 'dropped') && (b.state === 'planted' || me.team === 'B')) {
      const [x, y] = P(b.pos.x, b.pos.z);
      ctx.fillStyle = (game.time * 4 | 0) % 2 && b.state === 'planted' ? '#ff3b30' : '#ffb400';
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    for (const s of game.smokes) { const [x, y] = P(s.pos.x, s.pos.z); ctx.fillStyle = 'rgba(200,200,200,0.5)'; ctx.beginPath(); ctx.arc(x, y, s.r * base.scale, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
    const g = ctx.createRadialGradient(R, R, 0, R, R, R * 0.7);
    g.addColorStop(0, 'rgba(255,255,255,0.18)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    const dir = settings.radarRotate !== false ? -Math.PI / 2 : -Math.PI / 2 - viewer.yaw;
    ctx.beginPath(); ctx.moveTo(R, R); ctx.arc(R, R, R * 0.7, dir - 0.6, dir + 0.6); ctx.closePath(); ctx.fill();
    ctx.save(); ctx.translate(R, R); if (settings.radarRotate === false) ctx.rotate(-viewer.yaw);
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(8, 8); ctx.lineTo(0, 3); ctx.lineTo(-8, 8); ctx.closePath(); ctx.stroke(); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(R, R, R - 3, 0, Math.PI * 2); ctx.stroke();
  }

  update(dt, fps) {
    if (this.hitT > 0) { this.hitT -= dt; if (this.hitT <= 0) this.el.hitmarker.className = ''; }
    if (this.flashT > 0) { this.flashT -= dt; this.el.damageFlash.style.opacity = Math.max(0, this.flashT / 0.35 * 0.45); }
    if (this.centerT > 0) { this.centerT -= dt; if (this.centerT <= 0) this.el.centerMsg.className = ''; }
    if (this.bannerT > 0) { this.bannerT -= dt; if (this.bannerT <= 0) this.el.banner.className = ''; }
    if (fps !== undefined && settings.showFps) this.el.fps.textContent = fps + ' FPS';
  }
}
