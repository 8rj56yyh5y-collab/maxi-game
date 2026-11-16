// Настройки игрока. Хранятся в localStorage.
const KEY = 'maxi_settings_v2';

// Сенсорные кнопки: x, y — центр в % экрана, size — диаметр в px.
export const DEFAULT_LAYOUT = {
  joystick: { x: 13, y: 70, size: 150, opacity: 0.5 },
  fire:     { x: 86, y: 64, size: 92,  opacity: 0.6 },
  fireL:    { x: 9,  y: 36, size: 68,  opacity: 0.5 },
  aim:      { x: 94, y: 42, size: 60,  opacity: 0.5 },
  jump:     { x: 78, y: 85, size: 64,  opacity: 0.5 },
  crouch:   { x: 91, y: 86, size: 60,  opacity: 0.5 },
  reload:   { x: 76, y: 44, size: 54,  opacity: 0.5 },
  weapon:   { x: 50, y: 88, size: 58,  opacity: 0.5 },
  grenade:  { x: 64, y: 88, size: 52,  opacity: 0.5 },
  use:      { x: 70, y: 66, size: 60,  opacity: 0.6 },
  buy:      { x: 4,  y: 58, size: 48,  opacity: 0.5 },
  score:    { x: 76, y: 8,  size: 44,  opacity: 0.5 },
  pause:    { x: 96, y: 8,  size: 44,  opacity: 0.5 },
};

export const BUTTON_LABELS = {
  joystick: 'Движение', fire: 'Огонь', fireL: 'Огонь (лев.)', aim: 'Прицел', jump: 'Прыжок', crouch: 'Присед',
  reload: 'Перезарядка', weapon: 'Оружие', grenade: 'Граната', use: 'Действие', buy: 'Закупка', score: 'Счёт', pause: 'Пауза',
};

const DEFAULTS = {
  // Управление
  sens: 1.0, aimSens: 0.8, scopeSens: 0.55, touchSens: 1.0, touchAimSens: 0.75, invertY: false,
  controls: 'auto', aimToggle: true, crouchToggle: true, autoReload: true,
  gyro: false, gyroSens: 1.0, gyroAimOnly: false,
  joystickFixed: false, sprintJoystick: false,
  // Графика
  preset: 'medium', quality: 'medium', renderScale: 1.0, fpsCap: 0, fov: 80, vmFov: 58,
  shadows: 'medium', texQuality: 'high', bloom: true, ao: false, grade: true, effects: 'high', viewDist: 'high', antialias: true, vsyncHint: true,
  // Интерфейс
  showFps: true, showPing: false, hudScale: 1.0, radarSize: 1.0, radarZoom: 1.0, radarRotate: true, hitmarkers: true, damageNumbers: true, killfeed: true, bobbing: true,
  // Звук
  volume: 0.7, sfxVolume: 1.0, uiVolume: 0.8, musicVolume: 0.4,
  // Прицел
  crosshair: { style: 'cross', color: '#3dff8b', size: 7, gap: 4, thick: 2, dot: false, outline: true, dynamic: true, alpha: 1 },
  layout: null,
  // Матч
  match: { mode: 'defuse', map: 'factory', perTeam: 5, difficulty: 'normal', killsToWin: 40, minutes: 8, rounds: 12 },
  // Профиль
  nickname: 'Игрок',
};

function deepMerge(base, over) {
  const out = Array.isArray(base) ? [...base] : { ...base };
  if (!over || typeof over !== 'object') return out;
  for (const k of Object.keys(over)) {
    if (base && typeof base[k] === 'object' && base[k] !== null && !Array.isArray(base[k])) out[k] = deepMerge(base[k], over[k]);
    else out[k] = over[k];
  }
  return out;
}

export let hadSavedSettings = false;
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    hadSavedSettings = !!raw;
    if (raw) return deepMerge(DEFAULTS, JSON.parse(raw));
  } catch (e) { /* приватный режим */ }
  return deepMerge(DEFAULTS, {});
}

export const settings = load();

export function saveSettings() {
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch (e) { /* ignore */ }
}

export function resetSettings() {
  const keep = { match: settings.match, nickname: settings.nickname, layout: settings.layout };
  for (const k of Object.keys(settings)) delete settings[k];
  Object.assign(settings, deepMerge(DEFAULTS, keep));
  saveSettings();
}

// Пресеты графики
export const PRESETS = {
  low:    { quality: 'low', shadows: 'off', texQuality: 'low', bloom: false, ao: false, effects: 'low', viewDist: 'low', antialias: false, renderScale: 0.85 },
  medium: { quality: 'medium', shadows: 'medium', texQuality: 'high', bloom: false, ao: false, effects: 'high', viewDist: 'high', antialias: true, renderScale: 1.0 },
  high:   { quality: 'high', shadows: 'high', texQuality: 'high', bloom: true, ao: false, effects: 'high', viewDist: 'high', antialias: true, renderScale: 1.0 },
  ultra:  { quality: 'high', shadows: 'ultra', texQuality: 'high', bloom: true, ao: true, effects: 'high', viewDist: 'high', antialias: true, renderScale: 1.15 },
};
export function applyPreset(name) { Object.assign(settings, PRESETS[name] || {}); settings.preset = name; saveSettings(); }

export function getLayout() { return deepMerge(DEFAULT_LAYOUT, settings.layout || {}); }

export function isTouchMode() {
  if (settings.controls === 'touch') return true;
  if (settings.controls === 'mouse') return false;
  return ('ontouchstart' in window) || (navigator.maxTouchPoints > 0 && matchMedia('(pointer: coarse)').matches);
}
