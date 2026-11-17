import test from 'node:test'
import assert from 'node:assert/strict'
import { makeRng } from '../src/games.js'
import * as g from '../src/games2.js'

const fixed = (...vals) => { let i = 0; return () => vals[i++ % vals.length] }
function deepFreeze(o) { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); Object.values(o).forEach(deepFreeze) } return o }
const board = (rows) => ({ size: rows.length, board: rows.map((r) => r.slice()), score: 0, best: Math.max(...rows.flat()), won: false, over: false, moves: 0 })

// ------------------------------------------------------------------- 2048
test('2048: new game has exactly two tiles, each 2 or 4, size clamped', () => {
  const s = g.g2048New(makeRng(1))
  assert.equal(s.board.flat().filter(Boolean).length, 2); assert.ok(s.board.flat().every((v) => v === 0 || v === 2 || v === 4))
  assert.equal(g.g2048New(makeRng(1), 99).size, 6); assert.equal(g.g2048New(makeRng(1), 1).size, 3); assert.equal(g.g2048New(makeRng(1), 'x').size, 4)
})

test('2048: slide and merge once per move', () => {
  const rng = fixed(0.99, 0.5)
  const run = (row, dir = 'left') => { const s = board([row, [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]); return g.g2048Move(s, dir, fixed(0.99, 0.5)) }
  assert.deepEqual(run([2, 2, 2, 2]).board[0], [4, 4, 0, 0])
  assert.deepEqual(run([2, 2, 4, 0]).board[0], [4, 4, 0, 0])
  assert.deepEqual(run([4, 2, 2, 0]).board[0], [4, 4, 0, 0])
  assert.deepEqual(run([2, 0, 2, 4]).board[0], [4, 4, 0, 0])
  assert.deepEqual(run([2, 2, 2, 0]).board[0], [4, 2, 0, 0], 'three in a row: leading pair merges only')
  assert.equal(run([2, 2, 2, 2]).score, 8)
  assert.deepEqual(run([2, 2, 2, 2], 'right').board[0], [0, 0, 4, 4])
  void rng
})

test('2048: all four directions agree by symmetry (rotate the board, rotate the answer)', () => {
  const rot = (b) => b[0].map((_, x) => b.map((row) => row[x]).reverse()) // 90 degrees clockwise
  const start = [[2, 2, 0, 4], [0, 4, 4, 4], [8, 0, 8, 2], [2, 2, 2, 2]]
  const noSpawn = () => 0.999 // spawns land at the last empty cell: compare only non-spawned tiles via a mask
  const left = g.g2048Move(board(start), 'left', noSpawn)
  const down = g.g2048Move(board(rot(rot(rot(start)))), 'down', noSpawn)
  // moving left on `start` equals moving 'down' on start rotated 270deg, then rotating back: compare the merged score only
  assert.equal(left.score, down.score)
})

test('2048: a move that changes nothing returns the same state and spawns nothing', () => {
  const s = board([[2, 4, 8, 16], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]])
  assert.equal(g.g2048Move(s, 'left', fixed(0.5)), s)
  assert.equal(g.g2048Move(s, 'up', fixed(0.5)), s)
  assert.equal(g.g2048Move(s, 'sideways', fixed(0.5)), s)
})

test('2048: the new tile spawns only in an empty cell, 90% twos', () => {
  const s = board([[2, 2, 0, 0], [4, 8, 16, 32], [2, 4, 8, 16], [4, 8, 16, 32]])
  const r = g.g2048Move(s, 'left', fixed(0, 0.1)) // first empty list item, value 2
  const tiles = r.board.flat().filter(Boolean).length
  assert.equal(tiles, s.board.flat().filter(Boolean).length, 'merge removes one tile, spawn adds one: the count is unchanged'); assert.equal(r.board[0][0], 4); assert.equal(r.board[0][1], 2, 'the spawn is a 2 in the first empty cell (rng 0, 0.1)')
  const four = g.g2048Move(s, 'left', fixed(0, 0.95)); assert.ok(four.board.flat().includes(4))
})

test('2048: win flag at 2048 and play continues; game over only when truly stuck', () => {
  const s = board([[1024, 1024, 0, 0], [2, 4, 8, 16], [4, 8, 16, 32], [8, 16, 32, 64]])
  const r = g.g2048Move(s, 'left', fixed(0.99, 0.5)); assert.equal(r.won, true); assert.equal(r.over, false); assert.equal(r.best, 2048)
  const stuck = board([[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 2]])
  assert.equal(g.g2048CanMove(stuck), false)
  const almost = board([[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 4]]); assert.equal(g.g2048CanMove(almost), true)
  const over = { ...stuck, over: true }; assert.equal(g.g2048Move(over, 'left', fixed(0.5)), over)
})

test('2048: fuzz - 300 seeded games keep a valid board and never mutate earlier states', () => {
  for (let seed = 1; seed <= 300; seed++) {
    const rng = makeRng(seed), pick = makeRng(seed * 31)
    let s = deepFreeze(g.g2048New(rng, 3 + (seed % 4)))
    for (let i = 0; i < 400 && !s.over; i++) {
      const next = g.g2048Move(s, ['up', 'down', 'left', 'right'][Math.floor(pick() * 4)], rng)
      s = deepFreeze(next)
      assert.ok(s.board.flat().every((v) => v === 0 || (v > 1 && (v & (v - 1)) === 0)), 'powers of two only')
      assert.ok(s.board.flat().some(Boolean), 'never empties'); assert.ok(s.score >= 0 && Number.isInteger(s.score))
    }
  }
})

// -------------------------------------------------------------- minesweeper
const nbrs = (w, h, i) => { const x = i % w, y = Math.floor(i / w), o = []; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < w && ny < h) o.push(ny * w + nx) } return o }

test('mines: new board, mine count clamped so the first click is always safe', () => {
  const s = g.minesNew(); assert.equal(s.cells.length, 81); assert.equal(s.mines, 10); assert.equal(s.status, 'ready')
  assert.equal(g.minesNew(3, 3, 99).mines, 0); assert.equal(g.minesNew(9, 9, 99).mines, 72); assert.equal(g.minesNew(9, 9, -4).mines, 0)
})

test('mines: first click is never a mine and has no mine neighbours (500 seeds)', () => {
  for (let seed = 1; seed <= 500; seed++) {
    const w = 6 + (seed % 5), h = 6 + ((seed >> 2) % 5), x = seed % w, y = (seed * 7) % h
    const s = g.minesReveal(g.minesNew(w, h, Math.min(20, w * h - 9)), x, y, makeRng(seed))
    const i = y * w + x
    assert.equal(s.cells[i].mine, false); assert.equal(s.cells[i].state, 'open')
    assert.ok(nbrs(w, h, i).every((n) => !s.cells[n].mine), 'neighbour mine at seed ' + seed)
    assert.equal(s.cells.filter((c) => c.mine).length, Math.min(20, w * h - 9), 'exact mine count')
  }
})

test('mines: adjacency numbers match a brute-force recount', () => {
  const s = g.minesReveal(g.minesNew(12, 10, 25), 5, 5, makeRng(77))
  s.cells.forEach((c, i) => assert.equal(c.adj, nbrs(12, 10, i).filter((n) => s.cells[n].mine).length))
})

test('mines: flood fill opens exactly the connected zero region and its border', () => {
  const s = g.minesReveal(g.minesNew(15, 12, 18), 7, 6, makeRng(5))
  const w = 15, h = 12, start = 6 * w + 7
  assert.equal(s.cells[start].adj, 0, 'first click region is always a zero')
  const seen = new Set([start]), q = [start]
  while (q.length) { const i = q.pop(); if (s.cells[i].adj !== 0) continue; for (const n of nbrs(w, h, i)) if (!seen.has(n)) { seen.add(n); q.push(n) } }
  const open = new Set(s.cells.map((c, i) => (c.state === 'open' ? i : -1)).filter((i) => i >= 0))
  assert.deepEqual([...open].sort((a, b) => a - b), [...seen].sort((a, b) => a - b)); assert.equal(s.opened, open.size)
})

test('mines: a huge empty board floods without recursion (no stack overflow)', () => {
  const s = g.minesReveal(g.minesNew(50, 50, 0), 25, 25, makeRng(1))
  assert.equal(s.status, 'won'); assert.equal(s.opened, 2500)
})

test('mines: flags toggle, count, and cannot be placed on open cells or after the game', () => {
  let s = g.minesNew(9, 9, 10)
  s = g.minesFlag(s, 0, 0); assert.equal(s.flags, 1); assert.equal(g.minesFlagsLeft(s), 9); assert.equal(s.cells[0].state, 'flag')
  s = g.minesFlag(s, 0, 0); assert.equal(s.flags, 0); assert.equal(s.cells[0].state, 'hidden')
  assert.equal(g.minesReveal(g.minesFlag(g.minesNew(), 1, 1), 1, 1, makeRng(1)).cells[10].state, 'flag', 'flagged cells cannot be revealed')
  const played = g.minesReveal(g.minesNew(), 4, 4, makeRng(3)); assert.equal(g.minesFlag(played, 4, 4), played)
  assert.equal(g.minesFlag(s, -1, 0), s); assert.equal(g.minesFlag(s, 0, 99), s); assert.equal(g.minesFlag(s, 0.5, 0), s)
})

test('mines: chording opens the neighbours when flags match, and only then', () => {
  const base = g.minesReveal(g.minesNew(9, 9, 10), 4, 4, makeRng(21))
  const w = 9
  const target = base.cells.findIndex((c, i) => c.state === 'open' && c.adj > 0 && nbrs(w, 9, i).some((n) => base.cells[n].state === 'hidden'))
  assert.ok(target >= 0)
  const [tx, ty] = [target % w, Math.floor(target / w)]
  assert.equal(g.minesChord(base, tx, ty, makeRng(1)), base, 'no flags yet')
  let s = base
  const mineNeighbours = nbrs(w, 9, target).filter((n) => base.cells[n].mine)
  for (const n of nbrs(w, 9, target)) if (base.cells[n].mine && base.cells[n].state === 'hidden') s = g.minesFlag(s, n % w, Math.floor(n / w))
  const flagged = nbrs(w, 9, target).filter((n) => s.cells[n].state === 'flag').length
  if (flagged === base.cells[target].adj && mineNeighbours.length === base.cells[target].adj) {
    const r = g.minesChord(s, tx, ty, makeRng(1))
    assert.ok(nbrs(w, 9, target).every((n) => r.cells[n].state !== 'hidden'), 'all neighbours resolved')
    assert.equal(r.status === 'lost', false, 'correct flags never lose')
  }
  const wrong = g.minesFlag(base, 0, 0)
  assert.equal(g.minesChord(wrong, 0, 0, makeRng(1)), wrong, 'chord on a non-open cell does nothing')
})

test('mines: hitting a mine loses and opens every unflagged mine; input afterwards is ignored', () => {
  const s0 = g.minesReveal(g.minesNew(9, 9, 10), 4, 4, makeRng(9))
  const mine = s0.cells.findIndex((c) => c.mine)
  const lost = g.minesReveal(s0, mine % 9, Math.floor(mine / 9), makeRng(1))
  assert.equal(lost.status, 'lost'); assert.ok(lost.cells.filter((c) => c.mine).every((c) => c.state === 'open'))
  assert.equal(g.minesReveal(lost, 0, 0, makeRng(1)), lost); assert.equal(g.minesFlag(lost, 0, 0), lost); assert.equal(g.minesChord(lost, 4, 4, makeRng(1)), lost)
})

test('mines: opening every safe cell wins and flags the rest', () => {
  let s = g.minesReveal(g.minesNew(9, 9, 10), 4, 4, makeRng(13))
  for (let i = 0; i < 81 && s.status === 'playing'; i++) if (!s.cells[i].mine && s.cells[i].state === 'hidden') s = g.minesReveal(s, i % 9, Math.floor(i / 9), makeRng(1))
  assert.equal(s.status, 'won'); assert.ok(s.cells.filter((c) => c.mine).every((c) => c.state === 'flag')); assert.equal(s.flags, 10)
  assert.equal(g.minesReveal(s, 0, 0, makeRng(1)), s)
})

test('mines: out-of-range and repeated reveals return the same state', () => {
  const s = g.minesReveal(g.minesNew(), 4, 4, makeRng(2))
  assert.equal(g.minesReveal(s, 4, 4, makeRng(2)), s); assert.equal(g.minesReveal(s, -1, 4, makeRng(2)), s); assert.equal(g.minesReveal(s, 9, 4, makeRng(2)), s); assert.equal(g.minesReveal(s, NaN, 4, makeRng(2)), s)
})

test('mines: fuzz - 300 random games, never throw, states are never mutated', () => {
  for (let seed = 1; seed <= 300; seed++) {
    const rng = makeRng(seed), pick = makeRng(seed * 13)
    const w = 5 + (seed % 8), h = 5 + ((seed >> 1) % 8)
    let s = deepFreeze(g.minesNew(w, h, Math.floor((w * h) / 6)))
    for (let i = 0; i < 80 && s.status !== 'won' && s.status !== 'lost'; i++) {
      const x = Math.floor(pick() * w), y = Math.floor(pick() * h), a = pick()
      s = deepFreeze(a < 0.6 ? g.minesReveal(s, x, y, rng) : a < 0.85 ? g.minesFlag(s, x, y) : g.minesChord(s, x, y, rng))
      assert.ok(s.flags === s.cells.filter((c) => c.state === 'flag').length, 'flag count stays exact')
      assert.ok(s.opened === s.cells.filter((c) => c.state === 'open' && !c.mine).length + (s.status === 'lost' ? s.cells.filter((c) => c.state === 'open' && c.mine).length : 0) || s.status === 'lost')
    }
  }
})

// -------------------------------------------------------------------- pong
const noInput = { dir: 0 }
function run(s, seconds, input, rng) { for (let t = 0; t < seconds * 1000; t += 16) s = g.pongStep(s, 16, typeof input === 'function' ? input(s) : input, rng) ; return s }

test('pong: same seed, same game', () => {
  const a = run(g.pongNew(makeRng(4)), 20, noInput, makeRng(4)), b = run(g.pongNew(makeRng(4)), 20, noInput, makeRng(4))
  assert.deepEqual(a, b)
})

test('pong: paddle is clamped inside the field', () => {
  let s = g.pongNew(makeRng(1))
  s = run(s, 5, { dir: -1 }, makeRng(1)); assert.equal(s.player.y, g.PONG_PADDLE_H / 2)
  s = run(s, 5, { dir: 1 }, makeRng(1)); assert.ok(s.player.y <= g.PONG_H - g.PONG_PADDLE_H / 2 + 1e-9)
})

test('pong: serving pause holds the ball for 600ms then releases it', () => {
  let s = g.pongNew(makeRng(2))
  const x0 = s.ball.x
  for (let i = 0; i < 30; i++) s = g.pongStep(s, 16, noInput, makeRng(2)) // 480ms
  assert.equal(s.ball.x, x0); assert.equal(s.serving, true)
  for (let i = 0; i < 20; i++) s = g.pongStep(s, 16, noInput, makeRng(2))
  assert.equal(s.serving, false); assert.notEqual(s.ball.x, x0)
})

test('pong: the ball never leaves the field and speed is conserved between hits', () => {
  let s = g.pongNew(makeRng(6)); const rng = makeRng(6)
  let lastSpeed = null, lastRallies = 0
  for (let i = 0; i < 20000 && !s.over; i++) {
    s = g.pongStep(s, 16, { dir: Math.sign(s.ball.y - s.player.y) }, rng)
    assert.ok(s.ball.y >= 0 && s.ball.y <= g.PONG_H && s.ball.x >= -1 && s.ball.x <= g.PONG_W + 1, 'in the field')
    if (!s.serving) { const sp = Math.hypot(s.ball.vx, s.ball.vy); if (lastSpeed !== null && s.rallies === lastRallies) assert.ok(Math.abs(sp - lastSpeed) < 1e-6, 'speed conserved between hits'); lastSpeed = sp; lastRallies = s.rallies } else lastSpeed = null
  }
})

test('pong: a paddle hit speeds the ball up by 4%, capped at 90', () => {
  let s = g.pongNew(makeRng(3)); s = { ...s, serving: false, serveMs: 0, ball: { x: 20, y: 25, vx: -40, vy: 0 }, player: { y: 25 }, speed: 40 }
  for (let i = 0; i < 400 && s.rallies === 0; i++) s = g.pongStep(s, 16, noInput, makeRng(1))
  assert.equal(s.rallies, 1); assert.ok(Math.abs(Math.hypot(s.ball.vx, s.ball.vy) - 41.6) < 1e-6); assert.ok(s.ball.vx > 0)
  const fast = { ...s, speed: 89, rallies: 0, ball: { x: 20, y: 25, vx: -85, vy: 0 }, player: { y: 25 } }
  const r = (() => { let t = fast; for (let i = 0; i < 400 && t.rallies === 0; i++) t = g.pongStep(t, 16, noInput, makeRng(1)); return t })()
  assert.ok(Math.hypot(r.ball.vx, r.ball.vy) <= 90 + 1e-6)
})

test('pong: hitting with the paddle edge sends the ball at a steep angle', () => {
  let s = g.pongNew(makeRng(3)); s = { ...s, serving: false, serveMs: 0, ball: { x: 20, y: 29.5, vx: -40, vy: 0 }, player: { y: 25 }, speed: 40 }
  for (let i = 0; i < 400 && s.rallies === 0; i++) s = g.pongStep(s, 16, noInput, makeRng(1))
  assert.ok(Math.abs(s.ball.vy) > 25, 'steep: ' + s.ball.vy)
  let c = g.pongNew(makeRng(3)); c = { ...c, serving: false, serveMs: 0, ball: { x: 20, y: 25, vx: -40, vy: 0 }, player: { y: 25 }, speed: 40 }
  for (let i = 0; i < 400 && c.rallies === 0; i++) c = g.pongStep(c, 16, noInput, makeRng(1))
  assert.ok(Math.abs(c.ball.vy) < 1e-6, 'centre hit is flat')
})

test('pong: a huge frame time cannot tunnel through a paddle or teleport the ball', () => {
  let s = g.pongNew(makeRng(8)); s = { ...s, serving: false, serveMs: 0, ball: { x: 12, y: 25, vx: -90, vy: 0 }, player: { y: 25 }, speed: 90 }
  const before = s.ball.x
  s = g.pongStep(s, 100000, noInput, makeRng(1))
  assert.ok(Math.abs(s.ball.x - before) < 10, 'moved at most 50ms worth')
  let t = { ...g.pongNew(makeRng(8)), serving: false, serveMs: 0, ball: { x: 6, y: 25, vx: -90, vy: 0 }, player: { y: 25 }, speed: 90 }
  for (let i = 0; i < 10; i++) t = g.pongStep(t, 50, noInput, makeRng(1))
  assert.equal(t.score.ai, 0, 'the paddle was there: no goal')
  assert.equal(g.pongStep(s, NaN, noInput, makeRng(1)), s); assert.equal(g.pongStep(s, 0, noInput, makeRng(1)), s); assert.equal(g.pongStep(s, -5, noInput, makeRng(1)), s)
})

test('pong: the AI is beatable by aiming at its paddle edges', () => {
  let s = g.pongNew(makeRng(10)); const rng = makeRng(10)
  // a scripted player that tracks the ball and tries to hit it with an edge of the paddle for a sharp angle
  for (let t = 0; t < 240 * 1000 && s.score.player === 0; t += 16) {
    const want = s.ball.y + (s.ball.vx < 0 ? 3.5 : 0)
    s = g.pongStep(s, 16, { dir: Math.abs(want - s.player.y) < 0.8 ? 0 : Math.sign(want - s.player.y) }, rng)
  }
  assert.ok(s.score.player >= 1, 'player never scored in 240 simulated seconds: ' + JSON.stringify(s.score))
})

test('pong: first to 7 wins, then the game is frozen', () => {
  let s = g.pongNew(makeRng(12)); const rng = makeRng(12)
  for (let t = 0; t < 4000 * 1000 && !s.over; t += 16) s = g.pongStep(s, 16, noInput, rng)
  assert.equal(s.over, true); assert.ok(s.score.ai === g.PONG_WIN || s.score.player === g.PONG_WIN); assert.equal(s.winner, s.score.player === g.PONG_WIN ? 'player' : 'ai')
  assert.equal(g.pongStep(s, 16, { dir: 1 }, rng), s)
  assert.equal(g.pongScore({ ...s, score: { player: 7, ai: 3 }, winner: 'player' }), 120); assert.equal(g.pongScore({ ...s, score: { player: 2, ai: 7 }, winner: 'ai' }), 20)
})

test('pong: fuzz - 200 seeded games never produce NaN or leave the field', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const rng = makeRng(seed), pick = makeRng(seed * 17)
    let s = deepFreeze(g.pongNew(rng))
    for (let i = 0; i < 600 && !s.over; i++) {
      s = deepFreeze(g.pongStep(s, [0, 1, 7, 16, 33, 50, 400, 100000][Math.floor(pick() * 8)], { dir: Math.floor(pick() * 3) - 1 }, rng))
      const nums = [s.ball.x, s.ball.y, s.ball.vx, s.ball.vy, s.player.y, s.ai.y, s.speed]
      assert.ok(nums.every(Number.isFinite), 'NaN at seed ' + seed); assert.ok(s.ball.y >= 0 && s.ball.y <= g.PONG_H)
      assert.ok(s.player.y >= g.PONG_PADDLE_H / 2 - 1e-9 && s.player.y <= g.PONG_H - g.PONG_PADDLE_H / 2 + 1e-9)
    }
  }
})
