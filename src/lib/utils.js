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
  if (freq === 'biweekly') return addDays(d, 15)
  const next = new Date(d); next.setMonth(next.getMonth() + 1); return next
}

export function nextWeekdayDate(weekday) {
  const t = today()
  let diff = weekday - t.getDay()
  if (diff <= 0) diff += 7
  return addDays(t, diff)
}

// Quincenal personalizado: siguiente fecha a partir del día del mes especificado
export function nextBiweeklyFromDay(dayOfMonth) {
  const t = today()
  const currentDay = t.getDate()
  const d = new Date(t)
  if (currentDay < dayOfMonth) {
    d.setDate(dayOfMonth)
    return d
  }
  // Siguiente periodo: +15 días desde ese día
  const nextDay = dayOfMonth + 15
  if (nextDay <= 28) {
    d.setDate(nextDay)
    return d
  }
  // Pasó al siguiente mes
  d.setMonth(d.getMonth() + 1)
  d.setDate(dayOfMonth)
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

export function nextCobroDate(cfg) {
  const t = today()
  if (cfg.cobro_freq === 'weekly') {
    const wd = cfg.cobro_weekday
    let diff = wd - t.getDay()
    if (diff < 0) diff += 7
    const d = new Date(t); d.setDate(t.getDate() + diff); return d
  }
  return t
}

export function isTodayCobro(cfg) { return nextCobroDate(cfg).getTime() === today().getTime() }

export function getPagarEsteCobro(payments, cfg) {
  const nc = nextCobroDate(cfg)
  const nextNext = new Date(nc)
  if (cfg.cobro_freq === 'weekly') nextNext.setDate(nc.getDate() + 7)
  return payments.filter(p => {
    if (p.is_paid || p.postponed || p.paused) return false
    const vence = dateOf(p.due_date)
    return vence >= today() && vence < nextNext
  })
}

export function statusOf(p, cfg) {
  if (p.paused) return 'paused'
  if (p.postponed) return 'postponed'
  if (p.is_paid) return 'paid'
  const d = daysDiff(p.due_date)
  if (d < 0) return 'overdue'
  const nc = nextCobroDate(cfg)
  const nextNext = new Date(nc)
  if (cfg.cobro_freq === 'weekly') nextNext.setDate(nc.getDate() + 7)
  if (dateOf(p.due_date) < nextNext) return 'cobro'
  if (d <= 5) return 'soon'
  return 'ok'
}

export function installmentLabel(p) {
  if (!p.is_installment) return null
  return `Pago ${p.current_installment}/${p.total_installments}`
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

// Validación de nombre duplicado — ignora pagos que ya fueron eliminados (solo futuros no pagados)
export function nameExistsActive(payments, name, excludeId = null) {
  const lower = name.trim().toLowerCase()
  return payments.some(p =>
    p.name.toLowerCase() === lower &&
    p.id !== excludeId &&
    !p.is_paid // solo cuenta si hay al menos uno activo
  )
}
