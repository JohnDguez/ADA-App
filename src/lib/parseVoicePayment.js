import { CATEGORIES, dateToStr, today, addDays } from './utils'

// Convierte lo que el usuario DICTÓ ("gasté 250 en el súper ayer") en los
// campos de un pago único: monto, nombre, fecha, categoría y si ya se pagó.
// Función pura (sin red ni IA): reglas simples para es/en. Siempre se revisa
// en el formulario antes de guardar, así que ante la duda deja el campo vacío
// o con el valor por defecto en vez de adivinar.

const strip = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

const MONTHS = {
  enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5, julio: 6, agosto: 7, septiembre: 8, setiembre: 8, octubre: 9, noviembre: 10, diciembre: 11,
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5, july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
}
const WEEKDAYS = {
  domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6,
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
}

// Palabras-número en español (Android casi siempre devuelve dígitos, esto es
// el respaldo para "doscientos cincuenta").
const UNITS = { cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19, veinte: 20, veintiuno: 21, veintiun: 21, veintidos: 22, veintitres: 23, veinticuatro: 24, veinticinco: 25, veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29 }
const TENS = { treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90 }
const HUNDREDS = { cien: 100, ciento: 100, doscientos: 200, trescientos: 300, cuatrocientos: 400, quinientos: 500, seiscientos: 600, setecientos: 700, ochocientos: 800, novecientos: 900 }

function wordsToNumber(words) {
  let total = 0, current = 0, any = false
  for (const w of words) {
    if (w === 'y') continue
    if (w in UNITS) { current += UNITS[w]; any = true }
    else if (w in TENS) { current += TENS[w]; any = true }
    else if (w in HUNDREDS) { current += HUNDREDS[w]; any = true }
    else if (w === 'mil') { total += (current || 1) * 1000; current = 0; any = true }
    else return null
  }
  return any ? total + current : null
}

// "250", "1,250.50", "1250", "$250"
function findDigitAmount(text) {
  const re = /\$?\s?(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:[.,]\d+)?)/g
  const found = []
  let m
  while ((m = re.exec(text))) {
    const raw = m[1]
    const value = parseFloat(raw.includes(',') && /,\d{3}/.test(raw) ? raw.replace(/,/g, '') : raw.replace(',', '.'))
    if (!isNaN(value) && value > 0) found.push({ value, start: m.index, end: m.index + m[0].length, hint: /\$/.test(m[0]) })
  }
  if (!found.length) return null
  // Prefiere el que trae "$" o el que va pegado a "pesos"/"dolares".
  const withHint = found.find(f => f.hint || /^\s*(pesos|mxn|dolares|usd|bucks|dollars)/.test(text.slice(f.end)))
  return withHint || found[0]
}

function findWordAmount(norm) {
  const tokens = norm.split(/\s+/)
  let best = null
  for (let i = 0; i < tokens.length; i++) {
    for (let j = tokens.length; j > i; j--) {
      const slice = tokens.slice(i, j)
      const n = wordsToNumber(slice)
      if (n != null && n > 0 && (!best || slice.length > best.len)) best = { value: n, i, len: slice.length }
    }
  }
  return best
}

const KEYWORDS = [
  ['Alimentación', ['super', 'supermercado', 'despensa', 'comida', 'restaurante', 'tacos', 'taco', 'cafe', 'cafeteria', 'desayuno', 'cena', 'almuerzo', 'pizza', 'hamburguesa', 'uber eats', 'rappi', 'didi food', 'walmart', 'soriana', 'oxxo', 'costco', 'groceries', 'grocery', 'restaurant', 'lunch', 'dinner', 'breakfast', 'coffee']],
  ['Transporte', ['gasolina', 'gas del carro', 'uber', 'didi', 'taxi', 'camion', 'autobus', 'estacionamiento', 'caseta', 'pasaje', 'metro', 'parking', 'fuel', 'gas station', 'bus', 'toll']],
  ['Suscripciones', ['netflix', 'spotify', 'disney', 'hbo', 'max', 'amazon prime', 'prime video', 'youtube', 'icloud', 'suscripcion', 'subscription', 'apple music', 'chatgpt']],
  ['Servicios', ['luz', 'agua', 'gas', 'internet', 'telefono', 'celular', 'cfe', 'telmex', 'izzi', 'totalplay', 'electricity', 'water', 'phone', 'utilities']],
  ['Renta', ['renta', 'alquiler', 'rent']],
  ['Seguros', ['seguro', 'insurance']],
  ['Medicina', ['farmacia', 'medicina', 'medicamento', 'pastillas', 'pharmacy', 'medicine']],
  ['Doctor', ['doctor', 'dentista', 'consulta', 'medico', 'hospital', 'dentist']],
  ['Mantenimiento', ['mecanico', 'reparacion', 'plomero', 'mantenimiento', 'taller', 'repair', 'maintenance']],
  ['Créditos', ['tarjeta', 'credito', 'prestamo', 'abono', 'hipoteca', 'loan', 'credit card', 'mortgage']],
  ['Ahorro', ['ahorro', 'savings']],
]

function guessCategory(norm, customCategories) {
  for (const c of customCategories || []) {
    const v = typeof c === 'string' ? c : c?.value
    if (v && norm.includes(strip(v))) return v
  }
  for (const [cat, words] of KEYWORDS) {
    for (const w of words) {
      if (new RegExp(`(^|\\s)${w}(\\s|$)`).test(norm)) return cat
    }
  }
  return null
}

const FUTURE_MARKERS = /\b(tengo que|voy a|debo|vence|vencera|hay que|tengo pendiente|manana|due|will|going to|have to|tomorrow)\b/

// Quita el fragmento [start,end) del texto y devuelve el resto
const cut = (s, start, end) => (s.slice(0, start) + ' ' + s.slice(end))

export function parseVoicePayment(rawText, { customCategories = [] } = {}) {
  const original = (rawText || '').trim()
  if (!original) return null
  let text = ' ' + original.replace(/\s+/g, ' ') + ' '
  let norm = strip(text)

  // --- Fecha ---
  const now = today()
  let date = null
  const take = (re, fn) => {
    const m = norm.match(re)
    if (!m) return false
    const d = fn(m)
    if (!d) return false
    date = d
    text = cut(text, m.index, m.index + m[0].length)
    norm = strip(text)
    return true
  }
  take(/\b(antier|anteayer|day before yesterday)\b/, () => addDays(now, -2))
    || take(/\b(ayer|yesterday)\b/, () => addDays(now, -1))
    || take(/\bhace (\d{1,2}) (dias?|days?)\b/, (m) => addDays(now, -parseInt(m[1])))
    || take(/\b(hoy|today)\b/, () => now)
    || take(/\b(manana|tomorrow)\b/, () => addDays(now, 1))
    || take(/\b(?:el |on )?(\d{1,2})(?: de| of)? (enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre|january|february|march|april|may|june|july|august|september|october|november|december)\b/, (m) => {
      const day = parseInt(m[1]); const month = MONTHS[m[2]]
      if (day < 1 || day > 31) return null
      let d = new Date(now.getFullYear(), month, day)
      if (d - now > 30 * 864e5) d = new Date(now.getFullYear() - 1, month, day) // "el 20 de diciembre" dicho en enero = el año pasado
      return d
    })
    || take(/\b(?:el |on |last |este |el pasado )?(domingo|lunes|martes|miercoles|jueves|viernes|sabado|sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/, (m) => {
      const target = WEEKDAYS[m[1]]
      const diff = (now.getDay() - target + 7) % 7
      return addDays(now, -diff) // el más reciente (hoy cuenta)
    })

  // --- Monto ---
  let amount = null
  const digits = findDigitAmount(text)
  if (digits) {
    amount = digits.value
    text = cut(text, digits.start, digits.end)
  } else {
    const words = findWordAmount(norm.trim())
    if (words) {
      amount = words.value
      const toks = text.trim().split(/\s+/)
      toks.splice(words.i, words.len)
      text = ' ' + toks.join(' ') + ' '
    }
  }
  norm = strip(text)

  // --- ¿Ya se pagó? ---
  const future = FUTURE_MARKERS.test(norm) || (date && date > now)
  const paid = !future

  // --- Nombre: lo que sobra sin verbos, preposiciones ni "pesos" ---
  const noise = new Set(['gaste', 'gastamos', 'pague', 'pagamos', 'compre', 'compramos', 'pagado', 'pagar', 'spent', 'paid', 'bought', 'pay', 'ya', 'pesos', 'peso', 'mxn', 'dolares', 'dolar', 'usd', 'dollars', 'dollar', 'bucks', 'de', 'del', 'en', 'por', 'para', 'a', 'al', 'el', 'la', 'los', 'las', 'un', 'una', 'mi', 'mis', 'in', 'on', 'for', 'the', 'an', 'my', 'of', 'to', 'at', 'tengo', 'que', 'voy', 'debo', 'vence', 'con', 'me', 'cobraron', 'costo', 'cost', 'was', 'were', 'fue', 'son', 'es'])
  const nameTokens = []
  for (const tok of text.replace(/\$/g, ' ').trim().split(/\s+/)) {
    const clean = tok.replace(/[.,;:!?]/g, '')
    if (!clean || noise.has(strip(clean))) continue
    nameTokens.push(clean)
  }
  let name = nameTokens.join(' ').trim()
  if (name) name = name.charAt(0).toUpperCase() + name.slice(1)

  const category = guessCategory(strip(original), customCategories)

  return {
    amount,
    name,
    date: date ? dateToStr(date) : null,
    category: category && (CATEGORIES.includes(category) || customCategories.some(c => (typeof c === 'string' ? c : c?.value) === category)) ? category : null,
    paid,
  }
}
