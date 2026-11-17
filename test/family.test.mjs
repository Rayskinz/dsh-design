import test from 'node:test'
import assert from 'node:assert/strict'
import * as f from '../src/family.js'

test('family: hex parse/format round trip, junk rejected', () => {
  assert.deepEqual(f.famParse('#ff8000'), { r: 255, g: 128, b: 0 }); assert.equal(f.famToHex({ r: 255, g: 128, b: 0 }), '#ff8000'); assert.equal(f.famToHex({ r: -5, g: 999, b: 3.4 }), '#00ff03')
  for (const bad of ['red', '#fff', '#12345', '#gggggg', '', null, undefined, 5]) assert.equal(f.famParse(bad), null)
})

test('family: shade keeps the hue, gets darker each generation, never vanishes', () => {
  const base = '#a78bfa'
  assert.equal(f.famShade(base, 0), base)
  const lum = (h) => { const c = f.famParse(h); return (c.r * 299 + c.g * 587 + c.b * 114) / 1000 }
  const a = f.famShade(base, 1), b = f.famShade(base, 2), c = f.famShade(base, 3)
  assert.ok(lum(base) > lum(a) && lum(a) > lum(b) && lum(b) > lum(c), [a, b, c].join(' '))
  const deep = f.famShade(base, 60); assert.ok(lum(deep) > 15, 'deep families stay visible: ' + deep)
  const hue = (h) => { const { r, g, b } = f.famParse(h); const mx = Math.max(r, g, b), mn = Math.min(r, g, b); const d = mx - mn; return mx === r ? (((g - b) / d) % 6 + 6) % 6 * 60 : mx === g ? ((b - r) / d + 2) * 60 : ((r - g) / d + 4) * 60 }
  assert.ok(Math.abs(hue(base) - hue(a)) < 6, 'same hue'); assert.equal(f.famShade('nope', 2), null); assert.equal(f.famShade(base, NaN), base); assert.equal(f.famShade(base, -3), base)
  assert.equal(f.famShade('#808080', 2).slice(1, 3), f.famShade('#808080', 2).slice(3, 5), 'greys stay grey')
})

test('family: contrast ratio matches known WCAG values', () => {
  assert.ok(Math.abs(f.famContrast('#000000', '#ffffff') - 21) < 0.01); assert.ok(Math.abs(f.famContrast('#ffffff', '#ffffff') - 1) < 1e-9)
  assert.ok(Math.abs(f.famContrast('#777777', '#ffffff') - 4.48) < 0.05); assert.equal(f.famContrast('x', '#fff'), 1); assert.equal(f.famContrast('#fff', '#000'), f.famContrast('#000', '#fff'))
})

test('family: whole-word, case-insensitive, first rule wins, regex characters are literal', () => {
  const rules = [{ match: 'sol', color: '#facc15' }, { match: 'opus', color: '#a78bfa' }, { match: 'c++', color: '#111111' }, { match: '', color: '#222222' }, { match: 'x', color: 'bad' }]
  assert.equal(f.famMatch('Sol design pass', rules).color, '#facc15'); assert.equal(f.famMatch('please solve this', rules), null)
  assert.equal(f.famMatch('Review by OPUS', rules).match, 'opus'); assert.equal(f.famMatch('opus-sol mix', rules).match, 'sol')
  assert.equal(f.famMatch('c++ port', rules).match, 'c++'); assert.equal(f.famMatch('', rules), null); assert.equal(f.famMatch('x', rules), null); assert.equal(f.famMatch('anything', null), null)
  assert.equal(f.famMatch('a.b', [{ match: '.*', color: '#112233' }]), null)
})

test('family: children inherit a darker shade of the parent colour, own matches win, strangers stay plain', () => {
  const rules = [{ match: 'opus', color: '#a78bfa' }, { match: 'haiku', color: '#4ade80' }]
  const rows = [
    { level: 1, text: 'Plain chat' },
    { level: 1, text: 'Opus design audit' },
    { level: 2, text: 'Checking the tab row' },
    { level: 3, text: 'Reading CSS' },
    { level: 2, text: 'Haiku reader notes' },
    { level: 3, text: 'Reading the manifest' },
    { level: 1, text: 'Another plain' },
    { level: 2, text: 'Child of plain' },
  ]
  const r = f.famResolve(rows, rules)
  assert.equal(r[0].color, null); assert.equal(r[1].color, '#a78bfa'); assert.equal(r[1].inherited, false)
  assert.equal(r[2].color, f.famShade('#a78bfa', 1)); assert.equal(r[2].inherited, true); assert.equal(r[2].parent, 1); assert.equal(r[2].word, 'opus')
  assert.equal(r[3].color, f.famShade('#a78bfa', 2)); assert.equal(r[3].parent, 2)
  assert.equal(r[4].color, '#4ade80', 'a child with its own match owns its colour'); assert.equal(r[4].inherited, false); assert.equal(r[4].parent, 1)
  assert.equal(r[5].color, f.famShade('#4ade80', 1), 'its own child shades from ITS colour, not the grandparent')
  assert.equal(r[6].color, null); assert.equal(r[7].color, null, 'no coloured ancestor, no colour'); assert.equal(r[7].parent, 6)
  assert.deepEqual(f.famResolve([], rules), []); assert.equal(f.famResolve([{ text: 'Opus x' }], rules)[0].color, '#a78bfa', 'missing level means level 1')
})

test('family: resolve never mutates its input and tolerates junk rows', () => {
  const rows = Object.freeze([Object.freeze({ level: 1, text: 'opus' }), Object.freeze({ level: 2, text: null }), Object.freeze({ level: NaN, text: 'x' })])
  const rules = Object.freeze([Object.freeze({ match: 'opus', color: '#a78bfa' })])
  const r = f.famResolve(rows, rules); assert.equal(r.length, 3); assert.equal(r[1].inherited, true)
})

test('family: state words', () => { assert.equal(f.famStateWord('ongoing'), 'working'); assert.equal(f.famStateWord('warning'), 'waiting'); assert.equal(f.famStateWord('nope'), ''); assert.equal(f.famStateWord(undefined), '') })