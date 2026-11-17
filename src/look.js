// Rayskinz DSH Design - chat look (pure: builds CSS text, no DOM, no timers).
// Fonts, text size and spacing, the user's message bubble style, and the chat column width. The page applies
// the returned string in one <style>; nothing here touches the document. Prefixed names only (one shared scope).

export const LOOK_FONTS = {
  default: { label: 'App default', stack: '' },
  system: { label: 'System', stack: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' },
  serif: { label: 'Serif', stack: 'Georgia, "Iowan Old Style", "Palatino Linotype", "Times New Roman", serif' },
  rounded: { label: 'Rounded', stack: '"Nunito", "Varela Round", "Segoe UI", "SF Pro Rounded", system-ui, sans-serif' },
  mono: { label: 'Mono', stack: '"Cascadia Code", "SF Mono", Consolas, "DejaVu Sans Mono", monospace' },
  dyslexic: { label: 'Easy to read', stack: '"Atkinson Hyperlegible", "Lexend", "Verdana", "Segoe UI", sans-serif' },
}

export const LOOK_BUBBLES = {
  default: { label: 'App default', hint: 'Leave it as the app draws it' },
  soft: { label: 'Soft', hint: 'Rounder, gently tinted' },
  outline: { label: 'Outline', hint: 'Just a line, no fill' },
  accent: { label: 'Accent', hint: 'Filled with your accent colour' },
  minimal: { label: 'Minimal', hint: 'No box, a quiet side line' },
}

const lookInt = (v, lo, hi) => Math.min(hi, Math.max(lo, Math.round(Number.isFinite(Number(v)) ? Number(v) : 0)))

// Text size: the app's own size (px) plus delta; clamped so the chat stays usable.
export function lookSize(base, delta) {
  const b = Number.isFinite(Number(base)) && Number(base) > 0 ? Number(base) : 14
  return Math.min(22, Math.max(10, b + lookInt(delta, -3, 6)))
}

// Line spacing is added to the app's own line height through its published delta variable.
export const lookLineDelta = (spacing) => lookInt(spacing, -4, 10)

// Chat column width in px: 0 means the app's own width. Otherwise 520-1600.
export const lookWidth = (w) => { const n = Math.round(Number(w)); return Number.isFinite(n) && n > 0 ? Math.min(1600, Math.max(520, n)) : 0 }

// The bubble: CSS for [data-message-bubble]. `accent` / `accentText` come from the page (accent setting or host brand).
export function lookBubbleCss(style, accent, accentText) {
  const a = /^#[0-9a-f]{6}$/i.test(accent || '') ? accent : '#4176e6'
  const t = /^#[0-9a-f]{6}$/i.test(accentText || '') ? accentText : '#ffffff'
  const B = '[data-message-bubble]'
  switch (style) {
    case 'soft':
      return B + '{border-radius:20px!important;background:color-mix(in srgb,' + a + ' 12%,var(--dsw-alias-bg-layer-1))!important;border:0.5px solid color-mix(in srgb,' + a + ' 30%,transparent)!important;box-shadow:none!important}'
    case 'outline':
      return B + '{background:transparent!important;border:1.5px solid color-mix(in srgb,' + a + ' 70%,transparent)!important;border-radius:14px!important;box-shadow:none!important}'
    case 'accent':
      return B + '{background:' + a + '!important;color:' + t + '!important;border:0!important;border-radius:16px!important}' + B + ' *{color:inherit!important}' + B + ' a{text-decoration:underline}'
    case 'minimal':
      return B + '{background:transparent!important;border:0!important;border-radius:0!important;box-shadow:none!important;border-right:3px solid color-mix(in srgb,' + a + ' 75%,transparent)!important;padding-right:12px!important}'
    default:
      return ''
  }
}

// Everything in one string. `s` = settings; `host` = { size: the app's content font px } measured by the page.
export function lookCss(s, host = {}) {
  const out = []
  const font = LOOK_FONTS[s.fontFamily]
  if (font && font.stack) out.push('body{--dsh-font-family-text:' + font.stack + '!important}')
  const delta = lookInt(s.fontSize, -3, 6)
  if (delta !== 0) {
    const size = lookSize(host.size, delta)
    out.push('body{--dsh-content-font-size:' + size + 'px!important;--dsh-content-font-size-secondary:' + Math.max(10, size - 1) + 'px!important}')
  }
  const ld = lookLineDelta(s.lineSpacing)
  if (ld !== 0) out.push('body{--dsh-content-font-delta:' + ld + 'px!important;--dsh-content-font-delta-secondary:' + ld + 'px!important}')
  const w = lookWidth(s.chatWidth)
  if (w) out.push('body{--dsh-chat-content-width:' + w + 'px!important}')
  const bubble = lookBubbleCss(s.userBubble, s.accentEnabled ? s.accent : '', s.accentText)
  if (bubble) out.push(bubble)
  return out.join('\n')
}

// ---------------------------------------------------------------------------- avatars
// A small round picture above each assistant reply and above each of your messages. CSS only: it adds a
// ::before to the app's own row markers and never touches the app's markup. Kinds: none | emoji | pet | image.
export const AVATAR_KINDS = ['none', 'emoji', 'pet', 'image']
export const AVATAR_EMOJI = ['\u{1F916}', '\u{1F989}', '\u{1F98A}', '\u{1F431}', '\u{1F436}', '\u{1F409}', '\u{1F419}', '\u{1F438}', '\u{1F47E}', '\u{1F9D9}', '\u{1F680}', '\u{1F31F}', '\u{1F525}', '\u{1F9E0}', '\u{26A1}', '\u{1F338}']

const avatarSizeOf = (n) => Math.min(44, Math.max(20, Math.round(Number.isFinite(Number(n)) ? Number(n) : 26)))

// An emoji (or short symbol) is safe to place in CSS content only if it has no quote, backslash, angle bracket,
// control character or line break, and is at most 8 characters. Anything else falls back to the robot.
export function avatarEmoji(v) {
  if (typeof v !== 'string') return AVATAR_EMOJI[0]
  const s = v.trim()
  if (!s || [...s].length > 8 || /["'\\<>`{}();\u0000-\u001f\u007f\u2028\u2029]/.test(s)) return AVATAR_EMOJI[0]
  return s
}

// A stored picture must be a small png/jpeg/webp data URL.
export function avatarImage(v) {
  return typeof v === 'string' && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v) && v.length <= 120000 ? v : ''
}

// One side's face: { text } or { image } or null. `petEmoji` is the current species emoji.
export function avatarFace(kind, emoji, image, petEmoji) {
  if (kind === 'emoji') return { text: avatarEmoji(emoji) }
  if (kind === 'pet') return { text: avatarEmoji(petEmoji) }
  if (kind === 'image') { const img = avatarImage(image); return img ? { image: img } : null }
  return null
}

function avatarRule(selector, face, size, side) {
  // Out of the layout flow on purpose: the picture is placed in the margin beside the chat column (left of replies, right of
  // your messages) and takes NO height. A picture that took space in the flow would change the height of rows above the
  // reader whenever a row fills in or folds, and the chat would jump under their eyes.
  // A float with a negative outer height: it is drawn beside the column but its layout height nets out to zero, so it
  // never pushes a line or a row. It also needs no change to the app's own row (no position override).
  const base = selector + '::before{content:' + (face.text ? JSON.stringify(face.text) : '""') + ';float:' + (side === 'user' ? 'right' : 'left') + ';'
    + 'margin:2px ' + (side === 'user' ? '-' + (size + 10) + 'px ' : '0 ') + '-' + (size + 2) + 'px ' + (side === 'user' ? '0' : '-' + (size + 10) + 'px') + ';'
    + 'pointer-events:none;display:flex;align-items:center;justify-content:center;box-sizing:border-box;'
    + 'width:' + size + 'px;height:' + size + 'px;border-radius:50%;'
    + 'font-size:' + Math.round(size * 0.58) + 'px;line-height:1;overflow:hidden;'
    + (face.image ? 'background:center/cover no-repeat url("' + face.image + '");' : 'background:color-mix(in srgb,var(--dsw-alias-label-primary) 9%,var(--dsw-alias-bg-layer-1));')
    + 'box-shadow:0 0 0 1px color-mix(in srgb,var(--dsw-alias-label-primary) 14%,transparent)}'
  return base
}

// All avatar css. `s` = settings, `images` = { assistant, user } data URLs from the host, `petEmoji` the pet's emoji.
export function avatarCss(s, images = {}, petEmoji = '') {
  const size = avatarSizeOf(s.avatarSize)
  const out = []
  const a = avatarFace(s.avatarAssistantKind, s.avatarAssistantEmoji, images.assistant, petEmoji)
  const u = avatarFace(s.avatarUserKind, s.avatarUserEmoji, images.user, petEmoji)
  // Only a reply row that really has content gets a picture. The app lays out empty rows as zero height and skips
  // their spacing, so a picture on an empty row would add height the app did not plan for and shove the chat around
  // when the row fills in or folds away (the reader's place would jump).
  const REPLY = '[data-chat-group-part="response"]:not(:empty):not(:has(> [data-slot="conversation.chat.node"]:empty)):not([hidden])'
  if (a) out.push(avatarRule(REPLY, a, size, 'assistant'))
  if (u) out.push(avatarRule('[data-chat-flow-kind="user"]', u, size, 'user'))
  if (out.length) {
    // Not enough side room (narrow window): hide the pictures.
    out.push('@media (max-width:' + (720 + 2 * (size + 40)) + 'px){' + REPLY + '::before,[data-chat-flow-kind="user"]::before{display:none!important}}')
  }
  return out.join('\n')
}