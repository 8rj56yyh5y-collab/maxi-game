// Визуальные эффекты: трассеры, следы от пуль, кровь.
import * as THREE from 'three';

export class Effects {
  constructor(scene) {
    this.scene = scene;
    // Трассеры
    this.tracers = [];
    const tracerMat = new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.85 });
    for (let i = 0; i < 40; i++) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      const line = new THREE.Line(geo, tracerMat.clone());
      line.visible = false; line.frustumCulled = false;
      scene.add(line);
      this.tracers.push({ line, t: 0 });
    }
    this.ti = 0;
    // Следы от пуль
    const decalGeo = new THREE.PlaneGeometry(0.09, 0.09);
    const decalMat = new THREE.MeshBasicMaterial({ color: 0x1a1612, transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
    this.decals = [];
    for (let i = 0; i < 80; i++) {
      const m = new THREE.Mesh(decalGeo, decalMat);
      m.visible = false; scene.add(m);
      this.decals.push(m);
    }
    this.di = 0;
    // Частицы (пыль/кровь)
    this.parts = [];
    const pg = new THREE.BoxGeometry(0.05, 0.05, 0.05);
    for (let i = 0; i < 120; i++) {
      const m = new THREE.Mesh(pg, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true }));
      m.visible = false; scene.add(m);
      this.parts.push({ m, v: new THREE.Vector3(), t: 0, life: 0 });
    }
    this.pi = 0;
  }

  tracer(from, to) {
    const tr = this.tracers[this.ti++ % this.tracers.length];
    const p = tr.line.geometry.attributes.position.array;
    // начинаем немного впереди дула, чтобы трассер не «торчал» из камеры
    p[0] = from.x; p[1] = from.y; p[2] = from.z; p[3] = to.x; p[4] = to.y; p[5] = to.z;
    tr.line.geometry.attributes.position.needsUpdate = true;
    tr.line.geometry.computeBoundingSphere();
    tr.line.visible = true; tr.t = 0.06;
    tr.line.material.opacity = 0.85;
  }

  impact(point, axis, sign, color = 0xcbb79a) {
    const d = this.decals[this.di++ % this.decals.length];
    d.position.copy(point);
    d.rotation.set(0, 0, 0);
    const n = new THREE.Vector3(); n.setComponent(axis, sign);
    d.position.addScaledVector(n, 0.005);
    d.lookAt(d.position.clone().add(n));
    d.rotation.z = Math.random() * Math.PI;
    d.visible = true;
    this.burst(point, n, color, 5, 2.5);
  }

  blood(point) {
    this.burst(point, new THREE.Vector3(0, 0.5, 0), 0xb0141a, 8, 2.2);
  }

  burst(point, dir, color, count, speed) {
    for (let i = 0; i < count; i++) {
      const p = this.parts[this.pi++ % this.parts.length];
      p.m.position.copy(point);
      p.m.material.color.setHex(color);
      p.m.material.opacity = 1;
      p.v.set(dir.x + (Math.random() - 0.5) * 1.6, dir.y + Math.random() * 1.2, dir.z + (Math.random() - 0.5) * 1.6).multiplyScalar(speed * (0.5 + Math.random()));
      p.t = p.life = 0.35 + Math.random() * 0.3;
      p.m.visible = true;
    }
  }

  update(dt) {
    for (const tr of this.tracers) {
      if (!tr.line.visible) continue;
      tr.t -= dt;
      tr.line.material.opacity = Math.max(0, tr.t / 0.06) * 0.85;
      if (tr.t <= 0) tr.line.visible = false;
    }
    for (const p of this.parts) {
      if (!p.m.visible) continue;
      p.t -= dt;
      p.v.y -= 9 * dt;
      p.m.position.addScaledVector(p.v, dt);
      p.m.material.opacity = Math.max(0, p.t / p.life);
      if (p.t <= 0 || p.m.position.y < 0) p.m.visible = false;
    }
  }

  clearDecals() { for (const d of this.decals) d.visible = false; }

  dispose() {
    for (const tr of this.tracers) { this.scene.remove(tr.line); tr.line.geometry.dispose(); }
    for (const d of this.decals) this.scene.remove(d);
    for (const p of this.parts) this.scene.remove(p.m);
  }
}
