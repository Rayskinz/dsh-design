// Rayskinz DSH Design - more game rules: 2048, Minesweeper, Pong.
// Same contract as games.js: pure and deterministic, no DOM, no timers, no imports. Every function takes a
// state and returns a NEW state (inputs are never mutated); randomness comes from an injected rng returning
// [0,1). A finished game returns the same state reference for any further input.
// Exports are prefixed per game (g2048*, mines*, pong*) because every rule file is pasted into one scope.

// ================================================================== 2048
function g2048Spawn(s, rng) {
  const empty = []
  s.board.forEach((row, y) => row.forEach((v, x) => { if (v === 0) empty.push([x, y]) }))
  if (empty.length === 0) return s
  const [x, y] = empty[Math.floor(rng() * empty.length) % empty.length]
  const v = rng() < 0.9 ? 2 : 4
  const board = s.board.map((r) => r.slice())
  board[y][x] = v
  return { ...s, board, best: Math.max(s.best, v) }
}

export function g2048New(rng, size = 4) {
  const n = Math.min(6, Math.max(3, Math.floor(Number(size)) || 4))
  const s = { size: n, board: Array.from({ length: n }, () => Array(n).fill(0)), score: 0, best: 0, won: false, over: false, moves: 0 }
  return g2048Spawn(g2048Spawn(s, rng), rng)
}

export function g2048CanMove(s) {
  const n = s.size
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const v = s.board[y][x]
      if (v === 0) return true
      if (x + 1 < n && s.board[y][x + 1] === v) return true
      if (y + 1 < n && s.board[y + 1][x] === v) return true
    }
  }
  return false
}

// Slide one line toward index 0. Each tile merges at most once per move.
function g2048Line(line) {
  const tiles = line.filter((v) => v !== 0)
  const out = []
  let gain = 0
  for (let i = 0; i < tiles.length; i++) {
    if (tiles[i] === tiles[i + 1]) {
      out.push(tiles[i] * 2)
      gain += tiles[i] * 2
      i++
    } else out.push(tiles[i])
  }
  while (out.length < line.length) out.push(0)
  return { out, gain }
}

export function g2048Move(s, dir, rng) {
  if (s.over) return s
  const n = s.size
  // [x, y] of position j on line i, for each direction (lines slide toward position 0).
  const at = { left: (i, j) => [j, i], right: (i, j) => [n - 1 - j, i], up: (i, j) => [i, j], down: (i, j) => [i, n - 1 - j] }[dir]
  if (!at) return s
  const board = s.board.map((r) => r.slice())
  let gain = 0
  let moved = false
  for (let i = 0; i < n; i++) {
    const coords = Array.from({ length: n }, (_, j) => at(i, j))
    const line = coords.map(([x, y]) => board[y][x])
    const r = g2048Line(line)
    gain += r.gain
    coords.forEach(([x, y], j) => {
      if (board[y][x] !== r.out[j]) moved = true
      board[y][x] = r.out[j]
    })
  }
  if (!moved) return s
  const top = Math.max(...board.map((r) => Math.max(...r)))
  let next = { ...s, board, score: s.score + gain, best: Math.max(s.best, top), won: s.won || top >= 2048, moves: s.moves + 1 }
  next = g2048Spawn(next, rng)
  return { ...next, over: !g2048CanMove(next) }
}

// ============================================================= Minesweeper
function minesNeighbors(w, h, i) {
  const x = i % w
  const y = Math.floor(i / w)
  const out = []
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue
      const nx = x + dx
      const ny = y + dy
      if (nx >= 0 && ny >= 0 && nx < w && ny < h) out.push(ny * w + nx)
    }
  }
  return out
}

export function minesNew(w = 9, h = 9, mines = 10) {
  const W = Math.min(50, Math.max(3, Math.floor(Number(w)) || 9))
  const H = Math.min(50, Math.max(3, Math.floor(Number(h)) || 9))
  const m = Math.max(0, Math.min(Math.floor(Number(mines)) || 0, W * H - 9))
  return { w: W, h: H, mines: m, cells: Array.from({ length: W * H }, () => ({ mine: false, adj: 0, state: 'hidden' })), status: 'ready', flags: 0, opened: 0 }
}

export const minesFlagsLeft = (s) => s.mines - s.flags

function minesPlace(s, safeIndex, rng) {
  const cells = s.cells.map((c) => ({ ...c }))
  const banned = new Set([safeIndex, ...minesNeighbors(s.w, s.h, safeIndex)])
  const pool = []
  for (let i = 0; i < cells.length; i++) if (!banned.has(i)) pool.push(i)
  const count = Math.min(s.mines, pool.length)
  for (let k = 0; k < count; k++) {
    const j = k + (Math.floor(rng() * (pool.length - k)) % (pool.length - k))
    ;[pool[k], pool[j]] = [pool[j], pool[k]]
    cells[pool[k]].mine = true
  }
  cells.forEach((c, i) => { c.adj = minesNeighbors(s.w, s.h, i).filter((n) => cells[n].mine).length })
  return cells
}

// Open the given cells (first call places the mines). Flood-fills zeros iteratively.
function minesOpen(s, list, rng) {
  let cells
  if (s.status === 'ready') cells = minesPlace(s, list[0], rng)
  else cells = s.cells.map((c) => ({ ...c }))
  let opened = s.opened
  let hitMine = false
  const stack = list.slice()
  while (stack.length) {
    const i = stack.pop()
    const c = cells[i]
    if (c.state !== 'hidden') continue
    c.state = 'open'
    opened++
    if (c.mine) { hitMine = true; continue }
    if (c.adj === 0) for (const n of minesNeighbors(s.w, s.h, i)) if (cells[n].state === 'hidden') stack.push(n)
  }
  let status = 'playing'
  if (hitMine) {
    status = 'lost'
    cells.forEach((c) => { if (c.mine && c.state === 'hidden') c.state = 'open' })
  } else if (opened === s.w * s.h - s.mines) {
    status = 'won'
    cells.forEach((c) => { if (c.mine) c.state = 'flag' })
  }
  const flags = cells.filter((c) => c.state === 'flag').length
  return { ...s, cells, status, opened, flags }
}

const minesDone = (s) => s.status === 'won' || s.status === 'lost'

export function minesReveal(s, x, y, rng) {
  if (minesDone(s)) return s
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= s.w || y >= s.h) return s
  const i = y * s.w + x
  if (s.cells[i].state !== 'hidden') return s
  return minesOpen(s, [i], rng)
}

export function minesFlag(s, x, y) {
  if (minesDone(s)) return s
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= s.w || y >= s.h) return s
  const i = y * s.w + x
  const c = s.cells[i]
  if (c.state === 'open') return s
  const cells = s.cells.map((cc, k) => (k === i ? { ...cc, state: c.state === 'flag' ? 'hidden' : 'flag' } : cc))
  return { ...s, cells, flags: s.flags + (c.state === 'flag' ? -1 : 1) }
}

export function minesChord(s, x, y, rng) {
  if (minesDone(s) || s.status === 'ready') return s
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= s.w || y >= s.h) return s
  const i = y * s.w + x
  const c = s.cells[i]
  if (c.state !== 'open' || c.adj === 0) return s
  const near = minesNeighbors(s.w, s.h, i)
  if (near.filter((n) => s.cells[n].state === 'flag').length !== c.adj) return s
  const todo = near.filter((n) => s.cells[n].state === 'hidden')
  return todo.length === 0 ? s : minesOpen(s, todo, rng)
}

// ==================================================================== Pong
export const PONG_W = 80
export const PONG_H = 50
export const PONG_PADDLE_H = 10
export const PONG_PADDLE_X = 3
export const PONG_BALL_R = 1.2
export const PONG_WIN = 7
const PONG_THICK = 1.5
const PONG_BASE = 40
const PONG_MAX = 90
const PONG_PLAYER_SPEED = 55
const PONG_AI_SPEED = 36
const PONG_STEP_MS = 4
const PONG_SERVE_MS = 600

function pongServe(rng, towards) {
  const dir = towards === 'left' ? -1 : towards === 'right' ? 1 : rng() < 0.5 ? -1 : 1
  const a = (rng() - 0.5) * 2 * (30 * Math.PI) / 180
  return { x: PONG_W / 2, y: PONG_H / 2, vx: dir * PONG_BASE * Math.cos(a), vy: PONG_BASE * Math.sin(a) }
}

export function pongNew(rng) {
  return {
    ball: pongServe(rng, null), player: { y: PONG_H / 2 }, ai: { y: PONG_H / 2 },
    score: { player: 0, ai: 0 }, serving: true, serveMs: PONG_SERVE_MS, over: false, winner: null, rallies: 0, speed: PONG_BASE,
    aim: 0,
  }
}

export const pongScore = (s) => s.score.player * 10 + (s.winner === 'player' ? 50 : 0)

export function pongStep(s, dtMs, input, rng) {
  if (s.over) return s
  const dt = Math.min(50, Math.max(0, Number.isFinite(dtMs) ? dtMs : 0))
  if (dt === 0) return s
  const dir = input && input.dir > 0 ? 1 : input && input.dir < 0 ? -1 : 0
  const lo = PONG_PADDLE_H / 2
  const hi = PONG_H - PONG_PADDLE_H / 2
  const faceP = PONG_PADDLE_X + PONG_THICK
  const faceA = PONG_W - PONG_PADDLE_X - PONG_THICK
  let ball = { ...s.ball }
  let py = s.player.y
  let ay = s.ai.y
  let score = { ...s.score }
  let serving = s.serving
  let serveMs = s.serveMs
  let rallies = s.rallies
  let speed = s.speed
  let aim = s.aim
  let winner = null
  let remaining = dt
  while (remaining > 1e-9 && winner === null) {
    const stepMs = Math.min(PONG_STEP_MS, remaining)
    remaining -= stepMs
    const t = stepMs / 1000
    py = Math.min(hi, Math.max(lo, py + dir * PONG_PLAYER_SPEED * t))
    // The AI only chases while the ball is heading its way, and aims slightly off-centre each rally.
    const target = ball.vx > 0 ? ball.y + aim : PONG_H / 2
    const diff = target - ay
    if (Math.abs(diff) > 2) ay += Math.sign(diff) * Math.min(Math.abs(diff), (ball.vx > 0 ? PONG_AI_SPEED : PONG_AI_SPEED / 2) * t)
    ay = Math.min(hi, Math.max(lo, ay))
    if (serving) {
      serveMs -= stepMs
      if (serveMs <= 0) { serving = false; serveMs = 0 }
      continue
    }
    const px = ball.x
    ball.x += ball.vx * t
    ball.y += ball.vy * t
    if (ball.y - PONG_BALL_R < 0) { ball.y = 2 * PONG_BALL_R - ball.y; ball.vy = Math.abs(ball.vy) }
    if (ball.y + PONG_BALL_R > PONG_H) { ball.y = 2 * (PONG_H - PONG_BALL_R) - ball.y; ball.vy = -Math.abs(ball.vy) }
    // Paddle hits: only when the ball's edge crosses the paddle's face this substep (no hits from behind).
    if (ball.vx < 0 && px - PONG_BALL_R > faceP && ball.x - PONG_BALL_R <= faceP && Math.abs(ball.y - py) <= PONG_PADDLE_H / 2 + PONG_BALL_R) {
      const rel = Math.max(-1, Math.min(1, (ball.y - py) / (PONG_PADDLE_H / 2 + PONG_BALL_R)))
      const a = (rel * 60 * Math.PI) / 180
      speed = Math.min(PONG_MAX, speed * 1.04)
      ball = { x: faceP + PONG_BALL_R, y: ball.y, vx: speed * Math.cos(a), vy: speed * Math.sin(a) }
      rallies++
      aim = (rng() - 0.5) * 7
    } else if (ball.vx > 0 && px + PONG_BALL_R < faceA && ball.x + PONG_BALL_R >= faceA && Math.abs(ball.y - ay) <= PONG_PADDLE_H / 2 + PONG_BALL_R) {
      const rel = Math.max(-1, Math.min(1, (ball.y - ay) / (PONG_PADDLE_H / 2 + PONG_BALL_R)))
      const a = (rel * 60 * Math.PI) / 180
      speed = Math.min(PONG_MAX, speed * 1.04)
      ball = { x: faceA - PONG_BALL_R, y: ball.y, vx: -speed * Math.cos(a), vy: speed * Math.sin(a) }
      rallies++
    }
    const missedLeft = ball.x - PONG_BALL_R < 0
    const missedRight = ball.x + PONG_BALL_R > PONG_W
    if (missedLeft || missedRight) {
      if (missedLeft) score.ai++
      else score.player++
      if (score.player >= PONG_WIN) winner = 'player'
      else if (score.ai >= PONG_WIN) winner = 'ai'
      speed = PONG_BASE
      rallies = 0
      aim = (rng() - 0.5) * 7
      ball = pongServe(rng, missedLeft ? 'left' : 'right')
      serving = true
      serveMs = PONG_SERVE_MS
    }
  }
  return { ...s, ball, player: { y: py }, ai: { y: ay }, score, serving, serveMs, rallies, speed, aim, over: winner !== null, winner }
}
