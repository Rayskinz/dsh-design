// Rayskinz DSH Design - celebration particles (pure maths, no DOM, no timers).
// A burst is an array of plain particles; fxStep returns a NEW particle. Randomness is injected.
// Prefixed names only: this file is pasted into the same scope as the other rule files.

export const FX_KINDS = ['confetti', 'sparkles', 'hearts']
const FX_COLORS = {
  confetti: ['#f87171', '#fbbf24', '#4ade80', '#60a5fa', '#a78bfa', '#f472b6', '#2dd4bf'],
  sparkles: ['#fde68a', '#ffffff', '#fcd34d', '#fef3c7'],
  hearts: ['#fb7185', '#f43f5e', '#f9a8d4', '#fda4af'],
}
const FX_COUNT = { confetti: 90, sparkles: 60, hearts: 24 }
const FX_GRAVITY = { confetti: 900, sparkles: 140, hearts: -30 }
const FX_DRAG = { confetti: 0.985, sparkles: 0.97, hearts: 0.99 }

export function fxCount(kind, reduced = false) {
  if (reduced) return 0
  return FX_COUNT[kind] ?? 0
}

// Particles for one burst from (ox, oy) in a w x h viewport. Unknown kind -> none.
export function fxBurst(kind, rng, ox, oy, w = 1000, h = 700) {
  const n = fxCount(kind)
  const colors = FX_COLORS[kind]
  if (!n || !colors) return []
  const cx = Math.min(w, Math.max(0, Number.isFinite(ox) ? ox : w / 2))
  const cy = Math.min(h, Math.max(0, Number.isFinite(oy) ? oy : h))
  const out = []
  for (let i = 0; i < n; i++) {
    const color = colors[Math.floor(rng() * colors.length) % colors.length]
    if (kind === 'confetti') {
      const a = (-150 + rng() * 120) * (Math.PI / 180)
      const sp = 300 + rng() * 420
      out.push({ shape: 'rect', x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, rot: rng() * 6.28, vr: (rng() - 0.5) * 14, size: 6 + rng() * 6, life: 1.7 + rng() * 0.9, max: 2.6, color })
    } else if (kind === 'sparkles') {
      const a = rng() * 6.283
      const sp = 70 + rng() * 230
      out.push({ shape: 'star', x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, rot: 0, vr: (rng() - 0.5) * 4, size: 5 + rng() * 9, life: 0.9 + rng() * 0.8, max: 1.7, color })
    } else {
      out.push({ shape: 'heart', x: cx + (rng() - 0.5) * 60, y: cy, vx: (rng() - 0.5) * 80, vy: -(90 + rng() * 150), rot: (rng() - 0.5) * 0.6, vr: (rng() - 0.5) * 0.8, size: 12 + rng() * 14, life: 1.6 + rng() * 1.0, max: 2.6, color })
    }
  }
  return out
}

// Advance one particle by dtSeconds (clamped to 50ms so a stalled tab cannot fling things).
export function fxStep(p, dtSeconds, kind = 'confetti') {
  const dt = Math.min(0.05, Math.max(0, dtSeconds))
  const drag = Math.pow(FX_DRAG[kind] ?? 0.98, dt * 60)
  const vx = p.vx * drag
  const vy = p.vy * drag + (FX_GRAVITY[kind] ?? 0) * dt
  return { ...p, x: p.x + vx * dt, y: p.y + vy * dt, vx, vy, rot: p.rot + p.vr * dt, life: p.life - dt }
}

export const fxAlive = (p) => p.life > 0

// 0..1 opacity: quick fade in, long fade out over the last third of its life.
export function fxAlpha(p) {
  const t = Math.max(0, p.life) / (p.max || 1)
  return Math.min(1, t * 3)
}