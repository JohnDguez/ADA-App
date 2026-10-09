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
// Encabezado de columnas de la lista de artículos ("P. UNIT  PROM  OFERTA  TOTAL"):
// contiene "total" pero NO es el total del ticket.
const COLUMN_HEADER_RE = /\b(p\.? ?unit|unit|prom|oferta|cant|descripcion|description|qty|precio|price|importe)\b/
const TENDERED_RE = /\b(efectivo|tarjeta|cash|card|recibido|pago con|su pago)\b/
const CHANGE_RE = /\b(cambio|change)\b/

const AMOUNT_ONLY_RE = /^[^\d\p{L}]*\d[\d.,]*\d?\s*[A-Za-z]?\s*$/u // línea que es solo un monto ("$1,653.16", "16.85 G")
const hasLetters = (l) => /\p{L}{2,}/u.test(l)
const isAmountOnly = (l) => AMOUNT_ONLY_RE.test(l.trim()) && money(l).length === 1

// Totales "etiquetados": "TOTAL 1,653.16" en la misma línea, o — cuando el OCR
// separa columnas en bloques ("TOTAL / EFECTIVO / CAMBIO" y luego "1653.16 /
// 1670.00 / 16.85") — el monto que ocupa la misma posición en el bloque de montos.
function labeledAmounts(lines) {
  const out = []
  lines.forEach((line, i) => {
    const n = strip(line)
    if (!TOTAL_RE.test(n) || NOT_TOTAL_RE.test(n) || COLUMN_HEADER_RE.test(n)) return
    const vals = money(line)
    if (vals.length) { out.push(vals[vals.length - 1]); return }
    // Monto en la línea siguiente SOLO si esa línea es únicamente un monto.
    if (lines[i + 1] && isAmountOnly(lines[i + 1])) { out.push(money(lines[i + 1])[0]); return }
    // Bloque de etiquetas → bloque de montos.
    let a = i
    while (a > 0 && hasLetters(lines[a - 1]) && !money(lines[a - 1]).length) a--
    let b = i
    while (b + 1 < lines.length && hasLetters(lines[b + 1]) && !money(lines[b + 1]).length) b++
    const labels = lines.slice(a, b + 1)
    const vs = []
    for (let k = b + 1; k < lines.length && isAmountOnly(lines[k]); k++) vs.push(money(lines[k])[0])
    // `$47.93` (IVA) suele quedar entre los dos bloques — se salta si hace falta.
    const pos = i - a
    if (vs.length >= labels.filter(l => !/^\W*\$/.test(l)).length && vs[pos] != null) out.push(vs[pos])
  })
  return out
}

// Conciliación: total = efectivo/pago − cambio (±5 centavos). Es la señal más
// fiable en tickets largos donde el OCR revuelve las columnas.
function reconciledAmount(lines) {
  const joined = strip(lines.join('\n'))
  if (!CHANGE_RE.test(joined) || !TENDERED_RE.test(joined)) return null
  const all = [...new Set(lines.flatMap(l => (l.match(/\d[\d.,]*[.,]\d{2}\b/g) || []).map(toNumber)).filter(n => n > 0 && n < 1e7))]
  let best = null
  for (const x of all) for (const y of all) {
    if (y >= x) continue
    const c = x - y
    if (all.some(v => v !== x && v !== y && Math.abs(v - c) <= 0.05) && (best == null || c > best)) best = Math.round(c * 100) / 100
  }
  if (best == null) return null
  // Devuelve el monto impreso más cercano (el que sí aparece en el ticket).
  return all.find(v => Math.abs(v - best) <= 0.05) ?? best
}

function findAmount(lines) {
  const cands = labeledAmounts(lines)
  const rec = reconciledAmount(lines)
  // La conciliación (efectivo − cambio) manda: si cuadra con un monto impreso,
  // es el total aunque el OCR haya revuelto las columnas.
  if (rec != null) return rec
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
