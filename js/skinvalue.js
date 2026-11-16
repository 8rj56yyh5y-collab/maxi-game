// Ценность скина: тип отделки (сложность работы), износ, номер узора и редкие узоры.
// У каждого полученного скина свой экземпляр: float износа и номер узора (seed).
import { profile, saveProfile } from './skins.js';

// Классы отделки — от простой заводской покраски до живых скинов.
export const FINISH_CLASSES = {
  paint:   { tier: 1, name: 'Заводская покраска', why: 'Однотонная порошковая краска. Простая, быстро стирается — поэтому дешевле всего.' },
  stencil: { tier: 2, name: 'Трафарет / камуфляж', why: 'Несколько слоёв краски через трафареты. Рисунок у каждого экземпляра сдвинут по-своему.' },
  hydro:   { tier: 3, name: 'Гидрография', why: 'Плёнка с рисунком переносится на оружие в воде: сложные цветные узоры по всему корпусу.' },
  airbrush:{ tier: 4, name: 'Аэрограф', why: 'Ручная работа художника: градиенты, свечение, мелкие детали. Ценится за сложность.' },
  art:     { tier: 5, name: 'Ручная роспись', why: 'Именной скин с иллюстрацией по всему стволу и своей историей. Выпускается ограниченно.' },
  living:  { tier: 6, name: 'Живой скин', why: 'Рисунок двигается в реальном времени: лава течёт, голограмма мерцает. Самая сложная отделка.' },
  blade:   { tier: 5, name: 'Отделка клинка', why: 'Обработка стали: закалка, травление, полировка. Ножи — самые редкие предметы.' },
  agent:   { tier: 4, name: 'Экипировка агента', why: 'Полный комплект формы персонажа со своей легендой.' },
};
const PATTERN_CLASS = {
  solid: 'paint', carbon: 'paint', gradient: 'paint',
  camo: 'stencil', stripes: 'stencil', hex: 'stencil', pixel: 'stencil', tiger: 'stencil',
  graffiti: 'hydro', waves: 'hydro', splatter: 'hydro', circuit: 'hydro', chrome: 'hydro',
  neon: 'airbrush', galaxy: 'airbrush', flames: 'airbrush', dragon: 'airbrush',
};
export function finishClass(s) {
  if (!s) return FINISH_CLASSES.paint;
  if (s.agent) return FINISH_CLASSES.agent;
  if (s.pattern === 'knife') return FINISH_CLASSES.blade;
  if (s.fx) return FINISH_CLASSES.living;
  if (s.pattern === 'art') return FINISH_CLASSES.art;
  // эпик и выше на простом узоре дотягиваем до аэрографа
  const k = PATTERN_CLASS[s.pattern] || 'stencil';
  const c = FINISH_CLASSES[k];
  if ((s.rarity === 'legendary' || s.rarity === 'mythic') && c.tier < 4) return FINISH_CLASSES.airbrush;
  if (s.rarity === 'epic' && c.tier < 3) return FINISH_CLASSES.hydro;
  return c;
}

// Износ (как в топовых шутерах)
export const WEAR_GRADES = [
  [0.07, 'Прямо с завода', 'FN', 1.6],
  [0.15, 'Немного поношенный', 'MW', 1.2],
  [0.38, 'После полевых испытаний', 'FT', 1.0],
  [0.45, 'Поношенный', 'WW', 0.82],
  [1.01, 'Закалённый в боях', 'BS', 0.66],
];
export function wearGrade(f) { for (const g of WEAR_GRADES) if (f < g[0]) return { name: g[1], short: g[2], mult: g[3] }; return { name: WEAR_GRADES[4][1], short: 'BS', mult: 0.66 }; }

// Редкие узоры: особые номера дают золотую инкрустацию или «синий» перелив
export function specialPattern(seed, s) {
  if (!s || s.agent || s.pattern === 'art') return null;
  if (seed === 1 || seed === 777 || seed % 151 === 0) return { key: 'gold', name: 'Золотая жила', mult: 4, color: '#ffc23d' };
  if (seed % 97 === 0 || seed === 661) return { key: 'blue', name: 'Синий перелив', mult: 2.6, color: '#4fb6ff' };
  if (seed % 41 === 0) return { key: 'clean', name: 'Чистый узор', mult: 1.4, color: '#c9f0ff' };
  return null;
}

// Экземпляр скина у игрока
function rollFloat(rarity) {
  // чем реже скин — тем чаще он «с завода», но всегда есть шанс на любой износ
  const r = Math.random(), bias = { common: 1, rare: 0.9, epic: 0.75, legendary: 0.6, mythic: 0.5 }[rarity] ?? 1;
  return Math.min(0.999, Math.pow(r, 1 + (1 - bias) * 2.5));
}
export function instanceOf(s) {
  if (!s) return null;
  if (!profile.items) profile.items = {};
  let it = profile.items[s.id];
  if (!it) {
    const knife = s.pattern === 'knife';
    it = profile.items[s.id] = { f: +(knife ? Math.random() * 0.4 : rollFloat(s.rarity)).toFixed(4), seed: 1 + Math.floor(Math.random() * 1000), t: Date.now() };
    saveProfile();
  }
  return it;
}
export function peekInstance(id) { return profile.items && profile.items[id] || null; }

const BASE = { common: 40, rare: 180, epic: 720, legendary: 2600, mythic: 9000 };
export function skinValue(s) {
  if (!s) return 0;
  const it = instanceOf(s), fc = finishClass(s), wg = wearGrade(it.f), sp = specialPattern(it.seed, s);
  let v = (BASE[s.rarity] || 50) * (0.7 + fc.tier * 0.15) * (s.agent || s.pattern === 'art' ? 1 : wg.mult) * (sp ? sp.mult : 1) * (s.signature ? 1.5 : 1) * (s.pattern === 'knife' ? 2.2 : 1);
  return Math.round(v / 5) * 5;
}

// HTML-блок с характеристиками экземпляра для карточки
export function instanceHTML(s) {
  const it = instanceOf(s), fc = finishClass(s), wg = wearGrade(it.f), sp = specialPattern(it.seed, s);
  const showWear = !s.agent && s.pattern !== 'art';
  return `<div class="inst">
    <div class="inst-row"><small>Отделка</small><b>${'★'.repeat(fc.tier)}<span class="dimstar">${'★'.repeat(6 - fc.tier)}</span> ${fc.name}</b></div>
    <p class="inst-why">${fc.why}</p>
    ${showWear ? `<div class="inst-row"><small>Износ</small><b>${wg.name} <span class="wtag">${wg.short}</span></b></div>
    <div class="float-bar"><i style="left:${(it.f * 100).toFixed(1)}%"></i></div><div class="inst-row"><small>Float</small><b class="mono">${it.f.toFixed(4)}</b></div>` : ''}
    <div class="inst-row"><small>Узор</small><b class="mono">#${it.seed}</b>${sp ? `<span class="sp-tag" style="--sc:${sp.color}">${sp.name}</span>` : ''}</div>
    <div class="inst-row val"><small>Рыночная ценность</small><b>◈ ${skinValue(s).toLocaleString('ru')}</b></div></div>`;
}
