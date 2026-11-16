// Профиль: аватарки (своя картинка или эмблема) и кланы. Всё хранится в профиле игрока.
import { profile, saveProfile } from './skins.js';

// ---------- Эмблемы ----------
export const EMBLEM_ICONS = {
  star: 'M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7L12 17.3 5.8 20.9l1.6-7L2 9.2l7.1-.6z',
  bolt: 'M13 2L4 14h6l-1 8 9-12h-6z',
  cross: 'M11 2h2v7h2v2h-2v2h-2v-2H9V9h2zM2 11h5v2H2zm15 0h5v2h-5zM11 15h2v7h-2z M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 2a3 3 0 1 1 0 6 3 3 0 0 1 0-6z',
  skull: 'M12 2C7 2 4 5.5 4 10c0 2.6 1.2 4.5 3 5.6V19h2v-2h2v2h2v-2h2v2h2v-3.4c1.8-1.1 3-3 3-5.6 0-4.5-3-8-8-8zM8.5 9a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm7 0a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM12 13l1.2 2h-2.4z',
  crown: 'M3 7l4.5 4L12 4l4.5 7L21 7l-2 11H5z',
  flame: 'M12 2c1 4 5 5.5 5 10.5A5 5 0 0 1 7 12.5C7 9.8 8.8 8.3 9.6 6.5 10.5 8.3 12 9 12 9s-1-3 0-7z',
  wing: 'M2 12c4-6 10-8 20-8-3 2-4 4-5 6 2 0 3 0 4 1-3 1-5 2-7 4 1 0 2 .5 3 1.5-5 1-10 0-15-4.5z',
  diamond: 'M6 3h12l4 6-10 12L2 9z',
  wolf: 'M4 3l4 5h8l4-5v9l-3 4-5 5-5-5-3-4zM9 11a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm6 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2z',
  target: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 3a7 7 0 1 1 0 14 7 7 0 0 1 0-14zm0 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm0 2.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z',
  sword: 'M19 2l3 1-1 3-9.5 9.5 1.5 1.5-1.5 1.5-1.5-1.5L7 20l-2.5.5L5 18l3-3-1.5-1.5L8 12l1.5 1.5z',
  shield: 'M12 2l8 3v6c0 5-3.4 9.4-8 11-4.6-1.6-8-6-8-11V5z',
};
export const EMBLEM_COLORS = [['#ffb020', '#7a3e00'], ['#29b6f6', '#0b3a5a'], ['#ff3e6c', '#5a0a1e'], ['#4ee08a', '#0b4a2a'], ['#b35cff', '#2a0a5a'], ['#e8e8e8', '#3a3f46'], ['#ff6a00', '#3a1000'], ['#00e5ff', '#003a4a']];

export function emblemSVG(icon = 'star', colors = EMBLEM_COLORS[0], size = 64, shape = 'hex') {
  const [a, b] = colors, id = 'g' + Math.random().toString(36).slice(2, 8);
  const bg = shape === 'circle' ? '<circle cx="12" cy="12" r="11.5"/>' : shape === 'shield' ? '<path d="M12 .5l11 4v7c0 6.5-4.6 11-11 12.5C5.6 22.5 1 18 1 11.5v-7z"/>' : '<path d="M12 .5l10.4 6v11L12 23.5 1.6 17.5v-11z"/>';
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
    <g fill="url(#${id})" stroke="rgba(255,255,255,.35)" stroke-width=".5">${bg}</g>
    <g transform="translate(5.4 5.4) scale(.55)" fill="#fff" fill-opacity=".95"><path d="${EMBLEM_ICONS[icon] || EMBLEM_ICONS.star}"/></g></svg>`;
}

// ---------- Аватар ----------
export function avatarHTML(nick, size = 42) {
  if (profile.avatarImg) return `<img class="av-img" src="${profile.avatarImg}" width="${size}" height="${size}" alt="">`;
  if (profile.avatarEmblem) return emblemSVG(profile.avatarEmblem.icon, EMBLEM_COLORS[profile.avatarEmblem.color] || EMBLEM_COLORS[0], size, 'circle');
  return `<span class="av-letter">${(nick || 'M')[0].toUpperCase()}</span>`;
}
// Загрузить свою картинку: обрезка до квадрата, 192×192, JPEG
export function setAvatarFromFile(file) {
  return new Promise((res, rej) => {
    if (!file || !/^image\//.test(file.type)) return rej(new Error('Нужен файл картинки'));
    const fr = new FileReader();
    fr.onload = () => {
      const img = new Image();
      img.onload = () => {
        const S = 192, c = document.createElement('canvas'); c.width = c.height = S;
        const k = Math.min(img.width, img.height), sx = (img.width - k) / 2, sy = (img.height - k) / 2;
        c.getContext('2d').drawImage(img, sx, sy, k, k, 0, 0, S, S);
        profile.avatarImg = c.toDataURL('image/jpeg', 0.86); profile.avatarEmblem = null; saveProfile(); res();
      };
      img.onerror = () => rej(new Error('Не удалось прочитать картинку'));
      img.src = fr.result;
    };
    fr.onerror = () => rej(new Error('Не удалось прочитать файл'));
    fr.readAsDataURL(file);
  });
}
export function setAvatarEmblem(icon, color) { profile.avatarEmblem = { icon, color }; profile.avatarImg = null; saveProfile(); }

// ---------- Кланы ----------
const BOT_NAMES = ['Raven', 'Shadow', 'Falcon', 'Ghost', 'Thunder', 'North', 'Cobra', 'Storm', 'Lynx', 'Phoenix', 'Panther', 'Viking', 'Shaman', 'Grizzly', 'Diesel', 'Sapper', 'Hawk', 'Eagle', 'Viper', 'Casper', 'Reaper', 'Nova', 'Rogue', 'Blaze'];
const ROLES = { leader: 'Лидер', officer: 'Офицер', veteran: 'Ветеран', member: 'Боец', recruit: 'Новобранец' };
export { ROLES as CLAN_ROLES };
function rnd(seed) { let s = seed >>> 0 || 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

// Кланы, в которые можно вступить
export const CLAN_LIST = [
  { name: 'North Wolves', tag: 'NWLF', motto: 'The strength of the pack is the wolf', icon: 'wolf', color: 1, level: 14, size: 28, minRank: 'Серебро' },
  { name: 'Phoenix Rising', tag: 'PHX', motto: 'Rise from the ashes', icon: 'flame', color: 6, level: 22, size: 45, minRank: 'Золото' },
  { name: 'Black Crown', tag: 'CRWN', motto: 'Victory only', icon: 'crown', color: 0, level: 31, size: 50, minRank: 'Платина' },
  { name: 'Ghost Squad', tag: 'GHST', motto: 'Unseen until it is too late', icon: 'skull', color: 5, level: 9, size: 17, minRank: 'Бронза' },
  { name: 'Lightning', tag: 'BOLT', motto: 'Faster than a bullet', icon: 'bolt', color: 7, level: 18, size: 33, minRank: 'Серебро' },
  { name: 'Sniper Club', tag: 'SNPR', motto: 'One shot, one kill', icon: 'target', color: 3, level: 12, size: 21, minRank: 'Бронза' },
];

function genMembers(seed, n, leaderName) {
  const R = rnd(seed), list = [];
  for (let i = 0; i < n; i++) {
    const role = i === 0 ? 'leader' : i < 3 ? 'officer' : i < 8 ? 'veteran' : R() < 0.7 ? 'member' : 'recruit';
    list.push({ name: i === 0 && leaderName ? leaderName : BOT_NAMES[Math.floor(R() * BOT_NAMES.length)] + (R() < 0.5 ? Math.floor(R() * 99) : ''), role, rating: Math.floor(200 + R() * 1700), online: R() < 0.35, contrib: Math.floor(R() * 4000) });
  }
  return list;
}

export function createClan({ name, tag, motto, icon, color }) {
  name = (name || '').trim().replace(/[^A-Za-z0-9 _.\-]/g, '').slice(0, 24); tag = (tag || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
  if (/[^\x20-\x7e]/.test(motto || '')) motto = '';
  if (name.length < 3) throw new Error('Название клана — от 3 латинских символов');
  if (tag.length < 2) throw new Error('Тег клана — от 2 латинских букв или цифр');
  profile.clan = { name, tag, motto: (motto || '').slice(0, 60), icon: icon || 'shield', color: color || 0, level: 1, xp: 0, created: Date.now(), role: 'leader',
    members: genMembers(Date.now() % 100000, 3).map((m, i) => ({ ...m, role: i === 0 ? 'officer' : 'recruit' })), log: [{ t: Date.now(), text: `Clan ${name} founded` }] };
  saveProfile();
  return profile.clan;
}
export function joinClan(c) {
  profile.clan = { ...c, xp: Math.floor(c.level * 400 * 0.4), role: 'recruit', created: Date.now(), members: genMembers(c.tag.length * 7919 + c.level, Math.min(24, c.size)), log: [{ t: Date.now(), text: 'You joined the clan' }] };
  saveProfile();
}
export function leaveClan() { profile.clan = null; saveProfile(); }
export const clanXpNeed = (lvl) => 400 + lvl * 250;
// Начисление опыта клану за матч
export function clanMatchXp(won, kills) {
  const c = profile.clan; if (!c) return 0;
  const xp = 40 + kills * 6 + (won ? 60 : 0);
  c.xp += xp;
  while (c.xp >= clanXpNeed(c.level)) { c.xp -= clanXpNeed(c.level); c.level++; c.log.push({ t: Date.now(), text: `Clan reached level ${c.level}` }); }
  if (c.log.length > 30) c.log.splice(0, c.log.length - 30);
  saveProfile();
  return xp;
}
export function clanTag() { return profile.clan ? `[${profile.clan.tag}] ` : ''; }
