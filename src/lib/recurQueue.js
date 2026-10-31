// ── Cola de copias de recurrentes y parcialidades (v0.9.972) ────────────────
//
// Antes cada master mantenía SIEMPRE 2 copias pendientes, sin importar el
// periodo de cobro. Con periodo quincenal o mensual, un pago semanal (gasolina,
// despensa) dejaba sus 2 copias dentro del periodo actual y el siguiente se
// veía sin ellas (bug real reportado por Johnatan, 31 oct 2026).
//
// Ahora la cola cubre un HORIZONTE: el periodo de cobro actual + los
// `HORIZON_PERIODS` siguientes, con un mínimo de `MIN_PENDING` pendientes
// (así un pago anual o trimestral sigue mostrando su próxima fecha aunque
// caiga fuera del horizonte). Si ya hay copias de más (p. ej. el usuario
// acortó su periodo), no se crea nada hasta que hagan falta: solo se agrega
// lo que falta después de la última copia existente.
//
// Copia exacta en el servidor: `api/_recurQueue.js` (api/ es CommonJS y no
// importa este archivo). `tests/recur-queue.test.js` compara las dos: si se
// cambia algo aquí, cambiarlo igual allá.
import { dateToStr, todayStr, nextPeriodDate, cobroPeriod } from './utils'

export const MIN_PENDING = 2
export const HORIZON_PERIODS = 2
const MAX_NEW = 60 // tope de seguridad por master en una sola pasada

// Periodo actual y fin del horizonte, como 'YYYY-MM-DD'. Sin configuración de
// cobro regresa null: la cola se comporta como antes (solo el mínimo).
export function queueHorizon(cfg, refDate) {
  if (!cfg || !cfg.cobro_freq) return null
  const p0 = cobroPeriod(cfg, refDate)
  let p = p0
  for (let i = 0; i < HORIZON_PERIODS; i++) p = cobroPeriod(cfg, p.nextCobro)
  return { start: dateToStr(p0.start), end: dateToStr(p.end) }
}

// Fechas (y número de pago, en parcialidades) que faltan en la cola.
// - `lastDate`: fecha de la última copia existente (se avanza desde ahí).
// - `firstDate`: si no hay copias, la primera nueva toma ESTA fecha tal cual.
// - `pending`: cuántas pendientes (sin pagar ni posponer) hay ya.
// - `lastNum` / `total`: solo parcialidades; nunca se pasa de `total`.
// - `taken`: fechas que ya tienen una copia sin pagar (no se duplican).
// Ocurrencias de periodos YA PASADOS no se rellenan en recurrentes (salvo para
// completar el mínimo, como antes): abrir la app tras semanas sin usarla no
// debe inundar la lista de vencidos. En parcialidades sí, porque cada pago
// del plan se debe.
export function planQueue({ lastDate = null, firstDate = null, pending = 0, freq, horizon = null, lastNum = null, total = null, taken = null }) {
  const f = freq || 'monthly'
  const isInst = total != null
  const out = []
  let last = lastDate || (firstDate ? null : todayStr())
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

// Recurrente normal: a partir de TODAS sus copias (pagadas, pospuestas y
// pendientes) del master.
export function planRecurrentCopies(copies, freq, horizon, firstDate = null) {
  const live = copies.filter(p => !p.is_paid && !p.is_postponed)
  const lastDate = copies.reduce((m, p) => (!m || p.due_date > m ? p.due_date : m), null)
  const taken = new Set(copies.filter(p => !p.is_paid).map(p => p.due_date))
  return planQueue({ lastDate, firstDate, pending: live.length, freq, horizon, taken })
}

// Id determinista por master + fecha (o número de pago): si dos dispositivos o
// dos miembros de un espacio rellenan la cola a la vez, generan el MISMO id y
// el segundo insert se descarta (upsert con ignoreDuplicates sobre la llave
// primaria) en lugar de duplicar la copia. Hash cyrb128, formato UUID.
export function queueCopyId(masterId, key) {
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
