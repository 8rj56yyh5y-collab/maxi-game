// Рендер: небо, освещение, тени, пост-обработка.
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { settings } from './settings.js';

// Ночное небо: градиент, звёзды, луна
function nightSky() {
  const g = new THREE.Group();
  const geo = new THREE.SphereGeometry(800, 32, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {},
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `varying vec3 vP; void main(){ float h = clamp(vP.y, -0.1, 1.0);
      vec3 top = vec3(0.012, 0.016, 0.05), mid = vec3(0.07, 0.05, 0.16), hor = vec3(0.32, 0.12, 0.28);
      vec3 c = mix(hor, mid, smoothstep(0.0, 0.18, h)); c = mix(c, top, smoothstep(0.18, 0.75, h));
      gl_FragColor = vec4(c, 1.0); }`,
  });
  g.add(new THREE.Mesh(geo, mat));
  const n = 1400, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const th = Math.random() * Math.PI * 2, y = 0.08 + Math.random() * 0.92, r = Math.sqrt(1 - y * y);
    pos[i * 3] = Math.cos(th) * r * 700; pos[i * 3 + 1] = y * 700; pos[i * 3 + 2] = Math.sin(th) * r * 700;
  }
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.add(new THREE.Points(pg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85 })));
  const moon = new THREE.Mesh(new THREE.CircleGeometry(22, 32), new THREE.MeshBasicMaterial({ color: 0xfff6e0, fog: false }));
  moon.position.set(-250, 380, -450); moon.lookAt(0, 0, 0); g.add(moon);
  return g;
}

// Небо + свет + карта окружения для отражений
export function setupAtmosphere(renderer, scene, def, quality, hdri = null) {
  const sky = def.night ? nightSky() : new Sky();
  if (!def.night) sky.scale.setScalar(900);
  const u = def.night ? new Sky().material.uniforms : sky.material.uniforms;
  u.turbidity.value = def.sky.turbidity;
  u.rayleigh.value = def.sky.rayleigh;
  u.mieCoefficient.value = def.sky.mie;
  u.mieDirectionalG.value = 0.8;
  const sunDir = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - def.sky.elevation), THREE.MathUtils.degToRad(def.sky.azimuth));
  u.sunPosition.value.copy(sunDir);
  if (def.skyImage) {
    // фотопанорама неба вместо процедурного
    const t = new THREE.TextureLoader().load(def.skyImage, () => { scene.background = t; });
    t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace;
    scene.backgroundIntensity = def.skyIntensity || 1;
    scene.backgroundRotation.set(0, 0, 0);
  } else scene.add(sky);

  // Окружение (отражения/рассеянный свет): HDRI-панорама или небо
  const pmrem = new THREE.PMREMGenerator(renderer);
  let env;
  if (hdri) env = pmrem.fromEquirectangular(hdri).texture;
  else {
    const envScene = new THREE.Scene();
    const sky2 = new Sky(); sky2.scale.setScalar(1000);
    for (const k of Object.keys(u)) sky2.material.uniforms[k].value = u[k].value;
    envScene.add(sky2);
    env = pmrem.fromScene(envScene, 0.02).texture;
  }
  pmrem.dispose();
  scene.environment = env;
  scene.environmentIntensity = def.envI || 0.55;

  const hemi = new THREE.HemisphereLight(def.hemi[0], def.hemi[1], def.hemi[2]);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(def.sun, def.sunI);
  sun.position.copy(sunDir).multiplyScalar(60);
  const sh = settings.shadows || (quality === 'low' ? 'off' : 'medium');
  if (sh !== 'off') {
    sun.castShadow = true;
    const sz = sh === 'medium' ? 2048 : 4096;
    sun.shadow.mapSize.set(sz, sz);
    const ext = sh === 'ultra' ? 30 : sh === 'high' ? 38 : 34;
    Object.assign(sun.shadow.camera, { left: -ext, right: ext, top: ext, bottom: -ext, near: 1, far: 200 });
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.04;
    sun.shadow.radius = 2;
  }
  scene.add(sun); scene.add(sun.target);
  scene.fog = new THREE.FogExp2(def.fog[0], def.fog[1]);
  return { sun, sunDir, exposure: def.sky.exposure, env, sky };
}

// Тень следует за игроком (с привязкой к текселям — без мерцания)
export function followShadow(sun, sunDir, center) {
  if (!sun.castShadow) return;
  const cam = sun.shadow.camera;
  const texel = (cam.right - cam.left) / sun.shadow.mapSize.x;
  const x = Math.round(center.x / texel) * texel, z = Math.round(center.z / texel) * texel;
  sun.target.position.set(x, 0, z);
  sun.position.set(x + sunDir.x * 80, sunDir.y * 80, z + sunDir.z * 80);
  sun.target.updateMatrixWorld();
}

// Финальная цветокоррекция: резкость, контраст, насыщенность, тёплые света / холодные тени, виньетка
const VignetteShader = {
  uniforms: { tDiffuse: { value: null }, strength: { value: 0.3 }, texel: { value: new THREE.Vector2(1 / 1280, 1 / 720) }, sharp: { value: 0.35 }, contrast: { value: 1.08 }, sat: { value: 1.12 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float strength, sharp, contrast, sat; uniform vec2 texel; varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      vec3 n = texture2D(tDiffuse, vUv + vec2(texel.x, 0.)).rgb + texture2D(tDiffuse, vUv - vec2(texel.x, 0.)).rgb + texture2D(tDiffuse, vUv + vec2(0., texel.y)).rgb + texture2D(tDiffuse, vUv - vec2(0., texel.y)).rgb;
      c.rgb = clamp(c.rgb + (c.rgb - n * 0.25) * sharp, 0.0, 1.0);
      float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
      c.rgb = mix(vec3(l), c.rgb, sat);
      c.rgb = (c.rgb - 0.5) * contrast + 0.5;
      c.rgb += mix(vec3(-0.012, 0.0, 0.02), vec3(0.025, 0.012, -0.015), smoothstep(0.15, 0.85, l));
      vec2 d = vUv - 0.5; c.rgb *= 1.0 - dot(d, d) * strength * 2.0;
      gl_FragColor = vec4(clamp(c.rgb, 0.0, 1.0), c.a);
    }`,
};

// Конвейер вывода: мир → оружие в руках → (bloom) → тонмаппинг
export class Pipeline {
  constructor(renderer) {
    this.renderer = renderer;
    this.composer = null;
  }

  setup(scene, camera, vmScene, vmCamera, exposure) {
    const r = this.renderer;
    this.scene = scene; this.camera = camera; this.vmScene = vmScene; this.vmCamera = vmCamera;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = exposure;
    this.dispose(); this.vmPass = null;
    const grade = settings.grade !== false && settings.quality !== 'low';
    if (settings.bloom || settings.ao || grade) {
      const size = r.getDrawingBufferSize(new THREE.Vector2());
      const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: settings.quality === 'medium' ? 2 : 4 });
      const c = new EffectComposer(r, rt);
      c.addPass(new RenderPass(scene, camera));
      if (vmScene) {
        const vp = new RenderPass(vmScene, vmCamera);
        vp.clear = false; vp.clearDepth = true;
        c.addPass(vp); this.vmPass = vp;
      }
      if (settings.ao) { const ao = new GTAOPass(scene, camera, size.x, size.y); ao.blendIntensity = 0.8; c.passes.splice(1, 0, ao); ao.renderToScreen = false; this.aoPass = ao; }
      if (settings.bloom) c.addPass(new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.3, 0.5, 0.92));
      c.addPass(new OutputPass());
      const gp = new ShaderPass(VignetteShader); c.addPass(gp); this.gradePass = gp;
      this.composer = c;
      this.resize();
    }
  }

  render(showVM = true) {
    const r = this.renderer;
    if (this.composer) {
      if (this.vmPass) this.vmPass.enabled = showVM;
      this.composer.render();
      return;
    }
    r.clear();
    r.render(this.scene, this.camera);
    if (this.vmScene && showVM) { r.clearDepth(); r.render(this.vmScene, this.vmCamera); }
  }

  resize() {
    if (!this.composer) return;
    const size = this.renderer.getSize(new THREE.Vector2());
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(size.x, size.y);
    if (this.gradePass) { const pr = this.renderer.getPixelRatio(); this.gradePass.uniforms.texel.value.set(1 / (size.x * pr), 1 / (size.y * pr)); }
  }

  dispose() {
    if (this.composer) { this.composer.renderTarget1.dispose(); this.composer.renderTarget2.dispose(); this.composer = null; }
  }
}
