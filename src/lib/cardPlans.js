// Compras a meses ligadas a la tarjeta (v0.9.587).
//
// Un plan vive DENTRO de la tarjeta (`payment_methods.plans`, jsonb) — no
// crea pagos en Inicio ni cobros automáticos. En cada corte, el estado de
// cuenta suma UNA cuota por plan (ver computeMissingStatements en
// cardStatements.js); al pagar ese estado de cuenta, el plan avanza.
//
// Plan: { id, name, total, n, cuota, charged, paid, start (yyyy-mm-dd, día
//   de la compra — la primera cuota entra en el primer corte DESPUÉS de
//   esa fecha), settled (true si se liquidó antes), created_at }
//   - charged: cuotas ya metidas a algún estado de cuenta.
//   - paid:    cuotas cuyo estado de cuenta ya se pagó.
// Cada estado de cuenta guarda en `payments.plan_items` qué cuotas lleva:
//   [{ plan_id, n, amount }]  (n = número de cuota, 1-based)
// Una liquidación (abono) lleva [{ plan_id, settle: true, amount }].

function r2(x) { return Math.round(x * 100) / 100 }

function uuid() {
  return (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
      })
}

export function newPlan({ name, total, n, start }) {
  return {
    id: uuid(), name, total: r2(total), n: Number(n), cuota: r2(total / n),
    charged: 0, paid: 0, start, settled: false, created_at: new Date().toISOString(),
  }
}

export function getPlans(card) {
  return Array.isArray(card?.plans) ? card.plans : []
}

// Monto de la cuota número k (1-based). La última absorbe el redondeo para
// que la suma sea exactamente el total.
export function cuotaAmount(plan, k) {
  if (k >= plan.n) return r2(plan.total - plan.cuota * (plan.n - 1))
  return plan.cuota
}

// Suma de las cuotas a..b (1-based, inclusive).
function sumRange(plan, a, b) {
  let s = 0
  for (let i = a; i <= b; i++) s += cuotaAmount(plan, i)
  return r2(s)
}

// Lo que todavía NO entra a ningún estado de cuenta (cuotas por venir).
// Un plan liquidado ya no factura nada más.
export function planFuture(plan) {
  if (plan.settled) return 0
  return sumRange(plan, plan.charged + 1, plan.n)
}

// Lo facturado y sin pagar (viaja en un estado de cuenta pendiente o en el arrastre).
export function planBilledUnpaid(plan) {
  return sumRange(plan, plan.paid + 1, plan.charged)
}

// Lo que falta pagar del plan en total: facturado sin pagar + por venir.
export function planRemaining(plan) {
  return r2(planBilledUnpaid(plan) + planFuture(plan))
}

// Lo ya pagado del plan, y lo que quedaría por facturar si no se hubiera liquidado.
export function planPaidAmount(plan) { return sumRange(plan, 1, plan.paid) }

export function planIsActive(plan) {
  return plan.paid < plan.n && (!plan.settled || plan.paid < plan.charged)
}

export function planIsDone(plan) {
  return !planIsActive(plan)
}

// Suma de lo que falta por facturar en todos los planes de la tarjeta.
export function plansFutureTotal(card) {
  return r2(getPlans(card).reduce((s, p) => s + planFuture(p), 0))
}

// Cuota que entraría al PRÓXIMO corte (suma de una cuota por plan activo).
export function nextCutPlansTotal(card) {
  return r2(getPlans(card).reduce((s, p) => (!p.settled && p.charged < p.n) ? s + cuotaAmount(p, p.charged + 1) : s, 0))
}

export function activePlansCount(card) {
  return getPlans(card).filter(planIsActive).length
}

// Suma de lo que lleva un estado de cuenta por planes.
export function itemsTotal(items) {
  return r2((items || []).reduce((s, i) => s + Number(i.amount || 0), 0))
}

// El estado de cuenta se generó con estas cuotas: el plan avanza `charged`.
export function applyCharged(plans, items) {
  return plans.map(p => {
    const it = (items || []).find(i => i.plan_id === p.id && !i.settle)
    return it ? { ...p, charged: Math.max(p.charged, it.n) } : p
  })
}

// El estado de cuenta se pagó: el plan avanza `paid` hasta esa cuota.
export function applyPaid(plans, items) {
  return plans.map(p => {
    const it = (items || []).find(i => i.plan_id === p.id && !i.settle)
    return it ? { ...p, paid: Math.max(p.paid, it.n) } : p
  })
}

// Se deshizo el pago de un estado de cuenta (su monto vuelve a la deuda de la
// tarjeta): esas cuotas dejan de contar como pagadas. `charged` no cambia:
// la cuota ya se facturó y su monto viaja en el arrastre del siguiente corte.
export function revertPaid(plans, items) {
  return plans.map(p => {
    const it = (items || []).find(i => i.plan_id === p.id && !i.settle)
    return it ? { ...p, paid: Math.min(p.paid, it.n - 1) } : p
  })
}

// Se borró un estado de cuenta SIN pagar: la cuota vuelve a quedar por facturar.
export function revertCharged(plans, items) {
  return plans.map(p => {
    const it = (items || []).find(i => i.plan_id === p.id && !i.settle)
    return it ? { ...p, charged: Math.min(p.charged, it.n - 1), paid: Math.min(p.paid, it.n - 1) } : p
  })
}

// Liquidar: ya no habrá más cuotas por facturar (lo ya facturado sigue su camino).
export function applySettle(plans, planId) {
  return plans.map(p => p.id === planId ? { ...p, settled: true } : p)
}

// Deshacer una liquidación (se desmarcó/borró el abono de liquidación).
export function revertSettle(plans, items) {
  return plans.map(p => (items || []).some(i => i.plan_id === p.id && i.settle) ? { ...p, settled: false } : p)
}

// Desglose de lo que se debe en la tarjeta (alimenta "Por pagar" y la dona):
//  - statement: estados de cuenta ya facturados y sin pagar
//  - cycle:     lo gastado en el ciclo en curso más el arrastre (nunca negativo)
//  - plans:     cuotas de planes que todavía no entran a ningún estado de cuenta
export function debtBreakdown({ statement, cycleSpend, carry, card }) {
  const cycle = Math.max(0, r2(cycleSpend + (Number(carry) || 0)))
  const plans = plansFutureTotal(card)
  return { statement: r2(statement), cycle, plans, total: r2(statement + cycle + plans) }
}

// Deuda total en planes activos (facturado sin pagar + por venir).
export function plansRemainingTotal(card) {
  return r2(getPlans(card).filter(planIsActive).reduce((s, p) => s + planRemaining(p), 0))
}
