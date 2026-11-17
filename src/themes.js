// Rayskinz DSH Design - saved themes and per-workspace looks (pure: no DOM, no timers, no disk).
// A theme is a bag of look settings (the keys in THEME_KEYS). Presets ship with the plugin; saved themes are the
// user's own (up to THEME_SAVE_MAX). A workspace can point at one theme; while a chat from that workspace is open the
// theme is laid over the global settings (the overlay never changes what is saved). Prefixed names only.

export const THEME_KEYS = ['fontFamily', 'fontSize', 'lineSpacing', 'chatWidth', 'userBubble', 'intensity', 'stateEffects', 'stateColors', 'celebrate', 'accent', 'accentEnabled', 'familyTint', 'lineageBadges', 'panel', 'dim', 'blur', 'effect', 'speed', 'effectColor', 'borderStyle', 'borderWidth', 'borderColor', 'borderOnlyWorking', 'tintEnabled', 'tintRules']
export const THEME_SAVE_MAX = 12
const THEME_ID = /^[a-z0-9]{6,12}$/i
const THEME_KEY = /^[a-z0-9:_.-]{1,80}$/i

// Pick only theme keys that are present. Does not validate values (the host does that on save).
export function themePick(settings) {
  const out = {}
  if (!settings || typeof settings !== 'object') return out
  for (const k of THEME_KEYS) if (settings[k] !== undefined) out[k] = settings[k]
  return out
}

const themeName = (v) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 24) : '')

// Normalise the saved-theme list and the workspace map together so neither can point at something that is gone.
// `presetIds` are the ids of built-in looks, which workspaces may also use.
export function themeBook(input, presetIds = []) {
  const saved = []
  const seen = new Set()
  for (const t of Array.isArray(input?.saved) ? input.saved : []) {
    const name = themeName(t?.name)
    if (!t || typeof t.id !== 'string' || !THEME_ID.test(t.id) || seen.has(t.id) || !name || !t.theme || typeof t.theme !== 'object') continue
    seen.add(t.id)
    saved.push({ id: t.id, name, theme: themePick(t.theme) })
    if (saved.length >= THEME_SAVE_MAX) break
  }
  const known = new Set([...seen, ...presetIds])
  const spaces = {}
  if (input?.spaces && typeof input.spaces === 'object') {
    let n = 0
    for (const [k, v] of Object.entries(input.spaces)) {
      if (THEME_KEY.test(k) && typeof v === 'string' && known.has(v)) { spaces[k] = v; if (++n >= 60) break }
    }
  }
  return { saved, spaces }
}

// Save the current look under a name. Same name replaces that theme. Returns { saved, id } or { error }.
export function themeSave(saved, name, theme, makeId) {
  const n = themeName(name)
  if (!n) return { error: 'Give the theme a name.' }
  const body = themePick(theme)
  if (Object.keys(body).length === 0) return { error: 'There is nothing to save yet.' }
  const list = Array.isArray(saved) ? saved : []
  const same = list.find((t) => t.name.toLowerCase() === n.toLowerCase())
  if (same) return { saved: list.map((t) => (t.id === same.id ? { ...t, name: n, theme: body } : t)), id: same.id }
  if (list.length >= THEME_SAVE_MAX) return { error: 'You can keep ' + THEME_SAVE_MAX + ' themes. Delete one first.' }
  const id = makeId()
  return { saved: list.concat([{ id, name: n, theme: body }]), id }
}

// Delete one saved theme and every workspace that used it. Returns { saved, spaces }.
export function themeDelete(saved, spaces, id) {
  return {
    saved: (Array.isArray(saved) ? saved : []).filter((t) => t.id !== id),
    spaces: Object.fromEntries(Object.entries(spaces || {}).filter(([, v]) => v !== id)),
  }
}

// Set (or with id = null clear) the theme for one workspace key.
export function themeAssignSpace(spaces, key, id, saved, presetIds = []) {
  if (typeof key !== 'string' || !THEME_KEY.test(key)) return spaces || {}
  const next = { ...(spaces || {}) }
  if (id === null) delete next[key]
  else if (typeof id === 'string' && ((saved || []).some((t) => t.id === id) || presetIds.includes(id))) next[key] = id
  return next
}

// The look to lay over the global settings for the open workspace, or null.
// `presets` = [{ id, theme }].
export function themeOverlay(spaces, spaceKey, saved, presets) {
  if (!spaceKey || !spaces) return null
  const id = spaces[spaceKey]
  if (!id) return null
  const s = (saved || []).find((t) => t.id === id)
  if (s) return { id, name: s.name, theme: s.theme }
  const p = (presets || []).find((t) => t.id === id)
  return p ? { id, name: p.label || p.id, theme: p.theme } : null
}

// Next theme in a list (for next/previous buttons). `ids` are in display order; an unknown current starts at the first.
export function themeStep(ids, current, dir) {
  if (!Array.isArray(ids) || ids.length === 0) return null
  const at = ids.indexOf(current)
  const d = dir < 0 ? -1 : 1
  return ids[((at < 0 ? (d > 0 ? -1 : 0) : at) + d + ids.length) % ids.length]
}

// Which theme (id) matches the current settings exactly, so the UI can mark it as "in use". Order matters: first match wins.
export function themeActive(settings, candidates) {
  for (const c of candidates) {
    const keys = Object.keys(c.theme || {})
    if (keys.length && keys.every((k) => JSON.stringify(settings?.[k]) === JSON.stringify(c.theme[k]))) return c.id
  }
  return null
}
