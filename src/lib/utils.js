export const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
export const MONTHS_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
export const WEEKDAYS = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']
export const WEEKDAYS_SHORT = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
export const CATEGORIES = ['Servicios','Suscripciones','Créditos','Renta','Seguros','Alimentación','Otros']
export const RECUR_FREQ = { weekly: 'Semanal', biweekly: 'Quincenal', monthly: 'Mensual' }

export function today() { const d = new Date(); d.setHours(0,0,0,0); return d }
export function dateOf(str) { const d = new Date(str + 'T12:00:00'); d.setHours(0,0,0,0); return d }
export function daysDiff(str) { return Math.round((dateOf(str) - today()) / 864e5) }
export function fmt(n) { return '$' + Number(n).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) }
export function addDays(date, n) { const d = new Date(date); d.setDate(d.getDate() + n); return d }

export function nextPeriodDate(date, freq) {
  const d = dateOf(typeof date === 'string' ? date : date.toISOString().split('T')[0])
  if (freq === 'weekly') return addDays(d, 7)
  if (freq === 'biweekly') return addDays(d, 14)
  const next = new Date(d); next.setMonth(next.getMonth() + 1); return next
}

export function nextWeekdayDate(weekday) {
  const t = today()
  let diff = weekday - t.getDay()
  if (diff <= 0) diff += 7
  return addDays(t, diff)
}

// Quincenal: fecha exacta elegida por el usuario, luego cada 14 días
export function nextBiweeklyFromDate(dateStr) {
  const chosen = dateOf(dateStr)
  const t = today()
  if (chosen >= t) return chosen
  // Ya pasó — avanza en múltiplos de 14 hasta llegar al futuro
  let d = new Date(chosen)
  while (d < t) d = addDays(d, 14)
  return d
}

export function periodLabel(dateStr, freq) {
  const d = dateOf(dateStr)
  if (freq === 'weekly') return `Sem ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`
  if (freq === 'biweekly') return `Qna ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`
}

export function periodCountLabel(count, freq) {
  if (freq === 'weekly') return `${count} semana${count !== 1 ? 's' : ''}`
  if (freq === 'biweekly') return `${count} quincena${count !== 1 ? 's' : ''}`
  return `${count} mes${count !== 1 ? 'es' : ''}`
}

export function installmentLabel(p) {
  if (!p.is_installment) return null
  return `Pago ${p.current_installment}/${p.total_installments}`
}

// Calcula el rango del periodo de cobro actual
// Retorna { start, end } donde start = día después del último cobro, end = próximo cobro
export function cobroPeriod(cfg) {
  const t = today()
  if (cfg.cobro_freq === 'weekly') {
    const wd = cfg.cobro_weekday
    const td = t.getDay()
    // Próximo cobro
    let diffNext = wd - td
    if (diffNext < 0) diffNext += 7
    const nextCobro = addDays(t, diffNext)
    // Cobro anterior
    const prevCobro = addDays(nextCobro, -7)
    // Inicio del periodo = día después del cobro anterior
    const start = addDays(prevCobro, 1)
    return { start, end: nextCobro }
  }
  return { start: t, end: t }
}

export function nextCobroDate(cfg) {
  const { end } = cobroPeriod(cfg)
  return end
}

export function isTodayCobro(cfg) {
  return nextCobroDate(cfg).getTime() === today().getTime()
}

// Pagos del periodo actual: vencen entre start y end (inclusive)
// Incluye vencidos del periodo (overdue dentro del periodo)
export function getPagarEsteCobro(payments, cfg) {
  const { start, end } = cobroPeriod(cfg)
  return payments.filter(p => {
    if (p.is_paid || p.paused) return false
    const vence = dateOf(p.due_date)
    return vence >= start && vence <= end
  })
}

export function statusOf(p, cfg) {
  if (p.paused) return 'paused'
  if (p.postponed) return 'postponed'
  if (p.is_paid) return 'paid'
  const d = daysDiff(p.due_date)
  if (d < 0) return 'overdue'
  const { start, end } = cobroPeriod(cfg)
  const vence = dateOf(p.due_date)
  if (vence >= start && vence <= end) return 'cobro'
  if (d <= 5) return 'soon'
  return 'ok'
}

export function groupPayments(payments) {
  const parents = {}
  const children = {}
  const standalone = []
  payments.forEach(p => {
    if (p.parent_id) {
      if (!children[p.parent_id]) children[p.parent_id] = []
      children[p.parent_id].push(p)
    } else if (p.is_recurrent) {
      parents[p.id] = p
    } else {
      standalone.push(p)
    }
  })
  const groups = Object.values(parents).map(parent => ({
    ...parent, _isGroup: true,
    _children: (children[parent.id] || []).sort((a, b) => dateOf(a.due_date) - dateOf(b.due_date))
  }))
  const orphanChildren = Object.entries(children).filter(([pid]) => !parents[pid]).flatMap(([, ch]) => ch)
  return [...standalone, ...groups, ...orphanChildren].sort((a, b) => dateOf(a.due_date) - dateOf(b.due_date))
}

// Solo bloquea duplicados si hay pagos PENDIENTES (no pagados) con ese nombre
export function nameExistsActive(payments, name, excludeId = null) {
  const lower = name.trim().toLowerCase()
  return payments.some(p =>
    p.name.toLowerCase() === lower &&
    p.id !== excludeId &&
    !p.is_paid
  )
}
