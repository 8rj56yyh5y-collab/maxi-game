#!/usr/bin/env python3
"""Сборка ассетов игры из CC0-источников.

Источники (все CC0, см. LICENSES.md):
  - https://github.com/petroulacl/fps-asset-kit  (текстуры ambientCG, оружие Flat Guns, звуки)
  - https://github.com/mrdoob/three.js           (examples: Soldier.glb, HDRI Poly Haven)

Использование:
  python3 tools/build_assets.py <путь к fps-asset-kit> <путь к three.js>
"""
import sys, os, subprocess, shutil
import numpy as np

KIT, THREE = sys.argv[1], sys.argv[2]
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets')

def run(*a):
    subprocess.run(a, check=True, capture_output=True)

# ---------- звуки: вырезаем одиночный выстрел ----------
SFX = os.path.join(KIT, 'sfx', 'firearm_sfx', 'Prepared SFX Library')
SHOTS = {
    'rifle_w':  ('AR-15/D_24P.wav', 0, 1.1),
    'rifle_e':  ('SKS/U_14P.wav', 0, 1.1),
    'battle':   ('Savage 10 .300 Blackout/T_17P.wav', 0, 1.2),
    'smg':      ('Carl Gustav M45/G_20P.wav', 0, 0.8),
    'smg2':     ('PPSh/P_16P.wav', 0, 0.25),
    'pistol':   ('Walther PPQ/X_31P.wav', 0, 0.9),
    'pistol_h': ('1911/A_34P.wav', 0, 1.0),
    'pistol_c': ('Bersa/F_41P.wav', 0, 0.8),
    'shotgun':  ('Mossberg/N_26P.wav', 0, 1.3),
    'shotgun2': ('Nova/O_17P.wav', 0, 1.3),
    'sniper':   ('Tikka/W_24P.wav', 0, 1.8),
    'sniper2':  ('Mosin Nagant/M_21P.wav', 0, 1.8),
}

def load(path, sr=44100):
    raw = subprocess.run(['ffmpeg', '-v', 'quiet', '-i', path, '-ac', '1', '-ar', str(sr), '-f', 'f32le', '-'], capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy(), sr

def onsets(a, sr):
    hop = int(sr * 0.005)
    env = np.array([np.abs(a[i:i + hop]).max() for i in range(0, len(a), hop)])
    pk = env.max(); res = []; quiet = True
    for i, e in enumerate(env):
        if quiet and e > pk * 0.3:
            res.append(i * hop); quiet = False
        elif not quiet and e < pk * 0.02:
            quiet = True
    return res

def write(a, sr, name):
    tmp = os.path.join(OUT, 'sfx', name + '.f32')
    a.astype(np.float32).tofile(tmp)
    run('ffmpeg', '-y', '-v', 'quiet', '-f', 'f32le', '-ar', str(sr), '-ac', '1', '-i', tmp, '-c:a', 'libmp3lame', '-b:a', '96k', os.path.join(OUT, 'sfx', name + '.mp3'))
    os.remove(tmp)

for name, (f, take, length) in SHOTS.items():
    a, sr = load(os.path.join(SFX, f))
    on = onsets(a, sr)
    s = max(0, on[take] - int(sr * 0.004))
    end = s + int(sr * length)
    nxt = [o for o in on if o > s + int(sr * min(0.6, length * 0.8))]
    if nxt: end = min(end, nxt[0] - int(sr * 0.002))
    seg = a[s:end].copy()
    n = len(seg); fade = int(n * 0.35)
    seg[-fade:] *= np.linspace(1, 0, fade) ** 2
    seg /= max(1e-6, np.abs(seg).max()) / 0.95
    write(seg, sr, 'shot_' + name)
    print('shot', name, round(n / sr, 2), 's')

STEPS = os.path.join(KIT, 'sfx', 'footsteps', 'Fantozzi-footsteps', 'ogg')
for f in sorted(os.listdir(STEPS)):
    a, sr = load(os.path.join(STEPS, f))
    a /= max(1e-6, np.abs(a).max()) / 0.9
    write(a, sr, 'step_' + f.replace('Fantozzi-', '').replace('.ogg', '').lower())

# ---------- текстуры ambientCG → 1024 / 512 ----------
TEX = {
    'plaster': 'Plaster007', 'plaster2': 'Plaster001', 'plaster3': 'Plaster002',
    'bricks': 'Bricks097', 'bricks2': 'Bricks102', 'bricks3': 'Bricks104',
    'concrete': 'Concrete047A', 'concrete2': 'Concrete034', 'concrete3': 'Concrete048',
    'metal': 'Metal049A', 'metal2': 'Metal055A', 'metal3': 'Metal063',
    'asphalt': 'Asphalt025C', 'asphalt2': 'Asphalt031',
    'ground': 'Ground054', 'ground2': 'Ground037', 'ground3': 'Ground103',
    'rock': 'Rock063', 'wood': 'Wood092', 'wood2': 'Wood094', 'wood3': 'Wood095',
}
for name, src in TEX.items():
    d = os.path.join(KIT, 'textures', src)
    for suf, key, size, q in [('Color', 'c', 1024, 82), ('NormalGL', 'n', 1024, 88), ('Roughness', 'r', 512, 80)]:
        p = os.path.join(d, f'{src}_2K-JPG_{suf}.jpg')
        if not os.path.exists(p): continue
        run('convert', p, '-resize', f'{size}x{size}', '-strip', '-quality', str(q), os.path.join(OUT, 'tex', f'{name}_{key}.jpg'))
        run('convert', p, '-resize', f'{size // 2}x{size // 2}', '-strip', '-quality', str(q), os.path.join(OUT, 'tex', f'{name}_{key}_s.jpg'))
    print('tex', name)

# ---------- модели ----------
W = os.path.join(KIT, 'weapons')
for side in ('West', 'East'):
    gd = os.path.join(W, f'flat_guns_{side.lower()}', f'Flat Guns {side}', 'GLB')
    for f in os.listdir(gd):
        shutil.copy(os.path.join(gd, f), os.path.join(OUT, 'weapons', f))
shutil.copy(os.path.join(THREE, 'examples/models/gltf/Soldier.glb'), os.path.join(OUT, 'chars', 'soldier.glb'))
for h in ('quarry_01_1k', 'venice_sunset_1k', 'blouberg_sunrise_2_1k'):
    shutil.copy(os.path.join(THREE, f'examples/textures/equirectangular/{h}.hdr'), os.path.join(OUT, 'hdri', h + '.hdr'))
print('done')
