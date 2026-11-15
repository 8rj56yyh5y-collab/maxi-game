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

// Небо + свет + карта окружения для отражений
export function setupAtmosphere(renderer, scene, def, quality, hdri = null) {
  const sky = new Sky();
  sky.scale.setScalar(900);
  const u = sky.material.uniforms;
  u.turbidity.value = def.sky.turbidity;
  u.rayleigh.value = def.sky.rayleigh;
  u.mieCoefficient.value = def.sky.mie;
  u.mieDirectionalG.value = 0.8;
  const sunDir = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - def.sky.elevation), THREE.MathUtils.degToRad(def.sky.azimuth));
  u.sunPosition.value.copy(sunDir);
  scene.add(sky);

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

const VignetteShader = {
  uniforms: { tDiffuse: { value: null }, strength: { value: 0.32 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float strength; varying vec2 vUv;
    void main(){ vec4 c = texture2D(tDiffuse, vUv); vec2 d = vUv - 0.5; float v = 1.0 - dot(d, d) * strength * 2.2;
    c.rgb *= v; c.rgb = mix(vec3(dot(c.rgb, vec3(0.299,0.587,0.114))), c.rgb, 1.08); gl_FragColor = c; }`,
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
    if (settings.bloom || settings.ao) {
      const size = r.getDrawingBufferSize(new THREE.Vector2());
      const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });
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
      c.addPass(new ShaderPass(VignetteShader));
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
  }

  dispose() {
    if (this.composer) { this.composer.renderTarget1.dispose(); this.composer.renderTarget2.dispose(); this.composer = null; }
  }
}
