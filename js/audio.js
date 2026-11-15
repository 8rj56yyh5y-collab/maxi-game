// Звук: записанные выстрелы и шаги (CC0) + синтез (взрывы, бомба, интерфейс).
import { settings } from './settings.js';
import { A, getAudioContext } from './assets.js';

class Sound {
  constructor() { this.ctx = null; this.stepI = 0; }

  init() {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    if (this.ctx) return;
    this.ctx = ctx;
    this.master = ctx.createGain(); this.master.connect(ctx.destination);
    this.sfx = ctx.createGain(); this.sfx.connect(this.master);
    this.ui = ctx.createGain(); this.ui.connect(this.master);
    this.setVolume();
    const len = ctx.sampleRate;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // реверберация
    const rl = ctx.sampleRate * 1.6, ir = ctx.createBuffer(2, rl, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const c = ir.getChannelData(ch); for (let i = 0; i < rl; i++) c[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / rl, 3.4); }
    this.reverb = ctx.createConvolver(); this.reverb.buffer = ir;
    const wet = ctx.createGain(); wet.gain.value = 0.35; this.reverb.connect(wet); wet.connect(this.sfx);
  }

  setVolume() {
    if (!this.master) return;
    this.master.gain.value = settings.volume;
    this.sfx.gain.value = settings.sfxVolume ?? 1;
    this.ui.gain.value = settings.uiVolume ?? 0.8;
  }

  out(vol, pan, wet = 0, bus) {
    const ctx = this.ctx;
    const g = ctx.createGain(); g.gain.value = vol;
    let node = g;
    if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan || 0)); g.connect(p); node = p; }
    node.connect(bus || this.sfx);
    if (wet > 0) { const w = ctx.createGain(); w.gain.value = wet; g.connect(w); w.connect(this.reverb); }
    return g;
  }

  play(buffer, vol, pan, { rate = 1, wet = 0, lowpass = 0 } = {}) {
    if (!this.ctx || !buffer || vol < 0.005) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = rate * (0.96 + Math.random() * 0.08);
    let dest = this.out(vol, pan, wet);
    if (lowpass) { const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lowpass; f.connect(dest); dest = f; }
    src.connect(dest);
    src.start();
  }

  burst(dest, { dur = 0.15, freq = 1200, q = 0.8, type = 'lowpass', attack = 0.002, gain = 1 }) {
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource(); src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(dest);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
  }

  tone(dest, { f0 = 200, f1 = 60, dur = 0.12, gain = 0.8, type = 'sine', delay = 0 }) {
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    const g = this.ctx.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.02);
  }

  // Выстрел: vol — громкость с учётом расстояния
  shot(kind, vol = 1, pan = 0) {
    if (!this.ctx || vol < 0.01) return;
    if (kind === 'knife') { this.burst(this.out(vol * 0.5, pan), { dur: 0.14, freq: 4500, type: 'bandpass', q: 2, gain: 0.5, attack: 0.03 }); return; }
    const buf = A.sfx['shot_' + kind];
    const far = 1 - Math.min(1, vol);
    if (buf) this.play(buf, Math.min(1, vol) * 0.85, pan, { wet: 0.25 + far * 1.4, lowpass: far > 0.5 ? 2500 : 0 });
    else { const d = this.out(vol, pan, 0.5); this.burst(d, { dur: 0.22, freq: 2400, gain: 0.9 }); this.tone(d, { f0: 160, f1: 45, dur: 0.14, gain: 0.9 }); }
  }

  step(vol = 0.3, pan = 0, surface = 'sand') {
    if (!this.ctx || vol < 0.01) return;
    this.stepI++;
    const side = this.stepI % 2 ? 'l' : 'r';
    const buf = A.sfx[`step_${surface}${side}${1 + Math.floor(Math.random() * 3)}`];
    if (buf) this.play(buf, vol, pan, { rate: 1.05 });
    else this.burst(this.out(vol, pan), { dur: 0.07, freq: 700, gain: 0.5 });
  }

  hit(head) {
    if (!this.ctx) return;
    const d = this.out(0.5, 0, 0, this.ui);
    if (head) { this.tone(d, { f0: 1800, f1: 1400, dur: 0.12, gain: 0.5, type: 'triangle' }); this.burst(d, { dur: 0.08, freq: 6000, type: 'highpass', gain: 0.3 }); }
    else this.tone(d, { f0: 900, f1: 700, dur: 0.06, gain: 0.35, type: 'triangle' });
  }
  hurt() { if (!this.ctx) return; const d = this.out(0.6, 0); this.tone(d, { f0: 140, f1: 60, dur: 0.18, gain: 0.7 }); this.burst(d, { dur: 0.12, freq: 600, gain: 0.4 }); }
  kill() { if (!this.ctx) return; const d = this.out(0.45, 0, 0, this.ui); this.tone(d, { f0: 600, f1: 1200, dur: 0.15, gain: 0.35, type: 'square' }); }
  click() { if (!this.ctx) return; this.tone(this.out(0.25, 0, 0, this.ui), { f0: 1500, f1: 900, dur: 0.03, gain: 0.4, type: 'square' }); }
  uiClick() { this.click(); }
  buy() { if (!this.ctx) return; const d = this.out(0.4, 0, 0, this.ui); this.tone(d, { f0: 900, f1: 1300, dur: 0.08, gain: 0.3, type: 'triangle' }); this.burst(d, { dur: 0.06, freq: 3000, type: 'bandpass', q: 3, gain: 0.4 }); }
  reload() {
    if (!this.ctx) return;
    const d = this.out(0.35, 0);
    this.burst(d, { dur: 0.05, freq: 4000, type: 'bandpass', q: 3, gain: 0.8 });
    setTimeout(() => this.ctx && this.burst(this.out(0.35, 0), { dur: 0.06, freq: 2600, type: 'bandpass', q: 3, gain: 0.9 }), 450);
  }
  explosion(vol = 1, pan = 0) {
    if (!this.ctx) return;
    const d = this.out(Math.min(1.2, vol), pan, 1.2);
    this.burst(d, { dur: 1.4, freq: 900, gain: 1 }); this.tone(d, { f0: 80, f1: 25, dur: 0.9, gain: 1 }); this.burst(d, { dur: 0.3, freq: 4000, gain: 0.6 });
  }
  flashbang(vol = 1, pan = 0) { if (!this.ctx) return; const d = this.out(vol, pan, 0.8); this.burst(d, { dur: 0.5, freq: 5000, type: 'highpass', gain: 1 }); this.tone(d, { f0: 3800, f1: 3700, dur: 2.5, gain: 0.25, type: 'sine', delay: 0.05 }); }
  smokePop(vol = 1, pan = 0) { if (!this.ctx) return; this.burst(this.out(vol * 0.6, pan, 0.4), { dur: 1.8, freq: 1200, gain: 0.6, attack: 0.1 }); }
  beep(vol = 0.5, pan = 0) { if (!this.ctx) return; this.tone(this.out(vol, pan, 0, this.sfx), { f0: 1950, f1: 1950, dur: 0.09, gain: 0.5, type: 'square' }); }
  plant() { if (!this.ctx) return; const d = this.out(0.5, 0); [0, 0.12, 0.24].forEach(t => this.tone(d, { f0: 1400, f1: 1400, dur: 0.06, gain: 0.3, type: 'square', delay: t })); }
  roundStart() { if (!this.ctx) return; const d = this.out(0.4, 0, 0, this.ui); [440, 660].forEach((f, i) => this.tone(d, { f0: f, f1: f, dur: 0.18, gain: 0.3, type: 'triangle', delay: i * 0.15 })); }
  reward() { if (!this.ctx) return; const d = this.out(0.5, 0, 0, this.ui); [523, 659, 784, 1046].forEach((f, i) => this.tone(d, { f0: f, f1: f, dur: 0.2, gain: 0.3, type: 'triangle', delay: i * 0.09 })); }
  win(ok) { if (!this.ctx) return; const d = this.out(0.5, 0, 0, this.ui); (ok ? [523, 659, 784] : [392, 330, 262]).forEach((f, i) => this.tone(d, { f0: f, f1: f, dur: 0.35, gain: 0.3, type: 'triangle', delay: i * 0.18 })); }
}

export const sound = new Sound();
