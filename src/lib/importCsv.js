// Importar movimientos desde un CSV (v0.9.802) — gratis para todos.
// Todo se procesa en el dispositivo: el archivo nunca sale de él. Sin librería
// externa (Regla 41): un CSV bancario solo necesita comillas, delimitador y
// saltos de línea; lo difícil es ENTENDER el archivo (codificación, columnas,
// formato de fecha, signo de los montos), y eso vive aquí.
//
// Flujo: decodeCsvBuffer → parseCsv → detectHeaderRow / guessMapping →
// buildImportRows (fechas, montos, categoría, estado) → detectRecurring.

import { guessCategory } from './parseVoicePayment'
import { CATEGORIES } from './utils'
import { dateToStr, dateOf, today, nextPeriodDate } from './utils'
import en from '../i18n/en.json'

// ── Utilidades de texto ────────────────────────────────────────────────────
export function strip(s) {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

// Concepto normalizado para comparar/agrupar: sin acentos, sin dígitos ni
// símbolos sueltos (folios, terminaciones de tarjeta), espacios colapsados.
export function normalizeConcept(s) {
  return strip(s).replace(/[0-9#*_.\-/\\:;,()]+/g, ' ').replace(/\s+/g, ' ').trim()
}

// ── Codificación ───────────────────────────────────────────────────────────
// UTF-8 primero (con BOM o sin él); si el archivo no es UTF-8 válido (típico
// de Excel en Windows: Windows-1252/Latin-1) se vuelve a leer así.
export function decodeCsvBuffer(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  let text
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    text = new TextDecoder('windows-1252').decode(bytes)
  }
  return text.replace(/^\uFEFF/, '')
}

// ── Delimitador ────────────────────────────────────────────────────────────
const DELIMITERS = [',', ';', '\t', '|']

function countOutsideQuotes(line, ch) {
  let inQ = false, n = 0
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') inQ = !inQ
    else if (c === ch && !inQ) n++
  }
  return n
}

export function detectDelimiter(text) {
  const lines = text.split(/\r\n|\n|\r/).filter(l => l.trim()).slice(0, 15)
  if (!lines.length) return ','
  let best = ',', bestScore = -1
  for (const d of DELIMITERS) {
    const counts = lines.map(l => countOutsideQuotes(l, d))
    const max = Math.max(...counts)
    if (max === 0) continue
    // Un delimitador real aparece el mismo número de veces en casi todas las
    // líneas (excepto el preámbulo); premia la constancia y la cantidad.
    const mode = counts.sort((a, b) => a - b)[Math.floor(counts.length / 2)]
    const consistent = counts.filter(c => c === mode).length / counts.length
    const score = mode * consistent
    if (score > bestScore) { bestScore = score; best = d }
  }
  return best
}

// ── Lectura de filas (RFC 4180: comillas dobles, saltos dentro de comillas) ─
export function parseCsv(text, delimiter = ',') {
  const rows = []
  let row = [], cell = '', inQ = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++ } else inQ = false
      } else cell += c
    } else if (c === '"') {
      inQ = true
    } else if (c === delimiter) {
      row.push(cell); cell = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(cell); cell = ''
      rows.push(row); row = []
    } else cell += c
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row) }
  // Quita filas totalmente vacías (líneas en blanco, ";;;;" de Excel).
  return rows.filter(r => r.some(v => String(v).trim() !== ''))
}

// ── Columnas ───────────────────────────────────────────────────────────────
// Sinónimos ya normalizados (sin acentos, minúsculas). Español e inglés, los
// nombres que usan bancos de México y las apps de finanzas más comunes.
const SYN = {
  date: ['fecha', 'fecha de operacion', 'fecha operacion', 'fecha de pago', 'fecha valor', 'fecha de movimiento', 'fecha de transaccion', 'date', 'transaction date', 'posted date', 'post date', 'booking date', 'dia'],
  concept: ['concepto', 'concept', 'descripcion', 'detalle', 'descripcion del movimiento', 'movimiento', 'comercio', 'establecimiento', 'beneficiario', 'nombre', 'name', 'description', 'merchant', 'payee', 'memo', 'note', 'notas', 'nota'],
  amount: ['monto', 'importe', 'cantidad', 'amount', 'total', 'valor', 'value'],
  debit: ['cargo', 'cargos', 'retiro', 'retiros', 'debito', 'debitos', 'debit', 'withdrawal', 'withdrawals', 'gasto', 'gastos'],
  credit: ['abono', 'abonos', 'deposito', 'depositos', 'credito', 'creditos', 'credit', 'deposit', 'deposits', 'ingreso', 'ingresos'],
  category: ['categoria', 'category', 'rubro'],
}
// Solo coincidencia exacta (evita confundir "Tipo de monto" con "Tipo").
const EXACT = {
  type: ['tipo de registro', 'record type', 'tipo', 'type'],
  paid: ['pagado', 'paid', 'estatus', 'status', 'estado'],
}

function hasWord(h, term) {
  return h === term || new RegExp(`(^|\\s)${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`).test(h)
}

// → { date, concept, amount, debit, credit, category, type, paid } con índice
// de columna o -1. Primero coincidencia exacta, luego "contiene la palabra".
export function guessMapping(headers) {
  const hs = headers.map(strip)
  const used = new Set()
  const out = { date: -1, concept: -1, amount: -1, debit: -1, credit: -1, category: -1, type: -1, paid: -1 }
  const take = (key, test) => {
    const i = hs.findIndex((h, idx) => !used.has(idx) && test(h))
    if (i >= 0) { out[key] = i; used.add(i) }
  }
  for (const key of ['type', 'paid']) take(key, h => EXACT[key].includes(h))
  for (const key of ['date', 'concept', 'amount', 'debit', 'credit', 'category']) {
    take(key, h => SYN[key].includes(h))
  }
  for (const key of ['date', 'concept', 'amount', 'debit', 'credit', 'category']) {
    if (out[key] === -1) take(key, h => SYN[key].some(s => hasWord(h, s)))
  }
  return out
}

// ¿Es el CSV que exporta LunaPay? (Fecha, Tipo de registro, Concepto,
// Categoría, Monto, Pagado…) — se importa sin pedir mapeo.
export function isOwnExport(headers) {
  const m = guessMapping(headers)
  const hs = headers.map(strip)
  const hasRecordType = hs.includes('tipo de registro') || hs.includes('record type')
  return hasRecordType && m.date >= 0 && m.concept >= 0 && m.amount >= 0 && m.category >= 0 && m.paid >= 0
}

// Firma estable de las cabeceras: sirve para recordar el mapeo que el usuario
// confirmó la última vez con un archivo del mismo banco/app.
export function headerSignature(headers) {
  return headers.map(strip).join('|')
}

// Busca la fila de cabecera entre las primeras 20 (los bancos suelen poner un
// preámbulo con nombre de cuenta, periodo, etc.). -1 = el archivo no la trae.
export function detectHeaderRow(rows) {
  let best = -1, bestScore = 1
  const limit = Math.min(rows.length, 20)
  for (let i = 0; i < limit; i++) {
    const m = guessMapping(rows[i])
    const score = Object.values(m).filter(v => v >= 0).length
    if (score > bestScore && (m.date >= 0 || m.concept >= 0) && (m.amount >= 0 || m.debit >= 0 || m.credit >= 0)) {
      best = i; bestScore = score
    }
  }
  if (best >= 0) return best
  // Sin sinónimos conocidos: si la primera fila no parece dato (ninguna celda
  // con fecha ni monto), se toma como cabecera.
  const first = rows[0] || []
  const looksData = first.some(c => parseAmount(c) !== null || /\d{1,4}[/\-.]\d{1,2}[/\-.]\d{1,4}/.test(c))
  return looksData ? -1 : 0
}

// ── Fechas ─────────────────────────────────────────────────────────────────
const MONTH_NAMES = {
  ene: 1, enero: 1, jan: 1, january: 1, feb: 2, febrero: 2, february: 2, mar: 3, marzo: 3, march: 3,
  abr: 4, abril: 4, apr: 4, april: 4, may: 5, mayo: 5, jun: 6, junio: 6, june: 6, jul: 7, julio: 7, july: 7,
  ago: 8, agosto: 8, aug: 8, august: 8, sep: 9, sept: 9, septiembre: 9, setiembre: 9, september: 9,
  oct: 10, octubre: 10, october: 10, nov: 11, noviembre: 11, november: 11, dic: 12, diciembre: 12, dec: 12, december: 12,
}

function validYMD(y, m, d) {
  if (!(y >= 1900 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31)) return null
  const dt = new Date(y, m - 1, d)
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null
  return dateToStr(dt)
}

function fullYear(y) {
  if (y >= 100) return y
  return y < 70 ? 2000 + y : 1900 + y
}

// Parte una fecha numérica en [a, b, c] (+ si el primero es el año).
function numericParts(str) {
  const s = String(str ?? '').trim().replace(/[T\s].*$/, '') // descarta la hora
  const m = s.match(/^(\d{1,4})[/\-.](\d{1,2})[/\-.](\d{1,4})$/)
  if (!m) return null
  return { a: Number(m[1]), b: Number(m[2]), c: Number(m[3]), yearFirst: m[1].length === 4 }
}

// Fecha con el mes escrito: "15 ene 2026", "15 de enero de 2026", "Jan 15, 2026".
function parseNamedMonth(str) {
  const s = strip(str).replace(/,/g, ' ').replace(/\bde\b/g, ' ').replace(/\s+/g, ' ').trim()
  let m = s.match(/^(\d{1,2})[ \-/.]([a-z]+)\.?[ \-/.](\d{2,4})/)
  if (m && MONTH_NAMES[m[2]]) return validYMD(fullYear(Number(m[3])), MONTH_NAMES[m[2]], Number(m[1]))
  m = s.match(/^([a-z]+)\.?[ \-/.](\d{1,2})[ \-/.](\d{2,4})/)
  if (m && MONTH_NAMES[m[1]]) return validYMD(fullYear(Number(m[3])), MONTH_NAMES[m[1]], Number(m[2]))
  return null
}

// Infiere el orden de la fecha mirando TODO el archivo: basta una fecha con
// día > 12 para saber cuál posición es el día. Sin esa pista (todas ≤ 12) se
// asume DD/MM (México) y se marca `ambiguous` para avisar al usuario.
export function detectDateFormat(samples) {
  let dmy = 0, mdy = 0, ymd = 0, numeric = 0
  for (const s of samples) {
    const p = numericParts(s)
    if (!p) continue
    numeric++
    if (p.yearFirst) { ymd++; continue }
    if (p.a > 12 && p.b <= 12) dmy++
    else if (p.b > 12 && p.a <= 12) mdy++
  }
  if (!numeric) return { format: 'DMY', ambiguous: false }
  if (ymd && ymd >= numeric / 2) return { format: 'YMD', ambiguous: false }
  if (dmy && !mdy) return { format: 'DMY', ambiguous: false }
  if (mdy && !dmy) return { format: 'MDY', ambiguous: false }
  if (dmy && mdy) return { format: 'DMY', ambiguous: true }
  return { format: 'DMY', ambiguous: true }
}

// → 'YYYY-MM-DD' (local, Regla 22) o null si no es una fecha válida.
export function parseDate(str, format = 'DMY') {
  const raw = String(str ?? '').trim()
  if (!raw) return null
  const named = parseNamedMonth(raw)
  if (named) return named
  const p = numericParts(raw)
  if (!p) return null
  if (p.yearFirst) return validYMD(p.a, p.b, p.c)
  if (format === 'MDY') return validYMD(fullYear(p.c), p.a, p.b)
  return validYMD(fullYear(p.c), p.b, p.a)
}

// ── Montos ─────────────────────────────────────────────────────────────────
// "$1,234.56", "1.234,56", "(500.00)", "-$75", "75-", "MXN 1 234,50".
export function parseAmount(str) {
  let s = String(str ?? '').trim()
  if (!s) return null
  let neg = false
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1) }
  s = s.replace(/[−–]/g, '-')
  if (/-\s*$/.test(s)) { neg = !neg; s = s.replace(/-\s*$/, '') }
  if (/^\s*-/.test(s)) { neg = !neg; s = s.replace(/^\s*-/, '') }
  s = s.replace(/[A-Za-z$€£¥\s\u00A0]/g, '')
  if (!s || !/^[0-9.,]+$/.test(s) || !/[0-9]/.test(s)) return null
  const lastDot = s.lastIndexOf('.'), lastComma = s.lastIndexOf(',')
  let normalized
  if (lastDot >= 0 && lastComma >= 0) {
    // Ambos: el que aparece al final es el decimal.
    normalized = lastDot > lastComma
      ? s.replace(/,/g, '')
      : s.replace(/\./g, '').replace(',', '.')
  } else if (lastComma >= 0) {
    const parts = s.split(',')
    const tail = parts[parts.length - 1]
    // "1,234" o "1,234,567" son miles; "12,5" / "12,50" son decimales.
    normalized = (parts.length > 2 || tail.length === 3) ? parts.join('') : s.replace(',', '.')
  } else if (lastDot >= 0) {
    const parts = s.split('.')
    // Varios puntos = miles ("1.234.567"); uno solo = decimal.
    normalized = parts.length > 2 ? parts.join('') : s
  } else normalized = s
  const n = Number(normalized)
  if (!Number.isFinite(n)) return null
  return (neg ? -1 : 1) * Math.round(n * 100) / 100
}

// ── Categorías ─────────────────────────────────────────────────────────────
// El CSV de LunaPay trae la categoría con el nombre del idioma de quien
// exportó; aquí se regresa al valor canónico (siempre en español).
const CATEGORY_BY_LABEL = (() => {
  const m = new Map()
  for (const c of CATEGORIES) m.set(strip(c), c)
  const keys = { servicios: 'Servicios', suscripciones: 'Suscripciones', creditos: 'Créditos', renta: 'Renta', seguros: 'Seguros', alimentacion: 'Alimentación', transporte: 'Transporte', medicina: 'Medicina', doctor: 'Doctor', mantenimiento: 'Mantenimiento', ahorro: 'Ahorro', otros: 'Otros' }
  for (const [k, canonical] of Object.entries(keys)) {
    const label = en?.categories?.[k]
    if (label) m.set(strip(label), canonical)
  }
  return m
})()

export function resolveCategory(label, customCategories = []) {
  const key = strip(label)
  if (!key) return null
  for (const c of customCategories) {
    const v = typeof c === 'string' ? c : c?.value
    if (v && strip(v) === key) return v
  }
  return CATEGORY_BY_LABEL.get(key) || null
}

// ── Filas listas para revisar ──────────────────────────────────────────────
const YES = new Set(['si', 'yes', 'true', '1', 'pagado', 'paid'])
const EXPENSE = new Set(['gasto', 'expense', 'egreso', 'cargo'])

// Clave para detectar duplicados contra lo que YA existe en la cuenta.
export function duplicateKey(date, concept, amount) {
  return `${date}|${normalizeConcept(concept)}|${Math.round(Math.abs(Number(amount)) * 100)}`
}

// Decide el signo de los gastos: si el archivo trae montos negativos, los
// gastos son los negativos (y los positivos, ingresos/abonos); si todo es
// positivo, todo es gasto.
export function guessNegativeIsExpense(table, mapping) {
  if (mapping.amount < 0) return false
  return table.some(r => (parseAmount(r[mapping.amount]) ?? 0) < 0)
}

/**
 * @param {string[][]} table       filas de datos (sin cabecera)
 * @param {object} mapping         índices de columna (ver guessMapping)
 * @param {object} opts
 *   dateFormat 'DMY'|'MDY'|'YMD'; negativeIsExpense bool;
 *   customCategories []; existing [{ date, name, amount }]; firstLine número
 *   de línea de la primera fila de datos (para mostrar al usuario).
 * @returns {{ rows: object[], skipped: { income: number, unpaid: number } }}
 */
export function buildImportRows(table, mapping, opts = {}) {
  const {
    dateFormat = 'DMY', negativeIsExpense = false, customCategories = [],
    existing = [], firstLine = 2,
  } = opts
  const existingKeys = new Set(existing.map(e => duplicateKey(e.date, e.name, e.amount)))
  const rows = []
  const skipped = { income: 0, unpaid: 0 }
  const cell = (r, i) => (i >= 0 ? String(r[i] ?? '').trim() : '')

  table.forEach((r, idx) => {
    const line = firstLine + idx

    // CSV propio: solo gastos pagados (los ingresos y lo pendiente no entran).
    if (mapping.type >= 0) {
      const t = strip(cell(r, mapping.type))
      if (t && !EXPENSE.has(t)) { skipped.income++; return }
    }
    if (mapping.paid >= 0) {
      const p = strip(cell(r, mapping.paid))
      if (p && !YES.has(p)) { skipped.unpaid++; return }
    }

    // Monto: una columna con signo, o dos (cargo/abono).
    let signed = null
    if (mapping.debit >= 0 || mapping.credit >= 0) {
      const d = parseAmount(cell(r, mapping.debit))
      const c = parseAmount(cell(r, mapping.credit))
      if (d !== null && d !== 0) signed = -Math.abs(d)
      else if (c !== null && c !== 0) signed = Math.abs(c)
      else if (cell(r, mapping.debit) || cell(r, mapping.credit)) signed = 0
      if (signed === null && mapping.amount >= 0) signed = parseAmount(cell(r, mapping.amount))
      // Con columnas separadas el signo ya está resuelto.
      if (signed !== null && signed > 0) { skipped.income++; return }
      signed = signed === null ? null : Math.abs(signed)
    } else {
      signed = parseAmount(cell(r, mapping.amount))
      if (signed !== null) {
        if (negativeIsExpense) {
          if (signed > 0) { skipped.income++; return }
          signed = Math.abs(signed)
        } else signed = Math.abs(signed)
      }
    }

    const date = parseDate(cell(r, mapping.date), dateFormat)
    const concept = cell(r, mapping.concept).replace(/\s+/g, ' ')
    const reasons = []
    if (!date) reasons.push('badDate')
    if (signed === null || signed === 0) reasons.push('badAmount')

    // Categoría: la del archivo si la reconocemos; si no, se adivina por el concepto.
    let category = resolveCategory(cell(r, mapping.category), customCategories)
    let categorySource = category ? 'file' : null
    if (!category && concept) {
      category = guessCategory(normalizeConcept(concept), customCategories)
      categorySource = category ? 'guess' : null
    }

    let status = 'ok'
    if (reasons.length) status = 'err'
    else {
      if (existingKeys.has(duplicateKey(date, concept, signed))) reasons.push('duplicate')
      if (!category) reasons.push('uncategorized')
      if (reasons.length) status = 'rev'
    }

    rows.push({
      id: idx, line, date, concept: concept || '', amount: signed || 0,
      category, categorySource, status, reasons,
    })
  })
  return { rows, skipped }
}

// ── Pagos que se repiten (etapa 2) ─────────────────────────────────────────
// Mismo concepto + intervalo regular (≈7/14/30 días) → sugerencia de
// recurrente: fijo si el monto no cambia, variable si cambia. Lo irregular
// (Oxxo, Uber) nunca se sugiere.
const FREQS = [
  { freq: 'weekly',   days: 7,  tol: 1 },
  { freq: 'biweekly', days: 14, tol: 2 },
  { freq: 'monthly',  days: 30, tol: 3 },
]
const MIN_OCCURRENCES = 3

function median(nums) {
  const a = [...nums].sort((x, y) => x - y)
  const m = Math.floor(a.length / 2)
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2
}

export function detectRecurring(rows) {
  const groups = new Map()
  for (const r of rows) {
    if (r.status === 'err' || !r.date) continue
    const key = normalizeConcept(r.concept)
    if (!key) continue
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(r)
  }
  const out = []
  const t0 = today()
  for (const [key, items] of groups) {
    if (items.length < MIN_OCCURRENCES) continue
    const sorted = [...items].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    const gaps = []
    for (let i = 1; i < sorted.length; i++) {
      gaps.push(Math.round((dateOf(sorted[i].date) - dateOf(sorted[i - 1].date)) / 864e5))
    }
    const med = median(gaps)
    const f = FREQS.find(x => Math.abs(med - x.days) <= x.tol)
    if (!f) continue
    const regular = gaps.filter(g => Math.abs(g - f.days) <= f.tol + 1).length / gaps.length
    if (regular < 0.7) continue

    const amounts = sorted.map(i => i.amount)
    const isVariable = Math.max(...amounts) - Math.min(...amounts) > 0.009
    const avg = Math.round((amounts.reduce((s, n) => s + n, 0) / amounts.length) * 100) / 100
    const last = sorted[sorted.length - 1]

    // Siguiente cobro: a partir del último, hacia adelante hasta hoy o después.
    let next = nextPeriodDate(last.date, f.freq)
    let guard = 0
    while (next < t0 && guard++ < 400) next = nextPeriodDate(dateToStr(next), f.freq)
    // Si el último movimiento es de hace más de 2 periodos, ya no se repite.
    const cutoff = nextPeriodDate(dateToStr(nextPeriodDate(last.date, f.freq)), f.freq)
    if (cutoff < t0) continue

    out.push({
      key, name: sorted[sorted.length - 1].concept, freq: f.freq, isVariable,
      amount: isVariable ? avg : last.amount, count: sorted.length,
      category: last.category, ids: sorted.map(i => i.id),
      lastDate: last.date, nextDate: dateToStr(next),
    })
  }
  return out.sort((a, b) => b.count - a.count)
}

// Agrupa los ids por concepto (para "Por concepto" y para marcar "Se repite").
export function groupByConcept(rows) {
  const m = new Map()
  for (const r of rows) {
    const key = normalizeConcept(r.concept) || strip(r.concept) || '—'
    if (!m.has(key)) m.set(key, { key, label: r.concept || '—', rows: [] })
    m.get(key).rows.push(r)
  }
  return [...m.values()].sort((a, b) => b.rows.length - a.rows.length)
}
