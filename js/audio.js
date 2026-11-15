// Синтезированные звуки через WebAudio — никаких внешних файлов.
import { settings } from './settings.js';

class Sound {
  constructor() { this.ctx = null; }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.connect(this.ctx.destination);
    this.setVolume(settings.volume);
    const len = this.ctx.sampleRate * 1.0;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    // реверберация (эхо улиц)
    const rl = this.ctx.sampleRate * 1.4, ir = this.ctx.createBuffer(2, rl, this.ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < rl; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / rl, 3.2) * (i < 600 ? i / 600 : 1);
    }
    this.reverb = this.ctx.createConvolver(); this.reverb.buffer = ir;
    this.wet = this.ctx.createGain(); this.wet.gain.value = 0.32;
    this.reverb.connect(this.wet); this.wet.connect(this.master);
  }

  setVolume(v) { if (this.master) this.master.gain.value = v; }

  out(vol, pan, wet = 0) {
    const g = this.ctx.createGain();
    g.gain.value = vol;
    if (wet > 0 && this.reverb) { const w = this.ctx.createGain(); w.gain.value = wet; g.connect(w); w.connect(this.reverb); }
    if (this.ctx.createStereoPanner) {
      const p = this.ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan || 0));
      g.connect(p); p.connect(this.master);
    } else g.connect(this.master);
    return g;
  }

  burst(dest, { dur = 0.15, freq = 1200, q = 0.8, type = 'lowpass', attack = 0.002, gain = 1 }) {
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = this.ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(dest);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
  }

  tone(dest, { f0 = 200, f1 = 60, dur = 0.12, gain = 0.8, type = 'sine' }) {
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(dest);
    o.start(t); o.stop(t + dur + 0.02);
  }

  shot(kind, vol = 1, pan = 0) {
    if (!this.ctx || vol < 0.01) return;
    // далёкие выстрелы — больше эха и меньше высоких частот
    const d = this.out(vol, pan, 0.6 + (1 - vol) * 1.2);
    switch (kind) {
      case 'rifle':
        this.burst(d, { dur: 0.22, freq: 2400, gain: 0.9 });
        this.tone(d, { f0: 160, f1: 45, dur: 0.14, gain: 0.9 });
        break;
      case 'smg':
        this.burst(d, { dur: 0.13, freq: 3200, gain: 0.7 });
        this.tone(d, { f0: 220, f1: 70, dur: 0.08, gain: 0.6 });
        break;
      case 'sniper':
        this.burst(d, { dur: 0.6, freq: 1500, gain: 1 });
        this.tone(d, { f0: 120, f1: 30, dur: 0.35, gain: 1 });
        this.burst(d, { dur: 0.9, freq: 500, gain: 0.3, attack: 0.05 });
        break;
      case 'shotgun':
        this.burst(d, { dur: 0.4, freq: 1200, gain: 1 });
        this.tone(d, { f0: 110, f1: 35, dur: 0.25, gain: 1 });
        break;
      case 'pistol':
        this.burst(d, { dur: 0.14, freq: 3000, gain: 0.7 });
        this.tone(d, { f0: 260, f1: 80, dur: 0.07, gain: 0.5 });
        break;
      case 'knife':
        this.burst(d, { dur: 0.12, freq: 5000, type: 'bandpass', q: 2, gain: 0.4, attack: 0.03 });
        break;
    }
  }

  hit(head) {
    if (!this.ctx) return;
    const d = this.out(0.5, 0);
    if (head) { this.tone(d, { f0: 1800, f1: 1400, dur: 0.12, gain: 0.5, type: 'triangle' }); this.burst(d, { dur: 0.08, freq: 6000, type: 'highpass', gain: 0.3 }); }
    else this.tone(d, { f0: 900, f1: 700, dur: 0.06, gain: 0.35, type: 'triangle' });
  }

  hurt() {
    if (!this.ctx) return;
    const d = this.out(0.6, 0);
    this.tone(d, { f0: 140, f1: 60, dur: 0.18, gain: 0.7 });
    this.burst(d, { dur: 0.12, freq: 600, gain: 0.4 });
  }

  kill() {
    if (!this.ctx) return;
    const d = this.out(0.5, 0);
    this.tone(d, { f0: 600, f1: 1200, dur: 0.15, gain: 0.35, type: 'square' });
  }

  step(vol = 0.3, pan = 0) {
    if (!this.ctx || vol < 0.01) return;
    this.burst(this.out(vol, pan), { dur: 0.07, freq: 700, gain: 0.5 });
  }

  click() {
    if (!this.ctx) return;
    this.tone(this.out(0.3, 0), { f0: 1500, f1: 900, dur: 0.03, gain: 0.4, type: 'square' });
  }

  reload() {
    if (!this.ctx) return;
    const d = this.out(0.35, 0);
    this.burst(d, { dur: 0.05, freq: 4000, type: 'bandpass', q: 3, gain: 0.8 });
    setTimeout(() => this.ctx && this.burst(this.out(0.35, 0), { dur: 0.06, freq: 3000, type: 'bandpass', q: 3, gain: 0.8 }), 350);
  }

  ui() { this.click(); }

  reward() {
    if (!this.ctx) return;
    const d = this.out(0.5, 0);
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.tone(d, { f0: f, f1: f, dur: 0.2, gain: 0.3, type: 'triangle' }), i * 90));
  }
}

export const sound = new Sound();
