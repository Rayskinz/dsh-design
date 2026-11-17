import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import * as themes from '../src/themes.js'
import { makeRng } from '../src/games.js'

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rzd-th-'))
process.env.RAYSKINZ_DESIGN_DIR = dir
const host = await import(pathToFileURL(path.resolve('lib/index.js')).href + '?th=' + Date.now())
async function call(ep, payload) {
  const r = host.rpcRoute(ep)
  const res = await r.fetch(new Request('http://x' + r.path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'client-request', rpcId: '1', method: 'rayskinz-design.' + ep, payload }) }))
  return (await res.json()).result
}

test('themes host: starts empty; a saved theme round-trips through disk', async () => {
  assert.deepEqual((await call('themesGet', {})).value.book, { saved: [], spaces: {} })
  const r = await call('themesSet', { saved: [{ id: 'abcdef12', name: 'Night', theme: { panel: 30, effect: 'aurora', accent: '#EC4899' } }], spaces: { 'w:1': 'abcdef12', 'w:2': 'party' } })
  assert.equal(r.ok, true); assert.deepEqual(r.value.book.saved[0].theme, { panel: 30, effect: 'aurora', accent: '#ec4899' }, 'values are sanitised (colour lower-cased)')
  assert.deepEqual((await call('themesGet', {})).value.book, r.value.book); assert.ok(fs.existsSync(path.join(dir, 'themes.json')))
})

test('themes host: theme bodies are clamped, filtered, and can never carry private keys', async () => {
  const r = await call('themesSet', { saved: [{ id: 'zzzzzz01', name: 'Evil', theme: { panel: 9999, effect: 'bogus', accent: 'javascript:1', userBubble: 'neon', giphyKey: 'SECRET', petEnabled: true, windowX: 5, bgEnabled: false, soundVolume: 99, avatarAssistantKind: 'image', dim: 12 } }], spaces: {} })
  const t = r.value.book.saved[0].theme
  assert.equal(t.panel, 100); assert.equal(t.dim, 12); assert.ok(!('effect' in t) || t.effect === 'off', 'a bogus effect never survives as itself'); assert.ok(!('accent' in t) || t.accent === ''); assert.ok(!('userBubble' in t) || t.userBubble === 'default')
  for (const never of ['giphyKey', 'petEnabled', 'windowX', 'bgEnabled', 'soundVolume', 'avatarAssistantKind']) assert.ok(!(never in t), never)
  assert.ok(!JSON.stringify(r.value.book).includes('SECRET'))
  assert.deepEqual((await call('themesSet', { saved: [{ id: 'yyyyyy01', name: 'Empty', theme: { giphyKey: 'x' } }] })).value.book.saved, [], 'a theme with nothing valid is dropped')
})

test('themes host: bad ids, names, duplicates, dangling workspaces and the caps are cleaned', async () => {
  const many = Array.from({ length: 30 }, (_, i) => ({ id: 'id' + String(i).padStart(6, '0'), name: 'T' + i, theme: { panel: 10 + i } }))
  const r = await call('themesSet', { saved: [{ id: 'bad id!', name: 'x', theme: { panel: 1 } }, { id: 'aaaaaa01', name: '', theme: { panel: 1 } }, { id: 'aaaaaa02', name: '<b>x</b>'.repeat(10), theme: { panel: 1 } }, { id: 'aaaaaa02', name: 'dup', theme: { panel: 2 } }, ...many], spaces: { 'w:1': 'aaaaaa02', 'w:2': 'ghost', 'bad key': 'aaaaaa02', 'w:3': 'cyberpunk', 'w:4': 5 } })
  const b = r.value.book
  assert.equal(b.saved.length, 12); assert.equal(b.saved[0].id, 'aaaaaa02'); assert.ok(b.saved[0].name.length <= 24 && !/[<>]/.test(b.saved[0].name)); assert.deepEqual(b.spaces, { 'w:1': 'aaaaaa02', 'w:3': 'cyberpunk' })
  assert.equal((await call('themesSet', null)).ok, true); assert.deepEqual((await call('themesGet', {})).value.book, { saved: [], spaces: {} })
  assert.deepEqual(fs.readdirSync(dir).filter((f) => f.endsWith('.tmp')), [], 'no temp files')
})

test('themes: host and browser rules produce the same clean book (fuzz)', () => {
  const ids = Array.from({ length: 8 }, (_, i) => 'th' + String(i).padStart(6, '0'))
  for (let seed = 1; seed <= 150; seed++) {
    const r = makeRng(seed); const pick = (a) => a[Math.floor(r() * a.length)]
    const raw = { saved: Array.from({ length: Math.floor(r() * 16) }, () => (r() < 0.1 ? null : { id: r() < 0.1 ? 'x' : pick(ids), name: pick(['Night', '', '  Day  ', '<b>', 'x'.repeat(40), 5]), theme: r() < 0.1 ? null : { panel: pick([10, 55, 100]), effect: pick(['pulse', 'aurora']), accent: pick(['#a78bfa', '#ec4899']) } })),
      spaces: Object.fromEntries([['w:1', pick(ids.concat(['party', 'ghost']))], ['w:2', pick(ids)], ['bad key', pick(ids)]]) }
    const h = host.themeBookClean(raw), b = themes.themeBook(raw, ['avatar', 'cyberpunk', 'minimal', 'party'])
    assert.deepEqual(h.saved.map((x) => [x.id, x.name]), b.saved.map((x) => [x.id, x.name]), 'saved differ at seed ' + seed); assert.deepEqual(h.spaces, b.spaces, 'spaces differ at seed ' + seed)
  }
})
