import test from 'node:test'
import assert from 'node:assert/strict'
import * as g from '../src/games.js'

const fixed = (...vals) => { let i = 0; return () => vals[i++ % vals.length] }

test('rng: seeded, repeatable, in range', () => {
  const a = g.makeRng(42), b = g.makeRng(42), c = g.makeRng(43)
  const A = Array.from({ length: 50 }, a), B = Array.from({ length: 50 }, b), C = Array.from({ length: 50 }, c)
  assert.deepEqual(A, B); assert.notDeepEqual(A, C)
  assert.ok(A.every((v) => v >= 0 && v < 1))
})

test('snake: moves, eats, grows, scores', () => {
  let s = g.snakeNew(fixed(0.5))
  s = { ...s, food: [s.snake[0][0] + 1, s.snake[0][1]] }
  const len = s.snake.length
  s = g.snakeStep(s, fixed(0.1))
  assert.equal(s.score, 10); assert.equal(s.snake.length, len + 1); assert.equal(s.over, false)
  const before = s.snake[0]
  s = g.snakeStep(s, fixed(0.1))
  assert.deepEqual(s.snake[0], [before[0] + 1, before[1]]); assert.equal(s.snake.length, len + 1, 'no growth without food')
})

test('snake: food never spawns on the snake', () => {
  const s = g.snakeNew(g.makeRng(1))
  for (let i = 0; i < 200; i++) {
    const rng = g.makeRng(i)
    const food = g.snakeStep({ ...s, food: [s.snake[0][0] + 1, s.snake[0][1]] }, rng).food
    const after = g.snakeStep({ ...s, food: [s.snake[0][0] + 1, s.snake[0][1]] }, rng)
    assert.ok(!after.snake.some(([x, y]) => x === food[0] && y === food[1]))
  }
})

test('snake: walls kill, reversing is ignored, turns are buffered (max 2)', () => {
  let s = g.snakeNew(fixed(0.5))
  assert.equal(g.snakeTurn(s, 'left'), s, 'cannot reverse')
  assert.equal(g.snakeTurn(s, 'right'), s, 'same direction ignored')
  assert.equal(g.snakeTurn(s, 'sideways'), s)
  s = g.snakeTurn(g.snakeTurn(g.snakeTurn(s, 'up'), 'left'), 'down')
  assert.deepEqual(s.queue, ['up', 'left'], 'third turn dropped')
  s = g.snakeStep(s, fixed(0.5)); assert.equal(s.dir, 'up')
  s = g.snakeStep(s, fixed(0.5)); assert.equal(s.dir, 'left')
  let w = g.snakeNew(fixed(0.5)); w = { ...w, food: null }
  for (let i = 0; i < 40 && !w.over; i++) w = g.snakeStep(w, fixed(0.5))
  assert.equal(w.over, true)
  assert.equal(g.snakeStep(w, fixed(0.5)), w, 'no moves after game over')
  assert.equal(g.snakeTurn(w, 'up'), w)
})

test('snake: running into your own body ends it, but your tail square is free', () => {
  const coil = { w: 8, h: 8, snake: [[3, 3], [3, 4], [4, 4], [4, 3]], dir: 'right', queue: [], food: [0, 0], score: 0, over: false, won: false, ticks: 0 }
  assert.equal(g.snakeStep(coil, fixed(0.5)).over, false, 'moving into the square the tail just left is legal')
  const bite = { ...coil, snake: [[3, 3], [3, 4], [4, 4], [4, 3], [5, 3]], dir: 'right' }
  assert.equal(g.snakeStep(bite, fixed(0.5)).over, true)
})

test('snake: filling the board wins', () => {
  const s = { w: 2, h: 1, snake: [[0, 0]], dir: 'right', queue: [], food: [1, 0], score: 0, over: false, won: false, ticks: 0 }
  const r = g.snakeStep(s, fixed(0.5))
  assert.equal(r.won, true); assert.equal(r.over, true); assert.equal(r.food, null)
})

test('snake: speed ramps and floors', () => {
  assert.equal(g.snakeDelay({ score: 0 }), 190); assert.ok(g.snakeDelay({ score: 500 }) < 190); assert.equal(g.snakeDelay({ score: 1e9 }), 70)
})

test('tetris: every piece/rotation has 4 cells inside its 4x4 box', () => {
  for (const [name, rots] of Object.entries(g.PIECES)) {
    assert.equal(rots.length, 4, name)
    for (const rot of rots) {
      assert.equal(rot.length, 4, name); assert.equal(new Set(rot.map((c) => c.join())).size, 4, name + ' distinct')
      for (const [x, y] of rot) assert.ok(x >= 0 && x < 4 && y >= 0 && y < 4, name)
    }
  }
})

test('tetris: seven-bag gives each piece once per seven', () => {
  const rng = g.makeRng(7)
  let s = g.tetrisNew(rng)
  const seen = [s.piece.type]
  for (let i = 0; i < 20; i++) { s = g.tetrisHardDrop(s, rng); if (s.over) break; seen.push(s.piece.type) }
  const first = seen.slice(0, 7)
  assert.equal(new Set(first).size, 7, first.join(''))
})

test('tetris: movement is bounded by walls and blocks', () => {
  let s = g.tetrisNew(g.makeRng(3))
  for (let i = 0; i < 20; i++) s = g.tetrisMove(s, -1)
  assert.ok(g.cells(s.piece).every(([x]) => x >= 0))
  for (let i = 0; i < 20; i++) s = g.tetrisMove(s, 1)
  assert.ok(g.cells(s.piece).every(([x]) => x < s.w))
})

test('tetris: rotation uses wall kicks and never overlaps', () => {
  let s = g.tetrisNew(g.makeRng(5))
  s = { ...s, piece: { type: 'I', rot: 1, x: -2, y: 5 } }
  const r = g.tetrisRotate(s)
  assert.ok(!g.collides(r.board, r.piece))
  const boxed = { ...s, board: s.board.map((row, y) => (y >= 4 && y <= 9 ? row.map(() => 'X') : row)), piece: { type: 'T', rot: 0, x: 3, y: 0 } }
  assert.equal(g.tetrisRotate({ ...boxed, board: g.emptyBoard().map((row) => row.map(() => 'X')) }).piece.rot, 0, 'no room to rotate: unchanged')
})

test('tetris: clearing lines scores by count and level, drops rows down', () => {
  const rng = g.makeRng(11)
  const base = g.tetrisNew(rng)
  const board = g.emptyBoard()
  for (const y of [16, 17, 18, 19]) board[y] = board[y].map((_, x) => (x === 9 ? '' : 'X'))
  const s = { ...base, board, piece: { type: 'I', rot: 1, x: 7, y: 0 } } // vertical I: column x=9
  assert.equal(s.piece.type, 'I')
  const dropped = g.tetrisHardDrop(s, rng)
  assert.equal(dropped.lines, 4); assert.ok(dropped.score >= 800, String(dropped.score))
  assert.ok(dropped.board.slice(16).every((row) => row.every((c) => c === '')), 'cleared rows replaced by empty rows')
  assert.equal(dropped.board.length, 20); assert.ok(dropped.board.every((r) => r.length === 10))
  const lvl = g.tetrisHardDrop({ ...s, level: 3 }, g.makeRng(11)); assert.ok(lvl.score >= 2400, 'level multiplies')
})

test('tetris: level rises every 10 lines and speed follows, with a floor', () => {
  assert.equal(g.tetrisDelay({ level: 1 }), 800); assert.ok(g.tetrisDelay({ level: 5 }) < 800); assert.equal(g.tetrisDelay({ level: 99 }), 60)
})

test('tetris: hold swaps once per piece, ghost lands on the stack', () => {
  const rng = g.makeRng(9)
  let s = g.tetrisNew(rng)
  const first = s.piece.type, next = s.next
  s = g.tetrisHold(s, rng)
  assert.equal(s.hold, first); assert.equal(s.piece.type, next); assert.equal(s.canHold, false)
  assert.equal(g.tetrisHold(s, rng), s, 'second hold in a row ignored')
  s = g.tetrisHardDrop(s, rng); assert.equal(s.canHold, true)
  const gy = g.ghostY(s); assert.ok(!g.collides(s.board, { ...s.piece, y: gy })); assert.ok(g.collides(s.board, { ...s.piece, y: gy + 1 }))
})

test('tetris: stacking to the top ends the game and then nothing moves', () => {
  const rng = g.makeRng(2)
  let s = g.tetrisNew(rng)
  for (let i = 0; i < 100 && !s.over; i++) s = g.tetrisHardDrop(s, rng)
  assert.equal(s.over, true)
  assert.equal(g.tetrisMove(s, 1), s); assert.equal(g.tetrisRotate(s), s); assert.equal(g.tetrisTick(s, rng), s); assert.equal(g.tetrisHardDrop(s, rng), s); assert.equal(g.tetrisHold(s, rng), s)
})

test('fuzz: random play never throws or corrupts the board (200 seeded games each)', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const rng = g.makeRng(seed), pick = g.makeRng(seed * 7919)
    let t = g.tetrisNew(rng)
    for (let i = 0; i < 400 && !t.over; i++) {
      const a = Math.floor(pick() * 7)
      t = [() => g.tetrisMove(t, -1), () => g.tetrisMove(t, 1), () => g.tetrisRotate(t, 1), () => g.tetrisRotate(t, -1), () => g.tetrisTick(t, rng), () => g.tetrisSoftDrop(t, rng), () => (pick() < 0.3 ? g.tetrisHardDrop(t, rng) : g.tetrisHold(t, rng))][a]()
      assert.equal(t.board.length, 20); assert.ok(t.board.every((r) => r.length === 10))
      if (!t.over) assert.ok(!g.collides(t.board, t.piece), 'live piece overlaps the stack')
      assert.ok(Number.isInteger(t.score) && t.score >= 0)
    }
    let s = g.snakeNew(rng)
    const dirs = ['up', 'down', 'left', 'right']
    for (let i = 0; i < 600 && !s.over; i++) {
      if (pick() < 0.3) s = g.snakeTurn(s, dirs[Math.floor(pick() * 4)])
      s = g.snakeStep(s, rng)
      assert.equal(new Set(s.snake.map((c) => c.join())).size, s.snake.length, 'snake overlaps itself')
      if (!s.over) assert.ok(s.snake.every(([x, y]) => x >= 0 && y >= 0 && x < s.w && y < s.h))
      if (s.food && !s.over) assert.ok(!s.snake.some(([x, y]) => x === s.food[0] && y === s.food[1]))
    }
  }
})

test('rewards: capped and never negative', () => {
  assert.deepEqual(g.gameReward('snake', 0), { coins: 0, xp: 2 })
  assert.equal(g.gameReward('snake', 1e9).coins, 12); assert.equal(g.gameReward('tetris', 1e9).coins, 15); assert.equal(g.gameReward('tetris', 1e9).xp, 30)
  assert.deepEqual(g.gameReward('snake', -50), { coins: 0, xp: 2 })
  assert.equal(g.gameReward('tetris', 4000).coins, 10)
})

test('buddy: sits right of the chat box, bottom aligned, when there is room', () => {
  const card = { left: 300, top: 600, right: 900, bottom: 700 }
  const p = g.placeBuddy(card, 1100, 96, 130, 1200, 800)
  assert.equal(p.mode, 'beside'); assert.equal(p.x, 910); assert.equal(p.y, 570)
})

test('buddy: perches on the top-right corner when the column is too narrow', () => {
  const card = { left: 20, top: 600, right: 380, bottom: 700 }
  const p = g.placeBuddy(card, 400, 96, 130, 420, 800)
  assert.equal(p.mode, 'above'); assert.equal(p.x, 284); assert.equal(p.y, 464)
})

test('buddy: never leaves the viewport, whatever the inputs', () => {
  const rng = g.makeRng(5)
  for (let i = 0; i < 500; i++) {
    const vw = 300 + Math.floor(rng() * 1500), vh = 300 + Math.floor(rng() * 900)
    const l = Math.floor(rng() * vw), t = Math.floor(rng() * vh)
    const card = { left: l, top: t, right: l + Math.floor(rng() * 800), bottom: t + Math.floor(rng() * 300) }
    const p = g.placeBuddy(card, card.right + Math.floor(rng() * 400), 96, 130, vw, vh)
    assert.ok(p.x >= 8 && p.y >= 8, 'top-left'); assert.ok(p.x + 96 <= Math.max(vw - 8, 104) && p.y + 130 <= Math.max(vh - 8, 138), 'bottom-right')
  }
})

test('buddy: edge of the room check is exact', () => {
  const card = { left: 0, top: 500, right: 500, bottom: 600 }
  assert.equal(g.placeBuddy(card, 500 + 96 + 10, 96, 100, 2000, 900).mode, 'beside')
  assert.equal(g.placeBuddy(card, 500 + 96 + 9, 96, 100, 2000, 900).mode, 'above')
})

test('window opens above the pet with a 12px gap, never touching it', () => {
  const pet = { left: 960, top: 610, right: 1052, bottom: 728 }
  const p = g.placeAbove(pet, 300, 280, 1100, 760)
  assert.equal(p.y + 280, 610 - 12); assert.equal(p.x + 300, 1052)
})

test('window goes left of the pet when there is no room above, and never overlaps it', () => {
  const pet = { left: 700, top: 100, right: 792, bottom: 218 }
  const p = g.placeAbove(pet, 300, 280, 1100, 760)
  assert.ok(p.x + 300 + 12 <= 700, 'left of the pet with a gap'); assert.equal(p.y, 8, 'taller than the room above, so held at the top margin')
})

test('placeAbove stays on screen for random inputs', () => {
  const rng = g.makeRng(8)
  for (let i = 0; i < 500; i++) {
    const vw = 340 + Math.floor(rng() * 1500), vh = 340 + Math.floor(rng() * 900)
    const l = Math.floor(rng() * (vw - 92)), t = Math.floor(rng() * (vh - 118))
    const p = g.placeAbove({ left: l, top: t, right: l + 92, bottom: t + 118 }, 300, 300, vw, vh)
    assert.ok(p.x >= 8 && p.y >= 8 && p.x + 300 <= Math.max(vw - 8, 308) && p.y + 300 <= Math.max(vh - 8, 308))
  }
})
