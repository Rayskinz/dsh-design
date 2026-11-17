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
})
const EFFECTS = ['off', 'rainbow', 'pulse', 'scanner', 'ember']

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
  for (const [key, lo, hi] of [['panel', 10, 100], ['dim', 0, 80], ['blur', 0, 20], ['speed', 1, 8]]) {
    const v = num(input?.[key], lo, hi)
    if (v !== undefined) out[key] = v
  }
  if (EFFECTS.includes(input?.effect)) out.effect = input.effect
  if (typeof input?.effectColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(input.effectColor)) out.effectColor = input.effectColor
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

function httpsUrl(raw) {
  let url
  try {
    url = new URL(raw)
  } catch {
    throw new BadRequest('That is not a valid link.')
  }
  if (url.protocol !== 'https:') throw new BadRequest('Only https links are allowed.')
  return url
}

async function download(url, signal) {
  const res = await fetch(url, { signal, headers: { 'user-agent': UA } })
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
    if (!res.ok) return null
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
      const { bytes, ext } = await download(url, signal)
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

export const ENDPOINTS = ['wallhaven', 'giphy', 'apply', 'applyLink', 'applyData', 'status', 'data', 'clear', 'getSettings', 'setSettings']

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
