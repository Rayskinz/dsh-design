import test from 'node:test'
import assert from 'node:assert/strict'
import * as t from '../src/themes.js'
import { makeRng } from '../src/games.js'

let n = 0
const mk = () => 'id' + String(++n).padStart(6, '0')
const look = (o = {}) => ({ panel: 50, effect: 'pulse', accent: '#ec4899', ...o })

test('themes: pick keeps only theme keys and never private ones', () => {
  const p = t.themePick({ panel: 40, effect: 'aurora', giphyKey: 'SECRET', petEnabled: true, windowX: 5, bgEnabled: true, accent: '#fff' })
  assert.deepEqual(Object.keys(p).sort(), ['accent', 'effect', 'panel']); assert.deepEqual(t.themePick(null), {}); assert.deepEqual(t.themePick('x'), {})
  for (const never of ['giphyKey', 'giphyKeySet', 'petEnabled', 'bgEnabled', 'windowX', 'windowOpen', 'soundVolume', 'avatarAssistantKind']) assert.ok(!t.THEME_KEYS.includes(never), never)
})

test('themes: save adds, same name (any case) replaces, empty name or empty look is refused, cap holds', () => {
  const a = t.themeSave([], '  Night  ', look(), mk); assert.equal(a.saved.length, 1); assert.equal(a.saved[0].name, 'Night')
  const b = t.themeSave(a.saved, 'night', look({ panel: 80 }), mk); assert.equal(b.saved.length, 1); assert.equal(b.saved[0].theme.panel, 80); assert.equal(b.id, a.id); assert.equal(b.saved[0].name, 'night')
  assert.match(t.themeSave([], '   ', look(), mk).error, /name/); assert.match(t.themeSave([], 'x', {}, mk).error, /nothing/); assert.match(t.themeSave([], 'x', { giphyKey: 'k' }, mk).error, /nothing/)
  let list = []; for (let i = 0; i < t.THEME_SAVE_MAX; i++) list = t.themeSave(list, 'T' + i, look(), mk).saved
  assert.equal(list.length, t.THEME_SAVE_MAX); assert.match(t.themeSave(list, 'one more', look(), mk).error, /Delete one/); assert.equal(t.themeSave(list, 'T3', look({ dim: 9 }), mk).saved.length, t.THEME_SAVE_MAX, 'replacing at the cap is allowed')
  assert.equal(t.themeSave([], 'x'.repeat(100), look(), mk).saved[0].name.length, 24); assert.equal(t.themeSave([], '<b>hi\u0007', look(), mk).saved[0].name, 'bhi')
})

test('themes: delete removes the theme and every workspace that used it', () => {
  let saved = t.themeSave(t.themeSave([], 'A', look(), mk).saved, 'B', look({ panel: 9 }), mk).saved
  const [A, B] = saved.map((x) => x.id)
  const spaces = { 'w:1': A, 'w:2': B, 'w:3': A, 'w:4': 'party' }
  const r = t.themeDelete(saved, spaces, A); assert.deepEqual(r.saved.map((x) => x.id), [B]); assert.deepEqual(r.spaces, { 'w:2': B, 'w:4': 'party' })
  assert.deepEqual(t.themeDelete(saved, spaces, 'nope').saved, saved); assert.deepEqual(t.themeDelete(null, null, 'x'), { saved: [], spaces: {} })
})

test('themes: assign validates the key and the theme, null clears', () => {
  const saved = [{ id: 'abcdef', name: 'A', theme: look() }]
  assert.deepEqual(t.themeAssignSpace({}, 'w:1', 'abcdef', saved), { 'w:1': 'abcdef' }); assert.deepEqual(t.themeAssignSpace({}, 'w:1', 'party', saved, ['party']), { 'w:1': 'party' })
  assert.deepEqual(t.themeAssignSpace({ 'w:1': 'abcdef' }, 'w:1', null, saved), {}); assert.deepEqual(t.themeAssignSpace({}, 'w:1', 'ghost', saved), {}); assert.deepEqual(t.themeAssignSpace({}, 'bad key!', 'abcdef', saved), {}); assert.deepEqual(t.themeAssignSpace({}, 5, 'abcdef', saved), {})
  const frozen = Object.freeze({ 'w:9': 'abcdef' }); assert.deepEqual(t.themeAssignSpace(frozen, 'w:1', 'abcdef', saved), { 'w:9': 'abcdef', 'w:1': 'abcdef' }); assert.deepEqual(frozen, { 'w:9': 'abcdef' })
})

test('themes: overlay finds the saved or preset look for the open workspace', () => {
  const saved = [{ id: 'abcdef', name: 'Night', theme: { panel: 30 } }]; const presets = [{ id: 'party', label: 'Party', theme: { effect: 'rainbow' } }]
  const spaces = { 'w:1': 'abcdef', 'w:2': 'party', 'w:3': 'gone' }
  assert.deepEqual(t.themeOverlay(spaces, 'w:1', saved, presets), { id: 'abcdef', name: 'Night', theme: { panel: 30 } }); assert.deepEqual(t.themeOverlay(spaces, 'w:2', saved, presets), { id: 'party', name: 'Party', theme: { effect: 'rainbow' } })
  assert.equal(t.themeOverlay(spaces, 'w:3', saved, presets), null); assert.equal(t.themeOverlay(spaces, 'w:9', saved, presets), null); assert.equal(t.themeOverlay(spaces, null, saved, presets), null); assert.equal(t.themeOverlay(null, 'w:1', saved, presets), null)
})

test('themes: book clean drops bad entries, dangling workspaces, duplicates, and respects the cap', () => {
  const raw = { saved: [{ id: 'abcdef', name: 'A', theme: { panel: 1, giphyKey: 'x' } }, { id: 'abcdef', name: 'dup', theme: { panel: 2 } }, { id: 'x', name: 'short id', theme: { panel: 3 } }, { id: 'ghijkl', name: '', theme: { panel: 4 } }, { id: 'mnopqr', name: 'no theme' }, null, { id: 'stuvwx', name: 'ok', theme: { panel: 5 } }],
    spaces: { 'w:1': 'abcdef', 'w:2': 'party', 'w:3': 'nope', 'bad key': 'abcdef', 'w:5': 7 } }
  const c = t.themeBook(raw, ['party']); assert.deepEqual(c.saved.map((x) => x.id), ['abcdef', 'stuvwx']); assert.deepEqual(c.saved[0].theme, { panel: 1 }, 'private keys stripped'); assert.deepEqual(c.spaces, { 'w:1': 'abcdef', 'w:2': 'party' })
  assert.deepEqual(t.themeBook(null), { saved: [], spaces: {} }); assert.deepEqual(t.themeBook('x'), { saved: [], spaces: {} })
  const many = { saved: Array.from({ length: 40 }, (_, i) => ({ id: 'id' + String(i).padStart(6, '0'), name: 'n' + i, theme: { panel: i } })) }; assert.equal(t.themeBook(many).saved.length, t.THEME_SAVE_MAX)
  const manySpaces = { saved: [], spaces: Object.fromEntries(Array.from({ length: 200 }, (_, i) => ['w:' + i, 'party'])) }; assert.equal(Object.keys(t.themeBook(manySpaces, ['party']).spaces).length, 60)
  assert.deepEqual(t.themeBook(c, ['party']), c, 'clean is idempotent')
})

test('themes: next / previous wrap around and recover from an unknown current', () => {
  const ids = ['a', 'b', 'c']
  assert.equal(t.themeStep(ids, 'a', 1), 'b'); assert.equal(t.themeStep(ids, 'c', 1), 'a'); assert.equal(t.themeStep(ids, 'a', -1), 'c'); assert.equal(t.themeStep(ids, 'b', -1), 'a')
  assert.equal(t.themeStep(ids, 'zzz', 1), 'a'); assert.equal(t.themeStep(ids, null, -1), 'c'); assert.equal(t.themeStep([], 'a', 1), null); assert.equal(t.themeStep(null, 'a', 1), null); assert.equal(t.themeStep(['only'], 'only', 1), 'only')
})

test('themes: the active theme is the first whose every key matches the settings exactly', () => {
  const settings = { panel: 50, effect: 'pulse', tintRules: [{ match: 'a', color: '#111111' }], stateEffects: { warning: 'pulse' } }
  const cands = [{ id: 'one', theme: { panel: 60 } }, { id: 'two', theme: { panel: 50, effect: 'pulse' } }, { id: 'three', theme: { panel: 50 } }, { id: 'empty', theme: {} }]
  assert.equal(t.themeActive(settings, cands), 'two'); assert.equal(t.themeActive({ ...settings, effect: 'ember' }, cands), 'three'); assert.equal(t.themeActive({ panel: 1 }, cands), null)
  assert.equal(t.themeActive(settings, [{ id: 'deep', theme: { tintRules: [{ match: 'a', color: '#111111' }], stateEffects: { warning: 'pulse' } } }]), 'deep', 'nested values compare by value'); assert.equal(t.themeActive(null, cands), null); assert.equal(t.themeActive(settings, []), null)
})

test('themes: fuzz - random saves, deletes and assigns keep the book clean', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const r = makeRng(seed); let saved = []; let spaces = {}
    for (let i = 0; i < 80; i++) {
      const a = r()
      if (a < 0.4) { const out = t.themeSave(saved, 'T' + Math.floor(r() * 20), look({ panel: Math.floor(r() * 100) }), mk); if (out.saved) saved = out.saved }
      else if (a < 0.6 && saved.length) { const out = t.themeDelete(saved, spaces, saved[Math.floor(r() * saved.length)].id); saved = out.saved; spaces = out.spaces }
      else spaces = t.themeAssignSpace(spaces, ['w:1', 'w:2', 'w:3', 'bad key'][Math.floor(r() * 4)], r() < 0.2 ? null : saved.length && r() < 0.8 ? saved[Math.floor(r() * saved.length)].id : 'party', saved, ['party'])
      assert.deepEqual(t.themeBook({ saved, spaces }, ['party']), { saved, spaces }, 'unclean at step ' + i + ' seed ' + seed)
    }
  }
})
