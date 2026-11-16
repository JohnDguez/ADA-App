import { addDays, clampedDate, cobroPeriod, dateOf, dateToStr, fmt } from './utils'

// ── Metas y ahorros (v0.9.1071) ──────────────────────────────────────────
// Un «ahorro libre» es una meta sin monto objetivo (target_amount null).
// El «descuento automático» aparta una cantidad fija el día de cobro:
//   goals.auto_amount  → monto de cada descuento
//   goals.auto_every   → 'period' | '2periods' | 'week' | 'month'
//   goals.auto_next    → próxima fecha de aplicación ('AAAA-MM-DD')
//   goals.auto_active  → false = en pausa
// Cada descuento queda como un aporte normal (goal_transactions.auto = true +
// un pago pagado de categoría «Ahorro») con la fecha del cobro, así que baja
// el Disponible igual que un aporte manual. Si no alcanza, queda en negativo.

export const AUTO_EVERY = ['period', '2periods', 'week', 'month']
export const MAX_CATCHUP = 24 // tope de descuentos atrasados por corrida

export const isSaving = g => !!g && !(Number(g.target_amount) > 0)
export const hasAuto = g => !!g && Number(g.auto_amount) > 0 && !!g.auto_next && AUTO_EVERY.includes(g.auto_every)

function hasCobro(cfg) {
  return !!cfg && ['weekly', 'biweekly', 'monthly'].includes(cfg.cobro_freq)
}

// Primer día de cobro estrictamente posterior a `after` (Date).
export function nextPayday(cfg, after) {
  if (!hasCobro(cfg)) return clampedDate(after.getFullYear(), after.getMonth() + 1, after.getDate())
  return cobroPeriod(cfg, after).nextCobro
}

// Primera fecha de aplicación al activar un descuento: hoy si hoy es cobro;
// si no, el próximo cobro (semana/mes sin esquema de cobro: en 7 días / 1 mes).
export function firstAutoDate(cfg, every, today) {
  if (every === 'week' && !hasCobro(cfg)) return dateToStr(addDays(today, 7))
  if (hasCobro(cfg) && cobroPeriod(cfg, today).start.getTime() === today.getTime()) return dateToStr(today)
  return dateToStr(nextPayday(cfg, today))
}

// Siguiente fecha de aplicación tras aplicar la de `fromStr`.
export function advanceAuto(cfg, every, fromStr) {
  const from = dateOf(fromStr)
  if (every === 'week') return dateToStr(addDays(from, 7))
  if (every === 'month') return dateToStr(clampedDate(from.getFullYear(), from.getMonth() + 1, from.getDate()))
  const steps = every === '2periods' ? 2 : 1
  let d = from
  for (let i = 0; i < steps; i++) d = nextPayday(cfg, d)
  return dateToStr(d)
}

// Fechas vencidas (≤ hoy) que faltan por aplicar, de la más antigua a la más
// reciente, con la fecha siguiente que debe quedar en auto_next.
export function dueAutoDates(goal, cfg, today) {
  if (!hasAuto(goal) || goal.auto_active === false) return { dates: [], next: goal?.auto_next || null }
  const todayS = dateToStr(today)
  const dates = []
  let cur = goal.auto_next
  while (cur <= todayS && dates.length < MAX_CATCHUP) {
    dates.push(cur)
    const nxt = advanceAuto(cfg, goal.auto_every, cur)
    if (nxt <= cur) break
    cur = nxt
  }
  // Si quedó muy atrasado, salta al próximo cobro futuro sin acumular.
  while (cur <= todayS) {
    const nxt = advanceAuto(cfg, goal.auto_every, cur)
    if (nxt <= cur) break
    cur = nxt
  }
  return { dates, next: cur }
}

// Cuántos cobros caen entre hoy y la fecha (incluida), mínimo 1.
export function paydaysUntil(cfg, today, targetStr) {
  const end = dateOf(targetStr)
  if (end < today) return 0
  let n = 0
  let d = hasCobro(cfg) && cobroPeriod(cfg, today).start.getTime() === today.getTime() ? today : nextPayday(cfg, today)
  while (d <= end && n < 400) { n++; d = nextPayday(cfg, d) }
  return Math.max(n, 1)
}

// Aporte sugerido por periodo: solo con monto objetivo Y fecha.
export function suggestedPerPeriod(goal, cfg, today) {
  if (!goal || !(Number(goal.target_amount) > 0) || !goal.target_date) return null
  const remaining = Math.max(Number(goal.target_amount) - Number(goal.current || 0), 0)
  if (remaining <= 0) return null
  const n = paydaysUntil(cfg, today, goal.target_date)
  if (n <= 0) return null
  return Math.ceil(remaining / n)
}

// Total apartado por periodo por todos los descuentos activos.
export function autoTotalPerPeriod(goals) {
  return goals.reduce((s, g) => s + (hasAuto(g) && g.auto_active !== false && g.auto_every === 'period' ? Number(g.auto_amount) : 0), 0)
}

// Texto corto del descuento de una meta: «$120 cada periodo» o «En pausa».
export function autoLabel(t, g) {
  if (!hasAuto(g)) return ''
  if (g.auto_active === false) return t('goalsPage.auto.paused')
  return t('goalsPage.auto.line', { amount: fmt(g.auto_amount), every: t(`goalFormModal.every.${g.auto_every}`).toLowerCase() })
}
