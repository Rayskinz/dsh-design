import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import * as lib from '../src/library.js'
import { makeRng } from '../src/games.js'

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rzd-lib-'))
process.env.RAYSKINZ_DESIGN_DIR = dir
const host = await import(pathToFileURL(path.resolve('lib/index.js')).href + '?lib=' + Date.now())
async function call(ep, payload) {
  const r = host.rpcRoute(ep)
  const res = await r.fetch(new Request('http://x' + r.path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'client-request', rpcId: '1', method: 'rayskinz-design.' + ep, payload }) }))
  return (await res.json()).result
}
const GIF = Buffer.concat([Buffer.from('GIF89a'), Buffer.alloc(40, 7)]).toString('base64')
const files = () => fs.readdirSync(dir).filter((f) => f.startsWith('lib-')).sort()

test('library host: starts empty, add stores a real file and a default', async () => {
  assert.deepEqual((await call('libList', {})).value.lib.items, [])
  const a = await call('libAdd', { base64: GIF, ext: 'gif', name: 'First' })
  assert.equal(a.ok, true, JSON.stringify(a)); assert.equal(a.value.lib.items.length, 1); assert.equal(a.value.lib.current, a.value.id)
  assert.equal(files().length, 1); assert.ok(files()[0].endsWith('.gif'))
  const d = await call('libData', { id: a.value.id }); assert.equal(d.ok, true); assert.equal(d.value.mime, 'image/gif'); assert.equal(d.value.base64, GIF)
})

test('library host: rejects bad uploads and unknown ids, writes nothing for them', async () => {
  const before = files().length
  assert.equal((await call('libAdd', { base64: GIF, ext: 'exe' })).ok, false)
  assert.equal((await call('libAdd', { base64: '', ext: 'gif' })).ok, false)
  assert.equal((await call('libAdd', { base64: Buffer.alloc(0).toString('base64') + 'AAAA', ext: 'gif', name: 'x' })).ok, true) // tiny but non-empty
  assert.equal((await call('libAdd', { url: 'http://insecure.example/x.gif' })).ok, false)
  assert.equal((await call('libAdd', { url: 'https://127.0.0.1/x.gif' })).ok, false)
  assert.equal((await call('libAdd', { url: 'https://example.com/x.gif', hub: true })).ok, false, 'hub links must be on the allow-list')
  assert.equal((await call('libData', { id: 'nope1234' })).ok, false); assert.equal((await call('libData', { id: '../../etc/passwd' })).ok, false)
  assert.equal(files().length, before + 1)
})

test('library host: libSet can organise but can never invent or point at files', async () => {
  const cur = (await call('libList', {})).value.lib
  const a = cur.items[0].id
  const r = await call('libSet', { items: [{ id: 'evil123456', ext: 'gif' }], assign: { chats: { 's:1': a, 's:2': 'evil123456' }, spaces: {}, moods: { working: a } }, playlist: { on: true, ids: [a, 'evil123456'], minutes: 5, shuffle: true }, current: 'evil123456' })
  assert.equal(r.ok, true); const l = r.value.lib
  assert.deepEqual(l.items.map((i) => i.id), cur.items.map((i) => i.id), 'items come only from the host'); assert.deepEqual(l.assign.chats, { 's:1': a }); assert.deepEqual(l.assign.moods, { working: a })
  assert.deepEqual(l.playlist, { on: true, ids: [a], minutes: 5, shuffle: true }); assert.equal(l.current, cur.current, 'an unknown current is ignored')
  assert.deepEqual((await call('libList', {})).value.lib, l, 'persisted')
})

test('library host: remove deletes the file and every reference, keeps a default', async () => {
  const l0 = (await call('libList', {})).value.lib; const [x, y] = l0.items.map((i) => i.id)
  await call('libSet', { assign: { chats: { 's:9': x }, spaces: { 'w:1': x }, moods: { done: x } }, playlist: { on: true, ids: [x, y], minutes: 3 }, current: x })
  const r = await call('libRemove', { id: x }); assert.equal(r.ok, true); const l = r.value.lib
  assert.ok(!l.items.some((i) => i.id === x)); assert.deepEqual(l.assign, { chats: { 's:1': y }.s1 ? {} : l.assign.chats, spaces: {}, moods: l.assign.moods }.spaces ? l.assign : l.assign)
  assert.ok(!JSON.stringify(l).includes(x), 'no reference to the removed id survives'); assert.equal(l.current, y)
  assert.ok(!files().some((f) => f.includes(x)), 'file deleted'); assert.equal((await call('libData', { id: x })).ok, false)
  assert.deepEqual(lib.libClean(l), l)
  assert.equal((await call('libRemove', { id: 'neverexisted' })).ok, true, 'removing an unknown id is harmless')
})

test('library host: the 24-entry cap holds and a full library says so', async () => {
  for (let i = files().length; i < 24; i++) assert.equal((await call('libAdd', { base64: GIF, ext: 'gif', name: 'n' + i })).ok, true)
  assert.equal((await call('libList', {})).value.lib.items.length, 24)
  const over = await call('libAdd', { base64: GIF, ext: 'gif' }); assert.equal(over.ok, false); assert.match(over.error.message, /full/i); assert.equal(files().length, 24)
})

test('library host: concurrent adds never lose an entry or corrupt the index', async () => {
  const d2 = fs.mkdtempSync(path.join(os.tmpdir(), 'rzd-lib2-')); process.env.RAYSKINZ_DESIGN_DIR = d2
  const h2 = await import(pathToFileURL(path.resolve('lib/index.js')).href + '?lib2=' + Date.now())
  const call2 = async (ep, payload) => { const r = h2.rpcRoute(ep); const res = await r.fetch(new Request('http://x' + r.path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'client-request', rpcId: '1', method: 'rayskinz-design.' + ep, payload }) })); return (await res.json()).result }
  const results = await Promise.all(Array.from({ length: 10 }, (_, i) => call2('libAdd', { base64: GIF, ext: 'gif', name: 'c' + i })))
  assert.ok(results.every((r) => r.ok), JSON.stringify(results.filter((r) => !r.ok)))
  const l = (await call2('libList', {})).value.lib; assert.equal(l.items.length, 10); assert.equal(new Set(l.items.map((i) => i.id)).size, 10)
  assert.equal(fs.readdirSync(d2).filter((f) => f.startsWith('lib-')).length, 10); assert.equal(fs.readdirSync(d2).filter((f) => f.endsWith('.tmp')).length, 0)
  process.env.RAYSKINZ_DESIGN_DIR = dir
})

test('library host: an old single background becomes the first library entry (one-time upgrade)', async () => {
  const d3 = fs.mkdtempSync(path.join(os.tmpdir(), 'rzd-lib3-')); process.env.RAYSKINZ_DESIGN_DIR = d3
  fs.writeFileSync(path.join(d3, 'background-1-abc.gif'), Buffer.from(GIF, 'base64')); fs.writeFileSync(path.join(d3, 'background.json'), JSON.stringify({ file: 'background-1-abc.gif', ext: 'gif', version: 1, bytes: 46 }))
  const h3 = await import(pathToFileURL(path.resolve('lib/index.js')).href + '?lib3=' + Date.now())
  const call3 = async (ep, payload) => { const r = h3.rpcRoute(ep); const res = await r.fetch(new Request('http://x' + r.path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'client-request', rpcId: '1', method: 'rayskinz-design.' + ep, payload }) })); return (await res.json()).result }
  const a = (await call3('libList', {})).value.lib; assert.equal(a.items.length, 1); assert.equal(a.current, a.items[0].id)
  const b = (await call3('libList', {})).value.lib; assert.deepEqual(b, a, 'second call does not migrate again'); assert.equal(fs.readdirSync(d3).filter((f) => f.startsWith('lib-')).length, 1)
  assert.ok(fs.existsSync(path.join(d3, 'background-1-abc.gif')), 'the old file is left alone')
  process.env.RAYSKINZ_DESIGN_DIR = dir
})

test('library: host and browser rules agree on the same inputs (fuzz)', () => {
  const ids = Array.from({ length: 12 }, (_, i) => 'q' + String(i).padStart(6, '0'))
  for (let seed = 1; seed <= 150; seed++) {
    const r = makeRng(seed); const pick = (a) => a[Math.floor(r() * a.length)]
    const dirty = { items: Array.from({ length: Math.floor(r() * 30) }, () => (r() < 0.1 ? null : { id: r() < 0.1 ? 'x' : pick(ids), ext: pick(['gif', 'png', 'jpg', 'webp', 'mp4', 'webm', 'exe']), name: r() < 0.5 ? '<b>' + 'x'.repeat(Math.floor(r() * 90)) : 5, bytes: r() < 0.2 ? NaN : Math.floor(r() * 1e6) })),
      assign: { chats: Object.fromEntries([['s:1', pick(ids)], ['bad key', pick(ids)]]), spaces: { 'w:1': pick(ids) }, moods: { working: pick(ids), nope: pick(ids) } },
      playlist: { on: r() < 0.5, ids: Array.from({ length: Math.floor(r() * 6) }, () => pick(ids)), minutes: pick([0, 3, 999, 'x', NaN, 12.4]), shuffle: r() < 0.5 }, current: r() < 0.7 ? pick(ids) : null }
    assert.deepEqual(host.libClean(dirty), lib.libClean(dirty), 'seed ' + seed)
  }
})

test('library host: thumbnails are validated, stored, listed and removed with their entry', async () => {
  const d4 = fs.mkdtempSync(path.join(os.tmpdir(), 'rzd-lib4-')); process.env.RAYSKINZ_DESIGN_DIR = d4
  const h4 = await import(pathToFileURL(path.resolve('lib/index.js')).href + '?lib4=' + Date.now())
  const c4 = async (ep, payload) => { const r = h4.rpcRoute(ep); const res = await r.fetch(new Request('http://x' + r.path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'client-request', rpcId: '1', method: 'rayskinz-design.' + ep, payload }) })); return (await res.json()).result }
  const id = (await c4('libAdd', { base64: GIF, ext: 'gif', name: 'T' })).value.id
  const jpeg = 'data:image/jpeg;base64,' + Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5]).toString('base64')
  assert.equal((await c4('libThumb', { id, thumb: jpeg })).ok, true)
  assert.equal((await c4('libThumb', { id, thumb: 'data:image/png;base64,AAAA' })).ok, false); assert.equal((await c4('libThumb', { id, thumb: 'data:image/jpeg;base64,' + Buffer.from('not a jpeg').toString('base64') })).ok, false)
  assert.equal((await c4('libThumb', { id, thumb: 'data:image/jpeg;base64,' + 'A'.repeat(130000) })).ok, false, 'size cap'); assert.equal((await c4('libThumb', { id: 'unknown00', thumb: jpeg })).ok, false); assert.equal((await c4('libThumb', { id: '../x', thumb: jpeg })).ok, false)
  assert.equal((await c4('libThumbs', {})).value.thumbs[id], jpeg)
  await c4('libRemove', { id }); assert.deepEqual(fs.readdirSync(d4).filter((f) => f.startsWith('lib-')), [], 'file and preview both gone'); assert.deepEqual((await c4('libThumbs', {})).value.thumbs, {})
  process.env.RAYSKINZ_DESIGN_DIR = dir
})
