// Rayskinz DSH Design - host half.
//
// Why a host half exists:
//  - The app's page address changes on every launch (new port), so the browser
//    cannot remember anything. Settings and the chosen background live on disk.
//  - Wallhaven and GIPHY thumbnails are fetched here and sent to the page as
//    small data URLs, so the page never depends on third-party hosts, hotlink
//    rules or page security policy.
//
// RPC wire format follows the shipped plugins: the page posts a `client-request`
// envelope to /api/<method> and gets a `server-response` envelope back.
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const PREFIX = 'rayskinz-design.'
export const DATA_DIR = process.env.RAYSKINZ_DESIGN_DIR ?? path.join(os.homedir(), '.dsh', 'plugins', 'rayskinz-design')
const META = () => path.join(DATA_DIR, 'background.json')
const SETTINGS = () => path.join(DATA_DIR, 'settings.json')
const MAX_BYTES = 40 * 1024 * 1024
const MAX_THUMB = 700 * 1024
const UA = 'Mozilla/5.0 RayskinzDSHDesign'

// Hosts the one-click hubs may download from. Pasted links are separate (applyLink).
const HUB_HOSTS = new Set(['w.wallhaven.cc', 'th.wallhaven.cc', 'i.giphy.com', 'media.giphy.com', 'media0.giphy.com', 'media1.giphy.com', 'media2.giphy.com', 'media3.giphy.com', 'media4.giphy.com'])

const TYPES = { 'image/gif': 'gif', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'video/mp4': 'mp4', 'video/webm': 'webm' }
const MIME = Object.fromEntries(Object.entries(TYPES).map(([m, e]) => [e, m]))

export const DEFAULT_SETTINGS = Object.freeze({
  bgEnabled: true,
  panel: 55,
  dim: 0,
  blur: 0,
  effect: 'off',
  speed: 3,
  effectColor: '#ff3030',
  giphyKey: '',
  borderStyle: 'off',
  borderWidth: 2,
  borderColor: '#7c5cff',
  borderOnlyWorking: false,
  tintEnabled: false,
  petEnabled: false,
  tintRules: [
    { match: 'opus', color: '#a78bfa' },
    { match: 'sonnet', color: '#60a5fa' },
    { match: 'haiku', color: '#4ade80' },
    { match: 'astra', color: '#fb923c' },
    { match: 'sol', color: '#facc15' },
    { match: 'luna', color: '#2dd4bf' },
  ],
})
export const SPECIES = ['chick', 'cat', 'dog', 'fox', 'frog', 'octopus', 'dragon']
const PET = () => path.join(DATA_DIR, 'pet.json')

export function defaultPet(now = Date.now()) {
  return { name: 'Pixel', species: 'chick', hunger: 80, joy: 80, xp: 0, coins: 10, born: now, lastTick: now, unlocked: ['chick', 'cat'] }
}

export function sanitizePet(input, now = Date.now()) {
  const base = defaultPet(now)
  const out = { ...base }
  const bound = (v, lo, hi, digits) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v * digits) / digits)) : undefined)
  for (const [key, lo, hi, digits] of [['hunger', 0, 100, 100], ['joy', 0, 100, 100], ['xp', 0, 1_000_000, 1], ['coins', 0, 1_000_000, 1]]) {
    const v = bound(input?.[key], lo, hi, digits)
    if (v !== undefined) out[key] = v
  }
  if (typeof input?.name === 'string') {
    const name = input.name.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 16)
    if (name) out.name = name
  }
  if (SPECIES.includes(input?.species)) out.species = input.species
  if (typeof input?.born === 'number' && input.born > 0 && input.born <= now) out.born = Math.round(input.born)
  if (typeof input?.lastTick === 'number' && input.lastTick > 0 && input.lastTick <= now + 60_000) out.lastTick = Math.min(Math.round(input.lastTick), now)
  if (Array.isArray(input?.unlocked)) {
    const set = new Set(input.unlocked.filter((s) => SPECIES.includes(s)))
    set.add('chick')
    out.unlocked = SPECIES.filter((s) => set.has(s))
  }
  if (!out.unlocked.includes(out.species)) out.species = 'chick'
  return out
}

const EFFECTS = ['off', 'rainbow', 'pulse', 'scanner', 'ember']
const BORDERS = ['off', 'neon', 'rainbow', 'gold', 'stripes', 'fire']
const HEX = /^#[0-9a-fA-F]{6}$/

class BadRequest extends Error {}

const ok = (value) => ({ ok: true, value })
function fail(error) {
  const message = error instanceof Error ? error.message : String(error)
  const bad = error instanceof BadRequest
  return { ok: false, error: { code: bad ? 'bad-request' : 'internal', message, details: bad ? { issues: [] } : {} } }
}

async function readJson(file) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'))
  } catch {
    return null
  }
}

export function sanitizeSettings(input, base = DEFAULT_SETTINGS) {
  const out = { ...base }
  const num = (v, lo, hi) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : undefined)
  if (typeof input?.bgEnabled === 'boolean') out.bgEnabled = input.bgEnabled
  for (const [key, lo, hi] of [['panel', 10, 100], ['dim', 0, 80], ['blur', 0, 20], ['speed', 1, 8], ['borderWidth', 1, 8]]) {
    const v = num(input?.[key], lo, hi)
    if (v !== undefined) out[key] = v
  }
  if (EFFECTS.includes(input?.effect)) out.effect = input.effect
  if (BORDERS.includes(input?.borderStyle)) out.borderStyle = input.borderStyle
  if (typeof input?.borderOnlyWorking === 'boolean') out.borderOnlyWorking = input.borderOnlyWorking
  if (typeof input?.tintEnabled === 'boolean') out.tintEnabled = input.tintEnabled
  if (typeof input?.petEnabled === 'boolean') out.petEnabled = input.petEnabled
  if (typeof input?.effectColor === 'string' && HEX.test(input.effectColor)) out.effectColor = input.effectColor
  if (typeof input?.borderColor === 'string' && HEX.test(input.borderColor)) out.borderColor = input.borderColor
  if (Array.isArray(input?.tintRules)) {
    out.tintRules = input.tintRules
      .filter((r) => r && typeof r.match === 'string' && r.match.trim().length > 0 && typeof r.color === 'string' && HEX.test(r.color))
      .slice(0, 12)
      .map((r) => ({ match: r.match.trim().slice(0, 40), color: r.color.toLowerCase() }))
  }
  if (typeof input?.giphyKey === 'string') out.giphyKey = input.giphyKey.trim().slice(0, 64)
  return out
}

async function loadSettings() {
  return sanitizeSettings(await readJson(SETTINGS()))
}

async function clearBackground() {
  const meta = await readJson(META())
  if (meta?.file) await fs.rm(path.join(DATA_DIR, meta.file), { force: true })
  await fs.rm(META(), { force: true })
}

async function saveBackground(bytes, ext, source) {
  if (bytes.length > MAX_BYTES) throw new BadRequest('That file is over 40 MB.')
  await fs.mkdir(DATA_DIR, { recursive: true })
  await clearBackground()
  const file = `background-${Date.now()}.${ext}`
  await fs.writeFile(path.join(DATA_DIR, file), bytes)
  const meta = { file, ext, source, version: Date.now(), bytes: bytes.length }
  await fs.writeFile(META(), JSON.stringify(meta))
  return { version: meta.version, ext }
}

// Pasted links are fetched by this computer, so keep them off the local network.
export function isPrivateHost(hostname) {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal') || !h.includes('.') && !h.includes(':')) return true
  if (h.includes(':')) return h === '::1' || h === '::' || /^f[cd]/.test(h) || h.startsWith('fe80') || h.startsWith('::ffff:')
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h)
  if (!m) return false
  const [a, b] = [Number(m[1]), Number(m[2])]
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224
}

function httpsUrl(raw) {
  let url
  try {
    url = new URL(raw)
  } catch {
    throw new BadRequest('That is not a valid link.')
  }
  if (url.protocol !== 'https:') throw new BadRequest('Only https links are allowed.')
  if (url.username || url.password) throw new BadRequest('Links with a username or password are not allowed.')
  if (isPrivateHost(url.hostname)) throw new BadRequest('That link points at this computer or your local network, which is not allowed.')
  return url
}

async function download(url, signal, hubOnly = false) {
  const res = await fetch(url, { signal, headers: { 'user-agent': UA } })
  // A redirect must not escape the host check.
  const final = new URL(res.url || url)
  if (isPrivateHost(final.hostname) || final.protocol !== 'https:') throw new BadRequest('That link redirected somewhere that is not allowed.')
  if (hubOnly && !HUB_HOSTS.has(final.hostname)) throw new BadRequest(`That link redirected to ${final.hostname}, which is not on the allowed list.`)
  if (!res.ok) throw new BadRequest(`Download failed (${res.status}).`)
  const type = (res.headers.get('content-type') ?? '').split(';', 1)[0].trim().toLowerCase()
  const ext = TYPES[type]
  if (!ext) throw new BadRequest(`That link is not an image or video (${type || 'unknown type'}).`)
  if (Number(res.headers.get('content-length') ?? 0) > MAX_BYTES) throw new BadRequest('That file is over 40 MB.')
  const bytes = Buffer.from(await res.arrayBuffer())
  if (bytes.length > MAX_BYTES) throw new BadRequest('That file is over 40 MB.')
  return { bytes, ext }
}

async function thumbData(raw, signal) {
  try {
    const url = httpsUrl(raw)
    if (!HUB_HOSTS.has(url.hostname)) return null
    const res = await fetch(url, { signal, headers: { 'user-agent': UA } })
    if (!res.ok || !HUB_HOSTS.has(new URL(res.url || url).hostname)) return null
    const type = (res.headers.get('content-type') ?? '').split(';', 1)[0].trim().toLowerCase()
    if (!type.startsWith('image/')) return null
    const bytes = Buffer.from(await res.arrayBuffer())
    if (bytes.length > MAX_THUMB) return null
    return `data:${type};base64,${bytes.toString('base64')}`
  } catch {
    return null
  }
}

function need(payload, field) {
  const value = payload?.[field]
  if (typeof value !== 'string' || value.length === 0) throw new BadRequest(`${field} is required.`)
  return value
}

async function dispatch(endpoint, payload, signal) {
  switch (endpoint) {
    case 'wallhaven': {
      // Safe-for-work only. Wallhaven's other tiers need an account key; not exposed here.
      const q = typeof payload?.q === 'string' ? payload.q.slice(0, 120) : ''
      const sorting = ['relevance', 'toplist', 'date_added', 'views', 'favorites', 'random'].includes(payload?.sorting) ? payload.sorting : q ? 'relevance' : 'toplist'
      const page = Math.max(1, Math.min(50, Math.floor(Number(payload?.page)) || 1))
      const atleast = /^\d{3,4}x\d{3,4}$/.test(payload?.atleast ?? '') ? payload.atleast : '1920x1080'
      const params = new URLSearchParams({ q, sorting, page: String(page), purity: '100', categories: '111', atleast })
      const res = await fetch(`https://wallhaven.cc/api/v1/search?${params}`, { signal, headers: { accept: 'application/json', 'user-agent': UA } })
      if (res.status === 429) throw new BadRequest('Wallhaven says slow down. Try again in a minute.')
      if (!res.ok) throw new BadRequest(`Wallhaven answered ${res.status}.`)
      const json = await res.json()
      const rows = (json.data ?? []).slice(0, 24)
      const thumbs = await Promise.all(rows.map((d) => thumbData(d.thumbs?.small ?? d.thumbs?.large, signal)))
      const items = rows.map((d, i) => ({ id: d.id, thumb: thumbs[i], full: d.path, label: d.resolution })).filter((it) => it.thumb)
      return ok({ items, page: json.meta?.current_page ?? page, lastPage: json.meta?.last_page ?? page })
    }
    case 'giphy': {
      const key = need(payload, 'key').trim()
      if (!/^[A-Za-z0-9]{16,64}$/.test(key)) throw new BadRequest('That GIPHY key does not look right.')
      const q = typeof payload?.q === 'string' ? payload.q.trim().slice(0, 120) : ''
      const offset = Math.max(0, Math.min(4000, Math.floor(Number(payload?.offset)) || 0))
      const params = new URLSearchParams({ api_key: key, limit: '24', offset: String(offset), rating: 'pg', lang: 'en' })
      if (q) params.set('q', q)
      const res = await fetch(`https://api.giphy.com/v1/gifs/${q ? 'search' : 'trending'}?${params}`, { signal, headers: { accept: 'application/json', 'user-agent': UA } })
      if (res.status === 401 || res.status === 403) throw new BadRequest('GIPHY rejected that key.')
      if (res.status === 429) throw new BadRequest('GIPHY says slow down (100 searches an hour on a free key).')
      if (!res.ok) throw new BadRequest(`GIPHY answered ${res.status}.`)
      const json = await res.json()
      const rows = (json.data ?? []).slice(0, 24)
      const thumbs = await Promise.all(rows.map((d) => thumbData(d.images?.fixed_width_still?.url ?? d.images?.fixed_width_small_still?.url, signal)))
      const items = rows
        .map((d, i) => ({ id: d.id, thumb: thumbs[i], full: d.images?.downsized_large?.url ?? d.images?.original?.url, label: d.title || 'GIF' }))
        .filter((it) => it.thumb && it.full)
      const nextOffset = (json.pagination?.offset ?? offset) + (json.pagination?.count ?? rows.length)
      const total = json.pagination?.total_count ?? 0
      return ok({ items, nextOffset, more: total > nextOffset })
    }
    case 'apply': {
      const url = httpsUrl(need(payload, 'url'))
      if (!HUB_HOSTS.has(url.hostname)) throw new BadRequest(`${url.hostname} is not on the allowed list. Use "Paste a link" instead.`)
      const { bytes, ext } = await download(url, signal, true)
      return ok(await saveBackground(bytes, ext, url.href))
    }
    case 'applyLink': {
      // Any https link the user pastes themselves. Still type- and size-checked.
      const url = httpsUrl(need(payload, 'url'))
      const { bytes, ext } = await download(url, signal)
      return ok(await saveBackground(bytes, ext, url.href))
    }
    case 'applyData': {
      const ext = String(payload?.ext ?? '').toLowerCase().replace('jpeg', 'jpg')
      if (!MIME[ext]) throw new BadRequest('Use a gif, png, jpg, webp, mp4 or webm file.')
      const bytes = Buffer.from(need(payload, 'base64'), 'base64')
      if (bytes.length === 0) throw new BadRequest('That file is empty.')
      return ok(await saveBackground(bytes, ext, 'uploaded file'))
    }
    case 'status': {
      const meta = await readJson(META())
      return ok(meta ? { has: true, version: meta.version, ext: meta.ext, source: meta.source } : { has: false })
    }
    case 'data': {
      const meta = await readJson(META())
      if (!meta) return ok({ has: false })
      const bytes = await fs.readFile(path.join(DATA_DIR, meta.file))
      return ok({ has: true, version: meta.version, ext: meta.ext, mime: MIME[meta.ext] ?? 'application/octet-stream', base64: bytes.toString('base64') })
    }
    case 'clear': {
      await clearBackground()
      return ok({ has: false })
    }
    case 'getPet':
      return ok(sanitizePet(await readJson(PET())))
    case 'setPet': {
      const next = sanitizePet(payload)
      await fs.mkdir(DATA_DIR, { recursive: true })
      await fs.writeFile(PET(), JSON.stringify(next))
      return ok(next)
    }
    case 'getSettings':
      return ok(await loadSettings())
    case 'setSettings': {
      const next = sanitizeSettings(payload, await loadSettings())
      await fs.mkdir(DATA_DIR, { recursive: true })
      await fs.writeFile(SETTINGS(), JSON.stringify(next, null, 2))
      return ok(next)
    }
    default:
      throw new BadRequest(`unknown endpoint ${endpoint}`)
  }
}

export const ENDPOINTS = ['wallhaven', 'giphy', 'apply', 'applyLink', 'applyData', 'status', 'data', 'clear', 'getSettings', 'setSettings', 'getPet', 'setPet']

export function rpcRoute(endpoint) {
  const method = `${PREFIX}${endpoint}`
  return {
    path: `/api/${method}`,
    methods: ['POST'],
    requestBody: 'buffered',
    fetch: async (request) => {
      if (request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase() !== 'application/json') return new Response('content type must be application/json', { status: 415 })
      let body
      try {
        body = await request.json()
      } catch {
        return new Response('body is not JSON', { status: 400 })
      }
      const rpcId = typeof body?.rpcId === 'string' ? body.rpcId : 'invalid-request'
      if (body?.type !== 'client-request' || body.method !== method) {
        return Response.json({ type: 'server-response', rpcId, result: { ok: false, error: { code: 'gateway/bad-request', message: 'invalid client-request message', details: { issues: [] } } } })
      }
      let result
      try {
        result = await dispatch(endpoint, body.payload, request.signal)
      } catch (error) {
        result = fail(error)
      }
      return Response.json({ type: 'server-response', rpcId, result })
    },
  }
}

export function apply(ctx) {
  ctx.inject(['connection'], (scope) => {
    const register = scope.get('connection').fetch.register
    for (const endpoint of ENDPOINTS) scope.effect(() => register(rpcRoute(endpoint)), `rayskinz-design: ${endpoint} route`)
  })
}
