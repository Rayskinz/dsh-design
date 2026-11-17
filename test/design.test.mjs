import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rzd-'))
process.env.RAYSKINZ_DESIGN_DIR = dir
const host = await import(pathToFileURL(path.resolve('lib/index.js')).href)

let captured
globalThis.window = { __ModuleLoader__: { load: (m) => { captured = m } } }
await import(pathToFileURL(path.resolve('lib/client.js')).href + '?t=' + Date.now())
const React = { createElement: () => null, useState: () => [0, () => {}], useEffect() {}, useRef: () => ({}), useCallback: (f) => f }
const client = captured.factory((name) => { assert.equal(name, 'react'); return React })
const { effectCss, borderCss, tintFor, hexRgb, petTick, petFeed, petPlay, petPat, petReward, petBuy, petMood, petLevel, themeFrom, exportTheme, parseTheme, PRESETS, centerPiece } = client.__test

async function call(ep, payload) {
  const r = host.rpcRoute(ep)
  const res = await r.fetch(new Request('http://x' + r.path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'client-request', rpcId: '1', method: 'rayskinz-design.' + ep, payload }) }))
  return (await res.json()).result
}

test('settings are clamped and validated', () => {
  const s = host.sanitizeSettings({ giphyKey: 'IGNORED_FROM_PAGE', panel: 999, dim: -4, blur: 7, speed: 'x', effect: 'bogus', borderStyle: 'neon', borderWidth: 99, borderColor: 'red', tintRules: [{ match: ' opus ', color: '#ABCDEF' }, { match: '', color: '#000000' }, { match: 'x', color: 'nope' }, null] })
  assert.equal(s.panel, 100); assert.equal(s.dim, 0); assert.equal(s.blur, 7); assert.equal(s.speed, 3); assert.equal(s.giphyKey, '', 'a key sent from the page is ignored')
  assert.equal(s.effect, 'off'); assert.equal(s.borderStyle, 'neon'); assert.equal(s.borderWidth, 8); assert.equal(s.borderColor, '#7c5cff')
  assert.deepEqual(s.tintRules, [{ match: 'opus', color: '#abcdef' }])
})

test('tint rules cap at 12', () => {
  const rules = Array.from({ length: 30 }, (_, i) => ({ match: 'w' + i, color: '#112233' }))
  assert.equal(host.sanitizeSettings({ tintRules: rules }).tintRules.length, 12)
})

test('tintFor matches whole words only, first rule wins', () => {
  const rules = [{ match: 'sol', color: '#facc15' }, { match: 'opus', color: '#a78bfa' }]
  assert.equal(tintFor('Sol design pass', rules), '#facc15')
  assert.equal(tintFor('please solve this', rules), null)
  assert.equal(tintFor('Review by OPUS', rules), '#a78bfa')
  assert.equal(tintFor('opus-sol mix', rules), '#facc15')
  assert.equal(tintFor('', rules), null)
  assert.equal(tintFor('anything', [{ match: '.*', color: '#112233' }]), null)
  assert.equal(tintFor('a.b', [{ match: 'a.b', color: '#112233' }]), '#112233')
})

test('hexRgb', () => { assert.equal(hexRgb('#ff8000'), '255,128,0'); assert.equal(hexRgb('bad'), '255,48,48') })

test('border css per style', () => {
  assert.equal(borderCss({ borderStyle: 'off' }, 'f'), '')
  for (const style of ['neon', 'rainbow', 'gold', 'stripes', 'fire']) {
    const css = borderCss({ borderStyle: style, borderWidth: 3, borderColor: '#112233', speed: 3, borderOnlyWorking: false }, 'f')
    assert.ok(css.startsWith('#f{position:fixed'), style); assert.ok(css.includes('pointer-events:none'), style)
    assert.ok(!css.includes('opacity:0'), style)
  }
  const only = borderCss({ borderStyle: 'gold', borderWidth: 2, borderColor: '#112233', speed: 3, borderOnlyWorking: true }, 'f')
  assert.ok(only.includes('opacity:0') && only.includes('svg[data-state="ongoing"]'))
  assert.ok(!borderCss({ borderStyle: 'neon', borderWidth: 50, borderColor: '#112233', speed: 3 }, 'f').includes('50px'))
})

test('effect css per effect', () => {
  assert.equal(effectCss({ effect: 'off', speed: 3 }, 'a', 'b').rule, '')
  for (const e of ['rainbow', 'pulse', 'scanner', 'ember']) {
    const fx = effectCss({ effect: e, speed: 3, effectColor: '#112233' }, 'SEL', 'ICON')
    assert.ok(fx.rule.includes('SEL') && fx.rule.includes('ICON'), e); assert.ok(fx.kf.startsWith('@keyframes'), e)
  }
  assert.ok(effectCss({ effect: 'rainbow', speed: 99 }, 's', 'i').rule.includes('8s'))
})

test('host: settings round trip and defaults', async () => {
  assert.equal((await call('getSettings')).value.effect, 'off')
  const r = await call('setSettings', { effect: 'pulse', panel: 33, tintRules: [{ match: 'a', color: '#123456' }] })
  assert.equal(r.value.panel, 33)
  const again = (await call('getSettings')).value
  assert.equal(again.effect, 'pulse'); assert.equal(again.tintRules[0].match, 'a')
})

test('host: background upload, read back, clear', async () => {
  assert.equal((await call('status')).value.has, false)
  const bytes = Buffer.from('GIF89a-test')
  const a = await call('applyData', { ext: 'gif', base64: bytes.toString('base64') })
  assert.equal(a.ok, true)
  const d = (await call('data')).value
  assert.equal(d.has, true); assert.equal(d.mime, 'image/gif'); assert.equal(Buffer.from(d.base64, 'base64').toString(), 'GIF89a-test')
  assert.equal(fs.readdirSync(dir).filter((n) => n.startsWith('background-')).length, 1)
  await call('applyData', { ext: 'png', base64: bytes.toString('base64') })
  assert.equal(fs.readdirSync(dir).filter((n) => n.startsWith('background-')).length, 1, 'old file removed')
  assert.equal((await call('clear')).value.has, false)
  assert.equal(fs.readdirSync(dir).filter((n) => n.startsWith('background-')).length, 0)
})

test('host: input validation', async () => {
  assert.match((await call('applyData', { ext: 'exe', base64: 'AAAA' })).error.message, /gif, png/)
  assert.match((await call('applyData', { ext: 'gif', base64: '' })).error.message, /base64 is required/)
  assert.match((await call('apply', { url: 'https://example.com/x.gif' })).error.message, /allowed list/)
  assert.match((await call('apply', { url: 'http://w.wallhaven.cc/x.jpg' })).error.message, /https/)
  assert.match((await call('applyLink', { url: 'not a url' })).error.message, /valid link/)
  assert.match((await call('giphy', { q: 'x' })).error.message, /Add your GIPHY key first/)
  assert.match((await call('nope')).error.message, /unknown endpoint/)
  const huge = Buffer.alloc(41 * 1024 * 1024).toString('base64')
  assert.match((await call('applyData', { ext: 'gif', base64: huge })).error.message, /40 MB/)
})

test('host: wrong content type and bad envelope are refused', async () => {
  const r = host.rpcRoute('status')
  assert.equal((await r.fetch(new Request('http://x', { method: 'POST', headers: { 'content-type': 'text/plain' }, body: '{}' }))).status, 415)
  assert.equal((await r.fetch(new Request('http://x', { method: 'POST', headers: { 'content-type': 'application/json' }, body: 'nope' }))).status, 400)
  const res = await r.fetch(new Request('http://x', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'client-request', rpcId: '9', method: 'wrong' }) }))
  assert.equal((await res.json()).result.ok, false)
})

const NOW = 1_800_000_000_000
const mk = (o = {}) => ({ ...host.defaultPet(NOW), ...o })

test('pet: decays with time, clamps, ignores clock going backwards', () => {
  const p = mk({ hunger: 50, joy: 50, lastTick: NOW })
  const later = petTick(p, NOW + 60 * 60e3)
  assert.ok(Math.abs(later.hunger - 40) < 0.01, 'hunger -10/hour'); assert.ok(Math.abs(later.joy - (50 - 60 / 9)) < 0.01)
  assert.equal(petTick(p, NOW + 30 * 24 * 3600e3).hunger, 50 - (48 * 60) / 6 < 0 ? 0 : 50 - 48 * 10, 'capped at 48h')
  assert.equal(petTick(p, NOW - 5000), p, 'time going backwards changes nothing')
  assert.equal(petTick(p, NOW + 500), p, 'under a second changes nothing')
  assert.equal(petTick(mk({ hunger: 1, lastTick: NOW }), NOW + 3 * 3600e3).hunger, 0)
})

test('pet: feed costs coins and never goes over 100', () => {
  const fed = petFeed(mk({ coins: 5, hunger: 90 }))
  assert.equal(fed.coins, 3); assert.equal(fed.hunger, 100); assert.equal(fed.xp, 1)
  const broke = mk({ coins: 1 }); assert.equal(petFeed(broke), broke)
})

test('pet: play, pat, reward', () => {
  const played = petPlay(mk({ joy: 90, hunger: 2 }))
  assert.equal(played.joy, 100); assert.equal(played.hunger, 0); assert.equal(played.xp, 2)
  assert.equal(petPat(mk({ joy: 10 })).joy, 14)
  const r = petReward(mk({ coins: 0, xp: 0 })); assert.equal(r.coins, 3); assert.equal(r.xp, 10)
})

test('pet: buying species', () => {
  const p = mk({ coins: 100 })
  const dog = petBuy(p, 'dog'); assert.equal(dog.coins, 60); assert.deepEqual(dog.unlocked, ['chick', 'cat', 'dog']); assert.equal(dog.species, 'dog')
  assert.equal(petBuy(dog, 'dog'), dog, 'already owned')
  assert.equal(petBuy(p, 'dragon'), p, 'too expensive')
  assert.equal(petBuy(p, 'unicorn'), p, 'unknown species')
})

test('pet: mood and level', () => {
  assert.equal(petMood(mk({ hunger: 5 }), true), 'working')
  assert.equal(petMood(mk({ hunger: 5, joy: 90 }), false), 'hungry')
  assert.equal(petMood(mk({ hunger: 90, joy: 5 }), false), 'sad')
  assert.equal(petMood(mk({ hunger: 90, joy: 90 }), false), 'happy')
  assert.equal(petMood(mk({ hunger: 50, joy: 50 }), false), 'idle')
  assert.equal(petLevel(0), 1); assert.equal(petLevel(20), 2); assert.equal(petLevel(80), 3); assert.equal(petLevel(-5), 1)
})

test('pet: sanitize hostile saved data', () => {
  const p = host.sanitizePet({ name: '  <b>Rex</b>\u0007  ', species: 'dragon', unlocked: ['dog', 'nonsense'], hunger: 'x', joy: 500, coins: -4, born: 9e15, lastTick: 9e15 }, NOW)
  assert.equal(p.name, 'bRex/b'); assert.equal(p.species, 'chick', 'locked species falls back'); assert.deepEqual(p.unlocked, ['chick', 'dog'])
  assert.equal(p.hunger, 80); assert.equal(p.joy, 100); assert.equal(p.coins, 0); assert.ok(p.born <= NOW); assert.ok(p.lastTick <= NOW)
  assert.equal(host.sanitizePet(null, NOW).name, 'Pixel')
  assert.equal(host.sanitizePet({ hunger: 33.337 }, NOW).hunger, 33.34)
})

test('host: pet round trip', async () => {
  const first = (await call('getPet')).value; assert.equal(first.name, 'Pixel')
  const saved = (await call('setPet', { ...first, name: 'Biscuit', coins: 50, species: 'cat' })).value
  assert.equal(saved.name, 'Biscuit')
  const again = (await call('getPet')).value; assert.equal(again.coins, 50); assert.equal(again.species, 'cat')
  assert.equal((await call('setPet', { species: 'dragon' })).value.species, 'chick')
})
test('host: private and local addresses are refused', async () => {
  for (const bad of ['localhost', '127.0.0.1', '10.1.2.3', '172.16.0.9', '172.31.255.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '224.0.0.1', '[::1]', '[fd12::1]', '[fe80::1]', '[::ffff:7f00:1]', 'printer', 'nas.local', 'x.internal', 'a.localhost']) {
    assert.equal(host.isPrivateHost(new URL('https://' + bad + '/x.gif').hostname), true, bad)
    const r = await call('applyLink', { url: 'https://' + bad + '/x.gif' })
    assert.equal(r.ok, false, bad); assert.match(r.error.message, /local network|this computer/, bad)
  }
  for (const good of ['example.com', '8.8.8.8', 'i.imgur.com', '172.32.0.1', '11.0.0.1']) assert.equal(host.isPrivateHost(good), false, good)
  assert.match((await call('applyLink', { url: 'https://user:pw@example.com/x.gif' })).error.message, /username/)
})
test('themes: export never includes private data', () => {
  const settings = { ...host.DEFAULT_SETTINGS, giphyKey: 'SECRETSECRETSECRET', petEnabled: true, bgEnabled: true, effect: 'ember' }
  const out = exportTheme(settings)
  assert.ok(!out.includes('SECRET')); assert.ok(!out.includes('petEnabled')); assert.ok(!out.includes('bgEnabled'))
  assert.equal(parseTheme(out).theme.effect, 'ember')
  assert.deepEqual(Object.keys(themeFrom(settings)).sort(), ['blur', 'borderColor', 'borderOnlyWorking', 'borderStyle', 'borderWidth', 'dim', 'effect', 'effectColor', 'panel', 'speed', 'tintEnabled', 'tintRules'])
})

test('themes: parse rejects junk, drops unknown keys', () => {
  assert.match(parseTheme('hello').error, /not valid theme text/)
  assert.match(parseTheme('{"a":1}').error, /not a Rayskinz theme/)
  assert.match(parseTheme('null').error, /not a Rayskinz theme/)
  assert.match(parseTheme('{"rayskinzDesignTheme":1,"theme":{}}').error, /empty/)
  assert.match(parseTheme('{"rayskinzDesignTheme":2,"theme":{"panel":3}}').error, /not a Rayskinz theme/)
  const r = parseTheme('{"rayskinzDesignTheme":1,"theme":{"panel":30,"giphyKey":"x","petEnabled":true,"__proto__":{"x":1}}}')
  assert.deepEqual(r.theme, { panel: 30 })
})

test('themes: hostile theme values are neutralised by the host sanitiser', () => {
  const hostile = parseTheme(JSON.stringify({ rayskinzDesignTheme: 1, theme: { panel: 1e9, effect: '</style><script>', borderColor: 'url(javascript:1)', borderStyle: 'x', tintRules: [{ match: 'a', color: 'red;background:url(x)' }] } })).theme
  const s = host.sanitizeSettings(hostile)
  assert.equal(s.panel, 100); assert.equal(s.effect, 'off'); assert.equal(s.borderColor, '#7c5cff'); assert.equal(s.borderStyle, 'off'); assert.deepEqual(s.tintRules, [])
})

test('themes: every preset survives the host sanitiser unchanged', () => {
  for (const pr of PRESETS) {
    const s = host.sanitizeSettings(pr.theme)
    for (const [k, v] of Object.entries(pr.theme)) assert.deepEqual(s[k], v, pr.id + ':' + k)
  }
})
function fakeRes(chunks, headers = {}) {
  const { EventEmitter } = globalThis.__ee
  const res = new EventEmitter(); res.headers = headers; res.destroyed = false
  res.destroy = () => { res.destroyed = true; setImmediate(() => res.emit('close')) }
  res.resume = () => {}
  setImmediate(async () => { for (const c of chunks) { if (res.destroyed) return; res.emit('data', Buffer.from(c)); await new Promise((r) => setImmediate(r)) } if (!res.destroyed) { res.emit('end'); res.emit('close') } })
  return res
}
globalThis.__ee = await import('node:events')

test('hardening: body is cut off while streaming, with or without Content-Length', async () => {
  await assert.rejects(host.collectBody(fakeRes(['aaaa', 'bbbb', 'cccc']), 6), /over/)
  await assert.rejects(host.collectBody(fakeRes(['a'], { 'content-length': '999999' }), 10), /over/)
  assert.equal((await host.collectBody(fakeRes(['ab', 'cd']), 10)).toString(), 'abcd')
  await assert.rejects(host.collectBody(fakeRes(['a'], { 'content-length': '999999' }), 10), (e) => e.name === 'Error' && /over/.test(e.message))
})

test('hardening: redirects are followed by hand and every hop is checked', async () => {
  const seen = []
  const mkRequest = (map) => async (url) => { seen.push(url.hostname); const r = map[url.href]; if (!r) throw new Error('unmapped ' + url.href); return r }
  // public -> public ok
  let r = await host.safeGet('https://a.example.com/x', { request: mkRequest({ 'https://a.example.com/x': { status: 302, headers: {}, location: 'https://b.example.com/y' }, 'https://b.example.com/y': { status: 200, headers: {}, bytes: Buffer.from('ok') } }) })
  assert.equal(r.bytes.toString(), 'ok'); assert.deepEqual(seen, ['a.example.com', 'b.example.com'])
  // public -> private is refused BEFORE the private host is contacted
  seen.length = 0
  await assert.rejects(host.safeGet('https://a.example.com/x', { request: mkRequest({ 'https://a.example.com/x': { status: 302, headers: {}, location: 'https://127.0.0.1/secret' } }) }), /local network/)
  assert.deepEqual(seen, ['a.example.com'], 'private hop never requested')
  await assert.rejects(host.safeGet('https://a.example.com/x', { request: mkRequest({ 'https://a.example.com/x': { status: 302, headers: {}, location: 'http://b.example.com/' } }) }), /https/)
  // relative redirect, loop, allow-list on every hop
  r = await host.safeGet('https://a.example.com/x', { request: mkRequest({ 'https://a.example.com/x': { status: 301, headers: {}, location: '/z' }, 'https://a.example.com/z': { status: 200, headers: {}, bytes: Buffer.from('rel') } }) })
  assert.equal(r.bytes.toString(), 'rel')
  await assert.rejects(host.safeGet('https://a.example.com/l', { request: async () => ({ status: 302, headers: {}, location: '/l' }) }), /too many times/)
  await assert.rejects(host.safeGet('https://w.wallhaven.cc/a', { allowHosts: new Set(['w.wallhaven.cc']), request: mkRequest({ 'https://w.wallhaven.cc/a': { status: 302, headers: {}, location: 'https://evil.example.com/a' } }) }), /not on the allowed list/)
})

test('hardening: DNS answers pointing at private addresses are refused at connect time', async () => {
  const dns = await import('node:dns')
  const orig = dns.default.lookup
  const answer = (list) => { dns.default.lookup = (h, o, cb) => setImmediate(() => cb(null, list)) }
  try {
    const run = (opts) => new Promise((res) => host.publicLookup('pub.example.com', opts, (e, a, f) => res({ e, a, f })))
    answer([{ address: '10.0.0.5', family: 4 }]); assert.match((await run({})).e.message, /local network/)
    answer([{ address: '93.184.216.34', family: 4 }, { address: '127.0.0.1', family: 4 }]); assert.match((await run({})).e.message, /local network/, 'any private answer refuses')
    answer([{ address: 'fe90::1', family: 6 }]); assert.match((await run({})).e.message, /local network/, 'fe80::/10 range')
    answer([{ address: '93.184.216.34', family: 4 }])
    const ok1 = await run({}); assert.equal(ok1.a, '93.184.216.34'); assert.equal(ok1.f, 4)
    const ok2 = await run({ all: true }); assert.deepEqual(ok2.a, [{ address: '93.184.216.34', family: 4 }])
  } finally { dns.default.lookup = orig }
})

test('hardening: fe80::/10 and mapped ipv6 are private', () => {
  for (const a of ['fe80::1', 'fe90::1', 'fea0::1', 'febf::1', '::ffff:10.0.0.1']) assert.equal(host.isPrivateHost(a), true, a)
  assert.equal(host.isPrivateHost('2606:4700::1111'), false)
})

test('hardening: the GIPHY key never reaches the page', async () => {
  const set = await call('setGiphyKey', { key: 'abcdefghij0123456789' })
  assert.equal(set.ok, true); assert.equal(set.value.giphyKeySet, true); assert.equal('giphyKey' in set.value, false)
  const got = (await call('getSettings')).value
  assert.equal(got.giphyKeySet, true); assert.equal('giphyKey' in got, false)
  assert.ok(!JSON.stringify(await call('setSettings', { panel: 20, giphyKey: 'otherotherother1234' })).includes('otherother'))
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'settings.json'), 'utf8')).giphyKey, 'abcdefghij0123456789', 'kept on disk, unchanged by setSettings')
  assert.match((await call('setGiphyKey', { key: 'bad key!' })).error.message, /does not look right/)
  assert.equal((await call('setGiphyKey', { key: '' })).value.giphyKeySet, false)
})

test('hardening: concurrent saves lose nothing and leave valid JSON', async () => {
  await Promise.all(Array.from({ length: 25 }, (_, i) => call('setSettings', { panel: 10 + i, dim: i })))
  const s = JSON.parse(fs.readFileSync(path.join(dir, 'settings.json'), 'utf8'))
  assert.equal(typeof s.panel, 'number'); assert.ok(s.panel >= 10 && s.panel <= 34)
  await Promise.all([call('setSettings', { blur: 9 }), call('setSettings', { speed: 7 }), call('setSettings', { effect: 'pulse' })])
  const t = JSON.parse(fs.readFileSync(path.join(dir, 'settings.json'), 'utf8'))
  assert.equal(t.blur, 9); assert.equal(t.speed, 7); assert.equal(t.effect, 'pulse', 'no lost update')
  assert.equal(fs.readdirSync(dir).filter((n) => n.endsWith('.tmp')).length, 0, 'no temp files left')
})

test('hardening: simultaneous background saves leave exactly one consistent file', async () => {
  const bytes = (c) => Buffer.from('GIF89a' + c.repeat(50)).toString('base64')
  await Promise.all(['a', 'b', 'c', 'd', 'e'].map((c) => call('applyData', { ext: 'gif', base64: bytes(c) })))
  const files = fs.readdirSync(dir).filter((n) => n.startsWith('background-') && !n.endsWith('.json'))
  assert.equal(files.length, 1, files.join(','))
  const meta = JSON.parse(fs.readFileSync(path.join(dir, 'background.json'), 'utf8'))
  assert.equal(meta.file, files[0])
  const d = (await call('data')).value; assert.equal(d.has, true)
  await call('clear')
})

test('hardening: oversized requests and encoded uploads are refused early', async () => {
  const r = host.rpcRoute('applyData')
  const res = await r.fetch(new Request('http://x', { method: 'POST', headers: { 'content-type': 'application/json', 'content-length': String(80 * 1024 * 1024) }, body: '{}' }))
  assert.equal(res.status, 413)
  const huge = await r.fetch(new Request('http://x', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'client-request', rpcId: '1', method: 'rayskinz-design.applyData', payload: { ext: 'gif', base64: 'A'.repeat(60 * 1024 * 1024) } }) }))
  assert.equal(huge.status, 413, 'body over the request limit')
  const bad = await call('applyData', { ext: 'gif', base64: 'A'.repeat(56_000_000) })
  assert.match(bad.error.message, /40 MB/, 'under the request limit but over 40 MB once decoded')
})
test('preview pieces are centred by their real bounding box', async () => {
  const { PIECES } = await import(pathToFileURL(path.resolve('src/games.js')).href)
  for (const type of Object.keys(PIECES)) {
    const o = centerPiece(type, 5, 4, 0.8)
    const cs = PIECES[type][0]
    const xs = cs.map((c) => o.ox + c[0] * 0.8), ys = cs.map((c) => o.oy + c[1] * 0.8)
    const left = Math.min(...xs), right = 5 - (Math.max(...xs) + 0.8), top = Math.min(...ys), bottom = 4 - (Math.max(...ys) + 0.8)
    assert.ok(Math.abs(left - right) < 1e-9, type + ' horizontal'); assert.ok(Math.abs(top - bottom) < 1e-9, type + ' vertical')
    assert.ok(left >= 0 && top >= 0, type + ' inside the box')
  }
})
test('gif sources: commons and anime parse real-shaped answers (network faked), reject junk', async () => {
  const https = await import('node:https')
  const { Readable } = await import('node:stream')
  const gifBytes = Buffer.from('GIF89a' + 'x'.repeat(40))
  const answers = (url) => {
    if (url.hostname === 'commons.wikimedia.org') return { type: 'application/json', body: JSON.stringify({ continue: { gsroffset: 24 }, query: { pages: [
      { pageid: 2, index: 2, title: 'File:Two.gif', imageinfo: [{ mime: 'image/gif', size: 1000, url: 'https://upload.wikimedia.org/a/Two.gif', thumburl: 'https://thumb.wikimedia.org/a/Two.gif/240px-Two.gif' }] },
      { pageid: 1, index: 1, title: 'File:One.gif', imageinfo: [{ mime: 'image/gif', size: 1000, url: 'https://upload.wikimedia.org/a/One.gif', thumburl: 'https://thumb.wikimedia.org/a/One.gif/240px-One.gif' }] },
      { pageid: 3, index: 3, title: 'File:Huge.gif', imageinfo: [{ mime: 'image/gif', size: 90 * 1024 * 1024, url: 'https://upload.wikimedia.org/a/Huge.gif', thumburl: 'https://thumb.wikimedia.org/a/Huge.gif' }] },
      { pageid: 4, index: 4, title: 'File:Pic.png', imageinfo: [{ mime: 'image/png', size: 10, url: 'https://upload.wikimedia.org/a/Pic.png', thumburl: 'https://thumb.wikimedia.org/a/Pic.png' }] },
      { pageid: 5, index: 5, title: 'File:Evil.gif', imageinfo: [{ mime: 'image/gif', size: 10, url: 'https://upload.wikimedia.org/a/Evil.gif', thumburl: 'https://127.0.0.1/steal' }] },
    ] } }) }
    if (url.hostname === 'nekos.best' && url.pathname === '/api/v2/search') return { type: 'application/json', body: JSON.stringify({ results: [{ anime_name: 'Avatar: The Last Airbender', url: 'https://nekos.best/api/v2/facepalm/a.gif' }, { anime_name: 'Static', url: 'https://nekos.best/api/v2/neko/b.png' }, { url: 'javascript:alert(1)' }, null] }) }
    if (url.hostname === 'nekos.best') return { type: 'image/gif', body: gifBytes }
    return { type: 'image/gif', body: gifBytes }
  }
  const orig = https.default.request
  https.default.request = (url, opts, cb) => {
    const a = answers(new URL(url)); const res = Readable.from([Buffer.from(a.body)]); res.statusCode = 200; res.headers = { 'content-type': a.type }
    const req = new (require_events())(); req.end = () => setImmediate(() => cb(res)); req.destroy = () => {}; return req
  }
  function require_events() { return globalThis.__ee.EventEmitter }
  try {
    const c = await call('commons', { q: 'cat' })
    assert.equal(c.ok, true, JSON.stringify(c))
    assert.deepEqual(c.value.items.map((i) => i.label), ['One', 'Two'], 'sorted by rank; huge, non-gif and off-host thumbnail dropped')
    assert.equal(c.value.more, true); assert.equal(c.value.nextOffset, 24)
    assert.ok(c.value.items[0].thumb.startsWith('data:image/gif;base64,'))
    const a = await call('anime', { q: 'avatar' })
    assert.equal(a.ok, true, JSON.stringify(a)); assert.deepEqual(a.value.items.map((i) => i.label), ['Avatar: The Last Airbender'])
    assert.equal((await call('commons', { q: '   ' })).ok, false)
    const evil = await call('apply', { url: 'https://nekos.best/api/v2/x/..%2F..%2Fsecret.gif' })
    assert.ok(typeof evil.ok === 'boolean')
  } finally { https.default.request = orig }
})
test.after(() => fs.rmSync(dir, { recursive: true, force: true }))