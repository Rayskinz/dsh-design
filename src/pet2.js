// Rayskinz DSH Design - pet extras (pure: no DOM, no timers, no audio device).
// Hats you buy and wear, lifetime stats for the stats panel, and the sound plan (which tones play for which
// event). The browser half turns a plan into Web Audio; nothing here makes noise. Prefixed names only.

export const HATS = {
  none: { label: 'No hat', emoji: '', cost: 0 },
  cap: { label: 'Cap', emoji: '\u{1F9E2}', cost: 15 },
  party: { label: 'Party hat', emoji: '\u{1F389}', cost: 20 },
  crown: { label: 'Crown', emoji: '\u{1F451}', cost: 120 },
  wizard: { label: 'Wizard hat', emoji: '\u{1F9D9}', cost: 60 },
  halo: { label: 'Halo', emoji: '\u{1F607}', cost: 45 },
  tophat: { label: 'Top hat', emoji: '\u{1F3A9}', cost: 80 },
}
export const HAT_IDS = Object.keys(HATS)

// Pet-side counters kept with the pet. Everything is clamped so a bad file cannot break the panel.
export const petStatsEmpty = () => ({ chats: 0, games: 0, wins: 0, feeds: 0, pats: 0, coinsEarned: 0, coinsSpent: 0, days: 0, lastDay: '', streak: 0 })

const statInt = (v) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(100_000_000, Math.max(0, Math.round(v))) : 0)
export function petStatsClean(input) {
  const out = petStatsEmpty()
  if (!input || typeof input !== 'object') return out
  for (const k of ['chats', 'games', 'wins', 'feeds', 'pats', 'coinsEarned', 'coinsSpent', 'days', 'streak']) out[k] = statInt(input[k])
  out.lastDay = typeof input.lastDay === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.lastDay) ? input.lastDay : ''
  return out
}

// Add to one counter (and coinsEarned / coinsSpent when `coins` is given). Unknown keys do nothing.
export function petStatsBump(stats, key, by = 1, coins = 0) {
  const s = petStatsClean(stats)
  if (!(key in s) || key === 'lastDay') return s
  s[key] = statInt(s[key] + (Number.isFinite(by) ? by : 0))
  if (Number.isFinite(coins) && coins > 0) s.coinsEarned = statInt(s.coinsEarned + coins)
  if (Number.isFinite(coins) && coins < 0) s.coinsSpent = statInt(s.coinsSpent - coins)
  return s
}

const dayKey = (ms) => { const d = new Date(ms); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') }
const dayNumber = (key) => { const [y, m, d] = key.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / 86400000) }

// Call when the plugin starts (or the day changes): counts a new day and keeps the streak of days in a row.
export function petStatsVisit(stats, now) {
  const s = petStatsClean(stats)
  const today = dayKey(now)
  if (s.lastDay === today) return s
  const gap = s.lastDay ? dayNumber(today) - dayNumber(s.lastDay) : 0
  return { ...s, days: statInt(s.days + 1), streak: s.lastDay && gap === 1 ? statInt(s.streak + 1) : 1, lastDay: today }
}

// Buying and wearing. Returns the same pet when nothing changes.
export function petBuyHat(pet, id) {
  const h = HATS[id]
  const owned = Array.isArray(pet.hats) ? pet.hats : []
  if (!h || id === 'none' || owned.includes(id) || pet.coins < h.cost) return pet
  return { ...pet, coins: pet.coins - h.cost, hats: owned.concat([id]), hat: id, stats: petStatsBump(pet.stats, 'coinsSpent', 0, -h.cost) }
}
export function petWearHat(pet, id) {
  const owned = Array.isArray(pet.hats) ? pet.hats : []
  if (id !== 'none' && !(HATS[id] && owned.includes(id))) return pet
  return pet.hat === id ? pet : { ...pet, hat: id }
}
export const petHatClean = (hat, hats) => {
  const owned = Array.isArray(hats) ? [...new Set(hats.filter((h) => HAT_IDS.includes(h) && h !== 'none'))] : []
  return { hats: owned, hat: hat === 'none' || owned.includes(hat) ? hat : 'none' }
}

// ----------------------------------------------------------------------------------------------- sound
// Sounds are short tone sequences. A plan is [{ at: ms from start, freq: Hz, ms: length, type, gain }].
// Volume (0-100) scales the gain; 0 means silence (an empty plan). Event names that do not exist play nothing.
export const SOUND_EVENTS = ['finish', 'waiting', 'error', 'coin', 'levelup', 'pet', 'win', 'lose']
// n = semitones above middle C (C4 = 262 Hz, so n=9 is A4 = 440 Hz)
const NOTE = (n) => Math.round(440 * Math.pow(2, (n - 9) / 12))
const SOUND_TUNES = {
  finish: [[0, 12, 100, 'sine', 0.9], [100, 16, 100, 'sine', 0.9], [200, 19, 100, 'sine', 0.9], [300, 24, 280, 'sine', 1]],
  waiting: [[0, 14, 90, 'triangle', 0.7], [160, 14, 90, 'triangle', 0.7]],
  error: [[0, 6, 140, 'sawtooth', 0.45], [150, 1, 260, 'sawtooth', 0.45]],
  coin: [[0, 23, 70, 'square', 0.28], [70, 28, 190, 'square', 0.28]],
  levelup: [[0, 12, 90, 'triangle', 0.8], [90, 16, 90, 'triangle', 0.8], [180, 19, 90, 'triangle', 0.8], [270, 24, 280, 'triangle', 0.9]],
  pet: [[0, 21, 60, 'sine', 0.5], [70, 25, 110, 'sine', 0.5]],
  win: [[0, 12, 100, 'square', 0.3], [100, 16, 100, 'square', 0.3], [200, 19, 100, 'square', 0.3], [300, 24, 300, 'square', 0.3]],
  lose: [[0, 7, 170, 'triangle', 0.7], [170, 2, 300, 'triangle', 0.7]],
}
export function soundPlan(event, volume, mutedEvents = []) {
  const tune = SOUND_TUNES[event]
  const v = Number.isFinite(Number(volume)) ? Math.min(100, Math.max(0, Number(volume))) : 0
  if (!tune || v === 0 || (Array.isArray(mutedEvents) && mutedEvents.includes(event))) return []
  const master = Math.pow(v / 100, 1.6) * 0.35
  return tune.map(([at, n, ms, type, g]) => ({ at, freq: NOTE(n), ms, type, gain: Math.round(master * g * 1000) / 1000 }))
}
export const soundLength = (plan) => plan.reduce((m, t) => Math.max(m, t.at + t.ms), 0)

// Rate limit so a burst of events cannot turn into a wall of noise: the same event at most once per `gapMs`.
export function soundAllow(last, event, now, gapMs = 400) {
  if (!SOUND_EVENTS.includes(event)) return { ok: false, last }
  const prev = last && typeof last[event] === 'number' ? last[event] : -Infinity
  if (now - prev < gapMs) return { ok: false, last }
  return { ok: true, last: { ...(last || {}), [event]: now } }
}
