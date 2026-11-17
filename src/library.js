// Rayskinz DSH Design - background library rules (pure: no DOM, no timers, no disk).
// The library keeps up to LIB_MAX saved backgrounds. A background can be assigned to one chat, to a whole
// workspace, or used as the default; a playlist can rotate through chosen entries. This file only decides
// WHICH entry shows and keeps the bookkeeping consistent. Prefixed names only (one shared scope).

export const LIB_MAX = 24
export const LIB_MOODS = ['working', 'waiting', 'error', 'done']
export const LIB_MIN_ROTATE = 1 // minutes
export const LIB_MAX_ROTATE = 240
const LIB_KEY = /^[a-z0-9:_.-]{1,80}$/i

// state = { items: [{ id, ext, name, bytes }], assign: { chats: {key: id}, spaces: {key: id}, moods: {mood: id} },
//           playlist: { on, ids: [], minutes, shuffle }, current: id|null }
export const libEmpty = () => ({ items: [], assign: { chats: {}, spaces: {}, moods: {} }, playlist: { on: false, ids: [], minutes: 10, shuffle: false }, current: null })

export function libClean(input) {
  const out = libEmpty()
  const items = Array.isArray(input?.items) ? input.items : []
  const seen = new Set()
  for (const it of items) {
    if (!it || typeof it.id !== 'string' || !/^[a-z0-9]{6,32}$/i.test(it.id) || seen.has(it.id)) continue
    if (!['gif', 'png', 'jpg', 'webp', 'mp4', 'webm'].includes(it.ext)) continue
    seen.add(it.id)
    out.items.push({ id: it.id, ext: it.ext, name: typeof it.name === 'string' ? it.name.replace(/[\u0000-\u001f<>]/g, '').slice(0, 60) : '', bytes: Number.isFinite(it.bytes) ? Math.max(0, Math.round(it.bytes)) : 0 })
    if (out.items.length >= LIB_MAX) break
  }
  const have = (id) => typeof id === 'string' && seen.has(id) && out.items.some((x) => x.id === id)
  const copyMap = (src, dst, keyOk) => { if (src && typeof src === 'object') for (const [k, v] of Object.entries(src)) if (keyOk(k) && have(v)) dst[k] = v }
  copyMap(input?.assign?.chats, out.assign.chats, (k) => LIB_KEY.test(k))
  copyMap(input?.assign?.spaces, out.assign.spaces, (k) => LIB_KEY.test(k))
  copyMap(input?.assign?.moods, out.assign.moods, (k) => LIB_MOODS.includes(k))
  const pl = input?.playlist
  if (pl && typeof pl === 'object') {
    out.playlist.on = pl.on === true
    out.playlist.ids = Array.isArray(pl.ids) ? [...new Set(pl.ids.filter(have))] : []
    const m = Number(pl.minutes)
    out.playlist.minutes = Number.isFinite(m) ? Math.min(LIB_MAX_ROTATE, Math.max(LIB_MIN_ROTATE, Math.round(m))) : 10
    out.playlist.shuffle = pl.shuffle === true
  }
  out.current = have(input?.current) ? input.current : null
  if (out.playlist.ids.length === 0) out.playlist.on = false
  return out
}

// Which entry should show right now? Priority: mood > this chat > this workspace > playlist > current default.
// `ctx` = { chat, space, mood, tick } where tick counts playlist steps since the page opened.
export function libPick(lib, ctx = {}) {
  const ok = (id) => (id && lib.items.some((x) => x.id === id) ? id : null)
  const mood = ctx.mood && LIB_MOODS.includes(ctx.mood) ? ok(lib.assign.moods[ctx.mood]) : null
  if (mood) return { id: mood, why: 'mood' }
  const chat = ctx.chat ? ok(lib.assign.chats[ctx.chat]) : null
  if (chat) return { id: chat, why: 'chat' }
  const space = ctx.space ? ok(lib.assign.spaces[ctx.space]) : null
  if (space) return { id: space, why: 'workspace' }
  if (lib.playlist.on && lib.playlist.ids.length) {
    const ids = lib.playlist.ids.filter((id) => ok(id))
    if (ids.length) {
      const t = Math.max(0, Math.floor(Number.isFinite(ctx.tick) ? ctx.tick : 0))
      return { id: ids[libStep(ids.length, t, lib.playlist.shuffle, ctx.seed)], why: 'playlist' }
    }
  }
  const cur = ok(lib.current)
  return cur ? { id: cur, why: 'default' } : { id: null, why: 'none' }
}

// Position in a playlist of n entries at step t. Shuffle is a seeded permutation per lap, so every
// entry plays once per lap and the same seed always replays the same order.
export function libStep(n, t, shuffle, seed = 1) {
  if (n <= 1) return 0
  if (!shuffle) return t % n
  const lap = Math.floor(t / n)
  const order = Array.from({ length: n }, (_, i) => i)
  let a = ((seed >>> 0) + Math.imul(lap + 1, 0x9e3779b1)) >>> 0
  for (let i = n - 1; i > 0; i--) {
    a = (a + 0x6d2b79f5) >>> 0
    let x = Math.imul(a ^ (a >>> 15), a | 1)
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61)
    const j = ((x ^ (x >>> 14)) >>> 0) % (i + 1)
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  return order[t % n]
}

export function libAdd(lib, item) {
  const next = libClean({ ...lib, items: [...lib.items.filter((x) => x.id !== item.id), item] })
  return next.items.some((x) => x.id === item.id) ? { ...next, current: lib.current ?? item.id } : lib
}

// Remove one entry and everything that pointed at it. Returns { lib, removed }.
export function libRemove(lib, id) {
  if (!lib.items.some((x) => x.id === id)) return { lib, removed: null }
  const strip = (m) => Object.fromEntries(Object.entries(m).filter(([, v]) => v !== id))
  const next = {
    items: lib.items.filter((x) => x.id !== id),
    assign: { chats: strip(lib.assign.chats), spaces: strip(lib.assign.spaces), moods: strip(lib.assign.moods) },
    playlist: { ...lib.playlist, ids: lib.playlist.ids.filter((x) => x !== id) },
    current: lib.current === id ? null : lib.current,
  }
  if (next.current === null && next.items.length) next.current = next.items[0].id
  if (next.playlist.ids.length === 0) next.playlist.on = false
  return { lib: next, removed: lib.items.find((x) => x.id === id) }
}

// Assign an entry to a chat / workspace / mood (id = null clears it). Unknown ids and bad keys change nothing.
export function libAssign(lib, kind, key, id) {
  const slot = kind === 'chat' ? 'chats' : kind === 'space' ? 'spaces' : kind === 'mood' ? 'moods' : null
  if (!slot) return lib
  if (slot === 'moods' ? !LIB_MOODS.includes(key) : !(typeof key === 'string' && LIB_KEY.test(key))) return lib
  if (id !== null && !lib.items.some((x) => x.id === id)) return lib
  const map = { ...lib.assign[slot] }
  if (id === null) delete map[key]
  else map[key] = id
  return { ...lib, assign: { ...lib.assign, [slot]: map } }
}

export function libTogglePlaylist(lib, id) {
  if (!lib.items.some((x) => x.id === id)) return lib
  const ids = lib.playlist.ids.includes(id) ? lib.playlist.ids.filter((x) => x !== id) : [...lib.playlist.ids, id]
  return { ...lib, playlist: { ...lib.playlist, ids, on: ids.length ? lib.playlist.on : false } }
}

// Change playlist settings (on, minutes, shuffle) safely: the result is always a clean library, so a playlist
// with nothing in it can never be switched on.
export function libSetPlaylist(lib, patch) {
  const p = patch && typeof patch === 'object' ? patch : {}
  return libClean({ ...lib, playlist: { ...lib.playlist, ...(typeof p.on === 'boolean' ? { on: p.on } : {}), ...(p.minutes !== undefined ? { minutes: p.minutes } : {}), ...(typeof p.shuffle === 'boolean' ? { shuffle: p.shuffle } : {}) } })
}

// How the library is shown: total size and a friendly line about what each entry is used for.
export function libUses(lib, id) {
  const uses = []
  for (const [k, v] of Object.entries(lib.assign.chats)) if (v === id) uses.push('chat')
  for (const [k, v] of Object.entries(lib.assign.spaces)) if (v === id) uses.push('workspace')
  for (const [k, v] of Object.entries(lib.assign.moods)) if (v === id) uses.push(k)
  if (lib.playlist.ids.includes(id)) uses.push('playlist')
  if (lib.current === id) uses.push('default')
  return uses
}

// Stable key for the open chat / workspace, taken from the sidebar's data-row-key ("session:abc" / "workspace:xyz").
export function libKeyOf(rowKey) {
  if (typeof rowKey !== 'string') return null
  const m = /^(session|workspace):(.+)$/.exec(rowKey)
  if (!m) return null
  const key = (m[1] === 'session' ? 's:' : 'w:') + m[2].replace(/[^a-z0-9:_.-]/gi, '_').slice(0, 76)
  return LIB_KEY.test(key) ? key : null
}

// Mood of the open chat from the app's own status dots.
export function libMoodOf(dotState) {
  return { ongoing: 'working', warning: 'waiting', error: 'error', done: 'done' }[dotState] || null
}
