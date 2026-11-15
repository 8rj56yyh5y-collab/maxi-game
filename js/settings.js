// Настройки игрока. Хранятся в localStorage.
const KEY = 'maxi_settings_v1';

// Позиции кнопок сенсорного управления: x, y — центр в % экрана, size — диаметр в px.
export const DEFAULT_LAYOUT = {
  joystick: { x: 13, y: 70, size: 150, opacity: 0.5 },
  fire:     { x: 86, y: 64, size: 92,  opacity: 0.6 },
  fireL:    { x: 9,  y: 36, size: 68,  opacity: 0.5 },
  aim:      { x: 94, y: 42, size: 60,  opacity: 0.5 },
  jump:     { x: 78, y: 85, size: 64,  opacity: 0.5 },
  crouch:   { x: 91, y: 86, size: 60,  opacity: 0.5 },
  reload:   { x: 76, y: 44, size: 54,  opacity: 0.5 },
  weapon:   { x: 50, y: 88, size: 58,  opacity: 0.5 },
  score:    { x: 64, y: 7,  size: 44,  opacity: 0.5 },
  pause:    { x: 96, y: 8,  size: 44,  opacity: 0.5 },
};

export const BUTTON_LABELS = {
  joystick: 'Движение', fire: 'Огонь', fireL: 'Огонь (лев.)', aim: 'Прицел', jump: 'Прыжок',
  crouch: 'Присед', reload: 'Перезарядка', weapon: 'Оружие', score: 'Счёт', pause: 'Пауза',
};

const DEFAULTS = {
  sens: 1.0,          // мышь
  aimSens: 0.75,      // множитель в прицеле
  touchSens: 1.0,     // сенсор
  invertY: false,
  controls: 'auto',   // auto | touch | mouse
  fov: 80,
  quality: 'medium',  // low | medium | high
  renderScale: 1.0,
  showFps: true,
  volume: 0.6,
  aimToggle: true,    // прицел по нажатию (сенсор)
  crosshair: { color: '#3dff8b', size: 7, gap: 4, thick: 2, dot: false, outline: true },
  layout: null,
  // последние параметры матча
  match: { mode: 'tdm', map: 'oasis', perTeam: 5, difficulty: 'normal', primary: 'ar', killsToWin: 40, minutes: 8 },
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

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return deepMerge(DEFAULTS, JSON.parse(raw));
  } catch (e) { /* приватный режим и т.п. */ }
  return deepMerge(DEFAULTS, {});
}

export const settings = load();

export function saveSettings() {
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch (e) { /* ignore */ }
  for (const fn of listeners) fn(settings);
}

const listeners = [];
export function onSettingsChange(fn) { listeners.push(fn); }

export function getLayout() {
  return deepMerge(DEFAULT_LAYOUT, settings.layout || {});
}

export function isTouchMode() {
  if (settings.controls === 'touch') return true;
  if (settings.controls === 'mouse') return false;
  return ('ontouchstart' in window) || navigator.maxTouchPoints > 0 && matchMedia('(pointer: coarse)').matches;
}
