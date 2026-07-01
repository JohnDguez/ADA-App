import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, MoreVertical, Plus, CircleDollarSign, ChevronDown, ChevronUp } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { fmt, dateOf, MONTHS, MONTHS_SHORT, CATEGORIES, cobroPeriod, addDays } from '../lib/utils'
import { supabase } from '../lib/supabase'

const CAT_COLOR = {
  'Servicios':     'var(--cat-servicios)',
  'Suscripciones': 'var(--cat-suscripciones)',
  'Créditos':      'var(--cat-creditos)',
  'Renta':         'var(--cat-renta)',
  'Seguros':       'var(--cat-seguros)',
  'Alimentación':  'var(--cat-alimentacion)',
  'Otros':         'var(--cat-otros)',
}

const INCOME_TYPES = ['Bono', 'Préstamo', 'Pago', 'Comisión', 'Otro']

// ── Helpers de periodo anterior ───────────────────────────────────────────────
function prevPeriod(profile) {
  const { start } = cobroPeriod(profile)
  // El periodo anterior termina el día antes del inicio del actual
  const prevEnd = addDays(start, -1)
  // Para encontrar el inicio del periodo anterior, usamos un perfil "desplazado"
  // Buscamos el periodo que contiene prevEnd
  const fakeCfg = { ...profile }
  // Ajustamos la fecha "today" simulando que estamos en prevEnd
  // No podemos cambiar today() globalmente, así que calculamos manualmente
  const t = prevEnd
  const freq = profile.cobro_freq

  if (freq === 'weekly') {
    const wd = profile.cobro_weekday ?? 5
    const td = t.getDay()
    let diffPrev = td - wd
    if (diffPrev < 0) diffPrev += 7
    const prevStart = addDays(t, -diffPrev)
    return { start: prevStart, end: prevEnd }
  }

  if (freq === 'biweekly') {
    const d1 = profile.cobro_day1 ?? 1
    const d2 = profile.cobro_day2 ?? 16
    const [dayA, dayB] = d1 < d2 ? [d1, d2] : [d2, d1]
    const y = t.getFullYear()
    const m = t.getMonth()
    const cobroDates = [
      new Date(y, m - 1, dayA), new Date(y, m - 1, dayB),
      new Date(y, m, dayA),     new Date(y, m, dayB),
      new Date(y, m + 1, dayA), new Date(y, m + 1, dayB),
    ]
    const past = cobroDates.filter(d => d <= t).sort((a, b) => b - a)
    const prevStart = past[0] || new Date(y, m, dayA)
    return { start: prevStart, end: prevEnd }
  }

  if (freq === 'monthly') {
    const d1 = profile.cobro_day1 ?? 1
    const y = t.getFullYear()
    const m = t.getMonth()
    const day = t.getDate()
    let prevStart
    if (day >= d1) {
      prevStart = new Date(y, m - 1, d1)
    } else {
      prevStart = new Date(y, m - 2, d1)
    }
    return { start: prevStart, end: prevEnd }
  }

  return { start: t, end: prevEnd }
}

export function PaymentsPage({ payments, profile, unreadCount, onOpenNotifs, onGoSettings, onMarkUnpaid, onDelete, onDeleteDirect, onUpdateProfile, slideClass }) {
  const now = new Date()

  const [monthsBack,  setMonthsBack]  = useState(3)
  const [selectedCat, setSelectedCat] = useState(null)
  const [catRange,    setCatRange]    = useState('mes')
  const [viewMonth,   setViewMonth]   = useState(now.getMonth())
  const [viewYear,    setViewYear]    = useState(now.getFullYear())
  const [openMenu,    setOpenMenu]    = useState(null)

  // Ingresos extras del periodo actual
  const [periodIncomes,    setPeriodIncomes]    = useState([])
  const [loadingIncomes,   setLoadingIncomes]   = useState(true)

  // Modal agregar ingreso
  const [incomeModal,      setIncomeModal]      = useState(false)
  const [incomeType,       setIncomeType]       = useState('Bono')
  const [incomeAmount,     setIncomeAmount]     = useState('')
  const [incomeNote,       setIncomeNote]       = useState('')
  const [savingIncome,     setSavingIncome]     = useState(false)

  // Modal remanente
  const [remModal,         setRemModal]         = useState(false)
  const [remAmount,        setRemAmount]        = useState(0)
  const [remCustomOpen,    setRemCustomOpen]    = useState(false)
  const [remCustomAmount,  setRemCustomAmount]  = useState('')
  const [savingRem,        setSavingRem]        = useState(false)

  const paidPayments = payments.filter(p => p.is_paid)

  // ── Bloquear scroll cuando hay modal abierto ──────────────────────────────
  useEffect(() => {
    if (incomeModal || remModal) {
      document.body.classList.add('modal-open')
    } else {
      document.body.classList.remove('modal-open')
    }
    return () => document.body.classList.remove('modal-open')
  }, [incomeModal, remModal])

  // ── Cargar ingresos y verificar inicio de periodo ─────────────────────────
  useEffect(() => {
    if (!profile) return
    loadIncomes()
    checkPeriodStart()
  }, [profile])

  async function loadIncomes() {
    setLoadingIncomes(true)
    const { start } = cobroPeriod(profile)
    const periodStartStr = start.toISOString().split('T')[0]

    const { data } = await supabase
      .from('period_income')
      .select('*')
      .eq('period_start', periodStartStr)
      .order('created_at', { ascending: false })

    setPeriodIncomes(data || [])
    setLoadingIncomes(false)
  }

  async function checkPeriodStart() {
    if (!profile?.salary_enabled || !profile?.salary_amount) return

    const { start } = cobroPeriod(profile)
    const currentPeriodStart = start.toISOString().split('T')[0]
    const lastSeen = profile.last_seen_period_start

    // Si ya vio este periodo, no mostrar modal
    if (lastSeen === currentPeriodStart) return

    // Calcular remanente del periodo anterior
    const prev = prevPeriod(profile)
    const gastosPrev = paidPayments.filter(p => {
      const d = dateOf(p.due_date)
      return d >= prev.start && d <= prev.end
    })
    const totalGastosPrev = gastosPrev.reduce((a, p) => a + Number(p.amount), 0)
    const salario = Number(profile.salary_amount)

    // Sumar ingresos extras del periodo anterior
    const prevStartStr = prev.start.toISOString().split('T')[0]
    const { data: prevIncomes } = await supabase
      .from('period_income')
      .select('amount')
      .eq('period_start', prevStartStr)

    const totalPrevExtras = (prevIncomes || []).reduce((a, i) => a + Number(i.amount), 0)
    const ingresoTotalPrev = salario + totalPrevExtras
    const remanente = ingresoTotalPrev - totalGastosPrev

    // Actualizar last_seen_period_start primero (para no volver a mostrar)
    await supabase
      .from('profiles')
      .update({ last_seen_period_start: currentPeriodStart })
      .eq('id', profile.id)

    if (onUpdateProfile) {
      onUpdateProfile({ last_seen_period_start: currentPeriodStart })
    }

    // Solo mostrar si hay remanente positivo y no es el primer periodo (lastSeen existe)
    if (remanente > 0 && lastSeen) {
      setRemAmount(remanente)
      setRemCustomAmount(String(Math.round(remanente)))
      setRemModal(true)
    }
  }

  async function handleAddIncome() {
    const amount = parseFloat(incomeAmount)
    if (!amount || amount <= 0) return
    setSavingIncome(true)

    const { start } = cobroPeriod(profile)
    const periodStartStr = start.toISOString().split('T')[0]

    const { error } = await supabase.from('period_income').insert({
      user_id: profile.id,
      period_start: periodStartStr,
      amount,
      type: incomeType,
      note: incomeNote.trim() || null,
    })

    if (!error) {
      await loadIncomes()
      setIncomeModal(false)
      setIncomeAmount('')
      setIncomeNote('')
      setIncomeType('Bono')
    }
    setSavingIncome(false)
  }

  async function handleAddRemanente(amount) {
    setSavingRem(true)
    const { start } = cobroPeriod(profile)
    const periodStartStr = start.toISOString().split('T')[0]

    await supabase.from('period_income').insert({
      user_id: profile.id,
      period_start: periodStartStr,
      amount,
      type: 'Otro',
      note: 'Remanente periodo anterior',
    })

    await loadIncomes()
    setSavingRem(false)
    setRemModal(false)
    setRemCustomOpen(false)
  }

  // ── Totales del periodo ───────────────────────────────────────────────────
  const { start: periodStart, end: periodEnd } = cobroPeriod(profile || {})
  const gastosPeriodo = paidPayments.filter(p => {
    if (!p.paid_at) return false
    const paidDate = dateOf(new Date(p.paid_at).toISOString().split('T')[0])
    return paidDate >= periodStart && paidDate <= periodEnd
  })
  const totalGastos  = gastosPeriodo.reduce((a, p) => a + Number(p.amount), 0)
  const totalExtras  = periodIncomes.reduce((a, i) => a + Number(i.amount), 0)
  const salario      = Number(profile?.salary_amount || 0)
  const ingresoTotal = salario + totalExtras
  const disponible   = ingresoTotal - totalGastos
  const sobrePasado  = totalGastos > ingresoTotal

  // ── Gráfica ──────────────────────────────────────────────────────────────
  function getMonthsArray(n) {
    const arr = []
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      arr.push({ month: d.getMonth(), year: d.getFullYear() })
    }
    return arr
  }

  const chartMonths   = getMonthsArray(monthsBack)
  const chartFiltered = selectedCat ? paidPayments.filter(p => p.category === selectedCat) : paidPayments

  function chartTotalInMonth(month, year) {
    return chartFiltered
      .filter(p => { const d = dateOf(p.due_date); return d.getMonth() === month && d.getFullYear() === year })
      .reduce((a, p) => a + Number(p.amount), 0)
  }

  const chartTotals   = chartMonths.map(m => chartTotalInMonth(m.month, m.year))
  const maxChart      = Math.max(...chartTotals, 1)
  const grandTotal    = chartTotals.reduce((a, b) => a + b, 0)
  const nonZeroMonths = chartTotals.filter(t => t > 0).length
  const avgMonthly    = nonZeroMonths > 0 ? grandTotal / nonZeroMonths : 0

  // ── Por categoría ─────────────────────────────────────────────────────────
  function getCatTotal(cat) {
    if (catRange === 'mes') {
      return paidPayments
        .filter(p => { const d = dateOf(p.due_date); return p.category === cat && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() })
        .reduce((a, p) => a + Number(p.amount), 0)
    }
    if (catRange === 'periodo') {
      return paidPayments
        .filter(p => { const d = dateOf(p.due_date); return p.category === cat && d >= periodStart && d <= periodEnd })
        .reduce((a, p) => a + Number(p.amount), 0)
    }
    return paidPayments
      .filter(p => { const d = dateOf(p.due_date); return p.category === cat && d.getFullYear() === now.getFullYear() })
      .reduce((a, p) => a + Number(p.amount), 0)
  }

  const catData = CATEGORIES
    .map(cat => ({ cat, total: getCatTotal(cat) }))
    .filter(d => d.total > 0)
    .sort((a, b) => b.total - a.total)

  const maxCat = Math.max(...catData.map(d => d.total), 1)

  // ── Pagos realizados ──────────────────────────────────────────────────────
  const availableYears = [...new Set(paidPayments.map(p => dateOf(p.due_date).getFullYear()))].sort((a, b) => b - a)
  if (!availableYears.includes(viewYear)) availableYears.unshift(viewYear)

  function paidInMonth(month, year) {
    return paidPayments.filter(p => {
      const d = dateOf(p.due_date)
      return d.getMonth() === month && d.getFullYear() === year
    })
  }

  const paidInView  = paidInMonth(viewMonth, viewYear).sort((a, b) => dateOf(b.due_date) - dateOf(a.due_date))
  const totalInView = paidInView.reduce((a, p) => a + Number(p.amount), 0)

  function handleMenuAction(action, payment) {
    setOpenMenu(null)
    if (action === 'unpaid') onMarkUnpaid && onMarkUnpaid(payment.id)
    if (action === 'delete') {
      if (payment.is_paid) {
        if (!window.confirm('¿Eliminar este pago del historial?')) return
        onDeleteDirect && onDeleteDirect(payment.id)
      } else {
        onDelete && onDelete(payment.id, payment)
      }
    }
  }

  // Segmentos heatmap
  const segmentos = CATEGORIES
    .map(cat => ({
      cat,
      total: gastosPeriodo.filter(p => p.category === cat).reduce((a, p) => a + Number(p.amount), 0),
    }))
    .filter(s => s.total > 0)
    .sort((a, b) => b.total - a.total)

  const showBalance = profile?.salary_enabled && profile?.salary_amount > 0

  return (
    <div style={{ paddingBottom: 120, background: 'var(--bg)', minHeight: '100vh' }} onClick={() => setOpenMenu(null)}>

      {/* Menú contextual flotante */}
      {openMenu && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: 'fixed',
            top: openMenu.top,
            right: openMenu.right,
            zIndex: 999,
            background: 'var(--surface)',
            borderRadius: 'var(--radius-sm)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            minWidth: 180,
            overflow: 'hidden',
          }}
        >
          {(() => {
            const p = payments.find(x => x.id === openMenu.id)
            if (!p) return null
            return (
              <>
                <button onClick={() => handleMenuAction('unpaid', p)} style={{ width: '100%', padding: '11px 14px', background: 'none', border: 'none', textAlign: 'left', fontSize: 13, fontWeight: 500, color: 'var(--text)', cursor: 'pointer', display: 'block', borderBottom: '0.5px solid var(--bg)' }}>
                  Marcar como no pagado
                </button>
                <button onClick={() => handleMenuAction('delete', p)} style={{ width: '100%', padding: '11px 14px', background: 'none', border: 'none', textAlign: 'left', fontSize: 13, fontWeight: 500, color: 'var(--danger)', cursor: 'pointer', display: 'block' }}>
                  Eliminar
                </button>
              </>
            )
          })()}
        </div>
      )}

      {/* ── Modal Remanente ── */}
      {remModal && (
        <div
          onClick={() => { setRemModal(false); setRemCustomOpen(false) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: 'var(--surface)', borderRadius: '20px 20px 0 0', padding: '24px 20px 32px', width: '100%', maxWidth: 420 }}
          >
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>
                <CircleDollarSign size={36} color="var(--paid)" strokeWidth={1.8} style={{ display: 'block', margin: '0 auto 8px' }} />
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
                ¡Quedó un remanente del periodo anterior!
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--paid)', marginBottom: 6 }}>
                {fmt(remAmount)}
              </div>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
                ¿Quieres añadirlo a este periodo?
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <button
                onClick={() => handleAddRemanente(remAmount)}
                disabled={savingRem}
                style={{ flex: 1, padding: '12px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: savingRem ? 0.6 : 1 }}
              >
                Sí, añadir al periodo
              </button>
              <button
                onClick={() => { setRemModal(false); setRemCustomOpen(false) }}
                style={{ flex: 1, padding: '12px', background: 'none', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
              >
                No
              </button>
            </div>

            {/* Monto personalizado */}
            <button
              onClick={() => setRemCustomOpen(!remCustomOpen)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px', background: 'none', border: 'none', fontSize: 13, fontWeight: 600, color: 'var(--text)', cursor: 'pointer' }}
            >
              {remCustomOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              Añadir monto personalizado
            </button>

            {remCustomOpen && (
              <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                <input
                  type="number"
                  placeholder="Monto personalizado"
                  value={remCustomAmount}
                  onChange={e => setRemCustomAmount(e.target.value)}
                  style={{ flex: 1, padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 14, fontWeight: 500, color: 'var(--text)', background: 'var(--bg)', outline: 'none', fontFamily: 'DM Sans, sans-serif' }}
                />
                <button
                  onClick={() => {
                    const amt = parseFloat(remCustomAmount)
                    if (amt > 0) handleAddRemanente(amt)
                  }}
                  disabled={savingRem || !remCustomAmount || parseFloat(remCustomAmount) <= 0}
                  style={{ padding: '10px 16px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: savingRem ? 0.6 : 1 }}
                >
                  Añadir
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modal Añadir Ingreso ── */}
      {incomeModal && (
        <div
          onClick={() => setIncomeModal(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: 'var(--surface)', borderRadius: '20px 20px 0 0', padding: '24px 20px 32px', width: '100%', maxWidth: 420 }}
          >
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 20 }}>
              Añadir Ingreso Extra
            </div>

            {/* Tipo */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Tipo</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {INCOME_TYPES.map(t => (
                  <button
                    key={t}
                    onClick={() => setIncomeType(t)}
                    style={{
                      padding: '7px 14px',
                      borderRadius: 5,
                      border: incomeType === t ? 'none' : '1px solid var(--border)',
                      background: incomeType === t ? 'var(--accent)' : 'var(--surface)',
                      color: incomeType === t ? '#fff' : 'var(--text)',
                      fontSize: 13,
                      fontWeight: incomeType === t ? 700 : 500,
                      cursor: 'pointer',
                      fontFamily: 'DM Sans, sans-serif',
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Monto */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Monto</div>
              <input
                type="number"
                placeholder="$0"
                value={incomeAmount}
                onChange={e => setIncomeAmount(e.target.value)}
                autoFocus
                style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 14, fontWeight: 500, color: 'var(--text)', background: 'var(--bg)', outline: 'none', fontFamily: 'DM Sans, sans-serif' }}
              />
            </div>

            {/* Nota opcional */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Nota (opcional)</div>
              <input
                type="text"
                placeholder="Ej. Bono de productividad"
                value={incomeNote}
                onChange={e => setIncomeNote(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 14, fontWeight: 500, color: 'var(--text)', background: 'var(--bg)', outline: 'none', fontFamily: 'DM Sans, sans-serif' }}
              />
            </div>

            <button
              onClick={handleAddIncome}
              disabled={savingIncome || !incomeAmount || parseFloat(incomeAmount) <= 0}
              style={{ width: '100%', padding: '12px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: savingIncome || !incomeAmount || parseFloat(incomeAmount) <= 0 ? 0.6 : 1, fontFamily: 'DM Sans, sans-serif', marginBottom: 8 }}
            >
              {savingIncome ? 'Guardando...' : 'Guardar ingreso'}
            </button>
            <button
              onClick={() => setIncomeModal(false)}
              style={{ width: '100%', padding: '10px', background: 'none', color: 'var(--text)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <PageHeader
        profile={profile}
        unreadCount={unreadCount}
        onOpenNotifs={onOpenNotifs}
        onGoSettings={onGoSettings}
      />

      <div style={{ background: 'var(--bg)', borderRadius: '24px 24px 0 0', marginTop: -24, position: 'relative', zIndex: 10 }}>
        <div className={slideClass}>

        {/* Zona de título con fondo diferente */}
        <div style={{ background: '#E8E8E8', borderRadius: '24px 24px 0 0', padding: '20px 16px 18px', marginBottom: 16 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>Mis gastos e ingresos</div>
          <div style={{ fontSize: 13, fontWeight: 400, color: 'var(--text)', marginTop: 4 }}>Historial, análisis y balance de tus finanzas del periodo.</div>
        </div>

        {/* ── BALANCE DEL PERIODO (solo si salary_enabled) ── */}
        {showBalance && (
          <div style={{ margin: '0 16px 16px', background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '14px 16px' }}>

            {/* Cabecera con botón Añadir ingreso */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 15 }}>Disponible Este Periodo</div>
                <div style={{ fontSize: 26, fontWeight: 700, color: sobrePasado ? 'var(--danger)' : 'var(--paid)', lineHeight: 1 }}>
                  {sobrePasado ? '-' : ''}{fmt(Math.abs(disponible))}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                {/* Botón discreto Añadir ingreso */}
                <button
                  onClick={() => setIncomeModal(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '6px 10px',
                    borderRadius: 5,
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    color: 'var(--text)',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'DM Sans, sans-serif',
                    flexShrink: 0,
                  }}
                >
                  <Plus size={13} strokeWidth={2.2} />
                  Añadir ingreso
                </button>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, fontWeight: 500, color: 'var(--text)' }}>
                    {fmt(totalGastos)} <span style={{ fontWeight: 400 }}>/ {fmt(ingresoTotal)}</span>
                  </div>
                  {totalExtras > 0 && (
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--paid)' }}>
                      +{fmt(totalExtras)} extras
                    </div>
                  )}
                  {sobrePasado && (
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--danger)' }}>Presupuesto excedido</div>
                  )}
                </div>
              </div>
            </div>

            {/* Barra heatmap segmentada */}
            <div style={{ height: 12, borderRadius: 6, overflow: 'hidden', display: 'flex', background: 'var(--border)', marginBottom: 10 }}>
              {segmentos.map(({ cat, total }) => (
                <div
                  key={cat}
                  style={{
                    height: '100%',
                    width: `${Math.min((total / ingresoTotal) * 100, 100)}%`,
                    background: CAT_COLOR[cat] || 'var(--accent)',
                    flexShrink: 0,
                    transition: 'width .4s ease',
                  }}
                  title={`${cat}: ${fmt(total)}`}
                />
              ))}
            </div>

            {/* Chips de categoría */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {segmentos.map(({ cat, total }) => (
                <div key={cat} style={{
                  padding: '3px 10px',
                  borderRadius: 5,
                  fontSize: 11,
                  fontWeight: 500,
                  background: (CAT_COLOR[cat] || 'var(--accent)') + '22',
                  color: CAT_COLOR[cat] || 'var(--accent)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: CAT_COLOR[cat] || 'var(--accent)', display: 'inline-block' }} />
                  {cat} {fmt(total)}
                </div>
              ))}
            </div>

            {/* Ingresos extras del periodo */}
            {!loadingIncomes && periodIncomes.length > 0 && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '0.5px solid var(--border)' }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Ingresos Extras Este Periodo</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {periodIncomes.map(inc => (
                    <div key={inc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{inc.type}</span>
                        {inc.note && <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text)', marginLeft: 6 }}>· {inc.note}</span>}
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--paid)' }}>+{fmt(inc.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Chips de categoría */}
        <div style={{ padding: '0 16px 15px', display: 'flex', gap: 6, overflowX: 'auto', msOverflowStyle: 'none', scrollbarWidth: 'none' }}>
          <FilterChip label="Todos" active={!selectedCat} onClick={() => setSelectedCat(null)} />
          {CATEGORIES.map(c => (
            <FilterChip key={c} label={c} active={selectedCat === c} onClick={() => setSelectedCat(selectedCat === c ? null : c)} />
          ))}
        </div>

        {/* Stats */}
        <div style={{ margin: '0 16px 12px', background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ flex: 1.6 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
              Total {monthsBack} meses
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)', lineHeight: 1.1 }}>{fmt(grandTotal)}</div>
          </div>
          <div style={{ width: 1, height: 40, background: 'var(--border)', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
              Promedio mensual
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', lineHeight: 1.1 }}>{fmt(Math.round(avgMonthly))}</div>
          </div>
        </div>

        {/* Selector de rango */}
        <div style={{ padding: '0 16px 10px', display: 'flex', gap: 6 }}>
          {[3, 6, 12].map(n => (
            <FilterChip key={n} label={`${n} meses`} active={monthsBack === n} onClick={() => setMonthsBack(n)} />
          ))}
        </div>

        {/* Gráfica */}
        <div style={{ margin: '0 16px 20px', background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '16px 14px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 14 }}>
            Gastos Mensuales
          </div>
          {/* Labels de monto arriba */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 4, height: 16 }}>
            {chartMonths.map((m, i) => {
              const total     = chartTotals[i]
              const isCurrent = m.month === now.getMonth() && m.year === now.getFullYear()
              const barColor  = selectedCat ? CAT_COLOR[selectedCat] : 'var(--accent)'
              return (
                <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                  {total > 0 && (
                    <div style={{ fontSize: 9, fontWeight: 700, color: isCurrent ? barColor : 'var(--text)' }}>
                      {fmt(total)}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          {/* Barras */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 80 }}>
            {chartMonths.map((m, i) => {
              const total     = chartTotals[i]
              const heightPct = (total / maxChart) * 100
              const isCurrent = m.month === now.getMonth() && m.year === now.getFullYear()
              const barColor  = selectedCat ? CAT_COLOR[selectedCat] : 'var(--accent)'
              const barMuted  = selectedCat ? (CAT_COLOR[selectedCat] + '55') : 'var(--accent-border)'
              return (
                <div key={i} style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'flex-end' }}>
                  <div style={{
                    width: '100%',
                    height: `${Math.max(heightPct, total > 0 ? 3 : 0)}%`,
                    background: isCurrent ? barColor : barMuted,
                    borderRadius: '3px 3px 0 0',
                    minHeight: total > 0 ? 3 : 0,
                    transition: 'height .3s',
                  }} />
                </div>
              )
            })}
          </div>
          {/* Labels de mes abajo */}
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            {chartMonths.map((m, i) => {
              const isCurrent = m.month === now.getMonth() && m.year === now.getFullYear()
              const barColor  = selectedCat ? CAT_COLOR[selectedCat] : 'var(--accent)'
              return (
                <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: 9, fontWeight: isCurrent ? 700 : 500, color: isCurrent ? barColor : 'var(--text)' }}>
                  {MONTHS_SHORT[m.month]}
                </div>
              )
            })}
          </div>
        </div>

        {/* Por Categoría */}
        <div style={{ padding: '0 16px 20px' }}>
          <div style={{ marginBottom: 10 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Por Categoría</span>
          </div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            {[{ id: 'mes', label: 'Mes Actual' }, { id: 'periodo', label: 'Periodo' }, { id: 'año', label: 'Año' }].map(o => (
              <FilterChip key={o.id} label={o.label} active={catRange === o.id} onClick={() => setCatRange(o.id)} />
            ))}
          </div>

          {catData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
              Sin gastos registrados
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {catData.map(({ cat, total }) => (
                <div key={cat}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{cat}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{fmt(total)}</span>
                  </div>
                  <div style={{ height: 6, background: 'var(--border)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${(total / maxCat) * 100}%`,
                      background: CAT_COLOR[cat] || 'var(--accent)',
                      borderRadius: 'var(--radius-full)',
                      transition: 'width .4s ease',
                    }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Pagos realizados ── */}
        <div style={{ padding: '0 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Pagos</span>
          </div>

          {/* Filtros Mes y Año */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>Filtros</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>Mes:</span>
              <select
                value={viewMonth}
                onChange={e => setViewMonth(Number(e.target.value))}
                style={{ padding: '5px 8px', borderRadius: 5, border: '0.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 12, fontWeight: 500, fontFamily: 'DM Sans, sans-serif', outline: 'none', cursor: 'pointer' }}
              >
                {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>Año:</span>
              <select
                value={viewYear}
                onChange={e => setViewYear(Number(e.target.value))}
                style={{ padding: '5px 8px', borderRadius: 5, border: '0.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 12, fontWeight: 500, fontFamily: 'DM Sans, sans-serif', outline: 'none', cursor: 'pointer' }}
              >
                {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>

          {paidInView.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
              Sin pagos realizados en {MONTHS[viewMonth]} {viewYear}
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>
                  Total: <strong style={{ fontWeight: 700 }}>{fmt(totalInView)}</strong>
                </span>
              </div>
              <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                {paidInView.map((p, i) => {
                  const paidDate = p.paid_at ? new Date(p.paid_at) : dateOf(p.due_date)
                  const isLast   = i === paidInView.length - 1
                  return (
                    <div key={p.id} style={{
                      display: 'flex', alignItems: 'center',
                      padding: '10px 14px',
                      borderBottom: isLast ? 'none' : '0.5px solid var(--bg)',
                      borderLeft: '4px solid var(--paid)',
                      gap: 10,
                      position: 'relative',
                    }}>
                      <div style={{ textAlign: 'center', minWidth: 28, flexShrink: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>{paidDate.getDate()}</div>
                        <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text)', textTransform: 'uppercase' }}>{MONTHS_SHORT[paidDate.getMonth()]}</div>
                      </div>
                      <div style={{ width: 1, height: 28, background: 'var(--border)', flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                          {p.name}
                          {p.is_installment && (
                            <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--text)' }}>
                              {p.current_installment}/{p.total_installments}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: CAT_COLOR[p.category] || 'var(--text)', display: 'inline-block', flexShrink: 0 }} />
                          {p.category}
                          {p.is_recurrent && <span style={{ fontWeight: 400 }}>· Mensual</span>}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{fmt(p.amount)}</div>
                        {p.is_variable && (
                          <span style={{ fontSize: 9, background: '#6884A9', color: '#fff', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>
                            Variable
                          </span>
                        )}
                      </div>
                      <div style={{ position: 'relative', flexShrink: 0 }}>
                        <button
                          onClick={e => {
                            e.stopPropagation()
                            const rect = e.currentTarget.getBoundingClientRect()
                            setOpenMenu(openMenu?.id === p.id ? null : { id: p.id, top: rect.bottom + 4, right: window.innerWidth - rect.right })
                          }}
                          style={{ background: 'none', border: 'none', padding: '4px', display: 'flex', alignItems: 'center', cursor: 'pointer', borderRadius: 4 }}
                        >
                          <MoreVertical size={16} color="var(--text)" strokeWidth={1.8} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
        </div>
      </div>
    </div>
  )
}

function FilterChip({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 14px',
        borderRadius: 5,
        border: active ? 'none' : '0.5px solid var(--border)',
        background: active ? 'var(--accent)' : 'var(--surface)',
        color: active ? '#fff' : 'var(--text)',
        fontSize: 12,
        fontWeight: active ? 700 : 500,
        fontFamily: 'DM Sans, sans-serif',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        flexShrink: 0,
        transition: 'background .15s, color .15s',
      }}
    >
      {label}
    </button>
  )
}
