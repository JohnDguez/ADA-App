import { CATEGORIES, dateToStr, today } from './utils'
import { guessCategory } from './parseVoicePayment'

// Convierte el texto OCR de un ticket en { amount, name, date, category }.
// Reglas simples (es/en); ante la duda deja el campo vacío — el usuario
// siempre revisa el formulario antes de guardar.

const strip = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

const MONTHS = { ene: 0, jan: 0, feb: 1, mar: 2, abr: 3, apr: 3, may: 4, jun: 5, jul: 6, ago: 7, aug: 7, sep: 8, set: 8, oct: 9, nov: 10, dic: 11, dec: 11 }

// "1,234.56" | "1.234,56" | "1234.56" | "1234" → número
function toNumber(raw) {
  let s = raw.replace(/[^\d.,]/g, '')
  if (!s) return null
  const lastDot = s.lastIndexOf('.')
  const lastComma = s.lastIndexOf(',')
  const sep = Math.max(lastDot, lastComma)
  if (sep === -1) return parseFloat(s)
  const decimals = s.length - sep - 1
  if (decimals === 2 || decimals === 1) {
    const intPart = s.slice(0, sep).replace(/[.,]/g, '')
    return parseFloat(`${intPart}.${s.slice(sep + 1)}`)
  }
  return parseFloat(s.replace(/[.,]/g, '')) // separador de miles
}

const NUM_RE = /\d[\d.,]*\d|\d/g
const money = (line) => (line.match(NUM_RE) || []).map(toNumber).filter(n => n != null && n > 0 && n < 1e7)

const TOTAL_RE = /\b(total a pagar|total pagado|importe total|gran total|grand total|amount due|total due|total|importe|a pagar|pago)\b/
const NOT_TOTAL_RE = /\b(subtotal|sub total|sub-total|iva|impuesto|tax|cambio|change|ahorro|descuento|discount|propina|tip|puntos|cantidad|articulos|items)\b/

function findAmount(lines) {
  const cands = []
  lines.forEach((line, i) => {
    const n = strip(line)
    if (TOTAL_RE.test(n) && !NOT_TOTAL_RE.test(n)) {
      let vals = money(line)
      if (!vals.length && lines[i + 1]) vals = money(lines[i + 1]) // el monto en la línea siguiente
      if (vals.length) cands.push(vals[vals.length - 1])
    }
  })
  if (cands.length) return Math.max(...cands)
  // Sin "TOTAL": el mayor monto con centavos
  const all = lines.flatMap(l => (l.match(/\d[\d.,]*[.,]\d{2}\b/g) || []).map(toNumber)).filter(n => n > 0 && n < 1e7)
  return all.length ? Math.max(...all) : null
}

function findDate(text) {
  const now = today()
  const valid = (y, m, d) => {
    if (y < 100) y += 2000
    const dt = new Date(y, m, d)
    if (dt.getFullYear() !== y || dt.getMonth() !== m || dt.getDate() !== d) return null
    if (dt - now > 2 * 864e5 || now - dt > 3 * 365 * 864e5) return null
    return dt
  }
  let m
  const re1 = /\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/g
  while ((m = re1.exec(text))) { const d = valid(+m[1], +m[2] - 1, +m[3]); if (d) return d }
  const re2 = /\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})\b/g
  while ((m = re2.exec(text))) { const d = valid(+m[3], +m[2] - 1, +m[1]); if (d) return d } // día/mes/año
  const re3 = /\b(\d{1,2})[\s-/]*([a-z]{3})[a-z]*\.?[\s-/,]*(\d{2}|\d{4})\b/g
  const n = strip(text)
  while ((m = re3.exec(n))) { const mo = MONTHS[m[2]]; if (mo != null) { const d = valid(+m[3], mo, +m[1]); if (d) return d } }
  return null
}

const SKIP_NAME_RE = /\b(ticket|folio|rfc|factura|sucursal|tel|telefono|fecha|hora|caja|cajero|gracias|www|http|direccion|col\.?|calle|av\.?|avenida|cp|c\.p|regimen|cliente|venta|nota|receipt|invoice|order|store)\b/

function findName(lines) {
  for (const line of lines.slice(0, 6)) {
    const clean = line.replace(/[^\p{L}\p{N}&' .-]/gu, ' ').replace(/\s+/g, ' ').trim()
    const letters = (clean.match(/\p{L}/gu) || []).length
    if (letters < 3 || letters < clean.length * 0.5) continue
    if (SKIP_NAME_RE.test(strip(clean))) continue
    const out = clean.length > 40 ? clean.slice(0, 40).trim() : clean
    return out === out.toUpperCase() ? out.toLowerCase().replace(/(^|\s)\p{L}/gu, (c) => c.toUpperCase()) : out
  }
  return ''
}

export function parseTicketText(rawText, { customCategories = [] } = {}) {
  const text = (rawText || '').trim()
  if (!text) return null
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  const date = findDate(text)
  const category = guessCategory(strip(text), customCategories)
  const validCat = category && (CATEGORIES.includes(category) || customCategories.some(c => (typeof c === 'string' ? c : c?.value) === category))
  return {
    amount: findAmount(lines),
    name: findName(lines),
    date: date ? dateToStr(date) : null,
    category: validCat ? category : null,
  }
}
