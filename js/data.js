// Каталог игры: оружие, ножи, гранаты, снаряжение, скины, кейсы, магазин, экономика.

// ---------- Оружие ----------
// cat: pistol | smg | rifle | sniper | shotgun
// damage — урон за пулю; pen — бронепробитие (0..1, доля урона через броню)
const W = (o) => ({ headMul: 4, legMul: 0.75, pen: 0.7, auto: false, pellets: 0, scope: 0, speed: 1, reward: 300, range: 120, falloff: 0.9, ...o });
export const WEAPONS = {
  // Пистолеты
  p9:    W({ id: 'p9', name: 'P9 «Страж»', cat: 'pistol', model: 'Pistol_Compact_West', price: 200, damage: 26, pen: 0.5, rpm: 400, mag: 13, reserve: 52, reload: 1.9, spread: 0.0045, moveSpread: 0.02, bloom: 0.01, maxBloom: 0.035, recoil: 0.018, speed: 1.06, sound: 'pistol_c', starter: 'A' }),
  p18:   W({ id: 'p18', name: 'P-18 «Оса»', cat: 'pistol', model: 'Pistol_Compact_East', price: 200, damage: 28, pen: 0.47, rpm: 380, mag: 12, reserve: 48, reload: 1.9, spread: 0.005, moveSpread: 0.02, bloom: 0.011, maxBloom: 0.035, recoil: 0.02, speed: 1.06, sound: 'pistol', starter: 'B' }),
  p92:   W({ id: 'p92', name: 'P92 «Кобра»', cat: 'pistol', model: 'Pistol_Full_West', price: 300, damage: 32, pen: 0.6, rpm: 380, mag: 15, reserve: 45, reload: 2.1, spread: 0.004, moveSpread: 0.022, bloom: 0.012, maxBloom: 0.04, recoil: 0.022, speed: 1.05, sound: 'pistol' }),
  p50:   W({ id: 'p50', name: 'P50 «Орёл»', cat: 'pistol', model: 'Pistol_Full_East', price: 700, damage: 63, headMul: 3.6, pen: 0.93, rpm: 220, mag: 7, reserve: 35, reload: 2.2, spread: 0.003, moveSpread: 0.05, bloom: 0.03, maxBloom: 0.06, recoil: 0.06, speed: 1.0, sound: 'pistol_h' }),
  // ПП
  mx9:   W({ id: 'mx9', name: 'MX-9 «Шершень»', cat: 'smg', model: 'SMG_Compact_West', price: 1250, damage: 25, pen: 0.6, rpm: 900, auto: true, mag: 30, reserve: 120, reload: 2.1, spread: 0.007, moveSpread: 0.012, bloom: 0.004, maxBloom: 0.04, recoil: 0.009, speed: 1.1, sound: 'smg2', reward: 600, range: 80, falloff: 0.82 }),
  uz9:   W({ id: 'uz9', name: 'УЗ-9 «Гадюка»', cat: 'smg', model: 'SMG_Compact_East', price: 1050, damage: 27, pen: 0.55, rpm: 850, auto: true, mag: 32, reserve: 128, reload: 2.4, spread: 0.008, moveSpread: 0.012, bloom: 0.0045, maxBloom: 0.045, recoil: 0.01, speed: 1.1, sound: 'smg2', reward: 600, range: 80, falloff: 0.82 }),
  vx45:  W({ id: 'vx45', name: 'VX-45 «Вихрь»', cat: 'smg', model: 'SMG_Full_West', price: 1200, damage: 30, pen: 0.65, rpm: 700, auto: true, mag: 25, reserve: 100, reload: 2.5, spread: 0.006, moveSpread: 0.014, bloom: 0.0045, maxBloom: 0.04, recoil: 0.011, speed: 1.08, sound: 'smg', reward: 600, range: 90, falloff: 0.85 }),
  pp19:  W({ id: 'pp19', name: 'ПП-19 «Кедр»', cat: 'smg', model: 'SMG_Full_East', price: 1400, damage: 27, pen: 0.6, rpm: 750, auto: true, mag: 45, reserve: 135, reload: 2.6, spread: 0.0065, moveSpread: 0.014, bloom: 0.004, maxBloom: 0.042, recoil: 0.01, speed: 1.07, sound: 'smg', reward: 600, range: 90, falloff: 0.85 }),
  // Винтовки
  ar4:   W({ id: 'ar4', name: 'AR-4 «Ястреб»', cat: 'rifle', model: 'Rifle_Assault_West', price: 3100, damage: 33, pen: 0.7, rpm: 666, auto: true, mag: 30, reserve: 90, reload: 2.4, spread: 0.0025, moveSpread: 0.05, bloom: 0.0055, maxBloom: 0.045, recoil: 0.015, speed: 0.98, sound: 'rifle_w', team: 'A' }),
  ak:    W({ id: 'ak', name: 'АК «Буря»', cat: 'rifle', model: 'Rifle_Assault_East', price: 2700, damage: 36, pen: 0.775, rpm: 600, auto: true, mag: 30, reserve: 90, reload: 2.5, spread: 0.003, moveSpread: 0.055, bloom: 0.0065, maxBloom: 0.05, recoil: 0.019, speed: 0.97, sound: 'rifle_e', team: 'B' }),
  br17:  W({ id: 'br17', name: 'BR-17 «Титан»', cat: 'rifle', model: 'Rifle_Battle_West', price: 3300, damage: 45, pen: 0.8, rpm: 480, auto: true, mag: 20, reserve: 80, reload: 2.7, spread: 0.002, moveSpread: 0.06, bloom: 0.008, maxBloom: 0.05, recoil: 0.024, speed: 0.95, sound: 'battle', scope: 1.6 }),
  akb:   W({ id: 'akb', name: 'АКБ «Гроза»', cat: 'rifle', model: 'Rifle_Battle_East', price: 3000, damage: 40, pen: 0.78, rpm: 540, auto: true, mag: 25, reserve: 75, reload: 2.6, spread: 0.0025, moveSpread: 0.058, bloom: 0.007, maxBloom: 0.05, recoil: 0.021, speed: 0.95, sound: 'battle' }),
  // Снайперские
  sv98:  W({ id: 'sv98', name: 'СВ-98 «Вектор»', cat: 'sniper', model: 'Sniper_Rifle_East', price: 1700, damage: 88, headMul: 2.5, pen: 0.85, rpm: 48, mag: 10, reserve: 90, reload: 3.0, spread: 0.0006, unscoped: 0.06, moveSpread: 0.06, bloom: 0, maxBloom: 0, recoil: 0.04, speed: 1.0, sound: 'sniper2', scope: 3.5, bolt: true, reward: 300, range: 300, falloff: 1 }),
  awr:   W({ id: 'awr', name: 'AWR «Сокол»', cat: 'sniper', model: 'Sniper_Rifle_West', price: 4750, damage: 115, headMul: 2.5, pen: 0.97, rpm: 41, mag: 5, reserve: 30, reload: 3.6, spread: 0.0003, unscoped: 0.09, moveSpread: 0.12, bloom: 0, maxBloom: 0, recoil: 0.055, speed: 0.85, sound: 'sniper', scope: 4.5, bolt: true, reward: 100, range: 300, falloff: 1 }),
  dmr:   W({ id: 'dmr', name: 'DMR «Оникс»', cat: 'sniper', model: 'Sniper_Material_West', price: 5000, damage: 80, headMul: 3, pen: 0.82, rpm: 240, mag: 20, reserve: 80, reload: 3.1, spread: 0.0007, unscoped: 0.07, moveSpread: 0.09, bloom: 0.004, maxBloom: 0.02, recoil: 0.03, speed: 0.88, sound: 'battle', scope: 3.5, reward: 300, range: 300, falloff: 1, team: 'A' }),
  svd:   W({ id: 'svd', name: 'СВД «Беркут»', cat: 'sniper', model: 'Sniper_Material_East', price: 4500, damage: 78, headMul: 3, pen: 0.82, rpm: 240, mag: 10, reserve: 60, reload: 3.0, spread: 0.0007, unscoped: 0.07, moveSpread: 0.09, bloom: 0.004, maxBloom: 0.02, recoil: 0.032, speed: 0.88, sound: 'sniper2', scope: 3.5, reward: 300, range: 300, falloff: 1, team: 'B' }),
  // Дробовики
  sg12:  W({ id: 'sg12', name: 'SG-12 «Таран»', cat: 'shotgun', model: 'Shotgun_Pump_West', price: 1050, damage: 22, pellets: 9, pelletSpread: 0.06, headMul: 2, pen: 0.6, rpm: 70, mag: 7, reserve: 32, reload: 3.0, spread: 0.01, moveSpread: 0.01, bloom: 0, maxBloom: 0, recoil: 0.05, speed: 1.0, sound: 'shotgun', reward: 900, range: 35, falloff: 0.55 }),
  dp12:  W({ id: 'dp12', name: 'ДП-12 «Медведь»', cat: 'shotgun', model: 'Shotgun_Pump_East', price: 1200, damage: 26, pellets: 9, pelletSpread: 0.05, headMul: 2, pen: 0.6, rpm: 66, mag: 8, reserve: 32, reload: 3.2, spread: 0.01, moveSpread: 0.01, bloom: 0, maxBloom: 0, recoil: 0.055, speed: 0.97, sound: 'shotgun2', reward: 900, range: 45, falloff: 0.6 }),
  as20:  W({ id: 'as20', name: 'AS-20 «Шквал»', cat: 'shotgun', model: 'Shotgun_Auto_West', price: 2000, damage: 17, pellets: 8, pelletSpread: 0.065, headMul: 2, pen: 0.55, rpm: 240, auto: true, mag: 12, reserve: 36, reload: 3.4, spread: 0.012, moveSpread: 0.012, bloom: 0, maxBloom: 0, recoil: 0.035, speed: 0.93, sound: 'shotgun', reward: 900, range: 30, falloff: 0.5 }),
  sai12: W({ id: 'sai12', name: 'САЙ-12 «Буран»', cat: 'shotgun', model: 'Shotgun_Auto_East', price: 1800, damage: 20, pellets: 8, pelletSpread: 0.06, headMul: 2, pen: 0.55, rpm: 220, mag: 8, reserve: 32, reload: 3.0, spread: 0.011, moveSpread: 0.012, bloom: 0, maxBloom: 0, recoil: 0.04, speed: 0.95, sound: 'shotgun2', reward: 900, range: 35, falloff: 0.55 }),
};

export const CATS = {
  pistol: 'Пистолеты', smg: 'Пистолеты-пулемёты', rifle: 'Винтовки', sniper: 'Снайперские', shotgun: 'Дробовики', knife: 'Ножи', grenade: 'Гранаты', gear: 'Снаряжение',
};
export const CAT_ORDER = ['pistol', 'smg', 'rifle', 'sniper', 'shotgun'];

// ---------- Ножи ----------
export const KNIVES = {
  knife:     { id: 'knife', name: 'Боевой нож', type: 'tactical', rarity: 'common' },
  bayonet:   { id: 'bayonet', name: 'Штык-нож', type: 'bayonet', rarity: 'legendary' },
  karambit:  { id: 'karambit', name: 'Керамбит', type: 'karambit', rarity: 'mythic' },
  butterfly: { id: 'butterfly', name: 'Бабочка', type: 'butterfly', rarity: 'mythic' },
  kukri:     { id: 'kukri', name: 'Кукри', type: 'kukri', rarity: 'legendary' },
  dagger:    { id: 'dagger', name: 'Тычковый нож', type: 'dagger', rarity: 'epic' },
  hunting:   { id: 'hunting', name: 'Охотничий нож', type: 'hunting', rarity: 'legendary' },
  folding:   { id: 'folding', name: 'Складной нож', type: 'folding', rarity: 'epic' },
  cleaver:   { id: 'cleaver', name: 'Тесак', type: 'cleaver', rarity: 'legendary' },
  stiletto:  { id: 'stiletto', name: 'Стилет', type: 'stiletto', rarity: 'mythic' },
  tanto:     { id: 'tanto', name: 'Танто', type: 'tanto', rarity: 'legendary' },
  bowie:     { id: 'bowie', name: 'Боуи', type: 'bowie', rarity: 'legendary' },
  machete:   { id: 'machete', name: 'Мачете', type: 'machete', rarity: 'epic' },
  fairbairn: { id: 'fairbairn', name: 'Кинжал коммандос', type: 'fairbairn', rarity: 'mythic' },
  navaja:    { id: 'navaja', name: 'Наваха', type: 'navaja', rarity: 'mythic' },
  skinner:   { id: 'skinner', name: 'Скиннер', type: 'skinner', rarity: 'legendary' },
};
export const KNIFE_STATS = { damage: 40, heavy: 65, backstab: 180, rpm: 140, range: 2.2, speed: 1.15 };

// ---------- Гранаты и снаряжение ----------
export const GRENADES = {
  he:    { id: 'he', name: 'Осколочная', price: 300, max: 1, damage: 98, radius: 6.5 },
  flash: { id: 'flash', name: 'Светошумовая', price: 200, max: 2, radius: 18 },
  smoke: { id: 'smoke', name: 'Дымовая', price: 300, max: 1, radius: 4.6, duration: 15 },
};
export const GEAR = {
  kevlar: { id: 'kevlar', name: 'Бронежилет', price: 650 },
  helmet: { id: 'helmet', name: 'Бронежилет + шлем', price: 1000 },
  defuse: { id: 'defuse', name: 'Набор сапёра', price: 400, team: 'A' },
};

// ---------- Экономика «Закладки бомбы» ----------
export const ECON = {
  start: 800, max: 16000, win: 3250, winBomb: 3500, lossBase: 1400, lossStep: 500, lossMax: 3400,
  plant: 300, plantLoss: 800, defuse: 300, knife: 1500, teamkill: -300,
  buyTime: 20, freeze: 4, roundTime: 115, bombTime: 40, plantTime: 3.2, defuseTime: 10, defuseKit: 5,
};

// ---------- Режимы ----------
export const MODES = {
  ranked: { id: 'ranked', name: 'Рейтинговая игра', short: 'РЕЙТИНГ', desc: 'Закладка бомбы 5×5 на рейтинг. Побеждайте, чтобы повышать звание.', color: '#ffc23d' },
  defuse: { id: 'defuse', name: 'Закладка бомбы', short: 'ЗАКЛАДКА', desc: 'Раунды, экономика, закупка. Наёмники закладывают бомбу, спецназ обезвреживает.', color: '#ff9f1c' },
  tdm:    { id: 'tdm', name: 'Командный бой', short: 'КОМАНДНЫЙ', desc: 'Возрождение, оружие из снаряжения. Побеждает команда, набравшая больше убийств.', color: '#2ec4ff' },
  ffa:    { id: 'ffa', name: 'Каждый сам за себя', short: 'DM', desc: 'Все против всех. Тренировка стрельбы и реакции.', color: '#ff4d6d' },
  gungame:{ id: 'gungame', name: 'Гонка вооружений', short: 'ГОНКА', desc: 'Каждое убийство — новое оружие. Первый, кто убьёт с ножа, побеждает.', color: '#9b5de5' },
};
export const GUNGAME_ORDER = ['ak', 'ar4', 'akb', 'br17', 'pp19', 'vx45', 'mx9', 'as20', 'dp12', 'sv98', 'awr', 'p50', 'p92', 'p18', 'knife'];

// ---------- Редкость ----------
export const RARITY = {
  common:    { name: 'Обычный',     color: '#b0c3d9', sell: 10 },
  rare:      { name: 'Редкий',      color: '#4b69ff', sell: 30 },
  epic:      { name: 'Эпический',   color: '#8847ff', sell: 80 },
  legendary: { name: 'Легендарный', color: '#d32ce6', sell: 220 },
  mythic:    { name: 'Мифический',  color: '#ffb400', sell: 600 },
};
export const RARITY_ORDER = ['common', 'rare', 'epic', 'legendary', 'mythic'];

// ---------- Скины ----------
export const STYLES = [
  { key: 'sand',    name: 'Песчаная буря',  rarity: 'common',    pattern: 'camo',     colors: ['#c9a66b', '#9c7a45', '#e0c999'] },
  { key: 'forest',  name: 'Лесник',         rarity: 'common',    pattern: 'camo',     colors: ['#4b5a32', '#2e3a1f', '#7a8450'] },
  { key: 'urban',   name: 'Городской',      rarity: 'common',    pattern: 'camo',     colors: ['#8a8f96', '#4b4f55', '#c2c6cc'] },
  { key: 'olive',   name: 'Олива',          rarity: 'common',    pattern: 'solid',    colors: ['#5b6142'] },
  { key: 'tan',     name: 'Койот',          rarity: 'common',    pattern: 'solid',    colors: ['#a68a64'] },
  { key: 'arctic',  name: 'Арктика',        rarity: 'rare',      pattern: 'camo',     colors: ['#e8f0f5', '#9fb6c6', '#5f7a8c'] },
  { key: 'carbon',  name: 'Карбон',         rarity: 'rare',      pattern: 'carbon',   colors: ['#1a1a1a', '#333333', '#ff5a00'] },
  { key: 'tiger',   name: 'Тигр',           rarity: 'rare',      pattern: 'tiger',    colors: ['#e08a1e', '#1a1208'] },
  { key: 'navy',    name: 'Флот',           rarity: 'rare',      pattern: 'stripes',  colors: ['#1d3557', '#457b9d'] },
  { key: 'cherry',  name: 'Вишня',          rarity: 'rare',      pattern: 'gradient', colors: ['#5c0a1b', '#c1121f', '#2b0508'] },
  { key: 'toxic',   name: 'Токсин',         rarity: 'epic',      pattern: 'hex',      colors: ['#17201a', '#5cff3a', '#2c8a1a'], glow: '#2cff00' },
  { key: 'sunset',  name: 'Закат',          rarity: 'epic',      pattern: 'gradient', colors: ['#ff4e50', '#f9d423', '#6a0dad'] },
  { key: 'ice',     name: 'Ледник',         rarity: 'epic',      pattern: 'gradient', colors: ['#e0fbfc', '#7ec8e3', '#0b3c5d'] },
  { key: 'ronin',   name: 'Ронин',          rarity: 'epic',      pattern: 'stripes',  colors: ['#111111', '#d90429'] },
  { key: 'neon',    name: 'Неоновый город', rarity: 'legendary', pattern: 'neon',     colors: ['#0b0b1a', '#00f0ff', '#ff00c8'], glow: '#00c8ff' },
  { key: 'galaxy',  name: 'Галактика',      rarity: 'legendary', pattern: 'galaxy',   colors: ['#05031a', '#b44cff', '#1b3cff'] },
  { key: 'cyber',   name: 'Кибер',          rarity: 'legendary', pattern: 'hex',      colors: ['#0d0d0d', '#ffe600', '#ff2e63'], glow: '#ffe600' },
  { key: 'dragon',  name: 'Золотой дракон', rarity: 'mythic',    pattern: 'dragon',   colors: ['#ffd76a', '#8a5a00', '#c98a00'], glow: '#ffaa00' },
  { key: 'lava',    name: 'Лава',           rarity: 'mythic',    pattern: 'neon',     colors: ['#1a0500', '#ff4a00', '#ffcc00'], glow: '#ff3300' },
  { key: 'void',    name: 'Бездна',         rarity: 'mythic',    pattern: 'galaxy',   colors: ['#000000', '#7b2ff7', '#00e5ff'] },
  { key: 'sakura',  name: 'Сакура',         rarity: 'rare',      pattern: 'camo',     colors: ['#f7d6e0', '#e98fb0', '#ffffff'], theme: 'tokyo' },
  { key: 'koi',     name: 'Кои',            rarity: 'epic',      pattern: 'gradient', colors: ['#ff7a18', '#fff1e0', '#c8102e'], theme: 'tokyo' },
  { key: 'shibuya', name: 'Сибуя',          rarity: 'legendary', pattern: 'neon',     colors: ['#120a1f', '#ff3ea5', '#3ef0ff'], glow: '#ff3ea5', theme: 'tokyo' },
  { key: 'oni',     name: 'Они',            rarity: 'mythic',    pattern: 'tiger',    colors: ['#8a0f14', '#120808'], theme: 'tokyo' },
  { key: 'marble',  name: 'Мрамор',         rarity: 'rare',      pattern: 'camo',     colors: ['#f2efe8', '#c9c4ba', '#8a857c'], theme: 'europe' },
  { key: 'royal',   name: 'Королевский',    rarity: 'epic',      pattern: 'dragon',   colors: ['#1b2a5a', '#d4af37', '#0d1533'], theme: 'europe' },
  { key: 'venice',  name: 'Венеция',        rarity: 'legendary', pattern: 'gradient', colors: ['#0b4f6c', '#f4d35e', '#ee964b'], theme: 'europe' },
  { key: 'gilded',  name: 'Позолота',       rarity: 'mythic',    pattern: 'carbon',   colors: ['#b8860b', '#ffd700', '#ffffff'], glow: '#ffcc33', theme: 'europe' },
  { key: 'vice',    name: 'Вайс-Сити',      rarity: 'rare',      pattern: 'stripes',  colors: ['#ff7aa8', '#3ec8d8'], theme: 'miami' },
  { key: 'flamingo',name: 'Фламинго',       rarity: 'epic',      pattern: 'gradient', colors: ['#ff4f9a', '#ffd1e3', '#ff8fb8'], theme: 'miami' },
  { key: 'retro',   name: 'Ретровейв',      rarity: 'legendary', pattern: 'neon',     colors: ['#1a0533', '#ff6ec7', '#ffd319'], glow: '#ff6ec7', theme: 'miami' },
  { key: 'momiji',  name: 'Момидзи',        rarity: 'epic',      pattern: 'camo',     colors: ['#d2401e', '#f0a030', '#5a1e0e'], theme: 'kyoto' },
  { key: 'geisha',  name: 'Гейша',          rarity: 'legendary', pattern: 'gradient', colors: ['#f4f0ea', '#b8202a', '#1a1a1a'], theme: 'kyoto' },
  { key: 'shogun',  name: 'Сёгун',          rarity: 'mythic',    pattern: 'dragon',   colors: ['#2a0a0a', '#d4af37', '#8a1010'], glow: '#ffb000', theme: 'kyoto' },
  { key: 'tagger',  name: 'Граффити',       rarity: 'rare',      pattern: 'graffiti', colors: ['#2b2b30', '#ff3ea5', '#3ef0ff'], theme: 'street' },
  { key: 'bomber',  name: 'Бомбер',         rarity: 'epic',      pattern: 'graffiti', colors: ['#f2e6c8', '#ff6a00', '#1d6bff'], theme: 'street' },
  { key: 'splash',  name: 'Клякса',         rarity: 'rare',      pattern: 'splatter', colors: ['#f4f4f4', '#ff2d55', '#111111'], theme: 'street' },
  { key: 'wildstyle', name: 'Вайлдстайл',   rarity: 'legendary', pattern: 'graffiti', colors: ['#120a1f', '#ffe14a', '#b35cff'], glow: '#b35cff', theme: 'street' },
  { key: 'digital', name: 'Цифра',          rarity: 'common',    pattern: 'pixel',    colors: ['#5b6142', '#3b4030', '#8a8f6a'], theme: 'cyber' },
  { key: 'digiblue', name: 'Цифровой лёд',  rarity: 'rare',      pattern: 'pixel',    colors: ['#c8dff0', '#4a7ea8', '#1d3a5a'], theme: 'cyber' },
  { key: 'mainframe', name: 'Мейнфрейм',    rarity: 'epic',      pattern: 'circuit',  colors: ['#06140c', '#2cff8a', '#ffd400'], glow: '#2cff8a', theme: 'cyber' },
  { key: 'overclock', name: 'Разгон',       rarity: 'legendary', pattern: 'circuit',  colors: ['#0b0618', '#ff2e63', '#00e5ff'], glow: '#ff2e63', theme: 'cyber' },
  { key: 'chromed', name: 'Хром',           rarity: 'legendary', pattern: 'chrome',   colors: ['#9aa4b0', '#3a4250', '#c8d0da'], theme: 'cyber' },
  { key: 'inferno', name: 'Инферно',        rarity: 'epic',      pattern: 'flames',   colors: ['#3a0800', '#ff4a00', '#ffd400'], glow: '#ff6a00', theme: 'elements' },
  { key: 'blueflame', name: 'Синее пламя',  rarity: 'legendary', pattern: 'flames',   colors: ['#000a2a', '#1d6bff', '#a8e6ff'], glow: '#3a8aff', theme: 'elements' },
  { key: 'tsunami', name: 'Цунами',         rarity: 'epic',      pattern: 'waves',    colors: ['#0b3c5d', '#e8f4ff', '#1d6b9a'], theme: 'elements' },
  { key: 'goldwave', name: 'Золотая волна', rarity: 'mythic',    pattern: 'waves',    colors: ['#1a1205', '#ffd76a', '#8a5a00'], glow: '#ffaa00', theme: 'elements' },
];

function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

export const SKINS = {};
import { KNIFE_FINISHES } from './knives.js';
import { SIGNATURES, COLLECTIONS } from './skinart.js';
export { COLLECTIONS };
export { KNIFE_FINISHES };
// цвета для 2D-превью отделок
const FINISH_SWATCH = { satin: ['#9aa0a8', '#d8dce0'], mirror: ['#cfd6de', '#ffffff'], black: ['#141518', '#3a3c42'], urban: ['#5a5e64', '#b0b4ba'], night: ['#0d0e14', '#2a2e44'],
  damascus: ['#7c8088', '#e2e4e8'], casehard: ['#2850c8', '#dcaa3c'], tiger: ['#f0b040', '#8a4008'], web: ['#8e0f14', '#140405'], fade: ['#ffdc3c', '#ff468c', '#8246e6'],
  ocean: ['#28dce6', '#145aff'], marble: ['#e62a3c', '#1e3ce6'], gold: ['#ffcf6a', '#a8781e'], sapphire: ['#143ce6', '#7ab4ff'], ruby: ['#d20f28', '#ff6a7a'], emerald: ['#0ab45a', '#7affb4'] };
const allItems = [...Object.keys(WEAPONS)];
for (const k of Object.keys(KNIVES)) for (const f of KNIFE_FINISHES) {
  const id = `${k}_${f.key}`;
  SKINS[id] = { id, weapon: k, name: f.name, rarity: f.rarity, pattern: 'knife', finish: f.key, colors: FINISH_SWATCH[f.key], style: f.key };
}
for (const w of allItems) {
  // каждому оружию — свой набор раскрасок (детерминированно)
  const list = STYLES.filter(st => (hash(w + st.key) % 100) < (KNIVES[w] ? 60 : 55) || st.rarity === 'common' && st.key === 'urban');
  for (const st of list) {
    const id = `${w}_${st.key}`;
    // ножи на редкость выше
    let rarity = st.rarity;
    if (KNIVES[w]) rarity = RARITY_ORDER[Math.min(4, RARITY_ORDER.indexOf(st.rarity) + 1)];
    SKINS[id] = { id, weapon: w, name: st.name, rarity, pattern: st.pattern, colors: st.colors, glow: st.glow, theme: st.theme, style: st.key };
  }
}

// Именные скины (рисунок на всё оружие, у мифических — «живые» эффекты)
for (const sg of SIGNATURES) {
  if (!WEAPONS[sg.weapon]) continue;
  const id = `${sg.weapon}_${sg.key}`;
  SKINS[id] = { id, weapon: sg.weapon, name: sg.name, rarity: sg.rarity, pattern: 'art', art: sg.art, fx: sg.fx, story: sg.story, theme: sg.theme, style: sg.key, signature: true, colors: ['#888888', '#cccccc'] };
}
for (const sk of Object.values(SKINS)) sk.collection = KNIVES[sk.weapon] ? 'blades' : (COLLECTIONS[sk.theme] ? sk.theme : 'base');

// ---------- Агенты (скины персонажей) ----------
export const AGENTS = [
  { key: 'urbanops',  team: 'A', name: 'Городской рейнджер',  rarity: 'common',    pattern: 'pixel',    colors: ['#6a7480', '#4a525c', '#9aa2ac'], visor: '#49a8ff', story: 'Стандартная форма городского спецназа: цифровой камуфляж под бетон и асфальт.' },
  { key: 'arctic',    team: 'A', name: 'Арктический штурмовик', rarity: 'rare',    pattern: 'camo',     colors: ['#e8eef4', '#9fb6c6', '#5f7a8c'], visor: '#7ae6ff', story: 'Отряд станции «Кольцо». Белый камуфляж, в котором его не видно на снегу.' },
  { key: 'nightops',  team: 'A', name: 'Ночной оперативник',  rarity: 'epic',      pattern: 'solid',    colors: ['#1a1d22'], visor: '#00e5ff', story: 'Работает только после заката. Чёрная форма поглощает свет фонарей.' },
  { key: 'cyberguard', team: 'A', name: 'Кибер-гвардия',      rarity: 'legendary', pattern: 'circuit',  colors: ['#0b1424', '#2ec4ff', '#ffffff'], visor: '#2ec4ff', glow: '#2ec4ff', story: 'Экзоброня лаборатории «Призрак». По швам бегут светящиеся схемы.' },
  { key: 'goldlegion', team: 'A', name: 'Золотой легион',     rarity: 'mythic',    pattern: 'chrome',   colors: ['#ffd76a', '#8a5a00', '#fff2c0'], visor: '#ffb000', story: 'Парадная броня чемпионов сезона. Выдаётся только лучшим из лучших.' },
  { key: 'desertfox', team: 'B', name: 'Пустынный лис',       rarity: 'common',    pattern: 'camo',     colors: ['#c9a66b', '#9c7a45', '#e0c999'], visor: '#ff7a3c', story: 'Наёмник из песков Оазиса. Камуфляж под цвет барханов.' },
  { key: 'forestghost', team: 'B', name: 'Лесной призрак',    rarity: 'rare',      pattern: 'camo',     colors: ['#4b5a32', '#2e3a1f', '#7a8450'], visor: '#9cff4a', story: 'Охотник за головами. Выходит из чащи без единого звука.' },
  { key: 'tigerjungle', team: 'B', name: 'Тигр джунглей',     rarity: 'epic',      pattern: 'tiger',    colors: ['#e08a1e', '#1a1208'], visor: '#ffb000', story: 'Командир наёмников с юга. Полосы на броне — его личная подпись.' },
  { key: 'neonronin', team: 'B', name: 'Неоновый ронин',      rarity: 'legendary', pattern: 'neon',     colors: ['#120a1f', '#ff3ea5', '#3ef0ff'], visor: '#ff3ea5', glow: '#ff3ea5', story: 'Наёмник из Сибуи. Броня подсвечена так же, как вывески его квартала.' },
  { key: 'inferno',   team: 'B', name: 'Огненный демон',      rarity: 'mythic',    pattern: 'flames',   colors: ['#3a0800', '#ff4a00', '#ffd400'], visor: '#ff2a00', glow: '#ff6a00', story: 'Выжил в пожаре операции «Пепел». С тех пор его броня словно горит.' },
];
for (const ag of AGENTS) {
  const id = 'agent_' + ag.key;
  SKINS[id] = { id, weapon: 'agent' + ag.team, name: ag.name, rarity: ag.rarity, pattern: ag.pattern, colors: ag.colors, glow: ag.glow, agent: ag, story: ag.story, theme: 'agents', style: ag.key, collection: 'agents' };
}

export function itemName(w) { return WEAPONS[w] ? WEAPONS[w].name : KNIVES[w] ? KNIVES[w].name : w === 'agentA' ? 'Агент спецназа' : w === 'agentB' ? 'Агент наёмников' : w; }
export function itemShort(w) { const n = itemName(w); return n.split(' «')[0]; }

// ---------- Кейсы ----------
export const CASES = [
  { id: 'field',  name: 'Полевой кейс',   price: 0,  currency: 'credits', creditPrice: 250, color: '#5b7c99', filter: (s) => !KNIVES[s.weapon],
    weights: { common: 62, rare: 26, epic: 9, legendary: 2.6, mythic: 0.4 } },
  { id: 'urban',  name: 'Кейс «Город»',   price: 100, currency: 'gold', color: '#2ec4ff', filter: (s) => !KNIVES[s.weapon] && ['rifle', 'smg'].includes(WEAPONS[s.weapon].cat),
    weights: { common: 40, rare: 34, epic: 18, legendary: 6, mythic: 2 } },
  { id: 'elite',  name: 'Элитный кейс',   price: 250, currency: 'gold', color: '#8847ff', filter: (s) => !KNIVES[s.weapon],
    weights: { common: 18, rare: 36, epic: 28, legendary: 13, mythic: 5 }, knifeChance: 0.03 },
  { id: 'tokyo',  name: 'Кейс «Токио»',   price: 180, currency: 'gold', color: '#ff3ea5', filter: (s) => !KNIVES[s.weapon] && (s.theme === 'tokyo' || ['neon', 'cyber', 'toxic'].includes(s.style)),
    weights: { rare: 45, epic: 32, legendary: 17, mythic: 6 } },
  { id: 'europe', name: 'Кейс «Европа»',  price: 150, currency: 'gold', color: '#d4af37', filter: (s) => !KNIVES[s.weapon] && (s.theme === 'europe' || ['navy', 'cherry', 'sunset'].includes(s.style)),
    weights: { rare: 48, epic: 32, legendary: 15, mythic: 5 } },
  { id: 'miami',  name: 'Кейс «Майами»',  price: 160, currency: 'gold', color: '#ff6ec7', filter: (s) => !KNIVES[s.weapon] && (s.theme === 'miami' || ['sunset', 'neon', 'ice'].includes(s.style)),
    weights: { rare: 46, epic: 32, legendary: 16, mythic: 6 } },
  { id: 'kyoto',  name: 'Кейс «Киото»',   price: 200, currency: 'gold', color: '#d2401e', filter: (s) => !KNIVES[s.weapon] && (s.theme === 'kyoto' || ['sakura', 'koi', 'ronin', 'dragon'].includes(s.style)),
    weights: { rare: 40, epic: 34, legendary: 19, mythic: 7 }, knifeChance: 0.02 },
  { id: 'starter', name: 'Кейс новичка', price: 0, currency: 'credits', creditPrice: 120, color: '#7a8a9a', filter: (s) => !KNIVES[s.weapon] && ['common', 'rare'].includes(s.rarity),
    weights: { common: 75, rare: 25 } },
  { id: 'street', name: 'Кейс «Улицы»',   price: 140, currency: 'gold', color: '#ff3ea5', filter: (s) => !KNIVES[s.weapon] && s.theme === 'street',
    weights: { rare: 50, epic: 32, legendary: 14, mythic: 4 }, knifeChance: 0.015 },
  { id: 'cyber',  name: 'Кейс «Кибер»',    price: 190, currency: 'gold', color: '#2cff8a', filter: (s) => !KNIVES[s.weapon] && (s.theme === 'cyber' || ['cyber', 'neon', 'carbon'].includes(s.style)),
    weights: { common: 20, rare: 36, epic: 26, legendary: 14, mythic: 4 }, knifeChance: 0.02 },
  { id: 'elements', name: 'Кейс «Стихии»', price: 220, currency: 'gold', color: '#ff6a00', filter: (s) => !KNIVES[s.weapon] && (s.theme === 'elements' || ['lava', 'ice', 'toxic'].includes(s.style)),
    weights: { epic: 48, legendary: 36, mythic: 16 }, knifeChance: 0.03 },
  { id: 'gem',    name: 'Кейс «Самоцветы»', price: 700, currency: 'gold', color: '#7ab4ff', filter: (s) => !!KNIVES[s.weapon] && ['sapphire', 'ruby', 'emerald', 'gold', 'fade', 'marble', 'ocean'].includes(s.finish),
    weights: { mythic: 100 } },
  { id: 'deep',   name: 'Кейс «Глубина»',  price: 240, currency: 'gold', color: '#00d8c8', filter: (s) => !KNIVES[s.weapon] && (s.theme === 'deep' || ['tsunami', 'goldwave', 'ice', 'navy'].includes(s.style)),
    weights: { rare: 30, epic: 36, legendary: 24, mythic: 10 }, knifeChance: 0.025, lore: 'deep' },
  { id: 'north',  name: 'Кейс «Северный фронт»', price: 240, currency: 'gold', color: '#7ae6ff', filter: (s) => !KNIVES[s.weapon] && (s.theme === 'north' || ['arctic', 'ice', 'digiblue', 'urban'].includes(s.style)),
    weights: { common: 10, rare: 30, epic: 32, legendary: 20, mythic: 8 }, knifeChance: 0.025, lore: 'north' },
  { id: 'agents', name: 'Кейс «Оперативники»', price: 300, currency: 'gold', color: '#4ee08a', filter: (s) => s.weapon === 'agentA' || s.weapon === 'agentB',
    weights: { common: 40, rare: 30, epic: 18, legendary: 9, mythic: 3 }, lore: 'agents' },
  { id: 'blade',  name: 'Кейс «Клинок»',  price: 500, currency: 'gold', color: '#ffb400', filter: (s) => !!KNIVES[s.weapon] && s.weapon !== 'knife',
    weights: { epic: 40, legendary: 42, mythic: 18 } },
];

// ---------- Магазин (донат пока бесплатный) ----------
export const STORE = [
  { id: 'gold100',  title: '100 золота',          gold: 100,  price: 0, tag: '' },
  { id: 'gold550',  title: '500 + 50 золота',     gold: 550,  price: 0, tag: 'Популярно' },
  { id: 'gold1200', title: '1000 + 200 золота',   gold: 1200, price: 0, tag: '' },
  { id: 'gold3000', title: '2500 + 500 золота',   gold: 3000, price: 0, tag: 'Выгодно' },
  { id: 'cr5000',   title: '5 000 кредитов',      credits: 5000, price: 0, tag: '' },
  { id: 'starter',  title: 'Набор новичка',       gold: 500, credits: 3000, cases: { elite: 2 }, price: 0, tag: 'Один раз', once: true },
  { id: 'knifepack',title: 'Набор «Клинок»',      gold: 300, cases: { blade: 1 }, price: 0, tag: 'Ножи' },
  { id: 'citypack', title: 'Набор «Города мира»', gold: 200, cases: { tokyo: 1, europe: 1, miami: 1, kyoto: 1 }, price: 0, tag: 'Новинка' },
  { id: 'cr20000',  title: '20 000 кредитов',     credits: 20000, price: 0, tag: 'Выгодно' },
];

// ---------- Уровни ----------
export const RANKS = ['Новобранец', 'Рядовой', 'Ефрейтор', 'Сержант', 'Старшина', 'Прапорщик', 'Лейтенант', 'Капитан', 'Майор', 'Подполковник', 'Полковник', 'Генерал'];
export function levelInfo(xp) {
  let lvl = 1, need = 800, left = xp;
  while (left >= need) { left -= need; lvl++; need = Math.round(need * 1.12); }
  return { level: lvl, cur: left, need, rank: RANKS[Math.min(RANKS.length - 1, Math.floor((lvl - 1) / 4))] };
}

// ---------- Карты ----------
export const MAP_INFO = {
  quarter: { name: 'Квартал', desc: 'Жилые дома, площадь, парковка во дворе.', modes: ['defuse', 'tdm', 'ffa', 'gungame'] },
  factory: { name: 'Фабрика', desc: 'Промышленный квартал: кирпичные цеха, дворы, переулки.', modes: ['defuse', 'tdm', 'ffa', 'gungame'] },
  oasis: { name: 'Оазис', desc: 'Пустынный город. Две точки, три линии.', modes: ['defuse', 'tdm', 'ffa', 'gungame'] },
  port:  { name: 'Порт', desc: 'Контейнерный терминал на закате.', modes: ['defuse', 'tdm', 'ffa', 'gungame'] },
  tokyo: { name: 'Токио', desc: 'Ночной квартал с неоном.', modes: ['defuse', 'tdm', 'ffa', 'gungame'] },
  oldtown: { name: 'Старый город', desc: 'Европейская площадь на закате.', modes: ['defuse', 'tdm', 'ffa', 'gungame'] },
  brooklyn: { name: 'Бруклин', desc: 'Нью-Йорк: авеню и переулки.', modes: ['defuse', 'tdm', 'ffa', 'gungame'] },
  santorini: { name: 'Санторини', desc: 'Белые домики над морем.', modes: ['defuse', 'tdm', 'ffa', 'gungame'] },
  paris: { name: 'Париж', desc: 'Бульвар с кафе на закате.', modes: ['defuse', 'tdm', 'ffa', 'gungame'] },
  kyoto: { name: 'Киото', desc: 'Гион, пагода, осенний сад.', modes: ['defuse', 'tdm', 'ffa', 'gungame'] },
  miami: { name: 'Майами', desc: 'Ночной Оушен-драйв.', modes: ['defuse', 'tdm', 'ffa', 'gungame'] },
  amsterdam: { name: 'Амстердам', desc: 'Каналы и велосипеды.', modes: ['defuse', 'tdm', 'ffa', 'gungame'] },
  hongkong: { name: 'Гонконг', desc: 'Ночной Монгкок.', modes: ['defuse', 'tdm', 'ffa', 'gungame'] },
};

// ---------- Рейтинговые игры ----------
export const RANK_TIERS = [
  { name: 'Бронза', color: '#c07a45', min: 0, bots: 'easy' },
  { name: 'Серебро', color: '#b8c4cf', min: 300, bots: 'normal' },
  { name: 'Золото', color: '#ffc23d', min: 600, bots: 'normal' },
  { name: 'Платина', color: '#4fd6c8', min: 900, bots: 'hard' },
  { name: 'Алмаз', color: '#6aa8ff', min: 1200, bots: 'hard' },
  { name: 'Мастер', color: '#b35cff', min: 1500, bots: 'pro' },
  { name: 'Легенда', color: '#ff4d5e', min: 1800, bots: 'pro' },
];
export const SEASON = { name: 'Сезон 1: Неон', ends: 'конец сезона через 42 дня' };
export function rankOf(rating) {
  let i = 0;
  while (i + 1 < RANK_TIERS.length && rating >= RANK_TIERS[i + 1].min) i++;
  const t = RANK_TIERS[i];
  const div = i >= 5 ? 0 : 3 - Math.min(2, Math.floor((rating - t.min) / 100));
  const next = RANK_TIERS[i + 1] ? (div > 1 ? t.min + (4 - div) * 100 : RANK_TIERS[i + 1].min) : null;
  return { tier: i, name: t.name + (div ? ' ' + ['', 'I', 'II', 'III'][div] : ''), color: t.color, bots: t.bots, div, next, rating };
}
// Значок звания (SVG)
export function rankBadge(rating, size = 48) {
  const r = rankOf(rating);
  const stars = r.div ? 4 - r.div : 3;
  const c = r.color;
  return `<svg class="rank-badge" width="${size}" height="${size}" viewBox="0 0 64 64"><defs><linearGradient id="rg${r.tier}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c}"/><stop offset="1" stop-color="#1a1f28"/></linearGradient></defs>
    <path d="M32 3 L57 13 L57 34 C57 48 45 57 32 61 C19 57 7 48 7 34 L7 13 Z" fill="url(#rg${r.tier})" stroke="${c}" stroke-width="2.5"/>
    <path d="M32 12 L49 19 L49 34 C49 43 41 50 32 53 C23 50 15 43 15 34 L15 19 Z" fill="rgba(10,14,20,.55)"/>
    ${r.tier >= 5 ? `<path d="M32 18 l4 9 10 1 -8 6 3 10 -9 -6 -9 6 3 -10 -8 -6 10 -1z" fill="${c}"/>` : Array.from({ length: stars }, (_, i) => `<path transform="translate(${20 + i * 12 - (stars - 1) * 6 + (3 - stars) * 6},35)" d="M0 -7 l2 5 5 .5 -4 3.5 1.5 5 -4.5 -3 -4.5 3 1.5 -5 -4 -3.5 5 -.5z" fill="${c}"/>`).join('')}
    <text x="32" y="${r.tier >= 5 ? 58 : 27}" text-anchor="middle" font-family="Rajdhani, sans-serif" font-weight="700" font-size="${r.tier >= 5 ? 0 : 9}" fill="#fff">${r.tier >= 5 ? '' : r.name.split(' ')[0].slice(0, 3).toUpperCase()}</text></svg>`;
}

// ---------- Боевой пропуск ----------
export const PASS_XP = 600;
export const PASS = Array.from({ length: 30 }, (_, i) => {
  const lvl = i + 1;
  const free = lvl % 5 === 0 ? { cases: { field: 1 } } : lvl % 2 === 0 ? { credits: 500 + lvl * 20 } : { credits: 250 };
  const prem = lvl === 30 ? { skin: 'karambit_fade' } : lvl === 25 ? { skin: 'ak_oni' } : lvl === 20 ? { skin: 'ar4_shibuya' } : lvl % 5 === 0 ? { cases: { tokyo: 1 } } : lvl % 3 === 0 ? { gold: 60 } : { credits: 600 };
  return { lvl, free, prem };
});
