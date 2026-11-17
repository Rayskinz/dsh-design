import test from 'node:test'
import assert from 'node:assert/strict'
import * as k from '../src/look.js'

test('look: default settings produce no css at all (the app stays untouched)', () => {
  assert.equal(k.lookCss({ fontFamily: 'default', fontSize: 0, lineSpacing: 0, userBubble: 'default', chatWidth: 0 }), '')
  assert.equal(k.lookCss({}), ''); assert.equal(k.lookCss({ fontFamily: 'nope', userBubble: 'nope', fontSize: 'x', chatWidth: 'x' }), '')
})

test('look: font families map to stacks that end in a generic family', () => {
  for (const [id, f] of Object.entries(k.LOOK_FONTS)) { if (id === 'default') { assert.equal(f.stack, ''); continue } assert.match(f.stack, /(serif|sans-serif|monospace)$/, id); assert.ok(f.label.length > 2) }
  assert.match(k.lookCss({ fontFamily: 'serif' }), /--dsh-font-family-text:Georgia/); assert.doesNotMatch(k.lookCss({ fontFamily: 'serif' }), /undefined/)
})

test('look: text size adds to the app size, clamped 10-22, secondary size follows', () => {
  assert.equal(k.lookSize(14, 2), 16); assert.equal(k.lookSize(14, 99), 20); assert.equal(k.lookSize(20, 6), 22); assert.equal(k.lookSize(11, -3), 10); assert.equal(k.lookSize(undefined, 2), 16); assert.equal(k.lookSize(-5, 0), 14)
  const css = k.lookCss({ fontSize: 3 }, { size: 14 }); assert.match(css, /--dsh-content-font-size:17px/); assert.match(css, /--dsh-content-font-size-secondary:16px/)
  assert.doesNotMatch(k.lookCss({ fontSize: 0 }, { size: 14 }), /font-size/)
})

test('look: line spacing is a clamped px delta, chat width is zero or 520-1600', () => {
  assert.equal(k.lookLineDelta(3), 3); assert.equal(k.lookLineDelta(99), 10); assert.equal(k.lookLineDelta(-99), -4); assert.equal(k.lookLineDelta('x'), 0)
  assert.match(k.lookCss({ lineSpacing: 4 }), /--dsh-content-font-delta:4px/); assert.match(k.lookCss({ lineSpacing: -2 }), /--dsh-content-font-delta:-2px/)
  assert.equal(k.lookWidth(0), 0); assert.equal(k.lookWidth(100), 520); assert.equal(k.lookWidth(5000), 1600); assert.equal(k.lookWidth(900), 900); assert.equal(k.lookWidth('x'), 0); assert.equal(k.lookWidth(-1), 0)
  assert.match(k.lookCss({ chatWidth: 900 }), /--dsh-chat-content-width:900px/); assert.doesNotMatch(k.lookCss({ chatWidth: 0 }), /chat-content-width/)
})

test('look: every bubble style targets only the message bubble and is safe against bad colours', () => {
  for (const id of Object.keys(k.LOOK_BUBBLES)) {
    const css = k.lookBubbleCss(id, '#a78bfa', '#111111'); if (id === 'default') { assert.equal(css, ''); continue }
    assert.ok(css.startsWith('[data-message-bubble]'), id); assert.ok(css.length > 40); assert.doesNotMatch(css, /undefined|NaN|javascript|url\(/i)
  }
  assert.match(k.lookBubbleCss('accent', '#a78bfa', '#111111'), /background:#a78bfa!important;color:#111111!important/)
  assert.match(k.lookBubbleCss('soft', 'red; background:url(x)', 'x'), /#4176e6/, 'a bad colour falls back to the default blue'); assert.doesNotMatch(k.lookBubbleCss('soft', 'red; background:url(x)', 'x'), /url\(/)
  assert.equal(k.lookBubbleCss('bogus', '#a78bfa', '#fff'), '')
})

test('look: accent bubble uses the accent only when the accent is switched on', () => {
  assert.match(k.lookCss({ userBubble: 'accent', accentEnabled: true, accent: '#ec4899', accentText: '#111111' }), /#ec4899/)
  assert.match(k.lookCss({ userBubble: 'accent', accentEnabled: false, accent: '#ec4899' }), /#4176e6/)
})

test('look: fuzz - random settings never produce broken css', () => {
  const pick = (a, r) => a[Math.floor(r * a.length)]
  let seed = 7; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296
  for (let i = 0; i < 400; i++) {
    const css = k.lookCss({ fontFamily: pick(['default', 'serif', 'mono', 'rounded', 'system', 'dyslexic', 'zzz', 5], rnd()), fontSize: pick([-9, -3, 0, 2, 6, 99, 'x', null], rnd()), lineSpacing: pick([-9, 0, 5, 99, NaN], rnd()), userBubble: pick(Object.keys(k.LOOK_BUBBLES).concat(['x', 3]), rnd()), chatWidth: pick([0, 100, 700, 99999, 'a'], rnd()), accentEnabled: rnd() < 0.5, accent: pick(['#a78bfa', '', 'bad', '#12345g'], rnd()) }, { size: pick([0, 12, 14, 18, NaN, undefined], rnd()) })
    assert.doesNotMatch(css, /undefined|NaN|null/, css); const opens = (css.match(/{/g) || []).length, closes = (css.match(/}/g) || []).length; assert.equal(opens, closes, css)
  }
})

test('avatars: nothing is drawn unless a side is switched on and has a face', () => {
  assert.equal(k.avatarCss({}), ''); assert.equal(k.avatarCss({ avatarAssistantKind: 'none', avatarUserKind: 'none' }), '')
  assert.equal(k.avatarCss({ avatarAssistantKind: 'image', avatarUserKind: 'image' }, {}), '', 'an image kind with no stored picture draws nothing')
})

test('avatars: emoji, pet and image faces target the right rows and stay safe', () => {
  const css = k.avatarCss({ avatarAssistantKind: 'emoji', avatarAssistantEmoji: '\u{1F989}', avatarUserKind: 'pet', avatarSize: 30 }, {}, '\u{1F98A}')
  assert.match(css, /\[data-chat-group-part="response"\]::before\{content:"\u{1F989}"/u); assert.match(css, /\[data-chat-flow-kind="user"\]::before\{content:"\u{1F98A}"/u)
  assert.match(css, /width:30px;height:30px/); assert.match(css, /margin-left:auto/)
  const png = 'data:image/png;base64,iVBORw0KGgo='
  const withImg = k.avatarCss({ avatarAssistantKind: 'image', avatarSize: 24 }, { assistant: png }); assert.match(withImg, /url\("data:image\/png;base64,iVBORw0KGgo="\)/); assert.match(withImg, /content:""/)
})

test('avatars: hostile emoji and image values are rejected, never put into css', () => {
  for (const bad of ['"; } body{display:none} .x{', '\\', '<script>', 'a'.repeat(20), '', '   ', 5, null, 'x\ny', "it's"]) assert.equal(k.avatarEmoji(bad), k.AVATAR_EMOJI[0], JSON.stringify(bad))
  assert.equal(k.avatarEmoji('\u{1F431}'), '\u{1F431}'); assert.equal(k.avatarEmoji(' \u{1F431} '), '\u{1F431}'); assert.equal(k.avatarEmoji('\u{1F468}\u200D\u{1F4BB}'), '\u{1F468}\u200D\u{1F4BB}', 'a joined emoji is allowed')
  for (const bad of ['javascript:alert(1)', 'data:image/svg+xml;base64,PHN2Zz4=', 'data:text/html;base64,AAAA', 'data:image/png;base64,AA"); body{display:none}', 'data:image/png;base64,' + 'A'.repeat(130000), 5, null, 'https://evil.example/x.png']) assert.equal(k.avatarImage(bad), '', String(bad).slice(0, 50))
  assert.doesNotMatch(k.avatarCss({ avatarAssistantKind: 'emoji', avatarAssistantEmoji: '"; } body{display:none} .x{' }), /display:none/)
  assert.doesNotMatch(k.avatarCss({ avatarAssistantKind: 'image' }, { assistant: 'data:image/png;base64,AA"); body{display:none}' }), /display:none/)
})

test('avatars: size is clamped 20-44 and css is always balanced', () => {
  assert.match(k.avatarCss({ avatarAssistantKind: 'emoji', avatarSize: 5 }), /width:20px/); assert.match(k.avatarCss({ avatarAssistantKind: 'emoji', avatarSize: 999 }), /width:44px/); assert.match(k.avatarCss({ avatarAssistantKind: 'emoji', avatarSize: 'x' }), /width:26px/)
  const css = k.avatarCss({ avatarAssistantKind: 'emoji', avatarUserKind: 'emoji' }); assert.equal((css.match(/{/g) || []).length, (css.match(/}/g) || []).length)
  assert.equal(k.avatarFace('pet', '', '', '').text, k.AVATAR_EMOJI[0], 'a missing pet emoji falls back to the robot')
  for (const e of k.AVATAR_EMOJI) assert.equal(k.avatarEmoji(e), e)
})

test('look: lookCss output and avatar output can be joined without breaking either', () => {
  const css = [k.lookCss({ userBubble: 'soft' }), k.avatarCss({ avatarAssistantKind: 'emoji' })].filter(Boolean).join('\n'); assert.equal((css.match(/{/g) || []).length, (css.match(/}/g) || []).length)
})
