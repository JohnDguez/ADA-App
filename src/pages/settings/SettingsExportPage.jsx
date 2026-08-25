import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, Receipt, Wallet, Download, FileSpreadsheet, FileText, Target } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { PremiumLock } from '../../components/PremiumLock'
import { Select } from '../../components/Select'
import { DatePicker } from '../../components/DatePicker'
import { dateToStr, todayStr, dateOf, fmt, getCategoryLabel, cobroPeriod, addDays, today, MONTHS_SHORT } from '../../lib/utils'
import { buildCsv, downloadCsv } from '../../lib/exportCsv'
import { generateReportPdf } from '../../lib/exportPdf'
import styles from './SettingsExportPage.module.css'

// Sub-página "Exportar datos" — Fases 1 y 2 del módulo de Reportes (ver
// CONTEXT.md, pendiente "Rediseño de PremiumPage.jsx"). Deja elegir qué
// incluir (Gastos/Ingresos), de qué espacio, y un rango de fechas libre;
// descarga un CSV con exactamente esos registros, o genera un reporte PDF
// (tamaño carta, 2 columnas en la página de resumen) con gráficas y,
// opcionalmente, una sección de Metas. Función Premium completa — todo el
// contenido va envuelto en <PremiumLock>, mismo patrón que el simulador de
// PaymentModal.jsx.
export function SettingsExportPage({ profile, sharedSpaces, onOpenPremium, onBack, slideClass }) {
  const { t } = useTranslation()
  const { spaces } = sharedSpaces

  const [format, setFormat] = useState('csv') // 'csv' | 'pdf'
  const [includeGastos, setIncludeGastos]     = useState(true)
  const [includeIngresos, setIncludeIngresos] = useState(true)
  const [includeGoals, setIncludeGoals]       = useState(false) // solo aplica a PDF — Metas siempre es personal (ver CONTEXT.md), independiente del espacio elegido aquí
  const [space, setSpace]   = useState('personal') // 'personal' | id de shared_spaces
  const [from, setFrom]     = useState(() => dateToStr(new Date(new Date().getFullYear(), new Date().getMonth(), 1)))
  const [to, setTo]         = useState(() => todayStr())
  const [activeShortcut, setActiveShortcut] = useState(null) // null = rango personalizado

  // Accesos rápidos de rango de fechas (Regla 8, mockup confirmado). Cada
  // uno calcula from/to y marca su propio chip como activo; tocar un
  // DatePicker manualmente después (handleFromChange/handleToChange)
  // limpia `activeShortcut` — deja de ser "un acceso rápido" y pasa a ser
  // un rango personalizado, sin ningún chip resaltado.
  const SHORTCUTS = [
    { key: 'currentPeriod',  label: t('settingsExport.shortcuts.currentPeriod') },
    { key: 'previousPeriod', label: t('settingsExport.shortcuts.previousPeriod') },
    { key: 'currentMonth',   label: t('settingsExport.shortcuts.currentMonth') },
    { key: 'last3Months',    label: t('settingsExport.shortcuts.last3Months') },
    { key: 'last6Months',    label: t('settingsExport.shortcuts.last6Months') },
  ]

  function applyShortcut(key) {
    const now = new Date()
    let f, tt
    if (key === 'currentPeriod') {
      const { start, end } = cobroPeriod(profile)
      f = dateToStr(start)
      tt = dateToStr(end < today() ? end : today())
    } else if (key === 'previousPeriod') {
      const current = cobroPeriod(profile)
      const { start, end } = cobroPeriod(profile, addDays(current.start, -1))
      f = dateToStr(start)
      tt = dateToStr(end)
    } else if (key === 'currentMonth') {
      f = dateToStr(new Date(now.getFullYear(), now.getMonth(), 1))
      tt = todayStr()
    } else if (key === 'last3Months') {
      f = dateToStr(new Date(now.getFullYear(), now.getMonth() - 2, 1))
      tt = todayStr()
    } else if (key === 'last6Months') {
      f = dateToStr(new Date(now.getFullYear(), now.getMonth() - 5, 1))
      tt = todayStr()
    }
    setFrom(f)
    setTo(tt)
    setActiveShortcut(key)
  }

  function handleFromChange(v) { setFrom(v); setActiveShortcut(null) }
  function handleToChange(v)   { setTo(v);   setActiveShortcut(null) }

  const [counts, setCounts]   = useState(null) // { gastos, ingresos } | null mientras carga
  const [counting, setCounting] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const debounceRef = useRef(null)

  // Espacios donde el usuario es dueño o invitado — mismas opciones que
  // cualquier otro selector de espacio de la app (Personal + cada
  // shared_spaces del que sea miembro), sin importar cuál esté "activo"
  // ahora mismo en el resto de la app (esto es un filtro propio, no
  // depende de activeSpaceId).
  const spaceOptions = [
    { value: 'personal', label: t('settingsExport.space.personal') },
    ...spaces.map(s => ({ value: s.space.id, label: s.space.name })),
  ]

  const selectedSpaceEntry = space === 'personal' ? null : spaces.find(s => s.space.id === space)

  // Fecha EFECTIVA de un pago para efectos de exportar — mismo criterio
  // que ya usa PaymentsPage.jsx en todos sus filtros por mes/rango: si ya
  // se pagó, es paid_at; si no, due_date. `dateToStr(new Date(paid_at))`
  // convierte el timestamp a fecha LOCAL (Regla 22), nunca UTC directo.
  function effectiveDateStr(p) {
    return p.paid_at ? dateToStr(new Date(p.paid_at)) : p.due_date
  }

  // Trae los gastos que caen en el rango — consulta amplia por due_date
  // con 1 día de colchón (mismo patrón que defaultCutoffStr() en
  // usePayments.js, ya que paid_at es un timestamp UTC y debido a la
  // zona horaria de México un pago puede quedar 1 día antes/después del
  // due_date en la consulta cruda) y filtro EXACTO por fecha efectiva en
  // el cliente, en horario local.
  const fetchGastos = useCallback(async () => {
    const fromBuffered = dateToStr(new Date(dateOf(from).getTime() - 86400000))
    const toBuffered   = dateToStr(new Date(dateOf(to).getTime() + 86400000))

    let query = supabase.from('payments').select('*').eq('is_master', false)
      .gte('due_date', fromBuffered).lte('due_date', toBuffered)
    query = space === 'personal'
      ? query.eq('user_id', profile.id).is('space_id', null)
      : query.eq('space_id', space)

    const { data, error } = await query
    if (error || !data) return []

    return data.filter(p => {
      const d = effectiveDateStr(p)
      return d >= from && d <= to
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [space, from, to, profile.id])

  // Trae los ingresos EXTRA capturados a mano del rango (bonos, etc.) —
  // period_income no tiene fecha exacta de registro, solo `period_start`
  // (primer día del periodo al que pertenece), así que el filtro es
  // directo por esa columna. IMPORTANTE: esto NO incluye el salario/nómina
  // fijo del usuario — ver fetchAllIngresos() más abajo.
  const fetchIngresos = useCallback(async () => {
    let query = supabase.from('period_income').select('*')
      .gte('period_start', from).lte('period_start', to)
    query = space === 'personal'
      ? query.eq('user_id', profile.id).is('space_id', null)
      : query.eq('space_id', space)

    const { data, error } = await query
    return (!error && data) ? data : []
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [space, from, to, profile.id])

  // El salario/nómina periódico NO vive en `period_income` — vive como un
  // valor fijo en el perfil (`salary_enabled`/`salary_amount`), aplicado
  // automáticamente cada periodo (ver "Disponible Este Periodo" en
  // PaymentsPage.jsx: `salario + extras - gastado`). `period_income` solo
  // guarda los ingresos EXTRA capturados a mano. Sin esto, "Ingresos" en
  // Exportar se quedaba corto — bug real reportado por Johnatan tras
  // probar el reporte.
  //
  // Enumera el inicio de cada periodo de cobro que cae en [rangeFrom,
  // rangeTo] (por defecto el rango elegido en el filtro, pero la gráfica de
  // tendencia usa su propia ventana de 12 meses independiente — ver
  // fetchChartSeriesData() más abajo). Mismo criterio de filtro que ya usa
  // period_income (`period_start` entre ambos, inclusive).
  function enumeratePeriodStartsInRange(rangeFrom = from, rangeTo = to) {
    if (!['weekly', 'biweekly', 'monthly'].includes(profile.cobro_freq)) return []
    const starts = []
    let p = cobroPeriod(profile, dateOf(rangeFrom))
    if (dateToStr(p.start) < rangeFrom) p = cobroPeriod(profile, p.nextCobro) // el periodo que contiene rangeFrom puede empezar antes del rango — ese no cuenta, solo el siguiente
    let guard = 0
    while (dateToStr(p.start) <= rangeTo && guard < 400) {
      starts.push(dateToStr(p.start))
      p = cobroPeriod(profile, p.nextCobro)
      guard++
    }
    return starts
  }

  // Solo aplica a Personal — el salario es un dato individual del perfil;
  // para un Espacio Compartido no existe forma de saber el salario de
  // otros miembros (ni la propia app lo usa así), ahí solo cuentan los
  // ingresos que de verdad se registraron contra ese espacio.
  function buildSalaryRows() {
    if (space !== 'personal' || !profile.salary_enabled || !Number(profile.salary_amount)) return []
    return enumeratePeriodStartsInRange().map(periodStart => ({
      period_start: periodStart, type: t('settingsExport.salaryType'), note: null, amount: Number(profile.salary_amount),
    }))
  }

  // Aportaciones reales al Fondo Compartido del espacio — bug real
  // reportado por Johnatan: cuando alguien aporta al Fondo, el servidor
  // (api/manage-shared-fund.js) SÍ guarda la fila real en
  // `shared_fund_ledger` (type='deposit'), pero TAMBIÉN crea un "pago
  // reflejo" en el espacio PERSONAL del que aportó (categoría Ahorro,
  // gasto) para que su disponible baje — Exportar solo miraba
  // `period_income`, nunca `shared_fund_ledger`, así que el aporte real
  // AL ESPACIO nunca aparecía como ingreso de ese espacio (el reflejo
  // tampoco cuenta, porque vive en el espacio Personal de quien aportó,
  // no en este). Solo cuentan los depósitos (`type='deposit'`) — un
  // retiro del Fondo para pagar un gasto NO es ingreso, ya está reflejado
  // en `fund_amount` del pago correspondiente.
  async function fetchFundDeposits(rangeFrom, rangeTo) {
    if (space === 'personal') return []
    const bufferedStart = new Date(dateOf(rangeFrom).getTime() - 86400000).toISOString()
    const bufferedEnd = new Date(dateOf(rangeTo).getTime() + 2 * 86400000).toISOString() // +2 días de colchón: created_at es timestamp completo, no solo fecha
    const { data, error } = await supabase
      .from('shared_fund_ledger')
      .select('created_at, amount, note')
      .eq('space_id', space)
      .eq('type', 'deposit')
      .gte('created_at', bufferedStart)
      .lte('created_at', bufferedEnd)
    if (error || !data) return []
    return data
      .map(d => ({ period_start: dateToStr(new Date(d.created_at)), type: t('settingsExport.fundDepositType'), note: d.note, amount: Number(d.amount) }))
      .filter(d => d.period_start >= rangeFrom && d.period_start <= rangeTo)
  }

  // Fuente única de "ingresos" para el contador, el CSV y el PDF — combina
  // period_income real + el salario sintético (Personal) o las
  // aportaciones al Fondo (Compartido), ordenados por periodo.
  const fetchAllIngresos = useCallback(async () => {
    const rows = await fetchIngresos()
    const extraRows = space === 'personal' ? buildSalaryRows() : await fetchFundDeposits(from, to)
    return [...rows, ...extraRows].sort((a, b) => a.period_start < b.period_start ? -1 : a.period_start > b.period_start ? 1 : 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchIngresos, space, from, to, profile.salary_enabled, profile.salary_amount, profile.cobro_freq, profile.cobro_day1, profile.cobro_day2, profile.cobro_weekday])

  // Mapa user_id → nombre, para resolver quién aportó en un gasto de
  // Espacio Compartido (payment_contributions solo trae el user_id, no el
  // nombre — igual que en useSharedSpaces.js, se cruza a mano).
  function memberName(userId) {
    const member = selectedSpaceEntry?.space.members?.find(m => m.user_id === userId)
    return member?.profile?.name || t('settingsExport.unknownMember')
  }

  // Arma la columna "Aportantes" de un gasto compartido: "Ana: $200,
  // Luis: $150" en una sola celda — no se puede abrir en columnas propias
  // porque el número de aportantes varía por fila, y una tabla CSV
  // necesita las mismas columnas en todas.
  async function contributionsTextByPaymentId(paymentIds) {
    if (space === 'personal' || paymentIds.length === 0) return {}
    const { data, error } = await supabase
      .from('payment_contributions')
      .select('payment_id, user_id, amount')
      .in('payment_id', paymentIds)
    if (error || !data) return {}
    const map = {}
    for (const c of data) {
      const line = `${memberName(c.user_id)}: ${fmt(c.amount)}`
      map[c.payment_id] = map[c.payment_id] ? `${map[c.payment_id]}, ${line}` : line
    }
    return map
  }

  // Mapa user_id → avatar_url, mismo cruce manual que memberName() de arriba.
  function memberAvatar(userId) {
    const member = selectedSpaceEntry?.space.members?.find(m => m.user_id === userId)
    return member?.profile?.avatar_url || null
  }

  // Gastos por categoría, TODAS (sin recorte — Johnatan: "no podrán
  // desplegarlo"), ordenadas de mayor a menor monto.
  function buildCategoryBreakdown(gastos) {
    const byCat = {}
    for (const p of gastos) {
      const label = getCategoryLabel(p.category)
      byCat[label] = (byCat[label] || 0) + Number(p.amount)
    }
    return Object.entries(byCat).map(([label, amount]) => ({ label, amount })).sort((a, b) => b.amount - a.amount)
  }

  // ── Gráfica de tendencia (Gastos + Ingresos) — SIEMPRE independiente del
  // filtro de fechas del resto del reporte (pedido explícito de Johnatan:
  // "aunque solo se hayan seleccionado los últimos 3 meses"). Siempre
  // termina en `to`, mira hasta 12 meses atrás, y se adapta sola para
  // nunca verse "fea" con poca actividad:
  //   1) Intenta por MES, recortando los meses vacíos del inicio (cuenta
  //      nueva con pocos meses de historial no debe verse con 9 meses en
  //      cero antes de la actividad real).
  //   2) Si eso deja menos de 3 puntos, cambia a por SEMANA sobre el mismo
  //      tramo real de actividad.
  //   3) Si sigue habiendo menos de 3, cambia a por DÍA.
  // Nunca usa `from`/`to` del filtro para su ventana — solo `to` como ancla.
  // La ventana de 12 meses nunca debe mirar más atrás de cuando la cuenta
  // (Personal) o el espacio (Compartido) empezó a existir — bug real
  // reportado por Johnatan: sin este tope, "Mes actual" como filtro
  // mostraba ingresos de meses en los que la cuenta ni siquiera existía
  // todavía (period_income/nómina sintética de ANTES de que el usuario se
  // registrara nunca deberían existir, pero la ventana natural de 12 meses
  // los "pedía" igual, mostrando ceros hacia atrás sin ningún punto de
  // referencia real de cuándo arrancó la cuenta).
  function chartWindowStart(toStr) {
    const t = dateOf(toStr)
    const natural = new Date(t.getFullYear(), t.getMonth() - 11, 1)
    const createdRaw = space === 'personal' ? profile.created_at : selectedSpaceEntry?.space.created_at
    if (createdRaw) {
      const created = dateOf(dateToStr(new Date(createdRaw)))
      if (created > natural) return dateToStr(created)
    }
    return dateToStr(natural)
  }

  async function fetchChartSeriesData(toStr) {
    const windowStart = chartWindowStart(toStr)
    const bufferedStart = dateToStr(new Date(dateOf(windowStart).getTime() - 86400000))
    const bufferedEnd = dateToStr(new Date(dateOf(toStr).getTime() + 86400000))

    let gq = supabase.from('payments').select('due_date, paid_at, amount').eq('is_master', false)
      .gte('due_date', bufferedStart).lte('due_date', bufferedEnd)
    gq = space === 'personal' ? gq.eq('user_id', profile.id).is('space_id', null) : gq.eq('space_id', space)
    const { data: gastosRaw } = await gq
    const gastos = (gastosRaw || [])
      .map(p => ({ date: p.paid_at ? dateToStr(new Date(p.paid_at)) : p.due_date, amount: Number(p.amount) }))
      .filter(p => p.date >= windowStart && p.date <= toStr)

    let iq = supabase.from('period_income').select('period_start, amount')
      .gte('period_start', windowStart).lte('period_start', toStr)
    iq = space === 'personal' ? iq.eq('user_id', profile.id).is('space_id', null) : iq.eq('space_id', space)
    const { data: ingresosRaw } = await iq
    const ingresosReal = (ingresosRaw || []).map(i => ({ date: i.period_start, amount: Number(i.amount) }))
    const extraRows = space === 'personal'
      ? ((profile.salary_enabled && Number(profile.salary_amount))
          ? enumeratePeriodStartsInRange(windowStart, toStr).map(ps => ({ date: ps, amount: Number(profile.salary_amount) }))
          : [])
      : (await fetchFundDeposits(windowStart, toStr)).map(d => ({ date: d.period_start, amount: d.amount }))

    return { gastos, ingresos: [...ingresosReal, ...extraRows], windowStart }
  }

  function mondayOf(dateStr) {
    const d = dateOf(dateStr)
    const isoDay = d.getDay() === 0 ? 7 : d.getDay() // domingo=0 -> 7, para que la semana empiece en lunes
    return dateToStr(addDays(d, -(isoDay - 1)))
  }

  function bucketTotals(rows, keyFn) {
    const map = {}
    for (const r of rows) map[keyFn(r.date)] = (map[keyFn(r.date)] || 0) + r.amount
    return map
  }

  function buildChartSeries(gastos, ingresos, windowStart, toStr) {
    if (gastos.length === 0 && ingresos.length === 0) return null

    // 1) Por MES — 12 buckets fijos, recortando los vacíos del inicio.
    const monthKeys = []
    let cursor = dateOf(windowStart)
    const toD = dateOf(toStr)
    while (cursor <= toD) {
      monthKeys.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`)
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)
    }
    const gastosByMonth = bucketTotals(gastos, d => d.slice(0, 7))
    const ingresosByMonth = bucketTotals(ingresos, d => d.slice(0, 7))
    let monthPoints = monthKeys.map(key => ({
      label: MONTHS_SHORT[Number(key.split('-')[1]) - 1],
      gastos: gastosByMonth[key] || 0,
      ingresos: ingresosByMonth[key] || 0,
    }))
    const firstActive = monthPoints.findIndex(p => p.gastos > 0 || p.ingresos > 0)
    const shownMonthKeys = firstActive > 0 ? monthKeys.slice(firstActive) : monthKeys
    if (firstActive > 0) monthPoints = monthPoints.slice(firstActive)
    if (monthPoints.length >= 3) return { granularity: 'month', points: monthPoints, rangeStart: `${shownMonthKeys[0]}-01` }

    // 2) Por SEMANA, sobre el tramo real de actividad (primera fecha con
    // movimiento encontrada arriba, hasta `to`).
    const allDates = [...gastos.map(g => g.date), ...ingresos.map(i => i.date)].sort()
    const activityStart = allDates[0] || windowStart
    const weekStart = mondayOf(activityStart)
    const gastosByWeek = bucketTotals(gastos, d => mondayOf(d))
    const ingresosByWeek = bucketTotals(ingresos, d => mondayOf(d))
    const weekKeys = []
    let wCursor = dateOf(weekStart)
    while (wCursor <= toD) {
      weekKeys.push(dateToStr(wCursor))
      wCursor = addDays(wCursor, 7)
    }
    const weekPoints = weekKeys.map(key => {
      const d = dateOf(key)
      return { label: `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`, gastos: gastosByWeek[key] || 0, ingresos: ingresosByWeek[key] || 0 }
    })
    if (weekPoints.length >= 3) return { granularity: 'week', points: weekPoints, rangeStart: weekStart }

    // 3) Por DÍA — última red de seguridad, tramo de actividad muy corto.
    const gastosByDay = bucketTotals(gastos, d => d)
    const ingresosByDay = bucketTotals(ingresos, d => d)
    const dayKeys = []
    let dCursor = dateOf(activityStart)
    while (dCursor <= toD) {
      dayKeys.push(dateToStr(dCursor))
      dCursor = addDays(dCursor, 1)
    }
    return {
      granularity: 'day',
      points: dayKeys.map(key => {
        const d = dateOf(key)
        return { label: `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`, gastos: gastosByDay[key] || 0, ingresos: ingresosByDay[key] || 0 }
      }),
      rangeStart: dayKeys[0],
    }
  }

  async function buildTrendSeries(toStr) {
    const { gastos, ingresos, windowStart } = await fetchChartSeriesData(toStr)
    return buildChartSeries(gastos, ingresos, windowStart, toStr)
  }

  // Atribución completa de "quién gastó cuánto" en un Espacio Compartido
  // (decidido con Johnatan): un gasto dividido explícitamente
  // ("Dividir entre miembros") reparte su monto según payment_contributions;
  // lo que cubrió el Fondo Compartido (payments.fund_amount) se atribuye a
  // "Fondo Compartido" como su propia entrada; el RESTO de un gasto que no
  // se dividió (el caso más común) se atribuye a quien lo registró
  // (payments.user_id) — la única fuente de "quién pagó" que existe para
  // ese caso, ya que la app no guarda un registro más fino. Entre las 3
  // partes, cada gasto queda 100% atribuido, así que "Gasto por miembro"
  // siempre suma exactamente el total de Gastos del rango.
  async function computeSharedAttribution(gastos) {
    if (space === 'personal' || gastos.length === 0) {
      return { contributorsByRow: [], memberTotals: [] }
    }
    const { data: contribData } = await supabase
      .from('payment_contributions')
      .select('payment_id, user_id, amount')
      .in('payment_id', gastos.map(p => p.id))

    const contribByPayment = {}
    for (const c of (contribData || [])) {
      if (!contribByPayment[c.payment_id]) contribByPayment[c.payment_id] = []
      contribByPayment[c.payment_id].push(c)
    }

    const contributorsByRow = gastos.map(p => (contribByPayment[p.id] || []).map(c => ({
      userId: c.user_id, name: memberName(c.user_id), avatarUrl: memberAvatar(c.user_id), amount: Number(c.amount),
    })))

    const totals = {} // user_id → monto ; llave especial '__fund__'
    for (const p of gastos) {
      const list = contribByPayment[p.id] || []
      const sumContrib = list.reduce((s, c) => s + Number(c.amount), 0)
      const fund = Number(p.fund_amount) || 0
      for (const c of list) totals[c.user_id] = (totals[c.user_id] || 0) + Number(c.amount)
      if (fund > 0) totals.__fund__ = (totals.__fund__ || 0) + fund
      const remainder = Number(p.amount) - sumContrib - fund
      if (remainder > 0.005) totals[p.user_id] = (totals[p.user_id] || 0) + remainder
    }

    const memberTotals = Object.entries(totals)
      .map(([userId, total]) => userId === '__fund__'
        ? { userId, name: t('settingsExport.pdf.fund'), avatarUrl: null, total }
        : { userId, name: memberName(userId), avatarUrl: memberAvatar(userId), total })
      .sort((a, b) => b.total - a.total)

    return { contributorsByRow, memberTotals }
  }

  // Metas SIEMPRE personales (ver CONTEXT.md) — independiente del espacio
  // elegido arriba para Gastos/Ingresos. Creadas/Cumplidas por fecha
  // (created_at/completed_at); Abonos/Retiros vía goal_transactions,
  // "canceladas" se descarta a propósito (decidido con Johnatan: una meta
  // borrada no deja ningún rastro en la base de datos, no hay dato real
  // que mostrar sin inventar o cambiar el schema).
  async function fetchGoalsData() {
    const { data: allGoals } = await supabase.from('goals').select('*').eq('user_id', profile.id).is('space_id', null)
    const goalNameById = {}
    for (const g of (allGoals || [])) goalNameById[g.id] = g.name

    const created = (allGoals || []).filter(g => g.created_at && dateToStr(new Date(g.created_at)) >= from && dateToStr(new Date(g.created_at)) <= to)
    const completed = (allGoals || []).filter(g => g.is_completed && g.completed_at && dateToStr(new Date(g.completed_at)) >= from && dateToStr(new Date(g.completed_at)) <= to)

    const { data: allTx } = await supabase.from('goal_transactions').select('*').eq('user_id', profile.id).is('space_id', null)
    const inRange = (allTx || []).filter(tx => tx.created_at && dateToStr(new Date(tx.created_at)) >= from && dateToStr(new Date(tx.created_at)) <= to)

    return {
      created,
      completed,
      aportes: inRange.filter(tx => tx.type === 'aporte').map(tx => ({ date: dateToStr(new Date(tx.created_at)), goalName: goalNameById[tx.goal_id] || '—', amount: tx.amount })),
      retiros: inRange.filter(tx => tx.type === 'retiro').map(tx => ({ date: dateToStr(new Date(tx.created_at)), goalName: goalNameById[tx.goal_id] || '—', amount: tx.amount })),
    }
  }

  function formatDateLabel(str) {
    const d = dateOf(str)
    return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()].toLowerCase()} ${d.getFullYear()}`
  }

  // Recalcula el contador de "registros encontrados" cada vez que cambia
  // algún filtro — con debounce (Regla 35) para no disparar una consulta
  // por cada tecla/clic mientras el usuario todavía está ajustando fechas.
  useEffect(() => {
    clearTimeout(debounceRef.current)
    if (!includeGastos && !includeIngresos) { setCounts({ gastos: 0, ingresos: 0 }); return }
    setCounting(true)
    debounceRef.current = setTimeout(async () => {
      const [gastos, ingresos] = await Promise.all([
        includeGastos ? fetchGastos() : Promise.resolve([]),
        includeIngresos ? fetchAllIngresos() : Promise.resolve([]),
      ])
      setCounts({ gastos: gastos.length, ingresos: ingresos.length })
      setCounting(false)
    }, 300)
    return () => clearTimeout(debounceRef.current)
  }, [includeGastos, includeIngresos, fetchGastos, fetchAllIngresos])

  async function handleDownloadCsv() {
    if (!includeGastos && !includeIngresos) return
    setDownloading(true)

    const headers = [
      t('settingsExport.csv.date'), t('settingsExport.csv.recordType'), t('settingsExport.csv.concept'),
      t('settingsExport.csv.category'), t('settingsExport.csv.amount'), t('settingsExport.csv.paid'),
      t('settingsExport.csv.amountType'), t('settingsExport.csv.space'), t('settingsExport.csv.contributors'),
    ]
    const rows = []
    const spaceLabel = space === 'personal' ? t('settingsExport.space.personal') : (selectedSpaceEntry?.space.name || '')

    if (includeGastos) {
      const gastos = await fetchGastos()
      const contribMap = await contributionsTextByPaymentId(gastos.map(p => p.id))
      for (const p of gastos) {
        rows.push([
          effectiveDateStr(p),
          t('settingsExport.csv.expenseType'),
          p.name,
          getCategoryLabel(p.category),
          fmt(p.amount),
          p.is_paid ? t('settingsExport.csv.yes') : t('settingsExport.csv.no'),
          p.is_variable ? t('settingsExport.csv.variable') : t('settingsExport.csv.fixed'),
          spaceLabel,
          contribMap[p.id] || '',
        ])
      }
    }

    if (includeIngresos) {
      const ingresos = await fetchAllIngresos()
      for (const inc of ingresos) {
        rows.push([
          inc.period_start,
          t('settingsExport.csv.incomeType'),
          inc.note ? `${inc.type} - ${inc.note}` : inc.type,
          '',
          fmt(inc.amount),
          '',
          '',
          spaceLabel,
          '',
        ])
      }
    }

    rows.sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)

    const csv = buildCsv(headers, rows)
    downloadCsv(`lunapay-export-${from}_a_${to}.csv`, csv)
    setDownloading(false)
  }

  // Fase 2 — reporte PDF. Junta exactamente los mismos filtros que el CSV
  // (Gastos/Ingresos, Espacio, rango) más Metas si se activó, resuelve
  // nombres/avatares de contribuyentes, y delega el dibujo completo a
  // `generateReportPdf()` (lib/exportPdf.js) — esta función solo junta
  // datos, nunca dibuja nada directamente.
  async function handleGeneratePdf() {
    if (!includeGastos && !includeIngresos && !includeGoals) return
    setDownloading(true)

    const gastos = includeGastos ? await fetchGastos() : []
    const ingresosRaw = includeIngresos ? await fetchAllIngresos() : []
    const isSharedSpace = space !== 'personal'

    const totals = {
      ingresos: includeIngresos ? ingresosRaw.reduce((s, i) => s + Number(i.amount), 0) : null,
      gastos: includeGastos ? gastos.reduce((s, p) => s + Number(p.amount), 0) : null,
    }

    const { contributorsByRow, memberTotals } = isSharedSpace ? await computeSharedAttribution(gastos) : { contributorsByRow: [], memberTotals: [] }
    const goalsData = includeGoals ? await fetchGoalsData() : null
    const spaceLabel = space === 'personal' ? t('settingsExport.space.personal') : (selectedSpaceEntry?.space.name || '')

    // Gráfica de tendencia — SIEMPRE independiente del filtro (ver
    // buildTrendSeries arriba), solo se calcula si hay algo que graficar.
    // Se calcula ANTES del objeto labels para poder armar el subtítulo con
    // el rango REAL que cubre (Johnatan: "no sé cuál es el correcto ni cómo
    // se calcula" al ver un número distinto entre el KPI, que sí respeta el
    // filtro elegido, y un mes de la gráfica, que mira su propia ventana de
    // hasta 12 meses independiente — dejarlo explícito en el subtítulo
    // resuelve la confusión sin tener que unificar ambos criterios).
    const series = (includeGastos || includeIngresos) ? await buildTrendSeries(to) : null

    const labels = {
      reportTitle: t('settingsExport.pdf.reportTitle'),
      ingresos: t('settingsExport.income'),
      gastos: t('settingsExport.expenses'),
      balance: t('settingsExport.pdf.balance'),
      categoryChart: t('settingsExport.pdf.categoryChart'),
      subCategoryChart: t('settingsExport.pdf.subCategoryChart'),
      categoryChartContinued: t('settingsExport.pdf.categoryChartContinued'),
      trendChart: t('settingsExport.pdf.trendChart'),
      subTrendChart: series
        ? `${t('settingsExport.pdf.subTrendChart')} (${formatDateLabel(series.rangeStart)} – ${formatDateLabel(to)})`
        : t('settingsExport.pdf.subTrendChart'),
      expenseList: t('settingsExport.pdf.expenseList'),
      subExpenseList: t('settingsExport.pdf.subExpenseList'),
      colDate: t('settingsExport.csv.date'),
      colName: t('settingsExport.csv.concept'),
      colCategory: t('settingsExport.csv.category'),
      colAmount: t('settingsExport.csv.amount'),
      colPaid: t('settingsExport.csv.paid'),
      pending: t('settingsExport.pdf.pending'),
      colContributors: t('settingsExport.csv.contributors'),
      yes: t('settingsExport.csv.yes'),
      no: t('settingsExport.csv.no'),
      memberSpending: t('settingsExport.pdf.memberSpending'),
      subMemberSpending: t('settingsExport.pdf.subMemberSpending'),
      colType: t('settingsExport.pdf.colType'),
      colNote: t('settingsExport.pdf.colNote'),
      subIncome: t('settingsExport.pdf.subIncome'),
      goalsTitle: t('settingsExport.pdf.goalsTitle'),
      subGoals: t('settingsExport.pdf.subGoals'),
      created: t('settingsExport.pdf.created'),
      completed: t('settingsExport.pdf.completed'),
      contributions: t('settingsExport.pdf.contributions'),
      withdrawals: t('settingsExport.pdf.withdrawals'),
      colGoal: t('settingsExport.pdf.colGoal'),
      fund: t('settingsExport.pdf.fund'),
    }

    const doc = await generateReportPdf({
      spaceLabel,
      fromLabel: formatDateLabel(from),
      toLabel: formatDateLabel(to),
      isSharedSpace,
      totals,
      categories: includeGastos ? buildCategoryBreakdown(gastos) : [],
      series,
      expenseRows: gastos.map(p => ({
        // "Pagado" ahora es la ÚNICA columna de fecha (Johnatan: el Sí/No
        // no se entendía) — la fecha real en que se pagó, o null si sigue
        // pendiente (exportPdf.js dibuja "Pendiente" en ese caso).
        paidDate: p.is_paid ? dateToStr(new Date(p.paid_at)) : null,
        name: p.name, category: getCategoryLabel(p.category), amount: p.amount,
      })),
      expenseContributors: contributorsByRow,
      memberTotals,
      incomes: ingresosRaw.map(i => ({ date: i.period_start, type: i.type, note: i.note, amount: i.amount })),
      goals: goalsData,
      labels,
    })
    doc.save(`lunapay-reporte-${from}_a_${to}.pdf`)
    setDownloading(false)
  }

  function handleGenerate() {
    return format === 'csv' ? handleDownloadCsv() : handleGeneratePdf()
  }


  const total = counts ? counts.gastos + counts.ingresos : null
  const noneSelected = !includeGastos && !includeIngresos && !(format === 'pdf' && includeGoals)

  return (
    <div className={`${slideClass} ${styles.pageWrapper}`}>
      <div className={styles.header}>
        <button onClick={onBack} className={styles.backButton}>
          <ChevronLeft size={18} color="var(--text)" />
        </button>
      </div>

      <div className={styles.hero}>
        <div className={styles.heroIconCircle}>
          <FileSpreadsheet size={26} color="var(--accent)" />
        </div>
        <div className={styles.heroTitle}>{t('settingsExport.title')}</div>
        <p className={styles.heroDesc}>{t('settingsExport.intro')}</p>
      </div>

      <PremiumLock
        isPremium={profile?.is_premium}
        message={t('settingsExport.premiumMessage')}
        onUpgradeClick={onOpenPremium}
      >
        <div className={styles.content}>
          <div className={styles.fieldGroup}>
            <div className="field-label">{t('settingsExport.format')}</div>
            <div className={styles.chipRow}>
              <button
                type="button"
                onClick={() => setFormat('csv')}
                className={`${styles.chip} ${format === 'csv' ? styles.chipActive : ''}`}
              >
                <FileText size={18} />
                <span>CSV</span>
              </button>
              <button
                type="button"
                onClick={() => setFormat('pdf')}
                className={`${styles.chip} ${format === 'pdf' ? styles.chipActive : ''}`}
              >
                <FileSpreadsheet size={18} />
                <span>PDF</span>
              </button>
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <div className="field-label">{t('settingsExport.dataToInclude')}</div>
            <div className={styles.chipRow}>
              <button
                type="button"
                onClick={() => setIncludeGastos(v => !v)}
                className={`${styles.chip} ${includeGastos ? styles.chipActive : ''}`}
              >
                <Receipt size={18} />
                <span>{t('settingsExport.expenses')}</span>
              </button>
              <button
                type="button"
                onClick={() => setIncludeIngresos(v => !v)}
                className={`${styles.chip} ${includeIngresos ? styles.chipActive : ''}`}
              >
                <Wallet size={18} />
                <span>{t('settingsExport.income')}</span>
              </button>
              {format === 'pdf' && (
                <button
                  type="button"
                  onClick={() => setIncludeGoals(v => !v)}
                  className={`${styles.chip} ${includeGoals ? styles.chipActive : ''}`}
                >
                  <Target size={18} />
                  <span>{t('settingsExport.pdf.goalsTitle')}</span>
                </button>
              )}
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <div className="field-label">{t('settingsExport.spaceLabel')}</div>
            <div className={styles.fieldSurface}>
              <Select value={space} onChange={setSpace} options={spaceOptions} />
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <div className="field-label">{t('settingsExport.dateRange')}</div>
            <div className={styles.shortcutRow}>
              {SHORTCUTS.map(s => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => applyShortcut(s.key)}
                  className={`${styles.shortcutChip} ${activeShortcut === s.key ? styles.shortcutChipActive : ''}`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <div className={styles.dateRow}>
              <div className={styles.dateCol}>
                <div className={styles.dateSubLabel}>{t('settingsExport.from')}</div>
                <div className={styles.fieldSurface}>
                  <DatePicker value={from} onChange={handleFromChange} />
                </div>
              </div>
              <div className={styles.dateCol}>
                <div className={styles.dateSubLabel}>{t('settingsExport.to')}</div>
                <div className={styles.fieldSurface}>
                  <DatePicker value={to} onChange={handleToChange} />
                </div>
              </div>
            </div>
          </div>

          <div className={styles.countCard}>
            <span className={styles.countLabel}>{t('settingsExport.recordsFound')}</span>
            <span className={styles.countValue}>{counting ? '…' : (total ?? 0)}</span>
          </div>

          <button
            onClick={handleGenerate}
            disabled={noneSelected || downloading || counting || (format === 'csv' && total === 0)}
            className={styles.downloadButton}
          >
            <Download size={16} />
            {downloading
              ? t('settingsExport.downloading')
              : format === 'csv' ? t('settingsExport.downloadCsv') : t('settingsExport.pdf.generate')}
          </button>
        </div>
      </PremiumLock>
    </div>
  )
}
