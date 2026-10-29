// Utilidades de color (v0.9.921): tinta legible sobre el color de una categoría
// y conversiones hex ↔ HSL para el selector propio.
//
// Los colores de categoría llegan como "var(--palette-N)", "var(--cat-x)" o un
// hex personalizado ("#A1B2C3"). `resolveColor` convierte cualquiera a [r,g,b]
// leyendo la variable CSS ya resuelta (la paleta no cambia entre temas).

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i
export const isHexColor = v => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v)

function parse(c) {
  c = (c || '').trim()
  if (HEX.test(c)) {
    let h = c.slice(1)
    if (h.length === 3) h = h.split('').map(x => x + x).join('')
    return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16))
  }
  const m = c.match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i)
  return m ? [+m[1], +m[2], +m[3]] : null
}

export function resolveColor(color, depth = 0) {
  if (!color || depth > 4) return null
  const m = String(color).trim().match(/^var\(\s*(--[\w-]+)\s*(?:,\s*(.+))?\)$/)
  if (m) {
    const v = typeof document !== 'undefined'
      ? getComputedStyle(document.documentElement).getPropertyValue(m[1]).trim()
      : ''
    return resolveColor(v || m[2], depth + 1)
  }
  return parse(color)
}

function luminance([r, g, b]) {
  const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

const cache = new Map()
// Tinta (ícono/texto) que mejor contrasta sobre `color`: blanca u oscura.
// Si el color no se puede resolver, deja el blanco de siempre.
export function catInk(color) {
  if (cache.has(color)) return cache.get(color)
  const rgb = resolveColor(color)
  let ink = 'var(--on-color)'
  if (rgb) {
    const L = luminance(rgb)
    const contrastWhite = 1.05 / (L + 0.05)
    const contrastDark = (L + 0.05) / 0.0555
    ink = contrastWhite >= contrastDark ? 'var(--cat-ink-light)' : 'var(--cat-ink-dark)'
    cache.set(color, ink)
  }
  return ink
}

export function hexToHsl(hex) {
  const rgb = resolveColor(hex) || [245, 166, 35]
  const [r, g, b] = rgb.map(v => v / 255)
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
  const l = (max + min) / 2
  let h = 0, s = 0
  if (d) {
    s = d / (1 - Math.abs(2 * l - 1))
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h = (h * 60 + 360) % 360
  }
  return { h, s, l }
}

export function hslToHex(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]
  return '#' + [r, g, b].map(v => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('').toUpperCase()
}

// Cualquier color (var(--x), hex, rgb) → "#RRGGBB", o null si no se puede resolver.
export function colorToHex(color) {
  const rgb = resolveColor(color)
  return rgb ? '#' + rgb.map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase() : null
}
