import i18n from '../i18n'

// Arreglos crudos en español — YA NO se usan para mostrar texto en ningún
// lado (ver getMonths()/getMonthsShort()/getWeekdays()/getWeekdaysShort()
// abajo, que son lo que hay que usar en su lugar). Se quedan exportados
// solo porque algunos lugares del código los usaban para su LONGITUD
// (ej. WEEKDAYS_SHORT.length) o para iterar sin importar el idioma — nunca
// para imprimir directo en pantalla.
export const MONTHS       = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
export const MONTHS_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
export const WEEKDAYS     = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']
export const WEEKDAYS_SHORT = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']

// Nombres de meses/días localizados vía Intl.DateTimeFormat, en vez de los
// arreglos fijos en español de arriba — resuelve el pendiente señalado
// desde la Fase 2 del selector de idioma. El ÍNDICE de cada arreglo se
// mantiene igual siempre (0=enero..11=diciembre para meses, 0=domingo..
// 6=sábado para días) porque así es como los indexa el resto del código
// (`date.getMonth()`/`date.getDay()`, que JS siempre devuelve en ese orden
// sin importar el locale) — no hay que reordenar nada, solo traducir la
// etiqueta en cada posición. Se recalculan en cada llamada (barato, 7-12
// iteraciones) en vez de cachear, para que reflejen el idioma activo en
// el momento sin tener que invalidar ningún caché al cambiarlo.
//
// El locale de Intl es más específico que el idioma de i18next ('es'/'en')
// — se mapea a 'es-MX'/'en-US' para nombres consistentes con el resto de
// la app (fechas ya se formatean con 'es-MX' en varios lados). Español
// viene en minúsculas de Intl ('domingo', 'enero') — se capitaliza para
// calzar con el estilo que ya tenía la app; inglés ya viene capitalizado
// (no le hace nada distinto, cap() es no-op ahí).
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1) }
export function intlLocale() { return i18n.language === 'en' ? 'en-US' : 'es-MX' }

function buildWeekdayNames(format) {
  const locale = intlLocale()
  const arr = []
  for (let i = 0; i < 7; i++) {
    // 1 de enero de 2023 (UTC) fue domingo — arranca la semana en domingo,
    // que es el índice 0 de date.getDay() en cualquier locale.
    const d = new Date(Date.UTC(2023, 0, 1 + i))
    arr.push(cap(new Intl.DateTimeFormat(locale, { weekday: format, timeZone: 'UTC' }).format(d)))
  }
  return arr
}
function buildMonthNames(format) {
  const locale = intlLocale()
  const arr = []
  for (let i = 0; i < 12; i++) {
    const d = new Date(Date.UTC(2023, i, 1))
    arr.push(cap(new Intl.DateTimeFormat(locale, { month: format, timeZone: 'UTC' }).format(d)))
  }
  return arr
}

export function getWeekdays()      { return buildWeekdayNames('long') }
export function getWeekdaysShort() { return buildWeekdayNames('short') }
export function getMonths()        { return buildMonthNames('long') }
export function getMonthsShort()   { return buildMonthNames('short') }

export const CATEGORIES = [
  'Servicios', 'Suscripciones', 'Créditos', 'Renta',
  'Seguros', 'Alimentación', 'Transporte', 'Medicina',
  'Doctor', 'Mantenimiento', 'Ahorro', 'Otros',
]

// Mapa del valor guardado (español, canónico, el que vive en
// payments.category / period_income y en todos los CAT_COLORS/íconos de
// abajo) → la llave de traducción en src/i18n/es.json|en.json → categories.*.
// El valor guardado NUNCA cambia con el idioma — solo lo que se le muestra
// al usuario. Las categorías personalizadas (custom_categories) no pasan
// por aquí: no están en este mapa, así que getCategoryLabel() las regresa
// tal cual — es el nombre que el usuario mismo escribió, no hay nada que
// traducir (decisión con Johnatan: "esas el usuario no toca su nombre" es
// justo lo que hace posible traducir las fijas sin romper nada).
const CATEGORY_I18N_KEYS = {
  'Servicios': 'servicios', 'Suscripciones': 'suscripciones', 'Créditos': 'creditos', 'Renta': 'renta',
  'Seguros': 'seguros', 'Alimentación': 'alimentacion', 'Transporte': 'transporte', 'Medicina': 'medicina',
  'Doctor': 'doctor', 'Mantenimiento': 'mantenimiento', 'Ahorro': 'ahorro', 'Otros': 'otros',
}

// getCategoryLabel() no es un componente — usa el singleton i18n.t(), mismo
// criterio que greeting() en PageHeader.jsx y timeAgo() en
// NotificationsPanel.jsx. Se llama siempre desde dentro de componentes que
// ya usan useTranslation() para otro texto, así que ya se re-renderizan
// solos al cambiar de idioma — esta función solo necesita leer el idioma
// activo en el momento del render, no suscribirse a nada por su cuenta.
export function getCategoryLabel(cat) {
  const key = CATEGORY_I18N_KEYS[cat]
  return key ? i18n.t(`categories.${key}`) : cat
}

export const RECUR_FREQ = {
  weekly: 'Semanal', biweekly: 'Quincenal', monthly: 'Mensual',
  bimonthly: 'Bimestral', quarterly: 'Trimestral', semiannual: 'Semestral', annual: 'Anual',
}
export const RECUR_FREQ_COMMON = ['weekly', 'biweekly', 'monthly']
export const RECUR_FREQ_EXTRA  = ['bimonthly', 'quarterly', 'semiannual', 'annual']

// getFrequencyLabel() — mismo patrón que getCategoryLabel(): RECUR_FREQ
// arriba se queda tal cual (sus KEYS ya son ids neutrales en inglés
// —'weekly', 'biweekly', etc.— que es lo que se guarda en
// payments.recur_freq; el objeto en sí no se guarda en la base de datos,
// solo se usaba para mostrar el texto). Esta función traduce ese texto
// mostrado sin tocar el id guardado.
export function getFrequencyLabel(freq) {
  return RECUR_FREQ[freq] ? i18n.t(`frequency.${freq}`) : freq
}

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
  'Ahorro':        'var(--cat-ahorro)',
  'Otros':         'var(--cat-otros)',
}
const CUSTOM_CAT_PALETTE = [
  'var(--cat-custom-1)', 'var(--cat-custom-2)', 'var(--cat-custom-3)',
  'var(--cat-custom-4)', 'var(--cat-custom-5)',
]

// `categoryColors` es opcional (profile.category_colors): si el usuario ya
// eligió un color propio para esta categoría desde Ajustes, tiene prioridad
// sobre la asignación automática. Parámetro nuevo y opcional — los llamados
// existentes sin él (en archivos que no se tocaron todavía) siguen
// funcionando igual que antes.
export function getCatColor(cat, customCats = [], categoryColors = {}) {
  if (categoryColors[cat]) return categoryColors[cat]
  if (CAT_COLORS[cat]) return CAT_COLORS[cat]
  const idx = customCats.indexOf(cat)
  if (idx >= 0) return CUSTOM_CAT_PALETTE[idx % CUSTOM_CAT_PALETTE.length]
  return 'var(--cat-otros)'
}

export function today() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}
// Convierte un objeto Date a 'YYYY-MM-DD' usando sus componentes LOCALES —
// nunca vía .toISOString() (que convierte a UTC y puede desfasar un día
// según la zona horaria del usuario: de noche en México, ya es "mañana" en
// UTC). Reemplaza cualquier `fecha.toISOString().split('T')[0]`. Ver regla
// de diseño "zona horaria" en CONTEXT.md.
export function dateToStr(d) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
// 'YYYY-MM-DD' de HOY en la zona horaria local del usuario — reemplaza
// `new Date().toISOString().split('T')[0]`, que era exactamente el bug:
// de noche, esa expresión ya devolvía la fecha de mañana en UTC.
export function todayStr() {
  return dateToStr(today())
}
export function dateOf(str) {
  if (!str) return today()
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, m - 1, d)
}
export function daysDiff(str) { return Math.round((dateOf(str) - today()) / 864e5) }
export function fmt(n) {
  const num = Number(n)
  const sign = num < 0 ? '-' : ''
  return sign + '$' + Math.abs(num).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
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
  const monthsShort = getMonthsShort()
  if (freq === 'weekly')   return `${i18n.t('dates.weekAbbrev')} ${d.getDate()} ${monthsShort[d.getMonth()]}`
  if (freq === 'biweekly') return `${i18n.t('dates.biweekAbbrev')} ${d.getDate()} ${monthsShort[d.getMonth()]}`
  return `${monthsShort[d.getMonth()]} ${d.getFullYear()}`
}
export function periodCountLabel(count, freq) {
  const unitKey =
    freq === 'weekly'     ? 'week' :
    freq === 'biweekly'   ? 'biweek' :
    freq === 'bimonthly'  ? 'bimonthly' :
    freq === 'quarterly'  ? 'quarterly' :
    freq === 'semiannual' ? 'semiannual' :
    freq === 'annual'     ? 'annual' : 'monthly'
  return `${count} ${i18n.t(`dates.units.${unitKey}`, { count })}`
}
export function installmentLabel(p) {
  if (!p.is_installment) return null
  return i18n.t('paymentModal.editInstallment.badge', { current: p.current_installment, total: p.total_installments })
}

// Mensaje de confirmación correcto según el tipo de pago que se va a
// eliminar — mismo criterio EXACTO que la rama de borrado real en
// App.jsx (`performDelete`): un master se borra completo, una copia de
// recurrente o de parcialidad con master cancela la serie completa (con
// aviso de que el historial se conserva), una parcialidad sin master
// (sistema viejo) no tiene ese aviso porque no hay historial que
// preservar, y cualquier otro caso es un pago único. Centralizado aquí
// (patrón singleton i18n, mismo criterio que installmentLabel/
// getCategoryLabel) para que cada pantalla con su propio modal de
// confirmación (PayCard.jsx, PaymentModal.jsx, PaymentsPage.jsx) muestre
// el texto correcto sin duplicar esta misma rama 3 veces.
export function getDeleteConfirmMessage(payment) {
  if (payment?.is_master) return i18n.t('app.confirm.deleteRecurrent', { name: payment.name })
  if (payment?.is_recurrent && !payment?.is_installment && payment?.parent_id) return i18n.t('app.confirm.deleteRecurrent', { name: payment.name })
  if (payment?.is_installment && payment?.parent_id) return i18n.t('app.confirm.cancelInstallments', { name: payment.name })
  if (payment?.is_installment) return i18n.t('app.confirm.cancelInstallmentsNoHistory', { name: payment.name })
  return i18n.t('app.confirm.deleteThisPayment')
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

// Proyecta el impacto de un pago (uno nuevo que se está armando en el
// formulario) sobre el/los periodo(s) donde realmente cae — sin importar qué
// tan lejos esté. Si es recurrente, incluye también el periodo de su 2da
// ocurrencia. Ya NO incluye el periodo actual si el pago no cae ahí (se quitó
// del diseño: no aporta a la decisión de "me alcanza o no cuando venza").
// Cálculo en memoria — no crea registros ni toca Supabase.
// `candidate`: { dueDate: 'YYYY-MM-DD', amount, isVariable, isRecurring, recurFreq }
// `periodIncomes`: filas de `period_income` del periodo ACTUAL únicamente
// (no aplica a periodos futuros, que no tienen ingresos extra registrados).
//
// Periodo actual: se usa la misma lógica que el remanente real de
// `PaymentsPage.jsx` (`checkPeriodStart`) — ingreso = sueldo + extras del
// periodo; se resta lo YA pagado este periodo (por `paid_at`, no `due_date`,
// porque el dinero sale de la cartera cuando se paga, no cuando vence) más lo
// pendiente que todavía vence este periodo (por `due_date`, igual que antes).
// Periodo futuro: sueldo − lo pendiente que vence ese periodo (sin extras, sin
// paid_at, porque ese periodo aún no ocurre).
export function projectPeriodImpact(payments, profile, candidate, periodIncomes = []) {
  if (!candidate?.dueDate || candidate.isVariable) return []

  const salario = profile.salary_enabled ? Number(profile.salary_amount || 0) : 0
  const cur = cobroPeriod(profile)
  const extrasActual = periodIncomes.reduce((a, inc) => a + Number(inc.amount || 0), 0)

  const pendientes = payments.filter(p => !p.is_paid && !p.paused && !p.is_master)
  const pagados    = payments.filter(p => p.is_paid && !p.is_master)

  function pendienteEn(start, end, includeOverdue) {
    const inRange = p => {
      const d = dateOf(p.due_date)
      return includeOverdue ? d <= end : (d >= start && d <= end)
    }
    const pendientesFijos = pendientes.filter(p => !p.is_variable && inRange(p))
    const comprometido = pendientesFijos.reduce((a, p) => a + Number(p.amount), 0)
    const pendientesCount = pendientesFijos.length
    const variablesPendientes = pendientes.filter(p => p.is_variable && inRange(p)).length
    return { comprometido, pendientesCount, variablesPendientes }
  }

  function pagadoEn(start, end) {
    return pagados
      .filter(p => {
        if (!p.paid_at) return false
        const d = dateOf(dateToStr(new Date(p.paid_at)))
        return d >= start && d <= end
      })
      .reduce((a, p) => a + Number(p.amount), 0)
  }

  const maxOcurrencias = candidate.isRecurring ? 2 : 1
  const results = []
  let d = dateOf(candidate.dueDate)
  for (let i = 0; i < maxOcurrencias; i++) {
    const p = cobroPeriod(profile, d)
    const esActual = p.start.getTime() === cur.start.getTime()
    const { comprometido, pendientesCount, variablesPendientes } = pendienteEn(p.start, p.end, esActual)

    const disponibleAntes = esActual
      ? salario + extrasActual - pagadoEn(p.start, p.end) - comprometido
      : salario - comprometido
    const disponibleDespues = disponibleAntes - Number(candidate.amount)
    results.push({ start: p.start, end: p.end, disponibleAntes, disponibleDespues, variablesPendientes, pendientesCount, pendientesMonto: comprometido })
    if (!candidate.isRecurring) break
    d = nextPeriodDate(d, candidate.recurFreq)
  }
  return results
}

// Un pago único puede repetir el nombre de otro pago único (ej. "Comida
// jueves" se repite cada semana sin ser recurrente formal) — pero ningún
// pago, sea único, recurrente o parcialidad, puede llamarse igual que un
// recurrente o parcialidad YA ACTIVO, porque ahí sí generaría ambigüedad
// real con el sistema de master/copias. Por eso el filtro solo considera
// `is_recurrent || is_installment`, ignorando los únicos existentes.
export function nameExistsActive(payments, name, excludeName = null) {
  const lower = name.trim().toLowerCase()
  if (excludeName && excludeName.trim().toLowerCase() === lower) return false
  return payments.some(p => p.name.toLowerCase() === lower && !p.is_paid && (p.is_recurrent || p.is_installment))
}
