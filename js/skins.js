// Профиль игрока: валюты, инвентарь, снаряжение, кейсы, статистика. Хранится локально.
import { SKINS, CASES, RARITY, KNIVES, WEAPONS, STORE } from './data.js';
export { SKINS, CASES, RARITY };

const KEY = 'maxi_profile_v2';

function defaults() {
  return {
    credits: 2000, gold: 300, xp: 0,
    owned: [],                 // id скинов
    equipped: {},              // weaponId → skinId
    knife: 'knife',            // выбранный нож
    cases: { field: 1, elite: 1 },
    loadout: { A: { primary: 'ar4', secondary: 'p9' }, B: { primary: 'ak', secondary: 'p18' } },
    stats: { kills: 0, deaths: 0, headshots: 0, matches: 0, wins: 0, damage: 0, roundsWon: 0, plants: 0, defuses: 0, perWeapon: {} },
    purchases: {}, lastDaily: 0, streak: 0, history: [],
    rating: 0, rankedPlayed: 0, rankedWins: 0, bestRating: 0, passXp: 0, passPremium: false, passClaimed: {},
  };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { const d = defaults(), p = JSON.parse(raw); return { ...d, ...p, stats: { ...d.stats, ...(p.stats || {}) }, loadout: { ...d.loadout, ...(p.loadout || {}) } }; }
  } catch (e) { /* ignore */ }
  return defaults();
}

export const profile = load();
// Стартовый набор (один раз)
if (!profile.starterV3) {
  const give = (id) => { if (SKINS[id] && !profile.owned.includes(id)) profile.owned.push(id); };
  give('knife_damascus'); give('karambit_tiger'); give('butterfly_casehard');
  for (const w of ['ak', 'ar4', 'awr', 'p9', 'p18', 'sv98']) {
    const list = Object.values(SKINS).filter(sk => sk.weapon === w && ['epic', 'legendary'].includes(sk.rarity));
    if (list.length) give(list[Math.floor(Math.random() * list.length)].id);
  }
  profile.cases = { ...profile.cases, street: (profile.cases.street || 0) + 1, cyber: (profile.cases.cyber || 0) + 1, gem: (profile.cases.gem || 0) + 1 };
  profile.starterV3 = true;
  try { localStorage.setItem(KEY, JSON.stringify(profile)); } catch (e) { /* ignore */ }
}
if (!profile.starterV5) {
  for (const id of ['agent_nightops', 'agent_neonronin']) if (SKINS[id] && !profile.owned.includes(id)) profile.owned.push(id);
  if (SKINS.agent_nightops) profile.equipped.agentA = 'agent_nightops';
  if (SKINS.agent_neonronin) profile.equipped.agentB = 'agent_neonronin';
  profile.cases = { ...profile.cases, agents: (profile.cases.agents || 0) + 2 };
  profile.starterV5 = true;
  try { localStorage.setItem(KEY, JSON.stringify(profile)); } catch (e) { /* ignore */ }
}
if (!profile.starterV4) {
  for (const id of ['ak_phoenix', 'br17_chameleon', 'p9_hologram']) if (SKINS[id] && !profile.owned.includes(id)) profile.owned.push(id);
  if (SKINS.ak_phoenix) profile.equipped.ak = 'ak_phoenix';
  if (SKINS.p9_hologram) profile.equipped.p9 = 'p9_hologram';
  profile.cases = { ...profile.cases, deep: (profile.cases.deep || 0) + 1, north: (profile.cases.north || 0) + 1, elements: (profile.cases.elements || 0) + 1 };
  profile.starterV4 = true;
  try { localStorage.setItem(KEY, JSON.stringify(profile)); } catch (e) { /* ignore */ }
}

export function saveProfile() {
  try { localStorage.setItem(KEY, JSON.stringify(profile)); } catch (e) { /* ignore */ }
}

export function equippedSkin(weaponId) {
  const id = profile.equipped[weaponId];
  return id && SKINS[id] ? SKINS[id] : null;
}

export function equip(weaponId, skinId) {
  if (!skinId) delete profile.equipped[weaponId];
  else profile.equipped[weaponId] = skinId;
  saveProfile();
}

// Ножи: «Боевой нож» есть всегда, остальные — если есть хотя бы один скин на них
export function ownedKnives() {
  const set = new Set(['knife']);
  for (const id of profile.owned) { const s = SKINS[id]; if (s && KNIVES[s.weapon]) set.add(s.weapon); }
  return [...set];
}

export function caseContents(c) {
  return Object.values(SKINS).filter(s => {
    if (s.agent && c.id !== 'agents') return false;            // агенты — только в своём кейсе
    if (!s.agent && !WEAPONS[s.weapon] && !KNIVES[s.weapon]) return false;
    try { return c.filter(s) && c.weights[s.rarity] !== undefined; } catch (e) { return false; }
  });
}

export function rollCase(c) {
  if (c.knifeChance && Math.random() < c.knifeChance) {
    const knives = Object.values(SKINS).filter(s => KNIVES[s.weapon] && s.weapon !== 'knife');
    return knives[Math.floor(Math.random() * knives.length)];
  }
  const pool = caseContents(c);
  const total = Object.values(c.weights).reduce((a, b) => a + b, 0);
  let x = Math.random() * total, rarity = 'common';
  for (const [r, w] of Object.entries(c.weights)) { if ((x -= w) <= 0) { rarity = r; break; } }
  let list = pool.filter(s => s.rarity === rarity);
  if (!list.length) list = pool;
  return list[Math.floor(Math.random() * list.length)];
}

export function casePrice(c) {
  return c.currency === 'gold' ? { amount: c.price, cur: 'gold' } : { amount: c.creditPrice, cur: 'credits' };
}

// Купить кейс (в инвентарь)
export function buyCase(c) {
  const p = casePrice(c);
  if (profile[p.cur] < p.amount) return false;
  profile[p.cur] -= p.amount;
  profile.cases[c.id] = (profile.cases[c.id] || 0) + 1;
  saveProfile();
  return true;
}

// Открыть кейс из инвентаря
export function openCase(c) {
  if (!profile.cases[c.id]) return null;
  profile.cases[c.id]--;
  const skin = rollCase(c);
  const duplicate = profile.owned.includes(skin.id);
  if (duplicate) profile.credits += RARITY[skin.rarity].sell * 10;
  else profile.owned.push(skin.id);
  saveProfile();
  return { skin, duplicate };
}

export function sellSkin(id, price) {
  const i = profile.owned.indexOf(id);
  if (i < 0) return 0;
  const s = SKINS[id];
  profile.owned.splice(i, 1);
  for (const [w, sid] of Object.entries(profile.equipped)) if (sid === id) delete profile.equipped[w];
  if (KNIVES[s.weapon] && profile.knife === s.weapon && !ownedKnives().includes(s.weapon)) profile.knife = 'knife';
  const v = price || RARITY[s.rarity].sell * 10;
  if (profile.items) delete profile.items[id];
  profile.credits += v;
  saveProfile();
  return v;
}

// Магазин (пока всё бесплатно — 0 ₴)
export function buyStoreItem(item) {
  if (item.once && profile.purchases[item.id]) return false;
  profile.gold += item.gold || 0;
  profile.credits += item.credits || 0;
  for (const [cid, n] of Object.entries(item.cases || {})) profile.cases[cid] = (profile.cases[cid] || 0) + n;
  profile.purchases[item.id] = (profile.purchases[item.id] || 0) + 1;
  saveProfile();
  return true;
}

// Ежедневная награда
export function dailyAvailable() { return Date.now() - profile.lastDaily > 20 * 3600 * 1000; }
export function claimDaily() {
  if (!dailyAvailable()) return null;
  profile.streak = Date.now() - profile.lastDaily < 48 * 3600 * 1000 ? Math.min(7, profile.streak + 1) : 1;
  profile.lastDaily = Date.now();
  const credits = 300 + profile.streak * 100, gold = profile.streak >= 7 ? 100 : 20;
  profile.credits += credits; profile.gold += gold;
  if (profile.streak % 3 === 0) profile.cases.field = (profile.cases.field || 0) + 1;
  saveProfile();
  return { credits, gold, streak: profile.streak };
}

export function weaponAvailableFor(team, id) {
  const w = WEAPONS[id];
  return w && (!w.team || w.team === team);
}

export { STORE };

// ---------- Боевой пропуск ----------
import { PASS, PASS_XP } from './data.js';
export function passLevel() { return Math.min(PASS.length, Math.floor((profile.passXp || 0) / PASS_XP)); }
export function claimPass(lvl, track) {
  const key = lvl + track;
  if (profile.passClaimed[key] || passLevel() < lvl || (track === 'p' && !profile.passPremium)) return null;
  const item = PASS[lvl - 1][track === 'p' ? 'prem' : 'free'];
  profile.credits += item.credits || 0; profile.gold += item.gold || 0;
  for (const [c, n] of Object.entries(item.cases || {})) profile.cases[c] = (profile.cases[c] || 0) + n;
  if (item.skin && SKINS[item.skin] && !profile.owned.includes(item.skin)) profile.owned.push(item.skin);
  profile.passClaimed[key] = true;
  saveProfile();
  return item;
}
