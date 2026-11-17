// Rayskinz DSH Design - game rules (Snake and Tetris).
// Pure and deterministic: no DOM, no timers. Every function takes a state and
// returns a new one, and randomness comes from an injected rng, so tests can
// drive whole games. The browser half inlines this file (see tools/build-client.mjs).

export const SNAKE_W = 16
export const SNAKE_H = 12
export const TETRIS_W = 10
export const TETRIS_H = 20

// ------------------------------------------------------------------ rng
// mulberry32: a small seedable generator, so a given seed always plays the same.
export function makeRng(seed = Date.now()) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ---------------------------------------------------------------- snake
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }
const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' }

function placeFood(snake, rng, w, h) {
  const taken = new Set(snake.map(([x, y]) => y * w + x))
  const free = []
  for (let i = 0; i < w * h; i++) if (!taken.has(i)) free.push(i)
  if (free.length === 0) return null
  const i = free[Math.floor(rng() * free.length) % free.length]
  return [i % w, Math.floor(i / w)]
}

export function snakeNew(rng, w = SNAKE_W, h = SNAKE_H) {
  const cy = Math.floor(h / 2)
  const cx = Math.floor(w / 2)
  const snake = [[cx, cy], [cx - 1, cy], [cx - 2, cy]]
  return { w, h, snake, dir: 'right', queue: [], food: placeFood(snake, rng, w, h), score: 0, over: false, won: false, ticks: 0 }
}

// Queue a turn. Reversing straight into yourself is ignored; at most two turns are
// buffered so quick key presses between ticks are not lost.
export function snakeTurn(s, dir) {
  if (s.over || !DIRS[dir]) return s
  const last = s.queue.length ? s.queue[s.queue.length - 1] : s.dir
  if (dir === last || dir === OPPOSITE[last]) return s
  if (s.queue.length >= 2) return s
  return { ...s, queue: [...s.queue, dir] }
}

export function snakeStep(s, rng) {
  if (s.over) return s
  const dir = s.queue.length ? s.queue[0] : s.dir
  const queue = s.queue.slice(1)
  const [dx, dy] = DIRS[dir]
  const head = [s.snake[0][0] + dx, s.snake[0][1] + dy]
  const eating = s.food !== null && head[0] === s.food[0] && head[1] === s.food[1]
  // The tail moves away this tick unless we are eating, so it is not an obstacle.
  const body = eating ? s.snake : s.snake.slice(0, -1)
  const hitWall = head[0] < 0 || head[1] < 0 || head[0] >= s.w || head[1] >= s.h
  const hitSelf = body.some(([x, y]) => x === head[0] && y === head[1])
  if (hitWall || hitSelf) return { ...s, dir, queue, over: true, ticks: s.ticks + 1 }
  const snake = [head, ...body]
  if (!eating) return { ...s, snake, dir, queue, ticks: s.ticks + 1 }
  const food = placeFood(snake, rng, s.w, s.h)
  return { ...s, snake, dir, queue, food, score: s.score + 10, won: food === null, over: food === null, ticks: s.ticks + 1 }
}

// Milliseconds per step: starts relaxed, gets faster every 5 foods, never faster than 70ms.
export function snakeDelay(s) {
  return Math.max(70, 190 - Math.floor(s.score / 50) * 12)
}

// ---------------------------------------------------------------- tetris
// Each piece lists its four rotations as [x, y] cells inside a 4x4 box.
export const PIECES = {
  I: [[[0, 1], [1, 1], [2, 1], [3, 1]], [[2, 0], [2, 1], [2, 2], [2, 3]], [[0, 2], [1, 2], [2, 2], [3, 2]], [[1, 0], [1, 1], [1, 2], [1, 3]]],
  O: [[[1, 0], [2, 0], [1, 1], [2, 1]], [[1, 0], [2, 0], [1, 1], [2, 1]], [[1, 0], [2, 0], [1, 1], [2, 1]], [[1, 0], [2, 0], [1, 1], [2, 1]]],
  T: [[[1, 0], [0, 1], [1, 1], [2, 1]], [[1, 0], [1, 1], [2, 1], [1, 2]], [[0, 1], [1, 1], [2, 1], [1, 2]], [[1, 0], [0, 1], [1, 1], [1, 2]]],
  S: [[[1, 0], [2, 0], [0, 1], [1, 1]], [[1, 0], [1, 1], [2, 1], [2, 2]], [[1, 1], [2, 1], [0, 2], [1, 2]], [[0, 0], [0, 1], [1, 1], [1, 2]]],
  Z: [[[0, 0], [1, 0], [1, 1], [2, 1]], [[2, 0], [1, 1], [2, 1], [1, 2]], [[0, 1], [1, 1], [1, 2], [2, 2]], [[1, 0], [0, 1], [1, 1], [0, 2]]],
  J: [[[0, 0], [0, 1], [1, 1], [2, 1]], [[1, 0], [2, 0], [1, 1], [1, 2]], [[0, 1], [1, 1], [2, 1], [2, 2]], [[1, 0], [1, 1], [0, 2], [1, 2]]],
  L: [[[2, 0], [0, 1], [1, 1], [2, 1]], [[1, 0], [1, 1], [1, 2], [2, 2]], [[0, 1], [1, 1], [2, 1], [0, 2]], [[0, 0], [1, 0], [1, 1], [1, 2]]],
}
export const PIECE_NAMES = Object.keys(PIECES)
// A small wall-kick set: try the rotation in place, then nudge sideways, then up.
const KICKS = [[0, 0], [-1, 0], [1, 0], [-2, 0], [2, 0], [0, -1]]

// Seven-bag: every piece appears once per seven, so droughts are impossible.
function refill(bag, rng) {
  if (bag.length >= 7) return bag
  const next = PIECE_NAMES.slice()
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[next[i], next[j]] = [next[j], next[i]]
  }
  return bag.concat(next)
}

export const emptyBoard = (w = TETRIS_W, h = TETRIS_H) => Array.from({ length: h }, () => Array(w).fill(''))

export function cells(piece) {
  return PIECES[piece.type][piece.rot].map(([x, y]) => [piece.x + x, piece.y + y])
}

export function collides(board, piece) {
  const h = board.length
  const w = board[0].length
  return cells(piece).some(([x, y]) => x < 0 || x >= w || y >= h || (y >= 0 && board[y][x] !== ''))
}

function spawn(type, w) {
  return { type, rot: 0, x: Math.floor((w - 4) / 2), y: -1 }
}

export function tetrisNew(rng, w = TETRIS_W, h = TETRIS_H) {
  let bag = refill([], rng)
  const first = bag[0]
  bag = refill(bag.slice(1), rng)
  const board = emptyBoard(w, h)
  const piece = spawn(first, w)
  return { w, h, board, piece, next: bag[0], bag: bag.slice(1), hold: null, canHold: true, score: 0, lines: 0, level: 1, over: false, combo: 0 }
}

const LINE_POINTS = [0, 100, 300, 500, 800]

function lock(s, rng) {
  const board = s.board.map((row) => row.slice())
  let toppedOut = false
  for (const [x, y] of cells(s.piece)) {
    if (y < 0) toppedOut = true
    else board[y][x] = s.piece.type
  }
  const kept = board.filter((row) => row.some((c) => c === ''))
  const cleared = board.length - kept.length
  while (kept.length < board.length) kept.unshift(Array(s.w).fill(''))
  const lines = s.lines + cleared
  const level = Math.floor(lines / 10) + 1
  const combo = cleared > 0 ? s.combo + 1 : 0
  const score = s.score + LINE_POINTS[cleared] * s.level + (cleared > 0 ? 50 * s.combo * s.level : 0)
  if (toppedOut) return { ...s, board: kept, score, lines, level, combo, over: true }
  const bag = refill(s.bag, rng)
  const type = s.next
  const piece = spawn(type, s.w)
  const over = collides(kept, piece)
  return { ...s, board: kept, piece, next: bag[0], bag: bag.slice(1), canHold: true, score, lines, level, combo, over, cleared }
}

export function tetrisMove(s, dx) {
  if (s.over) return s
  const p = { ...s.piece, x: s.piece.x + dx }
  return collides(s.board, p) ? s : { ...s, piece: p }
}

export function tetrisRotate(s, dir = 1) {
  if (s.over) return s
  const rot = (s.piece.rot + dir + 4) % 4
  for (const [kx, ky] of KICKS) {
    const p = { ...s.piece, rot, x: s.piece.x + kx, y: s.piece.y + ky }
    if (!collides(s.board, p)) return { ...s, piece: p }
  }
  return s
}

// One gravity tick. Returns the new state; locks the piece when it cannot fall.
export function tetrisTick(s, rng) {
  if (s.over) return s
  const p = { ...s.piece, y: s.piece.y + 1 }
  if (!collides(s.board, p)) return { ...s, piece: p, cleared: 0 }
  return lock({ ...s, cleared: 0 }, rng)
}

export function tetrisSoftDrop(s, rng) {
  const next = tetrisTick(s, rng)
  return next.over || next.piece === s.piece || next.cleared ? next : { ...next, score: next.score + (next.piece.y > s.piece.y ? 1 : 0) }
}

export function tetrisHardDrop(s, rng) {
  if (s.over) return s
  let p = s.piece
  let dist = 0
  while (!collides(s.board, { ...p, y: p.y + 1 })) {
    p = { ...p, y: p.y + 1 }
    dist++
  }
  return lock({ ...s, piece: p, score: s.score + dist * 2, cleared: 0 }, rng)
}

export function ghostY(s) {
  let y = s.piece.y
  while (!collides(s.board, { ...s.piece, y: y + 1 })) y++
  return y
}

export function tetrisHold(s, rng) {
  if (s.over || !s.canHold) return s
  const type = s.piece.type
  if (s.hold === null) {
    const bag = refill(s.bag, rng)
    const piece = spawn(s.next, s.w)
    return { ...s, hold: type, piece, next: bag[0], bag: bag.slice(1), canHold: false, over: collides(s.board, piece) }
  }
  const piece = spawn(s.hold, s.w)
  return { ...s, hold: type, piece, canHold: false, over: collides(s.board, piece) }
}

// Milliseconds per gravity tick; level 1 is gentle, level 15+ is fast.
export function tetrisDelay(s) {
  return Math.max(60, 800 - (s.level - 1) * 50)
}

// -------------------------------------------------------------- rewards
// Coins and xp for finishing a game. Capped so grinding games cannot break the pet economy.
export function gameReward(game, score) {
  const s = Math.max(0, Math.floor(score))
  const coins = Math.min(game === 'snake' ? 12 : 15, game === 'snake' ? Math.floor(s / 40) : Math.floor(s / 400))
  return { coins, xp: Math.min(30, 2 + Math.floor(s / (game === 'snake' ? 30 : 250))) }
}

// Result of finishing a game: the pet earns coins and xp, and the best score is kept.
// A game that scored nothing changes nothing, so quitting at once cannot farm rewards.
export function petAfterGame(pet, game, score) {
  const s = Math.max(0, Math.floor(Number.isFinite(score) ? score : 0))
  const prev = pet.best?.[game] ?? 0
  if (s <= 0) return { pet, reward: { coins: 0, xp: 0 }, newBest: false }
  const reward = gameReward(game, s)
  const best = { snake: 0, tetris: 0, ...pet.best, [game]: Math.max(prev, s) }
  return {
    pet: { ...pet, coins: pet.coins + reward.coins, xp: pet.xp + reward.xp, joy: Math.min(100, pet.joy + 8), hunger: Math.max(0, pet.hunger - 3), best },
    reward,
    newBest: s > prev,
  }
}

// ---------------------------------------------------------- window geometry
// Keep a floating window fully reachable: never off-screen, even after the app is resized.
export function clampWindow(x, y, w, h, vw, vh, margin = 8) {
  const maxX = Math.max(margin, vw - w - margin)
  const maxY = Math.max(margin, vh - h - margin)
  return { x: Math.min(maxX, Math.max(margin, Math.round(x))), y: Math.min(maxY, Math.max(margin, Math.round(y))) }
}

// First-run spot: near the bottom-right, above the composer. A saved position of -1 means "not placed yet".
export function placeWindow(saved, w, h, vw, vh) {
  const placed = saved && saved.x >= 0 && saved.y >= 0
  return clampWindow(placed ? saved.x : vw - w - 24, placed ? saved.y : vh - h - 110, w, h, vw, vh)
}
// ------------------------------------------------------------ pet buddy spot
// The buddy sits to the right of the chat box, bottom edges lined up. If the column has
// no room on that side, it perches on the box's top-right corner instead. Rects are
// { left, top, right, bottom } in viewport pixels; `roomRight` is how far the buddy may
// reach (the chat column's right edge). Always returns a spot fully inside the viewport.
export function placeBuddy(card, roomRight, w, h, vw, vh, gap = 10, margin = 8) {
  const limit = Math.min(roomRight, vw - 4)
  const beside = limit - card.right >= w + gap
  const raw = beside ? { x: card.right + gap, y: card.bottom - h } : { x: card.right - w, y: card.top - h - 6 }
  const clamped = clampWindow(raw.x, raw.y, w, h, vw, vh, margin)
  return { ...clamped, mode: beside ? 'beside' : 'above' }
}
// Where the game window opens the first time: right-aligned above the pet, 12px clear of it.
// If there is no room above, to the left of the pet with bottoms aligned. Always fully on screen.
export function placeAbove(anchor, w, h, vw, vh, gap = 12, margin = 8) {
  if (anchor.top - gap - h >= margin) return clampWindow(anchor.right - w, anchor.top - gap - h, w, h, vw, vh, margin)
  return clampWindow(anchor.left - gap - w, anchor.bottom - h, w, h, vw, vh, margin)
}