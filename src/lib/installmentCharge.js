import { todayStr } from './utils'

// Cargo automático de parcialidades con tarjeta de CRÉDITO (v0.9.586).
// El banco carga cada mensualidad solo; la app hacía esperar a que el usuario
// marcara la parcialidad. Ahora, cuando llega la fecha de una parcialidad
// personal cuyo método de pago es una tarjeta de crédito, se marca sola como
// pagada ("cargada") con `paid_at` = su fecha de vencimiento (mediodía local),
// para que caiga en el ciclo del estado de cuenta correcto, igual que en el banco.
// Si el usuario la desmarca a mano, se recuerda el id para no volver a cargarla.

const SKIP_KEY = 'ada_autocharge_skip'

export function readAutoChargeSkip() {
  try { return new Set(JSON.parse(localStorage.getItem(SKIP_KEY) || '[]')) } catch { return new Set() }
}

export function addAutoChargeSkip(id) {
  try {
    const s = readAutoChargeSkip(); s.add(id)
    localStorage.setItem(SKIP_KEY, JSON.stringify([...s].slice(-300)))
  } catch { /* sin storage */ }
}

// ¿Es una parcialidad que se carga sola? (copia personal, con tarjeta de crédito)
export function isCreditInstallmentCopy(p) {
  return !!(p && p.is_installment && !p.is_master && !p.space_id && p.payment_method_kind === 'credit' && p.payment_method_id)
}

// Siguiente parcialidad a cargar (la más antigua), o null.
// `creditCardIds`: Set con los ids de las tarjetas de crédito vigentes del usuario.
export function findAutoChargeCandidate(payments, creditCardIds, skipSet, failedSet) {
  const t = todayStr()
  const list = (payments || []).filter(p =>
    isCreditInstallmentCopy(p) && !p.is_paid && !p.is_postponed && !p._syncing &&
    creditCardIds.has(p.payment_method_id) && p.due_date <= t &&
    !skipSet.has(p.id) && !failedSet.has(p.id) && Number(p.amount) > 0
  )
  list.sort((a, b) => (a.due_date < b.due_date ? -1 : a.due_date > b.due_date ? 1 : (a.current_installment || 0) - (b.current_installment || 0)))
  return list[0] || null
}

// Mediodía local del día de vencimiento, en ISO (evita saltos de día por zona horaria)
export function dueDateNoon(dueDate) {
  const [y, m, d] = String(dueDate).slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d, 12, 0, 0).toISOString()
}
