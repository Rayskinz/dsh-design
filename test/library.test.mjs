import test from 'node:test'
import assert from 'node:assert/strict'
import * as l from '../src/library.js'
import { makeRng } from '../src/games.js'

const item = (id, ext = 'gif') => ({ id, ext, name: id, bytes: 100 })
const lib3 = () => { let x = l.libEmpty(); for (const id of ['aaaaaa', 'bbbbbb', 'cccccc']) x = l.libAdd(x, item(id)); return x }

test('library: add keeps a default, replaces duplicates, caps at LIB_MAX', () => {
  let x = l.libAdd(l.libEmpty(), item('aaaaaa')); assert.equal(x.current, 'aaaaaa'); assert.equal(x.items.length, 1)
  x = l.libAdd(x, { ...item('aaaaaa'), name: 'renamed' }); assert.equal(x.items.length, 1); assert.equal(x.items[0].name, 'renamed')
  let big = l.libEmpty(); for (let i = 0; i < 40; i++) big = l.libAdd(big, item('id' + String(i).padStart(5, '0'))); assert.equal(big.items.length, l.LIB_MAX)
  assert.equal(l.libAdd(x, { id: '!', ext: 'gif' }), x, 'a bad id changes nothing'); assert.equal(l.libAdd(x, { id: 'dddddd', ext: 'exe' }), x)
})

test('library: clean drops junk, dangling references and clamps the playlist', () => {
  const dirty = { items: [item('aaaaaa'), item('aaaaaa'), { id: 'x', ext: 'gif' }, null, { id: 'bbbbbb', ext: 'gif', name: '<b>x</b>\u0007'.repeat(50) }], assign: { chats: { 's:1': 'aaaaaa', 's:2': 'gone', 'bad key!': 'aaaaaa' }, spaces: {}, moods: { working: 'bbbbbb', sleepy: 'aaaaaa' } }, playlist: { on: 'yes', ids: ['aaaaaa', 'aaaaaa', 'nope'], minutes: 99999, shuffle: 1 }, current: 'ghost' }
  const c = l.libClean(dirty)
  assert.deepEqual(c.items.map((i) => i.id), ['aaaaaa', 'bbbbbb']); assert.ok(c.items[1].name.length <= 60 && !/[<>]/.test(c.items[1].name))
  assert.deepEqual(c.assign.chats, { 's:1': 'aaaaaa' }); assert.deepEqual(c.assign.moods, { working: 'bbbbbb' })
  assert.deepEqual(c.playlist, { on: false, ids: ['aaaaaa'], minutes: 240, shuffle: false }, 'on needs a real true')
  assert.equal(c.current, null); assert.deepEqual(l.libClean(null), l.libEmpty()); assert.deepEqual(l.libClean('x'), l.libEmpty())
  assert.equal(l.libClean({ playlist: { minutes: 0 } }).playlist.minutes, 1); assert.equal(l.libClean({ playlist: { minutes: 'x' } }).playlist.minutes, 10)
})

test('library: priority is mood, then this chat, then workspace, then playlist, then default', () => {
  let x = lib3(); x = l.libAssign(x, 'mood', 'error', 'cccccc'); x = l.libAssign(x, 'chat', 's:1', 'bbbbbb'); x = l.libAssign(x, 'space', 'w:1', 'aaaaaa')
  assert.deepEqual(l.libPick(x, { chat: 's:1', space: 'w:1', mood: 'error' }), { id: 'cccccc', why: 'mood' })
  assert.deepEqual(l.libPick(x, { chat: 's:1', space: 'w:1', mood: 'working' }), { id: 'bbbbbb', why: 'chat' })
  assert.deepEqual(l.libPick(x, { chat: 's:2', space: 'w:1' }), { id: 'aaaaaa', why: 'workspace' })
  assert.deepEqual(l.libPick(x, { chat: 's:2', space: 'w:2' }), { id: 'aaaaaa', why: 'default' }, 'default is the first one added')
  x = { ...x, playlist: { on: true, ids: ['bbbbbb', 'cccccc'], minutes: 5, shuffle: false } }
  assert.deepEqual(l.libPick(x, { chat: 's:2', space: 'w:2', tick: 0 }), { id: 'bbbbbb', why: 'playlist' }); assert.equal(l.libPick(x, { tick: 1 }).id, 'cccccc'); assert.equal(l.libPick(x, { tick: 2 }).id, 'bbbbbb')
  assert.equal(l.libPick(x, { chat: 's:1' }).why, 'chat', 'an assigned chat beats the playlist')
  assert.deepEqual(l.libPick(l.libEmpty(), { chat: 's:1' }), { id: null, why: 'none' }); assert.equal(l.libPick(x, { mood: 'bogus', tick: NaN }).why, 'playlist')
})

test('library: shuffle plays every entry once per lap and is repeatable per seed', () => {
  for (const n of [2, 3, 5, 9]) {
    for (let lap = 0; lap < 6; lap++) {
      const seen = new Set(); for (let i = 0; i < n; i++) seen.add(l.libStep(n, lap * n + i, true, 42))
      assert.equal(seen.size, n, `n=${n} lap=${lap}`)
    }
  }
  const a = Array.from({ length: 20 }, (_, t) => l.libStep(7, t, true, 5)), b = Array.from({ length: 20 }, (_, t) => l.libStep(7, t, true, 5)), c = Array.from({ length: 20 }, (_, t) => l.libStep(7, t, true, 6))
  assert.deepEqual(a, b); assert.notDeepEqual(a, c); assert.equal(l.libStep(1, 99, true, 1), 0); assert.equal(l.libStep(0, 5, false), 0)
  assert.deepEqual(Array.from({ length: 5 }, (_, t) => l.libStep(3, t, false)), [0, 1, 2, 0, 1])
})

test('library: removing an entry clears every reference to it and keeps a valid default', () => {
  let x = lib3(); x = l.libAssign(x, 'chat', 's:1', 'bbbbbb'); x = l.libAssign(x, 'space', 'w:1', 'bbbbbb'); x = l.libAssign(x, 'mood', 'done', 'bbbbbb'); x = l.libTogglePlaylist(l.libTogglePlaylist(x, 'bbbbbb'), 'aaaaaa'); x = { ...x, playlist: { ...x.playlist, on: true }, current: 'bbbbbb' }
  const { lib, removed } = l.libRemove(x, 'bbbbbb')
  assert.equal(removed.id, 'bbbbbb'); assert.deepEqual(lib.items.map((i) => i.id), ['aaaaaa', 'cccccc']); assert.deepEqual(lib.assign, { chats: {}, spaces: {}, moods: {} }); assert.deepEqual(lib.playlist.ids, ['aaaaaa']); assert.equal(lib.current, 'aaaaaa')
  assert.deepEqual(l.libClean(lib), lib, 'result is already clean')
  const last = l.libRemove(l.libRemove(l.libRemove(lib, 'aaaaaa').lib, 'cccccc').lib, 'zzzzzz'); assert.equal(last.removed, null); assert.equal(last.lib.current, null)
  const emptied = l.libRemove(l.libTogglePlaylist(l.libAdd(l.libEmpty(), item('aaaaaa')), 'aaaaaa'), 'aaaaaa').lib; assert.equal(emptied.playlist.on, false)
  assert.equal(l.libRemove(x, 'nope').lib, x)
})

test('library: assign validates kind, key and id; null clears; never mutates', () => {
  const x = Object.freeze(lib3())
  const y = l.libAssign(x, 'chat', 's:abc', 'aaaaaa'); assert.equal(y.assign.chats['s:abc'], 'aaaaaa'); assert.deepEqual(x.assign.chats, {})
  assert.equal(l.libAssign(y, 'chat', 's:abc', null).assign.chats['s:abc'], undefined)
  assert.equal(l.libAssign(x, 'chat', 'bad key', 'aaaaaa'), x); assert.equal(l.libAssign(x, 'mood', 'sleepy', 'aaaaaa'), x); assert.equal(l.libAssign(x, 'galaxy', 'a', 'aaaaaa'), x); assert.equal(l.libAssign(x, 'chat', 's:1', 'unknown'), x)
  assert.equal(l.libTogglePlaylist(x, 'unknown'), x)
})

test('library: key helpers read the sidebar markers safely', () => {
  assert.equal(l.libKeyOf('session:abc-123'), 's:abc-123'); assert.equal(l.libKeyOf('workspace:C:/Users/x'), 'w:C:_Users_x'); assert.equal(l.libKeyOf('nope'), null); assert.equal(l.libKeyOf(null), null); assert.equal(l.libKeyOf('session:'), null)
  assert.ok(l.libKeyOf('session:' + 'x'.repeat(500)).length <= 80)
  assert.equal(l.libMoodOf('ongoing'), 'working'); assert.equal(l.libMoodOf('warning'), 'waiting'); assert.equal(l.libMoodOf('idle'), null); assert.equal(l.libMoodOf(undefined), null)
})

test('library: uses lists what an entry is for', () => {
  let x = lib3(); x = l.libAssign(x, 'mood', 'working', 'aaaaaa'); x = l.libAssign(x, 'chat', 's:1', 'aaaaaa'); x = l.libTogglePlaylist(x, 'aaaaaa')
  assert.deepEqual(l.libUses(x, 'aaaaaa').sort(), ['chat', 'default', 'playlist', 'working']); assert.deepEqual(l.libUses(x, 'cccccc'), [])
})

test('library: fuzz - random operations always leave a clean library', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const r = makeRng(seed); let x = l.libEmpty(); const ids = Array.from({ length: 30 }, (_, i) => 'k' + String(i).padStart(6, '0'))
    for (let i = 0; i < 120; i++) {
      const id = ids[Math.floor(r() * ids.length)], a = r()
      x = a < 0.3 ? l.libAdd(x, item(id)) : a < 0.5 ? l.libRemove(x, id).lib : a < 0.7 ? l.libAssign(x, ['chat', 'space', 'mood'][Math.floor(r() * 3)], ['s:1', 's:2', 'w:1', 'working', 'done', 'x y'][Math.floor(r() * 6)], r() < 0.2 ? null : id) : a < 0.9 ? l.libTogglePlaylist(x, id) : l.libSetPlaylist(x, { on: !x.playlist.on, minutes: Math.floor(r() * 400) - 20, shuffle: r() < 0.5 })
      assert.deepEqual(l.libClean(x), x, 'unclean after step ' + i + ' seed ' + seed)
      const p = l.libPick(x, { chat: 's:1', space: 'w:1', mood: 'working', tick: i, seed }); assert.ok(p.id === null || x.items.some((it) => it.id === p.id))
    }
  }
})

test('library: playlist settings are clamped and an empty playlist cannot be switched on', () => {
  const x = lib3()
  assert.equal(l.libSetPlaylist(x, { on: true }).playlist.on, false, 'nothing in it, so it stays off')
  const y = l.libTogglePlaylist(l.libTogglePlaylist(x, 'aaaaaa'), 'bbbbbb')
  const on = l.libSetPlaylist(y, { on: true, minutes: 9999, shuffle: true }); assert.deepEqual(on.playlist, { on: true, ids: ['aaaaaa', 'bbbbbb'], minutes: 240, shuffle: true })
  assert.equal(l.libSetPlaylist(on, { minutes: -5 }).playlist.minutes, 1); assert.equal(l.libSetPlaylist(on, { minutes: 'x' }).playlist.minutes, 10)
  assert.equal(l.libSetPlaylist(on, { on: 'yes' }).playlist.on, true, 'a non-boolean is ignored'); assert.deepEqual(l.libSetPlaylist(on, null).playlist, on.playlist); assert.equal(l.libSetPlaylist(on, { on: false }).playlist.on, false)
})
