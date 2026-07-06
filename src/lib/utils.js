export const MONTHS       = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
export const MONTHS_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
export const WEEKDAYS     = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']
export const WEEKDAYS_SHORT = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']

export const CATEGORIES = [
  'Servicios', 'Suscripciones', 'Créditos', 'Renta',
  'Seguros', 'Alimentación', 'Transporte', 'Medicina',
  'Doctor', 'Mantenimiento', 'Otros',
]

export const RECUR_FREQ = {
  weekly: 'Semanal', biweekly: 'Quincenal', monthly: 'Mensual',
  bimonthly: 'Bimestral', quarterly: 'Trimestral', semiannual: 'Semestral', annual: 'Anual',
}
export const RECUR_FREQ_COMMON = ['weekly', 'biweekly', 'monthly']
export const RECUR_FREQ_EXTRA  = ['bimonthly', 'quarterly', 'semiannual', 'annual']

const CAT_COLORS = {
  'Servicios':     'var(--cat-servicios)',
  'Suscripciones': 'var(--cat-suscripciones)',
  'Créditos':      'var(--cat-creditos)',
  'Renta':         'var(--cat-renta)',
  'Seguros':       'var(--cat-seguros)',
  'Alimentación':  'var(--cat-alimentacion)',
  'Transporte':    'var(--cat-transporte)',
  'Medicina':      'var(--cat-medicina)',
  'Doctor':        'var(--cat-doctor)',
  'Mantenimiento': 'var(--cat-mantenimiento)',
  'Otros':         'var(--cat-otros)',
}
const CUSTOM_CAT_PALETTE = [
  'var(--cat-custom-1)', 'var(--cat-custom-2)', 'var(--cat-custom-3)',
  'var(--cat-custom-4)', 'var(--cat-custom-5)',
]

export function getCatColor(cat, customCats = []) {
  if (CAT_COLORS[cat]) return CAT_COLORS[cat]
  const idx = customCats.indexOf(cat)
  if (idx >= 0) return CUSTOM_CAT_PALETTE[idx % CUSTOM_CAT_PALETTE.length]
  return 'var(--cat-otros)'
}

export function today() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}
export function dateOf(str) {
  if (!str) return today()
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, m - 1, d)
}
export function daysDiff(str) { return Math.round((dateOf(str) - today()) / 864e5) }
export function fmt(n) { return '$' + Number(n).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) }
export function addDays(date, n)   { const d = new Date(date); d.setDate(d.getDate() + n); return d }
export function addMonths(date, n) { const d = new Date(date); d.setMonth(d.getMonth() + n); return d }

export function nextPeriodDate(date, freq) {
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
export function nextWeekdayDate(weekday) {
  const t = today(); let diff = weekday - t.getDay(); if (diff <= 0) diff += 7; return addDays(t, diff)
}
export function nextBiweeklyFromDate(dateStr) {
  const chosen = dateOf(dateStr); const t = today(); if (chosen >= t) return chosen
  let d = new Date(chosen); while (d < t) d = addDays(d, 14); return d
}
export function periodLabel(dateStr, freq) {
  const d = dateOf(dateStr)
  if (freq === 'weekly')   return `Sem ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`
  if (freq === 'biweekly') return `Qna ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`
}
export function periodCountLabel(count, freq) {
  if (freq === 'weekly')    return `${count} semana${count !== 1 ? 's' : ''}`
  if (freq === 'biweekly')  return `${count} quincena${count !== 1 ? 's' : ''}`
  if (freq === 'bimonthly') return `${count} bimestre${count !== 1 ? 's' : ''}`
  if (freq === 'quarterly') return `${count} trimestre${count !== 1 ? 's' : ''}`
  if (freq === 'semiannual')return `${count} semestre${count !== 1 ? 's' : ''}`
  if (freq === 'annual')    return `${count} año${count !== 1 ? 's' : ''}`
  return `${count} mes${count !== 1 ? 'es' : ''}`
}
export function installmentLabel(p) {
  if (!p.is_installment) return null
  return `Pago ${p.current_installment}/${p.total_installments}`
}

// `refDate` es opcional: si no se pasa, usa hoy (comportamiento de siempre).
// Si se pasa, retorna el periodo de cobro que CONTIENE esa fecha — esto es lo
// que permite ubicar en qué periodo cae el vencimiento de un pago futuro,
// sin importar qué tan lejos esté (lo usa `projectPeriodImpact`).
export function cobroPeriod(cfg, refDate) {
  const t = refDate || today()
  if (cfg.cobro_freq === 'weekly') {
    const wd = cfg.cobro_weekday ?? 5; const td = t.getDay()
    let diffNext = wd - td; if (diffNext <= 0) diffNext += 7
    const nextCobro = addDays(t, diffNext); const prevCobro = addDays(nextCobro, -7)
    return { start: prevCobro, end: addDays(nextCobro, -1), nextCobro }
  }
  if (cfg.cobro_freq === 'biweekly') {
    const d1 = cfg.cobro_day1 ?? 1; const d2 = cfg.cobro_day2 ?? 16
    const [dayA, dayB] = d1 < d2 ? [d1, d2] : [d2, d1]
    const y = t.getFullYear(); const m = t.getMonth()
    const cobroDates = [
      new Date(y, m-1, dayA), new Date(y, m-1, dayB),
      new Date(y, m,   dayA), new Date(y, m,   dayB),
      new Date(y, m+1, dayA), new Date(y, m+1, dayB),
    ]
    const past   = cobroDates.filter(d => d <= t).sort((a,b) => b-a)
    const future = cobroDates.filter(d => d > t).sort((a,b) => a-b)
    const start     = past[0]   || new Date(y, m, dayA)
    const nextCobro = future[0] || new Date(y, m+1, dayA)
    return { start, end: addDays(nextCobro, -1), nextCobro }
  }
  if (cfg.cobro_freq === 'monthly') {
    const d1 = cfg.cobro_day1 ?? 1; const y = t.getFullYear(); const m = t.getMonth()
    const day = t.getDate()
    let start, nextCobro
    if (day >= d1) { start = new Date(y, m, d1);   nextCobro = new Date(y, m+1, d1) }
    else           { start = new Date(y, m-1, d1);  nextCobro = new Date(y, m, d1) }
    return { start, end: addDays(nextCobro, -1), nextCobro }
  }
  return { start: t, end: t, nextCobro: t }
}

// Retorna el inicio y fin del SIGUIENTE periodo de cobro
export function nextCobroPeriod(cfg) {
  const { nextCobro } = cobroPeriod(cfg)
  const nextStart = nextCobro
  const freq = cfg.cobro_freq || 'biweekly'

  if (freq === 'weekly') return { start: nextStart, end: addDays(nextStart, 6) }

  if (freq === 'monthly') {
    const d1 = cfg.cobro_day1 ?? 1
    const nextNext = new Date(nextStart.getFullYear(), nextStart.getMonth() + 1, d1)
    return { start: nextStart, end: addDays(nextNext, -1) }
  }

  // Quincenal
  const d1 = cfg.cobro_day1 ?? 1; const d2 = cfg.cobro_day2 ?? 16
  const [dayA, dayB] = d1 < d2 ? [d1, d2] : [d2, d1]
  const y = nextStart.getFullYear(); const m = nextStart.getMonth()
  const cobroDates = [
    new Date(y, m-1, dayA), new Date(y, m-1, dayB),
    new Date(y, m,   dayA), new Date(y, m,   dayB),
    new Date(y, m+1, dayA), new Date(y, m+1, dayB),
    new Date(y, m+2, dayA),
  ]
  const future = cobroDates.filter(d => d > nextStart).sort((a,b) => a-b)
  const nextNext = future[0] || addDays(nextStart, 15)
  return { start: nextStart, end: addDays(nextNext, -1) }
}

export function nextCobroDate(cfg) { return cobroPeriod(cfg).nextCobro }
export function isTodayCobro(cfg)  { return nextCobroDate(cfg).getTime() === today().getTime() }

export function getPagarEsteCobro(payments, cfg) {
  const { end } = cobroPeriod(cfg)
  return payments.filter(p => {
    if (p.is_paid || p.paused || p.is_master) return false
    return dateOf(p.due_date) <= end
  })
}

export function statusOf(p, cfg) {
  if (p.paused)    return 'paused'
  if (p.postponed) return 'postponed'
  if (p.is_paid)   return 'paid'
  const d = daysDiff(p.due_date)
  if (d < 0) return 'overdue'
  const { end } = cobroPeriod(cfg)
  if (dateOf(p.due_date) <= end) return 'cobro'
  if (d <= 5) return 'soon'
  return 'ok'
}

export function groupPayments(payments) {
  const parents = {}, children = {}, standalone = []
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
  const orphanChildren = Object.entries(children)
    .filter(([pid]) => !parents[pid])
    .flatMap(([, ch]) => ch)
  return [...standalone, ...groups, ...orphanChildren]
    .sort((a, b) => dateOf(a.due_date) - dateOf(b.due_date))
}

// Proyecta el impacto de un pago (uno ya existente o uno nuevo que se está
// armando en el formulario) sobre el periodo en el que realmente vence — sin
// importar qué tan lejos esté — más el periodo actual como contexto. Si el
// pago es recurrente, también incluye el periodo de su 2da ocurrencia. Es un
// cálculo en memoria — no crea registros ni toca Supabase.
// `candidate` (opcional): { dueDate: 'YYYY-MM-DD', amount, isVariable, isRecurring, recurFreq }
export function projectPeriodImpact(payments, profile, candidate = null) {
  const salario = profile.salary_enabled ? Number(profile.salary_amount || 0) : 0
  const activos = payments.filter(p => !p.is_paid && !p.paused && !p.is_master)

  function committedIn(start, end, includeOverdue) {
    const inRange = p => {
      const d = dateOf(p.due_date)
      return includeOverdue ? d <= end : (d >= start && d <= end)
    }
    const comprometido = activos
      .filter(p => !p.is_variable && inRange(p))
      .reduce((a, p) => a + Number(p.amount), 0)
    const variablesPendientes = activos.filter(p => p.is_variable && inRange(p)).length
    return { comprometido, variablesPendientes }
  }

  const cur = cobroPeriod(profile)
  const results = []
  const byStart = new Map() // start.getTime() -> índice en results, para no duplicar el mismo periodo

  function upsertPeriod(period, isCurrent, montoCandidato, ocurrencias) {
    const k = period.start.getTime()
    if (byStart.has(k)) {
      const r = results[byStart.get(k)]
      r.montoCandidato    += montoCandidato
      r.ocurrencias        += ocurrencias
      r.disponibleDespues   = r.disponibleAntes - r.montoCandidato
      return
    }
    const { comprometido, variablesPendientes } = committedIn(period.start, period.end, isCurrent)
    const disponibleAntes   = salario - comprometido
    const disponibleDespues = disponibleAntes - montoCandidato
    byStart.set(k, results.length)
    results.push({ isCurrent, start: period.start, end: period.end, comprometido, variablesPendientes, disponibleAntes, disponibleDespues, montoCandidato, ocurrencias })
  }

  // El periodo actual siempre se incluye, como contexto (aunque el pago no caiga aquí)
  upsertPeriod(cur, true, 0, 0)

  if (candidate?.dueDate && !candidate.isVariable) {
    const maxOcurrencias = candidate.isRecurring ? 2 : 1
    let d = dateOf(candidate.dueDate)
    for (let i = 0; i < maxOcurrencias; i++) {
      const p = cobroPeriod(profile, d)
      upsertPeriod(p, p.start.getTime() === cur.start.getTime(), Number(candidate.amount), 1)
      if (!candidate.isRecurring) break
      d = nextPeriodDate(d, candidate.recurFreq)
    }
  }

  return results.sort((a, b) => a.start - b.start)
}

export function nameExistsActive(payments, name, excludeName = null) {
  const lower = name.trim().toLowerCase()
  if (excludeName && excludeName.trim().toLowerCase() === lower) return false
  return payments.some(p => p.name.toLowerCase() === lower && !p.is_paid)
}
