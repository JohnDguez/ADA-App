// Avisos de tarjetas de crédito para el cron (v0.9.740): corte, recordatorio
// previo al vencimiento y vencimiento. Funciones puras sobre fechas
// 'YYYY-MM-DD' (Regla 11: nunca toISOString); las consultas las hace
// send-notifications.js. Espejo de la lógica de src/lib/cardStatements.js
// (`nextOccurrenceAfter`): el día de corte/límite que no existe en un mes
// corto cae en el último día de ese mes, y el vencimiento es la primera
// ocurrencia del día límite DESPUÉS del corte.
//
// Prefijo `_`: no cuenta contra las 12 funciones de Vercel Hobby.

// Nombres de banco por id (copia de src/lib/cardCatalog.js; la prueba
// tests/card-alerts.test.js verifica que no falte ninguno).
const BANK_NAMES = {
  bbva: 'BBVA',
  santander: 'Santander',
  banorte: 'Banorte',
  banamex: 'Banamex',
  hsbc: 'HSBC',
  scotiabank: 'Scotiabank',
  inbursa: 'Inbursa',
  azteca: 'Banco Azteca',
  bancoppel: 'BanCoppel',
  banregio: 'Banregio',
  banbajio: 'BanBajío',
  afirme: 'Afirme',
  multiva: 'Multiva',
  mifel: 'Mifel',
  bienestar: 'Banco del Bienestar',
  invex: 'Invex',
  monex: 'Monex',
  intercam: 'Intercam',
  nu: 'Nu',
  hey: 'Hey Banco',
  mercadopago: 'Mercado Pago',
  spin: 'Spin by OXXO',
  klar: 'Klar',
  stori: 'Stori',
  openbank: 'Openbank',
  uala: 'Ualá',
  plata: 'Plata',
  albo: 'Albo',
  vexi: 'Vexi',
  rappicard: 'RappiCard',
  bankaool: 'Bankaool',
  liverpool: 'Liverpool',
  palacio: 'Palacio de Hierro',
  sears: 'Sears',
  suburbia: 'Suburbia',
  coppel: 'Coppel',
  otro: 'Otro banco',
}

const pad = n => String(n).padStart(2, '0')
const strOf = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`
const parts = s => { const [y, m, d] = s.split('-').map(Number); return { y, m: m - 1, d } }
const lastDayOf = (y, m) => new Date(y, m + 1, 0).getDate()
const clamp = (y, m, day) => Math.min(day, lastDayOf(y, m))

function addDays(dateStr, n) {
  const { y, m, d } = parts(dateStr)
  const dt = new Date(y, m, d + n)
  return strOf(dt.getFullYear(), dt.getMonth(), dt.getDate())
}

// Corte más reciente que ya ocurrió (hoy incluido).
function lastCutOnOrBefore(cutDay, todayStr) {
  const { y, m } = parts(todayStr)
  const thisMonth = strOf(y, m, clamp(y, m, cutDay))
  if (thisMonth <= todayStr) return thisMonth
  const py = m === 0 ? y - 1 : y, pm = m === 0 ? 11 : m - 1
  return strOf(py, pm, clamp(py, pm, cutDay))
}

// Primera ocurrencia de `day` estrictamente posterior a `afterStr`.
function nextDayAfter(day, afterStr) {
  let { y, m } = parts(afterStr)
  for (let k = 0; k < 3; k++) {
    const s = strOf(y, m, clamp(y, m, day))
    if (s > afterStr) return s
    m++; if (m > 11) { m = 0; y++ }
  }
  return null
}

function cardName(card, lang) {
  if (card.alias) return card.alias
  if (card.bank && card.bank !== 'otro' && BANK_NAMES[card.bank]) return BANK_NAMES[card.bank]
  return lang === 'en' ? 'Credit card' : 'Tarjeta de crédito'
}

// -> [{ card, type: 'card_cut' | 'card_reminder' | 'card_due', cutDate, dueDate }]
function cardAlerts(cards, todayStr, daysBefore) {
  const out = []
  for (const card of cards || []) {
    if (card.kind !== 'credit' || !card.cut_day) continue
    const cutDate = lastCutOnOrBefore(card.cut_day, todayStr)
    const dueDate = card.due_day ? nextDayAfter(card.due_day, cutDate) : null
    if (cutDate === todayStr) out.push({ card, type: 'card_cut', cutDate, dueDate })
    if (!dueDate) continue
    if (dueDate === todayStr) out.push({ card, type: 'card_due', cutDate, dueDate })
    else if (daysBefore >= 1 && dueDate === addDays(todayStr, daysBefore)) out.push({ card, type: 'card_reminder', cutDate, dueDate })
  }
  return out
}

module.exports = { cardAlerts, cardName, addDays, BANK_NAMES }
