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
import { randomBytes } from 'node:crypto'
import dns from 'node:dns'
import https from 'node:https'
import os from 'node:os'
import path from 'node:path'

const PREFIX = 'rayskinz-design.'
export const DATA_DIR = process.env.RAYSKINZ_DESIGN_DIR ?? path.join(os.homedir(), '.dsh', 'plugins', 'rayskinz-design')
const META = () => path.join(DATA_DIR, 'background.json')
const SETTINGS = () => path.join(DATA_DIR, 'settings.json')
const MAX_BYTES = 40 * 1024 * 1024
const MAX_THUMB = 700 * 1024
const MAX_ANIME_THUMB = 2200 * 1024
const ANIME_REACTIONS = ['wave', 'dance', 'happy', 'smile', 'wink', 'blush', 'cuddle', 'pat', 'highfive', 'thumbsup', 'laugh', 'shrug', 'think', 'spin']
// Identify ourselves honestly: Wikimedia and nekos.best both require a descriptive User-Agent with contact info.
const UA = 'RayskinzDSHDesign/0.6 (https://github.com/rayskinz/dsh-design; DeepSeek Harness plugin)'

// Hosts the one-click hubs may download from. Pasted links are separate (applyLink).
const HUB_HOSTS = new Set(['upload.wikimedia.org', 'thumb.wikimedia.org', 'nekos.best', 'w.wallhaven.cc', 'th.wallhaven.cc', 'i.giphy.com', 'media.giphy.com', 'media0.giphy.com', 'media1.giphy.com', 'media2.giphy.com', 'media3.giphy.com', 'media4.giphy.com'])

const API_HOSTS = new Set(['wallhaven.cc', 'api.giphy.com', 'commons.wikimedia.org', 'nekos.best'])
// The page posts at most ~55 MB (a 40 MB file as base64 plus the envelope).
const MAX_REQUEST_BYTES = 56 * 1024 * 1024

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
  intensity: 70,
  stateEffects: { warning: 'pulse', error: 'off', done: 'off' },
  stateColors: { warning: '#fbbf24', error: '#f87171', done: '#4ade80' },
  celebrate: 'off',
  celebrateOnGame: true,
  accent: '',
  accentEnabled: false,
  fontFamily: 'default',
  fontSize: 0,
  lineSpacing: 0,
  userBubble: 'default',
  chatWidth: 0,
  familyTint: true,
  lineageBadges: true,
  borderStyle: 'off',
  borderWidth: 2,
  borderColor: '#7c5cff',
  borderOnlyWorking: false,
  tintEnabled: false,
  petEnabled: false,
  windowX: -1,
  windowY: -1,
  windowTab: 'pet',
  windowMin: false,
  windowOpen: false,
  windowSize: 1,
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
  return { name: 'Pixel', species: 'chick', hunger: 80, joy: 80, xp: 0, coins: 10, born: now, lastTick: now, unlocked: ['chick', 'cat'], best: { snake: 0, tetris: 0 } }
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
  out.best = { snake: 0, tetris: 0 }
  for (const game of ['snake', 'tetris']) {
    const v = input?.best?.[game]
    if (typeof v === 'number' && Number.isFinite(v)) out.best[game] = Math.min(10_000_000, Math.max(0, Math.round(v)))
  }
  return out
}

export const EFFECT_IDS = ['off', 'rainbow', 'pulse', 'scanner', 'ember', 'aurora', 'matrix', 'lightning']
const EFFECTS = EFFECT_IDS
const STATE_KEYS = ['warning', 'error', 'done']
const STATE_EFFECTS = ['off', 'pulse', 'scanner', 'ember', 'rainbow']
const CELEBRATE = ['off', 'confetti', 'sparkles', 'hearts']
const FONTS = ['default', 'system', 'serif', 'rounded', 'mono', 'dyslexic']
const BUBBLES = ['default', 'soft', 'outline', 'accent', 'minimal']
const TABS = ['pet', 'snake', 'tetris']
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

export function sanitizeSettings(input, base = DEFAULT_SETTINGS, trustKey = false) {
  const out = { ...base }
  const num = (v, lo, hi) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : undefined)
  if (typeof input?.bgEnabled === 'boolean') out.bgEnabled = input.bgEnabled
  for (const [key, lo, hi] of [['panel', 10, 100], ['dim', 0, 80], ['blur', 0, 20], ['speed', 1, 8], ['borderWidth', 1, 8]]) {
    const v = num(input?.[key], lo, hi)
    if (v !== undefined) out[key] = v
  }
  if (EFFECTS.includes(input?.effect)) out.effect = input.effect
  if (BORDERS.includes(input?.borderStyle)) out.borderStyle = input.borderStyle
  for (const [key, lo, hi] of [['intensity', 10, 100], ['fontSize', -3, 6], ['lineSpacing', -4, 10], ['chatWidth', 0, 1600]]) {
    const v = num(input?.[key], lo, hi)
    if (v !== undefined) out[key] = Math.round(v)
  }
  if (CELEBRATE.includes(input?.celebrate)) out.celebrate = input.celebrate
  if (typeof input?.celebrateOnGame === 'boolean') out.celebrateOnGame = input.celebrateOnGame
  if (typeof input?.accentEnabled === 'boolean') out.accentEnabled = input.accentEnabled
  if (typeof input?.accent === 'string' && (input.accent === '' || HEX.test(input.accent))) out.accent = input.accent.toLowerCase()
  if (FONTS.includes(input?.fontFamily)) out.fontFamily = input.fontFamily
  if (BUBBLES.includes(input?.userBubble)) out.userBubble = input.userBubble
  if (typeof input?.familyTint === 'boolean') out.familyTint = input.familyTint
  if (typeof input?.lineageBadges === 'boolean') out.lineageBadges = input.lineageBadges
  if (input?.stateEffects && typeof input.stateEffects === 'object') {
    out.stateEffects = { ...out.stateEffects }
    for (const k of STATE_KEYS) if (STATE_EFFECTS.includes(input.stateEffects[k])) out.stateEffects[k] = input.stateEffects[k]
  }
  if (input?.stateColors && typeof input.stateColors === 'object') {
    out.stateColors = { ...out.stateColors }
    for (const k of STATE_KEYS) if (typeof input.stateColors[k] === 'string' && HEX.test(input.stateColors[k])) out.stateColors[k] = input.stateColors[k].toLowerCase()
  }
  if (typeof input?.borderOnlyWorking === 'boolean') out.borderOnlyWorking = input.borderOnlyWorking
  if (typeof input?.tintEnabled === 'boolean') out.tintEnabled = input.tintEnabled
  if (typeof input?.petEnabled === 'boolean') out.petEnabled = input.petEnabled
  if (typeof input?.windowMin === 'boolean') out.windowMin = input.windowMin
  if (typeof input?.windowOpen === 'boolean') out.windowOpen = input.windowOpen
  if (TABS.includes(input?.windowTab)) out.windowTab = input.windowTab
  for (const [key, lo, hi] of [['windowX', -1, 20000], ['windowY', -1, 20000]]) {
    const v = num(input?.[key], lo, hi)
    if (v !== undefined) out[key] = Math.round(v)
  }
  const size = num(input?.windowSize, 0.8, 1.6)
  if (size !== undefined) out.windowSize = Math.round(size * 10) / 10
  if (typeof input?.effectColor === 'string' && HEX.test(input.effectColor)) out.effectColor = input.effectColor
  if (typeof input?.borderColor === 'string' && HEX.test(input.borderColor)) out.borderColor = input.borderColor
  if (Array.isArray(input?.tintRules)) {
    out.tintRules = input.tintRules
      .filter((r) => r && typeof r.match === 'string' && r.match.trim().length > 0 && typeof r.color === 'string' && HEX.test(r.color))
      .slice(0, 12)
      .map((r) => ({ match: r.match.trim().slice(0, 40), color: r.color.toLowerCase() }))
  }
  // A key is only accepted from our own file (trustKey) or from the dedicated setGiphyKey call.
  if (trustKey && typeof input?.giphyKey === 'string') out.giphyKey = input.giphyKey.trim().slice(0, 64)
  return out
}

async function loadSettings() {
  return sanitizeSettings(await readJson(SETTINGS()), DEFAULT_SETTINGS, true)
}

// The page never receives the GIPHY key; it only learns whether one is saved.
function publicSettings(settings) {
  const { giphyKey, ...rest } = settings
  return { ...rest, giphyKeySet: giphyKey.length > 0 }
}

// One writer at a time for everything on disk, and every write is a temp file + rename,
// so a crash or two quick saves can never leave half a file or lose an update.
let chain = Promise.resolve()
function locked(fn) {
  const run = chain.then(fn)
  chain = run.catch(() => {})
  return run
}

async function atomicWrite(file, data) {
  const tmp = `${file}.${randomBytes(4).toString('hex')}.tmp`
  await fs.writeFile(tmp, data)
  try {
    await fs.rename(tmp, file)
  } catch (error) {
    await fs.rm(tmp, { force: true })
    throw error
  }
}

const bgFile = (name) => path.join(DATA_DIR, path.basename(String(name)))

function clearBackground() {
  return locked(async () => {
    const meta = await readJson(META())
    await fs.rm(META(), { force: true })
    if (meta?.file) await fs.rm(bgFile(meta.file), { force: true })
  })
}

async function saveBackground(bytes, ext, source) {
  if (bytes.length > MAX_BYTES) throw new BadRequest('That file is over 40 MB.')
  return locked(async () => {
    await fs.mkdir(DATA_DIR, { recursive: true })
    const old = await readJson(META())
    const file = `background-${Date.now()}-${randomBytes(3).toString('hex')}.${ext}`
    await atomicWrite(bgFile(file), bytes)
    const meta = { file, ext, source, version: Date.now(), bytes: bytes.length }
    await atomicWrite(META(), JSON.stringify(meta))
    if (old?.file && old.file !== file) await fs.rm(bgFile(old.file), { force: true })
    return { version: meta.version, ext }
  })
}

// ---------------------------------------------------------------- network safety
// Pasted links are fetched by this computer, so they must stay off the local network.
// Names are checked when the connection is made (publicLookup), so a public-looking
// name that points at a private address, or a redirect, cannot get through.
export function isPrivateHost(hostname) {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal') || (!h.includes('.') && !h.includes(':'))) return true
  if (h.includes(':')) return h === '::1' || h === '::' || /^f[cd]/.test(h) || /^fe[89a-f]/.test(h) || h.startsWith('::ffff:')
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h)
  if (!m) return false
  const [a, b] = [Number(m[1]), Number(m[2])]
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224
}

const LOCAL_MESSAGE = 'That link points at this computer or your local network, which is not allowed.'

export function publicLookup(hostname, options, callback) {
  if (typeof options === 'function') [options, callback] = [{}, options]
  if (typeof options === 'number') options = { family: options }
  dns.lookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) return callback(error)
    if (addresses.length === 0 || addresses.some((a) => isPrivateHost(a.address))) return callback(new BadRequest(LOCAL_MESSAGE))
    if (options?.all) return callback(null, addresses)
    callback(null, addresses[0].address, addresses[0].family)
  })
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
  if (isPrivateHost(url.hostname)) throw new BadRequest(LOCAL_MESSAGE)
  return url
}

// Read a response body, stopping the moment it goes over the limit (a missing or
// false Content-Length cannot make us buffer more than maxBytes).
export function collectBody(res, maxBytes) {
  return new Promise((resolve, reject) => {
    const tooBig = new BadRequest(`That file is over ${Math.round(maxBytes / 1048576) || 1} MB.`)
    if (Number(res.headers['content-length'] ?? 0) > maxBytes) {
      res.destroy()
      return reject(tooBig)
    }
    const chunks = []
    let total = 0
    let done = false
    const finish = (fn, value) => {
      if (!done) {
        done = true
        fn(value)
      }
    }
    res.on('data', (chunk) => {
      total += chunk.length
      if (total > maxBytes) {
        res.destroy()
        finish(reject, tooBig)
        return
      }
      chunks.push(chunk)
    })
    res.on('end', () => finish(resolve, Buffer.concat(chunks)))
    res.on('error', (error) => finish(reject, error))
    res.on('close', () => finish(reject, new Error('connection closed')))
  })
}

function withTimeout(signal, ms) {
  const timer = AbortSignal.timeout(ms)
  return signal && typeof AbortSignal.any === 'function' ? AbortSignal.any([signal, timer]) : timer
}

function requestOnce(url, { signal, maxBytes, accept, timeoutMs }) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method: 'GET', lookup: publicLookup, signal: withTimeout(signal, timeoutMs), timeout: 15000, headers: { 'user-agent': UA, accept } }, (res) => {
      const status = res.statusCode ?? 0
      if (status >= 300 && status < 400 && res.headers.location) {
        res.resume()
        resolve({ status, headers: res.headers, location: String(res.headers.location) })
        return
      }
      collectBody(res, maxBytes).then((bytes) => resolve({ status, headers: res.headers, bytes }), reject)
    })
    req.on('timeout', () => req.destroy(Object.assign(new Error('timeout'), { name: 'TimeoutError' })))
    req.on('error', reject)
    req.end()
  })
}

const MAX_REDIRECTS = 4

// GET over https with every hop checked: private hosts refused, redirects followed by hand,
// an optional host allow-list enforced on every hop, and the body size capped while streaming.
export async function safeGet(raw, { signal, maxBytes = MAX_BYTES, allowHosts, accept = '*/*', timeoutMs = 30000, request = requestOnce } = {}) {
  let url = httpsUrl(raw)
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (allowHosts && !allowHosts.has(url.hostname)) throw new BadRequest(`${url.hostname} is not on the allowed list.`)
    let res
    try {
      res = await request(url, { signal, maxBytes, accept, timeoutMs })
    } catch (error) {
      if (error instanceof BadRequest) throw error
      if (error?.name === 'TimeoutError' || error?.name === 'AbortError') throw new BadRequest('That took too long. Try again.')
      throw new BadRequest(`Could not download that link (${error?.code ?? 'network error'}).`)
    }
    if (res.location !== undefined) {
      let next
      try {
        next = new URL(res.location, url).href
      } catch {
        throw new BadRequest('That link redirected to something invalid.')
      }
      url = httpsUrl(next)
      continue
    }
    return { ...res, url }
  }
  throw new BadRequest('That link redirected too many times.')
}

async function download(raw, signal, allowHosts) {
  const res = await safeGet(raw, { signal, maxBytes: MAX_BYTES, allowHosts, accept: 'image/*,video/*', timeoutMs: 60000 })
  if (res.status !== 200) throw new BadRequest(`Download failed (${res.status}).`)
  const type = String(res.headers['content-type'] ?? '').split(';', 1)[0].trim().toLowerCase()
  const ext = TYPES[type]
  if (!ext) throw new BadRequest(`That link is not an image or video (${type || 'unknown type'}).`)
  return { bytes: res.bytes, ext }
}

async function thumbData(raw, signal, cap = MAX_THUMB) {
  try {
    const res = await safeGet(raw, { signal, maxBytes: cap, allowHosts: HUB_HOSTS, accept: 'image/*', timeoutMs: 15000 })
    if (res.status !== 200) return null
    const type = String(res.headers['content-type'] ?? '').split(';', 1)[0].trim().toLowerCase()
    if (!type.startsWith('image/') || !TYPES[type]) return null
    return `data:${type};base64,${res.bytes.toString('base64')}`
  } catch {
    return null
  }
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length)
  let next = 0
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++
      out[i] = await fn(items[i], i)
    }
  }))
  return out
}

async function apiJson(url, allowHosts, signal) {
  const res = await safeGet(url, { signal, maxBytes: 2 * 1024 * 1024, allowHosts, accept: 'application/json', timeoutMs: 15000 })
  let json = null
  if (res.status === 200) {
    try {
      json = JSON.parse(res.bytes.toString('utf8'))
    } catch {
      throw new BadRequest('That service sent an answer I could not read.')
    }
  }
  return { status: res.status, json }
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
      const res = await apiJson(`https://wallhaven.cc/api/v1/search?${params}`, API_HOSTS, signal)
      if (res.status === 429) throw new BadRequest('Wallhaven says slow down. Try again in a minute.')
      if (res.status !== 200) throw new BadRequest(`Wallhaven answered ${res.status}.`)
      const json = res.json
      const rows = (Array.isArray(json?.data) ? json.data : []).filter((d) => d && typeof d === 'object').slice(0, 24)
      const thumbs = await mapLimit(rows, 6, (d) => thumbData(d.thumbs?.small ?? d.thumbs?.large, signal))
      const items = rows.map((d, i) => ({ id: String(d.id), thumb: thumbs[i], full: d.path, label: String(d.resolution ?? '') })).filter((it) => it.thumb && typeof it.full === 'string')
      return ok({ items, page: json.meta?.current_page ?? page, lastPage: json.meta?.last_page ?? page })
    }
    case 'commons': {
      // Wikimedia Commons: free, no account. Animated GIFs only, size-capped so a pick stays under 40 MB.
      const q = typeof payload?.q === 'string' ? payload.q.trim().slice(0, 120) : ''
      if (!q) throw new BadRequest('Type something to search for.')
      const offset = Math.max(0, Math.min(1000, Math.floor(Number(payload?.offset)) || 0))
      const params = new URLSearchParams({ action: 'query', generator: 'search', gsrsearch: `${q} filemime:image/gif`, gsrnamespace: '6', gsrlimit: '24', gsroffset: String(offset), prop: 'imageinfo', iiprop: 'url|mime|size', iiurlwidth: '240', format: 'json', formatversion: '2' })
      const res = await apiJson(`https://commons.wikimedia.org/w/api.php?${params}`, API_HOSTS, signal)
      if (res.status === 429) throw new BadRequest('Wikimedia says slow down. Try again in a minute.')
      if (res.status !== 200) throw new BadRequest(`Wikimedia answered ${res.status}.`)
      const pages = Array.isArray(res.json?.query?.pages) ? res.json.query.pages.slice().sort((a, b) => (a.index ?? 0) - (b.index ?? 0)) : []
      const rows = pages.filter((p) => p?.imageinfo?.[0]?.mime === 'image/gif' && typeof p.imageinfo[0].url === 'string' && (p.imageinfo[0].size ?? 0) <= MAX_BYTES).slice(0, 24)
      const thumbs = await mapLimit(rows, 6, (p) => thumbData(p.imageinfo[0].thumburl, signal))
      const items = rows
        .map((p, i) => ({ id: String(p.pageid), thumb: thumbs[i], full: p.imageinfo[0].url, label: String(p.title ?? 'GIF').replace(/^File:/, '').replace(/\.gif$/i, '').slice(0, 60) }))
        .filter((it) => it.thumb)
      const next = res.json?.continue?.gsroffset
      return ok({ items, nextOffset: typeof next === 'number' ? next : offset + rows.length, more: typeof next === 'number' })
    }
    case 'anime': {
      // nekos.best: anime reaction GIFs. Search by show name (type 2 = GIFs) or browse a reaction.
      const q = typeof payload?.q === 'string' ? payload.q.trim().slice(0, 80) : ''
      const reaction = typeof payload?.reaction === 'string' && /^[a-z]{2,16}$/.test(payload.reaction) ? payload.reaction : ''
      let rows
      if (q) {
        const res = await apiJson(`https://nekos.best/api/v2/search?${new URLSearchParams({ query: q, type: '2', amount: '20' })}`, API_HOSTS, signal)
        if (res.status === 429) throw new BadRequest('nekos.best says slow down. Try again in a minute.')
        if (res.status !== 200) throw new BadRequest(`nekos.best answered ${res.status}.`)
        rows = Array.isArray(res.json?.results) ? res.json.results : []
      } else {
        const pick = reaction || ANIME_REACTIONS[Math.floor(Math.random() * ANIME_REACTIONS.length)]
        const res = await apiJson(`https://nekos.best/api/v2/${pick}?amount=20`, API_HOSTS, signal)
        if (res.status === 429) throw new BadRequest('nekos.best says slow down. Try again in a minute.')
        if (res.status !== 200) throw new BadRequest(`nekos.best answered ${res.status}.`)
        rows = Array.isArray(res.json?.results) ? res.json.results : []
      }
      rows = rows.filter((r) => r && typeof r.url === 'string' && /\.gif$/i.test(r.url)).slice(0, 20)
      // nekos.best has no thumbnails: the GIF is the thumbnail, so it is fetched with a larger cap.
      const thumbs = await mapLimit(rows, 5, (r) => thumbData(r.url, signal, MAX_ANIME_THUMB))
      const items = rows
        .map((r, i) => ({ id: r.url.split('/').pop().replace(/\.gif$/i, ''), thumb: thumbs[i], full: r.url, label: String(r.anime_name ?? r.anime ?? 'Anime GIF').slice(0, 60) }))
        .filter((it) => it.thumb)
      return ok({ items, nextOffset: 0, more: false })
    }    case 'giphy': {
      const key = (await loadSettings()).giphyKey
      if (!key) throw new BadRequest('Add your GIPHY key first.')
      const q = typeof payload?.q === 'string' ? payload.q.trim().slice(0, 120) : ''
      const offset = Math.max(0, Math.min(4000, Math.floor(Number(payload?.offset)) || 0))
      const params = new URLSearchParams({ api_key: key, limit: '24', offset: String(offset), rating: 'pg', lang: 'en' })
      if (q) params.set('q', q)
      const res = await apiJson(`https://api.giphy.com/v1/gifs/${q ? 'search' : 'trending'}?${params}`, API_HOSTS, signal)
      if (res.status === 401 || res.status === 403) throw new BadRequest('GIPHY rejected that key.')
      if (res.status === 429) throw new BadRequest('GIPHY says slow down (100 searches an hour on a free key).')
      if (res.status !== 200) throw new BadRequest(`GIPHY answered ${res.status}.`)
      const json = res.json
      const rows = (Array.isArray(json?.data) ? json.data : []).filter((d) => d && typeof d === 'object').slice(0, 24)
      const thumbs = await mapLimit(rows, 6, (d) => thumbData(d.images?.fixed_width_still?.url ?? d.images?.fixed_width_small_still?.url, signal))
      const items = rows
        .map((d, i) => ({ id: String(d.id), thumb: thumbs[i], full: d.images?.downsized_large?.url ?? d.images?.original?.url, label: String(d.title || 'GIF') }))
        .filter((it) => it.thumb && typeof it.full === 'string')
      const nextOffset = (json.pagination?.offset ?? offset) + (json.pagination?.count ?? rows.length)
      const total = json.pagination?.total_count ?? 0
      return ok({ items, nextOffset, more: total > nextOffset })
    }
    case 'apply': {
      const url = httpsUrl(need(payload, 'url'))
      if (!HUB_HOSTS.has(url.hostname)) throw new BadRequest(`${url.hostname} is not on the allowed list. Use "Paste a link" instead.`)
      const { bytes, ext } = await download(url.href, signal, HUB_HOSTS)
      return ok(await saveBackground(bytes, ext, url.href))
    }
    case 'applyLink': {
      // Any https link the user pastes themselves. Type-, size- and local-network-checked on every hop.
      const url = httpsUrl(need(payload, 'url'))
      const { bytes, ext } = await download(url.href, signal)
      return ok(await saveBackground(bytes, ext, url.href))
    }
    case 'applyData': {
      const ext = String(payload?.ext ?? '').toLowerCase().replace('jpeg', 'jpg')
      if (!MIME[ext]) throw new BadRequest('Use a gif, png, jpg, webp, mp4 or webm file.')
      const b64 = need(payload, 'base64')
      if (b64.length > Math.ceil((MAX_BYTES * 4) / 3) + 8) throw new BadRequest('That file is over 40 MB.')
      const bytes = Buffer.from(b64, 'base64')
      if (bytes.length === 0) throw new BadRequest('That file is empty.')
      return ok(await saveBackground(bytes, ext, 'uploaded file'))
    }
    case 'setGiphyKey': {
      const key = typeof payload?.key === 'string' ? payload.key.trim() : ''
      if (key !== '' && !/^[A-Za-z0-9]{16,64}$/.test(key)) throw new BadRequest('That GIPHY key does not look right.')
      const next = await locked(async () => {
        const merged = { ...(await loadSettings()), giphyKey: key }
        await fs.mkdir(DATA_DIR, { recursive: true })
        await atomicWrite(SETTINGS(), JSON.stringify(merged, null, 2))
        return merged
      })
      return ok(publicSettings(next))
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
      await locked(async () => {
        await fs.mkdir(DATA_DIR, { recursive: true })
        await atomicWrite(PET(), JSON.stringify(next))
      })
      return ok(next)
    }
    case 'getSettings':
      return ok(publicSettings(await loadSettings()))
    case 'setSettings': {
      const next = await locked(async () => {
        const merged = sanitizeSettings(payload, await loadSettings(), false)
        await fs.mkdir(DATA_DIR, { recursive: true })
        await atomicWrite(SETTINGS(), JSON.stringify(merged, null, 2))
        return merged
      })
      return ok(publicSettings(next))
    }
    default:
      throw new BadRequest(`unknown endpoint ${endpoint}`)
  }
}

export const ENDPOINTS = ['wallhaven', 'commons', 'anime', 'giphy', 'apply', 'applyLink', 'applyData', 'status', 'data', 'clear', 'getSettings', 'setSettings', 'setGiphyKey', 'getPet', 'setPet']

export function rpcRoute(endpoint) {
  const method = `${PREFIX}${endpoint}`
  return {
    path: `/api/${method}`,
    methods: ['POST'],
    requestBody: 'buffered',
    fetch: async (request) => {
      if (request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase() !== 'application/json') return new Response('content type must be application/json', { status: 415 })
      if (Number(request.headers.get('content-length') ?? 0) > MAX_REQUEST_BYTES) return new Response('request too large', { status: 413 })
      let body
      try {
        const text = await request.text()
        if (text.length > MAX_REQUEST_BYTES) return new Response('request too large', { status: 413 })
        body = JSON.parse(text)
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
