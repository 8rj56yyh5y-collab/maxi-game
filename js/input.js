// Ввод: клавиатура+мышь и сенсорное управление с настраиваемыми кнопками.
import { settings, getLayout, isTouchMode } from './settings.js';

export const BTN_ICONS = {
  fire: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2v6M12 16v6M2 12h6M16 12h6" stroke="currentColor" stroke-width="2"/></svg>',
  fireL: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2v6M12 16v6M2 12h6M16 12h6" stroke="currentColor" stroke-width="2"/></svg>',
  aim: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="2" fill="currentColor"/></svg>',
  jump: '<svg viewBox="0 0 24 24"><path d="M12 4l7 8h-4v8H9v-8H5z" fill="currentColor"/></svg>',
  crouch: '<svg viewBox="0 0 24 24"><path d="M12 20l7-8h-4V4H9v8H5z" fill="currentColor"/></svg>',
  reload: '<svg viewBox="0 0 24 24"><path d="M19 12a7 7 0 1 1-2-4.9M19 4v4h-4" fill="none" stroke="currentColor" stroke-width="2.4"/></svg>',
  weapon: '<svg viewBox="0 0 24 24"><path d="M3 10h14l2-2h2v4h-3l-1 1h-4l-1 5H9l1-5H3z" fill="currentColor"/></svg>',
  grenade: '<svg viewBox="0 0 24 24"><circle cx="12" cy="14" r="6" fill="currentColor"/><path d="M10 7h4v2h-4zM14 6l4-2" stroke="currentColor" stroke-width="2"/></svg>',
  use: '<svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm-1 5h2v5h-2zm0 7h2v2h-2z" fill="currentColor"/></svg>',
  buy: '<svg viewBox="0 0 24 24"><path d="M4 5h2l2 10h10l2-7H7" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="9" cy="19" r="1.6" fill="currentColor"/><circle cx="17" cy="19" r="1.6" fill="currentColor"/></svg>',
  score: '<svg viewBox="0 0 24 24"><path d="M4 5h16M4 12h16M4 19h16" stroke="currentColor" stroke-width="2.4"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><path d="M7 5h3v14H7zM14 5h3v14h-3z" fill="currentColor"/></svg>',
};

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set();
    this.lookX = 0; this.lookY = 0;
    this.moveX = 0; this.moveZ = 0;
    this.mouseFire = false; this.touchFire = 0; this.touchUse = 0;
    this.aim = false;
    this.crouchToggle = false;
    this.locked = false;
    this.enabled = false;
    this.touch = isTouchMode();
    this.touches = new Map();
    this.showScore = false;
    this.onPause = null;
    this._bindDesktop();
  }

  get fire() { return this.mouseFire || this.touchFire > 0; }
  get crouch() { return this.keys.has('ControlLeft') || this.keys.has('KeyC') || this.crouchToggle; }
  get useHeld() { return this.keys.has('KeyE') || this.touchUse > 0; }
  get walk() { return this.keys.has('ShiftLeft'); }
  get scoreboard() { return this.keys.has('Tab') || this.showScore; }
  was(name) { return this.pressed.has(name); }

  endFrame() { this.pressed.clear(); this.lookX = 0; this.lookY = 0; }

  reset() {
    this.keys.clear(); this.pressed.clear(); this.mouseFire = false; this.touchFire = 0; this.touchUse = 0; this.touchUse = 0;
    this.aim = false; this.crouchToggle = false; this.moveX = this.moveZ = 0; this.touches.clear();
    this.showScore = false;
    if (this.knob) this._resetJoystick();
  }

  _bindDesktop() {
    window.addEventListener('keydown', (e) => {
      if (!this.enabled) return;
      if (e.code === 'Tab') e.preventDefault();
      if (e.repeat) return;
      this.keys.add(e.code);
      const map = { Space: 'jump', KeyR: 'reload', Digit1: 'slot0', Digit2: 'slot1', Digit3: 'slot2', Digit4: 'slot3', Digit5: 'slot4', KeyQ: 'lastWeapon', KeyF: 'inspect', KeyB: 'buy', KeyG: 'drop' };
      if (map[e.code]) this.pressed.add(map[e.code]);
    });
    window.addEventListener('keyup', (e) => { this.keys.delete(e.code); });
    window.addEventListener('blur', () => { this.keys.clear(); this.mouseFire = false; });
    document.addEventListener('mousemove', (e) => {
      if (!this.enabled || !this.locked) return;
      // после захвата курсора браузер иногда присылает огромный скачок — игнорируем
      if (performance.now() - this.lockTime < 120 || Math.abs(e.movementX) > 400 || Math.abs(e.movementY) > 400) return;
      const k = 0.0022 * settings.sens;
      this.lookX += e.movementX * k;
      this.lookY += e.movementY * k * (settings.invertY ? -1 : 1);
    });
    this.canvas.addEventListener('mousedown', (e) => {
      if (!this.enabled || this.touch) return;
      if (!this.locked) { this.requestLock(); return; }
      if (e.button === 0) this.mouseFire = true;
      if (e.button === 2) this.pressed.add('aim');
    });
    window.addEventListener('mouseup', (e) => { if (e.button === 0) this.mouseFire = false; });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('wheel', (e) => {
      if (!this.enabled || !this.locked) return;
      this.pressed.add(e.deltaY > 0 ? 'nextWeapon' : 'prevWeapon');
    }, { passive: true });
    document.addEventListener('pointerlockchange', () => {
      const was = this.locked;
      this.locked = document.pointerLockElement === this.canvas;
      this.lockTime = performance.now();
      if (was && !this.locked && this.enabled && !this.touch && this.onPause) this.onPause();
    });
  }

  // Гироскоп (телефоны): поворот устройства добавляется к обзору
  enableGyro(on) {
    this.gyroOn = on;
    if (!on || this._gyroBound) return;
    const start = () => {
      this._gyroBound = true;
      window.addEventListener('deviceorientation', (e) => {
        if (!this.enabled || !this.gyroOn || e.beta === null) return;
        const landscape = Math.abs(window.orientation || (screen.orientation && screen.orientation.angle) || 0) === 90;
        const x = landscape ? e.beta : e.gamma, y = landscape ? e.gamma : e.beta;
        if (this._gPrev) {
          let dx = x - this._gPrev.x, dy = y - this._gPrev.y;
          if (Math.abs(dx) > 20 || Math.abs(dy) > 20) { dx = 0; dy = 0; }
          if (settings.gyroAimOnly && !this.aimingNow) { dx = 0; dy = 0; }
          const k = 0.017 * settings.gyroSens;
          const sgn = (window.orientation || (screen.orientation && screen.orientation.angle) || 0) < 0 ? -1 : 1;
          this.lookX += dx * k * sgn; this.lookY += -dy * k * sgn * (settings.invertY ? -1 : 1);
        }
        this._gPrev = { x, y };
      });
    };
    if (typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) DeviceOrientationEvent.requestPermission().then(r => r === 'granted' && start()).catch(() => {});
    else start();
  }

  requestLock() {
    if (this.touch) return;
    try {
      const p = this.canvas.requestPointerLock({ unadjustedMovement: true });
      if (p && p.catch) p.catch(() => { try { const p2 = this.canvas.requestPointerLock(); if (p2 && p2.catch) p2.catch(() => {}); } catch (e) { /* ignore */ } });
    } catch (e) { try { this.canvas.requestPointerLock(); } catch (e2) { /* ignore */ } }
  }

  exitLock() { if (document.pointerLockElement) document.exitPointerLock(); }

  updateMove() {
    if (this.joyActive) return;
    let x = 0, z = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) z += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) z -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    const l = Math.hypot(x, z);
    this.moveX = l ? x / l : 0; this.moveZ = l ? z / l : 0;
  }

  // ---------- Сенсорное управление ----------
  buildTouchUI(container) {
    this.touchRoot = container;
    container.innerHTML = '';
    if (!this.touch) { container.style.display = 'none'; return; }
    container.style.display = 'block';
    const layout = getLayout();
    for (const [name, l] of Object.entries(layout)) {
      if (name === 'fireL' && l.enabled === false) continue;
      const el = document.createElement('div');
      el.dataset.btn = name;
      el.className = 'tbtn ' + (name === 'joystick' ? 'joy' : '');
      el.style.left = l.x + '%'; el.style.top = l.y + '%';
      el.style.width = el.style.height = l.size + 'px';
      el.style.opacity = l.opacity;
      if (name === 'joystick') {
        el.innerHTML = '<div class="knob"></div>';
        this.joyEl = el; this.knob = el.firstChild; this.joyHome = { x: l.x, y: l.y };
      } else el.innerHTML = BTN_ICONS[name] || name;
      container.appendChild(el);
    }
    if (!this._touchBound) {
      this._touchBound = true;
      const opt = { passive: false };
      container.addEventListener('touchstart', (e) => this._tStart(e), opt);
      container.addEventListener('touchmove', (e) => this._tMove(e), opt);
      container.addEventListener('touchend', (e) => this._tEnd(e), opt);
      container.addEventListener('touchcancel', (e) => this._tEnd(e), opt);
    }
  }

  _tStart(e) {
    e.preventDefault();
    if (!this.enabled) return;
    for (const t of e.changedTouches) {
      const btnEl = t.target.closest && t.target.closest('[data-btn]');
      const btn = btnEl ? btnEl.dataset.btn : null;
      const info = { x: t.clientX, y: t.clientY, kind: 'look', el: btnEl };
      if (btn && btn !== 'joystick') {
        btnEl.classList.add('down');
        if (btn === 'fire' || btn === 'fireL') { info.kind = 'fire'; this.touchFire++; }
        else {
          info.kind = 'btn';
          if (btn === 'aim') { if (settings.aimToggle) this.pressed.add('aim'); else { this.pressed.add('aim'); info.aimHold = true; } }
          if (btn === 'jump') this.pressed.add('jump');
          if (btn === 'crouch') { this.crouchToggle = !this.crouchToggle; btnEl.classList.toggle('on', this.crouchToggle); }
          if (btn === 'reload') this.pressed.add('reload');
          if (btn === 'weapon') this.pressed.add('nextWeapon');
          if (btn === 'grenade') this.pressed.add('grenade');
          if (btn === 'buy') this.pressed.add('buy');
          if (btn === 'use') { this.touchUse++; info.useHold = true; }
          if (btn === 'score') this.showScore = !this.showScore;
          if (btn === 'pause' && this.onPause) this.onPause();
        }
      } else if (!this.joyActive && t.clientX < window.innerWidth * 0.45) {
        info.kind = 'joy';
        this.joyActive = true; this.joyId = t.identifier;
        this.joyCenter = { x: t.clientX, y: t.clientY };
        this.joyEl.style.left = t.clientX + 'px'; this.joyEl.style.top = t.clientY + 'px';
        this.joyEl.classList.add('down');
      }
      this.touches.set(t.identifier, info);
    }
  }

  _tMove(e) {
    e.preventDefault();
    if (!this.enabled) return;
    for (const t of e.changedTouches) {
      const info = this.touches.get(t.identifier);
      if (!info) continue;
      const dx = t.clientX - info.x, dy = t.clientY - info.y;
      if (info.kind === 'look' || info.kind === 'fire') {
        const k = 0.0042 * settings.touchSens * (this.aimMult || 1);
        this.lookX += dx * k;
        this.lookY += dy * k * (settings.invertY ? -1 : 1);
        info.x = t.clientX; info.y = t.clientY;
      } else if (info.kind === 'joy') {
        const rad = this.joyEl.offsetWidth / 2;
        let jx = t.clientX - this.joyCenter.x, jy = t.clientY - this.joyCenter.y;
        const len = Math.hypot(jx, jy);
        if (len > rad) { jx *= rad / len; jy *= rad / len; }
        this.knob.style.transform = `translate(${jx}px, ${jy}px)`;
        let mx = jx / rad, mz = -jy / rad;
        const m = Math.hypot(mx, mz);
        if (m < 0.12) { mx = 0; mz = 0; }
        this.moveX = mx; this.moveZ = mz;
      }
    }
  }

  _tEnd(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      const info = this.touches.get(t.identifier);
      if (!info) continue;
      if (info.el) info.el.classList.remove('down');
      if (info.kind === 'fire') this.touchFire = Math.max(0, this.touchFire - 1);
      if (info.aimHold) this.pressed.add('aim');
      if (info.useHold) this.touchUse = Math.max(0, this.touchUse - 1);
      if (info.kind === 'joy') { this.joyActive = false; this._resetJoystick(); }
      this.touches.delete(t.identifier);
    }
  }

  _resetJoystick() {
    this.moveX = 0; this.moveZ = 0;
    if (!this.knob) return;
    this.knob.style.transform = '';
    this.joyEl.style.left = this.joyHome.x + '%'; this.joyEl.style.top = this.joyHome.y + '%';
    this.joyEl.classList.remove('down');
  }
}
