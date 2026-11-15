// Скины, кейсы и профиль игрока (кредиты, инвентарь). Всё хранится локально.
const KEY = 'maxi_profile_v1';

export const RARITY = {
  common:    { name: 'Обычный',      color: '#b0c3d9', sell: 15 },
  rare:      { name: 'Редкий',       color: '#4b69ff', sell: 40 },
  epic:      { name: 'Эпический',    color: '#8847ff', sell: 90 },
  legendary: { name: 'Легендарный',  color: '#d32ce6', sell: 200 },
  mythic:    { name: 'Мифический',   color: '#ffb400', sell: 500 },
};

// Шаблоны раскрасок — применяются к каждому оружию.
const STYLES = [
  { key: 'sand',    name: 'Песчаная буря',  rarity: 'common',    pattern: 'camo',     colors: ['#c9a66b', '#9c7a45', '#e0c999'] },
  { key: 'forest',  name: 'Лесник',         rarity: 'common',    pattern: 'camo',     colors: ['#4b5a32', '#2e3a1f', '#7a8450'] },
  { key: 'urban',   name: 'Городской',      rarity: 'common',    pattern: 'camo',     colors: ['#8a8f96', '#4b4f55', '#c2c6cc'] },
  { key: 'arctic',  name: 'Арктика',        rarity: 'rare',      pattern: 'camo',     colors: ['#e8f0f5', '#9fb6c6', '#5f7a8c'] },
  { key: 'carbon',  name: 'Карбон',         rarity: 'rare',      pattern: 'carbon',   colors: ['#1a1a1a', '#333333', '#ff5a00'] },
  { key: 'tiger',   name: 'Тигр',           rarity: 'rare',      pattern: 'tiger',    colors: ['#e08a1e', '#1a1208'] },
  { key: 'toxic',   name: 'Токсин',         rarity: 'epic',      pattern: 'hex',      colors: ['#17201a', '#5cff3a', '#2c8a1a'], glow: '#2cff00' },
  { key: 'sunset',  name: 'Закат',          rarity: 'epic',      pattern: 'gradient', colors: ['#ff4e50', '#f9d423', '#6a0dad'] },
  { key: 'neon',    name: 'Неоновый город', rarity: 'legendary', pattern: 'neon',     colors: ['#0b0b1a', '#00f0ff', '#ff00c8'], glow: '#00c8ff' },
  { key: 'galaxy',  name: 'Галактика',      rarity: 'legendary', pattern: 'galaxy',   colors: ['#05031a', '#b44cff', '#1b3cff'] },
  { key: 'dragon',  name: 'Золотой дракон', rarity: 'mythic',    pattern: 'dragon',   colors: ['#ffd76a', '#8a5a00', '#c98a00'], glow: '#ffaa00' },
  { key: 'lava',    name: 'Лава',           rarity: 'mythic',    pattern: 'neon',     colors: ['#1a0500', '#ff4a00', '#ffcc00'], glow: '#ff3300' },
];

export const SKIN_WEAPONS = ['ar', 'smg', 'sniper', 'shotgun', 'pistol', 'knife'];

export const SKINS = {};
for (const w of SKIN_WEAPONS) for (const st of STYLES) {
  const id = `${w}_${st.key}`;
  SKINS[id] = { id, weapon: w, name: st.name, rarity: st.rarity, pattern: st.pattern, colors: st.colors, glow: st.glow };
}

export const CASES = [
  { id: 'basic', name: 'Полевой кейс', price: 100, color: '#5b7c99',
    weights: { common: 62, rare: 26, epic: 9, legendary: 2.6, mythic: 0.4 } },
  { id: 'elite', name: 'Элитный кейс', price: 300, color: '#8847ff',
    weights: { common: 25, rare: 38, epic: 24, legendary: 10, mythic: 3 } },
  { id: 'knife', name: 'Кейс «Клинок»', price: 450, color: '#ffb400', weapon: 'knife',
    weights: { common: 20, rare: 35, epic: 27, legendary: 13, mythic: 5 } },
];

function load() {
  const def = { credits: 600, owned: [], equipped: {}, stats: { kills: 0, deaths: 0, matches: 0, wins: 0, headshots: 0 } };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...def, ...JSON.parse(raw) };
  } catch (e) { /* ignore */ }
  return def;
}

export const profile = load();

export function saveProfile() {
  try { localStorage.setItem(KEY, JSON.stringify(profile)); } catch (e) { /* ignore */ }
}

export function equippedSkin(weaponId) {
  const id = profile.equipped[weaponId];
  return id && SKINS[id] ? SKINS[id] : null;
}

export function equip(weaponId, skinId) {
  if (skinId === null) delete profile.equipped[weaponId];
  else profile.equipped[weaponId] = skinId;
  saveProfile();
}

export function rollCase(caseDef) {
  const pool = Object.values(SKINS).filter(s => !caseDef.weapon || s.weapon === caseDef.weapon);
  const total = Object.values(caseDef.weights).reduce((a, b) => a + b, 0);
  let x = Math.random() * total, rarity = 'common';
  for (const [r, w] of Object.entries(caseDef.weights)) { if ((x -= w) <= 0) { rarity = r; break; } }
  const list = pool.filter(s => s.rarity === rarity);
  return list[Math.floor(Math.random() * list.length)];
}

// Случайный предмет для «ленты» рулетки (только визуально).
export function randomFiller(caseDef) {
  return rollCase(caseDef);
}

export function openCase(caseDef) {
  if (profile.credits < caseDef.price) return null;
  profile.credits -= caseDef.price;
  const skin = rollCase(caseDef);
  const duplicate = profile.owned.includes(skin.id);
  if (duplicate) profile.credits += RARITY[skin.rarity].sell;
  else profile.owned.push(skin.id);
  saveProfile();
  return { skin, duplicate };
}
