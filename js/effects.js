// Визуальные эффекты: трассеры, следы от пуль, пыль, искры, кровь, дым.
import * as THREE from 'three';
import { bulletHoleTexture, puffTexture } from './textures.js';

export class Effects {
  constructor(scene) {
    this.scene = scene;
    // Трассеры — вытянутые светящиеся «пули»
    this.tracers = [];
    const trGeo = new THREE.CylinderGeometry(0.008, 0.008, 1, 4, 1, true); trGeo.rotateX(Math.PI / 2); trGeo.translate(0, 0, -0.5);
    for (let i = 0; i < 40; i++) {
      const m = new THREE.Mesh(trGeo, new THREE.MeshBasicMaterial({ color: 0xffe2a0, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
      m.visible = false; m.frustumCulled = false; scene.add(m);
      this.tracers.push({ m, from: new THREE.Vector3(), dir: new THREE.Vector3(), len: 0, t: 0, dist: 0 });
    }
    this.ti = 0;
    // Следы
    const decalGeo = new THREE.PlaneGeometry(0.11, 0.11);
    const decalMat = new THREE.MeshBasicMaterial({ map: bulletHoleTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
    this.decals = [];
    for (let i = 0; i < 120; i++) { const m = new THREE.Mesh(decalGeo, decalMat); m.visible = false; scene.add(m); this.decals.push(m); }
    this.di = 0;
    // Пыль / дым (спрайты)
    this.puffs = [];
    for (let i = 0; i < 60; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTexture(), transparent: true, depthWrite: false, color: 0xcfc0a6 }));
      s.visible = false; scene.add(s);
      this.puffs.push({ s, v: new THREE.Vector3(), t: 0, life: 1, size: 0.3, grow: 1 });
    }
    this.pfi = 0;
    // Частицы (искры, крошка, кровь)
    this.parts = [];
    const pg = new THREE.BoxGeometry(0.03, 0.03, 0.03);
    for (let i = 0; i < 160; i++) {
      const m = new THREE.Mesh(pg, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true }));
      m.visible = false; scene.add(m);
      this.parts.push({ m, v: new THREE.Vector3(), t: 0, life: 0 });
    }
    this.pi = 0;
  }

  tracer(from, to) {
    const tr = this.tracers[this.ti++ % this.tracers.length];
    tr.from.copy(from);
    tr.dir.subVectors(to, from);
    tr.dist = tr.dir.length();
    if (tr.dist < 1) return;
    tr.dir.normalize();
    tr.len = Math.min(3, tr.dist * 0.3);
    tr.t = 0;
    tr.m.visible = true;
    tr.m.scale.set(1, 1, tr.len);
    tr.m.position.copy(from);
    tr.m.lookAt(to);
  }

  impact(point, axis, sign, color = 0xcbb79a) {
    const d = this.decals[this.di++ % this.decals.length];
    const n = new THREE.Vector3(); n.setComponent(axis, sign);
    d.position.copy(point).addScaledVector(n, 0.004);
    d.lookAt(d.position.clone().add(n));
    d.rotateZ(Math.random() * Math.PI);
    d.scale.setScalar(0.7 + Math.random() * 0.6);
    d.visible = true;
    this.burst(point, n, color, 4, 2.2, 0.025);
    this.burst(point, n, 0xffd27a, 2, 5, 0.012);
    this.puff(point, n, color, 0.25, 0.9);
  }

  blood(point) {
    this.burst(point, new THREE.Vector3(0, 0.4, 0), 0x8a0f14, 8, 2, 0.03);
    this.puff(point, new THREE.Vector3(0, 0.2, 0), 0x7a1010, 0.3, 0.5);
  }

  muzzleSmoke(point) { this.puff(point, new THREE.Vector3(0, 0.6, 0), 0xbbbbbb, 0.15, 0.8, 0.35); }

  puff(point, n, color, size, life, alpha = 0.6) {
    const p = this.puffs[this.pfi++ % this.puffs.length];
    p.s.position.copy(point).addScaledVector(n, 0.05);
    p.s.material.color.setHex(color);
    p.s.material.blending = THREE.NormalBlending;
    p.s.material.opacity = alpha;
    p.alpha = alpha;
    p.v.copy(n).multiplyScalar(0.6).add(new THREE.Vector3((Math.random() - 0.5) * 0.3, 0.25, (Math.random() - 0.5) * 0.3));
    p.t = p.life = life; p.size = size; p.s.scale.setScalar(size);
    p.s.visible = true;
  }

  burst(point, dir, color, count, speed, size = 0.03) {
    for (let i = 0; i < count; i++) {
      const p = this.parts[this.pi++ % this.parts.length];
      p.m.position.copy(point);
      p.m.material.color.setHex(color);
      p.m.material.opacity = 1;
      p.m.scale.setScalar(size / 0.03);
      p.v.set(dir.x + (Math.random() - 0.5) * 1.4, dir.y + Math.random() * 1.0, dir.z + (Math.random() - 0.5) * 1.4).multiplyScalar(speed * (0.5 + Math.random()));
      p.t = p.life = 0.3 + Math.random() * 0.35;
      p.m.visible = true;
    }
  }

  update(dt, time = 0) {
    this.time = time;
    if (this.light && this.lightT > 0) { this.lightT -= dt; this.light.intensity *= Math.max(0, 1 - dt * 10); if (this.lightT <= 0) this.light.intensity = 0; }
    for (const g of this.smokes || []) {
      const age = time - g.userData.born, dur = g.userData.dur;
      const k = age < 1 ? age : age > dur - 2 ? Math.max(0, (dur - age) / 2) : 1;
      for (const s of g.children) {
        const grow = Math.min(1, age / 1.2);
        s.scale.setScalar(s.userData.size * (0.4 + 0.6 * grow));
        s.material.opacity = 0.85 * k;
        s.material.rotation += s.userData.spin * dt;
      }
    }
    for (const tr of this.tracers) {
      if (!tr.m.visible) continue;
      tr.t += dt * 320;
      if (tr.t > tr.dist) { tr.m.visible = false; continue; }
      tr.m.position.copy(tr.from).addScaledVector(tr.dir, Math.min(tr.t + tr.len, tr.dist));
    }
    for (const p of this.parts) {
      if (!p.m.visible) continue;
      p.t -= dt;
      p.v.y -= 9 * dt;
      p.m.position.addScaledVector(p.v, dt);
      p.m.material.opacity = Math.max(0, p.t / p.life);
      if (p.t <= 0 || p.m.position.y < 0) p.m.visible = false;
    }
    for (const p of this.puffs) {
      if (!p.s.visible) continue;
      p.t -= dt;
      const k = 1 - p.t / p.life;
      p.s.position.addScaledVector(p.v, dt);
      p.v.multiplyScalar(1 - dt * 2);
      p.s.scale.setScalar(p.size * (1 + k * 2.5));
      p.s.material.opacity = p.alpha * (1 - k);
      if (p.t <= 0) p.s.visible = false;
    }
  }

  // Взрыв: огненный шар + дым + искры + вспышка света
  explosion(pos, scale = 1) {
    if (!this.light) { this.light = new THREE.PointLight(0xffa040, 0, 25, 2); this.scene.add(this.light); this.lightT = 0; }
    this.light.position.copy(pos).setY(pos.y + 0.5); this.light.intensity = 60 * scale; this.lightT = 0.35;
    for (let i = 0; i < 6; i++) {
      const p = this.puffs[this.pfi++ % this.puffs.length];
      p.s.position.copy(pos).add(new THREE.Vector3((Math.random() - 0.5) * scale, Math.random() * scale * 0.6, (Math.random() - 0.5) * scale));
      p.s.material.color.setHex(i < 3 ? 0xffa040 : 0x555046);
      p.s.material.blending = i < 3 ? THREE.AdditiveBlending : THREE.NormalBlending;
      p.alpha = i < 3 ? 1 : 0.8; p.s.material.opacity = p.alpha;
      p.v.set((Math.random() - 0.5) * 2, 1 + Math.random() * 2, (Math.random() - 0.5) * 2);
      p.t = p.life = i < 3 ? 0.45 : 2.2; p.size = scale * (i < 3 ? 1.6 : 1.4); p.s.scale.setScalar(p.size); p.s.visible = true;
    }
    this.burst(pos, new THREE.Vector3(0, 1, 0), 0xffc060, 14, 9, 0.03);
    this.burst(pos, new THREE.Vector3(0, 1, 0), 0x3a3530, 10, 5, 0.06);
  }

  flashPop(pos) {
    if (!this.light) { this.light = new THREE.PointLight(0xffffff, 0, 25, 2); this.scene.add(this.light); }
    this.light.color.set(0xffffff); this.light.position.copy(pos); this.light.intensity = 120; this.lightT = 0.2;
    this.burst(pos, new THREE.Vector3(0, 0.5, 0), 0xffffff, 10, 6, 0.02);
  }

  // Объёмный дым из множества спрайтов
  smoke(pos, r, dur) {
    const group = new THREE.Group();
    const tex = puffTexture();
    const n = 26;
    for (let i = 0; i < n; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xc8c8c4, transparent: true, opacity: 0, depthWrite: false }));
      const a = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * r * 0.75;
      s.position.set(Math.cos(a) * rr, (Math.random() - 0.3) * r * 0.55, Math.sin(a) * rr);
      s.userData = { size: r * (0.9 + Math.random() * 0.7), spin: (Math.random() - 0.5) * 0.3 };
      group.add(s);
    }
    group.position.copy(pos);
    group.userData = { born: this.time || 0, dur };
    this.scene.add(group);
    if (!this.smokes) this.smokes = [];
    this.smokes.push(group);
    return group;
  }

  removeSmoke(s) {
    if (!s || !s.fx) return;
    this.scene.remove(s.fx);
    this.smokes = (this.smokes || []).filter(g => g !== s.fx);
  }

  clearDecals() { for (const d of this.decals) d.visible = false; }

  dispose() {
    for (const tr of this.tracers) this.scene.remove(tr.m);
    for (const d of this.decals) this.scene.remove(d);
    for (const p of this.parts) this.scene.remove(p.m);
    for (const p of this.puffs) this.scene.remove(p.s);
  }
}
