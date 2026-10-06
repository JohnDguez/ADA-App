import { daysDiff } from './utils'

// Estado de Luna (la mascota de LunaPay) según los pagos del periodo actual.
// Función pura: recibe los listados que HomePage.jsx ya calcula en su
// `derived` (no vuelve a leer ni a filtrar `payments`) y devuelve qué pose
// mostrar + los datos que necesitan sus textos. Vive en `lib/` y no dentro
// del componente para que el widget nativo de Android pueda reusar EXACTAMENTE
// el mismo criterio más adelante (mismo estado en la app y en la pantalla de
// inicio del teléfono — si algún día cambia la regla, cambia en un solo lugar).
//
// Prioridad (de arriba hacia abajo, el primero que aplique gana):
//   1. waving      → el periodo no tiene ningún pago (usuario nuevo o periodo vacío)
//   2. worried     → hay al menos un pago vencido
//   3. celebrating → no queda nada por pagar y sí hubo pagos este periodo
//   4. attentive   → algo vence hoy o mañana
//   5. sleeping    → de noche (22:00–5:59) y sin nada urgente
//   6. happy       → todo en orden
//
// OJO: el widget de Android tiene su propio puerto a Java de esta misma regla
// (android/.../LunaWidgetState.java), que además agrega 2 estados de "ausencia"
// (telarañas a los 3 días sin abrir la app, "salió a pasear" a los 7) que
// NO existen aquí a propósito: con la app abierta no tiene sentido mostrarlos.
// Si cambia la regla en uno, cambiarla en el otro.
//
// `hour` es parámetro (default: hora local ahora) para poder probar la
// lógica sin depender del reloj real. Hora local, nunca UTC (Regla 22).
export const LUNA_NIGHT_FROM = 22
export const LUNA_NIGHT_UNTIL = 6

export function getLunaState({ pagarEsteCobro, vencidos, delPeriodo, pagadosEstePeriodo, hour = new Date().getHours() }) {
  // Un pago pospuesto aparece en `pagadosEstePeriodo` (para mostrarse en la
  // lista) pero no cuenta como pagado — mismo criterio que `pagadoMonto`.
  const done  = pagadosEstePeriodo.filter(p => !p.is_postponed).length
  const total = done + pagarEsteCobro.length

  // Primer pago por vencer (`delPeriodo` ya viene ordenado por fecha) y
  // cuántos más vencen en los próximos 7 días, para el texto de "atenta".
  const next = delPeriodo[0] || null
  const nextDays = next ? daysDiff(next.due_date) : null
  const moreThisWeek = delPeriodo.slice(1).filter(p => daysDiff(p.due_date) <= 7).length

  let key
  if (total === 0)                                       key = 'waving'
  else if (vencidos.length > 0)                          key = 'worried'
  else if (pagarEsteCobro.length === 0)                  key = 'celebrating'
  else if (nextDays !== null && nextDays <= 1)           key = 'attentive'
  else if (hour >= LUNA_NIGHT_FROM || hour < LUNA_NIGHT_UNTIL) key = 'sleeping'
  else                                                   key = 'happy'

  return { key, done, total, next, nextDays, moreThisWeek, overdueCount: vencidos.length }
}
