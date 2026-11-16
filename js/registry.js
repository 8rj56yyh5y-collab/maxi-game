// Общий реестр имён: один никнейм и одно название/тег клана — только у одного игрока.
// Работает через общую базу опубликованной страницы (claude.use('db')); без неё — локальная проверка.
import { CLAN_LIST } from './social.js';

let db = null, me = null, ready = null;
const RESERVED_NICKS = ['admin', 'moderator', 'support', 'maxi', 'maxistrike', 'player', 'bot', 'system'];

export function initRegistry() {
  if (ready) return ready;
  ready = (async () => {
    try {
      if (!window.claude || !window.claude.use) return false;
      const [d, u] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
      if (!d || !u) return false;
      const id = await u.id();
      if (!id) return false;
      db = d; me = id; return true;
    } catch (e) { return false; }
  })();
  return ready;
}
export const registryOnline = () => !!db;

const key = (s) => s.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
const withTimeout = (p, ms = 8000) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

// Проверка локальных запретов (зарезервированные имена, кланы-NPC)
function localTaken(kind, name) {
  const k = key(name);
  if (kind === 'nick') return RESERVED_NICKS.includes(k);
  if (kind === 'clan') return CLAN_LIST.some(c => key(c.name) === k);
  if (kind === 'tag') return CLAN_LIST.some(c => key(c.tag) === k);
  return false;
}

// Занять имя. Возвращает { ok, reason }. prev — прежнее имя этого игрока (освобождается).
export async function claimName(kind, name, prev) {
  if (localTaken(kind, name)) return { ok: false, reason: 'taken' };
  await initRegistry();
  if (!db) return { ok: true, offline: true };
  const k = key(name);
  if (!k) return { ok: false, reason: 'invalid' };
  try {
    const ref = db.doc(`names/${kind}_${k}`);
    const lease = await withTimeout(ref.acquire({ holder: me, ttlMs: 4000 }));
    if (!lease.acquired) return { ok: false, reason: 'taken' };
    const snap = await withTimeout(ref.get());
    const d = snap.exists ? snap.data() : null;
    if (d && d.owner && d.owner !== me) return { ok: false, reason: 'taken' };
    await withTimeout(ref.set({ owner: me, kind, name: name.trim(), t: Date.now() }));
    if (prev && key(prev) !== k) releaseName(kind, prev);
    return { ok: true };
  } catch (e) {
    // Нет прав на запись (просмотр без права участия) или сеть недоступна — не блокируем игрока
    return { ok: true, offline: true };
  }
}

export async function releaseName(kind, name) {
  await initRegistry();
  if (!db || !name) return;
  try {
    const ref = db.doc(`names/${kind}_${key(name)}`);
    const snap = await withTimeout(ref.get());
    if (snap.exists && snap.data().owner === me) await ref.delete();
  } catch (e) { /* ignore */ }
}

// Проверить без захвата
export async function isNameFree(kind, name) {
  if (localTaken(kind, name)) return false;
  await initRegistry();
  if (!db) return true;
  try {
    const snap = await withTimeout(db.doc(`names/${kind}_${key(name)}`).get());
    return !snap.exists || !snap.data().owner || snap.data().owner === me;
  } catch (e) { return true; }
}

// Кланы реальных игроков (для списка кланов)
export async function playerClans() {
  await initRegistry();
  if (!db) return [];
  try {
    const q = await withTimeout(db.collection('names').where('kind', '==', 'clanrec').limit(60).get());
    return q.docs.map(d => d.data()).filter(c => c && c.name && c.tag && c.owner !== me);
  } catch (e) { return []; }
}
// Опубликовать карточку своего клана, чтобы другие видели его в списке
export async function publishClan(c) {
  await initRegistry();
  if (!db || !c) return;
  try { await withTimeout(db.doc(`names/clanrec_${key(c.tag)}`).set({ owner: me, kind: 'clanrec', name: c.name, tag: c.tag, motto: c.motto || '', icon: c.icon, color: c.color, level: c.level, size: (c.members || []).length + 1, t: Date.now() })); } catch (e) { /* ignore */ }
}
