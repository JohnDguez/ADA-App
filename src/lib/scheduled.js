import { cobroPeriod, dateOf } from './utils'

// «Programados» (v0.9.1055): pagos ÚNICOS pendientes cuya fecha cae después de
// que termina el periodo de cobro en curso. Los recurrentes y parcialidades
// (masters y sus hijos) no cuentan: viven en la pestaña Recurrentes.
export function isScheduledSingle(p, periodEnd) {
  if (!p || p.is_master || p.parent_id || p.is_installment || p.is_recurrent) return false
  if (p.is_paid || p.is_postponed) return false
  if (p.is_card_statement || p.is_contribution_reflection) return false
  return dateOf(p.due_date) > periodEnd
}

export function getScheduled(payments, profile) {
  if (!payments || !profile) return []
  const { end } = cobroPeriod(profile)
  return payments
    .filter(p => isScheduledSingle(p, end))
    .sort((a, b) => dateOf(a.due_date) - dateOf(b.due_date))
}

// Agrupa por mes de `dateKey` (due_date para programados, paid_at para el
// historial). Devuelve los meses en el orden en que aparecen los datos.
export function groupByMonth(list, dateKey = 'due_date') {
  const groups = []
  const byKey = new Map()
  for (const p of list) {
    const raw = p[dateKey] || p.due_date
    const d = dateKey === 'paid_at' ? new Date(raw) : dateOf(raw)
    const key = `${d.getFullYear()}-${d.getMonth()}`
    let g = byKey.get(key)
    if (!g) { g = { key, year: d.getFullYear(), month: d.getMonth(), items: [], total: 0 }; byKey.set(key, g); groups.push(g) }
    g.items.push(p)
    if (!p.is_postponed) g.total += Number(p.amount) || 0
  }
  return groups
}

// ¿La persona ya usa recurrentes o parcialidades? Decide si, bajo Programados,
// se muestra el atajo a Recurrentes o el consejo para empezar a usarlos.
export function usesRecurring(payments) {
  return (payments || []).some(p => p.is_master || p.is_recurrent || p.is_installment || p.parent_id)
}
