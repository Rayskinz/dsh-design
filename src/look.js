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
