import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rzd-av-'))
process.env.RAYSKINZ_DESIGN_DIR = dir
const host = await import(pathToFileURL(path.resolve('lib/index.js')).href + '?av=' + Date.now())
async function call(ep, payload) {
  const r = host.rpcRoute(ep)
  const res = await r.fetch(new Request('http://x' + r.path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'client-request', rpcId: '1', method: 'rayskinz-design.' + ep, payload }) }))
  return (await res.json()).result
}

test('avatars: settings are validated and a hostile emoji is rejected', () => {
  const s = host.sanitizeSettings({ avatarAssistantKind: 'emoji', avatarUserKind: 'hacker', avatarAssistantEmoji: '\u{1F989}', avatarUserEmoji: '"; } body{display:none} .x{', avatarSize: 999 })
  assert.equal(s.avatarAssistantKind, 'emoji'); assert.equal(s.avatarUserKind, 'none'); assert.equal(s.avatarAssistantEmoji, '\u{1F989}')
  assert.equal(s.avatarUserEmoji, '\u{1F9D1}', 'a hostile emoji keeps the safe default'); assert.equal(s.avatarSize, 44)
  assert.equal(host.sanitizeSettings({ avatarAssistantEmoji: 'a'.repeat(30) }).avatarAssistantEmoji, '\u{1F916}'); assert.equal(host.sanitizeSettings({ avatarSize: 2 }).avatarSize, 20)
  for (const bad of ['\\', '<b>', "it's", 'x\ny', '`', '()']) assert.equal(host.sanitizeSettings({ avatarUserEmoji: bad }).avatarUserEmoji, '\u{1F9D1}', JSON.stringify(bad))
  assert.equal(host.sanitizeSettings({ avatarUserEmoji: '\u{1F431}' }).avatarUserEmoji, '\u{1F431}')
})

test('avatars: pictures are stored per side, validated, size-capped and removable', async () => {
  const png = 'data:image/png;base64,iVBORw0KGgo='
  assert.equal((await call('avatarGet', {})).value.assistant, '')
  assert.equal((await call('avatarSet', { side: 'assistant', image: png })).ok, true)
  assert.equal((await call('avatarGet', {})).value.assistant, png); assert.equal((await call('avatarGet', {})).value.user, '')
  for (const bad of ['javascript:alert(1)', 'data:image/svg+xml;base64,PHN2Zz4=', 'data:image/png;base64,AA"); body{x', 'data:image/png;base64,' + 'A'.repeat(130000), 'https://evil.example/a.png', 'data:image/gif;base64,AAAA']) {
    assert.equal((await call('avatarSet', { side: 'user', image: bad })).ok, false, bad.slice(0, 40))
  }
  assert.equal((await call('avatarSet', { side: 'galaxy', image: png })).ok, false); assert.equal((await call('avatarSet', { image: png })).ok, false)
  assert.equal((await call('avatarGet', {})).value.user, '', 'rejected pictures write nothing')
  assert.deepEqual(fs.readdirSync(dir).filter((f) => f.endsWith('.tmp')), [], 'no temp files left behind')
  assert.equal((await call('avatarSet', { side: 'assistant', image: '' })).ok, true); assert.equal((await call('avatarGet', {})).value.assistant, '')
  assert.equal((await call('avatarSet', { side: 'user', image: '' })).ok, true, 'removing a picture that does not exist is harmless')
})

test('avatars: both sides are independent', async () => {
  const a = 'data:image/png;base64,AAAA', b = 'data:image/jpeg;base64,BBBB'
  await call('avatarSet', { side: 'assistant', image: a }); await call('avatarSet', { side: 'user', image: b })
  assert.deepEqual((await call('avatarGet', {})).value, { assistant: a, user: b })
  await call('avatarSet', { side: 'assistant', image: '' }); assert.deepEqual((await call('avatarGet', {})).value, { assistant: '', user: b })
})
