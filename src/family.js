// Rayskinz DSH Design - sub-chat family colours and colour maths (pure: no DOM, no timers).
// Used to colour chats by a word in their title, to give sub-chats a darker shade of their parent's colour,
// and to warn when a picked accent colour is hard to see. Prefixed names only (one shared scope).

const FAM_HEX = /^#[0-9a-f]{6}$/i

export function famParse(hex) {
  if (typeof hex !== 'string' || !FAM_HEX.test(hex)) return null
  const n = parseInt(hex.slice(1), 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

const famHex2 = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')
export const famToHex = ({ r, g, b }) => '#' + famHex2(r) + famHex2(g) + famHex2(b)

function famToHsl({ r, g, b }) {
  const R = r / 255, G = g / 255, B = b / 255
  const max = Math.max(R, G, B), min = Math.min(R, G, B), d = max - min
  const l = (max + min) / 2
  if (d === 0) return { h: 0, s: 0, l }
  const s = d / (1 - Math.abs(2 * l - 1))
  const h = max === R ? ((G - B) / d + (G < B ? 6 : 0)) : max === G ? (B - R) / d + 2 : (R - G) / d + 4
  return { h: h * 60, s, l }
}

function famFromHsl({ h, s, l }) {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 }
}

// A shade darker for each generation below the colour's owner: same hue and saturation, lightness x0.84 per level
// (never below 0.22, so deep families stay visible). Depth 0 returns the colour unchanged.
export function famShade(hex, depth) {
  const rgb = famParse(hex)
  if (!rgb) return null
  const d = Math.max(0, Math.floor(Number.isFinite(depth) ? depth : 0))
  if (d === 0) return hex.toLowerCase()
  const hsl = famToHsl(rgb)
  const l = Math.max(Math.min(hsl.l, 0.22), hsl.l * Math.pow(0.84, d))
  return famToHex(famFromHsl({ ...hsl, l }))
}

// WCAG contrast ratio between two colours (1 - 21). Unparseable input counts as no contrast.
export function famContrast(a, b) {
  const lum = (hex) => {
    const c = famParse(hex)
    if (!c) return null
    const f = (v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4) }
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b)
  }
  const la = lum(a), lb = lum(b)
  if (la === null || lb === null) return 1
  const hi = Math.max(la, lb), lo = Math.min(la, lb)
  return (hi + 0.05) / (lo + 0.05)
}

// First rule whose word appears as a whole word (case-insensitive) in the text wins.
// "sol" must not match "solve". Returns the rule or null.
export function famMatch(text, rules) {
  if (typeof text !== 'string' || text === '' || !Array.isArray(rules)) return null
  for (const r of rules) {
    if (!r || typeof r.match !== 'string' || !FAM_HEX.test(r.color || '')) continue
    const esc = r.match.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    if (esc === '') continue
    if (new RegExp('(^|[^a-z0-9])' + esc + '([^a-z0-9]|$)', 'i').test(text)) return r
  }
  return null
}

// Resolve every row of a tree (pre-order list of { level, text }) to a colour.
// A row that matches a rule owns that colour. A row that does not inherits from its nearest ancestor that does,
// one shade darker per generation. Rows with no coloured ancestor stay uncoloured.
// Returns [{ color, base, depth, word, inherited, parent }] where parent is the index of the parent row or -1.
export function famResolve(rows, rules) {
  const out = []
  const stack = [] // ancestors of the current row: { level, index }
  for (let i = 0; i < rows.length; i++) {
    const level = Number.isFinite(rows[i].level) ? rows[i].level : 1
    while (stack.length && stack[stack.length - 1].level >= level) stack.pop()
    const parent = stack.length ? stack[stack.length - 1].index : -1
    const own = famMatch(rows[i].text, rules)
    let info
    if (own) {
      const c = own.color.toLowerCase()
      info = { color: c, base: c, depth: 0, word: own.match.trim(), inherited: false, parent, owner: i, ownerLevel: level }
    } else if (parent >= 0 && out[parent].base) {
      const p = out[parent]
      const depth = level - p.ownerLevel
      info = { color: famShade(p.base, depth), base: p.base, depth, word: p.word, inherited: true, parent, owner: p.owner, ownerLevel: p.ownerLevel }
    } else info = { color: null, base: null, depth: 0, word: null, inherited: false, parent, owner: -1, ownerLevel: level }
    out.push(info)
    stack.push({ level, index: i })
  }
  return out.map(({ owner, ownerLevel, ...rest }) => rest)
}
// Short text for a row's status badge, from the app's own dot state.
export const famStateWord = (state) => ({ ongoing: 'working', done: 'done', idle: 'idle', warning: 'waiting', error: 'error' }[state] || '')
