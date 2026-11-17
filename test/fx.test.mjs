import test from 'node:test'
import assert from 'node:assert/strict'
import * as fx from '../src/fx.js'
import { makeRng } from '../src/games.js'

test('fx: every kind makes a burst, unknown makes none, reduced motion makes none', () => {
  for (const k of fx.FX_KINDS) { const b = fx.fxBurst(k, makeRng(3), 500, 600); assert.ok(b.length > 10, k); assert.ok(b.every((p) => p.life > 0 && p.size > 0 && Number.isFinite(p.vx))) }
  assert.deepEqual(fx.fxBurst('nope', makeRng(1), 1, 1), [])
  assert.equal(fx.fxCount('confetti', true), 0); assert.equal(fx.fxCount('nope'), 0)
})

test('fx: burst is seeded and starts at the origin, clamped to the viewport', () => {
  const a = fx.fxBurst('confetti', makeRng(9), 300, 400), b = fx.fxBurst('confetti', makeRng(9), 300, 400)
  assert.deepEqual(a, b); assert.ok(a.every((p) => p.x === 300 && p.y === 400))
  const c = fx.fxBurst('sparkles', makeRng(1), -50, 99999, 800, 600); assert.ok(c.every((p) => p.x === 0 && p.y === 600))
  const d = fx.fxBurst('sparkles', makeRng(1), NaN, NaN, 800, 600); assert.ok(d.every((p) => p.x === 400 && p.y === 600))
})

test('fx: confetti falls (gravity), hearts rise, a stalled frame cannot fling a particle', () => {
  let p = { shape: 'rect', x: 0, y: 0, vx: 0, vy: 0, rot: 0, vr: 0, size: 5, life: 3, max: 3, color: '#fff' }
  for (let i = 0; i < 30; i++) p = fx.fxStep(p, 1 / 60, 'confetti'); assert.ok(p.y > 0)
  let q = { ...p, x: 0, y: 0, vx: 0, vy: -100 }
  for (let i = 0; i < 30; i++) q = fx.fxStep(q, 1 / 60, 'hearts'); assert.ok(q.y < 0)
  const r = fx.fxStep({ ...p, x: 0, y: 0, vx: 100, vy: 0 }, 60, 'confetti'); assert.ok(Math.abs(r.x) < 10, 'dt clamped to 50ms')
  assert.equal(fx.fxStep(p, -5).y, p.y, 'negative dt does nothing')
})

test('fx: particles die, alpha is 0..1 and fades out', () => {
  let p = fx.fxBurst('sparkles', makeRng(2), 100, 100)[0]
  const a0 = fx.fxAlpha(p); assert.ok(a0 > 0 && a0 <= 1)
  let steps = 0; while (fx.fxAlive(p) && steps < 1000) { p = fx.fxStep(p, 0.05, 'sparkles'); steps++ }
  assert.ok(steps < 100 && !fx.fxAlive(p)); assert.equal(fx.fxAlpha(p), 0)
  for (const q of fx.fxBurst('confetti', makeRng(5), 1, 1)) { const a = fx.fxAlpha(q); assert.ok(a >= 0 && a <= 1) }
})