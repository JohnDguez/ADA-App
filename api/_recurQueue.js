// ── Copia en servidor de src/lib/recurQueue.js (v0.9.972) ──────────────────
// api/ es CommonJS y no puede importar el ESM del frontend, así que la lógica
// de la cola (horizonte = periodo actual + 2 siguientes, mínimo 2 pendientes,
// id determinista) se porta TAL CUAL. `tests/recur-queue.test.js` compara
// las dos: si se cambia algo aquí, cambiarlo igual en src/lib/recurQueue.js.
const { cobroPeriod } = require('./_cobroPeriod')
const { todayInTz } = require('./_tz')

const MIN_PENDING = 2
const HORIZON_PERIODS = 2
const MAX_NEW = 60

function dateOf(str) {
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, m - 1, d)
}
function dateToStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function addDays(date, n)   { const d = new Date(date); d.setDate(d.getDate() + n); return d }
function addMonths(date, n) { const d = new Date(date); d.setMonth(d.getMonth() + n); return d }
function nextPeriodDate(date, freq) {
  const d = typeof date === 'string' ? dateOf(date) : new Date(date)
  if (freq === 'weekly')     return addDays(d, 7)
  if (freq === 'biweekly')   return addDays(d, 14)
  if (freq === 'monthly')    return addMonths(d, 1)
  if (freq === 'bimonthly')  return addMonths(d, 2)
  if (freq === 'quarterly')  return addMonths(d, 3)
  if (freq === 'semiannual') return addMonths(d, 6)
  if (freq === 'annual')     return addMonths(d, 12)
  return addMonths(d, 1)
}

function queueHorizon(cfg, refDate) {
  if (!cfg || !cfg.cobro_freq) return null
  const ref = refDate || todayInTz(cfg.timezone)
  const p0 = cobroPeriod(cfg, ref)
  let p = p0
  for (let i = 0; i < HORIZON_PERIODS; i++) p = cobroPeriod(cfg, p.nextCobro)
  return { start: dateToStr(p0.start), end: dateToStr(p.end) }
}

function planQueue({ lastDate = null, firstDate = null, pending = 0, freq, horizon = null, lastNum = null, total = null, taken = null, today = null }) {
  const f = freq || 'monthly'
  const isInst = total != null
  const out = []
  let last = lastDate || (firstDate ? null : (today || dateToStr(todayInTz())))
  let first = firstDate && !lastDate ? firstDate : null
  let num = isInst ? Number(lastNum) || 0 : null
  let count = pending
  for (let i = 0; i < MAX_NEW; i++) {
    const due = first || dateToStr(nextPeriodDate(last, f))
    first = null
    if (isInst && num + 1 > total) break
    const needMin = count < MIN_PENDING
    if (!needMin && (!horizon || due > horizon.end)) break
    last = due
    if (isInst) num += 1
    if (!isInst && !needMin && horizon && due < horizon.start) continue
    if (!isInst && taken && taken.has(due)) continue
    out.push(isInst ? { due_date: due, current_installment: num } : { due_date: due })
    count += 1
  }
  return out
}

function planRecurrentCopies(copies, freq, horizon, firstDate = null) {
  const live = copies.filter(p => !p.is_paid && !p.is_postponed)
  const lastDate = copies.reduce((m, p) => (!m || p.due_date > m ? p.due_date : m), null)
  const taken = new Set(copies.filter(p => !p.is_paid).map(p => p.due_date))
  return planQueue({ lastDate, firstDate, pending: live.length, freq, horizon, taken })
}

function queueCopyId(masterId, key) {
  const str = `${masterId}|${key}`
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i)
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067)
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233)
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213)
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179)
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067)
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233)
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213)
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179)
  h1 ^= (h2 ^ h3 ^ h4); h2 ^= h1; h3 ^= h1; h4 ^= h1
  const hex = [h1, h2, h3, h4].map(h => (h >>> 0).toString(16).padStart(8, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

module.exports = { MIN_PENDING, HORIZON_PERIODS, queueHorizon, planQueue, planRecurrentCopies, queueCopyId }
