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
const { effectCss, borderCss, tintFor, hexRgb } = client.__test

async function call(ep, payload) {
  const r = host.rpcRoute(ep)
  const res = await r.fetch(new Request('http://x' + r.path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'client-request', rpcId: '1', method: 'rayskinz-design.' + ep, payload }) }))
  return (await res.json()).result
}

test('settings are clamped and validated', () => {
  const s = host.sanitizeSettings({ panel: 999, dim: -4, blur: 7, speed: 'x', effect: 'bogus', borderStyle: 'neon', borderWidth: 99, borderColor: 'red', tintRules: [{ match: ' opus ', color: '#ABCDEF' }, { match: '', color: '#000000' }, { match: 'x', color: 'nope' }, null] })
  assert.equal(s.panel, 100); assert.equal(s.dim, 0); assert.equal(s.blur, 7); assert.equal(s.speed, 3)
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
  assert.match((await call('giphy', { key: 'short' })).error.message, /does not look right/)
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

test.after(() => fs.rmSync(dir, { recursive: true, force: true }))