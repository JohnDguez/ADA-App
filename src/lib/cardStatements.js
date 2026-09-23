import { dateOf, dateToStr } from './utils'

// FIX v0.9.491 (bug real reportado por Johnatan: "Spent this cycle: $0.00"
// tras marcar un gasto pagado con la tarjeta): `dateOf()` espera una fecha
// PURA 'YYYY-MM-DD' — `paid_at` y `created_at` son timestamps con hora
// completa ('2026-09-22T15:30:00.000Z'). Pasárselos directo rompía el
// split('-') (el día se cortaba a la mitad de la hora) y la fecha salía
// inválida, así que TODAS las comparaciones de fecha fallaban en
// silencio — ningún gasto entraba jamás a ningún ciclo. Mismo patrón que
// ya usa el resto de la app para timestamps (HomePage.jsx, PaymentsPage.jsx):
// pasar primero por `new Date()` y `dateToStr()` para quedarse con el día
// en hora LOCAL (Regla 11), y solo entonces `dateOf()`.
function dateOfTimestamp(ts) {
  return dateOf(dateToStr(new Date(ts)))
}

// Entrega C de Tarjetas (v0.9.490) — genera los estados de cuenta
// automáticos de una tarjeta de crédito. Función PURA (sin Supabase):
// toma el estado de la tarjeta y sus pagos, regresa qué estados de cuenta
// hay que crear. Las escrituras reales las hace App.jsx.
//
// Regla del corte (mockup confirmado): lo pagado con esta tarjeta entre el
// corte anterior (exclusivo) y este corte (inclusive, por `paid_at`) forma
// el estado de cuenta de ese ciclo. La fecha límite es la siguiente
// ocurrencia del día límite DESPUÉS del corte — puede caer en el mes
// siguiente si `due_day < cut_day` (ver CardDayRangePicker.jsx).
//
// El acarreo (`carry_over`, a favor o en contra) solo se genera cuando el
// usuario PAGA un estado de cuenta por menos o por más de lo debido (ver
// App.jsx → confirmar pago de un estado de cuenta) — nunca por dejarlo sin
// pagar. Por eso, si al abrir la app hay VARIOS cortes sin generar (no se
// abrió la app en meses), el acarreo se consume solo en el primero: los
// siguientes ciclos, al no haber sido pagados nunca, no se acarrean entre
// sí — quedan como pagos vencidos independientes, igual que cualquier
// recurrente atrasado con varios periodos sin pagar.

function nextOccurrenceAfter(day, after) {
  let y = after.getFullYear(), m = after.getMonth()
  for (let k = 0; k < 3; k++) {
    const last = new Date(y, m + 1, 0).getDate()
    const d = new Date(y, m, Math.min(day, last))
    if (d > after) return d
    m++; if (m > 11) { m = 0; y++ }
  }
  return null
}

// `card`: { id, cut_day, due_day, carry_over, last_statement_cut, created_at }
// `creditPayments`: SOLO los pagos de esa tarjeta con
//   payment_method_id === card.id && payment_method_kind === 'credit' &&
//   is_paid === true (filtrados por quien llama — esta función no conoce
//   el resto del arreglo de pagos).
// `todayDate`: Date sin hora (medianoche local) — en producción, `today()`.
// Regresa los ciclos a facturar, en orden cronológico, cada uno con lo que
// hace falta para crear el pago + actualizar la tarjeta:
//   { cycleStart, cycleEnd, dueDate (strings YYYY-MM-DD), amount,
//     carryConsumed (para poner carry_over en 0 solo cuando se consumió) }
// Un ciclo con amount <= 0 se omite (no se genera un estado de cuenta de
// $0 ni negativo — el crédito a favor se queda esperando al siguiente).
// Lo gastado con esta tarjeta DESDE el último corte (o desde que se dio de
// alta, si nunca se ha facturado) HASTA hoy — el ciclo en curso, que
// todavía no se cierra. Se muestra en Mis tarjetas junto a cada tarjeta
// (pedido de Johnatan: como los cortes no coinciden entre tarjetas, cada
// una necesita su propia cuenta). `creditPayments`: mismo filtro que en
// computeMissingStatements (solo esta tarjeta, is_paid, kind='credit').
export function currentCycleSpend(card, creditPayments) {
  const cycleStart = card.last_statement_cut ? dateOf(card.last_statement_cut) : dateOfTimestamp(card.created_at)
  return creditPayments
    .filter(p => (p.paid_at ? dateOfTimestamp(p.paid_at) : dateOf(p.due_date)) > cycleStart)
    .reduce((s, p) => s + Number(p.amount), 0)
}

export function computeMissingStatements(card, creditPayments, todayDate) {
  if (!card.cut_day || !card.due_day) return []
  const cycles = []
  // `last_statement_cut` es un `date` puro (sin hora) — `dateOf()` directo
  // está bien ahí; `created_at` SÍ es timestamp.
  let cursor = card.last_statement_cut ? dateOf(card.last_statement_cut) : dateOfTimestamp(card.created_at)
  let carryLeft = Number(card.carry_over) || 0
  let firstCycle = true
  let guard = 0 // red de seguridad: nunca más de 60 ciclos en una sola pasada

  while (guard++ < 60) {
    const cycleEnd = nextOccurrenceAfter(card.cut_day, cursor)
    if (!cycleEnd || cycleEnd > todayDate) break
    const cycleStart = cursor
    const dueDate = nextOccurrenceAfter(card.due_day, cycleEnd)

    const spend = creditPayments
      .filter(p => {
        const paidDate = p.paid_at ? dateOfTimestamp(p.paid_at) : dateOf(p.due_date)
        return paidDate > cycleStart && paidDate <= cycleEnd
      })
      .reduce((s, p) => s + Number(p.amount), 0)

    const carryThis = firstCycle ? carryLeft : 0
    const amount = Math.round((spend + carryThis) * 100) / 100

    if (amount > 0) {
      cycles.push({
        cycleStart: dateToStr(cycleStart), cycleEnd: dateToStr(cycleEnd), dueDate: dateToStr(dueDate),
        amount, carryConsumed: carryThis !== 0,
      })
    }
    if (firstCycle) firstCycle = false
    cursor = cycleEnd
  }
  return cycles
}
